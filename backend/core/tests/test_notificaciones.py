from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from core.models import Bitacora, DetalleSolicitud, Notificacion, PeriodoEscolar, Usuario

from .test_solicitudes import ALUMNO, JUSTIFICACION, BaseSolicitudesTest

URL = "/api/notificaciones/"
CONTROL = "valeria.ruiz"
ROBERTO = "roberto.pena"
ANDREA = "200045129"
DIEGO = "220011456"
LARGA = "Estuve hospitalizado durante la convocatoria y no pude hacer el trámite a tiempo. Traigo el justificante médico."


class BaseAvisosTest(BaseSolicitudesTest):
    def folio(self, *movimientos, alumno=ALUMNO, **kwargs):
        self.entrar(alumno)
        datos = self.enviar(*movimientos, **kwargs)
        return datos

    def mov(self, folio, clave):
        return next(m["id"] for m in folio["movimientos"] if m["grupo"]["materia"]["clave"] == clave)

    def como(self, username):
        self.entrar(username)
        return self

    def lista(self, consulta="", status=200):
        r = self.client.get(f"{URL}{consulta}")
        self.assertEqual(r.status_code, status, r.content)
        return r.data

    def avisos(self, username, **filtro):
        return list(
            Notificacion.objects.filter(usuario__username=username, **filtro)
            .order_by("id")
            .values_list("tipo", "titulo", "mensaje")
        )


class EventosTests(BaseAvisosTest):
    def test_folio_enviado(self):
        folio = self.folio(("EC601", "BAJA"), ("EC606", "ALTA"))["folio_digital"]
        self.assertEqual(
            self.avisos(ALUMNO),
            [("folio_enviado", f"Tu solicitud {folio} fue enviada exitosamente",
              "Ingresada para revisión por Control Escolar con 2 movimientos solicitados (1 alta, 1 baja).")],
        )
        for usuario in (CONTROL, ROBERTO):
            ((tipo, titulo, mensaje),) = self.avisos(usuario)
            self.assertEqual((tipo, titulo), ("nueva_solicitud", f"Nueva solicitud ingresada: Folio {folio}"))
            self.assertEqual(
                mensaje,
                "Carlos E. Pérez Villa (Matrícula: 210089334, Lic. en Economía, 6° Semestre) ingresó solicitud con "
                "2 movimientos solicitados (1 alta, 1 baja).",
            )
        aviso = Notificacion.objects.get(usuario__username=CONTROL)
        self.assertEqual(
            aviso.datos["movimientos"],
            [{"tipo": "BAJA", "materia": "Macroeconomía III", "grupo": "01"},
             {"tipo": "ALTA", "materia": "Comercio Internacional", "grupo": "01"}],
        )
        self.assertEqual(aviso.datos["justificacion"], JUSTIFICACION)

    def test_extemporanea_y_personal_inactivo(self):
        Usuario.objects.filter(username=ROBERTO).update(is_active=False)
        self.mover_convocatoria(-5, -1)
        folio = self.folio(("EC605", "ALTA"), justificacion=LARGA)["folio_digital"]
        self.assertEqual(
            [t for t, _, _ in self.avisos(CONTROL)], ["solicitud_extemporanea"]
        )
        self.assertEqual(self.avisos(CONTROL)[0][1], f"Petición extemporánea recibida: Folio {folio}")
        self.assertEqual(self.avisos(ROBERTO), [])

    def test_cancelacion(self):
        folio = self.folio(("EC601", "BAJA"), ("EC606", "ALTA"))
        self.assertEqual(self.client.post(f"/api/solicitudes/{folio['id']}/cancelar/").status_code, 200)
        ((tipo, titulo, mensaje),) = self.avisos(CONTROL, tipo="cancelacion")
        self.assertEqual(titulo, f"Solicitud cancelada por el alumno: Folio {folio['folio_digital']}")
        self.assertEqual(
            mensaje,
            "Carlos E. Pérez Villa desistió voluntariamente de su trámite antes de la emisión del dictamen. "
            "Se cancelaron los movimientos pendientes para Macroeconomía III (Gpo. 01) y Comercio Internacional (Gpo. 01).",
        )

    def test_aprobar_y_rechazar(self):
        folio = self.folio(("EC605", "ALTA"), ("EC602", "BAJA"))
        self.entrar(CONTROL)
        self.client.post(f"/api/movimientos/{self.mov(folio, 'EC605')}/aprobar/", {}, format="json")
        self.client.post(
            f"/api/movimientos/{self.mov(folio, 'EC602')}/rechazar/", {"motivo": "Sin firma del tutor."}, format="json"
        )
        aprobado = Notificacion.objects.get(usuario__username=ALUMNO, tipo="movimiento_aprobado")
        self.assertEqual(aprobado.titulo, "Se aprobó tu alta en Econometría II (Gpo. 02)")
        self.assertEqual(aprobado.datos["docente"], self.grupo("EC605").docente.nombre)
        self.assertTrue(aprobado.datos["horarios"])
        rechazado = Notificacion.objects.get(usuario__username=ALUMNO, tipo="movimiento_rechazado")
        self.assertEqual(rechazado.titulo, "Se rechazó tu baja en Finanzas Públicas (Gpo. 01)")
        self.assertEqual(rechazado.mensaje, f"Folio {folio['folio_digital']}. Motivo: Sin firma del tutor.")

    def test_importacion(self):
        self.entrar(CONTROL)
        contenido = "matricula,nombre,apellidos,email,programa,semestre,turno\n240000001,Ana,Ramos,a@uan.edu.mx,L-FIN,4,\n"
        archivo = SimpleUploadedFile("padron.csv", contenido.encode(), content_type="text/csv")
        r = self.client.post("/api/importaciones/alumnos/?modo=confirmar", {"archivo": archivo}, format="multipart")
        self.assertEqual(r.status_code, 201)
        aviso = Notificacion.objects.get(usuario__username=ROBERTO, tipo="importacion")
        self.assertEqual(aviso.titulo, "Importación masiva de alumnos finalizada con éxito")
        self.assertEqual(
            (aviso.datos["creados"], aviso.datos["actualizados"], aviso.datos["excluidos"], aviso.datos["archivo"]),
            (1, 0, 0, "padron.csv"),
        )


class AvisosDeEstadoTests(BaseAvisosTest):
    def test_convocatoria_cierra_solo_en_las_ultimas_24_horas(self):
        self.mover_convocatoria(-5, 3)
        self.assertEqual(self.lista()["conteos"]["convocatoria"], 0)
        ahora = timezone.now()
        PeriodoEscolar.objects.filter(pk=self.periodo.pk).update(convocatoria_fin=ahora + timedelta(hours=10))
        primera = self.lista("?categoria=convocatoria")
        self.assertEqual(primera["total"], 1)
        aviso = primera["resultados"][0]
        self.assertEqual(aviso["titulo"], "La convocatoria cierra en 24 horas")
        self.assertIn("del Ciclo 2026-A concluye", aviso["mensaje"])
        self.assertEqual(self.lista("?categoria=convocatoria")["total"], 1)  # una sola vez
        # El personal no lo recibe.
        self.entrar(CONTROL)
        self.assertEqual(Notificacion.objects.filter(tipo="convocatoria_cierra").count(), 1)
        self.lista()
        self.assertEqual(Notificacion.objects.filter(tipo="convocatoria_cierra").count(), 1)

    def test_movimientos_por_exportar(self):
        folio = self.folio(("EC605", "ALTA"), ("EC602", "BAJA"))
        self.entrar(CONTROL)

        def aviso():
            return Notificacion.objects.filter(usuario__username=CONTROL, tipo="exportacion_pendiente").first()

        self.lista()
        self.assertIsNone(aviso())
        self.client.post(f"/api/movimientos/{self.mov(folio, 'EC605')}/aprobar/", {}, format="json")
        self.lista()
        self.assertEqual(aviso().titulo, "Lote de actas dictaminadas listo para exportación")
        self.assertIn("Existe 1 movimiento aprobado listo para generar", aviso().mensaje)
        self.client.post(f"{URL}leer-todas/")
        self.lista()
        self.assertTrue(aviso().leida)  # mismo conteo: sigue leído

        self.client.post(f"/api/movimientos/{self.mov(folio, 'EC602')}/aprobar/", {}, format="json")
        self.lista()
        self.assertEqual((aviso().datos["movimientos"], aviso().leida), (2, False))

        self.client.post("/api/exportaciones/", {"formato": "csv"}, format="json")
        self.assertFalse(Notificacion.objects.filter(tipo="exportacion_pendiente").exists())
        self.lista()
        self.assertIsNone(aviso())


class ListaTests(BaseAvisosTest):
    def setUp(self):
        super().setUp()
        self.f1 = self.folio(("EC605", "ALTA"))
        self.f2 = self.folio(("EC602", "BAJA"))
        self.entrar(CONTROL)
        self.client.post(f"/api/movimientos/{self.mov(self.f1, 'EC605')}/aprobar/", {}, format="json")
        self.entrar(ALUMNO)

    def test_solo_los_propios_y_conteos(self):
        r = self.lista()
        self.assertEqual(
            [a["titulo"] for a in r["resultados"]],
            ["Se aprobó tu alta en Econometría II (Gpo. 02)",
             f"Tu solicitud {self.f2['folio_digital']} fue enviada exitosamente",
             f"Tu solicitud {self.f1['folio_digital']} fue enviada exitosamente"],
        )
        self.assertEqual((r["no_leidas"], r["total"]), (3, 3))
        self.assertEqual(
            {k: r["conteos"][k] for k in ("todas", "no_leidas", "tramites", "resoluciones", "convocatoria")},
            {"todas": 3, "no_leidas": 3, "tramites": 3, "resoluciones": 1, "convocatoria": 0},
        )
        primero = r["resultados"][0]
        self.assertEqual((primero["folio"], primero["solicitud"]), (self.f1["folio_digital"], self.f1["id"]))
        self.assertEqual(primero["categorias"], ["resoluciones", "tramites"])

    def test_filtros(self):
        self.assertEqual(self.lista("?categoria=resoluciones")["total"], 1)
        self.assertEqual(self.lista(f"?q={self.f2['folio_digital']}")["total"], 1)
        self.assertEqual(self.lista("?limite=1")["total"], 3)
        self.assertEqual(len(self.lista("?limite=1")["resultados"]), 1)
        antiguas = self.lista("?orden=antiguas")["resultados"]
        self.assertEqual(antiguas[0]["folio"], self.f1["folio_digital"])
        self.assertEqual(antiguas[0]["tipo"], "folio_enviado")

    def test_leer(self):
        aviso = self.lista()["resultados"][0]
        r = self.client.post(f"{URL}{aviso['id']}/leer/")
        self.assertTrue(r.data["leida"])
        self.assertEqual(self.lista("?estado=no_leidas")["total"], 2)
        self.assertEqual(self.client.post(f"{URL}leer-todas/").data, {"marcadas": 2})
        self.assertEqual(self.lista()["no_leidas"], 0)

    def test_no_se_lee_el_de_otro(self):
        ajeno = Notificacion.objects.filter(usuario__username=CONTROL).first()
        self.assertEqual(self.client.post(f"{URL}{ajeno.pk}/leer/").status_code, 404)

    def test_consultas_no_crecen(self):
        def contar():
            with CaptureQueriesContext(connection) as consultas:
                self.lista()
            return len(consultas)

        antes = contar()
        for clave in ("EC601", "EC603", "EC604"):
            self.folio((clave, "BAJA"))
        self.assertEqual(contar(), antes)


class ResumenOperativoTests(BaseAvisosTest):
    def test_cancelaciones_hoy_y_ayer(self):
        for alumno, clave in ((ALUMNO, "EC601"), (DIEGO, "EC504")):
            folio = self.folio((clave, "BAJA"), alumno=alumno)
            self.client.post(f"/api/solicitudes/{folio['id']}/cancelar/")
        ayer = Bitacora.objects.filter(accion="cancelar_folio", usuario__username=DIEGO)
        ayer.update(fecha=timezone.now() - timedelta(days=1))
        self.entrar(CONTROL)
        r = self.client.get(f"{URL}resumen-operativo/")
        self.assertEqual(r.data, {"cancelaciones_hoy": 1, "cancelaciones_ayer": 1})
        self.entrar(ALUMNO)
        self.assertEqual(self.client.get(f"{URL}resumen-operativo/").status_code, 403)

    def test_movimientos_quedan_cancelados(self):
        folio = self.folio(("EC601", "BAJA"))
        self.client.post(f"/api/solicitudes/{folio['id']}/cancelar/")
        self.assertEqual(DetalleSolicitud.objects.get(solicitud_id=folio["id"]).estado, "cancelada")
        r = self.client.post(f"/api/solicitudes/{folio['id']}/cancelar/")
        self.assertEqual(r.status_code, 400)
