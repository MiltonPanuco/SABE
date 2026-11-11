// Fechas e iconos de las notificaciones, con el formato de stitch (panel del estudiante y de control escolar).
import type { DatosNotificacion, Notificacion, TipoNotificacion } from "../api/tipos";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DIA_MS = 24 * 60 * 60 * 1000;

const dos = (n: number) => String(n).padStart(2, "0");

function mismoDia(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function esAyer(fecha: Date, ahora: Date) {
  return mismoDia(fecha, new Date(ahora.getTime() - DIA_MS));
}

/** "10:45 AM" */
export function hora12(fecha: Date): string {
  const h = fecha.getHours();
  return `${dos(h % 12 || 12)}:${dos(fecha.getMinutes())} ${h < 12 ? "AM" : "PM"}`;
}

/** "Hace 15 min • 10:45 AM", "Hoy a las 09:30 AM", "Ayer a las 04:20 PM" o "10 Feb a las 09:30 AM". */
export function cuandoAviso(iso: string, ahora = new Date()): string {
  const fecha = new Date(iso);
  const minutos = Math.floor((ahora.getTime() - fecha.getTime()) / 60000);
  if (mismoDia(fecha, ahora) && minutos < 60) return `Hace ${Math.max(minutos, 1)} min • ${hora12(fecha)}`;
  if (mismoDia(fecha, ahora)) return `Hoy a las ${hora12(fecha)}`;
  if (esAyer(fecha, ahora)) return `Ayer a las ${hora12(fecha)}`;
  return `${dos(fecha.getDate())} ${MESES_CORTOS[fecha.getMonth()]} a las ${hora12(fecha)}`;
}

/** Encabezado del grupo del día: "Hoy • 12 de Febrero 2026". */
export function grupoDia(iso: string, ahora = new Date()): string {
  const fecha = new Date(iso);
  const texto = `${fecha.getDate()} de ${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
  if (mismoDia(fecha, ahora)) return `Hoy • ${texto}`;
  if (esAyer(fecha, ahora)) return `Ayer • ${texto}`;
  return texto;
}

/** "11 Feb 2026, 10:14 hrs" (tarjetas de control escolar). */
export function fechaEvento(iso: string): string {
  const f = new Date(iso);
  return `${dos(f.getDate())} ${MESES_CORTOS[f.getMonth()]} ${f.getFullYear()}, ${dos(f.getHours())}:${dos(f.getMinutes())} hrs`;
}

/** "hace 2 min", "hace 3 h", "hace 2 días" (franja "Última recepción"). */
export function haceCuanto(iso: string, ahora = new Date()): string {
  const minutos = Math.max(0, Math.floor((ahora.getTime() - new Date(iso).getTime()) / 60000));
  if (minutos < 60) return `hace ${Math.max(minutos, 1)} min`;
  if (minutos < 24 * 60) return `hace ${Math.floor(minutos / 60)} h`;
  const dias = Math.floor(minutos / (24 * 60));
  return `hace ${dias} día${dias === 1 ? "" : "s"}`;
}

/** Agrupa una lista ya ordenada por el encabezado de su día, conservando el orden. */
export function porDia(avisos: Notificacion[]): [string, Notificacion[]][] {
  const grupos: [string, Notificacion[]][] = [];
  for (const aviso of avisos) {
    const dia = grupoDia(aviso.fecha);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo[0] === dia) ultimo[1].push(aviso);
    else grupos.push([dia, [aviso]]);
  }
  return grupos;
}

/** Icono y color del aviso en la lista de la campana (como los avisos de stitch/sabe_estudiantes). */
export function iconoCampana(aviso: Notificacion): { icono: string; color: string } {
  const iconos: Record<TipoNotificacion, { icono: string; color: string }> = {
    folio_enviado: { icono: "send", color: "text-primary-container" },
    movimiento_aprobado: { icono: "fact_check", color: "text-on-tertiary-container" },
    movimiento_rechazado: { icono: "cancel", color: "text-error" },
    cargada_sadce: { icono: "verified", color: "text-on-tertiary-container" },
    convocatoria_cierra: { icono: "schedule", color: "text-secondary" },
    nueva_solicitud: { icono: "assignment_add", color: "text-primary-container" },
    solicitud_extemporanea: { icono: "event_busy", color: "text-secondary" },
    cancelacion: { icono: "cancel", color: "text-error" },
    importacion: { icono: "task_alt", color: "text-on-tertiary-container" },
    exportacion_pendiente: { icono: "file_download", color: "text-primary-container" },
    aviso: { icono: "campaign", color: "text-on-tertiary-container" },
  };
  return iconos[aviso.tipo];
}

/** Movimientos del aviso de nueva solicitud (en otros tipos `movimientos` es un número). */
export function pillsDe(datos: DatosNotificacion) {
  return Array.isArray(datos.movimientos) ? datos.movimientos : [];
}
