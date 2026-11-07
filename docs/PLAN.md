# SABE: plan de trabajo hasta la entrega

Fecha límite: **lunes 30 de noviembre de 2026**. Creado el 6 de noviembre de 2026.

Este archivo dice **qué** se construye, **en qué orden** y **cuándo está terminado**. Los responsables se asignan fuera de este documento. Las reglas de negocio completas están en `docs/diseno/SABE_Contexto_Completo.md` y el diseño de cada pantalla en `stitch/`.

Cómo usarlo: cuando una función se fusiona a `main`, se cambia su **Estado** a `Hecho` en el mismo PR. Si cambia un endpoint, se actualiza aquí su **Contrato de API** antes de programarlo.

---

## 1. Hitos

| Hito | Fechas | Funciones | Demo al cerrar el hito |
|---|---|---|---|
| **H1. Base** | 6 al 11 nov | F1, F2 | Los 3 usuarios de demostración inician sesión y llegan al panel de su rol |
| **H2. Flujo del estudiante** | 12 al 17 nov | F3, F4, F5 | Un alumno arma su carrito, el sistema bloquea choques y envía un folio que puede ver y cancelar |
| **H3. Control escolar** | 18 al 24 nov | F6, F7, F8, F9, F10, F11 | Control escolar aprueba y rechaza, importa CSV, exporta a SADCE y marca el lote como cargado |
| **H4. Despliegue y cierre** | 25 al 28 nov | F12, F13 | La app corre en una URL pública con HTTPS y datos de demostración |
| **Colchón** | 29 y 30 nov | | Solo correcciones y ensayo de la presentación. Nada nuevo |

Regla de corte: si un hito se atrasa más de 2 días, se recorta alcance de las funciones marcadas como **Opcional**, no se mueve la fecha final.

## 2. Orden de dependencias

```
F1 Datos de prueba ─┐
                    ├─> F2 Autenticación y roles ─┬─> F3 Catálogo ─> F4 Choques ─> F5 Solicitudes ─> F6 Dictamen ─> F9 Exportación SADCE
                    │                             ├─> F7 Periodo y oferta
                    │                             ├─> F8 Importación CSV
                    │                             └─> F11 Usuarios y roles
F5 y F6 ───────────────────────────────────────────> F10 Notificaciones y bitácora
Todo ──────────────────────────────────────────────> F12 Despliegue ─> F13 Pruebas finales y documentación
```

F12 se puede preparar desde H2 (Dockerfiles y settings de producción) para no dejarlo todo al final.

## 3. Decisiones abiertas

| # | Pregunta | Recomendación | Fecha límite |
|---|---|---|---|
| D1 | Columnas exactas del Excel para SADCE | Matrícula, nombre, programa, clave de materia, materia, grupo, docente, tipo (ALTA/BAJA), folio, fecha de aprobación. Confirmar con control escolar | 13 nov |
| D2 | ¿Una alta que choca con una baja del mismo folio cuenta como choque? | No cuenta (cambio de grupo) | 11 nov |
| D3 | Texto "~24 hrs hábiles" de resolución | Quitarlo | 11 nov |
| D4 | Recuperar contraseña: ¿correo real o reinicio por control escolar? | Correo si hay SMTP listo en H4; si no, control escolar reinicia a contraseña temporal (F11) | 18 nov |
| D5 | Comprobante del folio: ¿PDF en el servidor o vista imprimible? | Vista imprimible en el frontend (`window.print`), sin dependencias nuevas | 14 nov |
| D6 | Dónde se hospeda | Un solo servidor con Docker Compose (Render, Railway o un VPS). Elegir en función de costo cero | 20 nov |

## 4. Convenciones

- Rama por función: `feature/f4-choques`, `fix/login`. PR con revisión antes de fusionar a `main`.
- Endpoints bajo `/api/`, en español y en plural (`/api/solicitudes/`). Errores con el formato estándar de DRF: `{"detail": "..."}` o `{"campo": ["mensaje"]}`.
- Toda regla de negocio vive en el backend, en `core/services/`. El frontend solo muestra lo que responde la API.
- Cada servicio de backend lleva pruebas (`python manage.py test`). Si cambias un modelo, la migración va en el mismo commit.
- Swagger (`/api/docs/`) es el contrato vivo. Este archivo resume, Swagger manda en el detalle.

---

## 5. Funciones

Plantilla de cada función: **Objetivo**, **Depende de**, **Backend**, **Frontend** (con la pantalla de `stitch/`), **Contrato de API**, **Reglas de negocio**, **Terminado cuando**, **Fecha objetivo**, **Estado**.

### F1. Datos de prueba

- **Objetivo:** cualquiera del equipo levanta la app con los mismos datos que el prototipo con un solo comando.
- **Depende de:** nada.
- **Backend:** comando `python manage.py seed_demo` (idempotente, se puede correr varias veces). Crea programas (Economía, Finanzas), docentes, materias, grupos con horarios por día, periodo 2026-A activo con convocatoria abierta, usuarios de demostración y carga académica del alumno de prueba.
- **Frontend:** nada.
- **Contrato de API:** no aplica.
- **Reglas de negocio:** usuarios `210089334` (estudiante, `demo1234`), `valeria.ruiz` (control escolar, `demo1234`), `admin` (administrador, `demo1234`) y un estudiante con contraseña `temporal` y `debe_cambiar_password = True`. Incluir al menos un grupo lleno y un grupo que choque con la carga del alumno, para probar F4.
- **Terminado cuando:** `migrate` + `seed_demo` en una base vacía deja todo listo; correrlo dos veces no duplica nada.
- **Fecha objetivo:** 8 nov.
- **Estado:** Hecho.

### F2. Autenticación y roles

- **Objetivo:** el usuario inicia sesión con matrícula y contraseña y llega al panel de su rol; con contraseña temporal se le obliga a cambiarla.
- **Depende de:** F1.
- **Backend:** clases de permiso `EsEstudiante`, `EsControlEscolar`, `EsAdministrador`; endpoint de perfil; cambio de contraseña. Bitácora del inicio de sesión queda para F10.
- **Frontend:** cliente de API con JWT (guardar tokens, refrescar al expirar, cerrar sesión), React Router con rutas protegidas por rol, layout base con los colores de `DESIGN.md`. Pantallas: `sabe_inicio_de_sesi_n_institucional_uan_uae`, `sabe_cambio_obligatorio_de_contrase_a_uan_uae`, `sabe_recuperar_contrase_a_uan_uae` (solo la vista; el envío depende de D4).
- **Contrato de API:**
  - `POST /api/auth/token/` `{username, password}` → `{access, refresh}` (ya existe)
  - `POST /api/auth/token/refresh/` `{refresh}` → `{access}` (ya existe)
  - `GET /api/me/` → `{id, username, nombre, apellidos, rol, debe_cambiar_password, estudiante: {matricula, programa, semestre, turno} | null}`
  - `POST /api/auth/cambiar-password/` `{actual, nueva}` → `204`
- **Reglas de negocio:** mientras `debe_cambiar_password` sea `True`, el frontend solo permite la pantalla de cambio. La nueva contraseña pasa los validadores de Django.
- **Terminado cuando:** pruebas de permisos por rol en backend; los 3 usuarios demo entran a su panel; el usuario con `temporal` es forzado a cambiarla; un estudiante no puede abrir rutas de control escolar.
- **Fecha objetivo:** 11 nov.
- **Estado:** Hecho.

### F3. Catálogo y horario del estudiante

- **Objetivo:** el alumno ve la oferta del periodo activo (materia, grupo, docente, horario, cupo) y su horario actual.
- **Depende de:** F2.
- **Backend:** serializers de lectura para grupos con horarios y cupo disponible; horario del alumno a partir de su carga académica más los movimientos en trámite. Optimizar consultas (`select_related`, `prefetch_related`, cupo con `annotate`, no con la propiedad por fila).
- **Frontend:** dashboard del estudiante, horario semanal y catálogo con filtros. Pantalla: `sabe_estudiantes`.
- **Contrato de API:**
  - `GET /api/periodos/activo/` → `{ciclo, convocatoria_inicio, convocatoria_fin, convocatoria_abierta}`
  - `GET /api/grupos/?materia=&turno=&programa=` → `[{id, materia: {clave, nombre, creditos}, num_grupo, docente, turno, cupo_maximo, cupo_disponible, horarios: [{dia_semana, hora_inicio, hora_fin, aula}], choca_con_mi_horario}]`
  - `GET /api/estudiante/horario/` → `{inscritas: [...grupos], en_tramite: [{grupo, tipo_tramite, folio}]}`
- **Reglas de negocio:** solo grupos `visible = True` del periodo activo. `choca_con_mi_horario` lo calcula F4.
- **Terminado cuando:** el alumno demo ve su horario y el catálogo filtrable; el grupo lleno aparece sin cupo.
- **Fecha objetivo:** 14 nov.
- **Estado:** Pendiente.

### F4. Detección de choques de horario

- **Objetivo:** un único servicio en el backend decide si un conjunto de movimientos genera choques.
- **Depende de:** F1 (datos para probar).
- **Backend:** `core/services/choques.py` con una función que recibe al estudiante y una lista de movimientos `{grupo, tipo}` y devuelve los choques encontrados. Usa `HorarioGrupo.traslapa_con`. Se usa en F3, F5 (al crear) y F6 (al aprobar).
- **Frontend:** marcar en el catálogo y el carrito las materias que chocan, con el motivo.
- **Contrato de API:**
  - `POST /api/solicitudes/validar/` `{movimientos: [{grupo, tipo}]}` → `{valido, choques: [{grupo, choca_con, dia, horario}], errores: [...]}`
- **Reglas de negocio:** se compara contra la carga inscrita, quitando las bajas del mismo folio (D2), y contra las otras altas del mismo folio. Tocar extremos (10:00 a 10:00) no es choque. Una materia con choque no se puede solicitar (no existe "forzar").
- **Terminado cuando:** pruebas unitarias que cubran: sin choque, choque con carga, choque entre dos altas, alta que reemplaza una baja del mismo folio, extremos que se tocan, días distintos.
- **Fecha objetivo:** 13 nov.
- **Estado:** Pendiente.

### F5. Solicitudes del estudiante

- **Objetivo:** el alumno envía un folio con altas y bajas, recibe acuse, ve su historial y detalle, y puede cancelar lo pendiente.
- **Depende de:** F3, F4.
- **Backend:** servicio de creación de folio en `transaction.atomic`, con generación de `folio_digital` sin repetidos; listado, detalle y cancelación.
- **Frontend:** carrito, confirmación (justificación y declaración), acuse con folio, historial, detalle del folio con motivo de rechazo, cancelar, convocatoria cerrada con solicitud extemporánea y comprobante imprimible (D5). Pantallas: `sabe_estudiantes`, `sabe_detalle_de_folio_sabe_2026_014_estudiante`, `sabe_cancelar_solicitud_pendiente_estudiante`, `sabe_convocatoria_cerrada_solicitud_extempor_nea_estudiante`.
- **Contrato de API:**
  - `POST /api/solicitudes/` `{justificacion, movimientos: [{grupo, tipo}]}` → `201 {id, folio_digital, estado, extemporanea, detalles: [...]}`
  - `GET /api/solicitudes/` → folios del alumno (control escolar ve todos, ver F6)
  - `GET /api/solicitudes/{id}/` → folio con movimientos, estado, motivo de rechazo, revisor y fecha
  - `POST /api/solicitudes/{id}/cancelar/` → cancela los movimientos pendientes
- **Reglas de negocio:**
  - Formato de folio `SABE-2026-###`, consecutivo por año.
  - Justificación obligatoria; más larga si es extemporánea.
  - ALTA: el grupo tiene cupo, el alumno no lo tiene inscrito y no choca (F4). BAJA: el alumno lo tiene inscrito.
  - No se repite un grupo con un movimiento pendiente en otro folio del mismo alumno.
  - Fuera de la convocatoria el folio se marca como extemporáneo (fecha de envío posterior a `convocatoria_fin`) y solo se aprueba con `visto_bueno`.
  - Solo se cancelan movimientos en estado `pendiente`.
- **Terminado cuando:** pruebas del servicio de creación (cada regla de arriba); flujo completo en el navegador con el alumno demo; el folio aparece en historial y horario como "en trámite".
- **Fecha objetivo:** 17 nov.
- **Estado:** Pendiente.

### F6. Bandeja y dictamen de control escolar

- **Objetivo:** control escolar revisa folios y aprueba o rechaza cada movimiento.
- **Depende de:** F5.
- **Backend:** servicio de aprobar y rechazar con `transaction.atomic` + `select_for_update` sobre el grupo. Al aprobar una ALTA se crea o reactiva la `CargaAcademica` (origen `solicitud`); al aprobar una BAJA se marca `baja`.
- **Frontend:** bandeja con filtros (estado, extemporáneo, fecha), vista de validación por movimiento con choques visibles, rechazo con motivo, visto bueno. Pantalla: `sabe_solicitudes_control_escolar`.
- **Contrato de API:**
  - `GET /api/solicitudes/?estado=&extemporanea=&q=` (control escolar ve todas)
  - `POST /api/movimientos/{id}/aprobar/` `{visto_bueno?}` → movimiento actualizado
  - `POST /api/movimientos/{id}/rechazar/` `{motivo}` → movimiento actualizado
- **Reglas de negocio:** al aprobar se vuelve a validar cupo y choques (pudo cambiar desde que se envió). Rechazo sin motivo devuelve `400`. Extemporáneo sin `visto_bueno` no se aprueba. Se guardan `revisado_por` y `fecha_resolucion`.
- **Terminado cuando:** pruebas de aprobar con último cupo (dos aprobaciones simultáneas no sobrepasan el cupo), rechazo sin motivo, extemporáneo sin visto bueno; flujo completo en el navegador.
- **Fecha objetivo:** 20 nov.
- **Estado:** Pendiente.

### F7. Periodo, convocatoria y oferta académica

- **Objetivo:** control escolar configura el periodo, las fechas de convocatoria y la oferta (materias, docentes, grupos y horarios por día).
- **Depende de:** F2.
- **Backend:** CRUD con `ModelViewSet` para periodos, materias, docentes, grupos y horarios. Activar un periodo desactiva el anterior.
- **Frontend:** pantallas `sabe_periodo_y_convocatoria_control_escolar` y `sabe_oferta_academica_control_escolar` (horario por día y hora, cupo, publicar o mostrar u ocultar).
- **Contrato de API:** `/api/periodos/`, `/api/periodos/{id}/activar/`, `/api/materias/`, `/api/docentes/`, `/api/grupos/` (escritura), `/api/grupos/{id}/horarios/`.
- **Reglas de negocio:** un solo periodo activo (ya está en la base). No se puede bajar el `cupo_maximo` por debajo de los inscritos. No se borra un grupo con cargas o solicitudes; se oculta.
- **Terminado cuando:** control escolar crea un grupo con horario y el alumno lo ve en el catálogo.
- **Fecha objetivo:** 21 nov.
- **Estado:** Pendiente.

### F8. Importación de CSV

- **Objetivo:** control escolar sube alumnos y cargas académicas por CSV, ve los errores antes de confirmar y puede reimportar sin duplicar.
- **Depende de:** F2, F7 (los grupos deben existir).
- **Backend:** servicio en dos pasos: vista previa (valida y devuelve filas buenas y con error) y confirmación (en `transaction.atomic`). Plantillas descargables.
- **Frontend:** pantalla `sabe_importaci_n_de_csv_control_escolar`: subir archivo, tabla de vista previa con errores por fila, confirmar.
- **Contrato de API:**
  - `GET /api/importaciones/plantilla/{alumnos|cargas}/` → CSV
  - `POST /api/importaciones/{alumnos|cargas}/?modo=preview|confirmar` (multipart `archivo`) → `{validas, errores: [{fila, campo, mensaje}], creados, actualizados}`
- **Reglas de negocio:** alumnos se identifican por matrícula (actualiza si existe). Alumno nuevo nace con contraseña temporal y `debe_cambiar_password = True`. Cargas se identifican por (matrícula, clave de materia, grupo, periodo). Columnas de alumnos: matrícula, nombre, apellidos, correo, programa, semestre, turno.
- **Terminado cuando:** pruebas con un CSV válido, uno con errores y uno reimportado; la vista previa muestra los errores por fila.
- **Fecha objetivo:** 22 nov.
- **Estado:** Pendiente.

### F9. Exportación a SADCE y lotes

- **Objetivo:** control escolar descarga los movimientos aprobados en Excel o CSV y luego marca el lote como cargado en SADCE.
- **Depende de:** F6, D1.
- **Backend:** servicio que toma los movimientos `aprobada` sin lote, genera el archivo con `openpyxl` o `csv`, crea el `LoteExportacion` y los asigna. Marcar como cargado pasa los movimientos a `cargada_sadce`.
- **Frontend:** pantalla `sabe_lotes_exportados_a_sadce_control_escolar`: pendientes de exportar, lista de lotes, volver a descargar, marcar como cargado.
- **Contrato de API:**
  - `GET /api/exportaciones/pendientes/` → movimientos aprobados sin lote
  - `POST /api/exportaciones/` `{formato: "xlsx"|"csv"}` → archivo descargable y lote creado
  - `GET /api/exportaciones/` → lotes
  - `GET /api/exportaciones/{id}/descargar/` → archivo del lote
  - `POST /api/exportaciones/{id}/marcar-cargado/` → `204`
- **Reglas de negocio:** un movimiento solo entra a un lote. Columnas según D1. Marcar como cargado notifica a los alumnos (F10).
- **Terminado cuando:** pruebas del servicio (no repite movimientos, cuenta bien `total_registros`); el Excel abre bien en Excel y LibreOffice.
- **Fecha objetivo:** 23 nov.
- **Estado:** Pendiente.

### F10. Notificaciones y bitácora

- **Objetivo:** los usuarios ven avisos de sus trámites y queda registro de quién hizo qué.
- **Depende de:** F5, F6.
- **Backend:** helpers `notificar(usuario, mensaje)` y `registrar(usuario, accion, entidad, request)` llamados desde los servicios. Bitácora solo de lectura (sin editar ni borrar desde la API).
- **Frontend:** campana y panel en estudiante y control escolar; bitácora con filtros y descarga CSV. Pantallas: `sabe_panel_de_notificaciones_estudiante_y_control_escolar`, `sabe_notificaciones_de_control_escolar_uae_uan`, `sabe_bitacora_auditoria`.
- **Contrato de API:**
  - `GET /api/notificaciones/` → `{no_leidas, resultados: [...]}`
  - `POST /api/notificaciones/{id}/leer/`, `POST /api/notificaciones/leer-todas/`
  - `GET /api/bitacora/?accion=&usuario=&desde=&hasta=`, `GET /api/bitacora/exportar/` → CSV
- **Reglas de negocio:** se notifica al enviar folio (al alumno y a control escolar), al aprobar, al rechazar y al cargar en SADCE. Se registra: login, crear y cancelar folio, aprobar, rechazar, importar CSV, exportar, marcar cargado y cambios de catálogo y usuarios.
- **Terminado cuando:** cada acción de la lista deja su fila en la bitácora; el alumno ve la notificación de su dictamen.
- **Fecha objetivo:** 24 nov.
- **Estado:** Pendiente.

### F11. Usuarios y roles (administrador)

- **Objetivo:** el administrador da de alta personal de control escolar, cambia roles, desactiva cuentas y reinicia contraseñas.
- **Depende de:** F2.
- **Backend:** CRUD de usuarios solo para administrador; reinicio a contraseña temporal.
- **Frontend:** pantalla `sabe_usuarios_y_roles_administrador`.
- **Contrato de API:** `/api/usuarios/`, `POST /api/usuarios/{id}/reiniciar-password/` → `{password_temporal}`.
- **Reglas de negocio:** no se borran usuarios, se desactivan. El administrador no puede quitarse su propio rol. El reinicio activa `debe_cambiar_password`.
- **Terminado cuando:** el admin crea un usuario de control escolar que puede iniciar sesión.
- **Fecha objetivo:** 24 nov. **Opcional** si H3 se atrasa (se puede usar el admin de Django).
- **Estado:** Pendiente.

### F12. Despliegue

- **Objetivo:** la app corre en una URL pública con HTTPS.
- **Depende de:** todo lo anterior; la preparación empieza en H2.
- **Backend:** settings de producción por variables de entorno (`DEBUG=0`, `SECRET_KEY`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, cookies seguras, HSTS), Gunicorn, archivos estáticos con WhiteNoise, `python manage.py check --deploy` sin advertencias.
- **Frontend:** `npm run build` servido por Nginx, que además reenvía `/api/` al backend.
- **Infraestructura:** `Dockerfile` del backend y del frontend; `docker-compose.prod.yml` con db, backend y frontend; respaldo de la base; correo SMTP si D4 lo pide. CI en GitHub Actions: pruebas del backend y `npm run build` en cada PR.
- **Contrato de API:** no aplica.
- **Reglas de negocio:** el `.env` de producción nunca se sube al repositorio. `seed_demo` solo en el ambiente de demostración.
- **Terminado cuando:** desde un celular y una computadora se completa el flujo de H2 y H3 en la URL pública.
- **Fecha objetivo:** 27 nov.
- **Estado:** Pendiente.

### F13. Pruebas finales y documentación

- **Objetivo:** la entrega funciona de punta a punta y está documentada.
- **Depende de:** F12.
- **Tareas:** recorrido completo con los 3 roles en producción; prueba rápida de usabilidad con 2 o 3 compañeros; corregir errores encontrados; actualizar README (cómo arrancar, cómo desplegar, usuarios demo), `SABE_Contexto_Completo.md` y este plan; preparar guion de la presentación.
- **Terminado cuando:** no quedan errores que bloqueen el flujo principal y el README permite a alguien nuevo levantar el proyecto.
- **Fecha objetivo:** 28 nov.
- **Estado:** Pendiente.
