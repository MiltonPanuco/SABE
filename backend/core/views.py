from django.db.models import Prefetch
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CargaAcademica, DetalleSolicitud, Estudiante, Grupo, Rol, Usuario
from .permissions import EsEstudiante
from .serializers import (
    CambiarPasswordSerializer,
    EnTramiteSerializer,
    GrupoSerializer,
    HorarioEstudianteSerializer,
    MeSerializer,
    PeriodoActivoSerializer,
)
from .services.catalogo import con_cupo, grupos_catalogo, periodo_activo
from .services.choques import choques_con_carga


class MeView(APIView):
    """Perfil del usuario con sesión iniciada. El frontend lo usa para saber el rol."""

    @extend_schema(responses=MeSerializer)
    def get(self, request):
        usuario = Usuario.objects.select_related("perfil_estudiante__programa").get(pk=request.user.pk)
        return Response(MeSerializer(usuario).data)


class CambiarPasswordView(APIView):
    """Cambia la contraseña y quita la marca de contraseña temporal."""

    @extend_schema(request=CambiarPasswordSerializer, responses={204: None})
    def post(self, request):
        serializer = CambiarPasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Catálogo y horario del estudiante (F3)
# ---------------------------------------------------------------------------


def estudiante_de(usuario) -> Estudiante | None:
    """Perfil de alumno del usuario (con su programa), o None si no es estudiante."""
    if usuario.rol != Rol.ESTUDIANTE:
        return None
    return Estudiante.objects.select_related("programa").filter(usuario=usuario).first()


class PeriodoActivoView(APIView):
    """Periodo escolar activo y si su convocatoria de altas y bajas está abierta."""

    @extend_schema(responses=PeriodoActivoSerializer)
    def get(self, request):
        periodo = periodo_activo()
        if periodo is None:
            raise NotFound("No hay un periodo activo.")
        return Response(PeriodoActivoSerializer(periodo).data)


@extend_schema(
    parameters=[
        OpenApiParameter("q", str, description="Busca en nombre de la materia, clave o docente."),
        OpenApiParameter("materia", str, description="Clave exacta de la materia."),
        OpenApiParameter("turno", str, enum=["matutino", "vespertino"]),
        OpenApiParameter(
            "programa", str, description="Nombre del programa. Para un alumno, por defecto el suyo."
        ),
    ]
)
class GrupoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Oferta del periodo activo (solo grupos visibles), con cupo disponible.
    Para un alumno, `choques` dice con qué materias de su carga choca cada grupo.
    F7 lo convierte en ModelViewSet para que control escolar edite la oferta.
    """

    serializer_class = GrupoSerializer
    pagination_class = None
    # Se llenan en initial(); Swagger llama a get_queryset sin petición.
    periodo = None
    estudiante = None

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.periodo = periodo_activo()
        self.estudiante = estudiante_de(request.user)

    def get_queryset(self):
        if self.periodo is None:
            return Grupo.objects.none()
        params = self.request.query_params
        programa = params.get("programa", "")
        if not programa and self.estudiante and self.action == "list":
            programa = self.estudiante.programa.nombre
        return grupos_catalogo(
            self.periodo,
            q=params.get("q", "").strip(),
            materia=params.get("materia", "").strip(),
            turno=params.get("turno", "").strip(),
            programa=programa.strip(),
        )

    def _contexto(self, grupos):
        contexto = self.get_serializer_context()
        if self.estudiante and self.periodo:
            contexto["choques"] = choques_con_carga(self.estudiante, self.periodo, grupos)
        return contexto

    def list(self, request, *args, **kwargs):
        grupos = list(self.get_queryset())
        return Response(GrupoSerializer(grupos, many=True, context=self._contexto(grupos)).data)

    def retrieve(self, request, *args, **kwargs):
        grupo = self.get_object()
        return Response(GrupoSerializer(grupo, context=self._contexto([grupo])).data)


class HorarioEstudianteView(APIView):
    """Materias inscritas del alumno en el periodo activo y sus movimientos en trámite."""

    permission_classes = [EsEstudiante]

    @extend_schema(responses=HorarioEstudianteSerializer)
    def get(self, request):
        periodo = periodo_activo()
        estudiante = estudiante_de(request.user)
        if periodo is None or estudiante is None:
            return Response({"ciclo": periodo.ciclo if periodo else None, "inscritas": [], "en_tramite": []})

        # Subconsulta y no `cargas__estudiante=`: filtrar por la misma relación que se cuenta
        # haría que el cupo contara solo la carga de este alumno.
        mis_grupos = CargaAcademica.objects.filter(
            estudiante=estudiante, estado=CargaAcademica.Estado.INSCRITO
        ).values("grupo")
        inscritas = con_cupo(Grupo.objects.filter(periodo=periodo, pk__in=mis_grupos)).order_by(
            "materia__clave", "num_grupo"
        )

        en_tramite = (
            DetalleSolicitud.objects.filter(
                solicitud__estudiante=estudiante,
                solicitud__periodo=periodo,
                estado=DetalleSolicitud.Estado.PENDIENTE,
            )
            .select_related("solicitud")
            .prefetch_related(
                # El grupo trae cupo y horarios igual que en el catálogo.
                Prefetch("grupo", queryset=con_cupo(Grupo.objects.all()))
            )
            .order_by("solicitud__fecha_solicitud", "id")
        )

        return Response(
            {
                "ciclo": periodo.ciclo,
                "inscritas": GrupoSerializer(inscritas, many=True).data,
                "en_tramite": EnTramiteSerializer(en_tramite, many=True).data,
            }
        )
