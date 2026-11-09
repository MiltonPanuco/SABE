from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import DetalleSolicitud, Estudiante, Grupo, HorarioGrupo, PeriodoEscolar, Usuario


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
    """Con qué grupo inscrito choca, qué días y a qué hora (horario del grupo inscrito)."""

    grupo = serializers.IntegerField(source="choca_con.pk")
    materia = serializers.CharField(source="choca_con.materia.nombre_materia")
    num_grupo = serializers.CharField(source="choca_con.num_grupo")
    dias = serializers.ListField(child=serializers.IntegerField())
    hora_inicio = serializers.TimeField()
    hora_fin = serializers.TimeField()


class GrupoSerializer(serializers.ModelSerializer):
    """
    Grupo del catálogo. Espera un queryset pasado por `services.catalogo.con_cupo`
    (trae `cupo_libre`) y, para alumnos, `context["choques"]` = {grupo_id: [Choque]}.
    """

    materia = MateriaResumenSerializer()
    docente = serializers.CharField(source="docente.nombre")
    cupo_disponible = serializers.IntegerField(source="cupo_libre")
    horarios = HorarioSerializer(many=True)
    choques = serializers.SerializerMethodField()

    class Meta:
        model = Grupo
        fields = [
            "id", "materia", "num_grupo", "docente", "turno",
            "cupo_maximo", "cupo_disponible", "horarios", "choques",
        ]

    @extend_schema_field(ChoqueSerializer(many=True))
    def get_choques(self, grupo):
        choques = self.context.get("choques", {}).get(grupo.pk, [])
        return ChoqueSerializer(choques, many=True).data


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
