"""
SABE - Sistema de Altas y Bajas de Economía (UAE - UAN)

Modelos del backend. Reflejan el ERD en diagramas/SABE_ERD_Backend.png.
Requiere Django 5.1+ y PostgreSQL. En settings.py:

    AUTH_USER_MODEL = "core.Usuario"

Equivalencias con el ERD:
    usuarios.password_hash   -> AbstractUser.password (Django lo guarda ya cifrado)
    usuarios.nombre          -> AbstractUser.first_name
    usuarios.apellidos       -> AbstractUser.last_name
    usuarios.activo          -> AbstractUser.is_active
    usuarios.fecha_registro  -> AbstractUser.date_joined
"""

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.utils import timezone


# ---------------------------------------------------------------------------
# 1. Personas y acceso
# ---------------------------------------------------------------------------

class Rol(models.TextChoices):
    ESTUDIANTE = "estudiante", "Estudiante"
    CONTROL_ESCOLAR = "control_escolar", "Control escolar"
    ADMINISTRADOR = "administrador", "Administrador"


class Usuario(AbstractUser):
    """Cuenta de acceso. Para alumnos, username = matrícula."""

    rol = models.CharField(max_length=20, choices=Rol.choices, default=Rol.ESTUDIANTE)
    # True cuando la cuenta se creó por CSV con contraseña temporal.
    debe_cambiar_password = models.BooleanField(default=False)

    class Meta:
        db_table = "usuarios"

    def __str__(self):
        return f"{self.username} ({self.get_rol_display()})"


class Programa(models.Model):
    """Licenciatura: Economía, Finanzas."""

    nombre = models.CharField(max_length=100, unique=True)

    class Meta:
        db_table = "programas"

    def __str__(self):
        return self.nombre


class Turno(models.TextChoices):
    MATUTINO = "matutino", "Matutino"
    VESPERTINO = "vespertino", "Vespertino"


class Estudiante(models.Model):
    """Datos propios del alumno. 1 a 1 con Usuario."""

    usuario = models.OneToOneField(
        Usuario, on_delete=models.CASCADE, related_name="perfil_estudiante"
    )
    matricula = models.CharField(max_length=20, unique=True)
    programa = models.ForeignKey(Programa, on_delete=models.PROTECT, related_name="estudiantes")
    semestre = models.PositiveSmallIntegerField()
    turno = models.CharField(max_length=12, choices=Turno.choices, blank=True)

    class Meta:
        db_table = "estudiantes"

    def __str__(self):
        return self.matricula


# ---------------------------------------------------------------------------
# 2. Catálogo académico (lo mantiene control escolar)
# ---------------------------------------------------------------------------

class Docente(models.Model):
    nombre = models.CharField(max_length=150)
    grado_academico = models.CharField(max_length=100, blank=True)
    departamento = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = "docentes"

    def __str__(self):
        return self.nombre


class PeriodoEscolar(models.Model):
    """Ciclo escolar y su ventana de convocatoria para altas y bajas."""

    ciclo = models.CharField(max_length=10, unique=True)  # "2026-A"
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    convocatoria_inicio = models.DateTimeField()
    convocatoria_fin = models.DateTimeField()
    activo = models.BooleanField(default=False)

    class Meta:
        db_table = "periodos_escolares"
        constraints = [
            # Solo un periodo activo a la vez.
            models.UniqueConstraint(
                fields=["activo"], condition=Q(activo=True), name="un_solo_periodo_activo"
            ),
            models.CheckConstraint(
                condition=Q(fecha_fin__gt=models.F("fecha_inicio")),
                name="periodo_fechas_validas",
            ),
            models.CheckConstraint(
                condition=Q(convocatoria_fin__gt=models.F("convocatoria_inicio")),
                name="convocatoria_fechas_validas",
            ),
        ]

    def __str__(self):
        return self.ciclo

    @property
    def convocatoria_abierta(self):
        ahora = timezone.now()
        return self.convocatoria_inicio <= ahora <= self.convocatoria_fin


class UnidadAprendizaje(models.Model):
    """Materia en abstracto (sin horario ni docente)."""

    clave = models.CharField(max_length=20, unique=True)  # "ECO-302"
    nombre_materia = models.CharField(max_length=150)
    creditos = models.PositiveSmallIntegerField()
    programa = models.ForeignKey(Programa, on_delete=models.PROTECT, related_name="materias")
    area = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = "unidades_aprendizaje"

    def __str__(self):
        return f"{self.clave} {self.nombre_materia}"


class Grupo(models.Model):
    """Materia concreta ofrecida en un periodo, con docente y cupo."""

    materia = models.ForeignKey(UnidadAprendizaje, on_delete=models.PROTECT, related_name="grupos")
    docente = models.ForeignKey(Docente, on_delete=models.PROTECT, related_name="grupos")
    periodo = models.ForeignKey(PeriodoEscolar, on_delete=models.PROTECT, related_name="grupos")
    num_grupo = models.CharField(max_length=10)
    turno = models.CharField(max_length=12, choices=Turno.choices, blank=True)
    cupo_maximo = models.PositiveSmallIntegerField()
    # Si el grupo aparece en el portal del estudiante.
    visible = models.BooleanField(default=True)

    class Meta:
        db_table = "grupos"
        constraints = [
            models.UniqueConstraint(
                fields=["materia", "periodo", "num_grupo"], name="grupo_unico_por_periodo"
            )
        ]

    def __str__(self):
        return f"{self.materia.clave} gpo {self.num_grupo} ({self.periodo.ciclo})"

    @property
    def inscritos(self):
        return self.cargas.filter(estado=CargaAcademica.Estado.INSCRITO).count()

    @property
    def cupo_disponible(self):
        """El cupo disponible se calcula, no se guarda, para que nunca se desincronice."""
        return self.cupo_maximo - self.inscritos


class HorarioGrupo(models.Model):
    """Una fila por día de clase. Lun-Mié-Vie 8 a 10 son 3 filas."""

    class Dia(models.IntegerChoices):
        LUNES = 1, "Lunes"
        MARTES = 2, "Martes"
        MIERCOLES = 3, "Miércoles"
        JUEVES = 4, "Jueves"
        VIERNES = 5, "Viernes"
        SABADO = 6, "Sábado"

    grupo = models.ForeignKey(Grupo, on_delete=models.CASCADE, related_name="horarios")
    dia_semana = models.PositiveSmallIntegerField(choices=Dia.choices)
    hora_inicio = models.TimeField()
    hora_fin = models.TimeField()
    aula = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = "horarios_grupo"
        constraints = [
            models.CheckConstraint(
                condition=Q(hora_fin__gt=models.F("hora_inicio")), name="horario_horas_validas"
            ),
            models.UniqueConstraint(
                fields=["grupo", "dia_semana", "hora_inicio"], name="horario_unico_por_grupo"
            ),
        ]

    def __str__(self):
        return f"{self.get_dia_semana_display()} {self.hora_inicio:%H:%M}-{self.hora_fin:%H:%M}"

    def traslapa_con(self, otro: "HorarioGrupo") -> bool:
        """Mismo día y rangos que se cruzan (tocar extremos no cuenta como choque)."""
        return (
            self.dia_semana == otro.dia_semana
            and self.hora_inicio < otro.hora_fin
            and otro.hora_inicio < self.hora_fin
        )


# ---------------------------------------------------------------------------
# 3. Lo que el alumno ya tiene inscrito
# ---------------------------------------------------------------------------

class CargaAcademica(models.Model):
    """
    Grupos en los que está el alumno. Base para detectar choques.
    Se llena por CSV (carga regular) y por altas/bajas aprobadas.
    """

    class Estado(models.TextChoices):
        INSCRITO = "inscrito", "Inscrito"
        BAJA = "baja", "Baja"

    class Origen(models.TextChoices):
        IMPORTACION = "importacion", "Importación CSV"
        SOLICITUD = "solicitud", "Solicitud aprobada"

    estudiante = models.ForeignKey(Estudiante, on_delete=models.CASCADE, related_name="cargas")
    grupo = models.ForeignKey(Grupo, on_delete=models.PROTECT, related_name="cargas")
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.INSCRITO)
    origen = models.CharField(max_length=12, choices=Origen.choices)

    class Meta:
        db_table = "carga_academica"
        constraints = [
            models.UniqueConstraint(fields=["estudiante", "grupo"], name="carga_unica")
        ]

    def __str__(self):
        return f"{self.estudiante} -> {self.grupo} ({self.estado})"


# ---------------------------------------------------------------------------
# 4. El trámite
# ---------------------------------------------------------------------------

class LoteExportacion(models.Model):
    """Cada descarga del reporte para SADCE. Respalda 'marcar como cargado'."""

    class Formato(models.TextChoices):
        XLSX = "xlsx", "Excel"
        CSV = "csv", "CSV"

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="lotes_exportados"
    )
    fecha = models.DateTimeField(auto_now_add=True)
    formato = models.CharField(max_length=4, choices=Formato.choices)
    total_registros = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "lotes_exportacion"

    def __str__(self):
        return f"Lote {self.pk} ({self.fecha:%Y-%m-%d})"


class Solicitud(models.Model):
    """El folio: contenedor de uno o más movimientos."""

    folio_digital = models.CharField(max_length=20, unique=True)  # "SABE-2026-089"
    estudiante = models.ForeignKey(Estudiante, on_delete=models.PROTECT, related_name="solicitudes")
    periodo = models.ForeignKey(PeriodoEscolar, on_delete=models.PROTECT, related_name="solicitudes")
    justificacion = models.TextField(blank=True)
    fecha_solicitud = models.DateTimeField(auto_now_add=True)
    # Enviada después de convocatoria_fin. Se guarda al crearla: si luego cambian las fechas, no cambia.
    extemporanea = models.BooleanField(default=False)

    class Meta:
        db_table = "solicitudes"
        ordering = ["-fecha_solicitud"]

    def __str__(self):
        return self.folio_digital

    @property
    def estado(self):
        """
        Estado del folio, derivado de sus movimientos:
        pendiente si queda alguno por resolver; si no, aprobada, cargada en SADCE, rechazada
        o cancelada, en ese orden (el primero que tenga algún movimiento).
        """
        # detalles.all() usa el prefetch si lo hay (listados sin una consulta por folio).
        estados = {detalle.estado for detalle in self.detalles.all()}
        E = DetalleSolicitud.Estado
        if not estados or E.PENDIENTE in estados:
            return E.PENDIENTE
        # Ya no queda nada pendiente: manda el resultado más favorable al alumno.
        for estado in (E.APROBADA, E.CARGADA_SADCE, E.RECHAZADA):
            if estado in estados:
                return estado
        return E.CANCELADA


class DetalleSolicitud(models.Model):
    """Un movimiento (alta o baja) dentro de un folio. Aquí decide control escolar."""

    class Tipo(models.TextChoices):
        ALTA = "ALTA", "Alta"
        BAJA = "BAJA", "Baja"

    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        APROBADA = "aprobada", "Aprobada"
        RECHAZADA = "rechazada", "Rechazada"
        CARGADA_SADCE = "cargada_sadce", "Cargada en SADCE"
        CANCELADA = "cancelada", "Cancelada"

    solicitud = models.ForeignKey(Solicitud, on_delete=models.CASCADE, related_name="detalles")
    grupo = models.ForeignKey(Grupo, on_delete=models.PROTECT, related_name="detalles")
    tipo_tramite = models.CharField(max_length=4, choices=Tipo.choices)
    estado = models.CharField(max_length=15, choices=Estado.choices, default=Estado.PENDIENTE)
    motivo_rechazo = models.TextField(blank=True)
    # Caso extemporáneo autorizado por coordinación o subdirección.
    visto_bueno = models.BooleanField(default=False)
    revisado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="movimientos_revisados",
    )
    fecha_resolucion = models.DateTimeField(null=True, blank=True)
    lote = models.ForeignKey(
        LoteExportacion, null=True, blank=True, on_delete=models.SET_NULL, related_name="movimientos"
    )

    class Meta:
        db_table = "detalle_solicitud"
        constraints = [
            # Un rechazo siempre lleva motivo.
            models.CheckConstraint(
                condition=~Q(estado="rechazada") | ~Q(motivo_rechazo=""),
                name="rechazo_requiere_motivo",
            ),
            # No repetir la misma materia dentro de un folio.
            models.UniqueConstraint(
                fields=["solicitud", "grupo"], name="movimiento_unico_por_folio"
            ),
        ]

    def __str__(self):
        return f"{self.tipo_tramite} {self.grupo} [{self.estado}]"


# ---------------------------------------------------------------------------
# 5. Avisos y auditoría
# ---------------------------------------------------------------------------

class Notificacion(models.Model):
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notificaciones"
    )
    mensaje = models.CharField(max_length=255)
    leida = models.BooleanField(default=False)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notificaciones"
        ordering = ["-fecha"]

    def __str__(self):
        return f"{self.usuario}: {self.mensaje[:40]}"


class Bitacora(models.Model):
    """Registro de quién hizo qué. Solo se inserta, no se edita."""

    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="bitacora"
    )
    accion = models.CharField(max_length=100)  # "aprobar", "rechazar", "exportar", "importar_csv"
    entidad = models.CharField(max_length=100, blank=True)  # "DetalleSolicitud #12"
    ip = models.GenericIPAddressField(null=True, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "bitacora"
        ordering = ["-fecha"]

    def __str__(self):
        return f"{self.fecha:%Y-%m-%d %H:%M} {self.accion}"
