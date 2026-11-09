"""
Detección de choques de horario.

La "ocupación" del alumno son los grupos que ocupan su horario: la carga inscrita, menos las bajas
que pide, más las altas pendientes de otros folios. Las reglas del folio están en `validacion.py`.
"""

from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import time
from enum import StrEnum

from core.models import CargaAcademica, DetalleSolicitud, Estudiante, Grupo, PeriodoEscolar, Solicitud


class Origen(StrEnum):
    """Por qué un grupo ocupa el horario del alumno."""

    INSCRITA = "inscrita"  # carga inscrita
    CARRITO = "carrito"  # otra alta de la misma lista o folio
    EN_TRAMITE = "en_tramite"  # alta pendiente de otro folio


@dataclass
class Choque:
    """El grupo `grupo_id` choca con `choca_con` en `dias`, de hora_inicio a hora_fin (horario de `choca_con`)."""

    grupo_id: int
    choca_con: Grupo
    hora_inicio: time
    hora_fin: time
    dias: list[int] = field(default_factory=list)
    origen: Origen = Origen.INSCRITA


@dataclass(frozen=True)
class Ocupado:
    grupo: Grupo
    origen: Origen


def grupos_inscritos(estudiante: Estudiante, periodo: PeriodoEscolar) -> list[Grupo]:
    """Grupos que el alumno tiene inscritos en el periodo, con sus horarios ya cargados."""
    cargas = (
        CargaAcademica.objects.filter(
            estudiante=estudiante,
            estado=CargaAcademica.Estado.INSCRITO,
            grupo__periodo=periodo,
        )
        .select_related("grupo__materia")
        .prefetch_related("grupo__horarios")
    )
    return [carga.grupo for carga in cargas]


def movimientos_pendientes(
    estudiante: Estudiante, periodo: PeriodoEscolar, *, excluir_solicitud: Solicitud | None = None
) -> list[DetalleSolicitud]:
    """Movimientos pendientes del alumno en el periodo, con grupo, materia y horarios cargados."""
    pendientes = DetalleSolicitud.objects.filter(
        solicitud__estudiante=estudiante,
        solicitud__periodo=periodo,
        estado=DetalleSolicitud.Estado.PENDIENTE,
    )
    if excluir_solicitud is not None:
        pendientes = pendientes.exclude(solicitud=excluir_solicitud)
    return list(pendientes.select_related("grupo__materia").prefetch_related("grupo__horarios"))


def ocupacion(
    estudiante: Estudiante,
    periodo: PeriodoEscolar,
    *,
    bajas: Iterable[Grupo] = (),
    contar_pendientes: bool = True,
    excluir_solicitud: Solicitud | None = None,
    inscritos: list[Grupo] | None = None,
) -> list[Ocupado]:
    """
    Grupos que ocupan el horario del alumno si se aplicaran `bajas`.

    Con `contar_pendientes`, los movimientos pendientes de otros folios también cuentan: sus altas
    ocupan horario y sus bajas lo liberan. Al aprobar (F6) solo cuenta la carga inscrita.
    `inscritos` evita repetir la consulta si quien llama ya la tiene.
    """
    libres = {grupo.pk for grupo in bajas}
    altas_pendientes: list[Grupo] = []
    if contar_pendientes:
        for detalle in movimientos_pendientes(estudiante, periodo, excluir_solicitud=excluir_solicitud):
            if detalle.tipo_tramite == DetalleSolicitud.Tipo.BAJA:
                libres.add(detalle.grupo_id)
            else:
                altas_pendientes.append(detalle.grupo)

    if inscritos is None:
        inscritos = grupos_inscritos(estudiante, periodo)
    ocupados = [Ocupado(g, Origen.INSCRITA) for g in inscritos if g.pk not in libres]
    ocupados += [Ocupado(g, Origen.EN_TRAMITE) for g in altas_pendientes]
    return ocupados


def choques_entre(grupo: Grupo, otros: Iterable[Grupo]) -> list[Choque]:
    """
    Choques de `grupo` contra cada uno de `otros`. Usa los horarios ya cargados
    (prefetch), así que no hace consultas. Un grupo no choca consigo mismo.
    """
    encontrados: dict[tuple[int, time, time], Choque] = {}
    for otro in otros:
        if otro.pk == grupo.pk:
            continue
        for propio in grupo.horarios.all():
            for ajeno in otro.horarios.all():
                if not propio.traslapa_con(ajeno):
                    continue
                clave = (otro.pk, ajeno.hora_inicio, ajeno.hora_fin)
                choque = encontrados.setdefault(
                    clave, Choque(grupo.pk, otro, ajeno.hora_inicio, ajeno.hora_fin)
                )
                if ajeno.dia_semana not in choque.dias:
                    choque.dias.append(ajeno.dia_semana)
    for choque in encontrados.values():
        choque.dias.sort()
    return list(encontrados.values())


def choques_contra(grupo: Grupo, ocupados: Iterable[Ocupado]) -> list[Choque]:
    """Choques de `grupo` contra lo que ocupa el horario, cada uno con su origen."""
    choques = []
    for ocupado in ocupados:
        for choque in choques_entre(grupo, [ocupado.grupo]):
            choque.origen = ocupado.origen
            choques.append(choque)
    return choques


def choques_con_carga(
    estudiante: Estudiante, periodo: PeriodoEscolar, grupos: Iterable[Grupo]
) -> dict[int, list[Choque]]:
    """Para cada grupo, sus choques con la ocupación del alumno (lista vacía si no choca)."""
    ocupados = ocupacion(estudiante, periodo)
    return {grupo.pk: choques_contra(grupo, ocupados) for grupo in grupos}
