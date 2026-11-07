"""
Datos de demostración iguales a los del prototipo (stitch/).

    python manage.py seed_demo
    python manage.py seed_demo --convocatoria-cerrada   # para probar solicitudes extemporáneas

Se puede correr las veces que quieras: actualiza lo que existe y deja los datos
de demostración como al inicio (contraseñas y cargas incluidas).
"""

from datetime import date, time, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core.models import (
    CargaAcademica,
    Docente,
    Estudiante,
    Grupo,
    HorarioGrupo,
    PeriodoEscolar,
    Programa,
    Rol,
    Turno,
    UnidadAprendizaje,
    Usuario,
)

PASSWORD_DEMO = "demo1234"
PASSWORD_TEMPORAL = "temporal"

ECONOMIA = "Economía"
FINANZAS = "Finanzas"
PROGRAMAS = [ECONOMIA, FINANZAS]

CICLO = "2026-A"
SEMESTRE_INICIO = date(2026, 8, 3)
SEMESTRE_FIN = date(2026, 12, 18)

# nombre (tal como se muestra en el prototipo) -> grado académico
DOCENTES = {
    "Dra. Marta Gómez Rendón": "Doctorado",
    "Mtro. Jorge Herrera Cárdenas": "Maestría",
    "Dra. Celia Navarro Tovar": "Doctorado",
    "Dr. Raúl Salinas Parra": "Doctorado",
    "Dr. Hugo Valdez Miranda": "Doctorado",
    "Dra. Sofía Barba Ortiz": "Doctorado",
    "Dra. Lorena Trejo": "Doctorado",
    "Dr. Ernesto Morales": "Doctorado",
    "Mtra. Karla Del Real": "Maestría",
}

D = HorarioGrupo.Dia
LUN_MIE = [D.LUNES, D.MIERCOLES]
MAR_JUE = [D.MARTES, D.JUEVES]

# Cada grupo: materia, grupo, docente, días, horas, aula y cupo máximo.
# EC606 choca con EC601 (lun y mié 7 a 9) y EC504 queda lleno con las cargas de abajo.
GRUPOS = [
    {"clave": "EC601", "materia": "Macroeconomía III", "programa": ECONOMIA, "gpo": "01",
     "docente": "Dra. Marta Gómez Rendón", "dias": LUN_MIE, "horas": (7, 9), "aula": "E-204", "cupo": 30},
    {"clave": "EC602", "materia": "Finanzas Públicas", "programa": ECONOMIA, "gpo": "01",
     "docente": "Mtro. Jorge Herrera Cárdenas", "dias": LUN_MIE, "horas": (9, 11), "aula": "E-102", "cupo": 30},
    {"clave": "EC603", "materia": "Desarrollo Regional", "programa": ECONOMIA, "gpo": "02",
     "docente": "Dra. Celia Navarro Tovar", "dias": MAR_JUE, "horas": (9, 11), "aula": "E-105", "cupo": 30},
    {"clave": "EC604", "materia": "Seminario de Tesis I", "programa": ECONOMIA, "gpo": "01",
     "docente": "Dr. Raúl Salinas Parra", "dias": [D.VIERNES], "horas": (7, 11), "aula": "Auditorio UAE", "cupo": 30},
    {"clave": "EC605", "materia": "Econometría II", "programa": ECONOMIA, "gpo": "02",
     "docente": "Dr. Hugo Valdez Miranda", "dias": MAR_JUE, "horas": (11, 13), "aula": "E-201", "cupo": 8},
    {"clave": "EC606", "materia": "Comercio Internacional", "programa": ECONOMIA, "gpo": "01",
     "docente": "Dra. Sofía Barba Ortiz", "dias": LUN_MIE, "horas": (7, 9), "aula": "E-203", "cupo": 3},
    {"clave": "EC701", "materia": "Métodos Cuantitativos Aplicados", "programa": ECONOMIA, "gpo": "01",
     "docente": "Dra. Lorena Trejo", "dias": [D.VIERNES], "horas": (11, 15), "aula": "Laboratorio de Cómputo", "cupo": 12},
    {"clave": "EC504", "materia": "Pensamiento Económico II", "programa": ECONOMIA, "gpo": "01",
     "docente": "Dr. Ernesto Morales", "dias": MAR_JUE, "horas": (7, 9), "aula": "E-101", "cupo": 2},
    {"clave": "EC704", "materia": "Economía de la Innovación", "programa": ECONOMIA, "gpo": "01",
     "docente": "Mtra. Karla Del Real", "dias": MAR_JUE, "horas": (13, 15), "aula": "E-202", "cupo": 15,
     "turno": Turno.VESPERTINO},
    {"clave": "FI702", "materia": "Finanzas Corporativas II", "programa": FINANZAS, "gpo": "01",
     "docente": "Dra. Sofía Barba Ortiz", "dias": MAR_JUE, "horas": (10, 12), "aula": "F-101", "cupo": 35},
]

CREDITOS = 8  # el prototipo no muestra créditos

ESTUDIANTES = [
    {"matricula": "210089334", "nombre": "Carlos E.", "apellidos": "Pérez Villa",
     "email": "carlos.perez.v@uan.edu.mx", "programa": ECONOMIA, "semestre": 6},
    {"matricula": "220011456", "nombre": "Diego Armando", "apellidos": "Solís Nuño",
     "email": "diego.solis@uan.edu.mx", "programa": ECONOMIA, "semestre": 4},
    {"matricula": "200078511", "nombre": "Luis F.", "apellidos": "Cárdenas Ibarra",
     "email": "luis.cardenas@uan.edu.mx", "programa": ECONOMIA, "semestre": 7},
    {"matricula": "200045129", "nombre": "Andrea", "apellidos": "Ramos",
     "email": "andrea.ramos@uan.edu.mx", "programa": FINANZAS, "semestre": 7},
    # Primer acceso: entra con la contraseña temporal y debe cambiarla.
    {"matricula": "230012345", "nombre": "Mariana", "apellidos": "Gómez Torres",
     "email": "mariana.gomez@uan.edu.mx", "programa": ECONOMIA, "semestre": 2, "temporal": True},
]

PERSONAL = [
    {"username": "valeria.ruiz", "nombre": "Valeria M.", "apellidos": "Ruiz",
     "email": "valeria.ruiz@uan.edu.mx", "rol": Rol.CONTROL_ESCOLAR},
    {"username": "roberto.pena", "nombre": "Roberto", "apellidos": "Peña",
     "email": "roberto.pena@uan.edu.mx", "rol": Rol.CONTROL_ESCOLAR},
    {"username": "admin", "nombre": "Administrador", "apellidos": "SABE",
     "email": "admin@uan.edu.mx", "rol": Rol.ADMINISTRADOR},
]

# matrícula -> claves de materia inscritas
CARGAS = {
    "210089334": ["EC601", "EC602", "EC603", "EC604"],
    "220011456": ["EC504"],
    "200078511": ["EC504"],
    "200045129": ["FI702"],
}


class Command(BaseCommand):
    help = "Carga los datos de demostración del prototipo (se puede correr varias veces)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--convocatoria-cerrada",
            action="store_true",
            help="Deja la convocatoria cerrada desde ayer (para probar solicitudes extemporáneas).",
        )
        parser.add_argument(
            "--permitir-produccion",
            action="store_true",
            help="Necesario si DEBUG está apagado. Solo para el ambiente de demostración.",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["permitir_produccion"]:
            raise CommandError(
                "DEBUG está apagado. Si de verdad es el ambiente de demostración, "
                "agrega --permitir-produccion."
            )

        with transaction.atomic():
            programas = self._programas()
            periodo = self._periodo(options["convocatoria_cerrada"])
            docentes = self._docentes()
            grupos = self._materias_y_grupos(programas, docentes, periodo)
            estudiantes = self._usuarios(programas)
            self._cargas(estudiantes, grupos)

        self._resumen(periodo)

    def _programas(self):
        return {nombre: Programa.objects.get_or_create(nombre=nombre)[0] for nombre in PROGRAMAS}

    def _periodo(self, cerrada):
        ahora = timezone.now()
        if cerrada:
            inicio, fin = ahora - timedelta(days=9), ahora - timedelta(days=1)
        else:
            inicio, fin = ahora - timedelta(days=2), ahora + timedelta(days=7)

        # Solo un periodo activo: apagar los demás antes de activar este.
        PeriodoEscolar.objects.exclude(ciclo=CICLO).filter(activo=True).update(activo=False)
        periodo, _ = PeriodoEscolar.objects.update_or_create(
            ciclo=CICLO,
            defaults={
                "fecha_inicio": SEMESTRE_INICIO,
                "fecha_fin": SEMESTRE_FIN,
                "convocatoria_inicio": inicio,
                "convocatoria_fin": fin,
                "activo": True,
            },
        )
        return periodo

    def _docentes(self):
        return {
            nombre: Docente.objects.update_or_create(
                nombre=nombre,
                defaults={"grado_academico": grado, "departamento": "Unidad Académica de Economía"},
            )[0]
            for nombre, grado in DOCENTES.items()
        }

    def _materias_y_grupos(self, programas, docentes, periodo):
        grupos = {}
        for g in GRUPOS:
            materia, _ = UnidadAprendizaje.objects.update_or_create(
                clave=g["clave"],
                defaults={
                    "nombre_materia": g["materia"],
                    "creditos": CREDITOS,
                    "programa": programas[g["programa"]],
                },
            )
            grupo, _ = Grupo.objects.update_or_create(
                materia=materia,
                periodo=periodo,
                num_grupo=g["gpo"],
                defaults={
                    "docente": docentes[g["docente"]],
                    "turno": g.get("turno", Turno.MATUTINO),
                    "cupo_maximo": g["cupo"],
                    "visible": True,
                },
            )
            inicio, fin = time(g["horas"][0]), time(g["horas"][1])
            # Quitar horarios que ya no están en los datos, luego crear o actualizar los vigentes.
            grupo.horarios.exclude(dia_semana__in=g["dias"]).delete()
            for dia in g["dias"]:
                grupo.horarios.filter(dia_semana=dia).exclude(hora_inicio=inicio).delete()
                HorarioGrupo.objects.update_or_create(
                    grupo=grupo,
                    dia_semana=dia,
                    hora_inicio=inicio,
                    defaults={"hora_fin": fin, "aula": g["aula"]},
                )
            grupos[g["clave"]] = grupo
        return grupos

    def _usuario(self, username, nombre, apellidos, email, rol, password, debe_cambiar=False):
        usuario, _ = Usuario.objects.update_or_create(
            username=username,
            defaults={
                "first_name": nombre,
                "last_name": apellidos,
                "email": email,
                "rol": rol,
                "is_active": True,
                "is_staff": rol == Rol.ADMINISTRADOR,
                "is_superuser": rol == Rol.ADMINISTRADOR,
                "debe_cambiar_password": debe_cambiar,
            },
        )
        # Siempre se restablece para que las credenciales de demostración funcionen.
        usuario.set_password(password)
        usuario.save(update_fields=["password"])
        return usuario

    def _usuarios(self, programas):
        for p in PERSONAL:
            self._usuario(p["username"], p["nombre"], p["apellidos"], p["email"], p["rol"], PASSWORD_DEMO)

        estudiantes = {}
        for e in ESTUDIANTES:
            temporal = e.get("temporal", False)
            usuario = self._usuario(
                e["matricula"], e["nombre"], e["apellidos"], e["email"], Rol.ESTUDIANTE,
                PASSWORD_TEMPORAL if temporal else PASSWORD_DEMO, debe_cambiar=temporal,
            )
            estudiante, _ = Estudiante.objects.update_or_create(
                usuario=usuario,
                defaults={
                    "matricula": e["matricula"],
                    "programa": programas[e["programa"]],
                    "semestre": e["semestre"],
                    "turno": Turno.MATUTINO,
                },
            )
            estudiantes[e["matricula"]] = estudiante
        return estudiantes

    def _cargas(self, estudiantes, grupos):
        for matricula, claves in CARGAS.items():
            for clave in claves:
                CargaAcademica.objects.update_or_create(
                    estudiante=estudiantes[matricula],
                    grupo=grupos[clave],
                    defaults={
                        "estado": CargaAcademica.Estado.INSCRITO,
                        "origen": CargaAcademica.Origen.IMPORTACION,
                    },
                )

    def _resumen(self, periodo):
        estado = "abierta" if periodo.convocatoria_abierta else "cerrada"
        self.stdout.write(self.style.SUCCESS("Datos de demostración listos."))
        self.stdout.write(
            f"  Periodo {periodo.ciclo} activo, convocatoria {estado} "
            f"hasta {timezone.localtime(periodo.convocatoria_fin):%d/%m/%Y %H:%M}."
        )
        self.stdout.write(
            f"  {Grupo.objects.filter(periodo=periodo).count()} grupos, "
            f"{Estudiante.objects.count()} estudiantes, "
            f"{CargaAcademica.objects.filter(estado=CargaAcademica.Estado.INSCRITO).count()} cargas inscritas."
        )
        self.stdout.write("  Accesos:")
        self.stdout.write(f"    estudiante       210089334 / {PASSWORD_DEMO}")
        self.stdout.write(f"    primer acceso    230012345 / {PASSWORD_TEMPORAL}")
        self.stdout.write(f"    control escolar  valeria.ruiz / {PASSWORD_DEMO}")
        self.stdout.write(f"    administrador    admin / {PASSWORD_DEMO}")
