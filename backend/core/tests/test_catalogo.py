from datetime import time
from io import StringIO

from django.core.management import call_command
from django.db import connection
from django.test import override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from core.models import (
    DetalleSolicitud,
    Estudiante,
    Grupo,
    HorarioGrupo,
    PeriodoEscolar,
    Solicitud,
)

DEMO = "demo1234"
ALUMNO = "210089334"


@override_settings(DEBUG=True)
class BaseCatalogoTest(APITestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", stdout=StringIO())
        cls.periodo = PeriodoEscolar.objects.get(activo=True)

    def entrar(self, username=ALUMNO):
        r = self.client.post("/api/auth/token/", {"username": username, "password": DEMO}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")

    def grupo(self, clave):
        # El grupo del seed (los que crean las pruebas usan números más altos).
        return Grupo.objects.filter(materia__clave=clave, periodo=self.periodo).order_by("num_grupo").first()

    def catalogo(self, **params):
        r = self.client.get("/api/grupos/", params)
        self.assertEqual(r.status_code, 200, r.content)
        return {g["materia"]["clave"]: g for g in r.data}


class PeriodoActivoTests(BaseCatalogoTest):
    def test_devuelve_el_periodo_activo(self):
        self.entrar()
        r = self.client.get("/api/periodos/activo/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["ciclo"], "2026-A")
        self.assertTrue(r.data["convocatoria_abierta"])
        self.assertIn("convocatoria_inicio", r.data)
        self.assertIn("convocatoria_fin", r.data)

    def test_sin_periodo_activo_es_404(self):
        PeriodoEscolar.objects.update(activo=False)
        self.entrar()
        r = self.client.get("/api/periodos/activo/")
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.data["detail"], "No hay un periodo activo.")

    def test_requiere_sesion(self):
        self.assertEqual(self.client.get("/api/periodos/activo/").status_code, 401)


class CatalogoTests(BaseCatalogoTest):
    def test_forma_del_grupo(self):
        self.entrar()
        g = self.catalogo()["EC605"]
        self.assertEqual(g["materia"], {"clave": "EC605", "nombre": "Econometría II", "creditos": 8})
        self.assertEqual(g["num_grupo"], "02")
        self.assertEqual(g["docente"], "Dr. Hugo Valdez Miranda")
        self.assertEqual(g["turno"], "matutino")
        self.assertEqual((g["cupo_maximo"], g["cupo_disponible"]), (8, 8))
        self.assertEqual(
            g["horarios"],
            [
                {"dia_semana": 2, "hora_inicio": "11:00:00", "hora_fin": "13:00:00", "aula": "E-201"},
                {"dia_semana": 4, "hora_inicio": "11:00:00", "hora_fin": "13:00:00", "aula": "E-201"},
            ],
        )
        self.assertEqual(g["choques"], [])
        self.assertEqual(g["errores"], [])

    def test_grupo_lleno_sin_cupo(self):
        self.entrar()
        self.assertEqual(self.catalogo()["EC504"]["cupo_disponible"], 0)

    def test_cupo_cuenta_solo_inscritos(self):
        carga = self.grupo("EC504").cargas.first()
        carga.estado = "baja"
        carga.save(update_fields=["estado"])
        self.entrar()
        self.assertEqual(self.catalogo()["EC504"]["cupo_disponible"], 1)

    def test_choque_con_detalle(self):
        self.entrar()
        [choque] = self.catalogo()["EC606"]["choques"]
        self.assertEqual(
            choque,
            {
                "grupo": self.grupo("EC601").pk,
                "materia": "Macroeconomía III",
                "num_grupo": "01",
                "dias": [1, 3],
                "hora_inicio": "07:00:00",
                "hora_fin": "09:00:00",
                "origen": "inscrita",
            },
        )

    def test_solo_grupos_visibles_del_periodo_activo(self):
        Grupo.objects.filter(pk=self.grupo("EC704").pk).update(visible=False)
        self.entrar()
        claves = self.catalogo().keys()
        self.assertNotIn("EC704", claves)
        self.assertIn("EC605", claves)

        PeriodoEscolar.objects.update(activo=False)
        self.assertEqual(self.client.get("/api/grupos/").data, [])

    def test_alumno_ve_su_programa_por_defecto(self):
        self.entrar()
        self.assertNotIn("FI702", self.catalogo())
        self.assertIn("FI702", self.catalogo(programa="Finanzas"))

    def test_alumno_de_finanzas_ve_finanzas(self):
        self.entrar("200045129")
        self.assertEqual(list(self.catalogo()), ["FI702"])

    def test_busqueda(self):
        self.entrar()
        self.assertEqual(list(self.catalogo(q="econometria")), [])  # icontains no ignora acentos
        self.assertEqual(list(self.catalogo(q="Econometría")), ["EC605"])
        self.assertEqual(list(self.catalogo(q="ec70")), ["EC701", "EC704"])
        self.assertEqual(list(self.catalogo(q="Lorena")), ["EC701"])

    def test_filtros_turno_y_materia(self):
        self.entrar()
        self.assertEqual(list(self.catalogo(turno="vespertino")), ["EC704"])
        self.assertEqual(list(self.catalogo(materia="ec601")), ["EC601"])

    def test_control_escolar_ve_todo_sin_choques(self):
        self.entrar("valeria.ruiz")
        grupos = self.catalogo()
        self.assertIn("FI702", grupos)
        self.assertEqual(grupos["EC606"]["choques"], [])
        self.assertEqual(grupos["EC504"]["errores"], [])

    def test_detalle_de_un_grupo(self):
        self.entrar()
        r = self.client.get(f"/api/grupos/{self.grupo('EC606').pk}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data["choques"]), 1)

    def test_numero_de_consultas_no_crece_con_los_grupos(self):
        self.entrar()
        with CaptureQueriesContext(connection) as antes:
            self.catalogo()

        base = self.grupo("EC605")
        for i in range(10):
            g = Grupo.objects.create(
                materia=base.materia, docente=base.docente, periodo=self.periodo,
                num_grupo=f"9{i}", turno="matutino", cupo_maximo=20,
            )
            HorarioGrupo.objects.create(grupo=g, dia_semana=1, hora_inicio=time(7), hora_fin=time(9))

        with CaptureQueriesContext(connection) as despues:
            r = self.client.get("/api/grupos/")
        self.assertEqual(len(r.data), 19)
        self.assertEqual(len(despues), len(antes))

    def test_requiere_sesion(self):
        self.assertEqual(self.client.get("/api/grupos/").status_code, 401)

    def test_solo_lectura(self):
        self.entrar("valeria.ruiz")
        self.assertEqual(self.client.post("/api/grupos/", {}, format="json").status_code, 405)


class CatalogoConCarritoTests(BaseCatalogoTest):
    """El catálogo calcula choques y errores como si el carrito (?altas=&bajas=) ya se hubiera pedido."""

    def nuevo_grupo(self, clave, num, dia, inicio, fin, materia=None):
        base = self.grupo(clave)
        g = Grupo.objects.create(
            materia=materia or base.materia, docente=base.docente, periodo=self.periodo,
            num_grupo=num, turno="matutino", cupo_maximo=20,
        )
        HorarioGrupo.objects.create(grupo=g, dia_semana=dia, hora_inicio=time(inicio), hora_fin=time(fin))
        return g

    def test_baja_en_el_carrito_libera_el_horario(self):
        self.entrar()
        self.assertEqual(self.catalogo(bajas=self.grupo("EC601").pk)["EC606"]["choques"], [])

    def test_alta_en_el_carrito_choca(self):
        # Otra materia el martes 11-12: choca con EC605 (mar y jue 11-13) si está en el carrito.
        otra = self.nuevo_grupo("EC701", "05", HorarioGrupo.Dia.MARTES, 11, 12)
        self.entrar()
        ec605 = self.grupo("EC605").pk
        grupos = self.client.get("/api/grupos/", {"altas": f"{ec605}"}).data
        [nuevo] = [g for g in grupos if g["id"] == otra.pk]
        [choque] = nuevo["choques"]
        self.assertEqual((choque["grupo"], choque["origen"], choque["dias"]), (ec605, "carrito", [2]))
        # El grupo del carrito no choca consigo mismo.
        [propio] = [g for g in grupos if g["id"] == ec605]
        self.assertEqual(propio["choques"], [])

    def test_otro_grupo_de_una_materia_inscrita(self):
        otro = self.nuevo_grupo("EC601", "02", HorarioGrupo.Dia.SABADO, 7, 9)
        self.entrar()
        [g] = [g for g in self.client.get("/api/grupos/").data if g["id"] == otro.pk]
        self.assertEqual([e["codigo"] for e in g["errores"]], ["misma_materia"])
        self.assertIn("Agrega su baja", g["errores"][0]["detalle"])
        # Con la baja del grupo actual en el carrito ya se puede pedir.
        r = self.client.get("/api/grupos/", {"bajas": self.grupo("EC601").pk})
        [g] = [g for g in r.data if g["id"] == otro.pk]
        self.assertEqual(g["errores"], [])

    def test_grupo_lleno_trae_error_sin_cupo(self):
        self.entrar()
        self.assertEqual([e["codigo"] for e in self.catalogo()["EC504"]["errores"]], ["sin_cupo"])

    def test_carrito_invalido_es_400(self):
        self.entrar()
        r = self.client.get("/api/grupos/", {"altas": "1,x"})
        self.assertEqual(r.status_code, 400)
        self.assertIn("altas", r.data)

    def test_numero_de_consultas_con_carrito_no_crece(self):
        self.entrar()
        carrito = {"altas": self.grupo("EC605").pk, "bajas": self.grupo("EC601").pk}
        with CaptureQueriesContext(connection) as antes:
            self.client.get("/api/grupos/", carrito)
        for i in range(5):
            self.nuevo_grupo("EC605", f"9{i}", HorarioGrupo.Dia.LUNES, 7, 9)
        carrito["altas"] = ",".join(str(g.pk) for g in Grupo.objects.filter(materia__clave="EC605"))
        with CaptureQueriesContext(connection) as despues:
            r = self.client.get("/api/grupos/", carrito)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(despues), len(antes))


class HorarioEstudianteTests(BaseCatalogoTest):
    def setUp(self):
        self.alumno = Estudiante.objects.get(matricula=ALUMNO)

    def folio(self, numero, movimientos):
        solicitud = Solicitud.objects.create(
            folio_digital=f"SABE-2026-{numero:03d}", estudiante=self.alumno, periodo=self.periodo
        )
        for clave, tipo, estado in movimientos:
            extra = {"motivo_rechazo": "Sin cupo"} if estado == "rechazada" else {}
            DetalleSolicitud.objects.create(
                solicitud=solicitud, grupo=self.grupo(clave), tipo_tramite=tipo, estado=estado, **extra
            )
        return solicitud

    def test_inscritas(self):
        self.entrar()
        r = self.client.get("/api/estudiante/horario/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["ciclo"], "2026-A")
        self.assertEqual([g["materia"]["clave"] for g in r.data["inscritas"]], ["EC601", "EC602", "EC603", "EC604"])
        ec601 = r.data["inscritas"][0]
        self.assertEqual(ec601["cupo_disponible"], 29)  # cuenta a todos los inscritos, no solo a este alumno
        self.assertEqual(r.data["en_tramite"], [])

    def test_grupo_oculto_sigue_en_mi_horario(self):
        Grupo.objects.filter(pk=self.grupo("EC604").pk).update(visible=False)
        self.entrar()
        r = self.client.get("/api/estudiante/horario/")
        self.assertIn("EC604", [g["materia"]["clave"] for g in r.data["inscritas"]])

    def test_en_tramite_solo_pendientes(self):
        self.folio(1, [("EC605", "ALTA", "pendiente"), ("EC602", "BAJA", "pendiente")])
        self.folio(2, [("EC701", "ALTA", "rechazada"), ("EC704", "ALTA", "cancelada")])
        self.entrar()
        r = self.client.get("/api/estudiante/horario/")
        tramite = [(m["grupo"]["materia"]["clave"], m["tipo_tramite"], m["folio"]) for m in r.data["en_tramite"]]
        self.assertEqual(tramite, [("EC605", "ALTA", "SABE-2026-001"), ("EC602", "BAJA", "SABE-2026-001")])
        self.assertEqual(r.data["en_tramite"][0]["grupo"]["cupo_disponible"], 8)

    def test_no_ve_tramites_de_otros(self):
        otro = Estudiante.objects.get(matricula="220011456")
        solicitud = Solicitud.objects.create(folio_digital="SABE-2026-050", estudiante=otro, periodo=self.periodo)
        DetalleSolicitud.objects.create(solicitud=solicitud, grupo=self.grupo("EC605"), tipo_tramite="ALTA")
        self.entrar()
        self.assertEqual(self.client.get("/api/estudiante/horario/").data["en_tramite"], [])

    def test_sin_periodo_activo(self):
        PeriodoEscolar.objects.update(activo=False)
        self.entrar()
        r = self.client.get("/api/estudiante/horario/")
        self.assertEqual(r.data, {"ciclo": None, "inscritas": [], "en_tramite": []})

    def test_solo_estudiantes(self):
        self.entrar("valeria.ruiz")
        self.assertEqual(self.client.get("/api/estudiante/horario/").status_code, 403)
        self.client.credentials()
        self.assertEqual(self.client.get("/api/estudiante/horario/").status_code, 401)
