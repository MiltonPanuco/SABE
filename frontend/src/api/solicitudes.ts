// Folios del estudiante (F5): enviar el carrito, consultar el historial y cancelar lo pendiente.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { MovimientoEntrada, Solicitud } from "./tipos";

/** Lo que cambia cuando se crea o cancela un folio: historial, horario, catálogo y validación del carrito. */
const AFECTADAS = [["solicitudes"], ["mi-horario"], ["grupos"], ["validar"]];

export function useSolicitudes() {
  return useQuery({ queryKey: ["solicitudes"], queryFn: () => api<Solicitud[]>("/solicitudes/") });
}

export function useSolicitud(id: number) {
  return useQuery({
    queryKey: ["solicitudes", id],
    queryFn: () => api<Solicitud>(`/solicitudes/${id}/`),
    enabled: Number.isInteger(id) && id > 0,
  });
}

function useRefrescar() {
  const cliente = useQueryClient();
  return () => Promise.all(AFECTADAS.map((queryKey) => cliente.invalidateQueries({ queryKey })));
}

export function useCrearSolicitud() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (datos: { justificacion: string; movimientos: MovimientoEntrada[] }) =>
      api<Solicitud>("/solicitudes/", { method: "POST", body: datos }),
    onSettled: refrescar,
  });
}

export function useCancelarSolicitud() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (id: number) => api<Solicitud>(`/solicitudes/${id}/cancelar/`, { method: "POST" }),
    onSettled: refrescar,
  });
}
