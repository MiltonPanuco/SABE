// Consultas del portal del estudiante (F3). Los datos se cachean con React Query.
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "./client";
import type { Grupo, HorarioEstudiante, PeriodoActivo } from "./tipos";

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

/** Oferta del periodo activo del programa del alumno, con cupo y choques. */
export function useGrupos() {
  return useQuery({ queryKey: ["grupos"], queryFn: () => api<Grupo[]>("/grupos/") });
}

/** Materias inscritas y movimientos en trámite del alumno. */
export function useMiHorario() {
  return useQuery({ queryKey: ["mi-horario"], queryFn: () => api<HorarioEstudiante>("/estudiante/horario/") });
}
