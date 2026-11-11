"""F12: settings de producción, límite de intentos de inicio de sesión y contraseña del admin."""

import os
import secrets
import subprocess
import sys
from io import StringIO
from pathlib import Path
from unittest import mock

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.throttling import ScopedRateThrottle

from core.models import Usuario

BACKEND = Path(__file__).resolve().parents[2]
PRODUCCION = {
    "DJANGO_DEBUG": "0",
    "DJANGO_ALLOWED_HOSTS": "sabe.example",
    "CSRF_TRUSTED_ORIGINS": "https://sabe.example",
}


def manage(*args, **entorno):
    """Corre manage.py en otro proceso con las variables dadas (los settings se leen al arrancar)."""
    env = {k: v for k, v in os.environ.items() if not k.startswith(("DJANGO_", "CSRF_"))}
    env.update(entorno)
    return subprocess.run(
        [sys.executable, "manage.py", *args], cwd=BACKEND, env=env, capture_output=True, text=True, timeout=120
    )


class SettingsProduccionTests(TestCase):
    def test_sin_clave_propia_no_arranca(self):
        r = manage("check", **PRODUCCION, DJANGO_SECRET_KEY="corta")
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY debe ser una clave propia", r.stderr)

    def test_check_deploy_sin_advertencias(self):
        r = manage("check", "--deploy", "--fail-level", "WARNING", **PRODUCCION, DJANGO_SECRET_KEY=secrets.token_urlsafe(50))
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_valores_de_produccion(self):
        codigo = (
            "from django.conf import settings as s;"
            "print(s.SESSION_COOKIE_SECURE, s.CSRF_COOKIE_SECURE, s.SECURE_SSL_REDIRECT, s.SECURE_HSTS_SECONDS,"
            " s.SECURE_PROXY_SSL_HEADER[0], s.CSRF_TRUSTED_ORIGINS[0], s.STORAGES['staticfiles']['BACKEND'].split('.')[-1],"
            " s.CACHES['default']['BACKEND'].split('.')[-1], s.REST_FRAMEWORK['NUM_PROXIES'])"
        )
        r = manage("shell", "-c", codigo, **PRODUCCION, DJANGO_SECRET_KEY=secrets.token_urlsafe(50))
        # Caché compartida entre los procesos de Gunicorn: si no, el límite de intentos se reparte entre ellos.
        self.assertEqual(
            r.stdout.split()[-9:],
            ["True", "True", "True", "86400", "HTTP_X_FORWARDED_PROTO", "https://sabe.example",
             "CompressedManifestStaticFilesStorage", "DatabaseCache", "1"],
            r.stderr,
        )


@override_settings(DEBUG=True)
class LimiteDeInicioTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_once_intentos_en_un_minuto(self):
        with mock.patch.dict(ScopedRateThrottle.THROTTLE_RATES, {"login": "10/min"}):
            codigos = [
                self.client.post("/api/auth/token/", {"username": "nadie", "password": "x"}).status_code
                for _ in range(11)
            ]
        self.assertEqual(codigos[:10], [401] * 10)
        self.assertEqual(codigos[10], 429)


@override_settings(DEBUG=True)
class PasswordAdminTests(TestCase):
    def test_seed_demo_usa_la_del_entorno(self):
        with mock.patch.dict(os.environ, {"SABE_ADMIN_PASSWORD": "Una-Clave-Larga-De-Prueba-123"}):
            salida = StringIO()
            call_command("seed_demo", "--sin-folios", stdout=salida)
        admin = Usuario.objects.get(username="admin")
        self.assertTrue(admin.check_password("Una-Clave-Larga-De-Prueba-123"))
        self.assertFalse(admin.check_password("demo1234"))
        self.assertIn("admin / (SABE_ADMIN_PASSWORD)", salida.getvalue())
        self.assertTrue(Usuario.objects.get(username="valeria.ruiz").check_password("demo1234"))
