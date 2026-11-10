"""
Bandeja de control escolar (F6): folios del periodo con filtros y los indicadores de la pantalla.

El estado de la bandeja sale de contar los movimientos de cada folio en la base, para filtrar
sin traer todos los folios a Python.
"""

from enum import StrEnum

from django.db.models import Count, Q, QuerySet

from core.models import DetalleSolicitud, PeriodoEscolar, Solicitud

E = DetalleSolicitud.Estado


class EstadoBandeja(StrEnum):
    PENDIENTE = "pendiente"  # nada dictaminado todavía
    PARCIAL = "parcial"  # algo dictaminado y algo pendiente
    DICTAMINADA = "dictaminada"  # sin pendientes y al menos uno aprobado
    RECHAZADA = "rechazada"  # sin pendientes, ninguno aprobado y al menos uno rechazado
    CANCELADA = "cancelada"  # todo cancelado por el alumno


def estado_bandeja(estados: list[str]) -> EstadoBandeja:
    """Estado de un folio en la bandeja a partir de los estados de sus movimientos (ya cargados)."""
    pendientes = sum(e == E.PENDIENTE for e in estados)
    decididos = sum(e in (E.APROBADA, E.CARGADA_SADCE, E.RECHAZADA) for e in estados)
    if pendientes:
        return EstadoBandeja.PARCIAL if decididos else EstadoBandeja.PENDIENTE
    if any(e in (E.APROBADA, E.CARGADA_SADCE) for e in estados):
        return EstadoBandeja.DICTAMINADA
    if E.RECHAZADA in estados:
        return EstadoBandeja.RECHAZADA
    return EstadoBandeja.CANCELADA


def _con_conteos(folios: QuerySet[Solicitud]) -> QuerySet[Solicitud]:
    return folios.annotate(
        n_pendientes=Count("detalles", filter=Q(detalles__estado=E.PENDIENTE)),
        n_aprobados=Count("detalles", filter=Q(detalles__estado__in=[E.APROBADA, E.CARGADA_SADCE])),
        n_rechazados=Count("detalles", filter=Q(detalles__estado=E.RECHAZADA)),
        n_vivos=Count("detalles", filter=~Q(detalles__estado=E.CANCELADA)),
    )


# Condición de cada estado sobre los conteos de _con_conteos.
FILTROS = {
    EstadoBandeja.PENDIENTE: Q(n_pendientes__gt=0, n_aprobados=0, n_rechazados=0),
    EstadoBandeja.PARCIAL: Q(n_pendientes__gt=0) & (Q(n_aprobados__gt=0) | Q(n_rechazados__gt=0)),
    EstadoBandeja.DICTAMINADA: Q(n_pendientes=0, n_aprobados__gt=0),
    EstadoBandeja.RECHAZADA: Q(n_pendientes=0, n_aprobados=0, n_rechazados__gt=0),
    EstadoBandeja.CANCELADA: Q(n_vivos=0),
}


def folios_bandeja(
    folios: QuerySet[Solicitud],
    periodo: PeriodoEscolar,
    *,
    estado: str = "",
    extemporanea: bool | None = None,
    q: str = "",
) -> QuerySet[Solicitud]:
    """
    Folios del periodo con los filtros de la bandeja. Sin `estado` se dejan fuera los que el alumno
    canceló por completo (no hay nada que dictaminar); se ven con `estado=cancelada`.
    """
    folios = _con_conteos(folios.filter(periodo=periodo))
    folios = folios.filter(FILTROS[EstadoBandeja(estado)] if estado else Q(n_vivos__gt=0))
    if extemporanea is not None:
        folios = folios.filter(extemporanea=extemporanea)
    if q:
        folios = folios.filter(
            Q(folio_digital__icontains=q)
            | Q(estudiante__matricula__icontains=q)
            | Q(estudiante__usuario__first_name__icontains=q)
            | Q(estudiante__usuario__last_name__icontains=q)
        )
    return folios


def resumen_bandeja(periodo: PeriodoEscolar) -> dict[str, int]:
    """Los 4 indicadores de la bandeja, sobre los folios del periodo que no se cancelaron por completo."""
    folios = _con_conteos(Solicitud.objects.filter(periodo=periodo)).filter(n_vivos__gt=0)
    movimientos = DetalleSolicitud.objects.filter(solicitud__periodo=periodo)
    return {
        "folios_pendientes": folios.filter(n_pendientes__gt=0).count(),
        "movimientos_aprobados": movimientos.filter(estado__in=[E.APROBADA, E.CARGADA_SADCE]).count(),
        "movimientos_rechazados": movimientos.filter(estado=E.RECHAZADA).count(),
        "extemporaneos": folios.filter(extemporanea=True).count(),
    }
