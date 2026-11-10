"""Avisos para los usuarios. F10 agrega aquí la bitácora y el panel que los muestra."""

from core.models import Notificacion, Usuario

LARGO_MENSAJE = Notificacion._meta.get_field("mensaje").max_length


def notificar(usuario: Usuario, mensaje: str) -> Notificacion:
    """Guarda un aviso para `usuario`. Si el texto no cabe, se corta con "…"."""
    if len(mensaje) > LARGO_MENSAJE:
        mensaje = mensaje[: LARGO_MENSAJE - 1] + "…"
    return Notificacion.objects.create(usuario=usuario, mensaje=mensaje)
