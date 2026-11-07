from django.contrib import admin
from django.http import JsonResponse
from django.urls import path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.views import CambiarPasswordView, MeView


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
    # Documentación de la API (contrato para el frontend).
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
