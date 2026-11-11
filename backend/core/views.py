import csv
import io
from datetime import date, datetime, time, timedelta

from django.db.models import Count, Prefetch, Q
from django.utils import timezone
from django.http import HttpResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import (
    Bitacora,
    CargaAcademica,
    DetalleSolicitud,
    Docente,
    Estudiante,
    Grupo,
    ImportacionCSV,
    LoteExportacion,
    Notificacion,
    Programa,
    Rol,
    Solicitud,
    Usuario,
)
from .permissions import EsControlEscolar, EsEstudiante, EsPersonalEscolar
from .serializers import (
    ROLES,
    usuario_bitacora,
    AprobarSerializer,
    ArchivoCsvSerializer,
    CambiarPasswordSerializer,
    ChoqueSerializer,
    ColumnaSadceSerializer,
    DocenteSerializer,
    EnTramiteSerializer,
    GenerarLoteSerializer,
    ErrorMovimientoSerializer,
    GrupoEscrituraSerializer,
    GrupoSerializer,
    HorarioEstudianteSerializer,
    ImportacionSerializer,
    LeerTodasSerializer,
    ListaNotificacionesSerializer,
    LoteSerializer,
    NotificacionSerializer,
    PaginaBitacoraSerializer,
    MeSerializer,
    MovimientoExportacionSerializer,
    PeriodoActivoSerializer,
    PeriodoEscrituraSerializer,
    PeriodoSerializer,
    ProgramaSerializer,
    ResultadoImportacionSerializer,
    UltimaModificacionSerializer,
    VisibilidadGrupoSerializer,
    CrearSolicitudSerializer,
    RechazarSerializer,
    ResumenBandejaSerializer,
    ResumenExportacionSerializer,
    ResumenOperativoSerializer,
    RegistroBitacoraSerializer,
    RevisionSerializer,
    SolicitudSerializer,
    ValidacionSerializer,
    ValidarMovimientosSerializer,
    VistaPreviaSerializer,
)
from .services.bandeja import EstadoBandeja, folios_bandeja, resumen_bandeja
from .services.catalogo import con_cupo, grupos_catalogo, periodo_activo
from .services import exportacion, importacion
from .services.dictamen import DictamenInvalido, aprobar_movimiento, rechazar_movimiento, revision_folio
from .services.avisos import (
    CATEGORIAS_BITACORA,
    acciones_de,
    avisos_al_leer,
    categoria_de,
    registrar,
    tipos_de_categoria,
)
from .services.oferta import OfertaInvalida, cambiar_visibilidad, grupos_oferta, guardar_grupo
from .services.periodos import (
    PeriodoInvalido,
    activar_periodo,
    guardar_periodo,
    periodos_listado,
    ultimo_cambio_de_periodo,
)
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


@extend_schema_view(
    list=extend_schema(
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
            OpenApiParameter(
                "oferta",
                bool,
                description="Control escolar: toda la oferta del periodo activo, también los grupos ocultos.",
            ),
            OpenApiParameter(
                "cupo", str, enum=["con", "sin"], description="Con `oferta`: grupos con cupo o sin cupo."
            ),
        ]
    ),
    create=extend_schema(request=GrupoEscrituraSerializer, responses={201: GrupoSerializer}),
    partial_update=extend_schema(
        request=GrupoEscrituraSerializer,
        responses=GrupoSerializer,
        description="Edita el grupo con su horario completo. Con solo `{visible}` lo muestra u oculta.",
    ),
)
class GrupoViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    Oferta del periodo activo (solo grupos visibles), con cupo disponible.
    Para un alumno, `choques` y `errores` dicen qué pasaría si pidiera el alta de cada grupo,
    tomando en cuenta su carga, sus trámites pendientes y el carrito (`altas` y `bajas`).
    Control escolar publica y edita grupos (F7); con `?oferta=1` ve también los ocultos.
    """

    serializer_class = GrupoSerializer
    pagination_class = None
    # Sin PUT: la edición es PATCH. Los grupos no se borran, se ocultan.
    http_method_names = ["get", "post", "patch", "head", "options"]
    # Se llenan en initial(); Swagger llama a get_queryset sin petición.
    periodo = None
    estudiante = None

    def get_permissions(self):
        if self.action in ("create", "partial_update", "update"):
            return [EsControlEscolar()]
        return super().get_permissions()

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.periodo = periodo_activo()
        self.estudiante = estudiante_de(request.user)

    def _es_control(self) -> bool:
        return getattr(self.request.user, "rol", None) == Rol.CONTROL_ESCOLAR

    def _oferta(self) -> bool:
        return self.request.query_params.get("oferta", "").strip().lower() in ("1", "true")

    def get_queryset(self):
        if self.periodo is None:
            return Grupo.objects.none()
        params = self.request.query_params
        if self.action == "list" and self._oferta():
            if not self._es_control():
                raise PermissionDenied("Solo control escolar administra la oferta.")
            cupo = params.get("cupo", "").strip()
            if cupo not in ("", "con", "sin"):
                raise ValidationError({"cupo": ["Debe ser con o sin."]})
            return grupos_oferta(
                self.periodo, q=params.get("q", "").strip(), programa=params.get("programa", "").strip(), cupo=cupo
            )
        if self.action != "list" and self._es_control():
            # Control escolar ve y edita también los grupos ocultos del periodo.
            return con_cupo(Grupo.objects.filter(periodo=self.periodo))
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

    def create(self, request, *args, **kwargs):
        if self.periodo is None:
            raise NotFound("No hay un periodo activo.")
        entrada = GrupoEscrituraSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        try:
            grupo = guardar_grupo(entrada.validated_data, request.user, self.periodo, request=request)
        except OfertaInvalida as error:
            return Response(error.datos, status=status.HTTP_400_BAD_REQUEST)
        return Response(GrupoSerializer(grupo).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        grupo = self.get_object()
        if isinstance(request.data, dict) and set(request.data) == {"visible"}:
            entrada = VisibilidadGrupoSerializer(data=request.data)
            entrada.is_valid(raise_exception=True)
            grupo = cambiar_visibilidad(grupo, entrada.validated_data["visible"], request.user, request=request)
            return Response(GrupoSerializer(grupo).data)
        entrada = GrupoEscrituraSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        try:
            grupo = guardar_grupo(entrada.validated_data, request.user, self.periodo, grupo=grupo, request=request)
        except OfertaInvalida as error:
            return Response(error.datos, status=status.HTTP_400_BAD_REQUEST)
        return Response(GrupoSerializer(grupo).data)


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
                request=request,
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
            cancelar_solicitud(solicitud, request=request)
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
        return self._responder(
            lambda d: aprobar_movimiento(d, request.user, visto_bueno=visto_bueno, request=request)
        )

    @extend_schema(request=RechazarSerializer, responses=SolicitudSerializer)
    @action(detail=True, methods=["post"])
    def rechazar(self, request, pk=None):
        """Rechaza el movimiento con su motivo. Devuelve el folio completo."""
        entrada = RechazarSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        motivo = entrada.validated_data["motivo"]
        return self._responder(lambda d: rechazar_movimiento(d, request.user, motivo, request=request))


# ---------------------------------------------------------------------------
# Periodo, convocatoria y oferta académica (F7)
# ---------------------------------------------------------------------------


@extend_schema_view(
    create=extend_schema(request=PeriodoEscrituraSerializer, responses={201: PeriodoSerializer}),
    partial_update=extend_schema(request=PeriodoEscrituraSerializer, responses=PeriodoSerializer),
)
class PeriodoViewSet(
    mixins.ListModelMixin, mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    """Periodos escolares y su convocatoria. Solo uno está activo; los periodos no se borran."""

    serializer_class = PeriodoSerializer
    permission_classes = [EsPersonalEscolar]
    pagination_class = None
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        return periodos_listado()

    def _respuesta(self, periodo, codigo=status.HTTP_200_OK) -> Response:
        return Response(PeriodoSerializer(periodos_listado().get(pk=periodo.pk)).data, status=codigo)

    def _guardar(self, request, periodo=None) -> Response:
        entrada = PeriodoEscrituraSerializer(periodo, data=request.data, partial=periodo is not None)
        entrada.is_valid(raise_exception=True)
        datos = dict(entrada.validated_data)
        activar = datos.pop("activar", False)
        try:
            periodo = guardar_periodo(datos, request.user, periodo=periodo, activar=activar, request=request)
        except PeriodoInvalido as error:
            # Si no se puede activar, tampoco se guarda: todo va en la misma transacción.
            return Response(error.datos, status=status.HTTP_400_BAD_REQUEST)
        return self._respuesta(periodo, status.HTTP_201_CREATED if entrada.instance is None else status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        return self._guardar(request)

    def update(self, request, *args, **kwargs):
        return self._guardar(request, self.get_object())

    @extend_schema(request=None, responses=PeriodoSerializer)
    @action(detail=True, methods=["post"])
    def activar(self, request, pk=None):
        """Deja este periodo como el activo. Falla si el activo actual tiene movimientos pendientes."""
        try:
            periodo = activar_periodo(self.get_object(), request.user, request=request)
        except PeriodoInvalido as error:
            return Response(error.datos, status=status.HTTP_400_BAD_REQUEST)
        return self._respuesta(periodo)

    @extend_schema(responses=UltimaModificacionSerializer(allow_null=True))
    @action(detail=False, url_path="ultima-modificacion")
    def ultima_modificacion(self, request):
        """Quién cambió por última vez un periodo y cuándo (pie de la pantalla de periodos)."""
        registro = ultimo_cambio_de_periodo()
        return Response(UltimaModificacionSerializer(registro).data if registro else None)


class DocenteViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Catálogo de docentes para el formulario de la oferta. Control escolar puede agregar uno."""

    queryset = Docente.objects.order_by("nombre")
    serializer_class = DocenteSerializer
    permission_classes = [EsControlEscolar]
    pagination_class = None

    def perform_create(self, serializer):
        docente = serializer.save()
        registrar(
            self.request.user,
            "crear_docente",
            docente,
            detalle=f"Registró al docente {docente.nombre}.",
            request=self.request,
        )


class ProgramaViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Programas académicos (filtros y formulario de la oferta)."""

    queryset = Programa.objects.order_by("nombre")
    serializer_class = ProgramaSerializer
    pagination_class = None


TIPO_IMPORTACION = OpenApiParameter(
    "tipo", str, OpenApiParameter.PATH, enum=[t.value for t in ImportacionCSV.Tipo], description="alumnos o cargas"
)


class ImportacionViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Importación de CSV del padrón y de cargas académicas, y su historial. Solo control escolar."""

    queryset = ImportacionCSV.objects.select_related("periodo", "usuario")
    serializer_class = ImportacionSerializer
    permission_classes = [EsControlEscolar]
    pagination_class = None

    @extend_schema(
        parameters=[
            TIPO_IMPORTACION,
            OpenApiParameter(
                "modo",
                str,
                enum=["vista_previa", "confirmar"],
                required=True,
                description="vista_previa valida sin escribir; confirmar importa las filas válidas.",
            ),
        ],
        request={"multipart/form-data": ArchivoCsvSerializer},
        responses={200: VistaPreviaSerializer, 201: ResultadoImportacionSerializer},
    )
    @action(detail=False, methods=["post"], url_path=r"(?P<tipo>alumnos|cargas)", parser_classes=[MultiPartParser])
    def importar(self, request, tipo=None):
        modo = request.query_params.get("modo")
        if modo not in ("vista_previa", "confirmar"):
            raise ValidationError({"modo": ["Usa modo=vista_previa o modo=confirmar."]})
        entrada = ArchivoCsvSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        periodo = periodo_activo()
        if periodo is None:
            raise ValidationError({"detail": "No hay un periodo activo."})
        archivo = entrada.validated_data["archivo"]
        try:
            if modo == "vista_previa":
                return Response(importacion.vista_previa(tipo, archivo, periodo))
            resultado = importacion.confirmar(tipo, archivo, request.user, periodo, request=request)
        except importacion.ImportacionInvalida as error:
            return Response(error.datos, status=status.HTTP_400_BAD_REQUEST)
        return Response(resultado, status=status.HTTP_201_CREATED)

    @extend_schema(parameters=[TIPO_IMPORTACION], responses={(200, "text/csv"): bytes})
    @action(detail=False, url_path=r"plantilla/(?P<tipo>alumnos|cargas)")
    def plantilla(self, request, tipo=None):
        """Plantilla oficial: solo los encabezados de las columnas."""
        respuesta = HttpResponse(importacion.plantilla(tipo), content_type="text/csv; charset=utf-8")
        respuesta["Content-Disposition"] = f'attachment; filename="plantilla_{tipo}.csv"'
        return respuesta


class ExportacionViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    Exportación a SADCE: lotes del periodo activo, movimientos por exportar, descarga del archivo y
    "marcar como cargado". Solo control escolar.
    """

    queryset = LoteExportacion.objects.all()  # el esquema lo usa para el tipo del id
    serializer_class = LoteSerializer
    permission_classes = [EsControlEscolar]
    pagination_class = None

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        self.periodo = periodo_activo()
        if self.periodo is None:
            raise ValidationError({"detail": "No hay un periodo activo."})

    def get_queryset(self):
        return exportacion.lotes(self.periodo)

    def _respuesta_lote(self, lote_id: int, codigo=status.HTTP_200_OK) -> Response:
        lote = exportacion.con_programas([self.get_queryset().get(pk=lote_id)])[0]
        return Response(LoteSerializer(lote).data, status=codigo)

    @extend_schema(
        parameters=[
            OpenApiParameter("q", str, description="Folio del lote (LOTE-2026A-006) o nombre de quien exportó."),
            OpenApiParameter("formato", str, enum=[f.value for f in LoteExportacion.Formato]),
            OpenApiParameter("estado", str, enum=["exportado", "cargado"]),
        ]
    )
    def list(self, request):
        """Lotes del periodo activo, del más nuevo al más viejo."""
        lotes = self.get_queryset()
        formato = request.query_params.get("formato")
        if formato in LoteExportacion.Formato.values:
            lotes = lotes.filter(formato=formato)
        estado = request.query_params.get("estado")
        if estado == "exportado":
            lotes = lotes.filter(fecha_carga=None)
        elif estado == "cargado":
            lotes = lotes.exclude(fecha_carga=None)
        lista = list(lotes)
        # El folio se calcula (no está en la base) y los lotes de un periodo son pocos.
        q = request.query_params.get("q", "").strip().lower()
        if q:
            lista = [
                lote
                for lote in lista
                if q in lote.folio.lower() or (lote.usuario and q in lote.usuario.get_full_name().lower())
            ]
        return Response(LoteSerializer(exportacion.con_programas(lista), many=True).data)

    @extend_schema(request=GenerarLoteSerializer, responses={201: LoteSerializer})
    def create(self, request):
        """Mete en un lote nuevo todos los movimientos aprobados que aún no se exportan."""
        entrada = GenerarLoteSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        try:
            lote = exportacion.generar_lote(
                self.periodo, request.user, entrada.validated_data["formato"], request=request
            )
        except exportacion.ExportacionInvalida as error:
            return Response(error.datos, status=status.HTTP_400_BAD_REQUEST)
        return self._respuesta_lote(lote.pk, status.HTTP_201_CREATED)

    @extend_schema(responses=MovimientoExportacionSerializer(many=True))
    @action(detail=False)
    def pendientes(self, request):
        """Movimientos aprobados del periodo activo que todavía no están en un lote."""
        movimientos = exportacion.movimientos_completos(exportacion.pendientes(self.periodo))
        return Response(MovimientoExportacionSerializer(movimientos, many=True).data)

    @extend_schema(responses=ResumenExportacionSerializer)
    @action(detail=False)
    def resumen(self, request):
        """Tarjetas de la pantalla: dictaminados, cargados, lotes en espera y última exportación."""
        return Response(ResumenExportacionSerializer(exportacion.resumen(self.periodo)).data)

    @extend_schema(responses=ColumnaSadceSerializer(many=True))
    @action(detail=False)
    def plantilla(self, request):
        """Columnas del archivo para SADCE, con su descripción y un ejemplo."""
        return Response(ColumnaSadceSerializer(exportacion.plantilla(), many=True).data)

    @extend_schema(
        responses={
            (200, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"): bytes,
            (200, "text/csv"): bytes,
        }
    )
    @action(detail=True)
    def descargar(self, request, pk=None):
        """El archivo del lote (se arma de nuevo con sus movimientos)."""
        contenido, tipo, nombre = exportacion.archivo(self.get_object())
        respuesta = HttpResponse(contenido, content_type=tipo)
        respuesta["Content-Disposition"] = f'attachment; filename="{nombre}"'
        return respuesta

    @extend_schema(request=None, responses=LoteSerializer)
    @action(detail=True, methods=["post"], url_path="marcar-cargado")
    def marcar_cargado(self, request, pk=None):
        """Control Escolar confirma que pasó el lote a SADCE: se avisa a los alumnos."""
        lote = self.get_object()
        try:
            exportacion.marcar_cargado(lote, request.user, request=request)
        except exportacion.ExportacionInvalida as error:
            return Response(error.datos, status=status.HTTP_400_BAD_REQUEST)
        return self._respuesta_lote(lote.pk)


# ---------------------------------------------------------------------------
# Inicio de sesión, notificaciones y bitácora (F10)
# ---------------------------------------------------------------------------

ORIGEN_SESION = {
    Rol.ESTUDIANTE: "el portal del estudiante",
    Rol.CONTROL_ESCOLAR: "la ventanilla de Control Escolar",
    Rol.ADMINISTRADOR: "el panel de administración",
}


class EntrarView(TokenObtainPairView):
    """Login con matrícula o usuario. Cada inicio de sesión correcto queda en la bitácora."""

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as error:
            raise InvalidToken(error.args[0]) from error
        usuario = serializer.user
        origen = ORIGEN_SESION.get(usuario.rol, "SABE")
        registrar(usuario, "iniciar_sesion", usuario, detalle=f"Inicio de sesión desde {origen}.", request=request)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


LIMITE_AVISOS = 20
CATEGORIAS_FILTRO = ["tramites", "resoluciones", "convocatoria", "nuevas", "cancelaciones", "sistema"]


class NotificacionViewSet(viewsets.GenericViewSet):
    """Avisos del usuario que inició sesión (cada quien ve solo los suyos)."""

    queryset = Notificacion.objects.all()  # el esquema lo usa para el tipo del id
    serializer_class = NotificacionSerializer
    pagination_class = None

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Notificacion.objects.none()
        return Notificacion.objects.filter(usuario=self.request.user).select_related("solicitud")

    @extend_schema(
        parameters=[
            OpenApiParameter("estado", str, enum=["no_leidas"]),
            OpenApiParameter("categoria", str, enum=CATEGORIAS_FILTRO),
            OpenApiParameter("q", str, description="Folio, título o texto del aviso."),
            OpenApiParameter("orden", str, enum=["recientes", "antiguas"]),
            OpenApiParameter("limite", int, description=f"Cuántos devolver (por omisión {LIMITE_AVISOS}, máximo 100)."),
        ],
        responses=ListaNotificacionesSerializer,
    )
    def list(self, request):
        avisos_al_leer(request.user)
        todos = self.get_queryset()
        conteos = todos.aggregate(
            todas=Count("id"),
            no_leidas=Count("id", filter=Q(leida=False)),
            **{c: Count("id", filter=Q(tipo__in=tipos_de_categoria(c))) for c in CATEGORIAS_FILTRO},
        )
        avisos = todos
        params = request.query_params
        if params.get("estado") == "no_leidas":
            avisos = avisos.filter(leida=False)
        if params.get("categoria") in CATEGORIAS_FILTRO:
            avisos = avisos.filter(tipo__in=tipos_de_categoria(params["categoria"]))
        if q := params.get("q", "").strip():
            avisos = avisos.filter(
                Q(solicitud__folio_digital__icontains=q) | Q(titulo__icontains=q) | Q(mensaje__icontains=q)
            )
        if params.get("orden") == "antiguas":
            avisos = avisos.order_by("fecha", "id")
        try:
            limite = min(max(int(params.get("limite", LIMITE_AVISOS)), 1), 100)
        except ValueError:
            limite = LIMITE_AVISOS
        return Response(
            {
                "no_leidas": conteos["no_leidas"],
                "total": avisos.count(),
                "conteos": conteos,
                "resultados": NotificacionSerializer(avisos[:limite], many=True).data,
            }
        )

    @extend_schema(request=None, responses=NotificacionSerializer)
    @action(detail=True, methods=["post"])
    def leer(self, request, pk=None):
        aviso = self.get_object()
        if not aviso.leida:
            aviso.leida = True
            aviso.save(update_fields=["leida"])
        return Response(NotificacionSerializer(aviso).data)

    @extend_schema(request=None, responses=LeerTodasSerializer)
    @action(detail=False, methods=["post"], url_path="leer-todas")
    def leer_todas(self, request):
        marcadas = self.get_queryset().filter(leida=False).update(leida=True)
        return Response({"marcadas": marcadas})

    @extend_schema(responses=ResumenOperativoSerializer)
    @action(detail=False, url_path="resumen-operativo", permission_classes=[EsControlEscolar])
    def resumen_operativo(self, request):
        """Alumnos que cancelaron hoy y ayer (tarjeta "Cancelaciones Hoy")."""
        hoy = timezone.localdate()
        cancelaciones = Bitacora.objects.filter(accion="cancelar_folio")

        def alumnos(dia):
            inicio = timezone.make_aware(datetime.combine(dia, time.min))
            return (
                cancelaciones.filter(fecha__gte=inicio, fecha__lt=inicio + timedelta(days=1))
                .values("usuario")
                .distinct()
                .count()
            )

        return Response({"cancelaciones_hoy": alumnos(hoy), "cancelaciones_ayer": alumnos(hoy - timedelta(days=1))})


POR_PAGINA_BITACORA = 50
FILTROS_BITACORA = [
    OpenApiParameter("q", str, description="Usuario, folio o detalle."),
    OpenApiParameter("categoria", str, enum=CATEGORIAS_BITACORA),
    OpenApiParameter("rol", str, enum=list(ROLES)),
    OpenApiParameter("desde", str, description="AAAA-MM-DD"),
    OpenApiParameter("hasta", str, description="AAAA-MM-DD"),
]


class BitacoraViewSet(viewsets.GenericViewSet):
    """Bitácora de auditoría: solo lectura, para control escolar y el administrador."""

    serializer_class = RegistroBitacoraSerializer
    permission_classes = [EsPersonalEscolar]
    pagination_class = None
    queryset = Bitacora.objects.select_related("usuario").order_by("-fecha", "-id")

    def filtrar(self, request):
        registros = self.get_queryset()
        params = request.query_params
        if q := params.get("q", "").strip():
            registros = registros.filter(
                Q(usuario__username__icontains=q)
                | Q(usuario__first_name__icontains=q)
                | Q(usuario__last_name__icontains=q)
                | Q(detalle__icontains=q)
                | Q(entidad__icontains=q)
            )
        categoria = params.get("categoria")
        if categoria == "Usuarios":
            registros = registros.filter(accion__endswith="_usuario")
        elif categoria in CATEGORIAS_BITACORA:
            registros = registros.filter(accion__in=acciones_de(categoria))
        if params.get("rol") in ROLES:
            registros = registros.filter(usuario__rol=params["rol"])
        for campo, operador in (("desde", "gte"), ("hasta", "lte")):
            if valor := params.get(campo):
                try:
                    dia = date.fromisoformat(valor)
                    registros = registros.filter(**{f"fecha__date__{operador}": dia})
                except ValueError:
                    raise ValidationError({campo: ["Usa el formato AAAA-MM-DD."]}) from None
        return registros

    @extend_schema(
        parameters=[*FILTROS_BITACORA, OpenApiParameter("pagina", int, description="Desde 1; 50 registros por página.")],
        responses=PaginaBitacoraSerializer,
    )
    def list(self, request):
        registros = self.filtrar(request)
        total = registros.count()
        paginas = max(1, -(-total // POR_PAGINA_BITACORA))
        try:
            pagina = min(max(int(request.query_params.get("pagina", 1)), 1), paginas)
        except ValueError:
            pagina = 1
        inicio = (pagina - 1) * POR_PAGINA_BITACORA
        return Response(
            {
                "total": total,
                "pagina": pagina,
                "paginas": paginas,
                "resultados": RegistroBitacoraSerializer(registros[inicio : inicio + POR_PAGINA_BITACORA], many=True).data,
            }
        )

    @extend_schema(parameters=FILTROS_BITACORA, responses={(200, "text/csv"): bytes})
    @action(detail=False)
    def exportar(self, request):
        """La bitácora filtrada en CSV (UTF-8 con BOM, para Excel)."""
        salida = io.StringIO()
        escritor = csv.writer(salida, lineterminator="\r\n")
        escritor.writerow(["Fecha", "Usuario", "Rol", "Accion", "Detalle"])
        for registro in self.filtrar(request).iterator(chunk_size=500):
            escritor.writerow(
                [
                    timezone.localtime(registro.fecha).strftime("%d/%m/%Y %H:%M"),
                    usuario_bitacora(registro.usuario),
                    ROLES.get(registro.usuario.rol, "") if registro.usuario else "",
                    categoria_de(registro.accion),
                    registro.detalle or registro.entidad,
                ]
            )
        periodo = periodo_activo()
        nombre = f"bitacora_sabe_{periodo.ciclo.replace('-', '')}.csv" if periodo else "bitacora_sabe.csv"
        respuesta = HttpResponse("\ufeff" + salida.getvalue(), content_type="text/csv; charset=utf-8")
        respuesta["Content-Disposition"] = f'attachment; filename="{nombre}"'
        return respuesta
