from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import SimpleRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.views import (
    CambiarPasswordView,
    DocenteViewSet,
    GrupoViewSet,
    HorarioEstudianteView,
    MeView,
    MovimientoViewSet,
    PeriodoActivoView,
    PeriodoViewSet,
    ProgramaViewSet,
    SolicitudViewSet,
    ValidarMovimientosView,
)

router = SimpleRouter()
router.register("grupos", GrupoViewSet, basename="grupo")
router.register("solicitudes", SolicitudViewSet, basename="solicitud")
router.register("movimientos", MovimientoViewSet, basename="movimiento")
router.register("periodos", PeriodoViewSet, basename="periodo")
router.register("docentes", DocenteViewSet, basename="docente")
router.register("programas", ProgramaViewSet, basename="programa")


def health(request):
    """Para comprobar que el backend está arriba (lo usa el frontend de arranque)."""
    return JsonResponse({"status": "ok", "app": "SABE"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health),
    # Login: el username es la matrícula en alumnos.
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/cambiar-password/", CambiarPasswordView.as_view(), name="cambiar_password"),
    path("api/me/", MeView.as_view(), name="me"),
    # Catálogo y horario del estudiante (F3).
    path("api/periodos/activo/", PeriodoActivoView.as_view(), name="periodo_activo"),
    path("api/estudiante/horario/", HorarioEstudianteView.as_view(), name="horario_estudiante"),
    # Choques y validación del carrito (F4). Va antes del router para que "validar" no se lea como id.
    path("api/solicitudes/validar/", ValidarMovimientosView.as_view(), name="validar_movimientos"),
    path("api/", include(router.urls)),
    # Documentación de la API (contrato para el frontend).
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
