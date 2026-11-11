from datetime import timedelta
from io import StringIO
from unittest import mock

from django.core.management import call_command
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from core.models import DetalleSolicitud, Estudiante, Grupo, PeriodoEscolar, Solicitud, Usuario
from core.services import solicitudes as servicio

DEMO = "demo1234"
ALUMNO = "210089334"
URL = "/api/solicitudes/"
JUSTIFICACION = "Cambio de grupo por horario laboral."


@override_settings(DEBUG=True)
class BaseSolicitudesTest(APITestCase):
    """El alumno demo cursa EC601, EC602, EC603 y EC604. EC606 choca con EC601."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", "--sin-folios", stdout=StringIO())
        cls.periodo = PeriodoEscolar.objects.get(activo=True)
        cls.alumno = Estudiante.objects.get(matricula=ALUMNO)

    def setUp(self):
        self.entrar()

    def entrar(self, username=ALUMNO):
        r = self.client.post("/api/auth/token/", {"username": username, "password": DEMO}, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")

    def grupo(self, clave):
        return Grupo.objects.get(materia__clave=clave, periodo=self.periodo)

    def enviar(self, *movimientos, justificacion=JUSTIFICACION, status=201):
        datos = {
            "justificacion": justificacion,
            "movimientos": [{"grupo": self.grupo(c).pk, "tipo": t} for c, t in movimientos],
        }
        r = self.client.post(URL, datos, format="json")
        self.assertEqual(r.status_code, status, r.content)
        return r.data

    def mover_convocatoria(self, inicio_dias, fin_dias):
        ahora = timezone.now()
        PeriodoEscolar.objects.filter(pk=self.periodo.pk).update(
            convocatoria_inicio=ahora + timedelta(days=inicio_dias),
            convocatoria_fin=ahora + timedelta(days=fin_dias),
        )


class CrearSolicitudTests(BaseSolicitudesTest):
    def test_cambio_de_grupo(self):
        r = self.enviar(("EC601", "BAJA"), ("EC606", "ALTA"))
        self.assertEqual(r["folio_digital"], f"SABE-{timezone.localtime().year}-001")
        self.assertEqual((r["estado"], r["extemporanea"], r["ciclo"]), ("pendiente", False, "2026-A"))
        self.assertEqual(r["justificacion"], JUSTIFICACION)
        self.assertEqual(r["estudiante"]["matricula"], ALUMNO)
        self.assertEqual(
            [(m["grupo"]["materia"]["clave"], m["tipo_tramite"], m["estado"]) for m in r["movimientos"]],
            [("EC601", "BAJA", "pendiente"), ("EC606", "ALTA", "pendiente")],
        )
        self.assertEqual(r["resumen"], {"total": 2, "aprobadas": 0, "resueltas": 0})

        horario = self.client.get("/api/estudiante/horario/").data
        self.assertEqual(
            [(m["grupo"]["materia"]["clave"], m["folio"]) for m in horario["en_tramite"]],
            [("EC601", r["folio_digital"]), ("EC606", r["folio_digital"])],
        )

    def test_folios_consecutivos(self):
        anio = timezone.localtime().year
        primero = self.enviar(("EC605", "ALTA"))["folio_digital"]
        segundo = self.enviar(("EC704", "ALTA"))["folio_digital"]
        self.assertEqual((primero, segundo), (f"SABE-{anio}-001", f"SABE-{anio}-002"))

    def test_siguiente_folio_por_anio(self):
        Solicitud.objects.create(folio_digital="SABE-2026-007", estudiante=self.alumno, periodo=self.periodo)
        Solicitud.objects.create(folio_digital="SABE-2025-120", estudiante=self.alumno, periodo=self.periodo)
        self.assertEqual(servicio.siguiente_folio(2026), "SABE-2026-008")
        self.assertEqual(servicio.siguiente_folio(2027), "SABE-2027-001")

    def test_reintenta_si_otro_alumno_tomo_el_folio(self):
        anio = timezone.localtime().year
        Solicitud.objects.create(folio_digital=f"SABE-{anio}-001", estudiante=self.alumno, periodo=self.periodo)
        numeros = iter([f"SABE-{anio}-001", f"SABE-{anio}-002"])
        with mock.patch.object(servicio, "siguiente_folio", side_effect=lambda _anio: next(numeros)):
            r = self.enviar(("EC605", "ALTA"))
        self.assertEqual(r["folio_digital"], f"SABE-{anio}-002")

    def test_movimientos_invalidos_no_crean_nada(self):
        r = self.enviar(("EC606", "ALTA"), status=400)
        self.assertEqual(r["detail"], "Hay movimientos que no se pueden solicitar.")
        self.assertFalse(r["validacion"]["valido"])
        self.assertEqual(len(r["validacion"]["movimientos"][0]["choques"]), 1)
        self.assertFalse(Solicitud.objects.exists())

    def test_entrada_invalida_es_400(self):
        for cuerpo in ({}, {"justificacion": "x", "movimientos": []}):
            r = self.client.post(URL, cuerpo, format="json")
            self.assertEqual(r.status_code, 400, cuerpo)

    def test_justificacion_obligatoria(self):
        for texto in ("", "   "):
            r = self.enviar(("EC605", "ALTA"), justificacion=texto, status=400)
            self.assertEqual(r["justificacion"], ["Debes ingresar una justificación académica antes de enviar."])

    def test_justificacion_maximo_500(self):
        r = self.enviar(("EC605", "ALTA"), justificacion="x" * 501, status=400)
        self.assertIn("500", r["justificacion"][0])
        self.enviar(("EC605", "ALTA"), justificacion="x" * 500)

    def test_antes_de_la_convocatoria_no_se_envia(self):
        self.mover_convocatoria(1, 5)
        r = self.enviar(("EC605", "ALTA"), status=400)
        self.assertEqual(r, {"detail": "La convocatoria aún no abre."})

    def test_extemporanea(self):
        self.mover_convocatoria(-9, -1)
        r = self.enviar(("EC605", "ALTA"), justificacion="x" * 99, status=400)
        self.assertIn("100", r["justificacion"][0])
        r = self.enviar(("EC605", "ALTA"), justificacion="x" * 100)
        self.assertTrue(r["extemporanea"])
        self.assertTrue(Solicitud.objects.get(pk=r["id"]).extemporanea)

    def test_mismo_grupo_en_otro_folio(self):
        folio = self.enviar(("EC605", "ALTA"))["folio_digital"]
        r = self.enviar(("EC605", "ALTA"), status=400)
        [error] = r["validacion"]["movimientos"][0]["errores"]
        self.assertEqual(error["codigo"], "en_otro_folio")
        self.assertEqual(error["detalle"], f"Ya pediste Econometría II grupo 02 en el folio {folio}.")

    def test_baja_ya_pedida_en_otro_folio(self):
        self.enviar(("EC602", "BAJA"))
        r = self.enviar(("EC602", "BAJA"), status=400)
        self.assertEqual([e["codigo"] for e in r["validacion"]["movimientos"][0]["errores"]], ["en_otro_folio"])

    def test_varios_folios_pendientes(self):
        self.enviar(("EC605", "ALTA"))
        self.enviar(("EC601", "BAJA"), ("EC606", "ALTA"))
        self.assertEqual(Solicitud.objects.filter(estudiante=self.alumno).count(), 2)

    def test_solo_estudiantes(self):
        self.entrar("valeria.ruiz")
        self.enviar(("EC605", "ALTA"), status=403)
        self.client.credentials()
        self.enviar(("EC605", "ALTA"), status=401)

    def test_sin_periodo_activo(self):
        grupo = self.grupo("EC605").pk
        PeriodoEscolar.objects.update(activo=False)
        r = self.client.post(URL, {"justificacion": "x", "movimientos": [{"grupo": grupo, "tipo": "ALTA"}]}, format="json")
        self.assertEqual(r.status_code, 404)


class ConsultarSolicitudesTests(BaseSolicitudesTest):
    def folio_de(self, matricula, numero, clave="EC605"):
        estudiante = Estudiante.objects.get(matricula=matricula)
        solicitud = Solicitud.objects.create(
            folio_digital=f"SABE-2026-{numero:03d}", estudiante=estudiante, periodo=self.periodo
        )
        DetalleSolicitud.objects.create(solicitud=solicitud, grupo=self.grupo(clave), tipo_tramite="ALTA")
        return solicitud

    def test_alumno_ve_solo_los_suyos(self):
        propio = self.folio_de(ALUMNO, 1)
        ajeno = self.folio_de("220011456", 2)
        r = self.client.get(URL)
        self.assertEqual([f["folio_digital"] for f in r.data], [propio.folio_digital])
        self.assertEqual(self.client.get(f"{URL}{ajeno.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"{URL}{propio.pk}/").data["folio_digital"], propio.folio_digital)

    def test_mas_reciente_primero(self):
        self.enviar(("EC605", "ALTA"))
        self.enviar(("EC704", "ALTA"))
        self.assertEqual([f["folio_digital"][-3:] for f in self.client.get(URL).data], ["002", "001"])

    def test_control_escolar_ve_todos(self):
        self.folio_de(ALUMNO, 1)
        self.folio_de("220011456", 2)
        self.entrar("valeria.ruiz")
        self.assertEqual(len(self.client.get(URL).data), 2)

    def test_dictamen_en_el_detalle(self):
        solicitud = self.folio_de(ALUMNO, 1)
        revisor = Usuario.objects.get(username="valeria.ruiz")
        solicitud.detalles.update(
            estado="rechazada", motivo_rechazo="Sin cupo", revisado_por=revisor, fecha_resolucion=timezone.now()
        )
        r = self.client.get(f"{URL}{solicitud.pk}/").data
        [m] = r["movimientos"]
        self.assertEqual((m["estado"], m["motivo_rechazo"]), ("rechazada", "Sin cupo"))
        self.assertEqual(m["revisado_por"], revisor.get_full_name())
        self.assertIsNotNone(m["fecha_resolucion"])
        self.assertEqual(r["estado"], "rechazada")
        self.assertEqual(r["resumen"], {"total": 1, "aprobadas": 0, "resueltas": 1})

    def test_numero_de_consultas_no_crece_con_los_folios(self):
        self.folio_de(ALUMNO, 1)
        with CaptureQueriesContext(connection) as uno:
            self.client.get(URL)
        for numero, clave in [(2, "EC701"), (3, "EC704"), (4, "EC504"), (5, "EC606")]:
            self.folio_de(ALUMNO, numero, clave)
        with CaptureQueriesContext(connection) as cinco:
            r = self.client.get(URL)
        self.assertEqual(len(r.data), 5)
        self.assertEqual(len(cinco), len(uno))

    def test_requiere_sesion(self):
        self.client.credentials()
        self.assertEqual(self.client.get(URL).status_code, 401)


class CancelarSolicitudTests(BaseSolicitudesTest):
    def test_cancela_lo_pendiente(self):
        r = self.enviar(("EC601", "BAJA"), ("EC606", "ALTA"))
        baja = DetalleSolicitud.objects.get(solicitud_id=r["id"], tipo_tramite="BAJA")
        baja.estado = "aprobada"
        baja.save(update_fields=["estado"])

        r = self.client.post(f"{URL}{r['id']}/cancelar/")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual([m["estado"] for m in r.data["movimientos"]], ["aprobada", "cancelada"])
        self.assertEqual(self.client.get("/api/estudiante/horario/").data["en_tramite"], [])

        r = self.client.post(f"{URL}{r.data['id']}/cancelar/")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["detail"], "Este folio ya no tiene movimientos pendientes.")

    def test_cancelado_libera_el_grupo_para_otro_folio(self):
        r = self.enviar(("EC605", "ALTA"))
        self.client.post(f"{URL}{r['id']}/cancelar/")
        self.enviar(("EC605", "ALTA"))

    def test_folio_ajeno_es_404(self):
        ajeno = Solicitud.objects.create(
            folio_digital="SABE-2026-050", estudiante=Estudiante.objects.get(matricula="220011456"), periodo=self.periodo
        )
        DetalleSolicitud.objects.create(solicitud=ajeno, grupo=self.grupo("EC605"), tipo_tramite="ALTA")
        self.assertEqual(self.client.post(f"{URL}{ajeno.pk}/cancelar/").status_code, 404)

    def test_control_escolar_no_cancela(self):
        r = self.enviar(("EC605", "ALTA"))
        self.entrar("valeria.ruiz")
        self.assertEqual(self.client.post(f"{URL}{r['id']}/cancelar/").status_code, 403)


@override_settings(DEBUG=True)
class EstadoDelFolioTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", "--sin-folios", stdout=StringIO())

    def test_estado_usa_el_prefetch(self):
        periodo = PeriodoEscolar.objects.get(activo=True)
        alumno = Estudiante.objects.get(matricula=ALUMNO)
        solicitud = Solicitud.objects.create(folio_digital="SABE-2026-001", estudiante=alumno, periodo=periodo)
        for clave, estado in [("EC605", "aprobada"), ("EC704", "pendiente")]:
            DetalleSolicitud.objects.create(
                solicitud=solicitud, grupo=Grupo.objects.get(materia__clave=clave), tipo_tramite="ALTA", estado=estado
            )
        folio = Solicitud.objects.prefetch_related("detalles").get(pk=solicitud.pk)
        with self.assertNumQueries(0):
            self.assertEqual(folio.estado, "pendiente")
