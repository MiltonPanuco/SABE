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
| D1 | Exact columns of the SADCE Excel file | **Decided:** Ciclo, Folio, Matrícula, Nombre, Programa, Clave materia, Materia, Grupo, Docente, Tipo (ALTA/BAJA) and Fecha de aprobación; one row per move and a single header row | Nov 13 |
| D2 | Does an add that clashes with a drop in the same folio count as a clash? | **Decided:** no, the drop in the same folio frees the slot (group change) | Nov 11 |
| D3 | "~24 business hours" resolution text | Remove it | Nov 11 |
| D4 | Password recovery: real email or reset by Control Escolar? | **Decided:** no email. The admin (Usuarios y Roles) or Control Escolar (from the student's folio) resets to a temporary password shown once on screen (F11) | Nov 18 |
| D5 | Folio receipt: server-side PDF or printable view? | **Decided:** printable view in the frontend (`window.print`), "Imprimir acuse" button, no new dependencies | Nov 14 |
| D6 | Where to host | **Decided:** the team's Oracle Cloud VM with Docker Compose (Postgres, Gunicorn and Caddy), at `https://sabe.163-192-148-141.sslip.io` (a free sslip.io name with a Let's Encrypt certificate) | Nov 20 |

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
- **Status:** Done.

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
- **Status:** Done.

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
- **Differences from stitch (agreed):** the detail, cancel and closed-window screens use the F3 portal frame; the history is the `sabe_estudiantes` one (receipt plus table); no verification code, no "Turno asignado", "Ventanilla UAE", "Plan 2020", "Al corriente" or the email line; "Descargar acuse (PDF)" becomes "Imprimir acuse"; the "seats released" phrases on cancel are dropped (a pending request doesn't hold a seat); "La convocatoria aún no abre" reuses the closing-notice card. Accepted without a stitch design: the history's "Resolución" texts ("1 de 2 aprobados"), the tracker's "No aplica" step on cancelled or rejected folios, the static "Filtro rápido" chip, and "Docente: X" on each item of the late request.
- **Done when:** tests for the creation service (each rule above); the full flow works in the browser with the demo student; the folio appears in the history and schedule as "in progress"; the screens match their `stitch/` design.
- **Target date:** Nov 17.
- **Status:** Done.

### F6. Control Escolar inbox and review

- **Goal:** Control Escolar reviews the period's folios and approves or rejects each move.
- **Depends on:** F5.
- **Backend:** `core/services/bandeja.py` (filters and KPIs in SQL) and `core/services/dictamen.py` (approve and reject in `transaction.atomic`, with `select_for_update` on the student, the group and the move, in that order). Approving an ALTA creates or reactivates the `CargaAcademica` (origin `solicitud`); approving a BAJA marks it `baja`. `core/services/avisos.py` with `notificar()`: the student gets a notification when each move is approved or rejected.
- **Frontend:** the Control Escolar frame (side menu and header shared by its 6 screens), the inbox with KPIs and filters (text, status, type), and the per-move folio review: clashes and seats shown, rejection with a reason, and sign-off on late folios. Screen: `sabe_solicitudes_control_escolar`. `seed_demo` leaves 3 folios from other students for the demo (`--sin-folios` skips them).
- **API contract:**
  - `GET /api/solicitudes/?estado=pendiente|parcial|dictaminada|rechazada|cancelada&extemporanea=true|false&q=` → `[Solicitud]`. Control Escolar and admin see the active period; without `estado`, fully cancelled folios are hidden. Students still see all of theirs (F5).
  - `GET /api/solicitudes/resumen/` → `{folios_pendientes, movimientos_aprobados, movimientos_rechazados, extemporaneos}`.
  - `GET /api/solicitudes/{id}/revision/` → `{movimientos: [{id, choques, errores}]}`: what currently blocks approving each pending move.
  - `POST /api/movimientos/{id}/aprobar/` `{visto_bueno?}` → full `Solicitud`. `400` with `detail` (plus `choques`/`errores` when blocked).
  - `POST /api/movimientos/{id}/rechazar/` `{motivo}` → full `Solicitud`. `400` with `{"motivo": [...]}` or `{"detail"}`.
  - `Solicitud` gains `estado_bandeja` and `estudiante.semestre`.
- **Business rules:**
  - Only Control Escolar decides; the admin only reads. Only `pendiente` moves can be decided, and a decision can't be undone.
  - On approval, seats and clashes are validated again (they may have changed since sending), against the enrolled load only (`contar_pendientes=False`).
  - Group change: the BAJA of the same folio is approved first. While it is pending, an ALTA that clashes with it (or is the same subject) is blocked with code `baja_pendiente`: "Aprueba primero la baja de {materia} en este folio."
  - A late folio without `visto_bueno` cannot be approved. The sign-off is saved on each approved move.
  - Rejecting without a reason returns `400`; the reason is at most 500 characters. `revisado_por` and `fecha_resolucion` are saved.
  - Folio state once nothing is pending: approved if any move was approved; otherwise loaded in SADCE, rejected or cancelled, in that order.
- **Differences from stitch (agreed):** the F7–F10 menu items open a "Próximamente" page inside the frame; on phones the side menu is a panel opened with a button (stitch has no phone layout); the bell and logout that `prototipo.js` adds sit inside the header; the "Aprueba primero la baja…" text is new; the header name comes from the user, without "Lic."; fully cancelled folios don't appear in the inbox; a cancelled move says "Cancelado por el alumno".
- **Done when:** tests for approving the last seat (two simultaneous approvals don't exceed capacity), rejection without a reason, a late folio without sign-off, and the group change; full flow in the browser; the screens match their `stitch/` design.
- **Target date:** Nov 20.
- **Status:** Done.

### F7. Period, enrollment window and course offering

- **Goal:** Control Escolar configures the period, the enrollment window dates and the offering (courses, teachers, groups and per-day schedules).
- **Depends on:** F2.
- **Backend:** `core/services/periodos.py` (save and activate in `transaction.atomic`, with `select_for_update` on the periods) and `core/services/oferta.py` (publish and edit a group with its full schedule, hide and show). `registrar()` in `core/services/avisos.py` logs every change to periods, groups and teachers in the audit log (pulled forward from F10). `seed_demo` adds the 2025-B, 2025-A and 2024-B cycles (inactive, no groups) and the activation of 2026-A by Control Escolar.
- **Frontend:** screens `sabe_periodo_y_convocatoria_control_escolar` (active period, window progress, cycle catalog, new and edit period, activate) and `sabe_oferta_academica_control_escolar` (filters, publish, edit, deactivate and activate, new teacher from the form).
- **API contract:**
  - `GET /api/periodos/` → `[Periodo]` with `estado_convocatoria` (`programada|abierta|cerrada`) and `movimientos_pendientes`. Control Escolar and admin.
  - `POST /api/periodos/` and `PATCH /api/periodos/{id}/` `{ciclo, fecha_inicio, fecha_fin, convocatoria_inicio, convocatoria_fin, activar?}` → `Periodo`.
  - `POST /api/periodos/{id}/activar/` → `Periodo`. `400 {detail}` if the active period has pending moves, approved moves not exported, or batches not marked as uploaded (F9).
  - `GET /api/periodos/ultima-modificacion/` → `{usuario, fecha}` or `null`.
  - `GET /api/grupos/?oferta=1&q=&programa=&cupo=con|sin` (Control Escolar) → `[Grupo]`, hidden ones included.
  - `POST /api/grupos/` and `PATCH /api/grupos/{id}/` `{clave, nombre_materia, programa, num_grupo, cupo_maximo, docente, horarios: [{dia_semana, hora_inicio, hora_fin}]}` → `Grupo`. `PATCH` with only `{visible}` shows or hides it. Control Escolar only.
  - `GET /api/docentes/`, `POST /api/docentes/` `{nombre, grado_academico?}` (Control Escolar). `GET /api/programas/` (any user).
  - `Grupo` adds `visible` and `materia.programa`. No `DELETE` for periods or groups, and no separate endpoints for courses or schedules: the schedule goes inside the group.
- **Business rules:**
  - Only one active period. Another one can't be activated while the active one has pending moves: "Dictamina los N movimientos pendientes de 2026-A antes de activar otro periodo." Since F9, not while it has approved moves not exported ("Exporta a SADCE los N movimientos aprobados de 2026-A…") or batches waiting to be uploaded ("Marca como cargado en SADCE los N lotes en espera de 2026-A…") either. If activation was asked for on create and fails, nothing is saved.
  - Cycle in `AAAA-A` or `AAAA-B` format, no duplicates. The semester end and the window close come after their start.
  - The offering is always the active period's. The course is identified by its key: if it exists it is reused and its name and program are updated (in all its groups); if not, it is created with 8 credits.
  - Key and group number can't repeat in the period. Max seats is above 0 and can't go below the number enrolled. A group with students or requests can't change its key.
  - Schedule with at least one day; end time after start time; two rows on the same day can't overlap. The shift comes from the earliest start time (13:00 or later is afternoon). When editing, the room is kept per day.
  - A group is never deleted, it is hidden. A pending ALTA on a hidden group is blocked at approval (`no_disponible`).
  - Changing the schedule of a group with enrolled students is allowed: approval re-checks clashes.
- **Differences from stitch (agreed):** "+ Nuevo docente" in the teacher dropdown (team decision); new texts for the scheduled and closed window ("Convocatoria programada", "Abre en…", "Cerró el…", "Programada", "Próximo"); the program list comes from the data (no "Posgrados UAE"); "Activar" uses an in-page dialog with the text of stitch's `confirm()`; the edit form is titled "Editar periodo escolar"; new texts "Dos horarios del mismo día se traslapan." and "Dictamina los N movimientos pendientes…"; the footer name comes from the user, without "Lic."; the stitch screenshot has an older menu (Dictamen en Lote, Cruces…) and the frame keeps the `code.html` one, as in F6.
- **Done when:** tests for creating and activating periods (with and without pending moves), publishing and editing groups (duplicate, low seats, invalid schedules), hiding, and the audit row of each change; Control Escolar creates a group with a schedule and the student sees it in the catalog; the screens match their `stitch/` design.
- **Target date:** Nov 21.
- **Status:** Done.

### F8. CSV import

- **Goal:** Control Escolar uploads students and their enrollment by CSV, sees errors before confirming, and can re-import without duplicates.
- **Depends on:** F2, F7 (groups must exist).
- **Backend:** `core/services/importacion.py` in two steps: preview (reads and validates, writes nothing) and confirm (analyzes the file again and imports the valid rows inside `transaction.atomic`, skipping the rows with errors). History in the `ImportacionCSV` model (folio `IMP-2026A-001`) and an `importar_csv` audit row. `Programa` gets a `clave` (L-ECO, L-FIN). Temporary passwords use a light PBKDF2 hasher (`core/hashers.py`) so 120 students take under a second.
- **Frontend:** screen `sabe_importaci_n_de_csv_control_escolar` with its 3 steps (file, preview, result), templates, import history, error report and download of the generated accounts.
- **API contract:** (Control Escolar only)
  - `GET /api/importaciones/plantilla/{alumnos|cargas}/` → CSV with the headers.
  - `POST /api/importaciones/{alumnos|cargas}/?modo=vista_previa` (multipart `archivo`) → `{tipo, archivo, total, validas, avisos, errores: [{linea, matricula, datos, mensaje}], muestra: [{linea, datos, accion, avisos}]}`. Writes nothing.
  - `POST /api/importaciones/{alumnos|cargas}/?modo=confirmar` → `201 {folio, tipo, creados, actualizados, excluidos, credenciales: [{matricula, nombre, email, password}]}`. Temporary passwords only come in this response.
  - `GET /api/importaciones/` → history `[{id, folio, tipo, archivo, usuario, fecha, total, creados, actualizados, excluidos}]`.
  - Columns: students `matricula,nombre,apellidos,email,programa,semestre,turno`; enrollments `matricula,clave_materia,num_grupo,ciclo`.
- **Business rules:**
  - UTF-8 CSV (BOM and `;` accepted), at most 25 MB, with exactly the columns of its type. It always imports into the active period.
  - Students: 9-digit matrícula, not repeated in the file; `@uan.edu.mx` or `@alumnos.uan.edu.mx` email not used by another account; program by code or name; semester 1 to 10; shift morning, afternoon or empty. An existing matrícula gets its data updated, never its password. A new student gets a random temporary password and `debe_cambiar_password = True`.
  - Enrollments: the student, course and group must exist in the active period, and the cycle must be the active one. Enrollments are only added: an enrolled one stays "Sin cambios" and a dropped one is respected. A student can't be in two groups of the same course.
  - An enrollment over the seat limit or clashing with the student's schedule is imported anyway (it is SADCE's official load) and the preview flags it with a warning.
  - Rows with errors are skipped; with no valid rows nothing is imported.
- **Differences from stitch (agreed):** seat and clash warnings under the row's action; "Ver cuentas de estudiantes generadas" downloads the temporary passwords; "Descargar reporte de errores (.csv)" without PDF; error texts adapted to the data ("Materia inexistente: X." instead of "…en el plan curricular 2020", groups "01" and codes "EC504" instead of "G-01" and "ECO-204") and new texts for the other rules; the sample shows up to 10 rows; enrollments use the same wizard with their own columns ("Cargas procesadas", "cargas nuevas"); its own text when there were no new records; the selected card looks like stitch's screenshot (light icon box, no check mark); the screenshot has an older menu and a single type card, and `code.html` is followed.
- **Done when:** tests with a valid CSV, one with errors and one re-imported (students and enrollments); the preview shows errors per row; a new student logs in with the temporary password and changes it; the screens match their `stitch/` design.
- **Target date:** Nov 22.
- **Status:** Done.

### F9. SADCE export and batches

- **Goal:** Control Escolar downloads approved moves as Excel or CSV and then marks the batch as uploaded to SADCE.
- **Depends on:** F6, D1.
- **Backend:** `core/services/exportacion.py`. Generating puts every `aprobada` move of the active period that has no batch into a new batch (`transaction.atomic` with `select_for_update` on the period and the moves). `LoteExportacion` adds `periodo`, `numero` (folio `LOTE-2026A-001`, per period), `cargado_por` and `fecha_carga`. The file is not stored: it is built with `openpyxl` or `csv` on each download from the batch's moves, which no longer change. Marking as uploaded moves them to `cargada_sadce`, notifies each student once per folio with `notificar()`, and logs `exportar_sadce` and `marcar_cargado` in the audit log.
- **Frontend:** screen `sabe_lotes_exportados_a_sadce_control_escolar`: tabs Lotes Exportados, Movimientos Pendientes de Exportar and Plantilla del Excel (in the URL, `?vista=`), four summary cards, filters, download again, "Generar Excel de intercambio" and "Confirmar Carga Manual en SADCE".
- **API contract:** (Control Escolar only, always the active period; without an active period `400 {detail}`)
  - `GET /api/exportaciones/?q=&formato=xlsx|csv&estado=exportado|cargado` → `[Lote]`, newest first. `Lote`: `{id, folio, fecha, usuario, formato, total_registros, cargado, fecha_carga, cargado_por, alumnos, altas, bajas, programas}`.
  - `POST /api/exportaciones/` `{formato}` → `201 Lote`. `400 {detail}` if there is nothing to export. The file is then fetched with `descargar`.
  - `GET /api/exportaciones/pendientes/` → approved moves with no batch `[{id, folio, matricula, alumno, programa, tipo, clave, materia, grupo, docente, horarios, fecha_aprobacion}]`.
  - `GET /api/exportaciones/resumen/` → `{dictaminados, altas, bajas, cargados, porcentaje_cargado, lotes, lotes_en_espera, movimientos_en_espera, pendientes, ultima}`.
  - `GET /api/exportaciones/plantilla/` → `[{encabezado, descripcion, ejemplo}]`, the D1 columns.
  - `GET /api/exportaciones/{id}/descargar/` → file `LOTE-2026A-001.xlsx` or `.csv`.
  - `POST /api/exportaciones/{id}/marcar-cargado/` → `Lote`. `400 {detail}` if it was already uploaded.
- **Business rules:**
  - A move belongs to only one batch. Each batch takes every pending approved move of the period; moves are not picked by hand.
  - Columns per D1. In Excel the matrícula and group are text and the date is a date; the CSV is UTF-8 with BOM.
  - Marking as uploaded notifies the students ("Tu solicitud SABE-2026-014 fue cargada en SADCE.") and can't be repeated.
  - Another period can't be activated with approved moves not exported or batches waiting (see F7).
- **Differences from stitch (agreed):** the pending and template tabs, the guide button and the "Generar Excel de intercambio" dialog are new because stitch doesn't design them (the pending table follows the "Concentrado de Cargas para SADCE"); in stitch "Generar Excel" opens the mark-as-uploaded dialog, here it opens its own; the verification checkbox starts unchecked and the button turns on when it is checked, instead of `alert()`; "Generar Excel" is disabled when there is nothing to export; "Total Movimientos Dictaminados" counts approved and uploaded moves (rejected ones aren't exported); the exporter's name comes from the user, without "Lic.", with "Ventanilla UAE" under it for everyone.
- **Done when:** service tests (no repeated moves, `total_registros` counted correctly); the Excel file opens correctly in Excel and LibreOffice; the screens match their `stitch/` design.
- **Target date:** Nov 23.
- **Status:** Done.

### F10. Notifications and audit log

- **Goal:** users see notices about their requests and there is a record of who did what.
- **Depends on:** F5, F6.
- **Backend:** `core/services/avisos.py`. Notices have `tipo`, `titulo`, `mensaje`, an optional folio and `datos` (JSON with what the card shows: moves, schedule, counts). One function per event (`aviso_folio_enviado`, `aviso_cancelacion`, `aviso_dictamen`, `aviso_cargada_sadce`, `aviso_importacion`) builds stitch's texts; notices for Control Escolar are copied to each active Control Escolar user. Two notices depend on a state and are created on read (`avisos_al_leer`): "La convocatoria cierra en 24 horas" (once per student and period) and "Lote de actas dictaminadas listo para exportación" (one per Control Escolar user, updated with the count and removed when a batch is generated). `registrar()` also stores `detalle`, the sentence shown in the audit log. Login (`EntrarView`) logs every successful sign-in. The audit log is read-only (not editable in the Django admin either).
- **Frontend:** a bell with the unread count (refreshed every minute) in both portals. Student: a dropdown with the latest 5 and "Ver todas las notificaciones" → `/estudiante/notificaciones` (`sabe_panel_de_notificaciones_estudiante_y_control_escolar`). Control Escolar: `/control-escolar/notificaciones` (`sabe_notificaciones_de_control_escolar_uae_uan`) with filters, cards per type and the operational summary, and `/control-escolar/bitacora` (`sabe_bitacora_auditoria`) with search, action and role filters, "Cargar más registros" and CSV download.
- **API contract:**
  - `GET /api/notificaciones/?estado=no_leidas&categoria=&q=&orden=antiguas&limite=20` → `{no_leidas, total, conteos: {todas, no_leidas, tramites, resoluciones, convocatoria, nuevas, cancelaciones, sistema}, resultados: [{id, tipo, titulo, mensaje, leida, fecha, folio, solicitud, datos, categorias}]}`. Only the user's own.
  - `POST /api/notificaciones/{id}/leer/` → the notice; `POST /api/notificaciones/leer-todas/` → `{marcadas}`.
  - `GET /api/notificaciones/resumen-operativo/` (Control Escolar) → `{cancelaciones_hoy, cancelaciones_ayer}`.
  - `GET /api/bitacora/?q=&categoria=&rol=&desde=&hasta=&pagina=` (Control Escolar and admin) → `{total, pagina, paginas, resultados: [{id, fecha, usuario, rol, categoria, accion, detalle, ip}]}`, 50 per page.
  - `GET /api/bitacora/exportar/?…` → CSV `Fecha,Usuario,Rol,Accion,Detalle` (UTF-8 with BOM), `bitacora_sabe_2026A.csv`.
- **Business rules:**
  - Notices are sent when a folio is sent (to the student and Control Escolar; "Petición extemporánea recibida" if late), cancelled (to Control Escolar), approved, rejected (with the motive), uploaded to SADCE (one per folio) and when a CSV import finishes (to Control Escolar).
  - The audit log records: sign-in, sending and cancelling a folio, approve, reject, CSV import, export, mark as uploaded, period and offering changes (and user changes in F11). A failed sign-in is not logged.
  - "Acción" filter categories: Dictamen, Importación, Exportación, Oferta, Periodo, Usuarios and Acceso.
- **Differences from stitch (agreed):** on Control Escolar's screen, "Configurar alertas", "Canales de Notificación Activa", the "Servidor SABE 100% / Latencia" card (now "Folios Extemporáneos"), the support extension, the PDF attachment on late folios, "Cupos reincorporados / N plazas devueltas" (pending folios don't hold seats) and "Submódulo 2.9" are removed; the import card has no "Ver reporte de errores" (errors aren't stored) and its button goes to Importación de Datos; texts start with the student's name, without "El estudiante" / "La estudiante"; the student bell stays a dropdown (in `prototipo.js` it goes straight to the page) and adds "Ver todas las notificaciones"; "Ver dictamen…" opens the folio page instead of the modal; the student page uses the portal's frame, not the panel's older menu; the audit log shows every record, not only "del ciclo 2026-A", with "Cargar más registros"; no "24 horas hábiles" or "Tiempo promedio de resolución" (D3).
- **Done when:** each action on the list leaves its row in the audit log; the student sees the notice of their decision; the screens match their `stitch/` design.
- **Target date:** Nov 24.
- **Status:** Done.

### F11. Users and roles (administrator)

- **Goal:** the administrator creates Control Escolar staff accounts, changes roles, deactivates accounts and resets passwords.
- **Depends on:** F2.
- **Backend:** `core/services/usuarios.py` (`crear_personal`, `cambiar_rol`, `cambiar_estado`, `reiniciar_password`), each change in `transaction.atomic` with `select_for_update` and its audit-log row (category "Usuarios"). Temporary passwords use F8's generator and light hasher. `EntrarView` updates `last_login` ("Último acceso").
- **Frontend:** the admin uses the same frame as Control Escolar with stitch's menu (Usuarios y Roles, Periodo y Convocatoria, Bitácora de Auditoría; no bell). Screen `sabe_usuarios_y_roles_administrador` (`/administrador/usuarios`): cards, the account-creation rule, search, role and status filters, a table with reset password, change role and activate/deactivate, "+ Nuevo usuario" and "Exportar Auditoría". Control Escolar gets "Restablecer contraseña" in the student's record when reviewing a folio.
- **API contract:**
  - `GET /api/usuarios/?q=&rol=&estado=activos|inactivos&pagina=` (admin) → `{total, pagina, paginas, conteos: {todos, estudiantes, estudiantes_activos, control_escolar, administradores}, resultados: [{id, username, nombre, apellidos, email, rol, activo, ultimo_acceso, origen, ip, matricula, programa, es_yo}]}`, 20 per page.
  - `POST /api/usuarios/` `{nombre, apellidos, email, rol: control_escolar|administrador}` → `201 {usuario, password_temporal}`.
  - `PATCH /api/usuarios/{id}/` `{rol}` or `{activo}` → the user. No `DELETE`.
  - `POST /api/usuarios/{id}/reiniciar-password/` → `{password_temporal}`.
  - `GET /api/usuarios/exportar/?…` → CSV `Nombre,Usuario,Correo,Rol,Estado,Ultimo acceso`.
  - `POST /api/solicitudes/{id}/reiniciar-password/` (Control Escolar) → `{password_temporal}` for the folio's student.
- **Business rules:**
  - Users aren't deleted, they're deactivated. A deactivated account can't log in and its open session stops working.
  - Only Control Escolar and admin accounts are created here; students come from CSV (F8) and their role doesn't change. The username is the part of the email before the @; the email must be `@uan.edu.mx` and unique.
  - The admin can't change their own role or deactivate themself, and at least one active admin always remains. The admin role also grants Django admin access.
  - A new password is temporary, shown once, and turns on `debe_cambiar_password` (D4).
- **Differences from stitch (agreed):** the form asks for "Nombre" and "Apellidos" instead of a single "Nombre Completo" (team decision); no email is sent: the temporary password is shown once with "Copiar" (D4); "Último acceso" shows the origin by role and the real IP; the header shows the admin's name and "Administrador del sistema"; no "BUILD v2.11-SEC" in the footer; Control Escolar's "Restablecer contraseña" on the folio is new (team decision); the name column truncates so the actions fit without scrolling the table.
- **Done when:** the admin creates a Control Escolar user who can log in; the screens match their `stitch/` design.
- **Target date:** Nov 24.
- **Status:** Done.

### F12. Deployment

- **Goal:** the app runs on a public URL with HTTPS.
- **Depends on:** everything above; preparation starts in H2.
- **Backend:** production settings via environment variables (`DEBUG=0`, `SECRET_KEY`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, secure cookies, HSTS), Gunicorn, static files with WhiteNoise, `python manage.py check --deploy` with no warnings.
- **Frontend:** `npm run build` served by **Caddy** (instead of Nginx: it gets and renews the HTTPS certificate on its own), which also forwards `/api/`, `/admin/` and `/static/` to the backend and sends React routes to `index.html`. Security headers (CSP on the React app). The admin demo-login button only shows in development.
- **Infrastructure:** `backend/Dockerfile` (Python 3.14, Gunicorn, migrations on start, non-root user), `frontend/Dockerfile` (Vite build + Caddy) and `docker-compose.prod.yml` (project `sabe-prod`: db with no published port, backend, web on 80/443 and `backup`, which keeps a daily `pg_dump` in `./backups` for 7 days). Variables in `.env.prod` (template `.env.prod.example`). No SMTP (D4). CI on GitHub Actions (`.github/workflows/ci.yml`): migrations, API contract, backend tests on Postgres and `npm run build` on every PR and push.
- **API contract:** not applicable. `POST /api/auth/token/` returns `429` after 10 attempts per minute from the same IP (`SABE_LOGIN_RATE`). The count lives in a cache shared through PostgreSQL (Gunicorn's processes share it) and the IP comes from Caddy's `X-Forwarded-For`.
- **Business rules:**
  - `.env.prod` is never committed (mode 600 on the server). With `DJANGO_DEBUG=0` the backend refuses to start without its own `DJANGO_SECRET_KEY` of 50+ characters.
  - `seed_demo` never runs on its own: it's run by hand after the first deploy and to reset the demo. In production `admin` uses `SABE_ADMIN_PASSWORD`; the other demo users keep `demo1234`.
  - HSTS starts at one day (`SECURE_HSTS_SECONDS`), without preload (the domain isn't ours).
- **Decisions (agreed):** Caddy instead of Nginx, one-day HSTS without preload, the admin password in `.env.prod` and no admin demo button, a login limit of 10 attempts per minute, a daily backup kept 7 days, and CI on GitHub Actions.
- **Done when:** the H2 and H3 flows can be completed on the public URL from both a phone and a computer; the screens on the public URL look the same as in `stitch/`.
- **Target date:** Nov 27.
- **Status:** Done.

### F13. Final testing and documentation

- **Goal:** the delivery works end to end and is documented.
- **Depends on:** F12.
- **Tasks:**
  - Full walkthrough in production with all 3 roles, at 1280 and 390 px: cart with a blocked clash, sending, receipt, cancelling; first access; review (approve, reject with motive, late folio with visto bueno); offering; import; export and loaded batch; notifications and audit log; the admin's users. No console errors, no 5xx responses and no sideways scroll.
  - Final review of every screen against `stitch/` (table below).
  - README complete for a newcomer (tested by cloning the repository and following it word for word), `SABE_Contexto_Completo.md` and this plan up to date.
  - Usability test kit for 2 or 3 classmates: [`docs/pruebas/prueba_usabilidad.md`](pruebas/prueba_usabilidad.md). The team runs it.
  - Presentation script: [`docs/presentacion/guion.md`](presentacion/guion.md).
- **Final review against `stitch/`:**

| Screen (stitch) | Result |
|---|---|
| Login, forced password change | Same as stitch |
| Password recovery | Same structure; stitch's `code.html` renders broken outside its viewer (text without contrast). "Continuar" instead of "Enviar enlace" (F2, no email) |
| Student portal: dashboard, schedule, catalog, confirmation | Same as stitch |
| History and receipt, folio detail | Same as the portal's history and `sabe_detalle_de_folio` (differences agreed in F5) |
| Student notification center | Same (differences agreed in F10) |
| Control Escolar inbox and folio review | Same (differences agreed in F6) |
| Course offering, Period and call | Same (differences agreed in F7) |
| CSV import | Same (differences agreed in F8) |
| SADCE export | Same (differences agreed in F9) |
| Control Escolar notifications, Audit log | Same (differences agreed in F10) |
| Users and roles | Same (differences agreed in F11) |

At 390 px no screen scrolls sideways. No new bugs or unagreed differences were found.

- **Done when:** no bugs block the main flow, and the README lets a newcomer set up the project; every screen got a final check against its `stitch/` design.
- **Target date:** Nov 28.
- **Status:** Done.
