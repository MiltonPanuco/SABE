import csv
import io
from datetime import datetime
from io import StringIO

from django.core.management import call_command
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from openpyxl import load_workbook

from core.models import (
    Bitacora,
    DetalleSolicitud,
    Estudiante,
    LoteExportacion,
    Notificacion,
    PeriodoEscolar,
    Solicitud,
)
from core.services import exportacion

from .test_solicitudes import ALUMNO, BaseSolicitudesTest

URL = "/api/exportaciones/"
CONTROL = "valeria.ruiz"
DIEGO = "220011456"
ANDREA = "200045129"
ENCABEZADOS = [
    "Ciclo",
    "Folio",
    "Matrícula",
    "Nombre",
    "Programa",
    "Clave materia",
    "Materia",
    "Grupo",
    "Docente",
    "Tipo",
    "Fecha de aprobación",
]
APROBADO = timezone.make_aware(datetime(2026, 2, 12, 10, 30))


class BaseExportacionTest(BaseSolicitudesTest):
    """Folios armados a mano (sin pasar por el dictamen): aquí solo importa su estado."""

    numero = 200

    def setUp(self):
        self.entrar(CONTROL)

    def folio(self, matricula, *movimientos, periodo=None):
        """movimientos: (clave, tipo, estado)."""
        BaseExportacionTest.numero += 1
        solicitud = Solicitud.objects.create(
            folio_digital=f"SABE-2026-{BaseExportacionTest.numero}",
            estudiante=Estudiante.objects.get(matricula=matricula),
            periodo=periodo or self.periodo,
            justificacion="Prueba",
        )
        for clave, tipo, estado in movimientos:
            DetalleSolicitud.objects.create(
                solicitud=solicitud,
                grupo=self.grupo(clave),
                tipo_tramite=tipo,
                estado=estado,
                motivo_rechazo="No" if estado == "rechazada" else "",
                fecha_resolucion=APROBADO if estado != "pendiente" else None,
            )
        return solicitud

    def generar(self, formato="xlsx", status=201):
        r = self.client.post(URL, {"formato": formato}, format="json")
        self.assertEqual(r.status_code, status, r.content)
        return r.data

    def marcar(self, lote_id, status=200):
        r = self.client.post(f"{URL}{lote_id}/marcar-cargado/")
        self.assertEqual(r.status_code, status, r.content)
        return r.data

    def descargar(self, lote_id):
        r = self.client.get(f"{URL}{lote_id}/descargar/")
        self.assertEqual(r.status_code, 200)
        return r


class GenerarTests(BaseExportacionTest):
    def setUp(self):
        super().setUp()
        self.f1 = self.folio(ALUMNO, ("EC601", "BAJA", "aprobada"), ("EC606", "ALTA", "aprobada"))
        self.f2 = self.folio(DIEGO, ("EC704", "ALTA", "aprobada"), ("EC605", "ALTA", "rechazada"))
        self.folio(ANDREA, ("EC605", "ALTA", "pendiente"))
        self.folio(ANDREA, ("EC704", "ALTA", "aprobada"), periodo=PeriodoEscolar.objects.get(ciclo="2025-B"))

    def test_toma_los_aprobados_del_periodo_sin_lote(self):
        pendientes = self.client.get(f"{URL}pendientes/").data
        self.assertEqual(
            [(m["folio"], m["clave"], m["tipo"]) for m in pendientes],
            [(self.f1.folio_digital, "EC601", "BAJA"), (self.f1.folio_digital, "EC606", "ALTA"),
             (self.f2.folio_digital, "EC704", "ALTA")],
        )
        primero = pendientes[0]
        self.assertEqual((primero["matricula"], primero["alumno"]), (ALUMNO, "Carlos E. Pérez Villa"))
        self.assertTrue(primero["horarios"])

        lote = self.generar()
        self.assertEqual(lote["folio"], "LOTE-2026A-001")
        self.assertEqual(
            (lote["total_registros"], lote["alumnos"], lote["altas"], lote["bajas"], lote["cargado"]),
            (3, 2, 2, 1, False),
        )
        self.assertEqual(lote["programas"], ["Economía"])
        self.assertEqual(lote["usuario"], "Valeria M. Ruiz")
        self.assertEqual(self.client.get(f"{URL}pendientes/").data, [])
        self.assertEqual(DetalleSolicitud.objects.filter(lote_id=lote["id"]).count(), 3)

        bitacora = Bitacora.objects.filter(accion="exportar_sadce").get()
        self.assertEqual(bitacora.entidad, f"LoteExportacion #{lote['id']} (LOTE-2026A-001 xlsx)")

    def test_un_movimiento_solo_entra_a_un_lote(self):
        primero = self.generar()
        self.generar(status=400)
        self.folio(ANDREA, ("EC604", "ALTA", "aprobada"))
        segundo = self.generar("csv")
        self.assertEqual((segundo["folio"], segundo["total_registros"]), ("LOTE-2026A-002", 1))
        self.assertEqual(DetalleSolicitud.objects.filter(lote_id=primero["id"]).count(), 3)

    def test_sin_pendientes(self):
        DetalleSolicitud.objects.update(estado="cancelada")
        r = self.generar(status=400)
        self.assertEqual(r["detail"], "No hay movimientos aprobados por exportar.")
        self.assertFalse(LoteExportacion.objects.exists())

    def test_formato_invalido(self):
        r = self.generar("pdf", status=400)
        self.assertEqual(r["formato"], ["Elige Excel (xlsx) o CSV (csv)."])


class ArchivoTests(BaseExportacionTest):
    def setUp(self):
        super().setUp()
        self.f1 = self.folio(ALUMNO, ("EC601", "BAJA", "aprobada"), ("EC606", "ALTA", "aprobada"))

    def test_excel(self):
        lote = self.generar("xlsx")
        r = self.descargar(lote["id"])
        self.assertEqual(r["Content-Type"], exportacion.TIPOS_CONTENIDO["xlsx"])
        self.assertEqual(r["Content-Disposition"], 'attachment; filename="LOTE-2026A-001.xlsx"')
        hoja = load_workbook(io.BytesIO(r.content))["SADCE"]
        filas = list(hoja.iter_rows(values_only=True))
        self.assertEqual(list(filas[0]), ENCABEZADOS)
        grupo = self.grupo("EC601")
        self.assertEqual(
            list(filas[1]),
            ["2026-A", self.f1.folio_digital, ALUMNO, "Carlos E. Pérez Villa", "Economía", "EC601",
             grupo.materia.nombre_materia, grupo.num_grupo, grupo.docente.nombre, "BAJA", datetime(2026, 2, 12)],
        )
        self.assertEqual(filas[2][9], "ALTA")
        self.assertEqual(hoja["C2"].data_type, "s")  # la matrícula va como texto
        self.assertEqual(hoja.freeze_panes, "A2")

    def test_csv(self):
        lote = self.generar("csv")
        r = self.descargar(lote["id"])
        self.assertEqual(r["Content-Disposition"], 'attachment; filename="LOTE-2026A-001.csv"')
        texto = r.content.decode("utf-8")
        self.assertTrue(texto.startswith("﻿"))
        filas = list(csv.reader(io.StringIO(texto[1:])))
        self.assertEqual(filas[0], ENCABEZADOS)
        self.assertEqual(filas[1][:4], ["2026-A", self.f1.folio_digital, ALUMNO, "Carlos E. Pérez Villa"])
        self.assertEqual(filas[1][10], "12/02/2026")
        self.assertEqual(len(filas), 3)

    def test_volver_a_descargar_da_lo_mismo(self):
        lote = self.generar("csv")
        primera = self.descargar(lote["id"]).content
        self.folio(DIEGO, ("EC704", "ALTA", "aprobada"))  # otro movimiento no cambia el lote ya hecho
        self.assertEqual(self.descargar(lote["id"]).content, primera)

    def test_plantilla_igual_al_archivo(self):
        columnas = self.client.get(f"{URL}plantilla/").data
        self.assertEqual([c["encabezado"] for c in columnas], ENCABEZADOS)
        self.assertTrue(all(c["descripcion"] and c["ejemplo"] for c in columnas))


class MarcarCargadoTests(BaseExportacionTest):
    def setUp(self):
        super().setUp()
        self.f1 = self.folio(ALUMNO, ("EC601", "BAJA", "aprobada"), ("EC606", "ALTA", "aprobada"))
        self.f2 = self.folio(DIEGO, ("EC704", "ALTA", "aprobada"))
        self.lote = self.generar()

    def test_marcar_cargado(self):
        Notificacion.objects.all().delete()
        r = self.marcar(self.lote["id"])
        self.assertTrue(r["cargado"])
        self.assertEqual(r["cargado_por"], "Valeria M. Ruiz")
        self.assertIsNotNone(r["fecha_carga"])
        self.assertEqual(set(DetalleSolicitud.objects.values_list("estado", flat=True)), {"cargada_sadce"})
        self.assertEqual(Solicitud.objects.get(pk=self.f1.pk).estado, "cargada_sadce")

        avisos = sorted(Notificacion.objects.values_list("usuario__username", "mensaje"))
        self.assertEqual(
            avisos,
            sorted([
                (DIEGO, f"Tu solicitud {self.f2.folio_digital} fue cargada en SADCE."),
                (ALUMNO, f"Tu solicitud {self.f1.folio_digital} fue cargada en SADCE."),
            ]),
        )
        self.assertTrue(Bitacora.objects.filter(accion="marcar_cargado").exists())

        # El alumno ve su folio cargado.
        self.entrar()
        folio = self.client.get(f"/api/solicitudes/{self.f1.pk}/").data
        self.assertEqual(folio["estado"], "cargada_sadce")

    def test_no_se_marca_dos_veces(self):
        self.marcar(self.lote["id"])
        r = self.marcar(self.lote["id"], status=400)
        self.assertEqual(r["detail"], "Este lote ya está marcado como cargado en SADCE.")
        self.assertEqual(Bitacora.objects.filter(accion="marcar_cargado").count(), 1)

    def test_resumen(self):
        self.folio(ANDREA, ("EC604", "ALTA", "aprobada"))
        self.folio(ANDREA, ("EC605", "ALTA", "rechazada"))
        r = self.client.get(f"{URL}resumen/").data
        self.assertEqual(
            {k: r[k] for k in ("dictaminados", "altas", "bajas", "cargados", "porcentaje_cargado", "lotes",
                               "lotes_en_espera", "movimientos_en_espera", "pendientes")},
            {"dictaminados": 4, "altas": 3, "bajas": 1, "cargados": 0, "porcentaje_cargado": 0, "lotes": 1,
             "lotes_en_espera": 1, "movimientos_en_espera": 3, "pendientes": 1},
        )
        self.assertEqual((r["ultima"]["folio"], r["ultima"]["usuario"]), ("LOTE-2026A-001", "Valeria M. Ruiz"))

        self.marcar(self.lote["id"])
        r = self.client.get(f"{URL}resumen/").data
        self.assertEqual((r["cargados"], r["porcentaje_cargado"], r["lotes_en_espera"]), (3, 75, 0))

    def test_resumen_vacio(self):
        LoteExportacion.objects.all().delete()
        DetalleSolicitud.objects.all().delete()
        r = self.client.get(f"{URL}resumen/").data
        self.assertEqual((r["dictaminados"], r["porcentaje_cargado"], r["ultima"]), (0, 0, None))


class ListadoTests(BaseExportacionTest):
    def setUp(self):
        super().setUp()
        self.folio(ALUMNO, ("EC606", "ALTA", "aprobada"))
        self.primero = self.generar("xlsx")
        self.folio(DIEGO, ("EC704", "ALTA", "aprobada"))
        self.segundo = self.generar("csv")
        self.marcar(self.primero["id"])

    def folios(self, consulta=""):
        return [lote["folio"] for lote in self.client.get(f"{URL}{consulta}").data]

    def test_del_mas_nuevo_al_mas_viejo(self):
        self.assertEqual(self.folios(), ["LOTE-2026A-002", "LOTE-2026A-001"])

    def test_filtros(self):
        self.assertEqual(self.folios("?formato=csv"), ["LOTE-2026A-002"])
        self.assertEqual(self.folios("?estado=cargado"), ["LOTE-2026A-001"])
        self.assertEqual(self.folios("?estado=exportado"), ["LOTE-2026A-002"])
        self.assertEqual(self.folios("?q=2026a-001"), ["LOTE-2026A-001"])
        self.assertEqual(self.folios("?q=valeria"), ["LOTE-2026A-002", "LOTE-2026A-001"])
        self.assertEqual(self.folios("?q=roberto"), [])

    def test_lote_de_otro_periodo(self):
        viejo = PeriodoEscolar.objects.get(ciclo="2025-B")
        otro = LoteExportacion.objects.create(periodo=viejo, numero=1, formato="csv")
        self.assertNotIn("LOTE-2025B-001", self.folios())
        self.assertEqual(self.client.get(f"{URL}{otro.pk}/descargar/").status_code, 404)
        self.assertEqual(self.client.post(f"{URL}{otro.pk}/marcar-cargado/").status_code, 404)

    def test_consultas_no_crecen_con_los_movimientos(self):
        def contar(ruta):
            with CaptureQueriesContext(connection) as consultas:
                self.assertEqual(self.client.get(ruta).status_code, 200)
            return len(consultas)

        lote_id = self.primero["id"]
        rutas = [URL, f"{URL}pendientes/", f"{URL}{lote_id}/descargar/"]
        self.folio(ANDREA, ("EC604", "ALTA", "aprobada"))
        antes = [contar(r) for r in rutas]
        for clave in ("EC601", "EC602", "EC603", "EC605"):
            self.folio(ANDREA, (clave, "BAJA", "aprobada"))
        # Más movimientos en el lote ya generado, para que la descarga también crezca.
        DetalleSolicitud.objects.filter(estado="aprobada", lote=None).exclude(
            solicitud__estudiante__matricula=ANDREA, grupo__materia__clave="EC604"
        ).update(lote_id=lote_id)
        self.assertEqual([contar(r) for r in rutas], antes)


class PermisosTests(BaseExportacionTest):
    def test_alumno_y_administrador_no_entran(self):
        for usuario in (ALUMNO, "admin"):
            self.entrar(usuario)
            self.assertEqual(self.client.get(URL).status_code, 403)
            self.assertEqual(self.client.post(URL, {"formato": "xlsx"}, format="json").status_code, 403)

    def test_sin_periodo_activo(self):
        PeriodoEscolar.objects.update(activo=False)
        r = self.client.get(URL)
        self.assertEqual((r.status_code, r.data["detail"]), (400, "No hay un periodo activo."))


class ActivarPeriodoTests(BaseExportacionTest):
    """F7 + F9: no se cambia de periodo con lo aprobado sin llegar a SADCE."""

    def activar(self, status=200):
        nuevo = PeriodoEscolar.objects.get(ciclo="2025-B")
        r = self.client.post(f"/api/periodos/{nuevo.pk}/activar/")
        self.assertEqual(r.status_code, status, r.content)
        return r.data

    def test_bloquea_hasta_cargar_en_sadce(self):
        self.folio(ALUMNO, ("EC606", "ALTA", "aprobada"))
        self.assertEqual(
            self.activar(400)["detail"],
            "Exporta a SADCE el movimiento aprobado de 2026-A antes de activar otro periodo.",
        )
        self.folio(DIEGO, ("EC704", "ALTA", "aprobada"))
        self.assertIn("los 2 movimientos aprobados", self.activar(400)["detail"])

        lote = self.generar()
        self.assertEqual(
            self.activar(400)["detail"],
            "Marca como cargado en SADCE el lote en espera de 2026-A antes de activar otro periodo.",
        )
        self.marcar(lote["id"])
        self.assertTrue(self.activar()["activo"])


class SeedDemoTests(BaseExportacionTest):
    def test_reinicio_quita_los_lotes_demo(self):
        self.folio(ALUMNO, ("EC606", "ALTA", "aprobada"))
        self.marcar(self.generar()["id"])
        call_command("seed_demo", "--sin-folios", stdout=StringIO())
        self.assertFalse(LoteExportacion.objects.exists())
