# SABE: work plan until delivery

Deadline: **Monday, November 30, 2026**. Created on November 6, 2026.

This file states **what** gets built, **in what order** and **when it counts as done**. Owners are assigned outside this document. The full business rules are in `docs/diseno/SABE_Contexto_Completo.md` and each screen's design is in `stitch/`.

> **Design rule for every stage:** in every milestone and every feature, screens must look the same as their `stitch/` design (layout, images, icons, copy and colors). No feature with a frontend is marked `Done` unless its screens match `stitch/`. If the design conflicts with a business rule, the backend or data that doesn't exist, raise it with the team before deviating.

> English version of `docs/PLAN.md`. If the two differ, `PLAN.md` (Spanish) is the source of truth. Endpoint paths, field names and screen folders stay in Spanish because that is how they exist in the code.

How to use it: when a feature is merged into `main`, change its **Status** to `Done` in the same PR. If an endpoint changes, update its **API contract** here before coding it.

---

## 1. Milestones

| Milestone | Dates | Features | Demo when the milestone closes |
|---|---|---|---|
| **H1. Foundation** | Nov 6 to 11 | F1, F2 | The 3 demo users log in and land on their role's dashboard |
| **H2. Student flow** | Nov 12 to 17 | F3, F4, F5 | A student builds a cart, the system blocks clashes, and they submit a folio they can view and cancel |
| **H3. Control Escolar** | Nov 18 to 24 | F6, F7, F8, F9, F10, F11 | Control Escolar approves and rejects, imports CSV, exports to SADCE and marks the batch as uploaded |
| **H4. Deployment and wrap-up** | Nov 25 to 28 | F12, F13 | The app runs on a public URL with HTTPS and demo data |
| **Buffer** | Nov 29 and 30 | | Only fixes and presentation rehearsal. Nothing new |

Cut rule: if a milestone slips more than 2 days, scope is cut from the features marked **Optional**; the final date does not move.

## 2. Dependency order

```
F1 Seed data ───────┐
                    ├─> F2 Auth and roles ─┬─> F3 Catalog ─> F4 Clashes ─> F5 Requests ─> F6 Review ─> F9 SADCE export
                    │                      ├─> F7 Period and offering
                    │                      ├─> F8 CSV import
                    │                      └─> F11 Users and roles
F5 and F6 ─────────────────────────────────> F10 Notifications and audit log
Everything ────────────────────────────────> F12 Deployment ─> F13 Final testing and docs
```

F12 can be prepared starting in H2 (Dockerfiles and production settings) so it isn't all left for the end.

## 3. Open decisions

| # | Question | Recommendation | Decide by |
|---|---|---|---|
| D1 | Exact columns of the SADCE Excel file | Matrícula, name, program, course code, course, group, teacher, type (ALTA/BAJA), folio, approval date. Confirm with Control Escolar | Nov 13 |
| D2 | Does an add that clashes with a drop in the same folio count as a clash? | **Decided:** no, the drop in the same folio frees the slot (group change) | Nov 11 |
| D3 | "~24 business hours" resolution text | Remove it | Nov 11 |
| D4 | Password recovery: real email or reset by Control Escolar? | Email if SMTP is ready in H4; otherwise Control Escolar resets to a temporary password (F11) | Nov 18 |
| D5 | Folio receipt: server-side PDF or printable view? | **Decided:** printable view in the frontend (`window.print`), "Imprimir acuse" button, no new dependencies | Nov 14 |
| D6 | Where to host | A single server with Docker Compose (Render, Railway or a VPS). Choose based on zero cost | Nov 20 |

## 4. Conventions

- One branch per feature: `feature/f4-choques`, `fix/login`. PR with review before merging into `main`.
- Endpoints under `/api/`, in Spanish and plural (`/api/solicitudes/`). Errors use the standard DRF format: `{"detail": "..."}` or `{"field": ["message"]}`.
- All business rules live in the backend, in `core/services/`. The frontend only shows what the API returns.
- Every backend service has tests (`python manage.py test`). If you change a model, the migration goes in the same commit.
- Swagger (`/api/docs/`) is the living contract. This file summarizes; Swagger wins on details.
- Every screen must match its `stitch/` design as closely as possible (layout, images, icons, copy and colors). If the design conflicts with a business rule, the backend or data that doesn't exist, don't decide silently: raise it with the team and agree on a reconciliation.

---

## 5. Features

Template for each feature: **Goal**, **Depends on**, **Backend**, **Frontend** (with the `stitch/` screen), **API contract**, **Business rules**, **Done when**, **Target date**, **Status**. For every feature with a frontend, **Done when** includes its screens matching `stitch/`.

### F1. Seed data

- **Goal:** anyone on the team brings the app up with the same data as the prototype using a single command.
- **Depends on:** nothing.
- **Backend:** command `python manage.py seed_demo` (idempotent, can be run several times). Creates programs (Economía, Finanzas), teachers, courses, groups with per-day schedules, an active 2026-A period with an open enrollment window, demo users and the test student's current enrollment.
- **Frontend:** nothing.
- **API contract:** not applicable.
- **Business rules:** users `210089334` (student, `demo1234`), `valeria.ruiz` (Control Escolar, `demo1234`), `admin` (administrator, `demo1234`) and a student with password `temporal` and `debe_cambiar_password = True`. Include at least one full group and one group that clashes with the student's schedule, to test F4.
- **Done when:** `migrate` + `seed_demo` on an empty database leaves everything ready; running it twice duplicates nothing.
- **Target date:** Nov 8.
- **Status:** Done.

### F2. Authentication and roles

- **Goal:** the user logs in with matrícula and password and lands on their role's dashboard; with a temporary password they are forced to change it.
- **Depends on:** F1.
- **Backend:** permission classes `EsEstudiante`, `EsControlEscolar`, `EsAdministrador`; profile endpoint; password change. Logging the login in the audit log is left for F10.
- **Frontend:** API client with JWT (store tokens, refresh on expiry, log out), React Router with role-protected routes, base layout with the colors from `DESIGN.md`. Screens: `sabe_inicio_de_sesi_n_institucional_uan_uae`, `sabe_cambio_obligatorio_de_contrase_a_uan_uae`, `sabe_recuperar_contrase_a_uan_uae` (view only; submission depends on D4).
- **API contract:**
  - `POST /api/auth/token/` `{username, password}` → `{access, refresh}` (already exists)
  - `POST /api/auth/token/refresh/` `{refresh}` → `{access}` (already exists)
  - `GET /api/me/` → `{id, username, nombre, apellidos, rol, debe_cambiar_password, estudiante: {matricula, programa, semestre, turno} | null}`
  - `POST /api/auth/cambiar-password/` `{actual, nueva}` → `204`
- **Business rules:** while `debe_cambiar_password` is `True`, the frontend only allows the change-password screen. The new password must pass Django's validators.
- **Done when:** backend tests for permissions by role; the 3 demo users reach their dashboard; the `temporal` user is forced to change it; a student cannot open Control Escolar routes; the screens match their `stitch/` design.
- **Target date:** Nov 11.
- **Status:** Done.

### F3. Catalog and student schedule

- **Goal:** the student sees the active period's offering (course, group, teacher, schedule, seats) and their current schedule.
- **Depends on:** F2.
- **Backend:** read serializers for groups with schedules and available seats; the student's schedule from their enrollment plus moves in progress. Optimize queries (`select_related`, `prefetch_related`, seats via `annotate`, not the per-row property). Creates `core/services/choques.py` with the base "group vs. my enrolled load" check, which F4 extends.
- **Frontend:** student dashboard, weekly schedule (grid and list) and catalog with search by course, code or teacher (as in `stitch/`). Request cart kept only in the browser (adds from the catalog, drops from the schedule); submitting is F5. Screen: `sabe_estudiantes`.
- **API contract:**
  - `GET /api/periodos/activo/` → `{ciclo, convocatoria_inicio, convocatoria_fin, convocatoria_abierta}` (`404` if there is no active period)
  - `GET /api/grupos/?q=&materia=&turno=&programa=` → `[{id, materia: {clave, nombre, creditos}, num_grupo, docente, turno, cupo_maximo, cupo_disponible, horarios: [{dia_semana, hora_inicio, hora_fin, aula}], choques: [{grupo, materia, num_grupo, dias, hora_inicio, hora_fin}]}]`. Empty `choques` = no clash.
  - `GET /api/estudiante/horario/` → `{ciclo, inscritas: [...groups], en_tramite: [{id, grupo, tipo_tramite, folio}]}`
- **Business rules:** only groups with `visible = True` in the active period. Students see their own program's offering by default. `choques` compares against the enrolled load of the active period; F4 adds the folio rules.
- **Accepted differences from stitch:** "{semestre}° Semestre" chip instead of "Alumno Regular"; bell with no badge, empty until F10; "en trámite" class with a dashed border and label; Seminario de Tesis fills both of its grid rows; cart starts closed on phones; catalog sorted by course code; open or closed convocatoria badge without dates.
- **Done when:** the demo student sees their schedule and the filterable catalog; the full group shows no seats; the screens match their `stitch/` design.
- **Target date:** Nov 14.
- **Status:** Pending.

### F4. Schedule clash detection

- **Goal:** a single backend service decides whether a set of moves creates clashes.
- **Depends on:** F1 (data to test with).
- **Backend:** extends `core/services/choques.py` (created in F3) with the student's occupied slots (enrolled load plus pending moves) and creates `core/services/validacion.py` with `validar_movimientos(estudiante, periodo, movimientos)`, which returns clashes and errors per move. Uses `HorarioGrupo.traslapa_con`. Used by the catalog, F5 (on create) and F6 (on approve). F5 adds its rules to `validacion.py`.
- **Frontend:** the catalog sends the cart and marks what clashes with it; the cart marks an invalid move in red with its reason and blocks going to confirmation.
- **API contract:**
  - `POST /api/solicitudes/validar/` `{movimientos: [{grupo, tipo}]}` → `{valido, movimientos: [{grupo, tipo, choques: [...], errores: [{codigo, detalle}]}]}`. `400` if the list is empty, a group doesn't exist or the type isn't `ALTA`/`BAJA`.
  - Each clash: `{grupo, materia, num_grupo, dias, hora_inicio, hora_fin, origen}`, with `origen` = `inscrita`, `carrito` or `en_tramite`.
  - `GET /api/grupos/?altas=12,14&bajas=5` → the catalog computes `choques` and `errores` with the cart.
  - Error codes: `repetido` (same group twice), `ya_inscrito`, `no_disponible` (outside the active period or hidden), `sin_cupo`, `misma_materia` (already taking or requested that course in another group) and `no_inscrito` (drop of a group the student doesn't have).
- **Business rules:**
  - Compare against the enrolled load, excluding drops in the same folio (D2), and against the other adds in the same folio (both are flagged).
  - Pending moves in other folios count: their adds take the slot and their drops free it. On approval (F6) only the enrolled load counts.
  - No other group of a course the student is already taking or requested, unless the same folio drops it.
  - If the student removes a drop an add depended on, the add stays in the cart marked red and they can't continue.
  - Touching edges (10:00 to 10:00) is not a clash. A course with a clash cannot be requested (there is no "force").
- **Accepted differences from stitch:** the clash sentence adds "(en tu carrito)" or "(en trámite)"; another group of a course the student already has uses the clash card with "Ya tienes esta materia en otro grupo"; in the cart, an invalid move is red with its reason and "Corrige los movimientos marcados para continuar.".
- **Done when:** unit tests covering: no clash, clash with enrollment, clash between two adds, an add replacing a drop in the same folio, touching edges, different days; the screens match their `stitch/` design.
- **Target date:** Nov 13.
- **Status:** Pending.

### F5. Student requests

- **Goal:** the student submits a folio with adds and drops, gets a receipt, sees their history and details, and can cancel what's pending.
- **Depends on:** F3, F4.
- **Backend:** folio creation service inside `transaction.atomic`, generating a unique `folio_digital`; list, detail and cancel.
- **Frontend:** the cart already exists from F3; here it is wired to submission. Confirmation (justification and declaration), receipt with folio, history, folio detail with rejection reason, cancel, closed enrollment window with late request, and printable receipt (D5). Screens: `sabe_estudiantes`, `sabe_detalle_de_folio_sabe_2026_014_estudiante`, `sabe_cancelar_solicitud_pendiente_estudiante`, `sabe_convocatoria_cerrada_solicitud_extempor_nea_estudiante`.
- **API contract:**
  - `POST /api/solicitudes/` `{justificacion, movimientos: [{grupo, tipo}]}` → `201 Solicitud`. `400` with `{"justificacion": [...]}`, `{"detail": "La convocatoria aún no abre."}` or `{"detail", "validacion"}` (same shape as `/validar/`).
  - `GET /api/solicitudes/` → `[Solicitud]`, newest first: students see their own, Control Escolar and admin see all (filters in F6).
  - `GET /api/solicitudes/{id}/` → `Solicitud`.
  - `POST /api/solicitudes/{id}/cancelar/` → cancels the pending moves and returns `Solicitud`; `400` if none are pending.
  - `Solicitud` = `{id, folio_digital, ciclo, fecha_solicitud, estado, extemporanea, justificacion, estudiante: {matricula, nombre, programa}, movimientos: [{id, grupo, tipo_tramite, estado, motivo_rechazo, revisado_por, fecha_resolucion}], resumen: {total, aprobadas, resueltas}}`.
- **Business rules:**
  - Folio format `SABE-2026-###`, sequential per year.
  - Justification: required; at least 100 characters if late; always 500 at most.
  - ALTA (add): the group has seats, the student isn't already enrolled in it, and it doesn't clash (F4). BAJA (drop): the student is enrolled in it.
  - A group can't have a pending move in another folio of the same student.
  - Validates with F4's `validar_movimientos` (pending moves in other folios count) and adds its rules there.
  - Before `convocatoria_inicio` it can't be sent. After `convocatoria_fin` the folio is saved as late (`Solicitud.extemporanea`) and can only be approved with `visto_bueno`.
  - A student can have several pending folios at once; the dashboard follows the most recent one.
  - New validation error code: `en_otro_folio` (the group already has a pending move in another folio of the student).
  - Only moves in `pendiente` status can be canceled; the whole folio is canceled, at any time.
- **Differences from stitch (agreed):** the detail, cancel and closed-window screens use the F3 portal frame; the history is the `sabe_estudiantes` one (receipt plus table); no verification code, no "Turno asignado", "Ventanilla UAE", "Plan 2020", "Al corriente" or the email line; "Descargar acuse (PDF)" becomes "Imprimir acuse"; the "seats released" phrases on cancel are dropped (a pending request doesn't hold a seat); "La convocatoria aún no abre" reuses the closing-notice card.
- **Done when:** tests for the creation service (each rule above); the full flow works in the browser with the demo student; the folio appears in the history and schedule as "in progress"; the screens match their `stitch/` design.
- **Target date:** Nov 17.
- **Status:** Pending.

### F6. Control Escolar inbox and review

- **Goal:** Control Escolar reviews folios and approves or rejects each move.
- **Depends on:** F5.
- **Backend:** the folio already stores `extemporanea` (F5) for filtering. Approve and reject service with `transaction.atomic` + `select_for_update` on the group. Approving an ALTA creates or reactivates the `CargaAcademica` (origin `solicitud`); approving a BAJA marks it `baja`.
- **Frontend:** inbox with filters (status, late, date), per-move review view with visible clashes, rejection with reason, sign-off (`visto_bueno`). Screen: `sabe_solicitudes_control_escolar`.
- **API contract:**
  - `GET /api/solicitudes/?estado=&extemporanea=&q=` (Control Escolar sees all)
  - `POST /api/movimientos/{id}/aprobar/` `{visto_bueno?}` → updated move
  - `POST /api/movimientos/{id}/rechazar/` `{motivo}` → updated move
- **Business rules:** on approval, seats and clashes are validated again (they may have changed since submission), against the enrolled load only (`contar_pendientes=False`). Rejecting without a reason returns `400`. A late request without `visto_bueno` cannot be approved. `revisado_por` and `fecha_resolucion` are saved.
- **Done when:** tests for approving the last seat (two simultaneous approvals don't exceed capacity), rejection without reason, late request without sign-off; full flow in the browser; the screens match their `stitch/` design.
- **Target date:** Nov 20.
- **Status:** Pending.

### F7. Period, enrollment window and course offering

- **Goal:** Control Escolar configures the period, the enrollment window dates and the offering (courses, teachers, groups and per-day schedules).
- **Depends on:** F2.
- **Backend:** CRUD with `ModelViewSet` for periods, courses, teachers, groups and schedules. Activating a period deactivates the previous one.
- **Frontend:** screens `sabe_periodo_y_convocatoria_control_escolar` and `sabe_oferta_academica_control_escolar` (per-day and per-hour schedule, seats, publish or show/hide).
- **API contract:** `/api/periodos/`, `/api/periodos/{id}/activar/`, `/api/materias/`, `/api/docentes/`, `/api/grupos/` (write), `/api/grupos/{id}/horarios/`.
- **Business rules:** only one active period (already enforced in the database). `cupo_maximo` can't be lowered below the number enrolled. A group with enrollments or requests isn't deleted; it is hidden.
- **Done when:** Control Escolar creates a group with a schedule and the student sees it in the catalog; the screens match their `stitch/` design.
- **Target date:** Nov 21.
- **Status:** Pending.

### F8. CSV import

- **Goal:** Control Escolar uploads students and their enrollment by CSV, sees errors before confirming, and can re-import without duplicates.
- **Depends on:** F2, F7 (groups must exist).
- **Backend:** two-step service: preview (validates and returns good rows and rows with errors) and confirm (inside `transaction.atomic`). Downloadable templates.
- **Frontend:** screen `sabe_importaci_n_de_csv_control_escolar`: upload file, preview table with errors per row, confirm.
- **API contract:**
  - `GET /api/importaciones/plantilla/{alumnos|cargas}/` → CSV
  - `POST /api/importaciones/{alumnos|cargas}/?modo=preview|confirmar` (multipart `archivo`) → `{validas, errores: [{fila, campo, mensaje}], creados, actualizados}`
- **Business rules:** students are identified by matrícula (updated if they exist). A new student gets a temporary password and `debe_cambiar_password = True`. Enrollments are identified by (matrícula, course code, group, period). Student columns: matrícula, first name, last names, email, program, semester, shift.
- **Done when:** tests with a valid CSV, one with errors, and one re-imported; the preview shows errors per row; the screens match their `stitch/` design.
- **Target date:** Nov 22.
- **Status:** Pending.

### F9. SADCE export and batches

- **Goal:** Control Escolar downloads approved moves as Excel or CSV and then marks the batch as uploaded to SADCE.
- **Depends on:** F6, D1.
- **Backend:** service that takes `aprobada` moves with no batch, generates the file with `openpyxl` or `csv`, creates the `LoteExportacion` and assigns them. Marking as uploaded moves them to `cargada_sadce`.
- **Frontend:** screen `sabe_lotes_exportados_a_sadce_control_escolar`: pending export, list of batches, download again, mark as uploaded.
- **API contract:**
  - `GET /api/exportaciones/pendientes/` → approved moves with no batch
  - `POST /api/exportaciones/` `{formato: "xlsx"|"csv"}` → downloadable file and created batch
  - `GET /api/exportaciones/` → batches
  - `GET /api/exportaciones/{id}/descargar/` → the batch's file
  - `POST /api/exportaciones/{id}/marcar-cargado/` → `204`
- **Business rules:** a move belongs to only one batch. Columns per D1. Marking as uploaded notifies the students (F10).
- **Done when:** service tests (no repeated moves, `total_registros` counted correctly); the Excel file opens correctly in Excel and LibreOffice; the screens match their `stitch/` design.
- **Target date:** Nov 23.
- **Status:** Pending.

### F10. Notifications and audit log

- **Goal:** users see notices about their requests and there's a record of who did what.
- **Depends on:** F5, F6.
- **Backend:** helpers `notificar(usuario, mensaje)` and `registrar(usuario, accion, entidad, request)` called from the services. Audit log is read-only (no editing or deleting through the API).
- **Frontend:** bell and panel for students and Control Escolar; audit log with filters and CSV download. Screens: `sabe_panel_de_notificaciones_estudiante_y_control_escolar`, `sabe_notificaciones_de_control_escolar_uae_uan`, `sabe_bitacora_auditoria`.
- **API contract:**
  - `GET /api/notificaciones/` → `{no_leidas, resultados: [...]}`
  - `POST /api/notificaciones/{id}/leer/`, `POST /api/notificaciones/leer-todas/`
  - `GET /api/bitacora/?accion=&usuario=&desde=&hasta=`, `GET /api/bitacora/exportar/` → CSV
- **Business rules:** notify on folio submission (to the student and Control Escolar), approval, rejection and SADCE upload. Log: login, create and cancel folio, approve, reject, CSV import, export, mark as uploaded, and catalog and user changes.
- **Done when:** every action on the list leaves its row in the audit log; the student sees the notification of their decision; the screens match their `stitch/` design.
- **Target date:** Nov 24.
- **Status:** Pending.

### F11. Users and roles (administrator)

- **Goal:** the administrator creates Control Escolar staff accounts, changes roles, deactivates accounts and resets passwords.
- **Depends on:** F2.
- **Backend:** user CRUD for administrators only; reset to a temporary password.
- **Frontend:** screen `sabe_usuarios_y_roles_administrador`.
- **API contract:** `/api/usuarios/`, `POST /api/usuarios/{id}/reiniciar-password/` → `{password_temporal}`.
- **Business rules:** users aren't deleted, they're deactivated. The administrator can't remove their own role. A reset turns on `debe_cambiar_password`.
- **Done when:** the admin creates a Control Escolar user who can log in; the screens match their `stitch/` design.
- **Target date:** Nov 24. **Optional** if H3 slips (the Django admin can be used instead).
- **Status:** Pending.

### F12. Deployment

- **Goal:** the app runs on a public URL with HTTPS.
- **Depends on:** everything above; preparation starts in H2.
- **Backend:** production settings via environment variables (`DEBUG=0`, `SECRET_KEY`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, secure cookies, HSTS), Gunicorn, static files with WhiteNoise, `python manage.py check --deploy` with no warnings.
- **Frontend:** `npm run build` served by Nginx, which also forwards `/api/` to the backend.
- **Infrastructure:** `Dockerfile` for the backend and frontend; `docker-compose.prod.yml` with db, backend and frontend; database backup; SMTP email if D4 requires it. CI on GitHub Actions: backend tests and `npm run build` on every PR.
- **API contract:** not applicable.
- **Business rules:** the production `.env` is never committed to the repository. `seed_demo` only in the demo environment.
- **Done when:** the H2 and H3 flows can be completed on the public URL from both a phone and a computer; the screens on the public URL look the same as in `stitch/`.
- **Target date:** Nov 27.
- **Status:** Pending.

### F13. Final testing and documentation

- **Goal:** the delivery works end to end and is documented.
- **Depends on:** F12.
- **Tasks:** full walkthrough with all 3 roles in production; quick usability test with 2 or 3 classmates; fix the bugs found; update the README (how to start, how to deploy, demo users), `SABE_Contexto_Completo.md` and this plan; prepare the presentation script.
- **Done when:** no bugs block the main flow, and the README lets a newcomer set up the project; every screen got a final check against its `stitch/` design.
- **Target date:** Nov 28.
- **Status:** Pending.
