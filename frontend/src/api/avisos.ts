// Notificaciones de los dos portales y bitácora de auditoría (F10).
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  FiltrosBitacora,
  FiltrosNotificaciones,
  ListaNotificaciones,
  Notificacion,
  PaginaBitacora,
  ResumenOperativo,
} from "./tipos";

function consulta(valores: Record<string, string | number>): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(valores)) if (valor !== "" && valor !== 0) params.set(clave, String(valor));
  return params.size ? `?${params}` : "";
}

export function useNotificaciones(filtros: FiltrosNotificaciones) {
  return useQuery({
    queryKey: ["notificaciones", "lista", filtros],
    queryFn: () => api<ListaNotificaciones>(`/notificaciones/${consulta({ ...filtros })}`),
    placeholderData: keepPreviousData,
  });
}

/** Las 5 más recientes y el número de no leídas, para la campana. Se vuelve a pedir cada minuto. */
export function useCampana(activa = true) {
  return useQuery({
    queryKey: ["notificaciones", "campana"],
    queryFn: () => api<ListaNotificaciones>("/notificaciones/?limite=5"),
    refetchInterval: 60_000,
    enabled: activa,
  });
}

export function useLeer() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<Notificacion>(`/notificaciones/${id}/leer/`, { method: "POST" }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ["notificaciones"] }),
  });
}

export function useLeerTodas() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ marcadas: number }>("/notificaciones/leer-todas/", { method: "POST" }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ["notificaciones"] }),
  });
}

export function useResumenOperativo() {
  return useQuery({
    queryKey: ["notificaciones", "resumen-operativo"],
    queryFn: () => api<ResumenOperativo>("/notificaciones/resumen-operativo/"),
  });
}

export function rutaBitacora(filtros: FiltrosBitacora, extra: Record<string, string | number> = {}) {
  return consulta({ ...filtros, ...extra });
}

/** Bitácora filtrada, 50 registros por página ("Cargar más registros" pide la siguiente). */
export function useBitacora(filtros: FiltrosBitacora) {
  return useInfiniteQuery({
    queryKey: ["bitacora", filtros],
    queryFn: ({ pageParam }) => api<PaginaBitacora>(`/bitacora/${rutaBitacora(filtros, { pagina: pageParam })}`),
    initialPageParam: 1,
    getNextPageParam: (ultima) => (ultima.pagina < ultima.paginas ? ultima.pagina + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}
