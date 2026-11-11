"""
Usuarios y roles (F11): el administrador da de alta personal, cambia roles entre control escolar y
administrador, activa o desactiva cuentas (nunca se borran) y restablece contraseñas.

Los alumnos solo se crean por importación de CSV (F8) y su rol no cambia. Control escolar puede
restablecer la contraseña de un alumno desde su folio. Toda contraseña nueva es temporal: se muestra
una sola vez y obliga a cambiarla al entrar (no hay correo; decisión D4).
"""

from django.contrib.auth.hashers import make_password
from django.db import transaction

from core.models import Rol, Usuario

from .avisos import registrar
from .importacion import contrasena_temporal

DOMINIO = "@uan.edu.mx"
ROLES_PERSONAL = (Rol.CONTROL_ESCOLAR, Rol.ADMINISTRADOR)
NOMBRES_ROL = {Rol.ESTUDIANTE: "Estudiante", Rol.CONTROL_ESCOLAR: "Control Escolar", Rol.ADMINISTRADOR: "Administrador"}


class UsuarioInvalido(Exception):
    """El cambio no se puede hacer. `datos` es el cuerpo del 400, con el formato de DRF."""

    def __init__(self, datos: dict):
        super().__init__(datos)
        self.datos = datos


def nombre_en_bitacora(usuario: Usuario) -> str:
    """"Diego Armando Solís Nuño (220011456)" para alumnos; el nombre para el personal."""
    nombre = usuario.get_full_name() or usuario.username
    return f"{nombre} ({usuario.username})" if usuario.rol == Rol.ESTUDIANTE else nombre


def _permisos_django(usuario: Usuario) -> None:
    """El administrador de SABE también entra al admin de Django (como en seed_demo)."""
    es_admin = usuario.rol == Rol.ADMINISTRADOR
    usuario.is_staff = usuario.is_superuser = es_admin


def _temporal(usuario: Usuario) -> str:
    password = contrasena_temporal()
    usuario.password = make_password(password, hasher="pbkdf2_temporal")
    usuario.debe_cambiar_password = True
    return password


def _quedan_admins(sin: Usuario) -> bool:
    """¿Queda otro administrador activo si `sin` deja de serlo? Bloquea a los administradores activos."""
    activos = list(
        Usuario.objects.select_for_update().filter(rol=Rol.ADMINISTRADOR, is_active=True).values_list("pk", flat=True)
    )
    return any(pk != sin.pk for pk in activos)


def crear_personal(datos: dict, admin: Usuario, *, request=None) -> tuple[Usuario, str]:
    """Crea una cuenta de control escolar o de administrador. Devuelve la cuenta y su contraseña temporal."""
    email = datos["email"].strip().lower()
    errores = {}
    if not email.endswith(DOMINIO):
        errores["email"] = ["Usa un correo institucional @uan.edu.mx."]
    elif Usuario.objects.filter(email__iexact=email).exists():
        errores["email"] = ["Ese correo ya tiene una cuenta."]
    username = email.split("@")[0]
    if "email" not in errores and Usuario.objects.filter(username__iexact=username).exists():
        errores["email"] = [f"Ya existe la cuenta {username}."]
    if datos["rol"] not in ROLES_PERSONAL:
        errores["rol"] = ["Los estudiantes se crean por importación de CSV."]
    if errores:
        raise UsuarioInvalido(errores)

    with transaction.atomic():
        usuario = Usuario(
            username=username,
            first_name=datos["nombre"].strip(),
            last_name=datos["apellidos"].strip(),
            email=email,
            rol=datos["rol"],
        )
        _permisos_django(usuario)
        password = _temporal(usuario)
        usuario.save()
        registrar(
            admin,
            "crear_usuario",
            usuario,
            detalle=f"Creó la cuenta de {NOMBRES_ROL[usuario.rol]} de {usuario.get_full_name()}.",
            request=request,
        )
    return usuario, password


def cambiar_rol(usuario: Usuario, rol: str, admin: Usuario, *, request=None) -> Usuario:
    """Pasa una cuenta de personal entre control escolar y administrador."""
    with transaction.atomic():
        usuario = Usuario.objects.select_for_update().get(pk=usuario.pk)
        if usuario.rol == Rol.ESTUDIANTE or rol not in ROLES_PERSONAL:
            raise UsuarioInvalido({"rol": ["El rol de un estudiante lo gestiona Control Escolar."]})
        if usuario.pk == admin.pk:
            raise UsuarioInvalido({"rol": ["No puedes cambiar tu propio rol."]})
        if usuario.rol == rol:
            return usuario
        if usuario.rol == Rol.ADMINISTRADOR and usuario.is_active and not _quedan_admins(usuario):
            raise UsuarioInvalido({"rol": ["Debe quedar al menos un administrador activo."]})
        usuario.rol = rol
        _permisos_django(usuario)
        usuario.save(update_fields=["rol", "is_staff", "is_superuser"])
        registrar(
            admin,
            "cambiar_rol_usuario",
            usuario,
            detalle=f"Cambió el rol de {nombre_en_bitacora(usuario)} a {NOMBRES_ROL[rol]}.",
            request=request,
        )
    return usuario


def cambiar_estado(usuario: Usuario, activo: bool, admin: Usuario, *, request=None) -> Usuario:
    """Activa o desactiva una cuenta. Una cuenta desactivada no entra y su sesión abierta deja de servir."""
    with transaction.atomic():
        usuario = Usuario.objects.select_for_update().get(pk=usuario.pk)
        if usuario.is_active == activo:
            return usuario
        if not activo:
            if usuario.pk == admin.pk:
                raise UsuarioInvalido({"activo": ["No puedes desactivar tu propia cuenta."]})
            if usuario.rol == Rol.ADMINISTRADOR and not _quedan_admins(usuario):
                raise UsuarioInvalido({"activo": ["Debe quedar al menos un administrador activo."]})
        usuario.is_active = activo
        usuario.save(update_fields=["is_active"])
        registrar(
            admin,
            "activar_usuario" if activo else "desactivar_usuario",
            usuario,
            detalle=f"{'Activó' if activo else 'Desactivó'} la cuenta de {nombre_en_bitacora(usuario)}.",
            request=request,
        )
    return usuario


def reiniciar_password(usuario: Usuario, quien: Usuario, *, request=None) -> str:
    """Pone una contraseña temporal (se muestra una vez) y obliga a cambiarla al entrar."""
    with transaction.atomic():
        usuario = Usuario.objects.select_for_update().get(pk=usuario.pk)
        password = _temporal(usuario)
        usuario.save(update_fields=["password", "debe_cambiar_password"])
        registrar(
            quien,
            "reiniciar_password_usuario",
            usuario,
            detalle=f"Restableció la contraseña de {nombre_en_bitacora(usuario)}.",
            request=request,
        )
    return password
