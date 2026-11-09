"""
Detección de choques de horario.

F3 compara cada grupo del catálogo contra la carga inscrita del alumno.
F4 agrega aquí las reglas del folio (bajas del mismo folio, choques entre altas).
"""

from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import time

from core.models import CargaAcademica, Estudiante, Grupo, PeriodoEscolar


@dataclass
class Choque:
    """El grupo `grupo_id` choca con `choca_con` en `dias`, de hora_inicio a hora_fin (horario de `choca_con`)."""

    grupo_id: int
    choca_con: Grupo
    hora_inicio: time
    hora_fin: time
    dias: list[int] = field(default_factory=list)


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


def choques_con_carga(
    estudiante: Estudiante, periodo: PeriodoEscolar, grupos: Iterable[Grupo]
) -> dict[int, list[Choque]]:
    """Para cada grupo, sus choques con la carga inscrita del alumno (lista vacía si no choca)."""
    inscritos = grupos_inscritos(estudiante, periodo)
    return {grupo.pk: choques_entre(grupo, inscritos) for grupo in grupos}
