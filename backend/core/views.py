from django.db.models import Prefetch
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CargaAcademica, DetalleSolicitud, Estudiante, Grupo, Rol, Solicitud, Usuario
from .permissions import EsEstudiante
from .serializers import (
    CambiarPasswordSerializer,
    EnTramiteSerializer,
    GrupoSerializer,
    HorarioEstudianteSerializer,
    MeSerializer,
    PeriodoActivoSerializer,
    CrearSolicitudSerializer,
    SolicitudSerializer,
    ValidacionSerializer,
    ValidarMovimientosSerializer,
)
from .services.catalogo import con_cupo, grupos_catalogo, periodo_activo
from .services.solicitudes import SolicitudInvalida, cancelar_solicitud, crear_solicitud
from .services.validacion import Contexto, revisar_alta, validar_movimientos


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
        OpenApiParameter(
            "altas", str, description="Ids de grupos con alta en el carrito, separados por comas (alumnos)."
        ),
        OpenApiParameter(
            "bajas", str, description="Ids de grupos con baja en el carrito, separados por comas (alumnos)."
        ),
    ]
)
class GrupoViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Oferta del periodo activo (solo grupos visibles), con cupo disponible.
    Para un alumno, `choques` y `errores` dicen qué pasaría si pidiera el alta de cada grupo,
    tomando en cuenta su carga, sus trámites pendientes y el carrito (`altas` y `bajas`).
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

    def _ids(self, nombre: str) -> list[int]:
        valor = self.request.query_params.get(nombre, "").strip()
        if not valor:
            return []
        try:
            return [int(parte) for parte in valor.split(",")]
        except ValueError:
            raise ValidationError({nombre: ["Debe ser una lista de ids separados por comas."]}) from None

    def _contexto(self, grupos):
        contexto = self.get_serializer_context()
        if not (self.estudiante and self.periodo):
            return contexto
        altas, bajas = self._ids("altas"), self._ids("bajas")
        carrito = {}
        if altas or bajas:
            carrito = {g.pk: g for g in con_cupo(Grupo.objects.filter(pk__in=altas + bajas))}
        revision = Contexto.para(
            self.estudiante,
            self.periodo,
            altas=[carrito[i] for i in altas if i in carrito],
            bajas=[carrito[i] for i in bajas if i in carrito],
        )
        revisados = {grupo.pk: revisar_alta(grupo, revision) for grupo in grupos}
        contexto["choques"] = {pk: choques for pk, (choques, _) in revisados.items()}
        contexto["errores"] = {pk: errores for pk, (_, errores) in revisados.items()}
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


class ValidarMovimientosView(APIView):
    """
    Revisa una lista de altas y bajas (el carrito) sin guardar nada: choques de horario
    y errores de cada movimiento. Al crear el folio (F5) se vuelve a validar igual.
    """

    permission_classes = [EsEstudiante]

    @extend_schema(request=ValidarMovimientosSerializer, responses=ValidacionSerializer)
    def post(self, request):
        periodo = periodo_activo()
        if periodo is None:
            raise NotFound("No hay un periodo activo.")
        estudiante = estudiante_de(request.user)
        if estudiante is None:
            raise PermissionDenied("Tu usuario no tiene perfil de estudiante.")
        entrada = ValidarMovimientosSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        resultados = validar_movimientos(estudiante, periodo, entrada.validated_data["movimientos"])
        return Response(
            ValidacionSerializer(
                {"valido": all(r.valido for r in resultados), "movimientos": resultados}
            ).data
        )


class SolicitudViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """
    Folios de altas y bajas. El alumno ve, crea y cancela los suyos;
    control escolar y administrador los ven todos (F6 agrega filtros y el dictamen).
    """

    serializer_class = SolicitudSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ("create", "cancelar"):
            return [EsEstudiante()]
        return super().get_permissions()

    def get_queryset(self):
        folios = Solicitud.objects.select_related(
            "periodo", "estudiante__usuario", "estudiante__programa"
        ).prefetch_related(
            Prefetch(
                "detalles",
                queryset=DetalleSolicitud.objects.select_related("revisado_por")
                .prefetch_related(Prefetch("grupo", queryset=con_cupo(Grupo.objects.all())))
                .order_by("id"),
            )
        )
        usuario = self.request.user
        if getattr(usuario, "rol", None) == Rol.ESTUDIANTE:
            folios = folios.filter(estudiante__usuario=usuario)
        return folios.order_by("-fecha_solicitud", "-id")

    def _detalle(self, solicitud: Solicitud) -> dict:
        # Se vuelve a leer con todo precargado para responder igual que GET /{id}/.
        return SolicitudSerializer(self.get_queryset().get(pk=solicitud.pk)).data

    @extend_schema(request=CrearSolicitudSerializer, responses={201: SolicitudSerializer})
    def create(self, request, *args, **kwargs):
        periodo = periodo_activo()
        if periodo is None:
            raise NotFound("No hay un periodo activo.")
        estudiante = estudiante_de(request.user)
        if estudiante is None:
            raise PermissionDenied("Tu usuario no tiene perfil de estudiante.")
        entrada = CrearSolicitudSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        try:
            solicitud = crear_solicitud(
                estudiante,
                periodo,
                entrada.validated_data["movimientos"],
                entrada.validated_data["justificacion"],
            )
        except SolicitudInvalida as error:
            datos = dict(error.datos)
            if error.resultados is not None:
                datos["validacion"] = ValidacionSerializer(
                    {"valido": False, "movimientos": error.resultados}
                ).data
            return Response(datos, status=status.HTTP_400_BAD_REQUEST)
        return Response(self._detalle(solicitud), status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses=SolicitudSerializer)
    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        """Cancela los movimientos pendientes del folio."""
        solicitud = self.get_object()
        try:
            cancelar_solicitud(solicitud)
        except SolicitudInvalida as error:
            return Response(error.datos, status=status.HTTP_400_BAD_REQUEST)
        return Response(self._detalle(solicitud))
