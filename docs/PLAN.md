# SABE: plan de trabajo hasta la entrega

Fecha límite: **lunes 30 de noviembre de 2026**. Creado el 6 de noviembre de 2026.

Este archivo dice **qué** se construye, **en qué orden** y **cuándo está terminado**. Los responsables se asignan fuera de este documento. Las reglas de negocio completas están en `docs/diseno/SABE_Contexto_Completo.md` y el diseño de cada pantalla en `stitch/`.

> **Regla de diseño para todas las etapas:** en cada hito y cada función, las pantallas deben verse igual que su diseño en `stitch/` (estructura, imágenes, iconos, textos y colores). Ninguna función con frontend se marca como `Hecho` si sus pantallas no coinciden con `stitch/`. Si el diseño choca con una regla de negocio, el backend o un dato que no existe, se avisa al equipo antes de desviarse.

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
| D1 | Columnas exactas del Excel para SADCE | **Decidida:** Ciclo, Folio, Matrícula, Nombre, Programa, Clave materia, Materia, Grupo, Docente, Tipo (ALTA/BAJA) y Fecha de aprobación; una fila por movimiento y un solo renglón de encabezados | 13 nov |
| D2 | ¿Una alta que choca con una baja del mismo folio cuenta como choque? | **Decidida:** no cuenta, la baja del mismo folio libera el horario (cambio de grupo) | 11 nov |
| D3 | Texto "~24 hrs hábiles" de resolución | Quitarlo | 11 nov |
| D4 | Recuperar contraseña: ¿correo real o reinicio por control escolar? | **Decidida:** sin correo. El administrador (Usuarios y Roles) o control escolar (desde el folio del alumno) restablecen a una contraseña temporal que se muestra una sola vez en pantalla (F11) | 18 nov |
| D5 | Comprobante del folio: ¿PDF en el servidor o vista imprimible? | **Decidida:** vista imprimible en el frontend (`window.print`), botón "Imprimir acuse", sin dependencias nuevas | 14 nov |
| D6 | Dónde se hospeda | **Decidida:** la VM de Oracle Cloud del equipo con Docker Compose (Postgres, Gunicorn y Caddy), en `https://sabe.163-192-148-141.sslip.io` (dominio gratuito de sslip.io con certificado de Let's Encrypt) | 20 nov |

## 4. Convenciones

- Rama por función: `feature/f4-choques`, `fix/login`. PR con revisión antes de fusionar a `main`.
- Endpoints bajo `/api/`, en español y en plural (`/api/solicitudes/`). Errores con el formato estándar de DRF: `{"detail": "..."}` o `{"campo": ["mensaje"]}`.
- Toda regla de negocio vive en el backend, en `core/services/`. El frontend solo muestra lo que responde la API.
- Cada servicio de backend lleva pruebas (`python manage.py test`). Si cambias un modelo, la migración va en el mismo commit.
- Swagger (`/api/docs/`) es el contrato vivo. Este archivo resume, Swagger manda en el detalle.
- Cada pantalla debe parecerse lo más posible a su diseño en `stitch/` (estructura, imágenes, iconos, textos y colores). Si el diseño choca con una regla de negocio, el backend o un dato que no existe, no se decide en silencio: se avisa al equipo y se acuerda cómo reconciliarlo.

---

## 5. Funciones

Plantilla de cada función: **Objetivo**, **Depende de**, **Backend**, **Frontend** (con la pantalla de `stitch/`), **Contrato de API**, **Reglas de negocio**, **Terminado cuando**, **Fecha objetivo**, **Estado**. En toda función con frontend, **Terminado cuando** incluye que sus pantallas coinciden con `stitch/`.

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
- **Terminado cuando:** pruebas de permisos por rol en backend; los 3 usuarios demo entran a su panel; el usuario con `temporal` es forzado a cambiarla; un estudiante no puede abrir rutas de control escolar; las pantallas coinciden con su diseño en `stitch/`.
- **Fecha objetivo:** 11 nov.
- **Estado:** Hecho.

### F3. Catálogo y horario del estudiante

- **Objetivo:** el alumno ve la oferta del periodo activo (materia, grupo, docente, horario, cupo) y su horario actual.
- **Depende de:** F2.
- **Backend:** serializers de lectura para grupos con horarios y cupo disponible; horario del alumno a partir de su carga académica más los movimientos en trámite. Optimizar consultas (`select_related`, `prefetch_related`, cupo con `annotate`, no con la propiedad por fila). Crea `core/services/choques.py` con la comparación base "grupo contra mi carga inscrita", que F4 amplía.
- **Frontend:** dashboard del estudiante, horario semanal (retícula y lista) y catálogo con búsqueda por materia, clave o docente (como en `stitch/`). Carrito de solicitud solo en el navegador (agregar altas desde el catálogo y bajas desde el horario); el envío es F5. Pantalla: `sabe_estudiantes`.
- **Contrato de API:**
  - `GET /api/periodos/activo/` → `{ciclo, convocatoria_inicio, convocatoria_fin, convocatoria_abierta}` (`404` si no hay periodo activo)
  - `GET /api/grupos/?q=&materia=&turno=&programa=` → `[{id, materia: {clave, nombre, creditos}, num_grupo, docente, turno, cupo_maximo, cupo_disponible, horarios: [{dia_semana, hora_inicio, hora_fin, aula}], choques: [{grupo, materia, num_grupo, dias, hora_inicio, hora_fin}]}]`. `choques` vacío = no choca.
  - `GET /api/estudiante/horario/` → `{ciclo, inscritas: [...grupos], en_tramite: [{id, grupo, tipo_tramite, folio}]}`
- **Reglas de negocio:** solo grupos `visible = True` del periodo activo. Al alumno se le muestra por defecto la oferta de su programa. `choques` compara contra la carga inscrita del periodo activo; las reglas del folio las agrega F4.
- **Diferencias aceptadas con stitch:** chip "{semestre}° Semestre" en lugar de "Alumno Regular"; campana sin contador y vacía hasta F10; clase "en trámite" con borde punteado y etiqueta; Seminario de Tesis ocupa sus dos filas de la retícula; carrito cerrado de inicio en celular; catálogo ordenado por clave; insignia de convocatoria abierta o cerrada sin fechas.
- **Terminado cuando:** el alumno demo ve su horario y el catálogo filtrable; el grupo lleno aparece sin cupo; las pantallas coinciden con su diseño en `stitch/`.
- **Fecha objetivo:** 14 nov.
- **Estado:** Hecho.

### F4. Detección de choques de horario

- **Objetivo:** un único servicio en el backend decide si un conjunto de movimientos genera choques.
- **Depende de:** F1 (datos para probar).
- **Backend:** amplía `core/services/choques.py` (creado en F3) con la ocupación del alumno (carga inscrita más movimientos pendientes) y crea `core/services/validacion.py` con `validar_movimientos(estudiante, periodo, movimientos)`, que devuelve choques y errores por movimiento. Usa `HorarioGrupo.traslapa_con`. Se usa en el catálogo, F5 (al crear) y F6 (al aprobar). F5 agrega sus reglas en `validacion.py`.
- **Frontend:** el catálogo envía el carrito y marca lo que choca con él; el carrito marca en rojo el movimiento inválido con su motivo y no deja pasar a confirmación.
- **Contrato de API:**
  - `POST /api/solicitudes/validar/` `{movimientos: [{grupo, tipo}]}` → `{valido, movimientos: [{grupo, tipo, choques: [...], errores: [{codigo, detalle}]}]}`. `400` si la lista está vacía, el grupo no existe o el tipo no es `ALTA`/`BAJA`.
  - Cada choque: `{grupo, materia, num_grupo, dias, hora_inicio, hora_fin, origen}`, con `origen` = `inscrita`, `carrito` o `en_tramite`.
  - `GET /api/grupos/?altas=12,14&bajas=5` → el catálogo calcula `choques` y `errores` con el carrito.
  - Códigos de error: `repetido` (mismo grupo dos veces), `ya_inscrito`, `no_disponible` (fuera del periodo activo u oculto), `sin_cupo`, `misma_materia` (ya cursa o pidió esa materia en otro grupo) y `no_inscrito` (baja de un grupo que no tiene).
- **Reglas de negocio:**
  - Se compara contra la carga inscrita, quitando las bajas del mismo folio (D2), y contra las otras altas del mismo folio (se marcan ambas).
  - Los movimientos pendientes de otros folios cuentan: sus altas ocupan horario y sus bajas lo liberan. Al aprobar (F6) solo cuenta la carga inscrita.
  - No se pide otro grupo de una materia que ya se cursa o se pidió, salvo que el mismo folio la dé de baja.
  - Si el alumno quita una baja de la que dependía una alta, la alta se queda en el carrito marcada en rojo y no se puede continuar.
  - Tocar extremos (10:00 a 10:00) no es choque. Una materia con choque no se puede solicitar (no existe "forzar").
- **Diferencias aceptadas con stitch:** la frase del choque agrega "(en tu carrito)" o "(en trámite)"; otro grupo de una materia que ya se tiene usa la tarjeta de choque con "Ya tienes esta materia en otro grupo"; en el carrito, el movimiento inválido va en rojo con su motivo y "Corrige los movimientos marcados para continuar.".
- **Terminado cuando:** pruebas unitarias que cubran: sin choque, choque con carga, choque entre dos altas, alta que reemplaza una baja del mismo folio, extremos que se tocan, días distintos; las pantallas coinciden con su diseño en `stitch/`.
- **Fecha objetivo:** 13 nov.
- **Estado:** Hecho.

### F5. Solicitudes del estudiante

- **Objetivo:** el alumno envía un folio con altas y bajas, recibe acuse, ve su historial y detalle, y puede cancelar lo pendiente.
- **Depende de:** F3, F4.
- **Backend:** servicio de creación de folio en `transaction.atomic`, con generación de `folio_digital` sin repetidos; listado, detalle y cancelación.
- **Frontend:** el carrito ya existe desde F3; aquí se conecta al envío. Confirmación (justificación y declaración), acuse con folio, historial, detalle del folio con motivo de rechazo, cancelar, convocatoria cerrada con solicitud extemporánea y comprobante imprimible (D5). Pantallas: `sabe_estudiantes`, `sabe_detalle_de_folio_sabe_2026_014_estudiante`, `sabe_cancelar_solicitud_pendiente_estudiante`, `sabe_convocatoria_cerrada_solicitud_extempor_nea_estudiante`.
- **Contrato de API:**
  - `POST /api/solicitudes/` `{justificacion, movimientos: [{grupo, tipo}]}` → `201 Solicitud`. `400` con `{"justificacion": [...]}`, `{"detail": "La convocatoria aún no abre."}` o `{"detail", "validacion"}` (misma forma que `/validar/`).
  - `GET /api/solicitudes/` → `[Solicitud]`, la más reciente primero: el alumno ve las suyas, control escolar y administrador todas (filtros en F6).
  - `GET /api/solicitudes/{id}/` → `Solicitud`.
  - `POST /api/solicitudes/{id}/cancelar/` → cancela los movimientos pendientes y devuelve `Solicitud`; `400` si no queda ninguno pendiente.
  - `Solicitud` = `{id, folio_digital, ciclo, fecha_solicitud, estado, extemporanea, justificacion, estudiante: {matricula, nombre, programa}, movimientos: [{id, grupo, tipo_tramite, estado, motivo_rechazo, revisado_por, fecha_resolucion}], resumen: {total, aprobadas, resueltas}}`.
- **Reglas de negocio:**
  - Formato de folio `SABE-2026-###`, consecutivo por año.
  - Justificación: obligatoria; si es extemporánea, al menos 100 caracteres; siempre 500 como máximo.
  - ALTA: el grupo tiene cupo, el alumno no lo tiene inscrito y no choca (F4). BAJA: el alumno lo tiene inscrito.
  - No se repite un grupo con un movimiento pendiente en otro folio del mismo alumno.
  - Valida con `validar_movimientos` de F4 (cuenta los pendientes de otros folios) y agrega aquí sus reglas.
  - Antes de `convocatoria_inicio` no se puede enviar. Después de `convocatoria_fin` el folio se guarda como extemporáneo (`Solicitud.extemporanea`) y solo se aprueba con `visto_bueno`.
  - Un alumno puede tener varios folios pendientes a la vez; el dashboard sigue el más reciente.
  - Código de error nuevo en la validación: `en_otro_folio` (el grupo ya tiene un movimiento pendiente en otro folio del alumno).
  - Solo se cancelan movimientos en estado `pendiente`; se cancela el folio completo, en cualquier momento.
- **Diferencias con stitch (acordadas):** las pantallas de detalle, cancelar y convocatoria cerrada usan el marco del portal de F3; el historial es el de `sabe_estudiantes` (acuse más tabla); sin código de verificación, sin "Turno asignado", "Ventanilla UAE", "Plan 2020", "Al corriente" ni la línea del correo; "Descargar acuse (PDF)" pasa a "Imprimir acuse"; se quitan las frases de "cupos liberados" al cancelar (un trámite pendiente no aparta lugar); "La convocatoria aún no abre" usa la tarjeta del aviso de cierre. Sin diseño en stitch y aceptados: los textos de "Resolución" del historial ("1 de 2 aprobados"), el paso "No aplica" del seguimiento en folios cancelados o rechazados, el chip fijo "Filtro rápido" y "Docente: X" en cada movimiento de la solicitud extemporánea.
- **Terminado cuando:** pruebas del servicio de creación (cada regla de arriba); flujo completo en el navegador con el alumno demo; el folio aparece en historial y horario como "en trámite"; las pantallas coinciden con su diseño en `stitch/`.
- **Fecha objetivo:** 17 nov.
- **Estado:** Hecho.

### F6. Bandeja y dictamen de control escolar

- **Objetivo:** control escolar revisa los folios del periodo y aprueba o rechaza cada movimiento.
- **Depende de:** F5.
- **Backend:** `core/services/bandeja.py` (filtros e indicadores en SQL) y `core/services/dictamen.py` (aprobar y rechazar en `transaction.atomic`, con `select_for_update` sobre alumno, grupo y movimiento, en ese orden). Al aprobar una ALTA se crea o reactiva la `CargaAcademica` (origen `solicitud`); al aprobar una BAJA se marca `baja`. `core/services/avisos.py` con `notificar()`: el alumno recibe un aviso al aprobarse o rechazarse cada movimiento.
- **Frontend:** marco de control escolar (menú lateral y encabezado compartidos por sus 6 pantallas), bandeja con indicadores y filtros (texto, estado, tipo) y revisión del folio por movimiento: choques y cupo visibles, rechazo con motivo y visto bueno en extemporáneos. Pantalla: `sabe_solicitudes_control_escolar`. `seed_demo` deja 3 folios de otros alumnos para la demostración (`--sin-folios` los omite).
- **Contrato de API:**
  - `GET /api/solicitudes/?estado=pendiente|parcial|dictaminada|rechazada|cancelada&extemporanea=true|false&q=` → `[Solicitud]`. Control escolar y administrador ven el periodo activo; sin `estado` se ocultan los folios cancelados por completo. El alumno sigue viendo todos los suyos (F5).
  - `GET /api/solicitudes/resumen/` → `{folios_pendientes, movimientos_aprobados, movimientos_rechazados, extemporaneos}`.
  - `GET /api/solicitudes/{id}/revision/` → `{movimientos: [{id, choques, errores}]}`: qué impide hoy aprobar cada movimiento pendiente.
  - `POST /api/movimientos/{id}/aprobar/` `{visto_bueno?}` → `Solicitud` completa. `400` con `detail` (y `choques`/`errores` si está bloqueado).
  - `POST /api/movimientos/{id}/rechazar/` `{motivo}` → `Solicitud` completa. `400` con `{"motivo": [...]}` o `{"detail"}`.
  - `Solicitud` agrega `estado_bandeja` y `estudiante.semestre`.
- **Reglas de negocio:**
  - Solo control escolar dictamina; el administrador solo consulta. Solo se dictaminan movimientos `pendiente` y no se deshace un dictamen.
  - Al aprobar se vuelve a validar cupo y choques (pudieron cambiar desde el envío), solo contra la carga inscrita (`contar_pendientes=False`).
  - Cambio de grupo: la baja del mismo folio se aprueba primero. Mientras siga pendiente, el alta que choca con ella (o es de la misma materia) queda bloqueada con el código `baja_pendiente`: "Aprueba primero la baja de {materia} en este folio."
  - Extemporáneo sin `visto_bueno` no se aprueba. El visto bueno se guarda en cada movimiento aprobado.
  - Rechazo sin motivo devuelve `400`; el motivo tiene 500 caracteres como máximo. Se guardan `revisado_por` y `fecha_resolucion`.
  - Estado del folio sin pendientes: aprobada si algún movimiento se aprobó; si no, cargada en SADCE, rechazada o cancelada, en ese orden.
- **Diferencias con stitch (acordadas):** el menú de F7 a F10 abre una página "Próximamente" dentro del marco; en teléfono el menú lateral es un panel que se abre con un botón (stitch no tiene versión para teléfono); la campana y la salida que agrega `prototipo.js` van dentro del encabezado; el texto de "Aprueba primero la baja…" es nuevo; el nombre del encabezado sale del usuario, sin "Lic."; los folios cancelados por completo no aparecen en la bandeja; un movimiento cancelado dice "Cancelado por el alumno".
- **Terminado cuando:** pruebas de aprobar con último cupo (dos aprobaciones simultáneas no sobrepasan el cupo), rechazo sin motivo, extemporáneo sin visto bueno y cambio de grupo; flujo completo en el navegador; las pantallas coinciden con su diseño en `stitch/`.
- **Fecha objetivo:** 20 nov.
- **Estado:** Hecho.

### F7. Periodo, convocatoria y oferta académica

- **Objetivo:** control escolar configura el periodo, las fechas de convocatoria y la oferta (materias, docentes, grupos y horarios por día).
- **Depende de:** F2.
- **Backend:** `core/services/periodos.py` (guardar y activar en `transaction.atomic`, con `select_for_update` sobre los periodos) y `core/services/oferta.py` (publicar y editar un grupo con su horario completo, ocultar y mostrar). `registrar()` en `core/services/avisos.py` deja en la bitácora cada cambio de periodos, grupos y docentes (adelanto de F10). `seed_demo` agrega los ciclos 2025-B, 2025-A y 2024-B (inactivos, sin grupos) y la activación de 2026-A por control escolar.
- **Frontend:** pantallas `sabe_periodo_y_convocatoria_control_escolar` (periodo activo, avance de la ventana, catálogo de ciclos, nuevo y editar periodo, activar) y `sabe_oferta_academica_control_escolar` (filtros, publicar, editar, desactivar y activar, docente nuevo desde el formulario).
- **Contrato de API:**
  - `GET /api/periodos/` → `[Periodo]` con `estado_convocatoria` (`programada|abierta|cerrada`) y `movimientos_pendientes`. Control escolar y administrador.
  - `POST /api/periodos/` y `PATCH /api/periodos/{id}/` `{ciclo, fecha_inicio, fecha_fin, convocatoria_inicio, convocatoria_fin, activar?}` → `Periodo`.
  - `POST /api/periodos/{id}/activar/` → `Periodo`. `400 {detail}` si el periodo activo tiene movimientos pendientes, aprobados sin exportar o lotes sin marcar como cargados (F9).
  - `GET /api/periodos/ultima-modificacion/` → `{usuario, fecha}` o `null`.
  - `GET /api/grupos/?oferta=1&q=&programa=&cupo=con|sin` (control escolar) → `[Grupo]`, también los ocultos.
  - `POST /api/grupos/` y `PATCH /api/grupos/{id}/` `{clave, nombre_materia, programa, num_grupo, cupo_maximo, docente, horarios: [{dia_semana, hora_inicio, hora_fin}]}` → `Grupo`. `PATCH` con solo `{visible}` lo muestra u oculta. Solo control escolar.
  - `GET /api/docentes/`, `POST /api/docentes/` `{nombre, grado_academico?}` (control escolar). `GET /api/programas/` (cualquier usuario).
  - `Grupo` agrega `visible` y `materia.programa`. Sin `DELETE` de periodos ni grupos, y sin endpoints aparte de materias u horarios: el horario va dentro del grupo.
- **Reglas de negocio:**
  - Un solo periodo activo. No se activa otro mientras el activo tenga movimientos pendientes: "Dictamina los N movimientos pendientes de 2026-A antes de activar otro periodo." Desde F9 tampoco con movimientos aprobados sin exportar ("Exporta a SADCE los N movimientos aprobados de 2026-A…") ni con lotes en espera ("Marca como cargado en SADCE los N lotes en espera de 2026-A…"). Si se pide activar al crear y no se puede, tampoco se guarda.
  - Ciclo con formato `AAAA-A` o `AAAA-B`, sin repetir. El fin del semestre y el cierre de la convocatoria van después de su inicio.
  - La oferta es siempre la del periodo activo. La materia se identifica por la clave: si existe, se reutiliza y se actualizan su nombre y programa (en todos sus grupos); si no, se crea con 8 créditos.
  - No se repite clave y grupo en el periodo. El cupo máximo es mayor a 0 y no baja de los inscritos. No se cambia la clave de un grupo con alumnos o trámites.
  - Horario con al menos un día; la hora de fin va después de la de inicio; dos horarios del mismo día no se traslapan. El turno sale de la hora de inicio más temprana (13:00 o después es vespertino). Al editar, el aula se conserva por día.
  - Un grupo no se borra, se oculta. Un alta pendiente de un grupo oculto queda bloqueada al dictaminar (`no_disponible`).
  - Cambiar el horario de un grupo con inscritos está permitido: el dictamen vuelve a revisar choques.
- **Diferencias con stitch (acordadas):** "+ Nuevo docente" en la lista de docentes (decisión del equipo); textos nuevos para la convocatoria programada y cerrada ("Convocatoria programada", "Abre en…", "Cerró el…", "Programada", "Próximo"); la lista de programas sale de los datos (sin "Posgrados UAE"); "Activar" usa una ventana dentro de la página con el texto del `confirm()` de stitch; el formulario de edición se titula "Editar periodo escolar"; textos nuevos "Dos horarios del mismo día se traslapan." y "Dictamina los N movimientos pendientes…"; el nombre del pie sale del usuario, sin "Lic."; la captura de stitch tiene un menú anterior (Dictamen en Lote, Cruces…) y el marco conserva el del `code.html`, como en F6.
- **Terminado cuando:** pruebas de crear y activar periodos (con y sin pendientes), publicar y editar grupos (repetido, cupo bajo, horarios inválidos), ocultar y la bitácora de cada cambio; control escolar crea un grupo con horario y el alumno lo ve en el catálogo; las pantallas coinciden con su diseño en `stitch/`.
- **Fecha objetivo:** 21 nov.
- **Estado:** Hecho.

### F8. Importación de CSV

- **Objetivo:** control escolar sube alumnos y cargas académicas por CSV, ve los errores antes de confirmar y puede reimportar sin duplicar.
- **Depende de:** F2, F7 (los grupos deben existir).
- **Backend:** `core/services/importacion.py` en dos pasos: vista previa (lee y valida, no escribe) y confirmación (vuelve a analizar el archivo e importa las filas válidas en `transaction.atomic`, omite las de error). Historial en el modelo `ImportacionCSV` (folio `IMP-2026A-001`) y fila `importar_csv` en la bitácora. `Programa` agrega `clave` (L-ECO, L-FIN). Las contraseñas temporales usan un hasher PBKDF2 ligero (`core/hashers.py`) para que 120 alumnos tarden menos de un segundo.
- **Frontend:** pantalla `sabe_importaci_n_de_csv_control_escolar` con sus 3 pasos (archivo, vista previa, resultado), plantillas, historial de cargas, reporte de errores y descarga de las cuentas generadas.
- **Contrato de API:** (solo control escolar)
  - `GET /api/importaciones/plantilla/{alumnos|cargas}/` → CSV con los encabezados.
  - `POST /api/importaciones/{alumnos|cargas}/?modo=vista_previa` (multipart `archivo`) → `{tipo, archivo, total, validas, avisos, errores: [{linea, matricula, datos, mensaje}], muestra: [{linea, datos, accion, avisos}]}`. No escribe nada.
  - `POST /api/importaciones/{alumnos|cargas}/?modo=confirmar` → `201 {folio, tipo, creados, actualizados, excluidos, credenciales: [{matricula, nombre, email, password}]}`. Las contraseñas temporales solo llegan en esta respuesta.
  - `GET /api/importaciones/` → historial `[{id, folio, tipo, archivo, usuario, fecha, total, creados, actualizados, excluidos}]`.
  - Columnas: alumnos `matricula,nombre,apellidos,email,programa,semestre,turno`; cargas `matricula,clave_materia,num_grupo,ciclo`.
- **Reglas de negocio:**
  - Archivo CSV en UTF-8 (acepta BOM y `;`), máximo 25 MB, con exactamente las columnas de su tipo. Siempre se importa al periodo activo.
  - Alumnos: matrícula de 9 dígitos sin repetirse en el archivo; correo `@uan.edu.mx` o `@alumnos.uan.edu.mx` que no sea de otra cuenta; programa por clave o nombre; semestre 1 a 10; turno matutino, vespertino o vacío. Si la matrícula existe se actualizan sus datos y nunca su contraseña. Un alumno nuevo nace con contraseña temporal aleatoria y `debe_cambiar_password = True`.
  - Cargas: el alumno, la materia y el grupo deben existir en el periodo activo, y el ciclo debe ser el activo. Solo se agregan cargas: una inscrita queda "Sin cambios" y una dada de baja se respeta. Un alumno no tiene dos grupos de la misma materia.
  - Una carga que excede el cupo o choca con el horario del alumno se importa igual (es la carga oficial de SADCE) y la vista previa la marca con un aviso.
  - Las filas con error se omiten; si no hay filas válidas no se importa nada.
- **Diferencias con stitch (acordadas):** avisos de cupo excedido y choque bajo la acción de la fila; "Ver cuentas de estudiantes generadas" descarga las contraseñas temporales; "Descargar reporte de errores (.csv)" sin PDF; textos de error adaptados a los datos ("Materia inexistente: X." en lugar de "…en el plan curricular 2020", grupos "01" y claves "EC504" en lugar de "G-01" y "ECO-204") y textos nuevos para las demás reglas; la muestra enseña hasta 10 filas; cargas usa el mismo asistente con sus propias columnas ("Cargas procesadas", "cargas nuevas"); texto propio cuando no hubo registros nuevos; la tarjeta elegida se ve como en la captura de stitch (recuadro claro y sin palomita); la captura tiene un menú anterior y una sola tarjeta de tipo, y se sigue el `code.html`.
- **Terminado cuando:** pruebas con un CSV válido, uno con errores y uno reimportado (alumnos y cargas); la vista previa muestra los errores por fila; un alumno nuevo entra con su contraseña temporal y la cambia; las pantallas coinciden con su diseño en `stitch/`.
- **Fecha objetivo:** 22 nov.
- **Estado:** Hecho.

### F9. Exportación a SADCE y lotes

- **Objetivo:** control escolar descarga los movimientos aprobados en Excel o CSV y luego marca el lote como cargado en SADCE.
- **Depende de:** F6, D1.
- **Backend:** `core/services/exportacion.py`. Generar mete en un lote nuevo todos los movimientos `aprobada` del periodo activo que no tienen lote (`transaction.atomic` con `select_for_update` sobre el periodo y los movimientos). `LoteExportacion` agrega `periodo`, `numero` (folio `LOTE-2026A-001` por periodo), `cargado_por` y `fecha_carga`. El archivo no se guarda: se arma con `openpyxl` o `csv` en cada descarga, a partir de los movimientos del lote, que ya no cambian. Marcar como cargado pasa los movimientos a `cargada_sadce`, avisa a cada alumno por folio con `notificar()` y deja `exportar_sadce` y `marcar_cargado` en la bitácora.
- **Frontend:** pantalla `sabe_lotes_exportados_a_sadce_control_escolar`: pestañas Lotes Exportados, Movimientos Pendientes de Exportar y Plantilla del Excel (en la URL, `?vista=`), cuatro tarjetas de resumen, filtros, volver a descargar, "Generar Excel de intercambio" y "Confirmar Carga Manual en SADCE".
- **Contrato de API:** (solo control escolar, siempre del periodo activo; sin periodo activo `400 {detail}`)
  - `GET /api/exportaciones/?q=&formato=xlsx|csv&estado=exportado|cargado` → `[Lote]` del más nuevo al más viejo. `Lote`: `{id, folio, fecha, usuario, formato, total_registros, cargado, fecha_carga, cargado_por, alumnos, altas, bajas, programas}`.
  - `POST /api/exportaciones/` `{formato}` → `201 Lote`. `400 {detail}` si no hay movimientos por exportar. El archivo se baja después con `descargar`.
  - `GET /api/exportaciones/pendientes/` → movimientos aprobados sin lote `[{id, folio, matricula, alumno, programa, tipo, clave, materia, grupo, docente, horarios, fecha_aprobacion}]`.
  - `GET /api/exportaciones/resumen/` → `{dictaminados, altas, bajas, cargados, porcentaje_cargado, lotes, lotes_en_espera, movimientos_en_espera, pendientes, ultima}`.
  - `GET /api/exportaciones/plantilla/` → `[{encabezado, descripcion, ejemplo}]`, las columnas de D1.
  - `GET /api/exportaciones/{id}/descargar/` → archivo `LOTE-2026A-001.xlsx` o `.csv`.
  - `POST /api/exportaciones/{id}/marcar-cargado/` → `Lote`. `400 {detail}` si ya estaba cargado.
- **Reglas de negocio:**
  - Un movimiento solo entra a un lote. Cada lote lleva todos los aprobados pendientes del periodo; no se eligen a mano.
  - Columnas según D1. En Excel la matrícula y el grupo van como texto y la fecha como fecha; el CSV va en UTF-8 con BOM.
  - Marcar como cargado notifica a los alumnos ("Tu solicitud SABE-2026-014 fue cargada en SADCE.") y no se puede repetir.
  - No se activa otro periodo con movimientos aprobados sin exportar ni con lotes en espera (ver F7).
- **Diferencias con stitch (acordadas):** las pestañas de pendientes y de plantilla, el botón de la guía y la ventana "Generar Excel de intercambio" son nuevos porque stitch no los diseña (la tabla de pendientes sigue el "Concentrado de Cargas para SADCE"); en stitch "Generar Excel" abre la ventana de marcar como cargado y aquí abre la suya; la casilla de verificación empieza sin marcar y el botón se habilita al marcarla, en lugar del `alert()`; "Generar Excel" se deshabilita sin movimientos por exportar; "Total Movimientos Dictaminados" cuenta los aprobados y los cargados (los rechazados no se exportan); el nombre de quien exportó sale del usuario, sin "Lic.", con "Ventanilla UAE" debajo para todos.
- **Terminado cuando:** pruebas del servicio (no repite movimientos, cuenta bien `total_registros`); el Excel abre bien en Excel y LibreOffice; las pantallas coinciden con su diseño en `stitch/`.
- **Fecha objetivo:** 23 nov.
- **Estado:** Hecho.

### F10. Notificaciones y bitácora

- **Objetivo:** los usuarios ven avisos de sus trámites y queda registro de quién hizo qué.
- **Depende de:** F5, F6.
- **Backend:** `core/services/avisos.py`. Los avisos tienen `tipo`, `titulo`, `mensaje`, folio opcional y `datos` (JSON con lo que muestra la tarjeta: movimientos, horario, conteos). Una función por evento (`aviso_folio_enviado`, `aviso_cancelacion`, `aviso_dictamen`, `aviso_cargada_sadce`, `aviso_importacion`) arma los textos de stitch; los avisos para control escolar se copian a cada usuario de control escolar activo. Dos avisos dependen de un estado y se crean al consultar (`avisos_al_leer`): "La convocatoria cierra en 24 horas" (una vez por alumno y periodo) y "Lote de actas dictaminadas listo para exportación" (uno por usuario de control escolar, se actualiza con el conteo y se borra al generar el lote). `registrar()` guarda además `detalle`, la frase que se lee en la bitácora. El login (`EntrarView`) registra cada inicio de sesión correcto. Bitácora solo de lectura (tampoco se edita en el admin de Django).
- **Frontend:** campana con contador de no leídas (se vuelve a pedir cada minuto) en los dos portales. Estudiante: desplegable con las 5 más recientes y "Ver todas las notificaciones" → `/estudiante/notificaciones` (`sabe_panel_de_notificaciones_estudiante_y_control_escolar`). Control escolar: `/control-escolar/notificaciones` (`sabe_notificaciones_de_control_escolar_uae_uan`) con filtros, tarjetas por tipo y resumen operativo, y `/control-escolar/bitacora` (`sabe_bitacora_auditoria`) con búsqueda, filtros de acción y rol, "Cargar más registros" y descarga CSV.
- **Contrato de API:**
  - `GET /api/notificaciones/?estado=no_leidas&categoria=&q=&orden=antiguas&limite=20` → `{no_leidas, total, conteos: {todas, no_leidas, tramites, resoluciones, convocatoria, nuevas, cancelaciones, sistema}, resultados: [{id, tipo, titulo, mensaje, leida, fecha, folio, solicitud, datos, categorias}]}`. Solo las del usuario.
  - `POST /api/notificaciones/{id}/leer/` → la notificación; `POST /api/notificaciones/leer-todas/` → `{marcadas}`.
  - `GET /api/notificaciones/resumen-operativo/` (control escolar) → `{cancelaciones_hoy, cancelaciones_ayer}`.
  - `GET /api/bitacora/?q=&categoria=&rol=&desde=&hasta=&pagina=` (control escolar y administrador) → `{total, pagina, paginas, resultados: [{id, fecha, usuario, rol, categoria, accion, detalle, ip}]}`, 50 por página.
  - `GET /api/bitacora/exportar/?…` → CSV `Fecha,Usuario,Rol,Accion,Detalle` (UTF-8 con BOM), `bitacora_sabe_2026A.csv`.
- **Reglas de negocio:**
  - Se notifica al enviar folio (al alumno y a control escolar; "Petición extemporánea recibida" si es extemporáneo), al cancelar (a control escolar), al aprobar, al rechazar (con el motivo), al cargar en SADCE (un aviso por folio) y al terminar una importación de CSV (a control escolar).
  - Se registra en la bitácora: inicio de sesión, enviar y cancelar folio, aprobar, rechazar, importar CSV, exportar, marcar cargado, cambios de periodo y de oferta (y de usuarios en F11). Un inicio de sesión fallido no se registra.
  - Categorías del filtro "Acción": Dictamen, Importación, Exportación, Oferta, Periodo, Usuarios y Acceso.
- **Diferencias con stitch (acordadas):** en control escolar se quitan "Configurar alertas", "Canales de Notificación Activa", la tarjeta "Servidor SABE 100% / Latencia" (queda "Folios Extemporáneos"), la extensión de soporte, el adjunto PDF de los folios extemporáneos, "Cupos reincorporados / N plazas devueltas" (los folios pendientes no apartan lugar) y "Submódulo 2.9"; la tarjeta de importación no tiene "Ver reporte de errores" (los errores no se guardan) y su botón lleva a Importación de Datos; los textos empiezan con el nombre del alumno, sin "El estudiante" / "La estudiante"; la campana del estudiante sigue siendo desplegable (en `prototipo.js` lleva directo a la página) y agrega "Ver todas las notificaciones"; "Ver dictamen…" abre la página del folio en lugar del modal; la página del estudiante usa el marco del portal y no el menú anterior del panel; la bitácora muestra todos los registros, no solo "del ciclo 2026-A", con "Cargar más registros"; sin "24 horas hábiles" ni "Tiempo promedio de resolución" (D3).
- **Terminado cuando:** cada acción de la lista deja su fila en la bitácora; el alumno ve la notificación de su dictamen; las pantallas coinciden con su diseño en `stitch/`.
- **Fecha objetivo:** 24 nov.
- **Estado:** Hecho.

### F11. Usuarios y roles (administrador)

- **Objetivo:** el administrador da de alta personal de control escolar, cambia roles, desactiva cuentas y reinicia contraseñas.
- **Depende de:** F2.
- **Backend:** `core/services/usuarios.py` (`crear_personal`, `cambiar_rol`, `cambiar_estado`, `reiniciar_password`), cada cambio en `transaction.atomic` con `select_for_update` y su fila en la bitácora (categoría "Usuarios"). Las contraseñas temporales usan el generador y el hasher ligero de F8. `EntrarView` actualiza `last_login` ("Último acceso").
- **Frontend:** el administrador usa el mismo marco que control escolar con el menú de stitch (Usuarios y Roles, Periodo y Convocatoria, Bitácora de Auditoría; sin campana). Pantalla `sabe_usuarios_y_roles_administrador` (`/administrador/usuarios`): tarjetas, regla de creación de cuentas, búsqueda, filtros de rol y estado, tabla con restablecer contraseña, cambiar rol y activar/desactivar, "+ Nuevo usuario" y "Exportar Auditoría". Control escolar tiene "Restablecer contraseña" en el expediente del alumno al revisar un folio.
- **Contrato de API:**
  - `GET /api/usuarios/?q=&rol=&estado=activos|inactivos&pagina=` (administrador) → `{total, pagina, paginas, conteos: {todos, estudiantes, estudiantes_activos, control_escolar, administradores}, resultados: [{id, username, nombre, apellidos, email, rol, activo, ultimo_acceso, origen, ip, matricula, programa, es_yo}]}`, 20 por página.
  - `POST /api/usuarios/` `{nombre, apellidos, email, rol: control_escolar|administrador}` → `201 {usuario, password_temporal}`.
  - `PATCH /api/usuarios/{id}/` `{rol}` o `{activo}` → el usuario. Sin `DELETE`.
  - `POST /api/usuarios/{id}/reiniciar-password/` → `{password_temporal}`.
  - `GET /api/usuarios/exportar/?…` → CSV `Nombre,Usuario,Correo,Rol,Estado,Ultimo acceso`.
  - `POST /api/solicitudes/{id}/reiniciar-password/` (control escolar) → `{password_temporal}` del alumno del folio.
- **Reglas de negocio:**
  - No se borran usuarios, se desactivan. Una cuenta desactivada no entra y su sesión abierta deja de servir.
  - Solo se crean cuentas de control escolar y de administrador; los alumnos llegan por CSV (F8) y su rol no cambia. El usuario es lo que va antes de la @ del correo, que debe ser `@uan.edu.mx` y no repetirse.
  - El administrador no cambia su propio rol ni se desactiva, y siempre queda al menos un administrador activo. El rol de administrador también da acceso al admin de Django.
  - Una contraseña nueva es temporal, se muestra una sola vez y activa `debe_cambiar_password` (D4).
- **Diferencias con stitch (acordadas):** el alta pide "Nombre" y "Apellidos" en lugar de un solo "Nombre Completo" (decisión del equipo); no se envía correo: la contraseña provisional se muestra una vez en pantalla con "Copiar" (D4); "Último acceso" muestra el origen por rol y la IP real; el encabezado muestra el nombre del administrador y "Administrador del sistema"; sin "BUILD v2.11-SEC" en el pie; "Restablecer contraseña" en el folio de control escolar es nuevo (decisión del equipo); la columna del nombre se recorta para que las acciones quepan sin desplazar la tabla.
- **Terminado cuando:** el admin crea un usuario de control escolar que puede iniciar sesión; las pantallas coinciden con su diseño en `stitch/`.
- **Fecha objetivo:** 24 nov.
- **Estado:** Hecho.

### F12. Despliegue

- **Objetivo:** la app corre en una URL pública con HTTPS.
- **Depende de:** todo lo anterior; la preparación empieza en H2.
- **Backend:** settings de producción por variables de entorno (`DEBUG=0`, `SECRET_KEY`, `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, cookies seguras, HSTS), Gunicorn, archivos estáticos con WhiteNoise, `python manage.py check --deploy` sin advertencias.
- **Frontend:** `npm run build` servido por **Caddy** (en lugar de Nginx: obtiene y renueva el certificado HTTPS solo), que además reenvía `/api/`, `/admin/` y `/static/` al backend y manda las rutas de React a `index.html`. Encabezados de seguridad (CSP en la aplicación React). El botón de acceso de demostración del administrador solo aparece en desarrollo.
- **Infraestructura:** `backend/Dockerfile` (Python 3.14, Gunicorn, migraciones al arrancar, usuario sin privilegios), `frontend/Dockerfile` (build de Vite + Caddy) y `docker-compose.prod.yml` (proyecto `sabe-prod`: db sin puerto publicado, backend, web en 80/443 y `backup`, que guarda `pg_dump` diario en `./backups` por 7 días). Variables en `.env.prod` (plantilla `.env.prod.example`). Sin SMTP (D4). CI en GitHub Actions (`.github/workflows/ci.yml`): migraciones, contrato de la API, pruebas del backend con Postgres y `npm run build` en cada PR y push.
- **Contrato de API:** no aplica. `POST /api/auth/token/` responde `429` después de 10 intentos por minuto desde la misma IP (`SABE_LOGIN_RATE`). El conteo va en una caché compartida en PostgreSQL (los procesos de Gunicorn la comparten) y la IP sale de `X-Forwarded-For` de Caddy.
- **Reglas de negocio:**
  - El `.env.prod` nunca se sube al repositorio (permisos 600 en el servidor). Con `DJANGO_DEBUG=0` el backend no arranca sin una `DJANGO_SECRET_KEY` propia de 50 caracteres o más.
  - `seed_demo` nunca corre solo: se ejecuta a mano después del primer despliegue y para reiniciar la demostración. En producción el usuario `admin` usa `SABE_ADMIN_PASSWORD`; los demás usuarios demo conservan `demo1234`.
  - HSTS de un día al inicio (`SECURE_HSTS_SECONDS`), sin preload (el dominio no es nuestro).
- **Decisiones (acordadas):** Caddy en lugar de Nginx, HSTS de un día sin preload, contraseña del administrador en `.env.prod` y sin botón de demostración del administrador, límite de 10 intentos de inicio de sesión por minuto, respaldo diario por 7 días y CI en GitHub Actions.
- **Terminado cuando:** desde un celular y una computadora se completa el flujo de H2 y H3 en la URL pública; las pantallas en la URL pública se ven igual que en `stitch/`.
- **Fecha objetivo:** 27 nov.
- **Estado:** Hecho.

### F13. Pruebas finales y documentación

- **Objetivo:** la entrega funciona de punta a punta y está documentada.
- **Depende de:** F12.
- **Tareas:**
  - Recorrido completo en producción con los 3 roles, a 1280 y 390 px: carrito con choque bloqueado, envío, acuse, cancelación; primer acceso; dictamen (aprobar, rechazar con motivo, extemporáneo con visto bueno); oferta; importación; exportación y lote cargado; notificaciones y bitácora; usuarios del administrador. Sin errores de consola, sin respuestas 5xx y sin desborde horizontal.
  - Revisión final de cada pantalla contra `stitch/` (tabla abajo).
  - README completo para alguien nuevo (probado clonando el repositorio y siguiéndolo al pie de la letra), `SABE_Contexto_Completo.md` y este plan al día.
  - Kit de prueba de usabilidad para 2 o 3 compañeros: [`docs/pruebas/prueba_usabilidad.md`](pruebas/prueba_usabilidad.md). Lo corre el equipo.
  - Guion de la presentación: [`docs/presentacion/guion.md`](presentacion/guion.md).
- **Revisión final contra `stitch/`:**

| Pantalla (stitch) | Resultado |
|---|---|
| Inicio de sesión, cambio obligatorio de contraseña | Igual a stitch |
| Recuperar contraseña | Igual en estructura; el `code.html` de stitch se ve roto fuera de su visor (texto sin contraste). "Continuar" en lugar de "Enviar enlace" (F2, sin correo) |
| Portal del estudiante: dashboard, horario, catálogo, confirmación | Igual a stitch |
| Historial y acuse, detalle de folio | Igual al historial del portal y a `sabe_detalle_de_folio` (diferencias acordadas en F5) |
| Centro de Notificaciones del estudiante | Igual (diferencias acordadas en F10) |
| Bandeja y revisión de folio de control escolar | Igual (diferencias acordadas en F6) |
| Oferta Académica, Periodo y Convocatoria | Igual (diferencias acordadas en F7) |
| Importación de Datos (CSV) | Igual (diferencias acordadas en F8) |
| Exportación a SADCE | Igual (diferencias acordadas en F9) |
| Notificaciones de control escolar, Bitácora | Igual (diferencias acordadas en F10) |
| Usuarios y Roles | Igual (diferencias acordadas en F11) |

A 390 px ninguna pantalla se desborda a lo ancho. No se encontraron errores nuevos ni diferencias sin acordar.

- **Terminado cuando:** no quedan errores que bloqueen el flujo principal y el README permite a alguien nuevo levantar el proyecto; cada pantalla se revisó una última vez contra su diseño en `stitch/`.
- **Fecha objetivo:** 28 nov.
- **Estado:** Hecho.
