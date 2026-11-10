// Fechas de la pantalla de periodos con el formato de stitch: "08 Feb 2026", "08 Feb 08:00", "10/Feb/2026 09:14 hrs".

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIA_MS = 24 * 60 * 60 * 1000;

const dos = (n: number) => String(n).padStart(2, "0");

/** "2026-08-03" es un día del calendario, no un instante: se lee en hora local para no cambiar de día. */
export function dia(fecha: string): Date {
  const [a, m, d] = fecha.slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d);
}

/** "26 Ene 2026" (fecha "2026-01-26" o instante ISO). */
export function fechaPeriodo(valor: string | Date): string {
  const f = typeof valor === "string" ? (valor.length === 10 ? dia(valor) : new Date(valor)) : valor;
  return `${dos(f.getDate())} ${MESES[f.getMonth()]} ${f.getFullYear()}`;
}

/** "26 Ene 2026 — 26 Jun 2026" */
export function rangoFechas(inicio: string, fin: string): string {
  return `${fechaPeriodo(inicio)} — ${fechaPeriodo(fin)}`;
}

/** "08:00" */
export function horaMinuto(iso: string): string {
  const f = new Date(iso);
  return `${dos(f.getHours())}:${dos(f.getMinutes())}`;
}

/** "08 Feb 08:00" */
export function diaHora(iso: string): string {
  const f = new Date(iso);
  return `${dos(f.getDate())} ${MESES[f.getMonth()]} ${horaMinuto(iso)}`;
}

/** "Viernes 13 Feb 23:59:59" */
export function cierreAutomatico(iso: string): string {
  const f = new Date(iso);
  return `${DIAS[f.getDay()]} ${dos(f.getDate())} ${MESES[f.getMonth()]} ${horaMinuto(iso)}:${dos(f.getSeconds())}`;
}

/** "10/Feb/2026 09:14 hrs" */
export function fechaBitacora(iso: string): string {
  const f = new Date(iso);
  return `${dos(f.getDate())}/${MESES[f.getMonth()]}/${f.getFullYear()} ${horaMinuto(iso)} hrs`;
}

/** Semanas completas del semestre, redondeadas: 26 Ene a 26 Jun son 22. */
export function semanas(inicio: string, fin: string): number {
  return Math.round((dia(fin).getTime() - dia(inicio).getTime()) / (7 * DIA_MS));
}

/** "1 día", "3 días", "5 horas" o "menos de 1 hora" hasta `iso`. */
export function faltan(iso: string, ahora = new Date()): string {
  const ms = new Date(iso).getTime() - ahora.getTime();
  if (ms >= DIA_MS) {
    const dias = Math.floor(ms / DIA_MS);
    return `${dias} día${dias === 1 ? "" : "s"}`;
  }
  const horas = Math.floor(ms / (60 * 60 * 1000));
  return horas >= 1 ? `${horas} hora${horas === 1 ? "" : "s"}` : "menos de 1 hora";
}

/** Inicio del día en hora local, en milisegundos. */
function medianoche(f: Date): number {
  return new Date(f.getFullYear(), f.getMonth(), f.getDate()).getTime();
}

/** Avance de la ventana de convocatoria: "Día 5 de 6" y el porcentaje de tiempo transcurrido. */
export function avanceVentana(inicio: string, fin: string, ahora = new Date()) {
  const a = new Date(inicio).getTime();
  const b = new Date(fin).getTime();
  const primerDia = medianoche(new Date(inicio));
  const total = Math.round((medianoche(new Date(fin)) - primerDia) / DIA_MS) + 1;
  const hoy = medianoche(ahora);
  const actual = Math.min(Math.max(Math.round((hoy - primerDia) / DIA_MS) + 1, 0), total);
  const porcentaje = Math.round(Math.min(Math.max((ahora.getTime() - a) / (b - a), 0), 1) * 100);
  return { dia: actual, total, porcentaje };
}

/** Valor de un <input type="datetime-local"> (hora local) a partir de un instante ISO. */
export function aInputFechaHora(iso: string): string {
  const f = new Date(iso);
  return `${f.getFullYear()}-${dos(f.getMonth() + 1)}-${dos(f.getDate())}T${horaMinuto(iso)}`;
}

/** De un <input type="datetime-local"> a ISO con zona, para la API. */
export function deInputFechaHora(valor: string): string {
  return new Date(valor).toISOString();
}
