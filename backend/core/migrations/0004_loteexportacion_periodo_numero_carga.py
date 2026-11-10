import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def numerar_lotes(apps, schema_editor):
    """
    Los lotes que ya existan toman el periodo de sus movimientos y un consecutivo por periodo.
    Un lote sin movimientos no se puede ubicar en ningún periodo y se borra.
    """
    LoteExportacion = apps.get_model("core", "LoteExportacion")
    DetalleSolicitud = apps.get_model("core", "DetalleSolicitud")
    siguiente = {}
    for lote in LoteExportacion.objects.order_by("fecha", "id"):
        periodo_id = (
            DetalleSolicitud.objects.filter(lote=lote).values_list("solicitud__periodo_id", flat=True).first()
        )
        if periodo_id is None:
            lote.delete()
            continue
        siguiente[periodo_id] = siguiente.get(periodo_id, 0) + 1
        lote.periodo_id = periodo_id
        lote.numero = siguiente[periodo_id]
        lote.save(update_fields=["periodo", "numero"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_programa_clave_importacioncsv"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="loteexportacion",
            name="periodo",
            field=models.ForeignKey(
                null=True, on_delete=django.db.models.deletion.PROTECT, related_name="lotes", to="core.periodoescolar"
            ),
        ),
        migrations.AddField(
            model_name="loteexportacion",
            name="numero",
            field=models.PositiveIntegerField(null=True),
        ),
        migrations.RunPython(numerar_lotes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="loteexportacion",
            name="periodo",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT, related_name="lotes", to="core.periodoescolar"
            ),
        ),
        migrations.AlterField(
            model_name="loteexportacion",
            name="numero",
            field=models.PositiveIntegerField(),
        ),
        migrations.AlterField(
            model_name="loteexportacion",
            name="usuario",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="lotes_exportados",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="loteexportacion",
            name="cargado_por",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="lotes_cargados",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="loteexportacion",
            name="fecha_carga",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterModelOptions(
            name="loteexportacion",
            options={"ordering": ["-fecha", "-id"]},
        ),
        migrations.AddConstraint(
            model_name="loteexportacion",
            constraint=models.UniqueConstraint(fields=("periodo", "numero"), name="lote_unico_por_periodo"),
        ),
    ]
