# SABE: prueba rápida de usabilidad

Guía para que el equipo pruebe SABE con 2 o 3 compañeros que no lo conozcan (F13). Cada sesión dura unos 15 minutos. Lo que se encuentre se anota en la tabla del final y se corrige antes de la presentación.

## Antes de empezar

- **Dónde:** https://sabe.163-192-148-141.sslip.io. Al menos una persona lo prueba desde su celular y otra desde una computadora.
- **Datos limpios:** antes de cada sesión, quien administra el servidor corre `seed_demo` (ver "Reiniciar la demostración" en el README). Así cada participante empieza igual.
- **Roles en la sesión:**
  - **Moderador:** lee las tareas y no ayuda.
  - **Observador:** toma notas en la hoja.
- **Al participante se le dice:** "Probamos el sistema, no a ti. Piensa en voz alta: di qué buscas y qué esperas que pase. Si te atoras, dilo; no hay respuestas incorrectas."
- **Si se atora** más de 2 minutos en una tarea, se marca como no completada y se pasa a la siguiente.

## Tareas

Se leen una por una, sin decir dónde está cada cosa.

### Como estudiante (usuario `210089334`, contraseña `demo1234`)

| # | Tarea que se lee | Se completa cuando |
|---|---|---|
| 1 | "Entra a SABE con tu matrícula." | Ve su panel de inicio. |
| 2 | "¿Qué materias llevas este semestre y a qué hora?" | Abre su horario y dice al menos una materia con su horario. |
| 3 | "Quieres darte de alta en Econometría II. Pídelo." | La agrega al carrito desde el catálogo. |
| 4 | "Intenta también agregar Comercio Internacional. ¿Se puede? ¿Por qué?" | Ve el aviso de choque con Macroeconomía III y lo explica. |
| 5 | "Además quieres darte de baja de Finanzas Públicas. Envía todo a Control Escolar." | Envía el folio con justificación y ve su número de folio. |
| 6 | "¿En qué va tu trámite? Imprime tu comprobante." | Abre el detalle del folio y usa "Imprimir acuse". |
| 7 | "Te arrepentiste: cancela la solicitud." | Cancela el folio y ve que quedó cancelado. |

### Como Control Escolar (usuario `valeria.ruiz`, contraseña `demo1234`)

Antes de esta parte, el moderador entra como Carlos (`210089334`) y manda un folio con dos movimientos: alta de Econometría II y baja de Finanzas Públicas. Si el participante ya hizo las tareas 3 a 5, se usa ese folio; si lo canceló en la tarea 7, el moderador manda otro.

| # | Tarea que se lee | Se completa cuando |
|---|---|---|
| 8 | "Busca la solicitud de Carlos E. Pérez Villa." | La encuentra en la bandeja (buscador o lista). |
| 9 | "Revísala: aprueba el alta y rechaza la baja explicando por qué." | Dictamina los dos movimientos; el rechazo lleva motivo. |
| 10 | "Genera el Excel para pasar lo aprobado a SADCE." | Descarga el Excel desde "Exportar Excel para SADCE". |

### Primer acceso (usuario `230012345`, contraseña `temporal`)

| # | Tarea que se lee | Se completa cuando |
|---|---|---|
| 11 | "Es tu primera vez en SABE. Entra y deja lista tu cuenta." | Cambia la contraseña temporal y llega a su panel. |

## Hoja de observación (una por participante)

Participante: ____  Dispositivo: celular / computadora  Fecha: ____

| # | ¿Completó? (sí / con ayuda / no) | Tiempo aprox. | Errores o dudas que tuvo | Comentarios que dijo |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |
| 11 | | | | |

## Cuestionario al terminar (SUS)

El participante califica cada frase de 1 (totalmente en desacuerdo) a 5 (totalmente de acuerdo):

1. Creo que me gustaría usar este sistema con frecuencia.
2. Encontré el sistema innecesariamente complejo.
3. Pensé que el sistema era fácil de usar.
4. Creo que necesitaría ayuda de una persona con conocimientos técnicos para usarlo.
5. Las funciones del sistema estaban bien integradas.
6. Pensé que había demasiada inconsistencia en el sistema.
7. Imagino que la mayoría de las personas aprendería a usarlo muy rápido.
8. Encontré el sistema muy difícil de usar.
9. Me sentí muy seguro(a) usando el sistema.
10. Necesité aprender muchas cosas antes de poder usar el sistema.

**Cómo se calcula:**
1. En las frases impares (1, 3, 5, 7, 9) se resta 1 a la calificación.
2. En las pares (2, 4, 6, 8, 10) se resta la calificación a 5.
3. Se suman los 10 resultados y se multiplica por 2.5.

El resultado va de 0 a 100. **68 o más** es una usabilidad por encima del promedio.

Dos preguntas abiertas:
- ¿Qué fue lo más confuso?
- ¿Qué cambiarías primero?

## Resultados

| Participante | Dispositivo | Tareas completadas (de 11) | SUS | Lo más confuso |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

**Problemas encontrados**
- Uno por renglón: qué tarea, qué pasó y qué tan grave es (bloquea / molesta / detalle).
- Se pasan a quien corrige (issue en GitHub o lista en el chat del equipo).
- Lo que bloquee el flujo principal se corrige antes de la presentación.

| # | Tarea | Qué pasó | Gravedad | Estado |
|---|---|---|---|---|
| | | | | |
