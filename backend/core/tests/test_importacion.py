from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test.utils import CaptureQueriesContext

from core.models import (
    Bitacora,
    CargaAcademica,
    Docente,
    Estudiante,
    Grupo,
    ImportacionCSV,
    PeriodoEscolar,
    Usuario,
)
from core.services import importacion

from .test_solicitudes import ALUMNO, BaseSolicitudesTest

URL = "/api/importaciones/"
CONTROL = "valeria.ruiz"
ENCABEZADO_ALUMNOS = "matricula,nombre,apellidos,email,programa,semestre,turno"
ENCABEZADO_CARGAS = "matricula,clave_materia,num_grupo,ciclo"


def alumno(matricula, nombre="Ana Paola", apellidos="Ramos Castillo", email=None, programa="L-FIN", semestre="4",
           turno="Matutino"):
    email = email or f"a{matricula}@uan.edu.mx"
    return ",".join([matricula, nombre, apellidos, email, programa, semestre, turno])


def csv(*filas, encabezado=ENCABEZADO_ALUMNOS):
    return "\n".join([encabezado, *filas]) + "\n"


class BaseImportacionTest(BaseSolicitudesTest):
    def setUp(self):
        self.entrar(CONTROL)

    def subir(self, tipo, contenido, modo="vista_previa", status=None, nombre="padron.csv"):
        if isinstance(contenido, str):
            contenido = contenido.encode("utf-8")
        archivo = SimpleUploadedFile(nombre, contenido, content_type="text/csv")
        r = self.client.post(f"{URL}{tipo}/?modo={modo}", {"archivo": archivo}, format="multipart")
        esperado = status or (200 if modo == "vista_previa" else 201)
        self.assertEqual(r.status_code, esperado, r.content)
        return r.data

    def previa(self, contenido, tipo="alumnos", **kw):
        return self.subir(tipo, contenido, **kw)

    def confirmar(self, contenido, tipo="alumnos", **kw):
        return self.subir(tipo, contenido, modo="confirmar", **kw)

    def errores(self, datos):
        return [(e["linea"], e["mensaje"]) for e in datos["errores"]]


class AlumnosTests(BaseImportacionTest):
    def test_alumnos_nuevos_con_contrasena_temporal(self):
        r = self.confirmar(csv(alumno("240000001"), alumno("240000002", nombre="Emiliano", turno="")))
        self.assertEqual((r["creados"], r["actualizados"], r["excluidos"]), (2, 0, 0))
        self.assertRegex(r["folio"], r"^IMP-2026A-\d{3}$")
        cred = {c["matricula"]: c for c in r["credenciales"]}
        self.assertEqual(cred["240000001"]["nombre"], "Ana Paola Ramos Castillo")
        self.assertEqual(len(cred["240000001"]["password"]), 10)
        self.assertNotEqual(cred["240000001"]["password"], cred["240000002"]["password"])

        nuevo = Estudiante.objects.select_related("usuario", "programa").get(matricula="240000001")
        self.assertEqual(
            (nuevo.usuario.rol, nuevo.usuario.debe_cambiar_password, nuevo.programa.clave, nuevo.semestre, nuevo.turno),
            ("estudiante", True, "L-FIN", 4, "matutino"),
        )
        self.assertTrue(nuevo.usuario.password.startswith("pbkdf2_temporal$"))

        # El alumno entra con la temporal y el sistema le pide cambiarla.
        self.client.credentials()
        token = self.client.post(
            "/api/auth/token/", {"username": "240000001", "password": cred["240000001"]["password"]}, format="json"
        )
        self.assertEqual(token.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.data['access']}")
        self.assertTrue(self.client.get("/api/me/").data["debe_cambiar_password"])

    def test_reimportar_no_duplica_ni_cambia_la_contrasena(self):
        archivo = csv(alumno("240000001"))
        self.confirmar(archivo)
        hash_antes = Usuario.objects.get(username="240000001").password
        previa = self.previa(archivo)
        self.assertEqual(previa["muestra"][0]["accion"], "sin_cambios")
        r = self.confirmar(archivo)
        self.assertEqual((r["creados"], r["actualizados"], r["credenciales"]), (0, 1, []))
        self.assertEqual(Estudiante.objects.filter(matricula="240000001").count(), 1)
        self.assertEqual(Usuario.objects.get(username="240000001").password, hash_antes)

    def test_matricula_existente_actualiza_sus_datos(self):
        carlos = Estudiante.objects.select_related("usuario").get(matricula=ALUMNO)
        hash_antes = carlos.usuario.password
        fila = alumno(ALUMNO, nombre="Carlos E.", apellidos="Pérez Villa", email=carlos.usuario.email,
                      programa="Economía", semestre="7", turno="vespertino")
        self.assertEqual(self.previa(csv(fila))["muestra"][0]["accion"], "actualizacion")
        r = self.confirmar(csv(fila))
        self.assertEqual((r["creados"], r["actualizados"]), (0, 1))
        carlos.refresh_from_db()
        carlos.usuario.refresh_from_db()
        self.assertEqual((carlos.semestre, carlos.turno), (7, "vespertino"))
        self.assertEqual(carlos.usuario.password, hash_antes)
        self.assertFalse(carlos.usuario.debe_cambiar_password)

    def test_errores_por_fila_y_las_buenas_se_importan(self):
        Usuario.objects.create_user("240000099", email="ocupado@uan.edu.mx", rol="control_escolar")
        archivo = csv(
            alumno("240000001"),
            alumno("24000000"),  # 8 dígitos
            alumno("240000001", email="otro@uan.edu.mx"),
            alumno("240000003", email="ana@gmail.com"),
            alumno("240000004", programa="L-XXX"),
            alumno("240000005", semestre="11"),
            alumno("240000006", turno="Nocturno"),
            alumno("240000007", nombre=""),
            alumno("240000008", email="ocupado@uan.edu.mx"),
            alumno("240000099"),
            alumno("240000010", email="a240000001@uan.edu.mx"),
        )
        previa = self.previa(archivo)
        self.assertEqual((previa["total"], previa["validas"]), (11, 1))
        self.assertEqual(
            self.errores(previa),
            [
                (3, "La matrícula debe tener 9 dígitos."),
                (4, "Matrícula repetida en este archivo CSV (duplicada en línea 2)"),
                (5, "Correo institucional inválido (@uan.edu.mx o @alumnos.uan.edu.mx)."),
                (6, "Programa inexistente: L-XXX."),
                (7, "El semestre debe ser un entero de 1 a 10."),
                (8, "El turno debe ser Matutino o Vespertino."),
                (9, "Faltan el nombre o los apellidos."),
                (10, "El correo ya pertenece a otra cuenta."),
                (11, "La matrícula pertenece a una cuenta de personal."),
                (12, "Correo repetido en este archivo CSV (duplicado en línea 2)"),
            ],
        )
        self.assertEqual(previa["errores"][0]["datos"], "Ana Paola Ramos Castillo")
        r = self.confirmar(archivo)
        self.assertEqual((r["creados"], r["excluidos"]), (1, 10))

    def test_programa_por_clave_o_nombre(self):
        previa = self.previa(
            csv(alumno("240000001", programa="l-eco"), alumno("240000002", programa="Economia"),
                alumno("240000003", programa="FINANZAS"))
        )
        self.assertEqual([f["datos"]["programa"] for f in previa["muestra"]], ["Economía", "Economía", "Finanzas"])

    def test_correo_de_alumnos(self):
        previa = self.previa(csv(alumno("240000001", email="Ana.Ramos@Alumnos.UAN.edu.mx")))
        self.assertEqual(previa["muestra"][0]["datos"]["email"], "ana.ramos@alumnos.uan.edu.mx")


class ArchivoTests(BaseImportacionTest):
    def test_columnas_faltantes_y_desconocidas(self):
        r = self.previa("matricula,nombre,correo\n240000001,Ana,x\n", status=400)
        self.assertEqual(
            r["archivo"],
            ["Faltan columnas: apellidos, email, programa, semestre, turno.", "Columnas desconocidas: correo."],
        )

    def test_no_utf8(self):
        r = self.previa(csv(alumno("240000001", nombre="Iñaki")).encode("latin-1"), status=400)
        self.assertEqual(r["archivo"], ["El archivo no está en UTF-8."])

    def test_vacio_y_sin_filas(self):
        self.assertEqual(self.previa("", status=400)["archivo"], ["El archivo está vacío."])
        self.assertEqual(self.previa(ENCABEZADO_ALUMNOS + "\n\n", status=400)["archivo"], ["El archivo no tiene filas."])

    def test_tamano_maximo(self):
        with mock.patch.object(importacion, "MAX_BYTES", 10):
            r = self.previa(csv(alumno("240000001")), status=400)
        self.assertEqual(r["archivo"], ["El archivo supera el máximo de 25 MB."])

    def test_bom_punto_y_coma_y_encabezados_con_espacios(self):
        contenido = "﻿" + csv(alumno("240000001")).replace(",", ";").replace("matricula", " Matricula ")
        previa = self.previa(contenido)
        self.assertEqual((previa["validas"], previa["errores"]), (1, []))
        self.assertEqual(previa["muestra"][0]["linea"], 2)

    def test_modo_invalido(self):
        r = self.subir("alumnos", csv(alumno("240000001")), modo="otro", status=400)
        self.assertIn("modo", r)


class CargasTests(BaseImportacionTest):
    def carga(self, matricula, clave, grupo="01", ciclo="2026-A"):
        return ",".join([matricula, clave, grupo, ciclo])

    def cargas(self, *filas):
        return csv(*filas, encabezado=ENCABEZADO_CARGAS)

    def test_carga_nueva_y_reimportar(self):
        archivo = self.cargas(self.carga(ALUMNO, "EC701", "1"))
        previa = self.previa(archivo, tipo="cargas")
        self.assertEqual(
            (previa["muestra"][0]["accion"], previa["muestra"][0]["datos"]["grupo"], previa["muestra"][0]["avisos"]),
            ("nueva", "01", []),
        )
        r = self.confirmar(archivo, tipo="cargas")
        self.assertEqual((r["creados"], r["actualizados"], r["credenciales"]), (1, 0, []))
        carga = CargaAcademica.objects.get(estudiante__matricula=ALUMNO, grupo=self.grupo("EC701"))
        self.assertEqual((carga.estado, carga.origen), ("inscrito", "importacion"))

        self.assertEqual(self.previa(archivo, tipo="cargas")["muestra"][0]["accion"], "sin_cambios")
        r = self.confirmar(archivo, tipo="cargas")
        self.assertEqual((r["creados"], r["actualizados"]), (0, 1))
        self.assertEqual(CargaAcademica.objects.filter(estudiante__matricula=ALUMNO, grupo=self.grupo("EC701")).count(), 1)

    def test_la_baja_aprobada_se_respeta(self):
        CargaAcademica.objects.filter(estudiante__matricula=ALUMNO, grupo=self.grupo("EC604")).update(estado="baja")
        archivo = self.cargas(self.carga(ALUMNO, "EC604"))
        self.assertEqual(self.previa(archivo, tipo="cargas")["muestra"][0]["accion"], "baja_respetada")
        self.confirmar(archivo, tipo="cargas")
        self.assertEqual(
            CargaAcademica.objects.get(estudiante__matricula=ALUMNO, grupo=self.grupo("EC604")).estado, "baja"
        )

    def test_errores_de_cargas(self):
        otro = Grupo.objects.create(
            materia=self.grupo("EC601").materia, docente=Docente.objects.first(), periodo=self.periodo,
            num_grupo="02", cupo_maximo=30,
        )
        self.assertTrue(otro.pk)
        previa = self.previa(
            self.cargas(
                self.carga("999999999", "EC701"),
                self.carga(ALUMNO, "EC701", ciclo="2025-B"),
                self.carga(ALUMNO, "ECO-999"),
                self.carga(ALUMNO, "EC605", "09"),
                self.carga(ALUMNO, "EC601", "02"),
                self.carga("220011456", "EC701"),
                self.carga("220011456", "ec701", "1"),
                self.carga("200078511", "EC605", "02"),
                self.carga("200078511", "EC601", "01"),
                self.carga("200078511", "EC601", "02"),
            ),
            tipo="cargas",
        )
        self.assertEqual(
            self.errores(previa),
            [
                (2, "Alumno inexistente: importa primero el padrón."),
                (3, "El ciclo debe ser el periodo activo (2026-A)."),
                (4, "Materia inexistente: ECO-999."),
                (5, "Grupo inexistente para la materia Econometría II (Solo existen 02)"),
                (6, "El alumno ya está inscrito en EC601 gpo 01."),
                (8, "Carga repetida en este archivo CSV (duplicada en línea 7)"),
                (11, "El alumno ya tiene EC601 gpo 01 en la línea 10."),
            ],
        )
        datos = {e["linea"]: e["datos"] for e in previa["errores"]}
        self.assertEqual((datos[3], datos[4], datos[5]), ("Ciclo: 2025-B", "Clave: ECO-999", "Grupo: 09"))
        self.assertEqual(previa["validas"], 3)

    def test_cupo_excedido_y_choque_se_importan_con_aviso(self):
        # EC504 está lleno (2 de 2) y EC606 choca con EC601 de Carlos.
        archivo = self.cargas(self.carga(ALUMNO, "EC504"), self.carga(ALUMNO, "EC606"))
        previa = self.previa(archivo, tipo="cargas")
        self.assertEqual(previa["avisos"], 2)
        self.assertEqual(
            [f["avisos"] for f in previa["muestra"]],
            [["Excede el cupo (3 de 2)"], ["Choca con EC601 gpo 01"]],
        )
        r = self.confirmar(archivo, tipo="cargas")
        self.assertEqual(r["creados"], 2)
        self.assertTrue(
            CargaAcademica.objects.filter(estudiante__matricula=ALUMNO, grupo=self.grupo("EC606"), estado="inscrito").exists()
        )

    def test_choque_entre_filas_nuevas_del_archivo(self):
        # Diego no tiene EC601; EC601 y EC606 se dan a la misma hora.
        previa = self.previa(self.cargas(self.carga("220011456", "EC601"), self.carga("220011456", "EC606")),
                             tipo="cargas")
        self.assertEqual([f["avisos"] for f in previa["muestra"]], [[], ["Choca con EC601 gpo 01"]])

    def test_el_horario_del_alumno_incluye_la_carga_importada(self):
        self.confirmar(self.cargas(self.carga(ALUMNO, "EC701")), tipo="cargas")
        self.entrar(ALUMNO)
        horario = self.client.get("/api/estudiante/horario/").data
        self.assertIn("EC701", str(horario))


class FlujoTests(BaseImportacionTest):
    def test_la_vista_previa_no_escribe(self):
        antes = (Usuario.objects.count(), ImportacionCSV.objects.count(), Bitacora.objects.count())
        self.previa(csv(alumno("240000001")))
        self.assertEqual(antes, (Usuario.objects.count(), ImportacionCSV.objects.count(), Bitacora.objects.count()))

    def test_confirmar_sin_filas_validas(self):
        r = self.confirmar(csv(alumno("123")), status=400)
        self.assertEqual(r["detail"], "No hay filas válidas para importar.")
        self.assertFalse(ImportacionCSV.objects.exists())

    def test_historial_folio_y_bitacora(self):
        r = self.confirmar(csv(alumno("240000001"), alumno("1")), nombre="padron_2026A.csv")
        importacion_ = ImportacionCSV.objects.get()
        self.assertEqual(r["folio"], f"IMP-2026A-{importacion_.pk:03d}")
        self.assertEqual(
            (importacion_.tipo, importacion_.archivo, importacion_.total, importacion_.creados, importacion_.excluidos),
            ("alumnos", "padron_2026A.csv", 2, 1, 1),
        )
        registro = Bitacora.objects.order_by("-id").first()
        self.assertEqual(registro.accion, "importar_csv")
        self.assertEqual(registro.entidad, f"ImportacionCSV #{importacion_.pk} ({r['folio']} alumnos)")
        self.assertEqual(registro.usuario.username, CONTROL)

        historial = self.client.get(URL).data
        self.assertEqual(len(historial), 1)
        self.assertEqual(
            {k: historial[0][k] for k in ("folio", "tipo", "archivo", "usuario", "creados", "actualizados", "excluidos")},
            {"folio": r["folio"], "tipo": "alumnos", "archivo": "padron_2026A.csv", "usuario": "Valeria M. Ruiz",
             "creados": 1, "actualizados": 0, "excluidos": 1},
        )

    def test_sin_periodo_activo(self):
        PeriodoEscolar.objects.update(activo=False)
        r = self.previa(csv(alumno("240000001")), status=400)
        self.assertEqual(r["detail"], "No hay un periodo activo.")

    def test_permisos(self):
        for usuario in (ALUMNO, "admin"):
            self.entrar(usuario)
            self.previa(csv(alumno("240000001")), status=403)
            self.assertEqual(self.client.get(URL).status_code, 403)
            self.assertEqual(self.client.get(f"{URL}plantilla/alumnos/").status_code, 403)

    def test_plantillas(self):
        for tipo, encabezado in (("alumnos", ENCABEZADO_ALUMNOS), ("cargas", ENCABEZADO_CARGAS)):
            r = self.client.get(f"{URL}plantilla/{tipo}/")
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r["Content-Type"], "text/csv; charset=utf-8")
            self.assertIn(f'filename="plantilla_{tipo}.csv"', r["Content-Disposition"])
            self.assertEqual(r.content.decode("utf-8"), "﻿" + encabezado + "\r\n")
        self.assertEqual(self.client.get(f"{URL}plantilla/otra/").status_code, 404)

    def test_consultas_no_crecen_con_las_filas(self):
        def consultas(contenido, tipo):
            with CaptureQueriesContext(connection) as c:
                self.previa(contenido, tipo=tipo)
            return len(c)

        pocos = csv(*[alumno(f"24000000{i}") for i in range(2)])
        muchos = csv(*[alumno(f"2400000{i:02d}") for i in range(20)])
        self.assertEqual(consultas(pocos, "alumnos"), consultas(muchos, "alumnos"))

        claves = ["EC601", "EC602", "EC603", "EC604", "EC605", "EC606", "EC701", "EC504", "EC704", "FI702"]
        matriculas = [ALUMNO, "220011456"]
        pocas = csv(*[f"{m},EC701,01,2026-A" for m in matriculas], encabezado=ENCABEZADO_CARGAS)
        muchas = csv(*[f"{m},{c},01,2026-A" for m in matriculas for c in claves], encabezado=ENCABEZADO_CARGAS)
        self.assertEqual(consultas(pocas, "cargas"), consultas(muchas, "cargas"))
