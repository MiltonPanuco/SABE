# SABE: Sistema de Altas y Bajas de Economía

Aplicación web para que los estudiantes de la Unidad Académica de Economía (UAN) hagan **altas y bajas de materias fuera del periodo regular** sin filas ni papeleo. El sistema detecta choques de horario, control escolar aprueba o rechaza, y se genera un reporte exportable (Excel/CSV) que control escolar sube a SADCE.

Proyecto universitario, 7mo semestre. SABE es independiente: **no se integra a PiiDA ni a SADCE**.

## Stack tecnológico

| Capa | Tecnología | Estado |
|---|---|---|
| Backend | **Django + Django REST Framework** | Confirmado |
| Frontend | **React + TypeScript** (Vite) | Confirmado |
| Base de datos | PostgreSQL (SQLite para arrancar rápido) | Recomendado, por confirmar con el equipo |
| Autenticación | JWT con `djangorestframework-simplejwt` (login con matrícula) | Recomendado, por confirmar |
| Exportación a SADCE | `openpyxl` (xlsx) y `csv` | Confirmado |
| Frontend: datos y rutas | TanStack Query + React Router | Recomendado, por confirmar |
| Frontend: estilos | Tailwind CSS (paleta de `stitch/academic_prestige_modern/DESIGN.md`) | Recomendado, por confirmar |
| Documentación de API | `drf-spectacular` (Swagger en `/api/docs/`) | Incluido |
| Contenedores | Docker Compose: PostgreSQL en desarrollo; db, Gunicorn y Caddy en producción | Confirmado |

"Por confirmar" significa que el proyecto base ya viene con eso, pero el equipo puede cambiarlo antes de construir encima.

## Estructura del repositorio

```
backend/      API en Django (config/ y core/ con los modelos)
frontend/     Interfaz en React + TypeScript
diagramas/    ERD del backend (SABE_ERD_Backend.png y .mmd editable)
stitch/       Prototipo navegable en HTML (16 pantallas por rol), DESIGN.md y _shared/prototipo.js
docs/         Requerimientos (docs/requerimientos) y diseño: contexto, flujos y prompts (docs/diseno)
Clases/       Entregas y material de la materia (análisis, diseño, EDT)
```

## Cómo arrancar

Necesitas Python 3.12+, Node 20+ y, opcionalmente, Docker.

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
| Administrador (también entra a `/admin/`) | `admin` | `demo1234` |

`python manage.py seed_demo --convocatoria-cerrada` deja la convocatoria cerrada para probar solicitudes extemporáneas.

`seed_demo` también crea los ciclos anteriores 2025-B, 2025-A y 2024-B (inactivos) y deja 3 folios de otros alumnos en la bandeja de control escolar (uno con choque, uno extemporáneo y uno aprobado). Con `--sin-folios` la bandeja queda vacía. Volver a correrlo borra los folios de los alumnos demo y restaura sus cargas.

### 4. Frontend
```
cd frontend
npm install
npm run dev
```
Abre http://localhost:5173. La pantalla de arranque indica si ya hay conexión con el backend.

## Modelo de datos

16 entidades en `backend/core/models.py`, según `diagramas/SABE_ERD_Backend.png`. Reglas importantes que ya quedan en la base de datos:
- Solo un periodo escolar activo a la vez.
- Un rechazo siempre lleva motivo.
- El cupo disponible se calcula, no se guarda.
- Un folio agrupa movimientos (altas y bajas) y se aprueba **por movimiento**.

Si cambias un modelo: `python manage.py makemigrations` y sube la migración en el mismo commit.

## Pendientes (para repartir)

**Backend**
- [ ] Servicio de detección de choques de horario (con pruebas)
- [x] Importador de CSV: alumnos y cargas académicas (vista previa de errores, reimportar sin duplicar, contraseña temporal)
- [ ] Endpoints de solicitudes: crear folio, listar, cancelar
- [ ] Aprobar y rechazar con bloqueo de cupo (`transaction.atomic` + `select_for_update`)
- [x] Permisos por rol (estudiante, control escolar, administrador)
- [x] Exportación a SADCE (xlsx/csv) y registro del lote
- [ ] Comprobante PDF del folio (el dashboard tiene el acceso "Comprobantes")
- [x] Notificaciones y bitácora
- [x] Datos de prueba (seed) iguales a los del prototipo

**Frontend** (el diseño de referencia está en `stitch/`)
- [x] Login, recuperar contraseña y cambio obligatorio de contraseña
- [ ] Estudiante: dashboard, horario, catálogo y carrito (alta y baja), confirmación, historial con acuse y notificaciones
- [ ] Estudiante: cancelar solicitud pendiente y ver motivo de rechazo
- [ ] Control escolar: bandeja, validación, catálogos, oferta
- [x] Control escolar: periodo y convocatoria, importación de CSV, exportación a SADCE, notificaciones y bitácora
- [x] Administrador: usuarios y roles

**Diseño**
- [x] Pantallas del prototipo completas (ver `docs/diseno/Pantallas y Flujos.docx`). Para verlo, abre `stitch/sabe_inicio_de_sesi_n_institucional_uan_uae/code.html` y usa los accesos de demostración
- [x] Definir con control escolar el formato exacto del reporte para SADCE (D1 en `docs/PLAN.md`)

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
