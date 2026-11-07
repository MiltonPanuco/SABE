from io import StringIO

from django.core.management import call_command
from django.test import override_settings
from rest_framework.test import APIRequestFactory, APITestCase

from core.models import Usuario
from core.permissions import EsAdministrador, EsControlEscolar, EsEstudiante

DEMO = "demo1234"


@override_settings(DEBUG=True)
class BaseAuthTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", stdout=StringIO())

    def entrar(self, username, password=DEMO):
        r = self.client.post("/api/auth/token/", {"username": username, "password": password}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")
        return r.data


class LoginTests(BaseAuthTest):
    def test_login_con_cada_usuario_demo(self):
        for username in ["210089334", "valeria.ruiz", "admin"]:
            with self.subTest(username=username):
                datos = self.entrar(username)
                self.assertIn("refresh", datos)

    def test_password_incorrecta(self):
        r = self.client.post("/api/auth/token/", {"username": "210089334", "password": "mal"}, format="json")
        self.assertEqual(r.status_code, 401)

    def test_usuario_inactivo_no_entra(self):
        Usuario.objects.filter(username="210089334").update(is_active=False)
        r = self.client.post("/api/auth/token/", {"username": "210089334", "password": DEMO}, format="json")
        self.assertEqual(r.status_code, 401)


class MeTests(BaseAuthTest):
    def test_sin_token(self):
        self.assertEqual(self.client.get("/api/me/").status_code, 401)

    def test_estudiante(self):
        self.entrar("210089334")
        r = self.client.get("/api/me/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["rol"], "estudiante")
        self.assertEqual(r.data["nombre"], "Carlos E.")
        self.assertFalse(r.data["debe_cambiar_password"])
        self.assertEqual(
            r.data["estudiante"],
            {"matricula": "210089334", "programa": "Economía", "semestre": 6, "turno": "matutino"},
        )

    def test_personal_sin_perfil_de_estudiante(self):
        self.entrar("valeria.ruiz")
        r = self.client.get("/api/me/")
        self.assertEqual(r.data["rol"], "control_escolar")
        self.assertIsNone(r.data["estudiante"])

    def test_primer_acceso_marca_cambio_obligatorio(self):
        self.entrar("230012345", "temporal")
        self.assertTrue(self.client.get("/api/me/").data["debe_cambiar_password"])


class CambiarPasswordTests(BaseAuthTest):
    url = "/api/auth/cambiar-password/"

    def test_cambio_correcto_quita_la_marca(self):
        self.entrar("230012345", "temporal")
        r = self.client.post(self.url, {"actual": "temporal", "nueva": "Altas.Bajas.2026"}, format="json")
        self.assertEqual(r.status_code, 204)

        mariana = Usuario.objects.get(username="230012345")
        self.assertTrue(mariana.check_password("Altas.Bajas.2026"))
        self.assertFalse(mariana.debe_cambiar_password)

    def test_actual_incorrecta(self):
        self.entrar("230012345", "temporal")
        r = self.client.post(self.url, {"actual": "otra", "nueva": "Altas.Bajas.2026"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("actual", r.data)

    def test_nueva_igual_a_la_actual(self):
        self.entrar("210089334")
        r = self.client.post(self.url, {"actual": DEMO, "nueva": DEMO}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("nueva", r.data)

    def test_nueva_debil(self):
        self.entrar("230012345", "temporal")
        for debil in ["corta", "12345678", "password"]:
            with self.subTest(debil=debil):
                r = self.client.post(self.url, {"actual": "temporal", "nueva": debil}, format="json")
                self.assertEqual(r.status_code, 400)
                self.assertIn("nueva", r.data)
        self.assertTrue(Usuario.objects.get(username="230012345").debe_cambiar_password)

    def test_sin_token(self):
        r = self.client.post(self.url, {"actual": "x", "nueva": "y"}, format="json")
        self.assertEqual(r.status_code, 401)


class PermisosPorRolTests(BaseAuthTest):
    def permite(self, permiso, username):
        request = APIRequestFactory().get("/")
        request.user = Usuario.objects.get(username=username)
        return permiso().has_permission(request, None)

    def test_matriz_de_roles(self):
        esperado = {
            EsEstudiante: {"210089334": True, "valeria.ruiz": False, "admin": False},
            EsControlEscolar: {"210089334": False, "valeria.ruiz": True, "admin": False},
            EsAdministrador: {"210089334": False, "valeria.ruiz": False, "admin": True},
        }
        for permiso, por_usuario in esperado.items():
            for username, permitido in por_usuario.items():
                with self.subTest(permiso=permiso.__name__, username=username):
                    self.assertEqual(self.permite(permiso, username), permitido)

    def test_anonimo_no_pasa(self):
        from django.contrib.auth.models import AnonymousUser

        request = APIRequestFactory().get("/")
        request.user = AnonymousUser()
        for permiso in (EsEstudiante, EsControlEscolar, EsAdministrador):
            self.assertFalse(permiso().has_permission(request, None))
