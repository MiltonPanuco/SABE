from django.contrib.auth import password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Estudiante, Usuario


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
