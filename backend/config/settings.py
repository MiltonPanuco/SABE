"""Configuración de SABE. Los valores sensibles salen del archivo .env en la raíz del repo."""

import os
import sys
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / ".env")

CLAVE_DE_DESARROLLO = "dev-insecure-cambiar-en-produccion"


def lista(nombre: str, defecto: str = "") -> list[str]:
    """Variable de entorno separada por comas."""
    return [v.strip() for v in os.getenv(nombre, defecto).split(",") if v.strip()]


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", CLAVE_DE_DESARROLLO)
DEBUG = os.getenv("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = lista("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
CSRF_TRUSTED_ORIGINS = lista("CSRF_TRUSTED_ORIGINS")

# En producción no se arranca con la clave de desarrollo (firma los JWT y las sesiones).
if not DEBUG and (SECRET_KEY == CLAVE_DE_DESARROLLO or len(SECRET_KEY) < 50):
    raise ImproperlyConfigured("Con DJANGO_DEBUG=0, DJANGO_SECRET_KEY debe ser una clave propia de 50 caracteres o más.")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "drf_spectacular",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Archivos estáticos de Django (admin, Swagger) sin servidor aparte (F12).
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# PostgreSQL si hay POSTGRES_DB en el .env; si no, SQLite para arrancar sin Docker.
if os.getenv("POSTGRES_DB"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ["POSTGRES_DB"],
            "USER": os.getenv("POSTGRES_USER", "sabe"),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", "sabe"),
            "HOST": os.getenv("POSTGRES_HOST", "localhost"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
        }
    }
else:
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}}

AUTH_USER_MODEL = "core.Usuario"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Los de Django y, al final, el de las contraseñas temporales de la importación de CSV.
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
    "core.hashers.PBKDF2TemporalHasher",
]

LANGUAGE_CODE = "es-mx"
TIME_ZONE = "America/Mazatlan"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        if DEBUG
        else "whitenoise.storage.CompressedManifestStaticFilesStorage"
    },
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- API ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Intentos de inicio de sesión por IP (la URL es pública).
    # Las pruebas inician sesión cientos de veces: ahí el límite es alto (test_despliegue prueba el real).
    "DEFAULT_THROTTLE_RATES": {"login": "100000/min" if sys.argv[1:2] == ["test"] else os.getenv("SABE_LOGIN_RATE", "10/min")},
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "SABE API",
    "DESCRIPTION": "Sistema de Altas y Bajas de Economía (UAE - UAN)",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # ALTA/BAJA aparece como `tipo_tramite` y como `tipo`: un solo enum en el esquema.
    "ENUM_NAME_OVERRIDES": {
        "TipoTramiteEnum": "core.models.DetalleSolicitud.Tipo",
        "TipoImportacionEnum": "core.models.ImportacionCSV.Tipo",
        "RolEnum": "core.models.Rol",
        "RolPersonalEnum": ["control_escolar", "administrador"],
    },
}

CORS_ALLOWED_ORIGINS = [
    o for o in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o
]

# --- Producción (F12): detrás de Caddy, que termina HTTPS ---
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "same-origin"
if not DEBUG:
    # Solo se apaga para probar el stack de producción por HTTP en la propia máquina.
    SECURE_SSL_REDIRECT = os.getenv("DJANGO_SECURE_SSL_REDIRECT", "1") == "1"
    # El healthcheck del contenedor llega por HTTP directo, sin pasar por Caddy.
    SECURE_REDIRECT_EXEMPT = [r"^api/health/$"]
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    # Un día por omisión: si algo sale mal, el dominio no queda atado a HTTPS por meses.
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "86400"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = False
    # Sin preload a propósito: el dominio (sslip.io) no es nuestro y la lista de precarga es casi permanente.
    SILENCED_SYSTEM_CHECKS = ["security.W021"]
    # Gunicorn corre varios procesos: el conteo de intentos de inicio de sesión va en una caché
    # compartida (tabla en PostgreSQL, la crea entrypoint.sh con createcachetable).
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.db.DatabaseCache", "LOCATION": "sabe_cache"}}
    # La IP del cliente sale de X-Forwarded-For, que pone Caddy (no confía en el que manda el cliente).
    REST_FRAMEWORK["NUM_PROXIES"] = 1

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"consola": {"class": "logging.StreamHandler"}},
    "loggers": {"django": {"handlers": ["consola"], "level": os.getenv("DJANGO_LOG_LEVEL", "WARNING")}},
}
