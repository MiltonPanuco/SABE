"""
Avisos para los usuarios y bitácora de quién hizo qué (F10).

Cada evento tiene su función `aviso_*`, que arma los textos de stitch (sabe_panel_de_notificaciones
y sabe_notificaciones_de_control_escolar) y los datos de la tarjeta. Los avisos para control escolar
se copian a cada usuario de control escolar activo, para que cada quien lleve sus leídas.

Dos avisos no vienen de una acción sino de un estado, y se crean al consultar la lista
(`avisos_al_leer`): "La convocatoria cierra en 24 horas" (alumno) y "Lote de actas dictaminadas
listo para exportación" (control escolar).

`registrar` deja la fila de la bitácora con la frase que lee control escolar.
"""

from datetime import timedelta

from django.db import IntegrityError, models, transaction
from django.utils import timezone

from core.models import (
    Bitacora,
    DetalleSolicitud,
    ImportacionCSV,
    Notificacion,
    PeriodoEscolar,
    Rol,
    Solicitud,
    Usuario,
)

LARGO_ENTIDAD = Bitacora._meta.get_field("entidad").max_length
LARGO_TITULO = Notificacion._meta.get_field("titulo").max_length
Tipo = Notificacion.Tipo
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
         "noviembre", "diciembre"]


def plural(n: int, uno: str, varios: str) -> str:
    return f"{n} {uno if n == 1 else varios}"


def unir(partes: list[str]) -> str:
    """["A", "B", "C"] -> "A, B y C" """
    return partes[0] if len(partes) == 1 else f"{', '.join(partes[:-1])} y {partes[-1]}"


# ---------------------------------------------------------------------------
# Notificaciones
# ---------------------------------------------------------------------------

def notificar(
    usuario: Usuario,
    tipo: str,
    titulo: str,
    mensaje: str,
    *,
    solicitud: Solicitud | None = None,
    periodo: PeriodoEscolar | None = None,
    datos: dict | None = None,
) -> Notificacion:
    """Guarda un aviso para `usuario`."""
    return Notificacion.objects.create(
        usuario=usuario,
        tipo=tipo,
        titulo=titulo[:LARGO_TITULO],
        mensaje=mensaje,
        solicitud=solicitud,
        periodo=periodo,
        datos=datos or {},
    )


def control_escolar() -> models.QuerySet[Usuario]:
    return Usuario.objects.filter(rol=Rol.CONTROL_ESCOLAR, is_active=True)


def notificar_control_escolar(tipo: str, titulo: str, mensaje: str, **campos) -> int:
    """El mismo aviso para cada usuario de control escolar activo. Devuelve cuántos creó."""
    datos = campos.pop("datos", None) or {}
    avisos = [
        Notificacion(usuario=u, tipo=tipo, titulo=titulo[:LARGO_TITULO], mensaje=mensaje, datos=datos, **campos)
        for u in control_escolar()
    ]
    Notificacion.objects.bulk_create(avisos)
    return len(avisos)


def _movimientos(solicitud: Solicitud, estado: str | None = None) -> list[DetalleSolicitud]:
    detalles = solicitud.detalles.select_related("grupo__materia").order_by("id")
    return list(detalles.filter(estado=estado) if estado else detalles)


def _desglose(movimientos: list[DetalleSolicitud]) -> str:
    """"1 alta, 1 baja" """
    altas = sum(m.tipo_tramite == DetalleSolicitud.Tipo.ALTA for m in movimientos)
    bajas = len(movimientos) - altas
    partes = [plural(altas, "alta", "altas")] if altas else []
    if bajas:
        partes.append(plural(bajas, "baja", "bajas"))
    return ", ".join(partes)


def _conteo(movimientos: list[DetalleSolicitud]) -> str:
    """"2 movimientos solicitados (1 alta, 1 baja)" """
    total = plural(len(movimientos), "movimiento solicitado", "movimientos solicitados")
    return f"{total} ({_desglose(movimientos)})"


def _materia(grupo) -> str:
    """"Macroeconomía II (Gpo. 02)" """
    return f"{grupo.materia.nombre_materia} (Gpo. {grupo.num_grupo})"


def aviso_folio_enviado(solicitud: Solicitud) -> None:
    """Al alumno: su folio quedó en revisión. A control escolar: nueva solicitud (o extemporánea)."""
    estudiante = solicitud.estudiante
    alumno = estudiante.usuario
    movimientos = _movimientos(solicitud)
    conteo = _conteo(movimientos)
    folio = solicitud.folio_digital
    notificar(
        alumno,
        Tipo.FOLIO_ENVIADO,
        f"Tu solicitud {folio} fue enviada exitosamente",
        f"Ingresada para revisión por Control Escolar con {conteo}.",
        solicitud=solicitud,
    )

    nombre = alumno.get_full_name()
    pills = [
        {"tipo": m.tipo_tramite, "materia": m.grupo.materia.nombre_materia, "grupo": m.grupo.num_grupo}
        for m in movimientos
    ]
    datos = {
        "alumno": nombre,
        "matricula": estudiante.matricula,
        "programa": estudiante.programa.nombre,
        "semestre": estudiante.semestre,
        "movimientos": pills,
        "justificacion": solicitud.justificacion,
    }
    if solicitud.extemporanea:
        notificar_control_escolar(
            Tipo.SOLICITUD_EXTEMPORANEA,
            f"Petición extemporánea recibida: Folio {folio}",
            f"{nombre} (Matrícula: {estudiante.matricula}, Lic. en {estudiante.programa.nombre}) envió su solicitud "
            f"fuera del calendario regular con {conteo}. Su resolución corresponde exclusivamente a Control Escolar.",
            solicitud=solicitud,
            datos=datos,
        )
    else:
        notificar_control_escolar(
            Tipo.NUEVA_SOLICITUD,
            f"Nueva solicitud ingresada: Folio {folio}",
            f"{nombre} (Matrícula: {estudiante.matricula}, Lic. en {estudiante.programa.nombre}, "
            f"{estudiante.semestre}° Semestre) ingresó solicitud con {conteo}.",
            solicitud=solicitud,
            datos=datos,
        )


def aviso_cancelacion(solicitud: Solicitud, canceladas: list[DetalleSolicitud]) -> None:
    """A control escolar: el alumno canceló lo que seguía pendiente de su folio."""
    nombre = solicitud.estudiante.usuario.get_full_name()
    materias = unir([_materia(m.grupo) for m in canceladas])
    pendientes = "canceló el movimiento pendiente" if len(canceladas) == 1 else "cancelaron los movimientos pendientes"
    notificar_control_escolar(
        Tipo.CANCELACION,
        f"Solicitud cancelada por el alumno: Folio {solicitud.folio_digital}",
        f"{nombre} desistió voluntariamente de su trámite antes de la emisión del dictamen. "
        f"Se {pendientes} para {materias}.",
        solicitud=solicitud,
        datos={"alumno": nombre, "matricula": solicitud.estudiante.matricula, "canceladas": len(canceladas)},
    )


def aviso_dictamen(detalle: DetalleSolicitud) -> Notificacion:
    """Al alumno: se aprobó o se rechazó un movimiento de su folio."""
    solicitud = detalle.solicitud
    grupo = detalle.grupo
    tipo = "alta" if detalle.tipo_tramite == DetalleSolicitud.Tipo.ALTA else "baja"
    folio = solicitud.folio_digital
    datos = {"movimiento": detalle.tipo_tramite, "materia": grupo.materia.nombre_materia, "grupo": grupo.num_grupo}
    if detalle.estado == DetalleSolicitud.Estado.RECHAZADA:
        return notificar(
            solicitud.estudiante.usuario,
            Tipo.MOVIMIENTO_RECHAZADO,
            f"Se rechazó tu {tipo} en {_materia(grupo)}",
            f"Folio {folio}. Motivo: {detalle.motivo_rechazo}",
            solicitud=solicitud,
            datos=datos,
        )
    efecto = "Asignatura incorporada a tu tira horaria." if tipo == "alta" else "La asignatura sale de tu tira horaria."
    if tipo == "alta":
        datos["horarios"] = [
            {"dia_semana": h.dia_semana, "hora_inicio": f"{h.hora_inicio:%H:%M}", "hora_fin": f"{h.hora_fin:%H:%M}"}
            for h in grupo.horarios.order_by("dia_semana", "hora_inicio")
        ]
        datos["docente"] = grupo.docente.nombre
    return notificar(
        solicitud.estudiante.usuario,
        Tipo.MOVIMIENTO_APROBADO,
        f"Se aprobó tu {tipo} en {_materia(grupo)}",
        f"Folio {folio}. {efecto}",
        solicitud=solicitud,
        datos=datos,
    )


def aviso_cargada_sadce(solicitud: Solicitud, usuario: Usuario) -> Notificacion:
    """Al alumno: control escolar pasó su folio a SADCE."""
    return notificar(
        usuario,
        Tipo.CARGADA_SADCE,
        f"Tu solicitud {solicitud.folio_digital} fue cargada en SADCE",
        "Control Escolar pasó la información a SADCE. Consulta tu acuse y horario oficial actualizado.",
        solicitud=solicitud,
    )


def aviso_importacion(importacion: ImportacionCSV) -> None:
    """A control escolar: terminó una importación de CSV."""
    alumnos = importacion.tipo == ImportacionCSV.Tipo.ALUMNOS
    if alumnos:
        titulo = "Importación masiva de alumnos finalizada con éxito"
        cuerpo = (
            f"La importación concluyó la lectura del archivo de alumnos: "
            f"{plural(importacion.creados, 'alumno creado', 'alumnos creados')} con contraseña provisional autogenerada, "
            f"{plural(importacion.actualizados, 'actualizado', 'actualizados')} y "
            f"{plural(importacion.excluidos, 'registro rechazado', 'registros rechazados')}."
        )
    else:
        titulo = "Importación de cargas académicas finalizada con éxito"
        cuerpo = (
            f"La importación concluyó la lectura del archivo de cargas: "
            f"{plural(importacion.creados, 'carga nueva', 'cargas nuevas')}, "
            f"{importacion.actualizados} sin cambios y "
            f"{plural(importacion.excluidos, 'registro rechazado', 'registros rechazados')}."
        )
    notificar_control_escolar(
        Tipo.IMPORTACION,
        titulo,
        cuerpo,
        periodo=importacion.periodo,
        datos={
            "folio": importacion.folio,
            "tipo": importacion.tipo,
            "archivo": importacion.archivo,
            "creados": importacion.creados,
            "actualizados": importacion.actualizados,
            "excluidos": importacion.excluidos,
        },
    )


def _fecha_cierre(fin, ahora) -> str:
    """"mañana 13 de febrero a las 23:59 hrs" """
    local, hoy = timezone.localtime(fin), timezone.localtime(ahora).date()
    dia = {hoy: "hoy ", hoy + timedelta(days=1): "mañana "}.get(local.date(), "el ")
    return f"{dia}{local.day} de {MESES[local.month - 1]} a las {local:%H:%M} hrs"


def _crear_una_vez(usuario: Usuario, tipo: str, periodo: PeriodoEscolar, **campos) -> None:
    """Crea el aviso de estado si aún no existe (la base rechaza el duplicado de una petición paralela)."""
    if Notificacion.objects.filter(usuario=usuario, tipo=tipo, periodo=periodo).exists():
        return
    try:
        with transaction.atomic():
            notificar(usuario, tipo, periodo=periodo, **campos)
    except IntegrityError:
        pass


def avisos_al_leer(usuario: Usuario, ahora=None) -> None:
    """Los avisos que dependen de un estado y no de una acción. Se llama antes de listar."""
    periodo = PeriodoEscolar.objects.filter(activo=True).first()
    if periodo is None:
        return
    ahora = ahora or timezone.now()

    if usuario.rol == Rol.ESTUDIANTE:
        fin = periodo.convocatoria_fin
        if periodo.convocatoria_inicio <= ahora < fin and fin - ahora <= timedelta(hours=24):
            _crear_una_vez(
                usuario,
                Tipo.CONVOCATORIA_CIERRA,
                periodo,
                titulo="La convocatoria cierra en 24 horas",
                mensaje=(
                    f"El periodo de ajustes de altas y bajas del Ciclo {periodo.ciclo} concluye "
                    f"{_fecha_cierre(fin, ahora)}. Revisa tus trámites pendientes antes del cierre del sistema."
                ),
            )
        return

    if usuario.rol != Rol.CONTROL_ESCOLAR:
        return
    por_exportar = DetalleSolicitud.objects.filter(
        solicitud__periodo=periodo, estado=DetalleSolicitud.Estado.APROBADA, lote=None
    ).count()
    actual = Notificacion.objects.filter(usuario=usuario, tipo=Tipo.EXPORTACION_PENDIENTE, periodo=periodo)
    if not por_exportar:
        actual.delete()
        return
    mensaje = (
        f"{'Existe' if por_exportar == 1 else 'Existen'} "
        f"{plural(por_exportar, 'movimiento aprobado listo', 'movimientos aprobados listos')} para generar "
        "el archivo de Excel de intercambio (.xlsx) para su procesamiento y registro ante SADCE Central."
    )
    existente = actual.first()
    if existente is None:
        _crear_una_vez(
            usuario,
            Tipo.EXPORTACION_PENDIENTE,
            periodo,
            titulo="Lote de actas dictaminadas listo para exportación",
            mensaje=mensaje,
            datos={"movimientos": por_exportar},
        )
    elif existente.datos.get("movimientos") != por_exportar:
        # Cambió la cantidad: vuelve a aparecer arriba y sin leer.
        actual.update(mensaje=mensaje, datos={"movimientos": por_exportar}, leida=False, fecha=ahora)


def quitar_aviso_exportacion(periodo: PeriodoEscolar) -> None:
    """Después de generar un lote: si ya no queda nada por exportar, el aviso sobra."""
    pendientes = DetalleSolicitud.objects.filter(
        solicitud__periodo=periodo, estado=DetalleSolicitud.Estado.APROBADA, lote=None
    ).exists()
    if not pendientes:
        Notificacion.objects.filter(tipo=Tipo.EXPORTACION_PENDIENTE, periodo=periodo).delete()


# Categorías de los filtros de cada pantalla de notificaciones.
CATEGORIAS_AVISO = {
    Tipo.FOLIO_ENVIADO: ["tramites"],
    Tipo.MOVIMIENTO_APROBADO: ["resoluciones", "tramites"],
    Tipo.MOVIMIENTO_RECHAZADO: ["resoluciones", "tramites"],
    Tipo.CARGADA_SADCE: ["resoluciones", "tramites"],
    Tipo.CONVOCATORIA_CIERRA: ["convocatoria"],
    Tipo.NUEVA_SOLICITUD: ["nuevas"],
    Tipo.SOLICITUD_EXTEMPORANEA: ["nuevas"],
    Tipo.CANCELACION: ["cancelaciones"],
    Tipo.IMPORTACION: ["sistema"],
    Tipo.EXPORTACION_PENDIENTE: ["sistema"],
    Tipo.AVISO: [],
}


def tipos_de_categoria(categoria: str) -> list[str]:
    return [tipo for tipo, categorias in CATEGORIAS_AVISO.items() if categoria in categorias]


# ---------------------------------------------------------------------------
# Bitácora
# ---------------------------------------------------------------------------

# Acción -> categoría del filtro "Acción" de stitch/sabe_bitacora_auditoria.
CATEGORIAS = {
    "enviar_folio": "Dictamen",
    "cancelar_folio": "Dictamen",
    "aprobar": "Dictamen",
    "rechazar": "Dictamen",
    "importar_csv": "Importación",
    "exportar_sadce": "Exportación",
    "marcar_cargado": "Exportación",
    "publicar_grupo": "Oferta",
    "editar_grupo": "Oferta",
    "mostrar_grupo": "Oferta",
    "ocultar_grupo": "Oferta",
    "crear_docente": "Oferta",
    "crear_periodo": "Periodo",
    "editar_periodo": "Periodo",
    "activar_periodo": "Periodo",
    "iniciar_sesion": "Acceso",
}
CATEGORIAS_BITACORA = ["Dictamen", "Importación", "Exportación", "Oferta", "Periodo", "Usuarios", "Acceso"]


def categoria_de(accion: str) -> str:
    return CATEGORIAS.get(accion, "Usuarios" if accion.endswith("_usuario") else "Otros")


def acciones_de(categoria: str) -> list[str]:
    return [accion for accion, cat in CATEGORIAS.items() if cat == categoria]


def entidad_de(objeto: models.Model, descripcion: str | None = None) -> str:
    """Texto de la entidad para la bitácora: "PeriodoEscolar #3 (2026-A)"."""
    texto = f"{type(objeto).__name__} #{objeto.pk} ({descripcion or objeto})"
    return texto if len(texto) <= LARGO_ENTIDAD else texto[: LARGO_ENTIDAD - 1] + "…"


def registrar(
    usuario: Usuario | None,
    accion: str,
    objeto: models.Model,
    *,
    detalle: str = "",
    descripcion: str | None = None,
    request=None,
) -> Bitacora:
    """Agrega una fila a la bitácora. Con `request`, guarda también la IP de origen."""
    ip = request.META.get("REMOTE_ADDR") if request is not None else None
    return Bitacora.objects.create(
        usuario=usuario, accion=accion, entidad=entidad_de(objeto, descripcion), detalle=detalle, ip=ip or None
    )


def movimiento_en_texto(detalle: DetalleSolicitud) -> str:
    """"la baja de Pensamiento Económico II (EC504) del folio SABE-2026-086" (como en stitch)."""
    tipo = "alta" if detalle.tipo_tramite == DetalleSolicitud.Tipo.ALTA else "baja"
    materia = detalle.grupo.materia
    return f"la {tipo} de {materia.nombre_materia} ({materia.clave}) del folio {detalle.solicitud.folio_digital}"


def conteo_folio(movimientos: list[DetalleSolicitud]) -> str:
    """"2 movimientos (1 alta, 1 baja)" """
    return f"{plural(len(movimientos), 'movimiento', 'movimientos')} ({_desglose(movimientos)})"
