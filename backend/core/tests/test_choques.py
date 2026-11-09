from datetime import time
from io import StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings

from core.models import DetalleSolicitud, Estudiante, Grupo, HorarioGrupo, PeriodoEscolar, Solicitud
from core.services.choques import Origen, choques_con_carga, choques_contra, ocupacion

D = HorarioGrupo.Dia


@override_settings(DEBUG=True)
class ChoquesConCargaTests(TestCase):
    """Comparación de un grupo contra la carga inscrita."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", stdout=StringIO())
        cls.periodo = PeriodoEscolar.objects.get(activo=True)
        # Inscrito en EC601 (lun y mié 7-9), EC602 (lun y mié 9-11), EC603 (mar y jue 9-11), EC604 (vie 7-11).
        cls.alumno = Estudiante.objects.get(matricula="210089334")

    def grupo(self, clave):
        return Grupo.objects.get(materia__clave=clave, periodo=self.periodo)

    def choques(self, grupo):
        return choques_con_carga(self.alumno, self.periodo, [grupo])[grupo.pk]

    def test_sin_choque(self):
        self.assertEqual(self.choques(self.grupo("EC605")), [])  # mar y jue 11-13

    def test_choque_con_carga_agrupa_los_dias(self):
        [choque] = self.choques(self.grupo("EC606"))  # lun y mié 7-9
        self.assertEqual(choque.choca_con, self.grupo("EC601"))
        self.assertEqual(choque.dias, [D.LUNES, D.MIERCOLES])
        self.assertEqual((choque.hora_inicio, choque.hora_fin), (time(7), time(9)))

    def test_extremos_que_se_tocan_no_chocan(self):
        g = self.grupo("EC605")
        g.horarios.all().delete()
        HorarioGrupo.objects.create(grupo=g, dia_semana=D.LUNES, hora_inicio=time(11), hora_fin=time(13))
        HorarioGrupo.objects.create(grupo=g, dia_semana=D.VIERNES, hora_inicio=time(11), hora_fin=time(12))
        self.assertEqual(self.choques(g), [])  # EC602 termina 11:00, EC604 termina 11:00

    def test_mismo_horario_en_otro_dia_no_choca(self):
        g = self.grupo("EC605")
        g.horarios.all().delete()
        HorarioGrupo.objects.create(grupo=g, dia_semana=D.SABADO, hora_inicio=time(7), hora_fin=time(9))
        self.assertEqual(self.choques(g), [])

    def test_traslape_parcial_es_choque(self):
        g = self.grupo("EC605")
        g.horarios.all().delete()
        HorarioGrupo.objects.create(grupo=g, dia_semana=D.VIERNES, hora_inicio=time(10), hora_fin=time(12))
        [choque] = self.choques(g)
        self.assertEqual(choque.choca_con, self.grupo("EC604"))
        self.assertEqual(choque.dias, [D.VIERNES])

    def test_un_grupo_inscrito_no_choca_consigo_mismo(self):
        self.assertEqual(self.choques(self.grupo("EC601")), [])

    def test_solo_cuenta_la_carga_del_periodo(self):
        self.periodo.activo = False
        self.periodo.save(update_fields=["activo"])
        otro = PeriodoEscolar.objects.create(
            ciclo="2026-B",
            fecha_inicio=self.periodo.fecha_inicio,
            fecha_fin=self.periodo.fecha_fin,
            convocatoria_inicio=self.periodo.convocatoria_inicio,
            convocatoria_fin=self.periodo.convocatoria_fin,
            activo=True,
        )
        g = self.grupo("EC606")
        self.assertEqual(choques_con_carga(self.alumno, otro, [g])[g.pk], [])


@override_settings(DEBUG=True)
class OcupacionTests(TestCase):
    """Qué ocupa el horario del alumno: carga inscrita, bajas que pide y trámites pendientes (F4)."""

    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo", stdout=StringIO())
        cls.periodo = PeriodoEscolar.objects.get(activo=True)
        cls.alumno = Estudiante.objects.get(matricula="210089334")

    def grupo(self, clave):
        return Grupo.objects.get(materia__clave=clave, periodo=self.periodo)

    def folio(self, numero, movimientos, estado="pendiente"):
        solicitud = Solicitud.objects.create(
            folio_digital=f"SABE-2026-{numero:03d}", estudiante=self.alumno, periodo=self.periodo
        )
        for clave, tipo in movimientos:
            extra = {"motivo_rechazo": "x"} if estado == "rechazada" else {}
            DetalleSolicitud.objects.create(
                solicitud=solicitud, grupo=self.grupo(clave), tipo_tramite=tipo, estado=estado, **extra
            )
        return solicitud

    def choques(self, clave, **opciones):
        return choques_contra(self.grupo(clave), ocupacion(self.alumno, self.periodo, **opciones))

    def nuevo_grupo(self, dia, inicio, fin):
        base = self.grupo("EC701")
        g = Grupo.objects.create(
            materia=base.materia, docente=base.docente, periodo=self.periodo,
            num_grupo="07", turno="matutino", cupo_maximo=20,
        )
        HorarioGrupo.objects.create(grupo=g, dia_semana=dia, hora_inicio=time(inicio), hora_fin=time(fin))
        return Grupo.objects.prefetch_related("horarios").get(pk=g.pk)

    def test_baja_del_mismo_folio_libera_el_horario(self):
        # D2: baja de EC601 + alta de EC606 es un cambio de grupo, no un choque.
        self.assertEqual(len(self.choques("EC606")), 1)
        self.assertEqual(self.choques("EC606", bajas=[self.grupo("EC601")]), [])

    def test_alta_pendiente_de_otro_folio_ocupa_horario(self):
        self.folio(1, [("EC605", "ALTA")])  # mar y jue 11-13
        nuevo = self.nuevo_grupo(D.JUEVES, 12, 14)
        [choque] = choques_contra(nuevo, ocupacion(self.alumno, self.periodo))
        self.assertEqual((choque.choca_con, choque.origen, choque.dias), (self.grupo("EC605"), Origen.EN_TRAMITE, [D.JUEVES]))

    def test_baja_pendiente_de_otro_folio_libera_el_horario(self):
        self.folio(1, [("EC601", "BAJA")])
        self.assertEqual(self.choques("EC606"), [])

    def test_solo_cuentan_los_pendientes(self):
        self.folio(1, [("EC601", "BAJA")], estado="rechazada")
        self.assertEqual(len(self.choques("EC606")), 1)

    def test_sin_contar_pendientes_solo_la_carga(self):
        # Así valida F6 al aprobar: una baja pendiente todavía puede rechazarse.
        self.folio(1, [("EC601", "BAJA")])
        self.assertEqual(len(self.choques("EC606", contar_pendientes=False)), 1)

    def test_excluir_el_folio_que_se_revisa(self):
        folio = self.folio(1, [("EC601", "BAJA")])
        self.assertEqual(len(self.choques("EC606", excluir_solicitud=folio)), 1)

    def test_origen_inscrita(self):
        [choque] = self.choques("EC606")
        self.assertEqual(choque.origen, Origen.INSCRITA)
