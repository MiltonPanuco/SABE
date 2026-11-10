from django.db.models import Prefetch
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CargaAcademica, DetalleSolicitud, Estudiante, Grupo, Rol, Solicitud, Usuario
from .permissions import EsControlEscolar, EsEstudiante
from .serializers import (
    AprobarSerializer,
    CambiarPasswordSerializer,
    ChoqueSerializer,
    EnTramiteSerializer,
    ErrorMovimientoSerializer,
    GrupoSerializer,
    HorarioEstudianteSerializer,
    MeSerializer,
    PeriodoActivoSerializer,
    CrearSolicitudSerializer,
    RechazarSerializer,
    ResumenBandejaSerializer,
    RevisionSerializer,
    SolicitudSerializer,
    ValidacionSerializer,
    ValidarMovimientosSerializer,
)
from .services.bandeja import EstadoBandeja, folios_bandeja, resumen_bandeja
from .services.catalogo import con_cupo, grupos_catalogo, periodo_activo
from .services.dictamen import DictamenInvalido, aprobar_movimiento, rechazar_movimiento, revision_folio
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


def folios_completos():
    """Folios con alumno, periodo, movimientos, revisor y grupos (con cupo y horarios) precargados."""
    return Solicitud.objects.select_related(
        "periodo", "estudiante__usuario", "estudiante__programa"
    ).prefetch_related(
        Prefetch(
            "detalles",
            queryset=DetalleSolicitud.objects.select_related("revisado_por")
            .prefetch_related(Prefetch("grupo", queryset=con_cupo(Grupo.objects.all())))
            .order_by("id"),
        )
    )


def folio_actualizado(solicitud_id: int) -> dict:
    """Respuesta de las acciones que cambian un folio: el folio completo, igual que GET /{id}/."""
    return SolicitudSerializer(folios_completos().get(pk=solicitud_id)).data


@extend_schema_view(
    list=extend_schema(
        parameters=[
            OpenApiParameter(
                "estado",
                str,
                enum=[e.value for e in EstadoBandeja],
                description="Control escolar: estado en la bandeja. Sin él se ocultan los folios cancelados por completo.",
            ),
            OpenApiParameter(
                "extemporanea", bool, description="Control escolar: extemporáneos (true) o en convocatoria (false)."
            ),
            OpenApiParameter("q", str, description="Control escolar: busca por folio, matrícula o nombre del alumno."),
        ]
    )
)
class SolicitudViewSet(
    mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """
    Folios de altas y bajas. El alumno ve, crea y cancela los suyos (F5).
    Control escolar y administrador ven los del periodo activo, con los filtros de la bandeja (F6).
    """

    serializer_class = SolicitudSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in ("create", "cancelar"):
            return [EsEstudiante()]
        if self.action in ("resumen", "revision"):
            return [EsControlEscolar()]
        return super().get_permissions()

    def _es_alumno(self) -> bool:
        return getattr(self.request.user, "rol", None) == Rol.ESTUDIANTE

    def get_queryset(self):
        folios = folios_completos()
        if self._es_alumno():
            folios = folios.filter(estudiante__usuario=self.request.user)
        return folios.order_by("-fecha_solicitud", "-id")

    def filter_queryset(self, queryset):
        if self.action != "list" or self._es_alumno():
            return queryset
        periodo = periodo_activo()
        if periodo is None:
            return queryset.none()
        params = self.request.query_params
        estado = params.get("estado", "").strip()
        if estado and estado not in EstadoBandeja:
            raise ValidationError({"estado": [f"Debe ser uno de: {', '.join(EstadoBandeja)}."]})
        extemporanea = {"true": True, "false": False}.get(params.get("extemporanea", "").strip().lower())
        return folios_bandeja(
            queryset, periodo, estado=estado, extemporanea=extemporanea, q=params.get("q", "").strip()
        )

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
        return Response(folio_actualizado(solicitud.pk), status=status.HTTP_201_CREATED)

    @extend_schema(request=None, responses=SolicitudSerializer)
    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        """Cancela los movimientos pendientes del folio."""
        solicitud = self.get_object()
        try:
            cancelar_solicitud(solicitud)
        except SolicitudInvalida as error:
            return Response(error.datos, status=status.HTTP_400_BAD_REQUEST)
        return Response(folio_actualizado(solicitud.pk))

    @extend_schema(responses=ResumenBandejaSerializer)
    @action(detail=False)
    def resumen(self, request):
        """Indicadores de la bandeja de control escolar para el periodo activo."""
        periodo = periodo_activo()
        if periodo is None:
            raise NotFound("No hay un periodo activo.")
        return Response(ResumenBandejaSerializer(resumen_bandeja(periodo)).data)

    @extend_schema(responses=RevisionSerializer)
    @action(detail=True)
    def revision(self, request, pk=None):
        """Qué impide hoy aprobar cada movimiento pendiente del folio (cupo, choques, baja pendiente)."""
        solicitud = self.get_object()
        revision = revision_folio(solicitud)
        movimientos = [
            {"id": detalle_id, "choques": choques, "errores": errores}
            for detalle_id, (choques, errores) in revision.items()
        ]
        return Response(RevisionSerializer({"movimientos": movimientos}).data)


class MovimientoViewSet(viewsets.GenericViewSet):
    """Dictamen de control escolar: aprobar o rechazar cada movimiento de un folio (F6)."""

    queryset = DetalleSolicitud.objects.all()
    serializer_class = SolicitudSerializer
    permission_classes = [EsControlEscolar]

    def _responder(self, accion) -> Response:
        detalle = self.get_object()
        try:
            detalle = accion(detalle)
        except DictamenInvalido as error:
            datos = dict(error.datos)
            if error.choques or error.errores:
                datos["choques"] = ChoqueSerializer(error.choques, many=True).data
                datos["errores"] = ErrorMovimientoSerializer(error.errores, many=True).data
            return Response(datos, status=status.HTTP_400_BAD_REQUEST)
        return Response(folio_actualizado(detalle.solicitud_id))

    @extend_schema(request=AprobarSerializer, responses=SolicitudSerializer)
    @action(detail=True, methods=["post"])
    def aprobar(self, request, pk=None):
        """Aprueba el movimiento y actualiza la carga del alumno. Devuelve el folio completo."""
        entrada = AprobarSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        visto_bueno = entrada.validated_data["visto_bueno"]
        return self._responder(lambda d: aprobar_movimiento(d, request.user, visto_bueno=visto_bueno))

    @extend_schema(request=RechazarSerializer, responses=SolicitudSerializer)
    @action(detail=True, methods=["post"])
    def rechazar(self, request, pk=None):
        """Rechaza el movimiento con su motivo. Devuelve el folio completo."""
        entrada = RechazarSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        motivo = entrada.validated_data["motivo"]
        return self._responder(lambda d: rechazar_movimiento(d, request.user, motivo))
