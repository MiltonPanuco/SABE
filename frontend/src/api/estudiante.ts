// Consultas del portal del estudiante (F3 y F4). Los datos se cachean con React Query.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "./client";
import type { Grupo, HorarioEstudiante, MovimientoEntrada, PeriodoActivo, Validacion } from "./tipos";

/** Periodo activo, o null si control escolar no ha activado ninguno. */
export function usePeriodoActivo() {
  return useQuery({
    queryKey: ["periodo-activo"],
    queryFn: async () => {
      try {
        return await api<PeriodoActivo>("/periodos/activo/");
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      }
    },
    staleTime: 60 * 1000,
  });
}

function ids(movimientos: MovimientoEntrada[], tipo: MovimientoEntrada["tipo"]): number[] {
  return movimientos
    .filter((m) => m.tipo === tipo)
    .map((m) => m.grupo)
    .sort((a, b) => a - b);
}

/**
 * Oferta del periodo activo del programa del alumno, con cupo, choques y errores calculados
 * como si el carrito ya se hubiera pedido (sus bajas liberan horario, sus altas lo ocupan).
 */
export function useGrupos(carrito: MovimientoEntrada[] = []) {
  const altas = ids(carrito, "ALTA");
  const bajas = ids(carrito, "BAJA");
  const params = new URLSearchParams();
  if (altas.length) params.set("altas", altas.join(","));
  if (bajas.length) params.set("bajas", bajas.join(","));
  const consulta = params.size ? `?${params}` : "";
  return useQuery({
    queryKey: ["grupos", altas, bajas],
    queryFn: () => api<Grupo[]>(`/grupos/${consulta}`),
    // Mientras llega la respuesta con el carrito nuevo, las tarjetas no parpadean.
    placeholderData: keepPreviousData,
  });
}

/** Materias inscritas y movimientos en trámite del alumno. */
export function useMiHorario() {
  return useQuery({ queryKey: ["mi-horario"], queryFn: () => api<HorarioEstudiante>("/estudiante/horario/") });
}

/** Choques y errores de cada movimiento del carrito, validados en el backend. */
export function useValidarCarrito(movimientos: MovimientoEntrada[]) {
  return useQuery({
    queryKey: ["validar", movimientos],
    queryFn: () => api<Validacion>("/solicitudes/validar/", { method: "POST", body: { movimientos } }),
    enabled: movimientos.length > 0,
    placeholderData: keepPreviousData,
  });
}
