from datetime import time
from io import StringIO

from django.core.management import call_command
from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from core.models import DetalleSolicitud, Estudiante, Grupo, HorarioGrupo, PeriodoEscolar, Solicitud

DEMO = "demo1234"
ALUMNO = "210089334"
URL = "/api/solicitudes/validar/"
D = HorarioGrupo.Dia


@override_settings(DEBUG=True)
class ValidarMovimientosTests(APITestCase):
    """POST /api/solicitudes/validar/. El alumno demo cursa EC601, EC602, EC603 y EC604."""

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
        # El grupo del seed (los que crean las pruebas usan números más altos).
        return Grupo.objects.filter(materia__clave=clave, periodo=self.periodo).order_by("num_grupo").first()

    def nuevo_grupo(self, clave, num, dia, inicio, fin):
        base = self.grupo(clave)
        g = Grupo.objects.create(
            materia=base.materia, docente=base.docente, periodo=self.periodo,
            num_grupo=num, turno="matutino", cupo_maximo=20,
        )
        HorarioGrupo.objects.create(grupo=g, dia_semana=dia, hora_inicio=time(inicio), hora_fin=time(fin))
        return g

    def validar(self, *movimientos, status=200):
        """movimientos: (grupo o clave, tipo)."""
        datos = [
            {"grupo": g if isinstance(g, int) else (g.pk if isinstance(g, Grupo) else self.grupo(g).pk), "tipo": tipo}
            for g, tipo in movimientos
        ]
        r = self.client.post(URL, {"movimientos": datos}, format="json")
        self.assertEqual(r.status_code, status, r.content)
        return r.data

    def codigos(self, resultado):
        return [e["codigo"] for e in resultado["errores"]]

    # --- Válido y choques -------------------------------------------------

    def test_cambio_de_grupo_es_valido(self):
        # D2: la baja de EC601 libera lunes y miércoles de 7 a 9 para EC606.
        r = self.validar(("EC601", "BAJA"), ("EC606", "ALTA"))
        self.assertTrue(r["valido"])
        self.assertEqual(
            [(m["grupo"], m["tipo"], m["choques"], m["errores"]) for m in r["movimientos"]],
            [(self.grupo("EC601").pk, "BAJA", [], []), (self.grupo("EC606").pk, "ALTA", [], [])],
        )

    def test_alta_que_choca_con_la_carga(self):
        r = self.validar(("EC606", "ALTA"))
        self.assertFalse(r["valido"])
        [choque] = r["movimientos"][0]["choques"]
        self.assertEqual(choque["materia"], "Macroeconomía III")
        self.assertEqual((choque["dias"], choque["origen"]), ([1, 3], "inscrita"))

    def test_dos_altas_que_chocan_se_marcan_las_dos(self):
        otra = self.nuevo_grupo("EC701", "05", D.MARTES, 12, 14)  # EC605 es mar y jue 11-13
        r = self.validar(("EC605", "ALTA"), (otra, "ALTA"))
        self.assertFalse(r["valido"])
        ec605, nueva = r["movimientos"]
        self.assertEqual([(c["grupo"], c["origen"]) for c in ec605["choques"]], [(otra.pk, "carrito")])
        self.assertEqual([(c["grupo"], c["origen"]) for c in nueva["choques"]], [(self.grupo("EC605").pk, "carrito")])

    def test_altas_sin_choque(self):
        r = self.validar(("EC605", "ALTA"), ("EC704", "ALTA"))  # 11-13 y 13-15: se tocan
        self.assertTrue(r["valido"])

    def test_alta_pendiente_de_otro_folio_choca(self):
        folio = Solicitud.objects.create(folio_digital="SABE-2026-001", estudiante=self.alumno, periodo=self.periodo)
        DetalleSolicitud.objects.create(solicitud=folio, grupo=self.grupo("EC605"), tipo_tramite="ALTA")
        otra = self.nuevo_grupo("EC701", "05", D.JUEVES, 12, 14)
        [m] = self.validar((otra, "ALTA"))["movimientos"]
        self.assertEqual([c["origen"] for c in m["choques"]], ["en_tramite"])

    # --- Errores ----------------------------------------------------------

    def test_repetido(self):
        r = self.validar(("EC605", "ALTA"), ("EC605", "ALTA"))
        self.assertEqual([self.codigos(m) for m in r["movimientos"]], [["repetido"], ["repetido"]])

    def test_ya_inscrito(self):
        [m] = self.validar(("EC602", "ALTA"))["movimientos"]
        self.assertEqual(self.codigos(m), ["ya_inscrito"])

    def test_no_disponible(self):
        Grupo.objects.filter(pk=self.grupo("EC704").pk).update(visible=False)
        [m] = self.validar(("EC704", "ALTA"))["movimientos"]
        self.assertEqual(self.codigos(m), ["no_disponible"])

    def test_sin_cupo(self):
        [m] = self.validar(("EC504", "ALTA"))["movimientos"]
        self.assertEqual(self.codigos(m), ["sin_cupo"])
        self.assertEqual(m["errores"][0]["detalle"], "Sin cupo disponible.")

    def test_misma_materia_inscrita(self):
        otro = self.nuevo_grupo("EC601", "02", D.SABADO, 7, 9)
        [m] = self.validar((otro, "ALTA"))["movimientos"]
        self.assertEqual(self.codigos(m), ["misma_materia"])
        self.assertEqual(
            m["errores"][0]["detalle"],
            "Ya cursas Macroeconomía III en el grupo 01. Agrega su baja para cambiar de grupo.",
        )
        self.assertTrue(self.validar((self.grupo("EC601"), "BAJA"), (otro, "ALTA"))["valido"])

    def test_misma_materia_dos_veces_en_el_carrito(self):
        otro = self.nuevo_grupo("EC605", "05", D.SABADO, 7, 9)
        r = self.validar(("EC605", "ALTA"), (otro, "ALTA"))
        self.assertEqual([self.codigos(m) for m in r["movimientos"]], [["misma_materia"], ["misma_materia"]])

    def test_misma_materia_en_tramite(self):
        folio = Solicitud.objects.create(folio_digital="SABE-2026-001", estudiante=self.alumno, periodo=self.periodo)
        DetalleSolicitud.objects.create(solicitud=folio, grupo=self.grupo("EC605"), tipo_tramite="ALTA")
        otro = self.nuevo_grupo("EC605", "05", D.SABADO, 7, 9)
        [m] = self.validar((otro, "ALTA"))["movimientos"]
        self.assertEqual(m["errores"][0]["detalle"], "Ya pediste Econometría II en el grupo 02 (en trámite).")

    def test_baja_de_un_grupo_no_inscrito(self):
        [m] = self.validar(("EC605", "BAJA"))["movimientos"]
        self.assertEqual(self.codigos(m), ["no_inscrito"])

    # --- Entrada, permisos y consultas -----------------------------------

    def test_entrada_invalida_es_400(self):
        for cuerpo in ({}, {"movimientos": []}, {"movimientos": [{"grupo": 999999, "tipo": "ALTA"}]},
                       {"movimientos": [{"grupo": self.grupo("EC605").pk, "tipo": "CAMBIO"}]}):
            r = self.client.post(URL, cuerpo, format="json")
            self.assertEqual(r.status_code, 400, cuerpo)
            self.assertIn("movimientos", r.data)
        r = self.client.post(URL, {"movimientos": [{"grupo": 999999, "tipo": "ALTA"}]}, format="json")
        self.assertEqual(r.data["movimientos"], ["No existe el grupo 999999."])

    def test_sin_periodo_activo_es_404(self):
        PeriodoEscolar.objects.update(activo=False)
        self.validar(("EC605", "ALTA"), status=404)

    def test_solo_estudiantes(self):
        self.entrar("valeria.ruiz")
        self.validar(("EC605", "ALTA"), status=403)
        self.client.credentials()
        self.validar(("EC605", "ALTA"), status=401)

    def test_numero_de_consultas_no_crece_con_los_movimientos(self):
        # Grupos buscados antes de contar, para medir solo la petición.
        g = {c: self.grupo(c) for c in ["EC601", "EC602", "EC605", "EC606", "EC701", "EC704"]}
        with CaptureQueriesContext(connection) as dos:
            self.validar((g["EC601"], "BAJA"), (g["EC606"], "ALTA"))
        with CaptureQueriesContext(connection) as seis:
            self.validar(
                (g["EC601"], "BAJA"), (g["EC602"], "BAJA"), (g["EC606"], "ALTA"),
                (g["EC605"], "ALTA"), (g["EC701"], "ALTA"), (g["EC704"], "ALTA"),
            )
        self.assertEqual(len(seis), len(dos))
