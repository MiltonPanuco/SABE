from django.db import connection
from django.test.utils import CaptureQueriesContext

from core.models import Bitacora, Rol, Usuario
from core.services import usuarios
from core.services.usuarios import UsuarioInvalido

from .test_solicitudes import ALUMNO, DEMO, BaseSolicitudesTest

URL = "/api/usuarios/"
ADMIN = "admin"
CONTROL = "valeria.ruiz"
DIEGO = "220011456"
MARIANA = {"nombre": "Mariana", "apellidos": "Gómez Torres", "email": "mariana.gomez.t@uan.edu.mx", "rol": "control_escolar"}


class BaseUsuariosTest(BaseSolicitudesTest):
    def setUp(self):
        self.entrar(ADMIN)

    def login(self, username, password):
        return self.client.post("/api/auth/token/", {"username": username, "password": password}, format="json")

    def crear(self, status=201, **cambios):
        r = self.client.post(URL, {**MARIANA, **cambios}, format="json")
        self.assertEqual(r.status_code, status, r.content)
        return r.data

    def cambiar(self, username, status=200, **datos):
        pk = Usuario.objects.get(username=username).pk
        r = self.client.patch(f"{URL}{pk}/", datos, format="json")
        self.assertEqual(r.status_code, status, r.content)
        return r.data

    def reiniciar(self, username, status=200):
        pk = Usuario.objects.get(username=username).pk
        r = self.client.post(f"{URL}{pk}/reiniciar-password/")
        self.assertEqual(r.status_code, status, r.content)
        return r.data


class CrearTests(BaseUsuariosTest):
    def test_crear_personal(self):
        r = self.crear()
        self.assertEqual(
            (r["usuario"]["username"], r["usuario"]["rol"], r["usuario"]["nombre"], r["usuario"]["activo"]),
            ("mariana.gomez.t", "control_escolar", "Mariana", True),
        )
        password = r["password_temporal"]
        self.assertEqual(len(password), 10)
        nueva = Usuario.objects.get(username="mariana.gomez.t")
        self.assertTrue(nueva.debe_cambiar_password)
        self.assertFalse(nueva.is_staff)
        self.assertEqual(
            Bitacora.objects.filter(accion="crear_usuario").get().detalle,
            "Creó la cuenta de Control Escolar de Mariana Gómez Torres.",
        )
        # Entra con la temporal y el sistema le pide cambiarla.
        token = self.login("mariana.gomez.t", password)
        self.assertEqual(token.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.data['access']}")
        self.assertTrue(self.client.get("/api/me/").data["debe_cambiar_password"])

    def test_administrador_entra_al_admin_de_django(self):
        r = self.crear(rol="administrador", email="carmen.salinas@uan.edu.mx")
        self.assertTrue(Usuario.objects.get(pk=r["usuario"]["id"]).is_superuser)

    def test_validaciones(self):
        self.assertEqual(self.crear(status=400, email="mariana@gmail.com")["email"], ["Usa un correo institucional @uan.edu.mx."])
        self.assertEqual(self.crear(status=400, email="valeria.ruiz@uan.edu.mx")["email"], ["Ese correo ya tiene una cuenta."])
        self.assertEqual(self.crear(status=400, email="Admin@uan.edu.mx", nombre="X")["email"], ["Ese correo ya tiene una cuenta."])
        Usuario.objects.create(username="otra.cuenta", email="")
        self.assertEqual(self.crear(status=400, email="otra.cuenta@uan.edu.mx")["email"], ["Ya existe la cuenta otra.cuenta."])
        self.assertIn("rol", self.crear(status=400, rol="estudiante"))
        self.assertIn("apellidos", self.crear(status=400, apellidos=""))


class RolTests(BaseUsuariosTest):
    def test_cambiar_rol_de_personal(self):
        r = self.cambiar(CONTROL, rol="administrador")
        self.assertEqual(r["rol"], "administrador")
        self.assertTrue(Usuario.objects.get(username=CONTROL).is_staff)
        self.assertEqual(
            Bitacora.objects.filter(accion="cambiar_rol_usuario").get().detalle,
            "Cambió el rol de Valeria M. Ruiz a Administrador.",
        )
        self.assertEqual(self.cambiar(CONTROL, rol="control_escolar")["rol"], "control_escolar")

    def test_estudiante_y_propio_rol(self):
        self.assertEqual(
            self.cambiar(ALUMNO, status=400, rol="control_escolar")["rol"],
            ["El rol de un estudiante lo gestiona Control Escolar."],
        )
        self.assertEqual(self.cambiar(CONTROL, status=400, rol="estudiante")["rol"], ["El rol de un estudiante lo gestiona Control Escolar."])
        self.assertEqual(self.cambiar(ADMIN, status=400, rol="control_escolar")["rol"], ["No puedes cambiar tu propio rol."])
        self.assertIn("non_field_errors", self.cambiar(CONTROL, status=400, rol="administrador", activo=False))

    def test_queda_al_menos_un_administrador(self):
        # Dos administradores se quitan el rol a la vez: el segundo ya no es administrador cuando llega.
        admin = Usuario.objects.get(username=ADMIN)
        otro = Usuario.objects.get(username=CONTROL)
        with self.assertRaises(UsuarioInvalido) as error:
            usuarios.cambiar_rol(admin, "control_escolar", otro)
        self.assertEqual(error.exception.datos, {"rol": ["Debe quedar al menos un administrador activo."]})
        with self.assertRaises(UsuarioInvalido):
            usuarios.cambiar_estado(admin, False, otro)


class EstadoTests(BaseUsuariosTest):
    def test_desactivar_y_activar(self):
        self.entrar(DIEGO)
        token_viejo = self.client._credentials["HTTP_AUTHORIZATION"]
        self.entrar(ADMIN)
        r = self.cambiar(DIEGO, activo=False)
        self.assertFalse(r["activo"])
        self.assertEqual(self.login(DIEGO, DEMO).status_code, 401)
        self.client.credentials(HTTP_AUTHORIZATION=token_viejo)
        self.assertEqual(self.client.get("/api/me/").status_code, 401)  # la sesión abierta deja de servir

        self.entrar(ADMIN)
        self.cambiar(DIEGO, activo=True)
        self.assertEqual(self.login(DIEGO, DEMO).status_code, 200)
        self.assertEqual(
            list(Bitacora.objects.filter(accion__in=["desactivar_usuario", "activar_usuario"]).order_by("id").values_list("detalle", flat=True)),
            ["Desactivó la cuenta de Diego Armando Solís Nuño (220011456).", "Activó la cuenta de Diego Armando Solís Nuño (220011456)."],
        )

    def test_no_se_desactiva_a_si_mismo(self):
        self.assertEqual(self.cambiar(ADMIN, status=400, activo=False)["activo"], ["No puedes desactivar tu propia cuenta."])


class PasswordTests(BaseUsuariosTest):
    def test_admin_reinicia(self):
        password = self.reiniciar(ALUMNO)["password_temporal"]
        self.assertEqual(self.login(ALUMNO, DEMO).status_code, 401)
        r = self.login(ALUMNO, password)
        self.assertEqual(r.status_code, 200)
        self.assertTrue(Usuario.objects.get(username=ALUMNO).debe_cambiar_password)
        self.assertEqual(
            Bitacora.objects.filter(accion="reiniciar_password_usuario").get().detalle,
            "Restableció la contraseña de Carlos E. Pérez Villa (210089334).",
        )

    def test_control_escolar_desde_el_folio(self):
        self.entrar()
        folio = self.enviar(("EC601", "BAJA"))
        ruta = f"/api/solicitudes/{folio['id']}/reiniciar-password/"
        self.assertEqual(self.client.post(ruta).status_code, 403)  # el alumno no
        self.entrar(CONTROL)
        r = self.client.post(ruta)
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(self.login(ALUMNO, r.data["password_temporal"]).status_code, 200)
        self.assertEqual(Bitacora.objects.filter(accion="reiniciar_password_usuario").get().usuario.username, CONTROL)
        # Control escolar no entra a Usuarios y Roles.
        self.assertEqual(self.client.get(URL).status_code, 403)


class ListaTests(BaseUsuariosTest):
    def lista(self, consulta=""):
        r = self.client.get(f"{URL}{consulta}")
        self.assertEqual(r.status_code, 200, r.content)
        return r.data

    def test_lista_y_conteos(self):
        r = self.lista()
        self.assertEqual(
            r["conteos"],
            {"todos": 8, "estudiantes": 5, "estudiantes_activos": 5, "control_escolar": 2, "administradores": 1},
        )
        self.assertEqual(
            [(u["username"], u["rol"]) for u in r["resultados"][:3]],
            [("admin", "administrador"), ("roberto.pena", "control_escolar"), ("valeria.ruiz", "control_escolar")],
        )
        yo = r["resultados"][0]
        self.assertTrue(yo["es_yo"])
        self.assertIsNotNone(yo["ultimo_acceso"])  # el login de setUp lo actualizó
        self.assertEqual((yo["origen"], yo["ip"]), ("Panel de administración", "127.0.0.1"))
        carlos = next(u for u in r["resultados"] if u["username"] == ALUMNO)
        self.assertEqual((carlos["matricula"], carlos["programa"]), (ALUMNO, "Economía"))

    def test_filtros_y_paginas(self):
        self.assertEqual(self.lista("?rol=control_escolar")["total"], 2)
        self.cambiar(DIEGO, activo=False)
        self.assertEqual([u["username"] for u in self.lista("?estado=inactivos")["resultados"]], [DIEGO])
        self.assertEqual(self.lista("?q=210089")["total"], 1)
        self.assertEqual(self.lista("?q=uan.edu.mx")["total"], 8)
        Usuario.objects.bulk_create(Usuario(username=f"extra{i}", rol=Rol.CONTROL_ESCOLAR) for i in range(15))
        r = self.lista()
        self.assertEqual((r["total"], r["paginas"], len(r["resultados"])), (23, 2, 20))
        self.assertEqual(len(self.lista("?pagina=2")["resultados"]), 3)

    def test_csv(self):
        r = self.client.get(f"{URL}exportar/?rol=administrador")
        self.assertEqual(r["Content-Disposition"], 'attachment; filename="usuarios_sabe_2026A.csv"')
        lineas = r.content.decode("utf-8").split("\r\n")
        self.assertEqual(lineas[0], "﻿Nombre,Usuario,Correo,Rol,Estado,Ultimo acceso")
        self.assertTrue(lineas[1].startswith("Administrador SABE,admin,admin@uan.edu.mx,Administrador,Activo,"))

    def test_permisos(self):
        self.assertEqual(self.client.delete(f"{URL}{Usuario.objects.get(username=DIEGO).pk}/").status_code, 405)
        for usuario in (CONTROL, ALUMNO):
            self.entrar(usuario)
            self.assertEqual(self.client.get(URL).status_code, 403)

    def test_consultas_no_crecen(self):
        def contar():
            with CaptureQueriesContext(connection) as consultas:
                self.lista()
            return len(consultas)

        antes = contar()
        Usuario.objects.bulk_create(Usuario(username=f"extra{i}", rol=Rol.CONTROL_ESCOLAR) for i in range(12))
        self.assertEqual(contar(), antes)
