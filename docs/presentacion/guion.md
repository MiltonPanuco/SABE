# SABE: guion de la presentación

Unos 15 minutos: 4 de contexto, 8 de demostración en vivo y 3 de cierre, más preguntas. La demostración usa la URL pública, https://sabe.163-192-148-141.sslip.io.

## Antes de presentar

**La noche anterior**
- [ ] Reiniciar la demostración en el servidor (README, "Reiniciar la demostración"). Deja los folios de ejemplo y la convocatoria abierta 7 días.
- [ ] Entrar una vez con cada usuario para confirmar: `210089334` / `demo1234`, `valeria.ruiz` / `demo1234`, `admin` / la contraseña de `.env.prod` (la tiene quien administra el servidor).
- [ ] Tener a la mano el plan B (abajo).

**El día de la presentación**
- [ ] Abrir la URL en el equipo del salón y en un celular.
- [ ] Tener a la mano un hotspot de celular por si falla la red.
- [ ] Usar dos ventanas: una normal para el estudiante y una de incógnito para control escolar. Así las dos sesiones conviven.
- [ ] Zoom del navegador al 110 % para el proyector.

## Quién presenta qué

| Parte | Tiempo | Quién |
|---|---|---|
| 1. El problema | 2 min | Ángel (análisis y entrevistas) |
| 2. La solución y el diseño | 2 min | Rafael (UI/UX y prototipo) |
| 3. Demostración: estudiante | 3 min | Fernando |
| 4. Demostración: control escolar y SADCE | 4 min | Irving |
| 5. Demostración: administrador y bitácora | 1 min | Fernando |
| 6. Cómo está construido y resultados | 2 min | Irving |
| 7. Cierre y siguientes pasos | 1 min | Milton (líder) |

Si el equipo se reparte distinto, cambien los nombres; los tiempos son los que importan.

## 1. El problema (2 min)

- Las altas y bajas fuera de periodo se hacen en papel. El alumno hace fila y llena a mano matrícula, nombre, materia, docente y horario. La ventana dura 1 o 2 días.
- Control escolar vuelve a capturar todo en SADCE, materia por materia: de 3 a 4 minutos por materia, en un sistema inestable. Son de 20 a 30 solicitudes por semestre, casi todas el último día.
- Errores comunes: mala letra, nombre equivocado de la materia o del docente, grupo equivocado (el alumno descubre después que no está en lista).
- De 16 estudiantes encuestados, 12 usarían el trámite digital y 4 tal vez. Piden ver cupos, horarios y choques antes de pedir, y quieren contraseña y comprobante.

## 2. La solución (2 min)

- **SABE es una aplicación web aparte.** No se conecta con PiiDA ni con SADCE, y esa fue una decisión desde el inicio.
- **Para el alumno:** pide sus altas y bajas desde la computadora o el celular, y el sistema bloquea los choques de horario antes de enviar.
- **Para control escolar:** dictamina cada movimiento y genera un solo Excel con todo lo aprobado para pasarlo a SADCE. Se acaba la captura de papel.
- **Tres roles:** estudiante, control escolar y administrador. Se diseñaron 16 pantallas en el prototipo de `stitch/`, y cada una se construyó igual al prototipo.

## 3. Demostración: estudiante (3 min), con Carlos `210089334` / `demo1234`

1. **Inicio de sesión:** con matrícula y contraseña. Mostrar el panel: convocatoria abierta y "Sin trámite en curso".
2. **Horario Semestral:** su carga inscrita.
3. **Catálogo:** buscar "Comercio Internacional". El sistema avisa en rojo que **choca con Macroeconomía III** y no deja pedirla. Es la regla que control escolar revisaba a mano.
4. **Pedir un alta:** en Econometría II, "Solicitar Alta". **Pedir una baja:** desde el horario, "Solicitar baja" en Finanzas Públicas. El carrito muestra las dos.
5. **Confirmación:** escribir la justificación, marcar la declaración y enviar. Aparece el folio (SABE-2026-…).
6. **Detalle del folio:** los tres pasos (Ingresada, En dictamen, Cargada en SADCE) y **"Imprimir acuse"**, el comprobante que pidieron los alumnos.

## 4. Demostración: control escolar (4 min), con Valeria `valeria.ruiz` / `demo1234` (ventana de incógnito)

1. **Campana y Centro de Notificaciones:** aparece "Nueva solicitud ingresada" con el folio de Carlos.
2. **Bandeja:** el folio de Carlos y los de ejemplo (uno extemporáneo, uno aprobado).
3. **Revisar el folio de Carlos:** aprobar el alta (dice "Libre de traslapes" y el cupo); rechazar la baja con el motivo "Falta la firma de tu tutor".
4. **El folio extemporáneo de Luis:** no se aprueba sin el **visto bueno**; con la casilla marcada, sí. Es la regla de las excepciones.
5. **Exportar Excel para SADCE:** "Generar Excel de intercambio" descarga el Excel con una fila por movimiento. Abrirlo un momento.
6. **"Marcar como cargado en SADCE":** el lote queda cargado y los alumnos reciben aviso.
7. **Volver a la ventana de Carlos:** la campana muestra "Se aprobó tu alta", "Se rechazó tu baja" con el motivo, y "Tu solicitud … fue cargada en SADCE".

## 5. Demostración: administrador y bitácora (1 min), con `admin`

1. **Usuarios y Roles:** las cuentas, cómo se crea una cuenta de control escolar y cómo se restablece una contraseña provisional.
2. **Bitácora de Auditoría:** cada acción de la demostración aparece con quién, cuándo y qué (por ejemplo, "Aprobó la alta de Econometría II…"). Mostrar la descarga en CSV.

## 6. Cómo está construido (2 min)

- **Backend:** Django y Django REST Framework, con las reglas en servicios (choques, cupo con bloqueo, dictamen por movimiento, exportación). Base de datos PostgreSQL.
- **Frontend:** React con TypeScript, igual al prototipo de `stitch/`, y funciona en celular.
- **Despliegue:** Docker Compose en una VM de Oracle Cloud. HTTPS automático con Caddy y Let's Encrypt, respaldo diario de la base y límite de intentos de inicio de sesión.
- **Calidad:**
  - unas 290 pruebas automáticas del backend;
  - integración continua en GitHub Actions;
  - un recorrido completo con los tres roles en producción;
  - una prueba de usabilidad con compañeros (resultados en `docs/pruebas/prueba_usabilidad.md`).

## 7. Cierre (1 min)

- **Lo que resuelve:** un trámite que tomaba fila, papel y doble captura ahora toma unos minutos en línea, con choques bloqueados y un solo Excel para SADCE.
- **Siguientes pasos:** probarlo con control escolar en una convocatoria real, enviar avisos por correo si se consigue un servidor de correo, y ajustar el Excel si SADCE pide otro formato.

## Plan B

**Si falla la red del salón:**
1. Primero, el hotspot del celular.
2. Si tampoco hay internet, levantar SABE en una laptop con el proyecto (necesita Docker; los comandos completos están en el README, "Despliegue"):
   ```
   docker compose -p sabe-demo -f docker-compose.prod.yml up -d --build
   docker compose -p sabe-demo -f docker-compose.prod.yml exec backend python manage.py seed_demo --permitir-produccion
   ```
   Ojo: con el `.env.prod` del servidor, Caddy pide un certificado para el dominio público, y eso no funciona sin internet. Para la laptop se usa un `.env.prod` propio con `SABE_DOMINIO=:80`, `DJANGO_ALLOWED_HOSTS=localhost` y `DJANGO_SECURE_SSL_REDIRECT=0`, y se abre http://localhost.
3. Último recurso: capturas de pantalla de cada paso de la demostración, que se preparan con anticipación.

**Si algo de la demostración sale distinto:**
- **Un folio ya dictaminado:** reiniciar la demostración no toma más de un minuto. Si no da tiempo, usar otro alumno: Diego `220011456` o Luis `200078511`, contraseña `demo1234`.
- **Si alguien se equivoca de contraseña varias veces:** después de 10 intentos en un minuto, el inicio de sesión se bloquea unos 60 segundos.

## Preguntas probables

- **¿Por qué no se conecta directo con SADCE?** No tenemos acceso a SADCE y no es nuestro sistema. El Excel con columnas acordadas evita la captura materia por materia, y control escolar decide cuándo subirlo.
- **¿Qué tan seguro es?**
  - Hay inicio de sesión con contraseña y roles, y las contraseñas se guardan cifradas.
  - Se trabaja por HTTPS, con límite de intentos y bitácora de cada acción.
  - Las contraseñas temporales se cambian en el primer acceso.
- **¿Por qué se aprueba por movimiento y no por folio?** Un folio puede tener un alta válida y una baja que no procede. Así no se rechaza todo por un movimiento.
- **¿De dónde salen los alumnos y sus cargas?** Control escolar los importa por CSV (padrón y cargas), con vista previa de errores y sin duplicar al reimportar.
- **¿Qué pasa con un alumno que tramita tarde?** Puede enviar su solicitud como extemporánea, con justificación, y solo se aprueba con el visto bueno de control escolar.
- **¿Funciona en celular?** Sí: todas las pantallas se probaron a 390 px de ancho.
