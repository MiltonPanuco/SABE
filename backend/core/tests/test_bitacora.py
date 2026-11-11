from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from core.models import Bitacora, DetalleSolicitud, Grupo

from .test_solicitudes import ALUMNO, DEMO, BaseSolicitudesTest

URL = "/api/bitacora/"
CONTROL = "valeria.ruiz"


class BaseBitacoraTest(BaseSolicitudesTest):
    def ultimo(self, accion):
        return Bitacora.objects.filter(accion=accion).order_by("-id").first()

    def mov(self, folio, clave):
        return next(m["id"] for m in folio["movimientos"] if m["grupo"]["materia"]["clave"] == clave)


class AccionesTests(BaseBitacoraTest):
    """Cada acción de la lista de PLAN.md (F10) deja su fila con su frase."""

    def test_inicio_de_sesion(self):
        Bitacora.objects.all().delete()
        self.entrar()
        self.entrar(CONTROL)
        self.entrar("admin")
        self.assertEqual(
            list(Bitacora.objects.order_by("id").values_list("usuario__username", "accion", "detalle")),
            [
                (ALUMNO, "iniciar_sesion", "Inicio de sesión desde el portal del estudiante."),
                (CONTROL, "iniciar_sesion", "Inicio de sesión desde la ventanilla de Control Escolar."),
                ("admin", "iniciar_sesion", "Inicio de sesión desde el panel de administración."),
            ],
        )
        self.assertIsNotNone(Bitacora.objects.first().ip)

    def test_contrasena_equivocada_no_se_registra(self):
        Bitacora.objects.all().delete()
        r = self.client.post("/api/auth/token/", {"username": ALUMNO, "password": "mala"}, format="json")
        self.assertEqual(r.status_code, 401)
        self.assertFalse(Bitacora.objects.exists())
        r = self.client.post("/api/auth/token/", {"username": ALUMNO, "password": DEMO}, format="json")
        self.assertIn("access", r.data)

    def test_tramite_completo(self):
        folio = self.enviar(("EC601", "BAJA"), ("EC605", "ALTA"))
        numero = folio["folio_digital"]
        self.assertEqual(
            self.ultimo("enviar_folio").detalle, f"Envió el folio {numero} con 2 movimientos (1 alta, 1 baja)."
        )
        self.entrar(CONTROL)
        self.client.post(f"/api/movimientos/{self.mov(folio, 'EC601')}/aprobar/", {}, format="json")
        self.client.post(
            f"/api/movimientos/{self.mov(folio, 'EC605')}/rechazar/", {"motivo": "Grupo lleno."}, format="json"
        )
        self.assertEqual(
            self.ultimo("aprobar").detalle, f"Aprobó la baja de Macroeconomía III (EC601) del folio {numero}."
        )
        self.assertEqual(
            self.ultimo("rechazar").detalle,
            f"Rechazó la alta de Econometría II (EC605) del folio {numero}. Motivo: Grupo lleno.",
        )
        lote = self.client.post("/api/exportaciones/", {"formato": "xlsx"}, format="json").data
        self.assertEqual(
            self.ultimo("exportar_sadce").detalle, "Generó el Excel LOTE-2026A-001 con 1 movimiento aprobado."
        )
        self.client.post(f"/api/exportaciones/{lote['id']}/marcar-cargado/")
        self.assertEqual(self.ultimo("marcar_cargado").detalle, "Marcó el lote LOTE-2026A-001 como cargado en SADCE.")

    def test_cancelar(self):
        folio = self.enviar(("EC601", "BAJA"))
        self.client.post(f"/api/solicitudes/{folio['id']}/cancelar/")
        self.assertEqual(
            self.ultimo("cancelar_folio").detalle,
            f"Canceló el folio {folio['folio_digital']}: 1 movimiento pendiente cancelado.",
        )

    def test_importar(self):
        self.entrar(CONTROL)
        contenido = "matricula,nombre,apellidos,email,programa,semestre,turno\n240000001,Ana,Ramos,a@uan.edu.mx,L-FIN,4,\n"
        archivo = SimpleUploadedFile("padrón.csv", contenido.encode(), content_type="text/csv")
        self.client.post("/api/importaciones/alumnos/?modo=confirmar", {"archivo": archivo}, format="multipart")
        self.assertEqual(
            self.ultimo("importar_csv").detalle, "Importó padrón.csv: 1 alumno creado, 0 actualizados, 0 filas con error."
        )

    def test_periodo_y_oferta(self):
        self.entrar(CONTROL)
        r = self.client.post(
            "/api/periodos/",
            {
                "ciclo": "2026-B",
                "fecha_inicio": "2027-01-25",
                "fecha_fin": "2027-06-25",
                "convocatoria_inicio": "2027-02-08T08:00:00-07:00",
                "convocatoria_fin": "2027-02-12T23:59:00-07:00",
            },
            format="json",
        )
        self.assertEqual(self.ultimo("crear_periodo").detalle, "Creó el periodo 2026-B.")
        self.client.patch(f"/api/periodos/{r.data['id']}/", {"convocatoria_fin": "2027-02-13T23:59:00-07:00"}, format="json")
        self.assertEqual(
            self.ultimo("editar_periodo").detalle, "Editó las fechas de la convocatoria del periodo 2026-B."
        )
        grupo = Grupo.objects.get(materia__clave="EC704", periodo=self.periodo)
        self.client.patch(f"/api/grupos/{grupo.pk}/", {"visible": False}, format="json")
        self.assertEqual(
            self.ultimo("ocultar_grupo").detalle, "Ocultó del catálogo Economía de la Innovación (EC704), grupo 01."
        )


class ConsultaTests(BaseBitacoraTest):
    def setUp(self):
        Bitacora.objects.all().delete()
        self.entrar()  # 1: acceso del alumno
        self.folio = self.enviar(("EC601", "BAJA"))  # 2: envío
        self.entrar(CONTROL)  # 3: acceso de control escolar
        self.client.post(f"/api/movimientos/{self.mov(self.folio, 'EC601')}/aprobar/", {}, format="json")  # 4

    def lista(self, consulta=""):
        r = self.client.get(f"{URL}{consulta}")
        self.assertEqual(r.status_code, 200, r.content)
        return r.data

    def test_lista(self):
        r = self.lista()
        self.assertEqual((r["total"], r["pagina"], r["paginas"]), (4, 1, 1))
        self.assertEqual(
            [(x["categoria"], x["usuario"], x["rol"]) for x in r["resultados"]],
            [
                ("Dictamen", "Valeria M. Ruiz", "Control Escolar"),
                ("Acceso", "Valeria M. Ruiz", "Control Escolar"),
                ("Dictamen", "Carlos E. Pérez Villa (210089334)", "Estudiante"),
                ("Acceso", "Carlos E. Pérez Villa (210089334)", "Estudiante"),
            ],
        )

    def test_filtros(self):
        self.assertEqual(self.lista("?categoria=Dictamen")["total"], 2)
        self.assertEqual(self.lista("?categoria=Acceso&rol=estudiante")["total"], 1)
        self.assertEqual(self.lista(f"?q={self.folio['folio_digital']}")["total"], 2)
        self.assertEqual(self.lista("?q=pérez")["total"], 2)
        hoy = timezone.localdate()
        self.assertEqual(self.lista(f"?desde={hoy}&hasta={hoy}")["total"], 4)
        self.assertEqual(self.lista(f"?desde={hoy + timedelta(days=1)}")["total"], 0)
        self.assertEqual(self.client.get(f"{URL}?desde=ayer").status_code, 400)

    def test_filas_antiguas_muestran_la_entidad(self):
        Bitacora.objects.create(accion="activar_periodo", entidad="PeriodoEscolar #1 (2026-A)")
        primero = self.lista()["resultados"][0]
        self.assertEqual((primero["usuario"], primero["detalle"]), ("Sistema", "PeriodoEscolar #1 (2026-A)"))

    def test_paginas(self):
        Bitacora.objects.bulk_create(Bitacora(accion="iniciar_sesion", detalle=f"x{i}") for i in range(60))
        r = self.lista()
        self.assertEqual((r["total"], r["paginas"], len(r["resultados"])), (64, 2, 50))
        self.assertEqual(len(self.lista("?pagina=2")["resultados"]), 14)

    def test_csv(self):
        r = self.client.get(f"{URL}exportar/?categoria=Dictamen")
        self.assertEqual(r["Content-Disposition"], 'attachment; filename="bitacora_sabe_2026A.csv"')
        texto = r.content.decode("utf-8")
        self.assertTrue(texto.startswith("﻿Fecha,Usuario,Rol,Accion,Detalle\r\n"))
        lineas = texto.strip().split("\r\n")
        self.assertEqual(len(lineas), 3)
        self.assertIn("Aprobó la baja de Macroeconomía III (EC601)", lineas[1])

    def test_permisos_y_solo_lectura(self):
        self.entrar("admin")
        self.assertEqual(self.client.get(URL).status_code, 200)
        self.assertEqual(self.client.post(URL, {}, format="json").status_code, 405)
        registro = Bitacora.objects.first()
        self.assertEqual(self.client.delete(f"{URL}{registro.pk}/").status_code, 404)
        self.entrar()
        self.assertEqual(self.client.get(URL).status_code, 403)

    def test_consultas_no_crecen(self):
        def contar():
            with CaptureQueriesContext(connection) as consultas:
                self.lista()
            return len(consultas)

        antes = contar()
        Bitacora.objects.bulk_create(Bitacora(accion="aprobar", usuario_id=self.alumno.usuario_id) for _ in range(30))
        self.assertEqual(contar(), antes)
        self.assertEqual(DetalleSolicitud.objects.get(solicitud_id=self.folio["id"]).estado, "aprobada")
