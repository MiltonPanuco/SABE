"""
Periodos escolares y su convocatoria (F7).

Solo hay un periodo activo (la base lo garantiza). Para cambiarlo, el periodo activo no debe tener
movimientos pendientes: la bandeja de control escolar solo muestra el periodo activo y esos folios
quedarían fuera de vista.
"""

from datetime import datetime
from enum import StrEnum

from django.db import transaction
from django.db.models import Count, Q, QuerySet
from django.utils import timezone

from core.models import Bitacora, DetalleSolicitud, PeriodoEscolar, Usuario

from .avisos import registrar

CAMPOS = ["ciclo", "fecha_inicio", "fecha_fin", "convocatoria_inicio", "convocatoria_fin"]


class EstadoConvocatoria(StrEnum):
    PROGRAMADA = "programada"
    ABIERTA = "abierta"
    CERRADA = "cerrada"


class PeriodoInvalido(Exception):
    """El cambio no se puede hacer. `datos` es el cuerpo del 400, con el formato de DRF."""

    def __init__(self, datos: dict):
        super().__init__(datos)
        self.datos = datos


def estado_convocatoria(periodo: PeriodoEscolar, ahora: datetime | None = None) -> EstadoConvocatoria:
    ahora = ahora or timezone.now()
    if ahora < periodo.convocatoria_inicio:
        return EstadoConvocatoria.PROGRAMADA
    if ahora <= periodo.convocatoria_fin:
        return EstadoConvocatoria.ABIERTA
    return EstadoConvocatoria.CERRADA


def periodos_listado() -> QuerySet[PeriodoEscolar]:
    """Todos los periodos, el activo primero y luego del más reciente al más antiguo."""
    return PeriodoEscolar.objects.annotate(
        movimientos_pendientes=Count(
            "solicitudes__detalles", filter=Q(solicitudes__detalles__estado=DetalleSolicitud.Estado.PENDIENTE)
        )
    ).order_by("-activo", "-fecha_inicio", "-id")


def ultimo_cambio_de_periodo() -> Bitacora | None:
    """Último cambio registrado sobre un periodo (pie de la pantalla de periodos)."""
    return (
        Bitacora.objects.filter(entidad__startswith="PeriodoEscolar #")
        .select_related("usuario")
        .order_by("-fecha", "-id")
        .first()
    )


def activar_periodo(periodo: PeriodoEscolar, usuario: Usuario | None, *, request=None) -> PeriodoEscolar:
    """
    Deja `periodo` como el único activo. Falla si el periodo activo actual tiene movimientos pendientes.
    Activar el periodo que ya está activo no cambia nada.
    """
    with transaction.atomic():
        # Se bloquean todos los periodos (son pocos) para que dos activaciones no se crucen.
        periodos = {p.pk: p for p in PeriodoEscolar.objects.select_for_update().order_by("pk")}
        periodo = periodos[periodo.pk]
        if periodo.activo:
            return periodo
        actual = next((p for p in periodos.values() if p.activo), None)
        if actual is not None:
            pendientes = DetalleSolicitud.objects.filter(
                solicitud__periodo=actual, estado=DetalleSolicitud.Estado.PENDIENTE
            ).count()
            if pendientes:
                que = "el movimiento pendiente" if pendientes == 1 else f"los {pendientes} movimientos pendientes"
                raise PeriodoInvalido(
                    {"detail": f"Dictamina {que} de {actual.ciclo} antes de activar otro periodo."}
                )
            # Primero se apaga el actual: la base no permite dos activos ni por un instante.
            actual.activo = False
            actual.save(update_fields=["activo"])
        periodo.activo = True
        periodo.save(update_fields=["activo"])
        registrar(usuario, "activar_periodo", periodo, request=request)
    return periodo


def guardar_periodo(
    datos: dict,
    usuario: Usuario | None,
    *,
    periodo: PeriodoEscolar | None = None,
    activar: bool = False,
    request=None,
) -> PeriodoEscolar:
    """Crea o edita un periodo (los datos ya vienen validados) y, si se pide, lo activa."""
    with transaction.atomic():
        nuevo = periodo is None
        if nuevo:
            periodo = PeriodoEscolar.objects.create(**{c: datos[c] for c in CAMPOS}, activo=False)
        else:
            cambios = [c for c in CAMPOS if c in datos]
            for campo in cambios:
                setattr(periodo, campo, datos[campo])
            if cambios:
                periodo.save(update_fields=cambios)
        registrar(usuario, "crear_periodo" if nuevo else "editar_periodo", periodo, request=request)
        if activar:
            periodo = activar_periodo(periodo, usuario, request=request)
    return periodo
