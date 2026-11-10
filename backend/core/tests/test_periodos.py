from datetime import timedelta

from django.utils import timezone

from core.models import Bitacora, DetalleSolicitud, PeriodoEscolar

from .test_solicitudes import BaseSolicitudesTest

URL = "/api/periodos/"
CONTROL = "valeria.ruiz"
NUEVO = {
    "ciclo": "2026-B",
    "fecha_inicio": "2027-01-25",
    "fecha_fin": "2027-06-25",
    "convocatoria_inicio": "2027-02-08T08:00:00-07:00",
    "convocatoria_fin": "2027-02-12T23:59:00-07:00",
}


class BasePeriodosTest(BaseSolicitudesTest):
    def setUp(self):
        self.entrar(CONTROL)

    def crear(self, status=201, **cambios):
        r = self.client.post(URL, {**NUEVO, **cambios}, format="json")
        self.assertEqual(r.status_code, status, r.content)
        return r.data

    def activar(self, periodo_id, status=200):
        r = self.client.post(f"{URL}{periodo_id}/activar/")
        self.assertEqual(r.status_code, status, r.content)
        return r.data


class ListadoTests(BasePeriodosTest):
    def test_lista_con_el_activo_primero(self):
        r = self.client.get(URL)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(
            [(p["ciclo"], p["activo"]) for p in r.data],
            [("2026-A", True), ("2025-B", False), ("2025-A", False), ("2024-B", False)],
        )
        activo = r.data[0]
        self.assertEqual((activo["estado_convocatoria"], activo["movimientos_pendientes"]), ("abierta", 0))
        self.assertEqual(r.data[1]["estado_convocatoria"], "cerrada")

    def test_convocatoria_programada(self):
        self.mover_convocatoria(2, 5)
        self.assertEqual(self.client.get(URL).data[0]["estado_convocatoria"], "programada")

    def test_cuenta_movimientos_pendientes(self):
        self.entrar()
        self.enviar(("EC601", "BAJA"), ("EC606", "ALTA"))
        self.entrar(CONTROL)
        self.assertEqual(self.client.get(URL).data[0]["movimientos_pendientes"], 2)

    def test_ultima_modificacion(self):
        r = self.client.get(f"{URL}ultima-modificacion/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["usuario"], "Valeria M. Ruiz")

        self.entrar("admin")
        self.crear()
        r = self.client.get(f"{URL}ultima-modificacion/")
        self.assertEqual(r.data["usuario"], "Administrador SABE")

    def test_ultima_modificacion_vacia(self):
        Bitacora.objects.all().delete()
        r = self.client.get(f"{URL}ultima-modificacion/")
        self.assertEqual((r.status_code, r.data), (200, None))


class GuardarTests(BasePeriodosTest):
    def test_crear(self):
        r = self.crear()
        self.assertEqual((r["ciclo"], r["activo"], r["estado_convocatoria"]), ("2026-B", False, "programada"))
        self.assertEqual(PeriodoEscolar.objects.get(activo=True).ciclo, "2026-A")
        registro = Bitacora.objects.order_by("-id").first()
        self.assertEqual((registro.accion, registro.entidad), ("crear_periodo", f"PeriodoEscolar #{r['id']} (2026-B)"))
        self.assertEqual(registro.usuario.username, CONTROL)
        self.assertEqual(registro.ip, "127.0.0.1")

    def test_ciclo_en_minusculas_se_normaliza(self):
        self.assertEqual(self.crear(ciclo=" 2026-b ")["ciclo"], "2026-B")

    def test_formato_de_ciclo(self):
        for ciclo in ("2026-C", "26-A", "2026A", ""):
            r = self.crear(status=400, ciclo=ciclo)
            self.assertIn("ciclo", r)
        self.assertEqual(self.crear(status=400, ciclo="2026-C")["ciclo"], ["Formato obligatorio: AAAA-A / AAAA-B"])

    def test_ciclo_repetido(self):
        self.assertEqual(self.crear(status=400, ciclo="2025-B")["ciclo"], ["Ya existe el ciclo 2025-B."])

    def test_fechas_en_orden(self):
        r = self.crear(status=400, fecha_fin=NUEVO["fecha_inicio"], convocatoria_fin=NUEVO["convocatoria_inicio"])
        self.assertEqual(r["fecha_fin"], ["El fin del semestre debe ser posterior a su inicio."])
        self.assertEqual(r["convocatoria_fin"], ["El cierre de la convocatoria debe ser posterior a su apertura."])

    def test_crear_y_activar(self):
        r = self.crear(activar=True)
        self.assertTrue(r["activo"])
        self.assertEqual(PeriodoEscolar.objects.get(activo=True).ciclo, "2026-B")
        self.assertEqual(
            list(Bitacora.objects.order_by("-id").values_list("accion", flat=True)[:2]),
            ["activar_periodo", "crear_periodo"],
        )

    def test_crear_y_activar_con_pendientes_no_guarda_nada(self):
        self.entrar()
        self.enviar(("EC605", "ALTA"))
        self.entrar(CONTROL)
        r = self.crear(status=400, activar=True)
        self.assertIn("Dictamina el movimiento pendiente de 2026-A", r["detail"])
        self.assertFalse(PeriodoEscolar.objects.filter(ciclo="2026-B").exists())

    def test_editar_convocatoria(self):
        fin = timezone.now() + timedelta(days=20)
        r = self.client.patch(f"{URL}{self.periodo.pk}/", {"convocatoria_fin": fin.isoformat()}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.periodo.refresh_from_db()
        self.assertEqual(self.periodo.convocatoria_fin, fin)
        self.assertTrue(r.data["activo"])
        self.assertEqual(Bitacora.objects.order_by("-id").first().accion, "editar_periodo")

    def test_editar_revisa_fechas_contra_las_guardadas(self):
        antes = self.periodo.convocatoria_inicio - timedelta(hours=1)
        r = self.client.patch(f"{URL}{self.periodo.pk}/", {"convocatoria_fin": antes.isoformat()}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("convocatoria_fin", r.data)

    def test_editar_conserva_su_propio_ciclo(self):
        r = self.client.patch(f"{URL}{self.periodo.pk}/", {"ciclo": "2026-A"}, format="json")
        self.assertEqual(r.status_code, 200, r.content)

    def test_no_se_borra_ni_se_reemplaza(self):
        self.assertEqual(self.client.delete(f"{URL}{self.periodo.pk}/").status_code, 405)
        self.assertEqual(self.client.put(f"{URL}{self.periodo.pk}/", NUEVO, format="json").status_code, 405)


class ActivarTests(BasePeriodosTest):
    def test_activar_apaga_el_anterior(self):
        nuevo = self.crear()
        r = self.activar(nuevo["id"])
        self.assertTrue(r["activo"])
        self.assertEqual(list(PeriodoEscolar.objects.filter(activo=True).values_list("ciclo", flat=True)), ["2026-B"])
        self.assertEqual(self.client.get("/api/periodos/activo/").data["ciclo"], "2026-B")

    def test_el_catalogo_sigue_al_periodo_activo(self):
        self.activar(self.crear()["id"])
        self.entrar()
        self.assertEqual(self.client.get("/api/grupos/").data, [])
        self.activar_como_control(self.periodo.pk)
        self.entrar()
        self.assertEqual(len(self.client.get("/api/grupos/").data), 9)

    def activar_como_control(self, periodo_id):
        self.entrar(CONTROL)
        self.activar(periodo_id)

    def test_con_pendientes_no_se_activa(self):
        self.entrar()
        self.enviar(("EC601", "BAJA"), ("EC606", "ALTA"))
        self.entrar(CONTROL)
        nuevo = self.crear()
        r = self.activar(nuevo["id"], status=400)
        self.assertEqual(r["detail"], "Dictamina los 2 movimientos pendientes de 2026-A antes de activar otro periodo.")
        self.assertEqual(PeriodoEscolar.objects.get(activo=True).ciclo, "2026-A")

        DetalleSolicitud.objects.update(estado=DetalleSolicitud.Estado.RECHAZADA, motivo_rechazo="Prueba")
        self.assertTrue(self.activar(nuevo["id"])["activo"])

    def test_activar_el_activo_no_cambia_nada(self):
        antes = Bitacora.objects.count()
        self.assertTrue(self.activar(self.periodo.pk)["activo"])
        self.assertEqual(Bitacora.objects.count(), antes)

    def test_activar_un_periodo_inexistente(self):
        self.activar(99999, status=404)


class PermisosTests(BasePeriodosTest):
    def test_alumno_no_entra(self):
        self.entrar()
        self.assertEqual(self.client.get(URL).status_code, 403)
        self.assertEqual(self.client.post(URL, NUEVO, format="json").status_code, 403)
        self.assertEqual(self.client.post(f"{URL}{self.periodo.pk}/activar/").status_code, 403)

    def test_administrador_administra_periodos(self):
        self.entrar("admin")
        self.assertEqual(self.client.get(URL).status_code, 200)
        self.crear()

    def test_sin_sesion(self):
        self.client.credentials()
        self.assertEqual(self.client.get(URL).status_code, 401)
