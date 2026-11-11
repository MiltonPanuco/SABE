# SABE: Sistema de Altas y Bajas de Economía

Aplicación web para que los estudiantes de la Unidad Académica de Economía (UAN) hagan **altas y bajas de materias fuera del periodo regular** sin filas ni papeleo. El sistema detecta choques de horario, control escolar aprueba o rechaza, y se genera un reporte exportable (Excel/CSV) que control escolar sube a SADCE.

Proyecto universitario, 7mo semestre. SABE es independiente: **no se integra a PiiDA ni a SADCE**.

**Demostración pública:** https://sabe.163-192-148-141.sslip.io (usuarios de demostración en [Cómo arrancar](#3-backend)).

## Stack tecnológico

| Capa | Tecnología | Estado |
|---|---|---|
| Backend | **Django + Django REST Framework** | Confirmado |
| Frontend | **React + TypeScript** (Vite) | Confirmado |
| Base de datos | PostgreSQL (SQLite para arrancar rápido sin Docker) | Confirmado |
| Autenticación | JWT con `djangorestframework-simplejwt` (login con matrícula) | Confirmado |
| Exportación a SADCE | `openpyxl` (xlsx) y `csv` | Confirmado |
| Frontend: datos y rutas | TanStack Query + React Router | Confirmado |
| Frontend: estilos | Tailwind CSS (paleta de `stitch/academic_prestige_modern/DESIGN.md`) | Confirmado |
| Documentación de API | `drf-spectacular` (Swagger en `/api/docs/`) | Confirmado |
| Contenedores | Docker Compose: PostgreSQL en desarrollo; db, Gunicorn y Caddy en producción | Confirmado |
| Integración continua | GitHub Actions (pruebas del backend y build del frontend) | Confirmado |

## Estructura del repositorio

```
backend/                 API en Django: config/ (settings) y core/ (modelos, services/ con las reglas, tests/)
frontend/                Interfaz en React + TypeScript: src/estudiante, src/control, src/admin, src/api
diagramas/               ERD del backend (SABE_ERD_Backend.png y .mmd editable)
stitch/                  Prototipo navegable en HTML (16 pantallas por rol), DESIGN.md y _shared/prototipo.js
docs/                    PLAN.md (plan y decisiones), requerimientos, diseño, pruebas de usabilidad y guion de la presentación
docker-compose.yml       PostgreSQL para desarrollo
docker-compose.prod.yml  Producción: db, backend (Gunicorn), web (Caddy) y respaldos
.github/workflows/       Integración continua
Clases/                  Entregas y material de la materia (análisis, diseño, EDT)
```

## Cómo arrancar

Necesitas Python 3.12+, Node 20+ y, opcionalmente, Docker. Revisa con `python --version`: si el `python` de tu sistema es más viejo, usa el ejecutable de la versión nueva al crear el entorno (por ejemplo `python3.12 -m venv .venv`); después de activarlo, `python` ya es el correcto.

### 1. Variables de entorno
```
copy .env.example .env        (Windows)
cp .env.example .env          (Mac/Linux)
```
Para usar SQLite sin Docker, borra las líneas `POSTGRES_*` del `.env`.

### 2. Base de datos (opcional, PostgreSQL)
```
docker compose up -d
```

### 3. Backend
```
cd backend
python -m venv .venv
.venv\Scripts\activate         (Windows PowerShell)
source .venv/bin/activate      (Mac/Linux)
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo            (datos de demostración, se puede repetir)
python manage.py runserver
```
- API: http://localhost:8000/api/health/
- Documentación de la API: http://localhost:8000/api/docs/
- Panel de administración de Django: http://localhost:8000/admin/

Usuarios de demostración que crea `seed_demo` (iguales al prototipo):

| Rol | Usuario | Contraseña |
|---|---|---|
| Estudiante | `210089334` | `demo1234` |
| Estudiante, primer acceso (debe cambiar contraseña) | `230012345` | `temporal` |
| Control escolar | `valeria.ruiz` | `demo1234` |
| Administrador (también entra a `/admin/`) | `admin` | `demo1234` (en producción, `SABE_ADMIN_PASSWORD` de `.env.prod`) |

`python manage.py seed_demo --convocatoria-cerrada` deja la convocatoria cerrada para probar solicitudes extemporáneas.

`seed_demo` también crea los ciclos anteriores 2025-B, 2025-A y 2024-B (inactivos) y deja 3 folios de otros alumnos en la bandeja de control escolar (uno con choque, uno extemporáneo y uno aprobado). Con `--sin-folios` la bandeja queda vacía. Volver a correrlo borra los folios de los alumnos demo y restaura sus cargas.

### 4. Frontend
```
cd frontend
npm install
npm run dev
```
Abre http://localhost:5173 y entra con un usuario de demostración (en desarrollo, la página de inicio de sesión tiene botones que llenan los datos). Vite reenvía `/api` y `/admin` al backend en el puerto 8000; si tu backend corre en otro, arranca con `SABE_BACKEND=http://localhost:PUERTO npm run dev`.

### 5. Pruebas
```
cd backend
python manage.py test core                          (unas 290 pruebas; con PostgreSQL tardan unos 6 minutos)
python manage.py makemigrations --check --dry-run   (que no falten migraciones)
python manage.py spectacular --validate --fail-on-warn --file /dev/null   (contrato de la API)

cd frontend
npm run build                                       (revisa tipos con tsc y arma el sitio)
```
Lo mismo corre en GitHub Actions (`.github/workflows/ci.yml`) en cada push y Pull Request.

## Modelo de datos

15 modelos en `backend/core/models.py`, según `diagramas/SABE_ERD_Backend.png`. Reglas importantes que ya quedan en la base de datos:
- Solo un periodo escolar activo a la vez.
- Un rechazo siempre lleva motivo.
- El cupo disponible se calcula, no se guarda.
- Un folio agrupa movimientos (altas y bajas) y se aprueba **por movimiento**.

Si cambias un modelo: `python manage.py makemigrations` y sube la migración en el mismo commit.

## Estado del proyecto

Las 13 funciones del plan están construidas y probadas; el detalle (objetivo, contrato de API, reglas, diferencias con `stitch/` acordadas) está en [`docs/PLAN.md`](docs/PLAN.md).

| Hito | Funciones |
|---|---|
| H1. Base | F1 datos de prueba · F2 autenticación y roles |
| H2. Flujo del estudiante | F3 catálogo y horario · F4 choques de horario · F5 solicitudes (carrito, folio, acuse imprimible, cancelar, extemporáneas) |
| H3. Control escolar | F6 bandeja y dictamen por movimiento · F7 periodo, convocatoria y oferta · F8 importación de CSV · F9 exportación a SADCE y lotes · F10 notificaciones y bitácora · F11 usuarios y roles |
| H4. Despliegue y cierre | F12 despliegue con HTTPS · F13 pruebas finales y documentación |

Para el equipo: la [guía de prueba de usabilidad](docs/pruebas/prueba_usabilidad.md) y el [guion de la presentación](docs/presentacion/guion.md).

Más contexto del proyecto en `docs/diseno/SABE_Contexto_Completo.md`.

## Despliegue

Demostración pública: **https://sabe.163-192-148-141.sslip.io** (VM de Oracle Cloud, decisión D6). Corre con `docker-compose.prod.yml`: PostgreSQL, backend (Gunicorn), web (Caddy, con HTTPS automático) y un respaldo diario de la base. Los comandos van en la raíz del repositorio y usan `sudo` para Docker.

**Primer despliegue**
1. Abre los puertos 80 y 443 en la Security List de la VCN (consola de Oracle Cloud) y en el firewall: `sudo firewall-cmd --permanent --add-service=http --add-service=https && sudo firewall-cmd --reload`.
2. Copia `.env.prod.example` como `.env.prod`, pon claves largas (`python3 -c "import secrets; print(secrets.token_urlsafe(50))"`) y `chmod 600 .env.prod`. Nunca lo subas.
3. Levanta todo: `sudo docker compose -p sabe-prod -f docker-compose.prod.yml up -d --build`.
4. Carga la demostración: `sudo docker compose -p sabe-prod -f docker-compose.prod.yml exec backend python manage.py seed_demo --permitir-produccion`. El usuario `admin` usa la contraseña `SABE_ADMIN_PASSWORD` de `.env.prod`; los demás, `demo1234`.

**Actualizar:** `git pull` y el mismo `up -d --build` (las migraciones corren solas al arrancar el backend). Después, `sudo docker builder prune -f` libera espacio.

**Reiniciar la demostración:** el mismo comando de `seed_demo` del paso 4.

**Respaldos:** quedan en `backups/` (uno diario, 7 días). Para restaurar uno: `gunzip -c backups/sabe_AAAAMMDD_HHMM.sql.gz | sudo docker compose -p sabe-prod -f docker-compose.prod.yml exec -T db psql -U sabe -d sabe` (sobre una base vacía).

**Registros:** `sudo docker compose -p sabe-prod -f docker-compose.prod.yml logs -f backend web`.

La integración continua (`.github/workflows/ci.yml`) corre las pruebas del backend y el build del frontend en cada push y PR.

## Equipo y responsables

| Persona | Responsabilidad |
|---|---|
| Milton Cruz Panuco Castillo | En lo q haga falta |
| Fernando Osuna Manzo | Backend y frontend |
| Irving García Rosas | Backend y frontend |
| Rafael Gil Samaniego Vázquez | Diseño UI/UX |
| Ángel Adriel Soria Macías | Análisis y reglas de negocio |

## Cómo trabajar en equipo

1. Nadie sube directo a `main`. Crea una rama por tarea: `feature/choques-horario`, `fix/login`.
2. Haz commits pequeños con mensajes claros en español.
3. Abre un Pull Request y pide revisión antes de fusionar.
4. Antes de empezar, `git pull` en `main` para traer lo último.
5. Nunca subas el archivo `.env` ni contraseñas.
