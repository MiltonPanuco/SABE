# Backend de SABE para producción: Django + Gunicorn (F12). Los estáticos los sirve WhiteNoise.
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
# collectstatic no necesita la base ni la clave real: se usa una de un solo uso.
RUN DJANGO_DEBUG=0 DJANGO_SECRET_KEY=solo-para-collectstatic-$(python -c "import secrets;print(secrets.token_hex(32))") \
    python manage.py collectstatic --noinput \
 && useradd --system --uid 1000 --home /app sabe \
 && chown -R sabe /app \
 && chmod +x /app/entrypoint.sh

USER sabe
EXPOSE 8000
# Con el primer host permitido y el encabezado que pone Caddy: así pasa ALLOWED_HOSTS y la redirección a HTTPS.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import os, urllib.request as u; h = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost').split(',')[0]; u.urlopen(u.Request('http://127.0.0.1:8000/api/health/', headers={'Host': h, 'X-Forwarded-Proto': 'https'}), timeout=4)"
ENTRYPOINT ["/app/entrypoint.sh"]
