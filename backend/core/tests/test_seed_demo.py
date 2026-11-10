from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from core.models import (
    Bitacora,
    CargaAcademica,
    DetalleSolicitud,
    Estudiante,
    Grupo,
    HorarioGrupo,
    PeriodoEscolar,
    Programa,
    Rol,
    Solicitud,
    Usuario,
)


def seed(**opciones):
    call_command("seed_demo", stdout=StringIO(), **opciones)


def grupo(clave):
    return Grupo.objects.get(materia__clave=clave, periodo__activo=True)


@override_settings(DEBUG=True)
class SeedDemoTests(TestCase):
    def conteos(self):
        return {
            "programas": Programa.objects.count(),
            "grupos": Grupo.objects.count(),
            "horarios": HorarioGrupo.objects.count(),
            "usuarios": Usuario.objects.count(),
            "estudiantes": Estudiante.objects.count(),
            "cargas": CargaAcademica.objects.count(),
            "periodos": PeriodoEscolar.objects.count(),
            "periodos_activos": PeriodoEscolar.objects.filter(activo=True).count(),
            "bitacora": Bitacora.objects.count(),
            "folios": Solicitud.objects.count(),
            "movimientos": DetalleSolicitud.objects.count(),
        }

    def test_crea_los_datos_esperados(self):
        seed()
        self.assertEqual(
            self.conteos(),
            {
                "programas": 2,
                "grupos": 10,
                "horarios": 18,
                "usuarios": 8,
                "estudiantes": 5,
                # 7 importadas y el alta aprobada de Diego.
                "cargas": 8,
                # 2026-A y los tres ciclos anteriores del catálogo histórico.
                "periodos": 4,
                "periodos_activos": 1,
                # La activación de 2026-A por control escolar.
                "bitacora": 1,
                "folios": 3,
                "movimientos": 3,
            },
        )

    def test_folios_de_la_bandeja(self):
        seed()
        folios = {
            f.estudiante.matricula: f
            for f in Solicitud.objects.select_related("estudiante").prefetch_related("detalles__grupo__materia")
        }
        self.assertNotIn("210089334", folios)
        andrea, luis, diego = folios["200045129"], folios["200078511"], folios["220011456"]
        self.assertEqual((andrea.estado, andrea.extemporanea), ("pendiente", False))
        self.assertEqual((luis.estado, luis.extemporanea), ("pendiente", True))
        self.assertGreaterEqual(len(luis.justificacion), 100)
        self.assertEqual(diego.estado, "aprobada")
        self.assertEqual(diego.detalles.get().revisado_por.username, "roberto.pena")
        self.assertTrue(
            CargaAcademica.objects.filter(
                estudiante=diego.estudiante, grupo=grupo("EC704"), origen=CargaAcademica.Origen.SOLICITUD
            ).exists()
        )
        # EC504 sigue lleno para la demostración de "sin cupo".
        self.assertEqual(grupo("EC504").cupo_disponible, 0)

    def test_reinicia_los_tramites(self):
        seed()
        carlos = Estudiante.objects.get(matricula="210089334")
        folio = Solicitud.objects.create(folio_digital="SABE-2026-099", estudiante=carlos, periodo=grupo("EC606").periodo)
        DetalleSolicitud.objects.create(solicitud=folio, grupo=grupo("EC606"), tipo_tramite="ALTA", estado="aprobada")
        CargaAcademica.objects.create(
            estudiante=carlos, grupo=grupo("EC606"), origen=CargaAcademica.Origen.SOLICITUD
        )
        seed()
        self.assertFalse(Solicitud.objects.filter(estudiante=carlos).exists())
        self.assertFalse(CargaAcademica.objects.filter(estudiante=carlos, grupo=grupo("EC606")).exists())
        self.assertEqual(Solicitud.objects.count(), 3)

    def test_sin_folios(self):
        seed(sin_folios=True)
        self.assertFalse(Solicitud.objects.exists())

    def test_correrlo_dos_veces_no_duplica(self):
        seed()
        primero = self.conteos()
        seed()
        self.assertEqual(self.conteos(), primero)

    def test_restaura_el_estado_de_demostracion(self):
        seed()
        carlos = Usuario.objects.get(username="210089334")
        carlos.set_password("otra")
        carlos.save()
        CargaAcademica.objects.update(estado=CargaAcademica.Estado.BAJA)

        seed()
        carlos.refresh_from_db()
        self.assertTrue(carlos.check_password("demo1234"))
        self.assertFalse(CargaAcademica.objects.filter(estado=CargaAcademica.Estado.BAJA).exists())

    def test_usuarios_de_demostracion(self):
        seed()
        for username, rol in [
            ("210089334", Rol.ESTUDIANTE),
            ("valeria.ruiz", Rol.CONTROL_ESCOLAR),
            ("admin", Rol.ADMINISTRADOR),
        ]:
            with self.subTest(username=username):
                usuario = Usuario.objects.get(username=username)
                self.assertEqual(usuario.rol, rol)
                self.assertTrue(usuario.check_password("demo1234"))
                self.assertFalse(usuario.debe_cambiar_password)

        admin = Usuario.objects.get(username="admin")
        self.assertTrue(admin.is_staff and admin.is_superuser)

        mariana = Usuario.objects.get(username="230012345")
        self.assertTrue(mariana.check_password("temporal"))
        self.assertTrue(mariana.debe_cambiar_password)

    def test_cupos(self):
        seed()
        self.assertEqual(grupo("EC504").cupo_disponible, 0)
        self.assertEqual(grupo("EC605").cupo_disponible, 8)

    def test_choques_disponibles_para_probar(self):
        seed()
        carlos = Estudiante.objects.get(matricula="210089334")
        horario_carlos = list(
            HorarioGrupo.objects.filter(
                grupo__cargas__estudiante=carlos,
                grupo__cargas__estado=CargaAcademica.Estado.INSCRITO,
            )
        )

        def choca(clave):
            return any(
                h.traslapa_con(mio) for h in grupo(clave).horarios.all() for mio in horario_carlos
            )

        self.assertTrue(choca("EC606"))  # lun y mié 7 a 9, igual que EC601
        self.assertFalse(choca("EC605"))

    def test_convocatoria_abierta_por_defecto(self):
        seed()
        self.assertTrue(PeriodoEscolar.objects.get(activo=True).convocatoria_abierta)

    def test_convocatoria_cerrada(self):
        seed(convocatoria_cerrada=True)
        self.assertFalse(PeriodoEscolar.objects.get(activo=True).convocatoria_abierta)

    def test_desactiva_otro_periodo_activo(self):
        otro = PeriodoEscolar.objects.create(
            ciclo="2023-B",
            fecha_inicio="2026-01-12",
            fecha_fin="2026-06-26",
            convocatoria_inicio="2026-01-19T08:00:00Z",
            convocatoria_fin="2026-01-23T23:59:00Z",
            activo=True,
        )
        seed()
        otro.refresh_from_db()
        self.assertFalse(otro.activo)
        self.assertEqual(PeriodoEscolar.objects.get(activo=True).ciclo, "2026-A")

    def test_ciclos_anteriores_y_ultima_modificacion(self):
        seed()
        self.assertEqual(
            list(PeriodoEscolar.objects.order_by("-fecha_inicio").values_list("ciclo", "activo")),
            [("2026-A", True), ("2025-B", False), ("2025-A", False), ("2024-B", False)],
        )
        registro = Bitacora.objects.get()
        self.assertEqual((registro.usuario.username, registro.accion), ("valeria.ruiz", "activar_periodo"))
        self.assertTrue(registro.entidad.endswith("(2026-A)"))


@override_settings(DEBUG=False)
class SeedDemoProduccionTests(TestCase):
    def test_sin_bandera_se_niega(self):
        with self.assertRaises(CommandError):
            seed()
        self.assertFalse(Usuario.objects.exists())

    def test_con_bandera_corre(self):
        seed(permitir_produccion=True)
        self.assertTrue(Usuario.objects.filter(username="admin").exists())
