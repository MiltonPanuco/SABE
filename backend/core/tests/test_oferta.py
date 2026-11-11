from django.db import connection
from django.test.utils import CaptureQueriesContext

from core.models import Bitacora, Docente, Grupo, HorarioGrupo, Programa, UnidadAprendizaje

from .test_solicitudes import BaseSolicitudesTest

URL = "/api/grupos/"
CONTROL = "valeria.ruiz"
LUN, MAR, JUE = 1, 2, 4


def horario(dia, inicio, fin):
    return {"dia_semana": dia, "hora_inicio": inicio, "hora_fin": fin}


class BaseOfertaTest(BaseSolicitudesTest):
    def setUp(self):
        self.entrar(CONTROL)
        self.economia = Programa.objects.get(nombre="Economía")
        self.docente = Docente.objects.get(nombre="Mtra. Karla Del Real")

    def datos(self, **cambios):
        return {
            "clave": "EC710",
            "nombre_materia": "Economía Ambiental",
            "programa": self.economia.pk,
            "num_grupo": "01",
            "cupo_maximo": 20,
            "docente": self.docente.pk,
            "horarios": [horario(MAR, "15:00", "17:00"), horario(JUE, "15:00", "17:00")],
            **cambios,
        }

    def publicar(self, status=201, **cambios):
        r = self.client.post(URL, self.datos(**cambios), format="json")
        self.assertEqual(r.status_code, status, r.content)
        return r.data

    def editar(self, grupo_id, datos, status=200):
        r = self.client.patch(f"{URL}{grupo_id}/", datos, format="json")
        self.assertEqual(r.status_code, status, r.content)
        return r.data

    def oferta(self, **filtros):
        r = self.client.get(URL, {"oferta": 1, **filtros})
        self.assertEqual(r.status_code, 200, r.content)
        return [(g["materia"]["clave"], g["num_grupo"]) for g in r.data]

    def ultima_accion(self):
        return Bitacora.objects.order_by("-id").values_list("accion", "entidad").first()


class PublicarTests(BaseOfertaTest):
    def test_publicar_y_el_alumno_lo_ve(self):
        r = self.publicar()
        self.assertEqual(
            (r["materia"]["clave"], r["materia"]["nombre"], r["materia"]["programa"], r["num_grupo"]),
            ("EC710", "Economía Ambiental", "Economía", "01"),
        )
        self.assertEqual((r["docente"], r["cupo_maximo"], r["cupo_disponible"], r["visible"]), ("Mtra. Karla Del Real", 20, 20, True))
        self.assertEqual(
            [(h["dia_semana"], h["hora_inicio"], h["hora_fin"]) for h in r["horarios"]],
            [(MAR, "15:00:00", "17:00:00"), (JUE, "15:00:00", "17:00:00")],
        )
        self.assertEqual(r["turno"], "vespertino")
        self.assertEqual(UnidadAprendizaje.objects.get(clave="EC710").creditos, 8)
        self.assertEqual(self.ultima_accion(), ("publicar_grupo", f"Grupo #{r['id']} (EC710 gpo 01)"))

        self.entrar()
        self.assertIn("EC710", [g["materia"]["clave"] for g in self.client.get("/api/grupos/").data])

    def test_turno_matutino(self):
        r = self.publicar(horarios=[horario(LUN, "08:00", "10:00"), horario(JUE, "13:00", "15:00")])
        self.assertEqual(r["turno"], "matutino")

    def test_clave_existente_reutiliza_la_materia(self):
        materias = UnidadAprendizaje.objects.count()
        r = self.publicar(clave="ec605", nombre_materia="Econometría  II (aplicada)", num_grupo="03")
        self.assertEqual(r["materia"]["clave"], "EC605")
        self.assertEqual(UnidadAprendizaje.objects.count(), materias)
        # El nombre es de la materia: cambia también en el grupo 02.
        grupo_02 = Grupo.objects.get(periodo=self.periodo, materia__clave="EC605", num_grupo="02")
        self.assertEqual(grupo_02.materia.nombre_materia, "Econometría II (aplicada)")

    def test_grupo_repetido(self):
        r = self.publicar(status=400, clave="ec605", num_grupo="02")
        self.assertEqual(r, {"num_grupo": ["Ya existe ese grupo para esa clave."]})

    def test_campos_obligatorios(self):
        r = self.client.post(URL, {}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(
            set(r.data), {"clave", "nombre_materia", "programa", "num_grupo", "cupo_maximo", "docente", "horarios"}
        )

    def test_cupo_mayor_a_cero(self):
        self.assertEqual(self.publicar(status=400, cupo_maximo=0)["cupo_maximo"], ["El cupo máximo debe ser mayor a 0."])

    def test_sin_dias(self):
        self.assertEqual(self.publicar(status=400, horarios=[])["horarios"], ["Agrega al menos un día de clase."])

    def test_hora_de_fin_posterior(self):
        r = self.publicar(status=400, horarios=[horario(MAR, "15:00", "15:00")])
        self.assertEqual(r["horarios"][0]["non_field_errors"], ["La hora de fin debe ser posterior a la de inicio."])

    def test_dos_horarios_del_mismo_dia_que_se_traslapan(self):
        r = self.publicar(status=400, horarios=[horario(MAR, "15:00", "17:00"), horario(MAR, "16:00", "18:00")])
        self.assertEqual(r["horarios"], ["Dos horarios del mismo día se traslapan."])
        # Seguidos en el mismo día sí se puede.
        self.publicar(horarios=[horario(MAR, "15:00", "17:00"), horario(MAR, "17:00", "18:00")])

    def test_sin_periodo_activo(self):
        type(self.periodo).objects.update(activo=False)
        self.assertEqual(self.client.post(URL, self.datos(), format="json").status_code, 404)


class EditarTests(BaseOfertaTest):
    def test_editar_conserva_el_aula_del_mismo_dia(self):
        grupo = self.grupo("EC605")  # Mar y Jue 11 a 13 en E-201
        datos = self.datos(
            clave="EC605", nombre_materia="Econometría II", num_grupo="02", cupo_maximo=10,
            horarios=[horario(MAR, "12:00", "14:00"), horario(LUN, "12:00", "14:00")],
        )
        r = self.editar(grupo.pk, datos)
        self.assertEqual(r["cupo_maximo"], 10)
        self.assertEqual(
            [(h["dia_semana"], h["hora_inicio"], h["aula"]) for h in r["horarios"]],
            [(LUN, "12:00:00", ""), (MAR, "12:00:00", "E-201")],
        )
        self.assertEqual(HorarioGrupo.objects.filter(grupo=grupo).count(), 2)
        self.assertEqual(self.ultima_accion()[0], "editar_grupo")

    def test_cupo_menor_a_los_inscritos(self):
        grupo = self.grupo("EC504")  # 2 inscritos
        datos = self.datos(clave="EC504", nombre_materia="Pensamiento Económico II", cupo_maximo=1)
        r = self.editar(grupo.pk, datos, status=400)
        self.assertEqual(r["cupo_maximo"], ["El cupo máximo no puede ser menor a los alumnos ya inscritos (2)."])

    def test_no_cambia_la_clave_de_un_grupo_con_alumnos(self):
        r = self.editar(self.grupo("EC504").pk, self.datos(clave="EC799"), status=400)
        self.assertIn("No se puede cambiar la clave", r["clave"][0])

    def test_cambia_la_clave_de_un_grupo_nuevo(self):
        nuevo = self.publicar()
        r = self.editar(nuevo["id"], self.datos(clave="EC711", nombre_materia="Economía Circular"))
        self.assertEqual(r["materia"]["clave"], "EC711")

    def test_solo_grupos_del_periodo_activo(self):
        otro = self.periodo.__class__.objects.get(ciclo="2025-B")
        viejo = Grupo.objects.create(
            materia=self.grupo("EC605").materia, docente=self.docente, periodo=otro, num_grupo="09", cupo_maximo=5
        )
        self.editar(viejo.pk, self.datos(), status=404)

    def test_no_se_borra_ni_se_reemplaza(self):
        grupo = self.grupo("EC605")
        self.assertEqual(self.client.delete(f"{URL}{grupo.pk}/").status_code, 405)
        self.assertEqual(self.client.put(f"{URL}{grupo.pk}/", self.datos(), format="json").status_code, 405)


class VisibilidadTests(BaseOfertaTest):
    def test_desactivar_y_activar(self):
        grupo = self.grupo("EC605")
        r = self.editar(grupo.pk, {"visible": False})
        self.assertFalse(r["visible"])
        self.assertEqual(self.ultima_accion(), ("ocultar_grupo", f"Grupo #{grupo.pk} (EC605 gpo 02)"))

        self.entrar()
        self.assertNotIn("EC605", [g["materia"]["clave"] for g in self.client.get("/api/grupos/").data])
        self.assertEqual(self.client.get(f"{URL}{grupo.pk}/").status_code, 404)

        self.entrar(CONTROL)
        self.assertIn(("EC605", "02"), self.oferta())
        self.assertEqual(self.client.get(f"{URL}{grupo.pk}/").status_code, 200)
        self.assertTrue(self.editar(grupo.pk, {"visible": True})["visible"])
        self.assertEqual(self.ultima_accion()[0], "mostrar_grupo")

    def test_sin_cambio_no_se_registra(self):
        antes = Bitacora.objects.count()
        self.editar(self.grupo("EC605").pk, {"visible": True})
        self.assertEqual(Bitacora.objects.count(), antes)

    def test_alta_pendiente_de_un_grupo_oculto_queda_bloqueada(self):
        self.entrar()
        folio = self.enviar(("EC605", "ALTA"))
        self.entrar(CONTROL)
        self.editar(self.grupo("EC605").pk, {"visible": False})
        r = self.client.get(f"/api/solicitudes/{folio['id']}/revision/")
        self.assertIn("no_disponible", [e["codigo"] for e in r.data["movimientos"][0]["errores"]])


class FiltrosOfertaTests(BaseOfertaTest):
    def test_toda_la_oferta_con_ocultos(self):
        self.editar(self.grupo("EC704").pk, {"visible": False})
        claves = self.oferta()
        self.assertEqual(len(claves), 10)
        self.assertIn(("EC704", "01"), claves)
        self.assertEqual(claves, sorted(claves))

    def test_filtros(self):
        self.assertEqual(self.oferta(programa="Finanzas"), [("FI702", "01")])
        self.assertEqual(self.oferta(q="valdez"), [("EC605", "02")])
        self.assertEqual(self.oferta(q="ec70"), [("EC701", "01"), ("EC704", "01")])
        self.assertEqual(self.oferta(cupo="sin"), [("EC504", "01")])
        self.assertEqual(len(self.oferta(cupo="con")), 9)

    def test_cupo_invalido(self):
        self.assertEqual(self.client.get(URL, {"oferta": 1, "cupo": "x"}).status_code, 400)

    def test_consultas_fijas(self):
        with CaptureQueriesContext(connection) as antes:
            self.oferta()
        for i in range(5):
            self.publicar(clave=f"EC8{i}0")
        with CaptureQueriesContext(connection) as despues:
            self.assertEqual(len(self.oferta()), 15)
        self.assertEqual(len(antes), len(despues))


class PermisosOfertaTests(BaseOfertaTest):
    def test_alumno(self):
        self.entrar()
        self.assertEqual(self.client.post(URL, self.datos(), format="json").status_code, 403)
        self.assertEqual(self.client.patch(f"{URL}{self.grupo('EC605').pk}/", {"visible": False}, format="json").status_code, 403)
        self.assertEqual(self.client.get(URL, {"oferta": 1}).status_code, 403)

    def test_administrador(self):
        self.entrar("admin")
        self.assertEqual(self.client.post(URL, self.datos(), format="json").status_code, 403)
        self.assertEqual(self.client.get(URL, {"oferta": 1}).status_code, 403)


class DocentesTests(BaseOfertaTest):
    def test_lista_y_crea(self):
        r = self.client.get("/api/docentes/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 9)
        self.assertIn("Dra. Sofía Barba Ortiz", [d["nombre"] for d in r.data])

        r = self.client.post("/api/docentes/", {"nombre": "  Dr.  Javier Medina ", "grado_academico": "Doctorado"}, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.data["nombre"], "Dr. Javier Medina")
        self.assertEqual(self.ultima_accion(), ("crear_docente", f"Docente #{r.data['id']} (Dr. Javier Medina)"))

    def test_repetido(self):
        r = self.client.post("/api/docentes/", {"nombre": "dra. sofía barba ortiz"}, format="json")
        self.assertEqual((r.status_code, r.data), (400, {"nombre": ["Ya existe ese docente."]}))

    def test_vacio(self):
        r = self.client.post("/api/docentes/", {"nombre": "   "}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_permisos(self):
        self.entrar()
        self.assertEqual(self.client.get("/api/docentes/").status_code, 403)
        self.assertEqual(self.client.post("/api/docentes/", {"nombre": "X"}, format="json").status_code, 403)


class ProgramasTests(BaseOfertaTest):
    def test_cualquier_usuario(self):
        self.entrar()
        r = self.client.get("/api/programas/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([p["nombre"] for p in r.data], ["Economía", "Finanzas"])
