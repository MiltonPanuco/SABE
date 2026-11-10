"""
Dictamen de control escolar (F6): aprobar o rechazar cada movimiento de un folio.

Al aprobar se revisa solo contra la carga inscrita del alumno (los trámites pendientes no apartan
lugar ni horario). En un cambio de grupo la baja del mismo folio se aprueba primero: mientras siga
pendiente, el alta que choca con ella queda bloqueada con `baja_pendiente`.
"""

from datetime import datetime

from django.db import transaction
from django.utils import timezone

from core.models import CargaAcademica, DetalleSolicitud, Estudiante, Grupo, Solicitud, Usuario

from .avisos import notificar
from .catalogo import con_cupo
from .choques import Choque
from .validacion import Codigo, Contexto, ErrorMovimiento, revisar_alta

MOTIVO_MAX = 500
Tipo = DetalleSolicitud.Tipo
Estado = DetalleSolicitud.Estado


class DictamenInvalido(Exception):
    """El movimiento no se puede aprobar o rechazar. `datos` es el cuerpo del 400, con el formato de DRF."""

    def __init__(self, datos: dict, choques: list[Choque] | None = None, errores: list[ErrorMovimiento] | None = None):
        super().__init__(datos)
        self.datos = datos
        self.choques = choques or []
        self.errores = errores or []


def _bajas_pendientes(solicitud: Solicitud) -> dict[int, Grupo]:
    """Grupos con baja pendiente en el folio, con su materia: liberan horario solo cuando se aprueban."""
    return {
        detalle.grupo_id: detalle.grupo
        for detalle in solicitud.detalles.filter(tipo_tramite=Tipo.BAJA, estado=Estado.PENDIENTE).select_related(
            "grupo__materia"
        )
    }


def _baja_pendiente(grupo: Grupo) -> ErrorMovimiento:
    return ErrorMovimiento(
        Codigo.BAJA_PENDIENTE, f"Aprueba primero la baja de {grupo.materia.nombre_materia} en este folio."
    )


def revisar_movimiento(
    detalle: DetalleSolicitud, contexto: Contexto, bajas_pendientes: dict[int, Grupo]
) -> tuple[list[Choque], list[ErrorMovimiento]]:
    """
    Qué impide aprobar el movimiento hoy. `contexto` se arma con `contar_pendientes=False`
    y el grupo del movimiento debe venir de `catalogo.con_cupo` (trae cupo y horarios).
    """
    grupo = detalle.grupo
    if detalle.tipo_tramite == Tipo.BAJA:
        if grupo.pk in contexto.inscritos:
            return [], []
        return [], [ErrorMovimiento(Codigo.NO_INSCRITO, "El alumno ya no está inscrito en este grupo.")]

    choques, errores = revisar_alta(grupo, contexto)
    # Lo que choca con una baja pendiente del mismo folio se libera al aprobar esa baja.
    por_aprobar: dict[int, Grupo] = {}
    for choque in choques:
        if choque.choca_con.pk in bajas_pendientes:
            por_aprobar[choque.choca_con.pk] = bajas_pendientes[choque.choca_con.pk]
    for baja in bajas_pendientes.values():
        if baja.materia_id == grupo.materia_id:
            por_aprobar[baja.pk] = baja
            errores = [e for e in errores if e.codigo != Codigo.MISMA_MATERIA]
    choques = [c for c in choques if c.choca_con.pk not in por_aprobar]
    errores += [_baja_pendiente(baja) for baja in por_aprobar.values()]
    return choques, errores


def revision_folio(solicitud: Solicitud) -> dict[int, tuple[list[Choque], list[ErrorMovimiento]]]:
    """Para cada movimiento pendiente del folio, qué impide aprobarlo (listas vacías si nada)."""
    pendientes = list(
        solicitud.detalles.filter(estado=Estado.PENDIENTE)
        .select_related("grupo")
        .order_by("id")
    )
    if not pendientes:
        return {}
    grupos = {g.pk: g for g in con_cupo(Grupo.objects.filter(pk__in=[d.grupo_id for d in pendientes]))}
    for detalle in pendientes:
        detalle.grupo = grupos[detalle.grupo_id]
    bajas = {d.grupo_id: d.grupo for d in pendientes if d.tipo_tramite == Tipo.BAJA}
    contexto = Contexto.para(solicitud.estudiante, solicitud.periodo, contar_pendientes=False)
    return {detalle.pk: revisar_movimiento(detalle, contexto, bajas) for detalle in pendientes}


def _bloquear(detalle: DetalleSolicitud) -> tuple[DetalleSolicitud, Solicitud]:
    """
    Bloquea alumno, grupo y movimiento, en ese orden, y devuelve el movimiento releído.
    Dos personas que dictaminan a la vez esperan su turno: no se pasa el cupo ni se cruzan horarios.
    """
    ids = DetalleSolicitud.objects.filter(pk=detalle.pk).values("grupo_id", "solicitud__estudiante_id").get()
    Estudiante.objects.select_for_update().get(pk=ids["solicitud__estudiante_id"])
    Grupo.objects.select_for_update().get(pk=ids["grupo_id"])
    actual = DetalleSolicitud.objects.select_for_update().get(pk=detalle.pk)
    if actual.estado != Estado.PENDIENTE:
        raise DictamenInvalido({"detail": "Este movimiento ya fue dictaminado."})
    solicitud = Solicitud.objects.select_related("periodo", "estudiante__usuario").get(pk=actual.solicitud_id)
    return actual, solicitud


def _nombre(detalle: DetalleSolicitud) -> str:
    grupo = detalle.grupo
    tipo = "alta" if detalle.tipo_tramite == Tipo.ALTA else "baja"
    return f"Tu {tipo} de {grupo.materia.nombre_materia} (grupo {grupo.num_grupo}) del folio {detalle.solicitud.folio_digital}"


def aprobar_movimiento(
    detalle: DetalleSolicitud, usuario: Usuario, *, visto_bueno: bool = False, ahora: datetime | None = None
) -> DetalleSolicitud:
    """Aprueba el movimiento y cambia la carga del alumno, o lanza DictamenInvalido."""
    with transaction.atomic():
        detalle, solicitud = _bloquear(detalle)
        if solicitud.extemporanea and not visto_bueno:
            raise DictamenInvalido(
                {"detail": "Marca el visto bueno de Control Escolar para aprobar un folio extemporáneo."}
            )

        # El cupo se cuenta después del bloqueo: ve lo que otra aprobación acaba de guardar.
        detalle.grupo = con_cupo(Grupo.objects.filter(pk=detalle.grupo_id)).get()
        detalle.solicitud = solicitud
        contexto = Contexto.para(solicitud.estudiante, solicitud.periodo, contar_pendientes=False)
        choques, errores = revisar_movimiento(detalle, contexto, _bajas_pendientes(solicitud))
        if choques or errores:
            raise DictamenInvalido({"detail": "Este movimiento no se puede aprobar."}, choques, errores)

        if detalle.tipo_tramite == Tipo.ALTA:
            CargaAcademica.objects.update_or_create(
                estudiante=solicitud.estudiante,
                grupo=detalle.grupo,
                defaults={"estado": CargaAcademica.Estado.INSCRITO, "origen": CargaAcademica.Origen.SOLICITUD},
            )
        else:
            CargaAcademica.objects.filter(
                estudiante=solicitud.estudiante, grupo=detalle.grupo, estado=CargaAcademica.Estado.INSCRITO
            ).update(estado=CargaAcademica.Estado.BAJA)

        detalle.estado = Estado.APROBADA
        detalle.visto_bueno = visto_bueno
        detalle.revisado_por = usuario
        detalle.fecha_resolucion = ahora or timezone.now()
        detalle.save(update_fields=["estado", "visto_bueno", "revisado_por", "fecha_resolucion"])
        notificar(solicitud.estudiante.usuario, f"{_nombre(detalle)} fue aprobada.")
    return detalle


def rechazar_movimiento(
    detalle: DetalleSolicitud, usuario: Usuario, motivo: str, *, ahora: datetime | None = None
) -> DetalleSolicitud:
    """Rechaza el movimiento con su motivo (lo verá el alumno), o lanza DictamenInvalido."""
    motivo = motivo.strip()
    if not motivo:
        raise DictamenInvalido({"motivo": ["Escribe el motivo para poder rechazar."]})
    if len(motivo) > MOTIVO_MAX:
        raise DictamenInvalido({"motivo": [f"El motivo no puede pasar de {MOTIVO_MAX} caracteres."]})

    with transaction.atomic():
        detalle, solicitud = _bloquear(detalle)
        detalle.solicitud = solicitud
        detalle.estado = Estado.RECHAZADA
        detalle.motivo_rechazo = motivo
        detalle.revisado_por = usuario
        detalle.fecha_resolucion = ahora or timezone.now()
        detalle.save(update_fields=["estado", "motivo_rechazo", "revisado_por", "fecha_resolucion"])
        notificar(solicitud.estudiante.usuario, f"{_nombre(detalle)} fue rechazada. Motivo: {motivo}")
    return detalle
