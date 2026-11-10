// Etiqueta y color del estado de un folio en la bandeja (CHIP y LABEL de stitch/sabe_solicitudes_control_escolar).
import type { EstadoBandeja } from "../api/tipos";

export const ESTADO_BANDEJA: Record<EstadoBandeja, { texto: string; chip: string }> = {
  pendiente: { texto: "Pendiente", chip: "bg-secondary-fixed text-on-secondary-fixed" },
  parcial: { texto: "Parcialmente dictaminado", chip: "bg-primary-fixed text-on-primary-fixed" },
  dictaminada: { texto: "Dictaminada", chip: "bg-tertiary-fixed text-on-tertiary-fixed" },
  rechazada: { texto: "Rechazada", chip: "bg-error-container text-on-error-container" },
  // Stitch no tiene folios cancelados; solo se ven con el filtro ?estado=cancelada o desde un enlace.
  cancelada: { texto: "Cancelada", chip: "bg-surface-container-high text-on-surface-variant" },
};

export function porRevisar(estado: EstadoBandeja): boolean {
  return estado === "pendiente" || estado === "parcial";
}
