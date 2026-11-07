from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Usuario
from .serializers import CambiarPasswordSerializer, MeSerializer


class MeView(APIView):
    """Perfil del usuario con sesión iniciada. El frontend lo usa para saber el rol."""

    @extend_schema(responses=MeSerializer)
    def get(self, request):
        usuario = Usuario.objects.select_related("perfil_estudiante__programa").get(pk=request.user.pk)
        return Response(MeSerializer(usuario).data)


class CambiarPasswordView(APIView):
    """Cambia la contraseña y quita la marca de contraseña temporal."""

    @extend_schema(request=CambiarPasswordSerializer, responses={204: None})
    def post(self, request):
        serializer = CambiarPasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
