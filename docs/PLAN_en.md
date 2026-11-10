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
- **Differences from stitch (agreed):** the detail, cancel and closed-window screens use the F3 portal frame; the history is the `sabe_estudiantes` one (receipt plus table); no verification code, no "Turno asignado", "Ventanilla UAE", "Plan 2020", "Al corriente" or the email line; "Descargar acuse (PDF)" becomes "Imprimir acuse"; the "seats released" phrases on cancel are dropped (a pending request doesn't hold a seat); "La convocatoria aún no abre" reuses the closing-notice card. Accepted without a stitch design: the history's "Resolución" texts ("1 de 2 aprobados"), the tracker's "No aplica" step on cancelled or rejected folios, the static "Filtro rápido" chip, and "Docente: X" on each item of the late request.
- **Done when:** tests for the creation service (each rule above); the full flow works in the browser with the demo student; the folio appears in the history and schedule as "in progress"; the screens match their `stitch/` design.
- **Target date:** Nov 17.
- **Status:** Pending.

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
- **Status:** Pending.

### F7. Period, enrollment window and course offering

- **Goal:** Control Escolar configures the period, the enrollment window dates and the offering (courses, teachers, groups and per-day schedules).
- **Depends on:** F2.
- **Backend:** `core/services/periodos.py` (save and activate in `transaction.atomic`, with `select_for_update` on the periods) and `core/services/oferta.py` (publish and edit a group with its full schedule, hide and show). `registrar()` in `core/services/avisos.py` logs every change to periods, groups and teachers in the audit log (pulled forward from F10). `seed_demo` adds the 2025-B, 2025-A and 2024-B cycles (inactive, no groups) and the activation of 2026-A by Control Escolar.
- **Frontend:** screens `sabe_periodo_y_convocatoria_control_escolar` (active period, window progress, cycle catalog, new and edit period, activate) and `sabe_oferta_academica_control_escolar` (filters, publish, edit, deactivate and activate, new teacher from the form).
- **API contract:**
  - `GET /api/periodos/` → `[Periodo]` with `estado_convocatoria` (`programada|abierta|cerrada`) and `movimientos_pendientes`. Control Escolar and admin.
  - `POST /api/periodos/` and `PATCH /api/periodos/{id}/` `{ciclo, fecha_inicio, fecha_fin, convocatoria_inicio, convocatoria_fin, activar?}` → `Periodo`.
  - `POST /api/periodos/{id}/activar/` → `Periodo`. `400 {detail}` if the active period has pending moves.
  - `GET /api/periodos/ultima-modificacion/` → `{usuario, fecha}` or `null`.
  - `GET /api/grupos/?oferta=1&q=&programa=&cupo=con|sin` (Control Escolar) → `[Grupo]`, hidden ones included.
  - `POST /api/grupos/` and `PATCH /api/grupos/{id}/` `{clave, nombre_materia, programa, num_grupo, cupo_maximo, docente, horarios: [{dia_semana, hora_inicio, hora_fin}]}` → `Grupo`. `PATCH` with only `{visible}` shows or hides it. Control Escolar only.
  - `GET /api/docentes/`, `POST /api/docentes/` `{nombre, grado_academico?}` (Control Escolar). `GET /api/programas/` (any user).
  - `Grupo` adds `visible` and `materia.programa`. No `DELETE` for periods or groups, and no separate endpoints for courses or schedules: the schedule goes inside the group.
- **Business rules:**
  - Only one active period. Another one can't be activated while the active one has pending moves: "Dictamina los N movimientos pendientes de 2026-A antes de activar otro periodo." If activation was asked for on create and fails, nothing is saved.
  - Cycle in `AAAA-A` or `AAAA-B` format, no duplicates. The semester end and the window close come after their start.
  - The offering is always the active period's. The course is identified by its key: if it exists it is reused and its name and program are updated (in all its groups); if not, it is created with 8 credits.
  - Key and group number can't repeat in the period. Max seats is above 0 and can't go below the number enrolled. A group with students or requests can't change its key.
  - Schedule with at least one day; end time after start time; two rows on the same day can't overlap. The shift comes from the earliest start time (13:00 or later is afternoon). When editing, the room is kept per day.
  - A group is never deleted, it is hidden. A pending ALTA on a hidden group is blocked at approval (`no_disponible`).
  - Changing the schedule of a group with enrolled students is allowed: approval re-checks clashes.
- **Differences from stitch (agreed):** "+ Nuevo docente" in the teacher dropdown (team decision); new texts for the scheduled and closed window ("Convocatoria programada", "Abre en…", "Cerró el…", "Programada", "Próximo"); the program list comes from the data (no "Posgrados UAE"); "Activar" uses an in-page dialog with the text of stitch's `confirm()`; the edit form is titled "Editar periodo escolar"; new texts "Dos horarios del mismo día se traslapan." and "Dictamina los N movimientos pendientes…"; the footer name comes from the user, without "Lic."; the stitch screenshot has an older menu (Dictamen en Lote, Cruces…) and the frame keeps the `code.html` one, as in F6.
- **Done when:** tests for creating and activating periods (with and without pending moves), publishing and editing groups (duplicate, low seats, invalid schedules), hiding, and the audit row of each change; Control Escolar creates a group with a schedule and the student sees it in the catalog; the screens match their `stitch/` design.
- **Target date:** Nov 21.
- **Status:** Pending.

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
- **Differences from stitch (to confirm):** seat and clash warnings under the row's action; "Ver cuentas de estudiantes generadas" downloads the temporary passwords; "Descargar reporte de errores (.csv)" without PDF; error texts adapted to the data ("Materia inexistente: X." instead of "…en el plan curricular 2020", groups "01" and codes "EC504" instead of "G-01" and "ECO-204") and new texts for the other rules; the sample shows up to 10 rows; enrollments use the same wizard with their own columns ("Cargas procesadas", "cargas nuevas"); its own text when there were no new records; the selected card looks like stitch's screenshot (light icon box, no check mark); the screenshot has an older menu and a single type card, and `code.html` is followed.
- **Done when:** tests with a valid CSV, one with errors and one re-imported (students and enrollments); the preview shows errors per row; a new student logs in with the temporary password and changes it; the screens match their `stitch/` design.
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
- **Backend:** helpers `notificar(usuario, mensaje)` (exists since F6 in `core/services/avisos.py` and notifies on approve and reject) and `registrar(usuario, accion, objeto, request=)` (exists since F7 and logs changes to periods, the offering and teachers, and since F8 the CSV imports), called from the services. Audit log is read-only (no editing or deleting through the API).
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
