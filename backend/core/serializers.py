from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import DetalleSolicitud, Estudiante, Grupo, HorarioGrupo, PeriodoEscolar, Solicitud, Usuario
from .services.catalogo import con_cupo
from .services.choques import Origen
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
            "cupo_maximo", "cupo_disponible", "horarios", "choques", "errores",
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
    estudiante = EstudianteFolioSerializer()
    movimientos = MovimientoFolioSerializer(source="detalles", many=True)
    resumen = serializers.SerializerMethodField()

    class Meta:
        model = Solicitud
        fields = [
            "id", "folio_digital", "ciclo", "fecha_solicitud", "estado", "extemporanea",
            "justificacion", "estudiante", "movimientos", "resumen",
        ]

    @extend_schema_field(ResumenFolioSerializer)
    def get_resumen(self, solicitud):
        E = DetalleSolicitud.Estado
        estados = [d.estado for d in solicitud.detalles.all()]
        return {
            "total": len(estados),
            "aprobadas": sum(e in (E.APROBADA, E.CARGADA_SADCE) for e in estados),
            "resueltas": sum(e != E.PENDIENTE for e in estados),
        }
