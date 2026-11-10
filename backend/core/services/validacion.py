"""
Validación de una lista de movimientos (el carrito o un folio): choques y errores por movimiento.

La usan el catálogo, POST /api/solicitudes/validar/, la creación del folio (F5) y el dictamen (F6).
F5 agrega aquí sus reglas (movimiento pendiente en otro folio, convocatoria, ...).
"""

from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass, field
from enum import StrEnum

from core.models import DetalleSolicitud, Estudiante, Grupo, PeriodoEscolar, Solicitud

from .choques import Choque, Ocupado, Origen, choques_contra, grupos_inscritos, movimientos_pendientes, ocupacion

Tipo = DetalleSolicitud.Tipo


class Codigo(StrEnum):
    REPETIDO = "repetido"
    YA_INSCRITO = "ya_inscrito"
    NO_DISPONIBLE = "no_disponible"
    SIN_CUPO = "sin_cupo"
    MISMA_MATERIA = "misma_materia"
    NO_INSCRITO = "no_inscrito"
    EN_OTRO_FOLIO = "en_otro_folio"


@dataclass
class ErrorMovimiento:
    codigo: Codigo
    detalle: str


@dataclass
class Movimiento:
    grupo: Grupo
    tipo: str  # DetalleSolicitud.Tipo


@dataclass
class ResultadoMovimiento:
    grupo: Grupo
    tipo: str
    choques: list[Choque] = field(default_factory=list)
    errores: list[ErrorMovimiento] = field(default_factory=list)

    @property
    def valido(self) -> bool:
        return not self.choques and not self.errores


@dataclass
class Contexto:
    """Todo lo que hace falta para revisar altas del alumno, cargado una sola vez."""

    periodo: PeriodoEscolar
    inscritos: set[int]  # grupos inscritos de verdad, antes de aplicar bajas
    ocupados: list[Ocupado]  # inscritos menos bajas, más altas pendientes de otros folios
    altas: list[Grupo]  # altas de la lista (el carrito o el folio)
    # Movimiento pendiente de otro folio por grupo (vacío si no se cuentan los pendientes).
    pendientes: dict[int, DetalleSolicitud] = field(default_factory=dict)

    @classmethod
    def para(
        cls,
        estudiante: Estudiante,
        periodo: PeriodoEscolar,
        *,
        altas: Iterable[Grupo] = (),
        bajas: Iterable[Grupo] = (),
        contar_pendientes: bool = True,
        excluir_solicitud: Solicitud | None = None,
    ) -> "Contexto":
        inscritos = grupos_inscritos(estudiante, periodo)
        pendientes = (
            movimientos_pendientes(estudiante, periodo, excluir_solicitud=excluir_solicitud)
            if contar_pendientes
            else []
        )
        ocupados = ocupacion(
            estudiante,
            periodo,
            bajas=bajas,
            contar_pendientes=contar_pendientes,
            inscritos=inscritos,
            pendientes=pendientes,
        )
        return cls(
            periodo,
            {g.pk for g in inscritos},
            ocupados,
            list(altas),
            {detalle.grupo_id: detalle for detalle in pendientes},
        )


def _cupo_libre(grupo: Grupo) -> int:
    # `cupo_libre` viene de catalogo.con_cupo; sin él se cuenta con una consulta.
    libre = getattr(grupo, "cupo_libre", None)
    return grupo.cupo_disponible if libre is None else libre


def _misma_materia(grupo: Grupo, contexto: Contexto) -> ErrorMovimiento | None:
    """Otro grupo de la misma materia que el alumno ya cursa, ya pidió o trae en la lista."""
    nombre = grupo.materia.nombre_materia
    for ocupado in contexto.ocupados:
        otro = ocupado.grupo
        if otro.pk == grupo.pk or otro.materia_id != grupo.materia_id:
            continue
        if ocupado.origen == Origen.INSCRITA:
            detalle = f"Ya cursas {nombre} en el grupo {otro.num_grupo}. Agrega su baja para cambiar de grupo."
        else:
            detalle = f"Ya pediste {nombre} en el grupo {otro.num_grupo} (en trámite)."
        return ErrorMovimiento(Codigo.MISMA_MATERIA, detalle)
    for otro in contexto.altas:
        if otro.pk != grupo.pk and otro.materia_id == grupo.materia_id:
            return ErrorMovimiento(
                Codigo.MISMA_MATERIA, f"{nombre} ya está en tu carrito en el grupo {otro.num_grupo}."
            )
    return None


def _en_otro_folio(grupo: Grupo, contexto: Contexto) -> ErrorMovimiento | None:
    detalle = contexto.pendientes.get(grupo.pk)
    if detalle is None:
        return None
    return ErrorMovimiento(
        Codigo.EN_OTRO_FOLIO,
        f"Ya pediste {grupo.materia.nombre_materia} grupo {grupo.num_grupo} "
        f"en el folio {detalle.solicitud.folio_digital}.",
    )


def revisar_alta(grupo: Grupo, contexto: Contexto) -> tuple[list[Choque], list[ErrorMovimiento]]:
    """Choques y errores de pedir el alta de `grupo`. No hace consultas si el grupo viene de `con_cupo`."""
    errores = []
    if error := _en_otro_folio(grupo, contexto):
        errores.append(error)
    if grupo.pk in contexto.inscritos:
        errores.append(ErrorMovimiento(Codigo.YA_INSCRITO, "Ya estás inscrito en este grupo."))
    if grupo.periodo_id != contexto.periodo.pk or not grupo.visible:
        errores.append(
            ErrorMovimiento(Codigo.NO_DISPONIBLE, "El grupo no está en la oferta del periodo activo.")
        )
    if _cupo_libre(grupo) <= 0:
        errores.append(ErrorMovimiento(Codigo.SIN_CUPO, "Sin cupo disponible."))
    if error := _misma_materia(grupo, contexto):
        errores.append(error)

    otras_altas = [Ocupado(g, Origen.CARRITO) for g in contexto.altas]
    choques = choques_contra(grupo, [*contexto.ocupados, *otras_altas])
    return choques, errores


def validar_movimientos(
    estudiante: Estudiante,
    periodo: PeriodoEscolar,
    movimientos: list[Movimiento],
    *,
    contar_pendientes: bool = True,
    excluir_solicitud: Solicitud | None = None,
) -> list[ResultadoMovimiento]:
    """
    Revisa cada movimiento contra la ocupación del alumno y contra los demás de la lista.

    Las bajas de la lista liberan su horario (D2). Dos altas que chocan entre sí quedan marcadas
    las dos. Los grupos deben traer materia y horarios cargados (`catalogo.con_cupo`).
    """
    altas = [m.grupo for m in movimientos if m.tipo == Tipo.ALTA]
    bajas = [m.grupo for m in movimientos if m.tipo == Tipo.BAJA]
    contexto = Contexto.para(
        estudiante,
        periodo,
        altas=altas,
        bajas=bajas,
        contar_pendientes=contar_pendientes,
        excluir_solicitud=excluir_solicitud,
    )
    veces = Counter(m.grupo.pk for m in movimientos)

    resultados = []
    for movimiento in movimientos:
        resultado = ResultadoMovimiento(movimiento.grupo, movimiento.tipo)
        if veces[movimiento.grupo.pk] > 1:
            resultado.errores.append(
                ErrorMovimiento(Codigo.REPETIDO, "El grupo aparece más de una vez en la solicitud.")
            )
        if movimiento.tipo == Tipo.ALTA:
            choques, errores = revisar_alta(movimiento.grupo, contexto)
            resultado.choques += choques
            resultado.errores += errores
        else:
            if error := _en_otro_folio(movimiento.grupo, contexto):
                resultado.errores.append(error)
            if movimiento.grupo.pk not in contexto.inscritos:
                resultado.errores.append(ErrorMovimiento(Codigo.NO_INSCRITO, "No estás inscrito en este grupo."))
        resultados.append(resultado)
    return resultados
