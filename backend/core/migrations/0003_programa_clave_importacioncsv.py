import unicodedata

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

CLAVES = {"economía": "L-ECO", "finanzas": "L-FIN"}


def _sin_acentos(texto):
    return "".join(c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn")


def poner_claves(apps, schema_editor):
    """Economía -> L-ECO, Finanzas -> L-FIN; otro programa -> L- y sus 3 primeras letras."""
    Programa = apps.get_model("core", "Programa")
    usadas = set()
    for programa in Programa.objects.order_by("id"):
        clave = CLAVES.get(programa.nombre.lower()) or "L-" + _sin_acentos(programa.nombre)[:3].upper()
        base, n = clave, 2
        while clave in usadas:
            clave, n = f"{base}{n}", n + 1
        usadas.add(clave)
        programa.clave = clave
        programa.save(update_fields=["clave"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_solicitud_extemporanea"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="programa",
            name="clave",
            field=models.CharField(max_length=10, null=True),
        ),
        migrations.RunPython(poner_claves, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="programa",
            name="clave",
            field=models.CharField(max_length=10, unique=True),
        ),
        migrations.CreateModel(
            name="ImportacionCSV",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tipo", models.CharField(choices=[("alumnos", "Alumnos"), ("cargas", "Cargas académicas")], max_length=8)),
                ("fecha", models.DateTimeField(auto_now_add=True)),
                ("archivo", models.CharField(max_length=255)),
                ("total", models.PositiveIntegerField(default=0)),
                ("creados", models.PositiveIntegerField(default=0)),
                ("actualizados", models.PositiveIntegerField(default=0)),
                ("excluidos", models.PositiveIntegerField(default=0)),
                (
                    "periodo",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="importaciones",
                        to="core.periodoescolar",
                    ),
                ),
                (
                    "usuario",
                    models.ForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="importaciones",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "importaciones_csv", "ordering": ["-fecha", "-id"]},
        ),
    ]
