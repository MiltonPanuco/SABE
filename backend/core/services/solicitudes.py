"""
Creación y cancelación de folios (F5). Toda regla del envío vive aquí; la vista solo traduce errores.
"""

from datetime import datetime

from django.db import IntegrityError, transaction
from django.utils import timezone

from core.models import DetalleSolicitud, Estudiante, PeriodoEscolar, Solicitud

from .avisos import aviso_cancelacion, aviso_folio_enviado, conteo_folio, plural, registrar
from .validacion import Movimiento, ResultadoMovimiento, validar_movimientos

JUSTIFICACION_MAX = 500
JUSTIFICACION_MIN_EXTEMPORANEA = 100
INTENTOS_FOLIO = 5


class SolicitudInvalida(Exception):
    """El folio no se puede crear o cancelar. `datos` es el cuerpo del 400, con el formato de DRF."""

    def __init__(self, datos: dict, resultados: list[ResultadoMovimiento] | None = None):
        super().__init__(datos)
        self.datos = datos
        self.resultados = resultados


def siguiente_folio(anio: int) -> str:
    """SABE-2026-### consecutivo por año, a partir del último folio creado ese año."""
    prefijo = f"SABE-{anio}-"
    ultimo = (
        Solicitud.objects.filter(folio_digital__startswith=prefijo)
        .order_by("-id")
        .values_list("folio_digital", flat=True)
        .first()
    )
    numero = int(ultimo.removeprefix(prefijo)) + 1 if ultimo else 1
    return f"{prefijo}{numero:03d}"


def _revisar_justificacion(justificacion: str, extemporanea: bool) -> list[str]:
    if len(justificacion) > JUSTIFICACION_MAX:
        return [f"La justificación no puede pasar de {JUSTIFICACION_MAX} caracteres."]
    if extemporanea and len(justificacion) < JUSTIFICACION_MIN_EXTEMPORANEA:
        return [
            f"Una solicitud extemporánea requiere al menos {JUSTIFICACION_MIN_EXTEMPORANEA} caracteres "
            "de justificación."
        ]
    if not justificacion:
        return ["Debes ingresar una justificación académica antes de enviar."]
    return []


def crear_solicitud(
    estudiante: Estudiante,
    periodo: PeriodoEscolar,
    movimientos: list[Movimiento],
    justificacion: str,
    *,
    ahora: datetime | None = None,
    request=None,
) -> Solicitud:
    """
    Crea el folio con sus movimientos pendientes, o lanza SolicitudInvalida.

    Antes de la convocatoria no se puede enviar; después de su cierre el folio queda extemporáneo.
    Los movimientos se validan con F4 (choques, cupo, misma materia, pendientes de otros folios).
    """
    ahora = ahora or timezone.now()
    if ahora < periodo.convocatoria_inicio:
        raise SolicitudInvalida({"detail": "La convocatoria aún no abre."})
    extemporanea = ahora > periodo.convocatoria_fin

    justificacion = justificacion.strip()
    if errores := _revisar_justificacion(justificacion, extemporanea):
        raise SolicitudInvalida({"justificacion": errores})

    with transaction.atomic():
        # Un doble clic o dos pestañas del mismo alumno no crean dos folios con lo mismo.
        Estudiante.objects.select_for_update().get(pk=estudiante.pk)

        resultados = validar_movimientos(estudiante, periodo, movimientos)
        if not all(r.valido for r in resultados):
            raise SolicitudInvalida({"detail": "Hay movimientos que no se pueden solicitar."}, resultados)

        anio = timezone.localtime(ahora).year
        for intento in range(INTENTOS_FOLIO):
            try:
                # Dos alumnos al mismo tiempo pueden calcular el mismo número: el índice único
                # lo rechaza y se intenta con el siguiente.
                with transaction.atomic():
                    solicitud = Solicitud.objects.create(
                        folio_digital=siguiente_folio(anio),
                        estudiante=estudiante,
                        periodo=periodo,
                        justificacion=justificacion,
                        extemporanea=extemporanea,
                    )
                break
            except IntegrityError:
                if intento == INTENTOS_FOLIO - 1:
                    raise

        detalles = DetalleSolicitud.objects.bulk_create(
            DetalleSolicitud(solicitud=solicitud, grupo=m.grupo, tipo_tramite=m.tipo) for m in movimientos
        )
        aviso_folio_enviado(solicitud)
        registrar(
            estudiante.usuario,
            "enviar_folio",
            solicitud,
            detalle=f"Envió el folio {solicitud.folio_digital} con {conteo_folio(detalles)}.",
            request=request,
        )
    return solicitud


def cancelar_solicitud(solicitud: Solicitud, *, request=None) -> int:
    """Cancela los movimientos pendientes del folio y avisa a control escolar. Devuelve cuántos canceló."""
    with transaction.atomic():
        pendientes = list(
            solicitud.detalles.select_for_update(of=("self",))
            .filter(estado=DetalleSolicitud.Estado.PENDIENTE)
            .select_related("grupo__materia")
            .order_by("id")
        )
        if not pendientes:
            raise SolicitudInvalida({"detail": "Este folio ya no tiene movimientos pendientes."})
        DetalleSolicitud.objects.filter(pk__in=[d.pk for d in pendientes]).update(
            estado=DetalleSolicitud.Estado.CANCELADA
        )
        aviso_cancelacion(solicitud, pendientes)
        registrar(
            solicitud.estudiante.usuario,
            "cancelar_folio",
            solicitud,
            detalle=f"Canceló el folio {solicitud.folio_digital}: "
            f"{plural(len(pendientes), 'movimiento pendiente cancelado', 'movimientos pendientes cancelados')}.",
            request=request,
        )
    return len(pendientes)
