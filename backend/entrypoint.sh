#!/bin/sh
# Espera a PostgreSQL, aplica migraciones y arranca Gunicorn (3 workers para 2 CPU).
set -e

python - <<'PY'
import os, time
import psycopg

for intento in range(30):
    try:
        psycopg.connect(
            dbname=os.environ["POSTGRES_DB"], user=os.environ["POSTGRES_USER"],
            password=os.environ["POSTGRES_PASSWORD"], host=os.environ["POSTGRES_HOST"],
            port=os.environ.get("POSTGRES_PORT", "5432"), connect_timeout=3,
        ).close()
        break
    except psycopg.OperationalError:
        print("Esperando a PostgreSQL...", flush=True)
        time.sleep(2)
else:
    raise SystemExit("PostgreSQL no respondió.")
PY

python manage.py migrate --noinput
python manage.py createcachetable
exec gunicorn config.wsgi --workers "${GUNICORN_WORKERS:-3}" --bind 0.0.0.0:8000 --access-logfile - --forwarded-allow-ips "*"
