# SABE: contexto completo del proyecto

Archivo pensado para pasarlo a cualquier IA o compañero de equipo y que tenga todo el panorama. Actualizado el 4 de noviembre de 2026. Complementa y actualiza `Material de clases/SABE_Contexto_Proyecto.md` (del 13 de octubre). Si algo se contradice, manda este archivo.

---

## 1. Qué es SABE

SABE (Sistema de Altas y Bajas de Economía) es una aplicación web independiente para la Unidad Académica de Economía (UAE) de la Universidad Autónoma de Nayarit (UAN). Los estudiantes piden altas y bajas de materias fuera del periodo regular de forma digital. Control escolar revisa, aprueba o rechaza, y el sistema genera un reporte exportable (Excel o CSV) que control escolar sube a SADCE.

- Es un proyecto universitario: 7mo semestre, materia con la Mtra. Perla. Proyecto de Claude llamado "SABE".
- No se presenta ni se valida con la UAN. Todo es interno. Implementarlo de verdad es "si se alcanza".
- Con control escolar solo se permite consultar cosas para mejorar los procesos del propio sistema.

## 2. Equipo y responsables (según los documentos de Diseño y Desarrollo)

| Persona | Rol |
|---|---|
| Milton Cruz Panuco Castillo | Líder. Revisa código, apoya pruebas de usabilidad y entrevistas |
| Rafael Gil Samaniego Vázquez | Diseño UI/UX, prototipos, pruebas de usabilidad |
| Fernando Osuna Manzo | Backend y frontend, base de datos, autenticación, catálogo, exportación |
| Irving García Rosas | Igual que Fernando (backend y frontend) |
| Ángel Adriel Soria Macías | Análisis: aplica entrevistas, valida reglas de negocio y algoritmo de choques |

Idioma de trabajo: español.

## 3. El problema

- La carga académica regular ya es digital (PiiDA/SADCE).
- Las altas y bajas fuera de periodo siguen siendo presenciales y en papel. El alumno hace fila, llena a mano matrícula, nombre, materia, docente y horario. La ventana suele ser de 1 a 2 días.
- Control escolar vuelve a capturar todo en SADCE (doble captura), materia por materia, alumno por alumno.
- Problemas: mala letra, errores de matrícula o de nombre de materia/docente, meterlos a otro grupo, repetir datos, olvidar materias, desconocer la oferta, gasto de papel, retrasos, dificultad para quien trabaja o vive lejos.

## 4. Decisiones clave

1. SABE NO se integra a PiiDA ni a SADCE. Es un sistema aparte. El reporte exportable lo sube control escolar en lote.
2. Login propio de SABE (matrícula + contraseña, permisos por rol), no credenciales institucionales.
3. Solo altas y bajas fuera de periodo. No toca la carga regular.
4. Todo lo que mencione integración con PiiDA, módulo dentro de PiiDA o backend en Java es obsoleto y está descartado.
5. Roles: estudiante, control escolar, administrador.

## 5. Alcance

Incluye:
- App web para solicitudes de alta y baja fuera de periodo.
- Catálogo de materias, grupos y horarios mantenido por control escolar.
- Detección automática de choques de horario.
- Panel de control escolar para revisar, aprobar o rechazar.
- Reporte exportable (CSV/Excel) con solicitudes validadas.
- Notificaciones a estudiantes y administrativos.

No incluye:
- Conexión directa con PiiDA o SADCE ni subida automática.
- Verificar identidad más allá del login.
- Cualquier cosa ajena a altas y bajas fuera de periodo.

## 6. Hallazgos de las entrevistas

**Control escolar** (20 a 30 solicitudes por semestre):
- Capturar una solicitud en SADCE toma de 3 a 4 minutos por materia y SADCE es inestable.
- El estudiante entrega: matrícula, nombre completo, unidad de aprendizaje, horario y docente.
- Errores comunes: nombre incorrecto de la materia o del docente, mala letra, grupo equivocado (el alumno luego descubre que no está en lista).
- Única validación fija: que la materia no choque de horario. Hay excepciones previamente autorizadas por coordinadores; si el alumno quiere cargar más materias se le pregunta por qué y se manda con coordinación o subdirección.
- Pasado cierto periodo ya no se puede agregar ni eliminar, salvo caso justificado.
- Las solicitudes llegan igual en los dos semestres; los alumnos las dejan al último día porque coincide con la reinscripción y por temas económicos.
- Formato de reporte: hoy solo papel. No hay formato de archivo definido todavía.

**Estudiantes** (16 respuestas, 9 ya hicieron el trámite, promedio 5.1 min contando espera):
- 12 usarían el trámite digital y 4 tal vez.
- Prefieren computadora, varios aceptarían celular.
- Quieren ver antes de pedir una alta: cupos, horarios, docente, disponibilidad y choques.
- Les preocupa usar solo la matrícula: piden contraseña, confirmación y comprobante.
- Urgencia: durante la semana de la convocatoria, antes del cierre.

## 7. Stack

- Backend: Django + Django REST Framework.
- Frontend: React + TypeScript.
- Recomendado, no confirmado por todo el equipo: PostgreSQL, JWT con simplejwt, openpyxl/csv para exportar, TanStack Query y Tailwind.

## 8. Estado de la EDT (por fases, como pidió la maestra)

1. Análisis: levantamiento de requerimientos, análisis del proceso actual, flujo digital objetivo, validación.
2. Diseño: 2.1 prototipos en Figma, 2.2 diseño de la base de datos, 2.3 pruebas de usabilidad, 2.4 ajuste del diseño.
3. Desarrollo: 3.1 backend, 3.2 frontend, 3.3 autenticación y roles, 3.4 catálogo de materias y choques de horario, 3.5 reporte exportable para SADCE.
4. Pruebas, implementación/despliegue y documentación: según la guía de la maestra (no revisadas a detalle en este resumen).

Ya existen la ruta crítica, diagrama de red y Gantt (carpetas `Actividades/` y `output/`).

## 9. Prototipo actual (carpeta `stitch/`)

Diseño: "Academic Prestige Modern" (`stitch/academic_prestige_modern/DESIGN.md`). Azul marino #002B49, ámbar, verde esmeralda para altas, rojo para bajas y choques. Fuentes Plus Jakarta Sans e Inter. Son páginas HTML sueltas (Tailwind y React por CDN) que sirven de referencia visual para el frontend real.

Cada pantalla es una carpeta `stitch/sabe_*/` con su `code.html` (y `screen.png` en las que exportó Stitch). Todas cargan `stitch/_shared/prototipo.js`, que enlaza las pantallas según el rol. Se prueba abriendo el login y usando los accesos de demostración (estudiante `210089334`, Control Escolar `valeria.ruiz`, administrador `admin`; contraseña `demo1234`, o `temporal` para el primer acceso del estudiante).

| Carpeta | Contenido |
|---|---|
| `sabe_inicio_de_sesi_n_...` | Login con accesos de demostración; redirige por rol |
| `sabe_recuperar_contrase_a_...`, `sabe_cambio_obligatorio_...` | Recuperar contraseña y cambio obligatorio de la temporal |
| `sabe_estudiantes` | Portal del estudiante: dashboard, horario, catálogo y carrito, confirmación e historial |
| `sabe_cancelar_solicitud_...`, `sabe_detalle_de_folio_...`, `sabe_convocatoria_cerrada_...`, `sabe_panel_de_notificaciones_...` | Cancelar solicitud, detalle de folio, convocatoria cerrada o extemporánea y notificaciones del estudiante |
| `sabe_solicitudes_control_escolar` | Bandeja y validación por movimiento (rechazo con motivo, visto bueno en extemporáneos) |
| `sabe_oferta_academica_control_escolar` | Oferta con horario por día y hora, cupo y publicar asignatura |
| `sabe_periodo_y_convocatoria_...`, `sabe_importaci_n_de_csv_...`, `sabe_lotes_exportados_...`, `sabe_notificaciones_de_control_escolar_...` | Periodo, importación de CSV, Excel de intercambio para SADCE con lotes, y notificaciones de Control Escolar |
| `sabe_bitacora_auditoria` | Bitácora de solo lectura con descarga en CSV |
| `sabe_usuarios_y_roles_administrador` | Usuarios y roles |
| `_archivo/sabe_administrativo` | Versión vieja y monolítica del módulo administrativo, reemplazada por las pantallas de arriba |
| `DESIGN.md` | Guía de diseño |

**Problemas del HTML de control escolar:** el archivo trae 3 copias compiladas de la app en el `<head>` que fallan al cargar (React error #299 en la consola, sin efecto visible) y una instantánea estática de la pantalla donde vive "Oferta académica" (publicar materia y convocatoria), que no está conectada al menú de la app real. Conviene limpiar el archivo y conectar esa pantalla.

Flujo del estudiante en el prototipo: sin folio al inicio, el dashboard invita a ir al catálogo; el carrito se confirma (exige justificación y declaración) y al enviar aparece el folio #SABE-2026-089, el acuse, el historial y una notificación; el horario marca la alta y la baja como "en trámite".

## 10. Cambios en las vistas

**Ya aplicado en los HTML (4 de noviembre de 2026)**
- Nombres de archivo corregidos (estaban cruzados) y HTML del estudiante restaurado.
- Carrera del alumno: Economía (decía Sistemas Computacionales). Quitados promedio, créditos acumulados y la regla de 16 a 32 créditos.
- Ciclo unificado: 2026-A, convocatoria del 10 al 15 de agosto de 2026. Folios con formato SABE-2026-###.
- SIIA cambiado por SADCE. "Consejo Técnico" y "Comité" cambiados por Control Escolar.
- Seguimiento del trámite en 3 pasos: Ingresada, En dictamen, Cargada en SADCE.
- Quitados "firma digital", "sello SHA-256" (ahora "código de verificación"), "Validación directa con Control Escolar UAN", "Integración UAN", "Calendario de Turnos" y "Normativa Escolar".
- "Forzar con permuta" eliminado: una materia con choque no se puede solicitar.
- Flujo coherente: el dashboard, el horario, el historial y el acuse solo muestran el folio después de enviar la solicitud, que ahora valida justificación y declaración.
- Login: recuperar contraseña y cambio obligatorio de contraseña como vistas propias. Panel de notificaciones en el portal del estudiante.

**Pantallas que aún faltan**
1. Estudiante: cancelar una solicitud pendiente (el modelo ya tiene el estado `cancelada`).
2. Estudiante: detalle de un folio (movimientos, dictamen, motivo de rechazo y volver a solicitar).
3. Estudiante: estado "convocatoria cerrada" (catálogo bloqueado y aviso de acudir a coordinación para un caso justificado).
4. Control escolar: gestión del periodo y la convocatoria (fechas de apertura y cierre).
5. Control escolar: importación de alumnos y cargas académicas por CSV, con vista previa de errores y plantilla descargable.
6. Control escolar: conectar la pantalla "Oferta académica" al menú (hoy solo existe en una instantánea).
7. Control escolar: panel de notificaciones (solo hay campana).
8. Control escolar: lista de lotes exportados dentro de Exportación a SADCE.
9. Administrador: gestión de usuarios y roles.

**Ajustes a pantallas que ya existen**
- Catálogos y grupos: el horario hoy es un texto libre; debe ser por día y hora (una fila por día) para que el backend detecte choques.
- Validación de solicitud: la frase de choques ahora dice "carga inscrita en SABE" (decía SADCE).

**Decisiones abiertas de flujo**
- Si una alta choca con una materia que el alumno también está dando de baja en el mismo folio, ¿el choque cuenta? Recomendación: no cuenta, porque el cambio de grupo es un caso común. El backend debe considerar las bajas del mismo folio al validar.
- El tiempo "~24 hrs hábiles" de resolución es un texto fijo. Quitarlo o definirlo con control escolar.
- Aprobación por movimiento (recomendado), no por folio completo.

## 11. ERD propuesto por el equipo (versión actual)

Tablas: usuarios, estudiantes, periodos_escolares, unidades_aprendizaje, solicitudes, detalle_solicitud, grupos, carga_academica.

- usuarios: id_usuario, username_matricula, username, password_hash, name_mote (typo), rol, fecha_registro.
- estudiantes: id_estudiante, carrera, id_usuario (FK).
- periodos_escolares: id_periodo, carrera, fecha_inicio, fecha_fin.
- unidades_aprendizaje: id_materia, nombre_materia, creditos.
- solicitudes: id_solicitud, folio_digital, estado, id_estudiante (FK), id_periodo (FK).
- detalle_solicitud: id_detalle, tipo_tramite, id_solicitud (FK), id_grupo (FK).
- grupos: id_grupo, num_grupo, cupo_disponible, horario_dias, horario_inicio, horario_fin, id_materia, id_docente, id_periodo.
- carga_academica: calificacion_final, estado, id_estudiante, id_grupo (sin PK propia).

## 12. Cambios pendientes en el diagrama (backend)

**Corregir**
1. carga_academica: agregar PK, hacer único (estudiante, grupo, periodo), quitar calificacion_final, estado inscrito o baja.
2. periodos_escolares: quitar carrera; agregar ciclo (2026-A), inicio y fin del semestre, inicio y fin de convocatoria, activo.
3. usuarios: dejar un solo username; mover la matrícula (única) a estudiantes; corregir name_mote; rol como enum (estudiante, control_escolar, administrador).
4. Flecha de unidades_aprendizaje a solicitudes: debe ir a grupos (id_materia).
5. Quitar la flecha redundante de usuarios a solicitudes.
6. carrera como FK a una tabla programas.
7. Typos del diagrama: "ESCRIPCIONES DE TRÁMITE".

**Agregar**
8. solicitudes y detalle_solicitud: fecha_solicitud, justificacion, motivo_rechazo, revisado_por (FK usuarios), fecha_resolucion, visto_bueno (caso extemporáneo). Estado por movimiento: pendiente, aprobada, rechazada, cargada en SADCE, cancelada. El estado de la solicitud se deriva de los movimientos.
9. docentes (el admin ya tiene su catálogo y grupos.id_docente no apuntaba a nada).
10. horarios_grupo: grupo, día de la semana, hora_inicio, hora_fin, aula. Reemplaza horario_dias, inicio y fin de grupos; hace simple la detección de choques.
11. grupos: cupo_maximo (el disponible se calcula, no se guarda), numero de grupo, turno.
12. unidades_aprendizaje: clave (ej. ECO-302), programa, área. Prerrequisitos opcionales.
13. programas (Economía, Finanzas).
14. bitacora: usuario, acción, IP, fecha.
15. notificaciones: usuario, mensaje, leída, fecha.
16. lotes_exportacion: quién, cuándo, formato, y los movimientos incluidos (respalda "marcar como cargado en SADCE").

Resultado: unas 14 tablas.

**Reglas de backend**
- Validación de choques solo en el servidor, en un servicio único. El frontend solo la muestra.
- Al aprobar: `transaction.atomic` + `select_for_update` sobre el grupo para respetar el cupo.
- Solicitudes fuera de la convocatoria solo con visto_bueno (caso extemporáneo).
- Exportación con openpyxl/csv, registrada en lotes_exportacion.
- Auditoría de aprobar, rechazar, exportar y cambios de catálogo.

## 13. Puntos abiertos

- De dónde sale la carga académica actual del alumno (necesaria para los choques). Propuesta: importación por CSV hecha por control escolar.
- Formato exacto del reporte para SADCE (columnas). Pendiente de consultar con control escolar.
- Cómo comprobar que quien pide la alta es el alumno (por ahora solo login con contraseña).
- Confirmar el stack final con el equipo.
- Aprobación por folio o por movimiento (se recomienda por movimiento).

## 14. Mapa de archivos

Estructura de `C:\dev\SABE` (reorganizada el 4 de noviembre de 2026):

- `Clases/`: todo lo de la materia y la documentación del proyecto.
  - `1. Análisis/`, `2. Diseño/`, `3. Desarrollo/`: entrevistas, actividades y EDT por fase.
  - `Actividades/`: entregas de la materia (propuesta técnica, EDT, diagrama de red, Gantt, holgura).
  - `Material de clases/`: guías y teoría, más `SABE_Contexto_Proyecto.md` (versión vieja del contexto).
  - `output/`: PDFs y Word de la actividad 9 (ruta crítica).
  - Este archivo vive ahora en `docs/diseno/`.
- `stitch/`: prototipo en HTML, una carpeta por pantalla (`sabe_*/code.html`), `_shared/prototipo.js` (navegación entre pantallas y roles) y `academic_prestige_modern/DESIGN.md`. Ver la sección 9.
- `docs/`: `requerimientos/` (Word por rol) y `diseno/` (este contexto y `Pantallas y Flujos.docx`).
- `diagramas/`: `SABE_ERD_Backend.png` y `.mmd` (ERD corregido, 15 tablas; el .mmd es el editable en Mermaid).
- `backend/core/`: `models.py` de Django que refleja el ERD (Django 5.1+, PostgreSQL, `AUTH_USER_MODEL = "core.Usuario"`).
- `tmp/`: scripts y renders que se usaron para generar los documentos de la actividad 9. Se puede ignorar; sus rutas apuntan a la estructura anterior.

## 15. Preferencias de redacción de Milton

- Textos de entrega en voz natural, directa, primera persona del plural.
- Sin guiones largos (la raya) en textos de entrega.
- Respuestas específicas y concretas. Entregables suelen ser PDF.
