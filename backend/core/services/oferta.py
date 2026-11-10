"""
Oferta académica del periodo activo (F7): control escolar publica, edita, oculta y vuelve a mostrar grupos.

Un grupo nunca se borra; se oculta (`visible=False`) y deja de aparecer en el catálogo del alumno.
La materia se identifica por su clave: si ya existe se reutiliza y se actualizan su nombre y programa.
"""

from datetime import time

from django.db import transaction
from django.db.models import Q, QuerySet

from core.models import CargaAcademica, Grupo, HorarioGrupo, PeriodoEscolar, Turno, UnidadAprendizaje, Usuario

from .avisos import registrar
from .catalogo import con_cupo

CREDITOS_POR_DEFECTO = 8  # el formulario de stitch no pide créditos
INICIO_VESPERTINO = time(13)


class OfertaInvalida(Exception):
    """El grupo no se puede guardar. `datos` es el cuerpo del 400, con el formato de DRF."""

    def __init__(self, datos: dict):
        super().__init__(datos)
        self.datos = datos


def grupos_oferta(periodo: PeriodoEscolar, *, q: str = "", programa: str = "", cupo: str = "") -> QuerySet[Grupo]:
    """Todos los grupos del periodo, también los ocultos, con los filtros de la pantalla de oferta."""
    grupos = Grupo.objects.filter(periodo=periodo)
    if q:
        grupos = grupos.filter(
            Q(materia__nombre_materia__icontains=q) | Q(materia__clave__icontains=q) | Q(docente__nombre__icontains=q)
        )
    if programa:
        grupos = grupos.filter(materia__programa__nombre__iexact=programa)
    grupos = con_cupo(grupos)
    if cupo == "con":
        grupos = grupos.filter(cupo_libre__gt=0)
    elif cupo == "sin":
        grupos = grupos.filter(cupo_libre__lte=0)
    return grupos.order_by("materia__clave", "num_grupo")


def turno_de(horarios: list[dict]) -> str:
    """Vespertino si la clase que empieza más temprano empieza a las 13:00 o después."""
    inicio = min(h["hora_inicio"] for h in horarios)
    return Turno.VESPERTINO if inicio >= INICIO_VESPERTINO else Turno.MATUTINO


def _materia(datos: dict) -> UnidadAprendizaje:
    materia = UnidadAprendizaje.objects.filter(clave__iexact=datos["clave"]).first()
    if materia is None:
        return UnidadAprendizaje.objects.create(
            clave=datos["clave"],
            nombre_materia=datos["nombre_materia"],
            programa=datos["programa"],
            creditos=CREDITOS_POR_DEFECTO,
        )
    if (materia.nombre_materia, materia.programa_id) != (datos["nombre_materia"], datos["programa"].pk):
        materia.nombre_materia = datos["nombre_materia"]
        materia.programa = datos["programa"]
        materia.save(update_fields=["nombre_materia", "programa"])
    return materia


def guardar_grupo(
    datos: dict, usuario: Usuario | None, periodo: PeriodoEscolar, *, grupo: Grupo | None = None, request=None
) -> Grupo:
    """
    Publica (sin `grupo`) o edita un grupo del periodo con su horario completo.
    `datos` ya viene validado por `GrupoEscrituraSerializer` (horas en orden y sin traslapes).
    """
    with transaction.atomic():
        if grupo is not None:
            grupo = Grupo.objects.select_for_update().get(pk=grupo.pk)

        repetido = Grupo.objects.filter(
            periodo=periodo, materia__clave__iexact=datos["clave"], num_grupo=datos["num_grupo"]
        )
        if grupo is not None:
            repetido = repetido.exclude(pk=grupo.pk)
        if repetido.exists():
            raise OfertaInvalida({"num_grupo": ["Ya existe ese grupo para esa clave."]})

        if grupo is not None:
            if grupo.materia.clave.lower() != datos["clave"].lower() and (
                grupo.cargas.exists() or grupo.detalles.exists()
            ):
                raise OfertaInvalida(
                    {"clave": ["No se puede cambiar la clave de un grupo con alumnos o trámites. Publica un grupo nuevo."]}
                )
            inscritos = grupo.cargas.filter(estado=CargaAcademica.Estado.INSCRITO).count()
            if datos["cupo_maximo"] < inscritos:
                raise OfertaInvalida(
                    {"cupo_maximo": [f"El cupo máximo no puede ser menor a los alumnos ya inscritos ({inscritos})."]}
                )

        materia = _materia(datos)
        valores = {
            "materia": materia,
            "docente": datos["docente"],
            "num_grupo": datos["num_grupo"],
            "cupo_maximo": datos["cupo_maximo"],
            "turno": turno_de(datos["horarios"]),
        }
        nuevo = grupo is None
        if nuevo:
            grupo = Grupo.objects.create(periodo=periodo, visible=True, **valores)
            aulas = {}
        else:
            for campo, valor in valores.items():
                setattr(grupo, campo, valor)
            grupo.save()
            # El formulario no pide aula: se conserva la del mismo día.
            aulas = {}
            for horario in grupo.horarios.order_by("hora_inicio"):
                aulas.setdefault(horario.dia_semana, horario.aula)
            grupo.horarios.all().delete()

        HorarioGrupo.objects.bulk_create(
            HorarioGrupo(
                grupo=grupo,
                dia_semana=h["dia_semana"],
                hora_inicio=h["hora_inicio"],
                hora_fin=h["hora_fin"],
                aula=aulas.get(h["dia_semana"], ""),
            )
            for h in datos["horarios"]
        )
        registrar(
            usuario,
            "publicar_grupo" if nuevo else "editar_grupo",
            grupo,
            descripcion=f"{materia.clave} gpo {grupo.num_grupo}",
            request=request,
        )
    return con_cupo(Grupo.objects.filter(pk=grupo.pk)).get()


def cambiar_visibilidad(grupo: Grupo, visible: bool, usuario: Usuario | None, *, request=None) -> Grupo:
    """Muestra u oculta el grupo en el catálogo del alumno. Si no cambia nada, no se registra."""
    with transaction.atomic():
        grupo = Grupo.objects.select_for_update().select_related("materia").get(pk=grupo.pk)
        if grupo.visible != visible:
            grupo.visible = visible
            grupo.save(update_fields=["visible"])
            registrar(
                usuario,
                "mostrar_grupo" if visible else "ocultar_grupo",
                grupo,
                descripcion=f"{grupo.materia.clave} gpo {grupo.num_grupo}",
                request=request,
            )
    return con_cupo(Grupo.objects.filter(pk=grupo.pk)).get()
