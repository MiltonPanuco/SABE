import threading
from datetime import date, time, timedelta
from io import StringIO

from django.core.management import call_command
from django.db import connection
from django.test import TestCase, TransactionTestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from core.models import (
    CargaAcademica,
    DetalleSolicitud,
    Estudiante,
    Grupo,
    HorarioGrupo,
    Notificacion,
    PeriodoEscolar,
    Solicitud,
    Usuario,
)
from core.services.dictamen import DictamenInvalido, aprobar_movimiento

from .test_solicitudes import ALUMNO, DEMO, BaseSolicitudesTest

CONTROL = "valeria.ruiz"
DIEGO = "220011456"
ANDREA = "200045129"
LARGA = "Estuve hospitalizado durante la convocatoria y no pude hacer el trámite a tiempo. Traigo el justificante médico."


class BaseDictamenTest(BaseSolicitudesTest):
    """Folios enviados por el alumno demo (sin los folios de la bandeja de seed_demo)."""

    def folio(self, *movimientos, alumno=ALUMNO, **kwargs):
        self.entrar(alumno)
        datos = self.enviar(*movimientos, **kwargs)
        self.entrar(CONTROL)
        return datos

    def mov(self, folio, clave):
        return next(m["id"] for m in folio["movimientos"] if m["grupo"]["materia"]["clave"] == clave)

    def aprobar(self, movimiento, status=200, **datos):
        r = self.client.post(f"/api/movimientos/{movimiento}/aprobar/", datos, format="json")
        self.assertEqual(r.status_code, status, r.content)
        return r.data

    def rechazar(self, movimiento, motivo, status=200):
        r = self.client.post(f"/api/movimientos/{movimiento}/rechazar/", {"motivo": motivo}, format="json")
        self.assertEqual(r.status_code, status, r.content)
        return r.data

    def carga(self, clave, matricula=ALUMNO):
        return CargaAcademica.objects.filter(estudiante__matricula=matricula, grupo=self.grupo(clave)).first()

    def codigos(self, datos):
        return [e["codigo"] for e in datos.get("errores", [])]


class AprobarTests(BaseDictamenTest):
    def test_aprobar_alta(self):
        libres = self.grupo("EC605").cupo_disponible
        folio = self.folio(("EC605", "ALTA"))
        r = self.aprobar(self.mov(folio, "EC605"))

        movimiento = r["movimientos"][0]
        self.assertEqual((movimiento["estado"], movimiento["revisado_por"]), ("aprobada", "Valeria M. Ruiz"))
        self.assertIsNotNone(movimiento["fecha_resolucion"])
        self.assertEqual((r["estado"], r["estado_bandeja"]), ("aprobada", "dictaminada"))
        carga = self.carga("EC605")
        self.assertEqual((carga.estado, carga.origen), ("inscrito", "solicitud"))
        self.assertEqual(self.grupo("EC605").cupo_disponible, libres - 1)
        aviso = Notificacion.objects.get(usuario__username=ALUMNO)
        self.assertIn("Tu alta de Econometría II (grupo 02)", aviso.mensaje)
        self.assertIn("fue aprobada", aviso.mensaje)

    def test_alta_reactiva_una_baja_anterior(self):
        anterior = CargaAcademica.objects.create(
            estudiante=self.alumno, grupo=self.grupo("EC605"), estado="baja", origen="importacion"
        )
        folio = self.folio(("EC605", "ALTA"))
        self.aprobar(self.mov(folio, "EC605"))
        anterior.refresh_from_db()
        self.assertEqual((anterior.estado, anterior.origen), ("inscrito", "solicitud"))

    def test_aprobar_baja(self):
        libres = self.grupo("EC602").cupo_disponible
        folio = self.folio(("EC602", "BAJA"))
        self.aprobar(self.mov(folio, "EC602"))
        self.assertEqual(self.carga("EC602").estado, "baja")
        self.assertEqual(self.grupo("EC602").cupo_disponible, libres + 1)
        self.assertIn("Tu baja de Finanzas Públicas", Notificacion.objects.get(usuario__username=ALUMNO).mensaje)

    def test_ultimo_cupo(self):
        Grupo.objects.filter(pk=self.grupo("EC605").pk).update(cupo_maximo=1)
        carlos = self.folio(("EC605", "ALTA"))
        diego = self.folio(("EC605", "ALTA"), alumno=DIEGO)
        self.aprobar(self.mov(carlos, "EC605"))
        r = self.aprobar(self.mov(diego, "EC605"), status=400)
        self.assertEqual(r["detail"], "Este movimiento no se puede aprobar.")
        self.assertEqual(self.codigos(r), ["sin_cupo"])
        self.assertIsNone(self.carga("EC605", DIEGO))

    def test_choque_con_la_carga_inscrita(self):
        folio = self.folio(("EC605", "ALTA"))
        # Después de enviar, control escolar le carga FI702 (mar y jue 10 a 12): choca con EC605.
        CargaAcademica.objects.create(estudiante=self.alumno, grupo=self.grupo("FI702"), origen="importacion")
        r = self.aprobar(self.mov(folio, "EC605"), status=400)
        self.assertEqual([c["materia"] for c in r["choques"]], ["Finanzas Corporativas II"])
        self.assertEqual(r["choques"][0]["origen"], "inscrita")
        self.assertIsNone(self.carga("EC605"))

    def test_pendientes_de_otro_folio_no_cuentan(self):
        folio = self.folio(("EC605", "ALTA"))
        otro = Solicitud.objects.create(folio_digital="SABE-2026-900", estudiante=self.alumno, periodo=self.periodo)
        DetalleSolicitud.objects.create(solicitud=otro, grupo=self.grupo("FI702"), tipo_tramite="ALTA")
        self.aprobar(self.mov(folio, "EC605"))

    def test_extemporaneo_requiere_visto_bueno(self):
        self.mover_convocatoria(-9, -1)
        folio = self.folio(("EC605", "ALTA"), justificacion=LARGA)
        self.assertTrue(folio["extemporanea"])
        movimiento = self.mov(folio, "EC605")
        r = self.aprobar(movimiento, status=400)
        self.assertEqual(r["detail"], "Marca el visto bueno de Control Escolar para aprobar un folio extemporáneo.")
        self.aprobar(movimiento, visto_bueno=True)
        self.assertTrue(DetalleSolicitud.objects.get(pk=movimiento).visto_bueno)

    def test_no_se_dictamina_dos_veces(self):
        folio = self.folio(("EC605", "ALTA"), ("EC704", "ALTA"))
        self.aprobar(self.mov(folio, "EC605"))
        self.assertEqual(self.aprobar(self.mov(folio, "EC605"), status=400)["detail"], "Este movimiento ya fue dictaminado.")
        self.rechazar(self.mov(folio, "EC605"), "Otro motivo", status=400)

        self.entrar(ALUMNO)
        self.client.post(f"/api/solicitudes/{folio['id']}/cancelar/")
        self.entrar(CONTROL)
        self.aprobar(self.mov(folio, "EC704"), status=400)


class CambioDeGrupoTests(BaseDictamenTest):
    def test_primero_la_baja(self):
        folio = self.folio(("EC601", "BAJA"), ("EC606", "ALTA"))
        alta, baja = self.mov(folio, "EC606"), self.mov(folio, "EC601")

        revision = self.client.get(f"/api/solicitudes/{folio['id']}/revision/").data["movimientos"]
        por_id = {m["id"]: m for m in revision}
        self.assertEqual((por_id[baja]["choques"], por_id[baja]["errores"]), ([], []))
        self.assertEqual(por_id[alta]["choques"], [])
        self.assertEqual(
            por_id[alta]["errores"],
            [{"codigo": "baja_pendiente", "detalle": "Aprueba primero la baja de Macroeconomía III en este folio."}],
        )

        r = self.aprobar(alta, status=400)
        self.assertEqual((self.codigos(r), r["choques"]), (["baja_pendiente"], []))
        self.aprobar(baja)
        self.aprobar(alta)

        self.entrar(ALUMNO)
        horario = self.client.get("/api/estudiante/horario/").data
        claves = [g["materia"]["clave"] for g in horario["inscritas"]]
        self.assertIn("EC606", claves)
        self.assertNotIn("EC601", claves)

    def test_mismo_materia_otro_grupo(self):
        ec601 = self.grupo("EC601")
        otro = Grupo.objects.create(
            materia=ec601.materia, docente=ec601.docente, periodo=self.periodo, num_grupo="02", cupo_maximo=30
        )
        HorarioGrupo.objects.create(grupo=otro, dia_semana=6, hora_inicio=time(9), hora_fin=time(11))
        self.entrar(ALUMNO)
        r = self.client.post(
            "/api/solicitudes/",
            {
                "justificacion": "Cambio de grupo.",
                "movimientos": [{"grupo": ec601.pk, "tipo": "BAJA"}, {"grupo": otro.pk, "tipo": "ALTA"}],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.entrar(CONTROL)
        alta = next(m["id"] for m in r.data["movimientos"] if m["grupo"]["id"] == otro.pk)
        baja = next(m["id"] for m in r.data["movimientos"] if m["grupo"]["id"] == ec601.pk)
        self.assertEqual(self.codigos(self.aprobar(alta, status=400)), ["baja_pendiente"])
        self.aprobar(baja)
        self.aprobar(alta)

    def test_baja_rechazada_deja_el_alta_bloqueada(self):
        folio = self.folio(("EC601", "BAJA"), ("EC606", "ALTA"))
        self.rechazar(self.mov(folio, "EC601"), "Ya no hay tiempo para el cambio.")
        r = self.aprobar(self.mov(folio, "EC606"), status=400)
        self.assertEqual([c["materia"] for c in r["choques"]], ["Macroeconomía III"])


class RechazarTests(BaseDictamenTest):
    def test_motivo_obligatorio(self):
        folio = self.folio(("EC605", "ALTA"))
        movimiento = self.mov(folio, "EC605")
        for motivo in ["", "   "]:
            with self.subTest(motivo=motivo):
                r = self.rechazar(movimiento, motivo, status=400)
                self.assertEqual(r["motivo"], ["Escribe el motivo para poder rechazar."])
        self.rechazar(movimiento, "x" * 501, status=400)
        self.assertEqual(DetalleSolicitud.objects.get(pk=movimiento).estado, "pendiente")

    def test_rechazar(self):
        folio = self.folio(("EC605", "ALTA"))
        r = self.rechazar(self.mov(folio, "EC605"), "  El grupo no tiene cupo disponible.  ")
        movimiento = r["movimientos"][0]
        self.assertEqual(
            (movimiento["estado"], movimiento["motivo_rechazo"], movimiento["revisado_por"]),
            ("rechazada", "El grupo no tiene cupo disponible.", "Valeria M. Ruiz"),
        )
        self.assertEqual((r["estado"], r["estado_bandeja"]), ("rechazada", "rechazada"))
        self.assertIsNone(self.carga("EC605"))
        aviso = Notificacion.objects.get(usuario__username=ALUMNO).mensaje
        self.assertIn("fue rechazada. Motivo: El grupo no tiene cupo disponible.", aviso)


class PermisosDictamenTests(BaseDictamenTest):
    def test_solo_control_escolar(self):
        folio = self.folio(("EC605", "ALTA"))
        movimiento = self.mov(folio, "EC605")
        for usuario in [ALUMNO, "admin"]:
            with self.subTest(usuario=usuario):
                self.entrar(usuario)
                self.aprobar(movimiento, status=403)
                self.rechazar(movimiento, "No", status=403)
                self.assertEqual(self.client.get(f"/api/solicitudes/{folio['id']}/revision/").status_code, 403)
                self.assertEqual(self.client.get("/api/solicitudes/resumen/").status_code, 403)
        self.entrar(CONTROL)
        self.aprobar(999999, status=404)
        self.client.credentials()
        self.aprobar(movimiento, status=401)


class BandejaTests(BaseDictamenTest):
    """Folios armados a mano, uno por estado de la bandeja."""

    def crear(self, numero, matricula, *movimientos, extemporanea=False, periodo=None):
        folio = Solicitud.objects.create(
            folio_digital=f"SABE-2026-{numero}",
            estudiante=Estudiante.objects.get(matricula=matricula),
            periodo=periodo or self.periodo,
            extemporanea=extemporanea,
            justificacion="Prueba",
        )
        for clave, estado in movimientos:
            DetalleSolicitud.objects.create(
                solicitud=folio,
                grupo=self.grupo(clave),
                tipo_tramite="ALTA",
                estado=estado,
                motivo_rechazo="No" if estado == "rechazada" else "",
            )
        return folio

    def setUp(self):
        super().setUp()
        self.crear("101", ALUMNO, ("EC605", "pendiente"))
        self.crear("102", ALUMNO, ("EC605", "aprobada"), ("EC704", "pendiente"))
        self.crear("103", DIEGO, ("EC605", "aprobada"), ("EC704", "rechazada"))
        self.crear("104", DIEGO, ("EC605", "rechazada"), ("EC704", "cancelada"), extemporanea=True)
        self.crear("105", ANDREA, ("EC605", "cancelada"))
        self.crear("106", ANDREA, ("EC704", "pendiente"), extemporanea=True)
        viejo = PeriodoEscolar.objects.create(
            ciclo="2025-B",
            fecha_inicio=date(2025, 2, 1),
            fecha_fin=date(2025, 6, 30),
            convocatoria_inicio=timezone.now() - timedelta(days=300),
            convocatoria_fin=timezone.now() - timedelta(days=290),
            activo=False,
        )
        self.crear("107", ALUMNO, ("EC605", "pendiente"), periodo=viejo)
        self.entrar(CONTROL)

    def folios(self, consulta=""):
        r = self.client.get(f"/api/solicitudes/{consulta}")
        self.assertEqual(r.status_code, 200, r.content)
        return sorted(f["folio_digital"].removeprefix("SABE-2026-") for f in r.data)

    def test_sin_filtros_oculta_cancelados_y_otros_periodos(self):
        self.assertEqual(self.folios(), ["101", "102", "103", "104", "106"])

    def test_filtro_por_estado(self):
        esperado = {
            "pendiente": ["101", "106"],
            "parcial": ["102"],
            "dictaminada": ["103"],
            "rechazada": ["104"],
            "cancelada": ["105"],
        }
        for estado, folios in esperado.items():
            with self.subTest(estado=estado):
                self.assertEqual(self.folios(f"?estado={estado}"), folios)
        self.assertEqual(self.client.get("/api/solicitudes/?estado=otro").status_code, 400)

    def test_estado_bandeja_coincide_con_el_filtro(self):
        for f in self.client.get("/api/solicitudes/").data:
            with self.subTest(folio=f["folio_digital"]):
                self.assertIn(
                    f["folio_digital"],
                    [x["folio_digital"] for x in self.client.get(f"/api/solicitudes/?estado={f['estado_bandeja']}").data],
                )

    def test_filtro_extemporaneo_y_busqueda(self):
        self.assertEqual(self.folios("?extemporanea=true"), ["104", "106"])
        self.assertEqual(self.folios("?extemporanea=false"), ["101", "102", "103"])
        self.assertEqual(self.folios("?q=SABE-2026-103"), ["103"])
        self.assertEqual(self.folios(f"?q={DIEGO[:5]}"), ["103", "104"])
        self.assertEqual(self.folios("?q=andrea"), ["106"])
        self.assertEqual(self.folios("?q=solís"), ["103", "104"])

    def test_resumen(self):
        r = self.client.get("/api/solicitudes/resumen/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(
            r.data,
            {"folios_pendientes": 3, "movimientos_aprobados": 2, "movimientos_rechazados": 2, "extemporaneos": 2},
        )

    def test_el_alumno_sigue_viendo_todos_los_suyos(self):
        self.entrar(ALUMNO)
        self.assertEqual(self.folios(), ["101", "102", "107"])
        self.assertEqual(self.client.get("/api/solicitudes/?estado=dictaminada").status_code, 200)

    def test_numero_de_consultas_no_crece(self):
        def consultas():
            with CaptureQueriesContext(connection) as capturadas:
                self.client.get("/api/solicitudes/")
            return len(capturadas)

        antes = consultas()
        for numero in range(110, 115):
            self.crear(str(numero), ALUMNO, ("EC605", "pendiente"), ("EC704", "aprobada"))
        self.assertEqual(consultas(), antes)

    def test_revision_con_choque(self):
        folio = self.crear("120", ALUMNO, ("FI702", "pendiente"), ("EC605", "aprobada"))
        r = self.client.get(f"/api/solicitudes/{folio.pk}/revision/")
        self.assertEqual(r.status_code, 200)
        [movimiento] = r.data["movimientos"]
        # FI702 (mar y jue 10 a 12) choca con EC603 inscrita; EC605 aprobada aquí no tiene carga.
        self.assertEqual([c["materia"] for c in movimiento["choques"]], ["Desarrollo Regional"])


@override_settings(DEBUG=True)
class EstadoDelFolioF6Tests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", "--sin-folios", stdout=StringIO())

    def estado(self, *estados):
        periodo = PeriodoEscolar.objects.get(activo=True)
        alumno = Estudiante.objects.get(matricula=ALUMNO)
        folio = Solicitud.objects.create(
            folio_digital=f"SABE-2026-{Solicitud.objects.count() + 500}", estudiante=alumno, periodo=periodo
        )
        for clave, estado in zip(["EC605", "EC704", "EC701"], estados, strict=False):
            DetalleSolicitud.objects.create(
                solicitud=folio,
                grupo=Grupo.objects.get(materia__clave=clave),
                tipo_tramite="ALTA",
                estado=estado,
                motivo_rechazo="No" if estado == "rechazada" else "",
            )
        return folio.estado

    def test_estados(self):
        casos = [
            (("rechazada", "cancelada"), "rechazada"),
            (("aprobada", "rechazada"), "aprobada"),
            (("cargada_sadce", "rechazada"), "cargada_sadce"),
            (("aprobada", "cargada_sadce"), "aprobada"),
            (("cancelada",), "cancelada"),
            (("aprobada", "pendiente"), "pendiente"),
        ]
        for estados, esperado in casos:
            with self.subTest(estados=estados):
                self.assertEqual(self.estado(*estados), esperado)


@override_settings(DEBUG=True)
class BandejaDeDemostracionTests(TestCase):
    """Los folios que deja seed_demo para la demostración de control escolar."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", stdout=StringIO())

    def setUp(self):
        r = self.client.post("/api/auth/token/", {"username": CONTROL, "password": DEMO}, content_type="application/json")
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {r.json()['access']}"}

    def test_bandeja(self):
        folios = self.client.get("/api/solicitudes/", **self.auth).json()
        self.assertEqual(
            [(f["estudiante"]["matricula"], f["estado_bandeja"], f["extemporanea"]) for f in folios],
            [("200078511", "pendiente", True), (ANDREA, "pendiente", False), (DIEGO, "dictaminada", False)],
        )
        self.assertEqual(folios[1]["estudiante"]["semestre"], 7)
        resumen = self.client.get("/api/solicitudes/resumen/", **self.auth).json()
        self.assertEqual(
            resumen,
            {"folios_pendientes": 2, "movimientos_aprobados": 1, "movimientos_rechazados": 0, "extemporaneos": 1},
        )

    def test_andrea_tiene_un_choque(self):
        andrea = Solicitud.objects.get(estudiante__matricula=ANDREA)
        [movimiento] = self.client.get(f"/api/solicitudes/{andrea.pk}/revision/", **self.auth).json()["movimientos"]
        self.assertEqual([c["materia"] for c in movimiento["choques"]], ["Finanzas Corporativas II"])


@override_settings(DEBUG=True)
class AprobacionesSimultaneasTests(TransactionTestCase):
    """Dos personas aprueban a la vez el último lugar de un grupo: solo una lo consigue."""

    def test_no_se_pasa_el_cupo(self):
        call_command("seed_demo", "--sin-folios", stdout=StringIO())
        periodo = PeriodoEscolar.objects.get(activo=True)
        grupo = Grupo.objects.get(materia__clave="EC605", periodo=periodo)
        Grupo.objects.filter(pk=grupo.pk).update(cupo_maximo=1)
        movimientos = []
        for numero, matricula in enumerate([ALUMNO, DIEGO], start=1):
            folio = Solicitud.objects.create(
                folio_digital=f"SABE-2026-{numero:03d}", estudiante=Estudiante.objects.get(matricula=matricula), periodo=periodo
            )
            movimientos.append(DetalleSolicitud.objects.create(solicitud=folio, grupo=grupo, tipo_tramite="ALTA"))
        revisores = list(Usuario.objects.filter(username__in=[CONTROL, "roberto.pena"]))

        barrera = threading.Barrier(2)
        resultados = []

        def aprobar(detalle, revisor):
            try:
                barrera.wait()
                aprobar_movimiento(detalle, revisor)
                resultados.append("aprobada")
            except DictamenInvalido as error:
                resultados.append([str(e.codigo) for e in error.errores])
            finally:
                connection.close()

        hilos = [threading.Thread(target=aprobar, args=par) for par in zip(movimientos, revisores, strict=True)]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join()

        self.assertEqual(sorted(map(str, resultados)), sorted(["aprobada", "['sin_cupo']"]))
        self.assertEqual(CargaAcademica.objects.filter(grupo=grupo, estado="inscrito").count(), 1)
