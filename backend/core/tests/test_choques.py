from datetime import time
from io import StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings

from core.models import Estudiante, Grupo, HorarioGrupo, PeriodoEscolar
from core.services.choques import choques_con_carga

D = HorarioGrupo.Dia


@override_settings(DEBUG=True)
class ChoquesConCargaTests(TestCase):
    """Comparación de un grupo contra la carga inscrita. F4 agrega aquí las reglas del folio."""

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
