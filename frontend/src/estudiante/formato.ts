// Textos del portal del estudiante con el mismo formato que stitch/sabe_estudiantes.
import type { Choque, DiaSemana, Grupo, HorarioClase, OrigenChoque, ResultadoMovimiento } from "../api/tipos";

export const DIAS: Record<DiaSemana, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

export const DIAS_CORTOS: Record<DiaSemana, string> = { 1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb" };

/** "07:00:00" → "07:00" */
export function hora(valor: string): string {
  return valor.slice(0, 5);
}

/** "07:00:00" → minutos desde medianoche */
export function minutos(valor: string): number {
  const [h, m] = valor.split(":").map(Number);
  return h * 60 + m;
}

/** ["Lun", "Mié"] → "Lun y Mié"; ["Lun", "Mié", "Vie"] → "Lun, Mié y Vie" */
export function unir(partes: string[]): string {
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

/** Días con nombre completo: "Lunes y Miércoles". */
export function diasLargos(dias: DiaSemana[]): string {
  return unir(dias.map((d) => DIAS[d]));
}

/** Lo que se agrega al final de la frase del choque según de dónde viene el grupo con el que choca. */
export function sufijoOrigen(origen: OrigenChoque): string {
  return { inscrita: "", carrito: " (en tu carrito)", en_tramite: " (en trámite)" }[origen];
}

/** "Choca con Macroeconomía III el Lunes y Miércoles de 07:00 a 09:00 hrs." (para texto sin formato). */
export function textoChoque(c: Choque): string {
  return `Choca con ${c.materia}${sufijoOrigen(c.origen)} el ${diasLargos(c.dias)} de ${hora(c.hora_inicio)} a ${hora(c.hora_fin)} hrs.`;
}

/** Agrupa los días que comparten horario: [{dias, inicio, fin, aula}] ordenado por día. */
export function bloques(horarios: HorarioClase[]) {
  const grupos = new Map<string, { dias: DiaSemana[]; inicio: string; fin: string; aula: string }>();
  for (const h of [...horarios].sort((a, b) => a.dia_semana - b.dia_semana)) {
    const clave = `${h.hora_inicio}-${h.hora_fin}`;
    const bloque = grupos.get(clave) ?? { dias: [], inicio: h.hora_inicio, fin: h.hora_fin, aula: h.aula };
    bloque.dias.push(h.dia_semana);
    grupos.set(clave, bloque);
  }
  return [...grupos.values()];
}

/**
 * Horario en una línea, como en stitch.
 * Catálogo (corto): "Mar y Jue 11:00 - 13:00 hrs", y con un solo día "Viernes 11:00 - 15:00 hrs".
 * Horario en lista (largo): "Lunes y Miércoles 07:00 - 09:00 hrs".
 */
export function horarioTexto(horarios: HorarioClase[], largo = false): string {
  if (horarios.length === 0) return "Sin horario asignado";
  return bloques(horarios)
    .map(({ dias, inicio, fin }) => {
      const nombres = largo || dias.length === 1 ? dias.map((d) => DIAS[d]) : dias.map((d) => DIAS_CORTOS[d]);
      return `${unir(nombres)} ${hora(inicio)} - ${hora(fin)} hrs`;
    })
    .join(" • ");
}

/** "EC605 • Gpo 02" */
export function claveGrupo(grupo: Grupo): string {
  return `${grupo.materia.clave} • Gpo ${grupo.num_grupo}`;
}

/** "Carlos E." + "Pérez Villa" → "Carlos E. Pérez" (como el chip del encabezado). */
export function nombreCorto(nombre: string, apellidos: string): string {
  return [nombre, apellidos.split(" ")[0]].filter(Boolean).join(" ");
}

/** Minúsculas y sin acentos, para buscar "econometria" y encontrar "Econometría". */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** "E-204" → "Aula E-204"; "Auditorio UAE" se queda igual (como en stitch). */
export function lugar(aula: string): string {
  if (!aula) return "Sin aula";
  return /^[A-Za-z]{1,2}-?\d/.test(aula) ? `Aula ${aula}` : aula;
}

/** Lugares distintos del grupo: "Aula E-204" o "Aula E-204, Laboratorio de Cómputo". */
export function lugares(grupo: Grupo): string {
  return [...new Set(grupo.horarios.map((h) => h.aula).filter(Boolean))].map(lugar).join(", ");
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function partesFecha(iso: string) {
  const f = new Date(iso);
  const hh = String(f.getHours()).padStart(2, "0");
  const mm = String(f.getMinutes()).padStart(2, "0");
  return { dia: f.getDate(), mes: f.getMonth(), anio: f.getFullYear(), hora: `${hh}:${mm}` };
}

/** "10 de Febrero de 2026, 09:42 hrs" */
export function fechaLarga(iso: string): string {
  const { dia, mes, anio, hora } = partesFecha(iso);
  return `${dia} de ${MESES[mes]} de ${anio}, ${hora} hrs`;
}

/** "10 Feb 2026" */
export function fechaCorta(iso: string): string {
  const { dia, mes, anio } = partesFecha(iso);
  return `${dia} ${MESES[mes].slice(0, 3)} ${anio}`;
}

/** "14:15 hrs" */
export function horaDe(iso: string): string {
  return `${partesFecha(iso).hora} hrs`;
}

/** "13 de febrero de 2026 a las 23:59 hrs" (texto corrido de la convocatoria). */
export function fechaEnTexto(iso: string): string {
  const { dia, mes, anio, hora } = partesFecha(iso);
  return `${dia} de ${MESES[mes].toLowerCase()} de ${anio} a las ${hora} hrs`;
}

/** "13-Feb-2026 23:59 hrs" (módulos de la convocatoria cerrada). */
export function fechaModulo(iso: string): string {
  const { dia, mes, anio, hora } = partesFecha(iso);
  return `${String(dia).padStart(2, "0")}-${MESES[mes].slice(0, 3)}-${anio} ${hora} hrs`;
}

/** Motivos por los que un movimiento del carrito no se puede enviar (errores y choques), en texto. */
export function problemasDe(resultado?: ResultadoMovimiento): string[] {
  if (!resultado) return [];
  return [...resultado.errores.map((e) => e.detalle), ...resultado.choques.map(textoChoque)];
}
