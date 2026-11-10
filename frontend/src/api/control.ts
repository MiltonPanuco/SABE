// Bandeja y dictamen (F6); periodo, convocatoria y oferta académica (F7) de control escolar.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  Docente,
  FiltrosBandeja,
  FiltrosOferta,
  Grupo,
  GrupoEscritura,
  Periodo,
  PeriodoEscritura,
  Programa,
  ResumenBandeja,
  Revision,
  Solicitud,
  UltimaModificacion,
} from "./tipos";

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

// ---------------------------------------------------------------------------
// Periodo y convocatoria (F7)
// ---------------------------------------------------------------------------

export function usePeriodos() {
  return useQuery({ queryKey: ["periodos"], queryFn: () => api<Periodo[]>("/periodos/") });
}

export function useUltimaModificacion() {
  return useQuery({
    queryKey: ["periodos", "ultima-modificacion"],
    queryFn: () => api<UltimaModificacion | null>("/periodos/ultima-modificacion/"),
  });
}

/** Cambiar el periodo activo cambia todo lo que depende de él: catálogo, oferta, bandeja y encabezado. */
function useRefrescarPeriodo() {
  const cliente = useQueryClient();
  return () =>
    Promise.all(
      ["periodos", "periodo-activo", "grupos", "solicitudes"].map((clave) =>
        cliente.invalidateQueries({ queryKey: [clave] }),
      ),
    );
}

export function useGuardarPeriodo() {
  const refrescar = useRefrescarPeriodo();
  return useMutation({
    mutationFn: ({ id, ...datos }: PeriodoEscritura & { id?: number }) =>
      api<Periodo>(id ? `/periodos/${id}/` : "/periodos/", { method: id ? "PATCH" : "POST", body: datos }),
    onSuccess: refrescar,
  });
}

export function useActivarPeriodo() {
  const refrescar = useRefrescarPeriodo();
  return useMutation({
    mutationFn: (id: number) => api<Periodo>(`/periodos/${id}/activar/`, { method: "POST" }),
    onSettled: refrescar,
  });
}

// ---------------------------------------------------------------------------
// Oferta académica (F7)
// ---------------------------------------------------------------------------

/** Toda la oferta del periodo activo, también los grupos ocultos. */
export function useOferta(filtros: FiltrosOferta) {
  const params = new URLSearchParams({ oferta: "1" });
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.programa) params.set("programa", filtros.programa);
  if (filtros.cupo) params.set("cupo", filtros.cupo);
  return useQuery({
    queryKey: ["grupos", "oferta", filtros],
    queryFn: () => api<Grupo[]>(`/grupos/?${params}`),
    placeholderData: keepPreviousData,
  });
}

/** Después de cambiar un grupo se vuelven a pedir la oferta, el catálogo y la bandeja (cupo y choques). */
function useRefrescarOferta() {
  const cliente = useQueryClient();
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: ["grupos"] }),
      cliente.invalidateQueries({ queryKey: ["solicitudes"] }),
    ]);
}

export function useGuardarGrupo() {
  const refrescar = useRefrescarOferta();
  return useMutation({
    mutationFn: ({ id, ...datos }: GrupoEscritura & { id?: number }) =>
      api<Grupo>(id ? `/grupos/${id}/` : "/grupos/", { method: id ? "PATCH" : "POST", body: datos }),
    onSuccess: refrescar,
  });
}

export function useVisibilidadGrupo() {
  const refrescar = useRefrescarOferta();
  return useMutation({
    mutationFn: ({ id, visible }: { id: number; visible: boolean }) =>
      api<Grupo>(`/grupos/${id}/`, { method: "PATCH", body: { visible } }),
    onSuccess: refrescar,
  });
}

export function useDocentes() {
  return useQuery({ queryKey: ["docentes"], queryFn: () => api<Docente[]>("/docentes/") });
}

export function useCrearDocente() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (datos: { nombre: string; grado_academico: string }) =>
      api<Docente>("/docentes/", { method: "POST", body: datos }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ["docentes"] }),
  });
}

export function useProgramas() {
  return useQuery({ queryKey: ["programas"], queryFn: () => api<Programa[]>("/programas/"), staleTime: Infinity });
}
