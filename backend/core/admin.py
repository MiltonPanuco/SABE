from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from . import models


@admin.register(models.Usuario)
class UsuarioAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("SABE", {"fields": ("rol", "debe_cambiar_password")}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("SABE", {"fields": ("rol",)}),)
    list_display = ("username", "first_name", "last_name", "rol", "is_active")
    list_filter = ("rol", "is_active")


class HorarioInline(admin.TabularInline):
    model = models.HorarioGrupo
    extra = 1


@admin.register(models.Grupo)
class GrupoAdmin(admin.ModelAdmin):
    list_display = ("materia", "num_grupo", "docente", "periodo", "cupo_maximo", "visible")
    list_filter = ("periodo", "visible")
    inlines = [HorarioInline]


class DetalleInline(admin.TabularInline):
    model = models.DetalleSolicitud
    extra = 0


@admin.register(models.Solicitud)
class SolicitudAdmin(admin.ModelAdmin):
    list_display = ("folio_digital", "estudiante", "periodo", "fecha_solicitud")
    inlines = [DetalleInline]


@admin.register(models.LoteExportacion)
class LoteExportacionAdmin(admin.ModelAdmin):
    list_display = ("folio", "periodo", "fecha", "usuario", "formato", "total_registros", "fecha_carga")
    list_filter = ("periodo", "formato")


for modelo in (
    models.Programa,
    models.Estudiante,
    models.Docente,
    models.PeriodoEscolar,
    models.UnidadAprendizaje,
    models.CargaAcademica,
    models.Notificacion,
    models.Bitacora,
    models.ImportacionCSV,
):
    admin.site.register(modelo)
