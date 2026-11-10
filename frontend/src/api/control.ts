// Bandeja y dictamen de control escolar (F6).
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { FiltrosBandeja, ResumenBandeja, Revision, Solicitud } from "./tipos";

/** Folios del periodo activo con los filtros de la bandeja. */
export function useBandeja(filtros: FiltrosBandeja) {
  const params = new URLSearchParams();
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.estado) params.set("estado", filtros.estado);
  if (filtros.tipo) params.set("extemporanea", filtros.tipo === "extemp" ? "true" : "false");
  const consulta = params.size ? `?${params}` : "";
  return useQuery({
    queryKey: ["solicitudes", "bandeja", filtros],
    queryFn: () => api<Solicitud[]>(`/solicitudes/${consulta}`),
    // Al escribir en el buscador la tabla no se vacía mientras llega la respuesta.
    placeholderData: keepPreviousData,
  });
}

export function useResumenBandeja() {
  return useQuery({ queryKey: ["solicitudes", "resumen"], queryFn: () => api<ResumenBandeja>("/solicitudes/resumen/") });
}

/** Qué impide aprobar cada movimiento pendiente del folio (cupo, choques, baja pendiente). */
export function useRevision(id: number) {
  return useQuery({
    queryKey: ["solicitudes", id, "revision"],
    queryFn: () => api<Revision>(`/solicitudes/${id}/revision/`),
    enabled: Number.isInteger(id) && id > 0,
  });
}

/** Después de dictaminar: el folio llega en la respuesta; la bandeja, el resumen y la revisión se vuelven a pedir. */
function useDictamen<T>(accion: string, cuerpo: (datos: T) => object) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ movimiento, ...datos }: { movimiento: number } & T) =>
      api<Solicitud>(`/movimientos/${movimiento}/${accion}/`, { method: "POST", body: cuerpo(datos as T) }),
    onSuccess: (folio) => cliente.setQueryData(["solicitudes", folio.id], folio),
    onSettled: () =>
      Promise.all([
        cliente.invalidateQueries({ queryKey: ["solicitudes"] }),
        cliente.invalidateQueries({ queryKey: ["grupos"] }),
      ]),
  });
}

export function useAprobar() {
  return useDictamen<{ visto_bueno: boolean }>("aprobar", ({ visto_bueno }) => ({ visto_bueno }));
}

export function useRechazar() {
  return useDictamen<{ motivo: string }>("rechazar", ({ motivo }) => ({ motivo }));
}
