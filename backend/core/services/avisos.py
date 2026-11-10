"""
Avisos para los usuarios y bitácora de quién hizo qué.

`notificar` existe desde F6 (dictamen) y `registrar` desde F7 (periodos y oferta).
F10 agrega el resto de las acciones de la bitácora y las pantallas que los muestran.
"""

from django.db import models

from core.models import Bitacora, Notificacion, Usuario

LARGO_MENSAJE = Notificacion._meta.get_field("mensaje").max_length
LARGO_ENTIDAD = Bitacora._meta.get_field("entidad").max_length


def notificar(usuario: Usuario, mensaje: str) -> Notificacion:
    """Guarda un aviso para `usuario`. Si el texto no cabe, se corta con "…"."""
    if len(mensaje) > LARGO_MENSAJE:
        mensaje = mensaje[: LARGO_MENSAJE - 1] + "…"
    return Notificacion.objects.create(usuario=usuario, mensaje=mensaje)


def entidad_de(objeto: models.Model, descripcion: str | None = None) -> str:
    """Texto de la entidad para la bitácora: "PeriodoEscolar #3 (2026-A)"."""
    texto = f"{type(objeto).__name__} #{objeto.pk} ({descripcion or objeto})"
    return texto if len(texto) <= LARGO_ENTIDAD else texto[: LARGO_ENTIDAD - 1] + "…"


def registrar(
    usuario: Usuario | None, accion: str, objeto: models.Model, *, descripcion: str | None = None, request=None
) -> Bitacora:
    """Agrega una fila a la bitácora. Con `request`, guarda también la IP de origen."""
    ip = request.META.get("REMOTE_ADDR") if request is not None else None
    return Bitacora.objects.create(
        usuario=usuario, accion=accion, entidad=entidad_de(objeto, descripcion), ip=ip or None
    )
