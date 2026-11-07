"""Permisos por rol. Se combinan con IsAuthenticated, que ya es el permiso por defecto."""

from rest_framework.permissions import BasePermission

from .models import Rol


class TieneRol(BasePermission):
    """Base: deja pasar solo a usuarios autenticados con alguno de los roles de `roles`."""

    roles: tuple[str, ...] = ()
    message = "Tu rol no tiene acceso a esta sección."

    def has_permission(self, request, view):
        usuario = request.user
        return bool(usuario and usuario.is_authenticated and usuario.rol in self.roles)


class EsEstudiante(TieneRol):
    roles = (Rol.ESTUDIANTE,)


class EsControlEscolar(TieneRol):
    roles = (Rol.CONTROL_ESCOLAR,)


class EsAdministrador(TieneRol):
    roles = (Rol.ADMINISTRADOR,)
