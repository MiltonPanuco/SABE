"""Hasher ligero solo para las contraseñas temporales que genera la importación de CSV."""

from django.contrib.auth.hashers import PBKDF2PasswordHasher


class PBKDF2TemporalHasher(PBKDF2PasswordHasher):
    """
    PBKDF2 con menos iteraciones. Con el hasher normal (0.3 s por contraseña) un padrón de
    120 alumnos tardaría unos 40 s en una sola petición. La contraseña temporal es aleatoria
    (10 caracteres) y el alumno debe cambiarla al entrar; al cambiarla Django usa el hasher
    normal. Va al final de PASSWORD_HASHERS para que solo se use cuando se pide por nombre.
    """

    algorithm = "pbkdf2_temporal"
    iterations = 20_000
