"""
Exportación a SADCE (F9): lotes de movimientos aprobados para que Control Escolar los pase a SADCE.

1. Generar: todos los movimientos aprobados del periodo que aún no están en un lote entran a uno
   nuevo (LOTE-2026A-001, 002…). Un movimiento solo entra a un lote.
2. Descargar: el archivo (Excel o CSV) se arma cada vez con los movimientos del lote; como ya no
   cambian, sale igual en cada descarga.
3. Marcar como cargado: Control Escolar confirma que pasó el lote a SADCE; sus movimientos quedan
   `cargada_sadce` y cada alumno recibe un aviso por folio.

SABE no se conecta con SADCE: el archivo lo sube Control Escolar a mano.
"""

import csv
import io
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date

from django.db import transaction
from django.db.models import Count, Max, Q, QuerySet
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter

from core.models import DetalleSolicitud, LoteExportacion, PeriodoEscolar, Solicitud, Usuario

from .avisos import aviso_cargada_sadce, plural, quitar_aviso_exportacion, registrar

Estado = DetalleSolicitud.Estado
Tipo = DetalleSolicitud.Tipo
Formato = LoteExportacion.Formato


class ExportacionInvalida(Exception):
    """No se puede generar o marcar el lote. `datos` es el cuerpo del 400, con el formato de DRF."""

    def __init__(self, datos: dict):
        super().__init__(datos)
        self.datos = datos


# ---------------------------------------------------------------------------
# Columnas del archivo (decisión D1): una fila por movimiento, un solo renglón de encabezados.
# ---------------------------------------------------------------------------

def _fecha_aprobacion(detalle: DetalleSolicitud) -> date | None:
    return timezone.localtime(detalle.fecha_resolucion).date() if detalle.fecha_resolucion else None


@dataclass(frozen=True)
class Columna:
    encabezado: str
    descripcion: str
    ejemplo: str
    valor: Callable[[DetalleSolicitud], str | date | None]
    ancho: int


COLUMNAS = [
    Columna("Ciclo", "Ciclo escolar del movimiento", "2026-A", lambda d: d.solicitud.periodo.ciclo, 9),
    Columna("Folio", "Folio SABE del trámite", "SABE-2026-014", lambda d: d.solicitud.folio_digital, 16),
    Columna("Matrícula", "Matrícula del alumno (texto, 9 dígitos)", "210089334",
            lambda d: d.solicitud.estudiante.matricula, 12),
    Columna("Nombre", "Nombre completo del alumno", "Carlos E. Pérez Villa",
            lambda d: d.solicitud.estudiante.usuario.get_full_name(), 30),
    Columna("Programa", "Licenciatura del alumno", "Economía",
            lambda d: d.solicitud.estudiante.programa.nombre, 14),
    Columna("Clave materia", "Clave de la unidad de aprendizaje", "EC601", lambda d: d.grupo.materia.clave, 14),
    Columna("Materia", "Nombre de la unidad de aprendizaje", "Macroeconomía III",
            lambda d: d.grupo.materia.nombre_materia, 34),
    Columna("Grupo", "Número de grupo", "01", lambda d: d.grupo.num_grupo, 8),
    Columna("Docente", "Docente del grupo", "Dr. Ricardo Morales", lambda d: d.grupo.docente.nombre, 28),
    Columna("Tipo", "ALTA o BAJA", "ALTA", lambda d: d.tipo_tramite, 7),
    Columna("Fecha de aprobación", "Día en que Control Escolar aprobó el movimiento", "12/02/2026",
            _fecha_aprobacion, 19),
]
FORMATO_FECHA = "%d/%m/%Y"
TIPOS_CONTENIDO = {
    Formato.XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    Formato.CSV: "text/csv; charset=utf-8",
}


def plantilla() -> list[dict]:
    """Las columnas del archivo, para la pestaña "Plantilla del Excel"."""
    return [{"encabezado": c.encabezado, "descripcion": c.descripcion, "ejemplo": c.ejemplo} for c in COLUMNAS]


# ---------------------------------------------------------------------------
# Consultas
# ---------------------------------------------------------------------------

def movimientos_completos(qs: QuerySet[DetalleSolicitud]) -> QuerySet[DetalleSolicitud]:
    """Con todo lo que piden el archivo y la tabla de pendientes, sin una consulta por fila."""
    return qs.select_related(
        "solicitud__periodo",
        "solicitud__estudiante__usuario",
        "solicitud__estudiante__programa",
        "grupo__materia",
        "grupo__docente",
    ).prefetch_related("grupo__horarios").order_by("solicitud__folio_digital", "id")


def pendientes(periodo: PeriodoEscolar) -> QuerySet[DetalleSolicitud]:
    """Movimientos aprobados del periodo que todavía no están en ningún lote."""
    return DetalleSolicitud.objects.filter(estado=Estado.APROBADA, lote=None, solicitud__periodo=periodo)


def lotes(periodo: PeriodoEscolar) -> QuerySet[LoteExportacion]:
    """Lotes del periodo, del más nuevo al más viejo, con los conteos que pide la pantalla."""
    return (
        LoteExportacion.objects.filter(periodo=periodo)
        .select_related("periodo", "usuario", "cargado_por")
        .annotate(
            alumnos=Count("movimientos__solicitud__estudiante", distinct=True),
            altas=Count("movimientos", filter=Q(movimientos__tipo_tramite=Tipo.ALTA)),
            bajas=Count("movimientos", filter=Q(movimientos__tipo_tramite=Tipo.BAJA)),
        )
        # Con GROUP BY, Django no aplica el `ordering` del modelo: va explícito.
        .order_by("-fecha", "-id")
    )


def con_programas(lista: list[LoteExportacion]) -> list[LoteExportacion]:
    """
    Pone en cada lote `programas`: los de sus alumnos, para "11 alumnos de Economía y Finanzas".
    Una sola consulta para toda la lista.
    """
    por_lote: dict[int, list[str]] = {lote.pk: [] for lote in lista}
    filas = (
        DetalleSolicitud.objects.filter(lote__in=lista)
        .values_list("lote_id", "solicitud__estudiante__programa__nombre")
        .order_by("lote_id", "solicitud__estudiante__programa__nombre")
        .distinct()
    )
    for lote_id, programa in filas:
        por_lote[lote_id].append(programa)
    for lote in lista:
        lote.programas = por_lote[lote.pk]
    return lista


def resumen(periodo: PeriodoEscolar) -> dict:
    """Las cuatro tarjetas de la pantalla y los contadores de las pestañas."""
    movimientos = DetalleSolicitud.objects.filter(
        solicitud__periodo=periodo, estado__in=[Estado.APROBADA, Estado.CARGADA_SADCE]
    ).aggregate(
        total=Count("id"),
        altas=Count("id", filter=Q(tipo_tramite=Tipo.ALTA)),
        bajas=Count("id", filter=Q(tipo_tramite=Tipo.BAJA)),
        cargados=Count("id", filter=Q(estado=Estado.CARGADA_SADCE)),
        pendientes=Count("id", filter=Q(estado=Estado.APROBADA, lote=None)),
        en_espera=Count("id", filter=Q(estado=Estado.APROBADA, lote__isnull=False)),
    )
    del_periodo = LoteExportacion.objects.filter(periodo=periodo)
    ultimo = del_periodo.select_related("periodo", "usuario").first()
    total = movimientos["total"]
    return {
        "dictaminados": total,
        "altas": movimientos["altas"],
        "bajas": movimientos["bajas"],
        "cargados": movimientos["cargados"],
        "porcentaje_cargado": round(movimientos["cargados"] * 100 / total) if total else 0,
        "lotes": del_periodo.count(),
        "lotes_en_espera": del_periodo.filter(fecha_carga=None).count(),
        "movimientos_en_espera": movimientos["en_espera"],
        "pendientes": movimientos["pendientes"],
        "ultima": (
            {
                "folio": ultimo.folio,
                "fecha": ultimo.fecha,
                "usuario": (ultimo.usuario.get_full_name() or ultimo.usuario.username) if ultimo.usuario else None,
            }
            if ultimo
            else None
        ),
    }


# ---------------------------------------------------------------------------
# Generar, descargar y marcar como cargado
# ---------------------------------------------------------------------------

def generar_lote(periodo: PeriodoEscolar, usuario: Usuario, formato: str, *, request=None) -> LoteExportacion:
    """Mete todos los movimientos pendientes del periodo en un lote nuevo, o lanza ExportacionInvalida."""
    if formato not in Formato.values:
        raise ExportacionInvalida({"formato": ["Elige Excel (xlsx) o CSV (csv)."]})
    with transaction.atomic():
        # Bloquear el periodo pone en fila a dos personas que generan a la vez: el consecutivo no se
        # repite y el segundo lote solo lleva lo que el primero no tomó.
        periodo = PeriodoEscolar.objects.select_for_update().get(pk=periodo.pk)
        ids = list(pendientes(periodo).select_for_update(of=("self",)).values_list("id", flat=True))
        if not ids:
            raise ExportacionInvalida({"detail": "No hay movimientos aprobados por exportar."})
        numero = (LoteExportacion.objects.filter(periodo=periodo).aggregate(n=Max("numero"))["n"] or 0) + 1
        lote = LoteExportacion.objects.create(
            periodo=periodo, numero=numero, usuario=usuario, formato=formato, total_registros=len(ids)
        )
        DetalleSolicitud.objects.filter(pk__in=ids, lote=None).update(lote=lote)
        registrar(
            usuario,
            "exportar_sadce",
            lote,
            descripcion=f"{lote.folio} {formato}",
            detalle=f"Generó el {'Excel' if formato == Formato.XLSX else 'CSV'} {lote.folio} con "
            f"{plural(len(ids), 'movimiento aprobado', 'movimientos aprobados')}.",
            request=request,
        )
        quitar_aviso_exportacion(periodo)
    return lote


def _celda(valor) -> str | date:
    return "" if valor is None else valor


def archivo(lote: LoteExportacion) -> tuple[bytes, str, str]:
    """El archivo del lote: (contenido, tipo de contenido, nombre)."""
    filas = [[c.valor(d) for c in COLUMNAS] for d in movimientos_completos(lote.movimientos.all())]
    nombre = f"{lote.folio}.{lote.formato}"
    if lote.formato == Formato.CSV:
        salida = io.StringIO()
        escritor = csv.writer(salida, lineterminator="\r\n")
        escritor.writerow([c.encabezado for c in COLUMNAS])
        for fila in filas:
            escritor.writerow(
                [v.strftime(FORMATO_FECHA) if isinstance(v, date) else _celda(v) for v in fila]
            )
        # Con BOM, Excel abre el CSV con acentos.
        return ("﻿" + salida.getvalue()).encode("utf-8"), TIPOS_CONTENIDO[Formato.CSV], nombre

    libro = Workbook()
    hoja = libro.active
    hoja.title = "SADCE"
    hoja.append([c.encabezado for c in COLUMNAS])
    for celda in hoja[1]:
        celda.font = Font(bold=True, color="FFFFFF")
        celda.fill = PatternFill("solid", fgColor="002147")
    for fila in filas:
        hoja.append([_celda(v) for v in fila])
    for i, columna in enumerate(COLUMNAS, start=1):
        letra = get_column_letter(i)
        hoja.column_dimensions[letra].width = columna.ancho
        for (celda,) in hoja.iter_rows(min_row=2, min_col=i, max_col=i):
            if isinstance(celda.value, date):
                celda.number_format = "DD/MM/YYYY"
            else:
                # Texto siempre: la matrícula y el grupo conservan sus ceros a la izquierda.
                celda.number_format = "@"
    hoja.freeze_panes = "A2"
    salida = io.BytesIO()
    libro.save(salida)
    return salida.getvalue(), TIPOS_CONTENIDO[Formato.XLSX], nombre


def marcar_cargado(lote: LoteExportacion, usuario: Usuario, *, request=None) -> LoteExportacion:
    """Pasa los movimientos del lote a `cargada_sadce` y avisa a cada alumno por folio."""
    with transaction.atomic():
        lote = LoteExportacion.objects.select_for_update().select_related("periodo").get(pk=lote.pk)
        if lote.cargado:
            raise ExportacionInvalida({"detail": "Este lote ya está marcado como cargado en SADCE."})
        lote.movimientos.filter(estado=Estado.APROBADA).update(estado=Estado.CARGADA_SADCE)
        lote.cargado_por = usuario
        lote.fecha_carga = timezone.now()
        lote.save(update_fields=["cargado_por", "fecha_carga"])
        folios = (
            Solicitud.objects.filter(detalles__lote=lote)
            .select_related("estudiante__usuario")
            .order_by("folio_digital")
            .distinct()
        )
        for solicitud in folios:
            aviso_cargada_sadce(solicitud, solicitud.estudiante.usuario)
        registrar(
            usuario,
            "marcar_cargado",
            lote,
            detalle=f"Marcó el lote {lote.folio} como cargado en SADCE.",
            request=request,
        )
    return lote
