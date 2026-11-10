// Piezas del folio que comparten Historial, Detalle de folio y el Dashboard (textos y colores de stitch).
import type { ReactNode } from "react";
import type { EstadoMovimiento, MovimientoFolio, Solicitud } from "../api/tipos";
import { Simbolo } from "../components/acceso";
import { claveGrupo, fechaLarga } from "./formato";

/** Etiqueta y colores del estado del folio completo. */
export function estadoFolio(s: Solicitud): { texto: string; clase: string; activo: boolean } {
  switch (s.estado) {
    case "pendiente":
      return {
        texto: s.resumen.resueltas > 0 ? "En Proceso / Parcialmente Dictaminado" : "En dictamen",
        clase: "bg-secondary-fixed text-on-secondary-container",
        activo: true,
      };
    case "aprobada":
      return { texto: "Dictaminada", clase: "bg-tertiary-container/15 text-on-tertiary-container", activo: false };
    case "cargada_sadce":
      return { texto: "Cargada en SADCE", clase: "bg-tertiary-container/15 text-on-tertiary-container", activo: false };
    case "rechazada":
      return { texto: "Rechazada", clase: "bg-error-container text-error", activo: false };
    case "cancelada":
      return { texto: "Cancelada", clase: "bg-surface-container-high text-on-surface-variant", activo: false };
  }
}

/** Columna "Resolución" del historial. */
export function resolucionFolio(s: Solicitud): string {
  const { total, aprobadas, resueltas } = s.resumen;
  if (s.estado === "cancelada") return "Cancelada por el estudiante";
  if (s.estado === "pendiente") {
    return resueltas ? `${resueltas} de ${total} resueltos por Control Escolar` : "En revisión por Control Escolar";
  }
  if (s.estado === "rechazada") return "Rechazada por Control Escolar";
  return `${aprobadas} de ${total} aprobados`;
}

export function ChipEstadoFolio({ solicitud, className = "" }: { solicitud: Solicitud; className?: string }) {
  const { texto, clase, activo } = estadoFolio(solicitud);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-label-sm text-label-sm font-bold whitespace-nowrap ${clase} ${className}`}>
      {activo && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />}
      {texto}
    </span>
  );
}

/** Estado de un movimiento en la tabla del detalle: chip, texto de apoyo y color. */
export const ESTADO_MOVIMIENTO: Record<EstadoMovimiento, { texto: string; icono: string; chip: string; nota?: string; notaClase?: string }> = {
  pendiente: {
    texto: "Pendiente",
    icono: "hourglass_top",
    chip: "bg-secondary-fixed text-on-secondary-fixed",
    nota: "En cola de dictamen",
    notaClase: "text-secondary",
  },
  aprobada: { texto: "Aprobada", icono: "check_circle", chip: "bg-tertiary-container/15 text-on-tertiary-container" },
  cargada_sadce: { texto: "Cargada en SADCE", icono: "database", chip: "bg-tertiary-container/15 text-on-tertiary-container" },
  rechazada: {
    texto: "Rechazada",
    icono: "cancel",
    chip: "bg-error-container text-error",
    nota: "Requiere revisión",
    notaClase: "text-error",
  },
  cancelada: { texto: "Cancelada", icono: "block", chip: "bg-surface-container-high text-on-surface-variant" },
};

/** Fila "ALTA: Materia (clave)" del acuse (acuse-movements-list de stitch). */
export function FilaAcuse({ movimiento }: { movimiento: MovimientoFolio }) {
  const alta = movimiento.tipo_tramite === "ALTA";
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-container-low p-3 text-xs font-semibold">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${alta ? "bg-on-tertiary-container" : "bg-error"}`} />
        <span className="text-on-surface">
          {movimiento.tipo_tramite}: {movimiento.grupo.materia.nombre} ({claveGrupo(movimiento.grupo)})
        </span>
      </div>
      <span className={`shrink-0 font-mono ${alta ? "text-on-tertiary-container" : "text-error"}`}>
        {alta ? "Solicitud de Alta" : "Solicitud de Baja"}
      </span>
    </div>
  );
}

/**
 * Acuse oficial del folio (historial-acuse-card de stitch). Sin código de verificación: el folio lo identifica.
 * Al imprimir es lo único que sale en la hoja.
 */
export function Acuse({ solicitud, acciones }: { solicitud: Solicitud; acciones?: ReactNode }) {
  const { texto } = estadoFolio(solicitud);
  return (
    <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-xl bg-surface-container-lowest p-space-lg shadow-md print:max-w-none print:shadow-none">
      <div className="mb-space-md flex flex-col items-start justify-between gap-space-md border-b border-surface-container-high pb-space-md sm:flex-row sm:items-center">
        <div className="flex items-center gap-space-md">
          <img alt="Escudo Oficial UAE" className="h-12 w-auto object-contain drop-shadow-sm" src="/img/escudo-uae.png" />
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm font-bold text-primary">Acuse Oficial de Movimientos SABE</span>
            <span className="font-mono font-label-sm text-label-sm text-on-surface-variant">Unidad Académica de Economía • Control Escolar</span>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <span className="block font-mono text-label-sm text-on-surface-variant">FOLIO OFICIAL</span>
          <span className="font-mono text-headline-md font-bold text-primary-container">#{solicitud.folio_digital}</span>
          {solicitud.extemporanea && (
            <span className="block font-mono text-xs font-semibold text-secondary">Solicitud extemporánea</span>
          )}
        </div>
      </div>

      <div className="mb-space-md grid grid-cols-1 gap-space-sm rounded-xl bg-surface-container-low p-space-md font-body-sm text-body-sm sm:grid-cols-3 print:grid-cols-3">
        <div>
          <span className="block font-label-sm text-xs text-on-surface-variant">Estudiante:</span>
          <strong className="text-on-surface">{solicitud.estudiante.nombre}</strong>
          <span className="block font-mono text-[11px] text-on-surface-variant">Matrícula: {solicitud.estudiante.matricula}</span>
        </div>
        <div>
          <span className="block font-label-sm text-xs text-on-surface-variant">Carrera / Programa:</span>
          <strong className="text-on-surface">Licenciatura en {solicitud.estudiante.programa}</strong>
          <span className="block text-[11px] text-on-surface-variant">Ciclo {solicitud.ciclo}</span>
        </div>
        <div>
          <span className="block font-label-sm text-xs text-on-surface-variant">Fecha y Hora de Recepción:</span>
          <strong className="font-mono text-on-surface">{fechaLarga(solicitud.fecha_solicitud)}</strong>
          <span className="block text-[11px] font-bold text-secondary">Estado: {texto}</span>
        </div>
      </div>

      <div className="mb-space-md">
        <span className="mb-2 block font-label-md text-label-md font-bold text-primary">Detalle de Movimientos Solicitados:</span>
        <div className="space-y-2">
          {solicitud.movimientos.map((m) => (
            <FilaAcuse key={m.id} movimiento={m} />
          ))}
        </div>
      </div>

      {acciones && (
        <div className="flex flex-col items-center justify-between gap-space-sm border-t border-surface-container-high pt-space-sm sm:flex-row print:hidden">
          {acciones}
        </div>
      )}
    </div>
  );
}

/** Botón "Imprimir acuse" (D5: vista imprimible, sin PDF en el servidor). */
export function BotonImprimir({ className }: { className: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Simbolo nombre="print" className="text-[18px]!" />
      <span>Imprimir acuse</span>
    </button>
  );
}
