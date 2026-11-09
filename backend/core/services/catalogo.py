"""Consultas del catálogo: grupos con su cupo calculado en la base, sin una consulta por fila."""

from django.db.models import Count, F, Q, QuerySet

from core.models import CargaAcademica, Grupo, PeriodoEscolar


def periodo_activo() -> PeriodoEscolar | None:
    return PeriodoEscolar.objects.filter(activo=True).first()


def con_cupo(grupos: QuerySet[Grupo]) -> QuerySet[Grupo]:
    """
    Agrega lo que necesita el serializer de grupos: materia, docente, horarios y `cupo_libre`.

    Se llama `cupo_libre` y no `cupo_disponible` porque el modelo ya tiene una propiedad
    con ese nombre y una anotación no puede pisarla.
    """
    return (
        grupos.select_related("materia", "docente")
        .prefetch_related("horarios")
        .annotate(
            inscritos_n=Count("cargas", filter=Q(cargas__estado=CargaAcademica.Estado.INSCRITO)),
            cupo_libre=F("cupo_maximo") - F("inscritos_n"),
        )
    )


def grupos_catalogo(
    periodo: PeriodoEscolar,
    *,
    q: str = "",
    materia: str = "",
    turno: str = "",
    programa: str = "",
) -> QuerySet[Grupo]:
    """Oferta visible del periodo, con los filtros opcionales del catálogo."""
    grupos = Grupo.objects.filter(periodo=periodo, visible=True)
    if q:
        grupos = grupos.filter(
            Q(materia__nombre_materia__icontains=q)
            | Q(materia__clave__icontains=q)
            | Q(docente__nombre__icontains=q)
        )
    if materia:
        grupos = grupos.filter(materia__clave__iexact=materia)
    if turno:
        grupos = grupos.filter(turno=turno)
    if programa:
        grupos = grupos.filter(materia__programa__nombre__iexact=programa)
    return con_cupo(grupos).order_by("materia__clave", "num_grupo")
