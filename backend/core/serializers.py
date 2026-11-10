import re

from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import (
    DetalleSolicitud,
    Docente,
    Estudiante,
    Grupo,
    HorarioGrupo,
    PeriodoEscolar,
    Programa,
    Solicitud,
    Usuario,
)
from .services.bandeja import EstadoBandeja, estado_bandeja
from .services.catalogo import con_cupo
from .services.choques import Origen
from .services.periodos import EstadoConvocatoria, estado_convocatoria
from .services.validacion import Codigo, Movimiento


class PerfilEstudianteSerializer(serializers.ModelSerializer):
    programa = serializers.CharField(source="programa.nombre")

    class Meta:
        model = Estudiante
        fields = ["matricula", "programa", "semestre", "turno"]


class MeSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(source="first_name")
    apellidos = serializers.CharField(source="last_name")
    estudiante = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = ["id", "username", "nombre", "apellidos", "email", "rol", "debe_cambiar_password", "estudiante"]

    @extend_schema_field(PerfilEstudianteSerializer(allow_null=True))
    def get_estudiante(self, usuario):
        perfil = getattr(usuario, "perfil_estudiante", None)
        return PerfilEstudianteSerializer(perfil).data if perfil else None


class CambiarPasswordSerializer(serializers.Serializer):
    actual = serializers.CharField(write_only=True, trim_whitespace=False)
    nueva = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_actual(self, valor):
        if not self.context["request"].user.check_password(valor):
            raise serializers.ValidationError("La contraseña actual no es correcta.")
        return valor

    def validate(self, datos):
        usuario = self.context["request"].user
        if datos["nueva"] == datos["actual"]:
            raise serializers.ValidationError({"nueva": ["La nueva contraseña debe ser distinta de la actual."]})
        try:
            password_validation.validate_password(datos["nueva"], user=usuario)
        except DjangoValidationError as error:
            raise serializers.ValidationError({"nueva": list(error.messages)}) from error
        return datos

    def save(self):
        usuario = self.context["request"].user
        usuario.set_password(self.validated_data["nueva"])
        usuario.debe_cambiar_password = False
        usuario.save(update_fields=["password", "debe_cambiar_password"])
        return usuario


# ---------------------------------------------------------------------------
# Catálogo y horario del estudiante (F3)
# ---------------------------------------------------------------------------


class PeriodoActivoSerializer(serializers.ModelSerializer):
    convocatoria_abierta = serializers.BooleanField(read_only=True)

    class Meta:
        model = PeriodoEscolar
        fields = ["ciclo", "convocatoria_inicio", "convocatoria_fin", "convocatoria_abierta"]


class HorarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = HorarioGrupo
        fields = ["dia_semana", "hora_inicio", "hora_fin", "aula"]


class MateriaResumenSerializer(serializers.Serializer):
    clave = serializers.CharField()
    nombre = serializers.CharField(source="nombre_materia")
    creditos = serializers.IntegerField()
    programa = serializers.CharField(source="programa.nombre")


class ChoqueSerializer(serializers.Serializer):
    """Con qué grupo choca, qué días y a qué hora (horario de ese grupo), y por qué ocupa el horario."""

    grupo = serializers.IntegerField(source="choca_con.pk")
    materia = serializers.CharField(source="choca_con.materia.nombre_materia")
    num_grupo = serializers.CharField(source="choca_con.num_grupo")
    dias = serializers.ListField(child=serializers.IntegerField())
    hora_inicio = serializers.TimeField()
    hora_fin = serializers.TimeField()
    origen = serializers.ChoiceField(choices=[o.value for o in Origen])


class ErrorMovimientoSerializer(serializers.Serializer):
    codigo = serializers.ChoiceField(choices=[c.value for c in Codigo])
    detalle = serializers.CharField()


class GrupoSerializer(serializers.ModelSerializer):
    """
    Grupo del catálogo. Espera un queryset pasado por `services.catalogo.con_cupo`
    (trae `cupo_libre`) y, para alumnos, `context["choques"]` = {grupo_id: [Choque]}
    y `context["errores"]` = {grupo_id: [ErrorMovimiento]} si pidiera el alta.
    """

    materia = MateriaResumenSerializer()
    docente = serializers.CharField(source="docente.nombre")
    cupo_disponible = serializers.IntegerField(source="cupo_libre")
    horarios = HorarioSerializer(many=True)
    choques = serializers.SerializerMethodField()
    errores = serializers.SerializerMethodField()

    class Meta:
        model = Grupo
        fields = [
            "id", "materia", "num_grupo", "docente", "turno",
            "cupo_maximo", "cupo_disponible", "horarios", "visible", "choques", "errores",
        ]

    @extend_schema_field(ChoqueSerializer(many=True))
    def get_choques(self, grupo):
        choques = self.context.get("choques", {}).get(grupo.pk, [])
        return ChoqueSerializer(choques, many=True).data

    @extend_schema_field(ErrorMovimientoSerializer(many=True))
    def get_errores(self, grupo):
        errores = self.context.get("errores", {}).get(grupo.pk, [])
        return ErrorMovimientoSerializer(errores, many=True).data


class EnTramiteSerializer(serializers.ModelSerializer):
    grupo = GrupoSerializer()
    folio = serializers.CharField(source="solicitud.folio_digital")

    class Meta:
        model = DetalleSolicitud
        fields = ["id", "grupo", "tipo_tramite", "folio"]


class HorarioEstudianteSerializer(serializers.Serializer):
    """Solo para documentar la respuesta de /api/estudiante/horario/ en Swagger."""

    ciclo = serializers.CharField(allow_null=True)
    inscritas = GrupoSerializer(many=True)
    en_tramite = EnTramiteSerializer(many=True)


# ---------------------------------------------------------------------------
# Validación de movimientos (F4)
# ---------------------------------------------------------------------------


class MovimientoEntradaSerializer(serializers.Serializer):
    grupo = serializers.IntegerField(min_value=1)
    tipo = serializers.ChoiceField(choices=DetalleSolicitud.Tipo.choices)


class ValidarMovimientosSerializer(serializers.Serializer):
    """Entrada de /api/solicitudes/validar/. Devuelve `movimientos` como lista de `Movimiento`."""

    movimientos = MovimientoEntradaSerializer(many=True, allow_empty=False)

    def validate_movimientos(self, movimientos):
        # Una sola consulta para todos los grupos (PrimaryKeyRelatedField haría una por movimiento).
        ids = {m["grupo"] for m in movimientos}
        grupos = {g.pk: g for g in con_cupo(Grupo.objects.filter(pk__in=ids))}
        if faltan := sorted(ids - grupos.keys()):
            raise serializers.ValidationError(
                f"No existe el grupo {', '.join(map(str, faltan))}."
            )
        return [Movimiento(grupos[m["grupo"]], m["tipo"]) for m in movimientos]


class ResultadoMovimientoSerializer(serializers.Serializer):
    grupo = serializers.IntegerField(source="grupo.pk")
    tipo = serializers.ChoiceField(choices=DetalleSolicitud.Tipo.choices)
    choques = ChoqueSerializer(many=True)
    errores = ErrorMovimientoSerializer(many=True)


class ValidacionSerializer(serializers.Serializer):
    valido = serializers.BooleanField()
    movimientos = ResultadoMovimientoSerializer(many=True)


# ---------------------------------------------------------------------------
# Solicitudes del estudiante (F5)
# ---------------------------------------------------------------------------


class CrearSolicitudSerializer(ValidarMovimientosSerializer):
    """Entrada de POST /api/solicitudes/. Las reglas de la justificación están en services.solicitudes."""

    justificacion = serializers.CharField(allow_blank=True)


class EstudianteFolioSerializer(serializers.Serializer):
    matricula = serializers.CharField()
    nombre = serializers.CharField(source="usuario.get_full_name")
    programa = serializers.CharField(source="programa.nombre")
    semestre = serializers.IntegerField()


class MovimientoFolioSerializer(serializers.ModelSerializer):
    grupo = GrupoSerializer()
    revisado_por = serializers.SerializerMethodField()

    class Meta:
        model = DetalleSolicitud
        fields = ["id", "grupo", "tipo_tramite", "estado", "motivo_rechazo", "revisado_por", "fecha_resolucion"]

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_revisado_por(self, detalle):
        usuario = detalle.revisado_por
        return (usuario.get_full_name() or usuario.username) if usuario else None


class ResumenFolioSerializer(serializers.Serializer):
    total = serializers.IntegerField()
    aprobadas = serializers.IntegerField()
    resueltas = serializers.IntegerField()


class SolicitudSerializer(serializers.ModelSerializer):
    """Folio con sus movimientos. Espera el queryset de SolicitudViewSet (todo precargado)."""

    ciclo = serializers.CharField(source="periodo.ciclo")
    estado = serializers.ChoiceField(choices=DetalleSolicitud.Estado.choices, read_only=True)
    # Estado en la bandeja de control escolar (F6); coincide con el filtro ?estado=.
    estado_bandeja = serializers.SerializerMethodField()
    estudiante = EstudianteFolioSerializer()
    movimientos = MovimientoFolioSerializer(source="detalles", many=True)
    resumen = serializers.SerializerMethodField()

    class Meta:
        model = Solicitud
        fields = [
            "id", "folio_digital", "ciclo", "fecha_solicitud", "estado", "estado_bandeja", "extemporanea",
            "justificacion", "estudiante", "movimientos", "resumen",
        ]

    @extend_schema_field(serializers.ChoiceField(choices=[e.value for e in EstadoBandeja]))
    def get_estado_bandeja(self, solicitud):
        return estado_bandeja([d.estado for d in solicitud.detalles.all()]).value

    @extend_schema_field(ResumenFolioSerializer)
    def get_resumen(self, solicitud):
        E = DetalleSolicitud.Estado
        estados = [d.estado for d in solicitud.detalles.all()]
        return {
            "total": len(estados),
            "aprobadas": sum(e in (E.APROBADA, E.CARGADA_SADCE) for e in estados),
            "resueltas": sum(e != E.PENDIENTE for e in estados),
        }


# ---------------------------------------------------------------------------
# Bandeja y dictamen de control escolar (F6)
# ---------------------------------------------------------------------------


class ResumenBandejaSerializer(serializers.Serializer):
    folios_pendientes = serializers.IntegerField()
    movimientos_aprobados = serializers.IntegerField()
    movimientos_rechazados = serializers.IntegerField()
    extemporaneos = serializers.IntegerField()


class RevisionMovimientoSerializer(serializers.Serializer):
    """Qué impide aprobar hoy un movimiento pendiente (listas vacías si se puede aprobar)."""

    id = serializers.IntegerField()
    choques = ChoqueSerializer(many=True)
    errores = ErrorMovimientoSerializer(many=True)


class RevisionSerializer(serializers.Serializer):
    movimientos = RevisionMovimientoSerializer(many=True)


class AprobarSerializer(serializers.Serializer):
    # Obligatorio en folios extemporáneos.
    visto_bueno = serializers.BooleanField(default=False)


class RechazarSerializer(serializers.Serializer):
    # Las reglas (obligatorio, máximo 500) están en services.dictamen.
    motivo = serializers.CharField(allow_blank=True, trim_whitespace=False)


# ---------------------------------------------------------------------------
# Periodo, convocatoria y oferta académica (F7)
# ---------------------------------------------------------------------------

FORMATO_CICLO = re.compile(r"^\d{4}-[AB]$")


class PeriodoSerializer(serializers.ModelSerializer):
    """Periodo de la pantalla de control escolar. Espera `services.periodos.periodos_listado`."""

    estado_convocatoria = serializers.SerializerMethodField()
    movimientos_pendientes = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = PeriodoEscolar
        fields = [
            "id", "ciclo", "fecha_inicio", "fecha_fin", "convocatoria_inicio", "convocatoria_fin",
            "activo", "estado_convocatoria", "movimientos_pendientes",
        ]

    @extend_schema_field(serializers.ChoiceField(choices=[e.value for e in EstadoConvocatoria]))
    def get_estado_convocatoria(self, periodo):
        return estado_convocatoria(periodo).value


class PeriodoEscrituraSerializer(serializers.ModelSerializer):
    """Alta y edición de un periodo. `activar` lo deja como periodo activo al guardarlo."""

    # Sin el validador automático de único, para dar el mensaje en español.
    ciclo = serializers.CharField(max_length=10)
    activar = serializers.BooleanField(default=False, write_only=True)

    class Meta:
        model = PeriodoEscolar
        fields = ["ciclo", "fecha_inicio", "fecha_fin", "convocatoria_inicio", "convocatoria_fin", "activar"]

    def validate_ciclo(self, ciclo):
        ciclo = ciclo.strip().upper()
        if not FORMATO_CICLO.match(ciclo):
            raise serializers.ValidationError("Formato obligatorio: AAAA-A / AAAA-B")
        repetido = PeriodoEscolar.objects.filter(ciclo=ciclo)
        if self.instance is not None:
            repetido = repetido.exclude(pk=self.instance.pk)
        if repetido.exists():
            raise serializers.ValidationError(f"Ya existe el ciclo {ciclo}.")
        return ciclo

    def validate(self, datos):
        def valor(campo):
            return datos.get(campo, getattr(self.instance, campo, None))

        errores = {}
        if valor("fecha_inicio") and valor("fecha_fin") and valor("fecha_fin") <= valor("fecha_inicio"):
            errores["fecha_fin"] = ["El fin del semestre debe ser posterior a su inicio."]
        inicio, fin = valor("convocatoria_inicio"), valor("convocatoria_fin")
        if inicio and fin and fin <= inicio:
            errores["convocatoria_fin"] = ["El cierre de la convocatoria debe ser posterior a su apertura."]
        if errores:
            raise serializers.ValidationError(errores)
        return datos


class UltimaModificacionSerializer(serializers.Serializer):
    usuario = serializers.SerializerMethodField()
    fecha = serializers.DateTimeField()

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_usuario(self, registro):
        usuario = registro.usuario
        return (usuario.get_full_name() or usuario.username) if usuario else None


class ProgramaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Programa
        fields = ["id", "nombre"]


class DocenteSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(max_length=150)

    class Meta:
        model = Docente
        fields = ["id", "nombre", "grado_academico"]

    def validate_nombre(self, nombre):
        nombre = " ".join(nombre.split())
        if not nombre:
            raise serializers.ValidationError("Escribe el nombre del docente.")
        if Docente.objects.filter(nombre__iexact=nombre).exists():
            raise serializers.ValidationError("Ya existe ese docente.")
        return nombre


class HorarioEntradaSerializer(serializers.Serializer):
    dia_semana = serializers.ChoiceField(choices=HorarioGrupo.Dia.choices)
    hora_inicio = serializers.TimeField()
    hora_fin = serializers.TimeField()

    def validate(self, datos):
        if datos["hora_fin"] <= datos["hora_inicio"]:
            raise serializers.ValidationError("La hora de fin debe ser posterior a la de inicio.")
        return datos


class GrupoEscrituraSerializer(serializers.Serializer):
    """Publicar o editar un grupo del periodo activo con su horario completo (formulario de stitch)."""

    clave = serializers.CharField(max_length=20)
    nombre_materia = serializers.CharField(max_length=150)
    programa = serializers.PrimaryKeyRelatedField(queryset=Programa.objects.all())
    num_grupo = serializers.CharField(max_length=10)
    cupo_maximo = serializers.IntegerField(
        min_value=1, max_value=32767, error_messages={"min_value": "El cupo máximo debe ser mayor a 0."}
    )
    docente = serializers.PrimaryKeyRelatedField(queryset=Docente.objects.all())
    horarios = HorarioEntradaSerializer(many=True)

    def validate_clave(self, clave):
        return clave.strip().upper()

    def validate_nombre_materia(self, nombre):
        return " ".join(nombre.split())

    def validate_num_grupo(self, num_grupo):
        return num_grupo.strip()

    def validate_horarios(self, horarios):
        if not horarios:
            raise serializers.ValidationError("Agrega al menos un día de clase.")
        for i, uno in enumerate(horarios):
            for otro in horarios[i + 1 :]:
                if (
                    uno["dia_semana"] == otro["dia_semana"]
                    and uno["hora_inicio"] < otro["hora_fin"]
                    and otro["hora_inicio"] < uno["hora_fin"]
                ):
                    raise serializers.ValidationError("Dos horarios del mismo día se traslapan.")
        return sorted(horarios, key=lambda h: (h["dia_semana"], h["hora_inicio"]))


class VisibilidadGrupoSerializer(serializers.Serializer):
    """PATCH /api/grupos/{id}/ con solo `visible`: Activar o Desactivar en la oferta."""

    visible = serializers.BooleanField()
