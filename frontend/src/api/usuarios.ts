// Usuarios y roles del administrador (F11) y restablecer contraseña desde un folio (control escolar).
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { FiltrosUsuarios, NuevoPersonal, PaginaUsuarios, Rol, UsuarioAdmin } from "./tipos";

export function consultaUsuarios(filtros: Partial<FiltrosUsuarios>): string {
  const params = new URLSearchParams();
  if (filtros.q) params.set("q", filtros.q);
  if (filtros.rol) params.set("rol", filtros.rol);
  if (filtros.estado) params.set("estado", filtros.estado);
  if (filtros.pagina && filtros.pagina > 1) params.set("pagina", String(filtros.pagina));
  return params.size ? `?${params}` : "";
}

export function useUsuarios(filtros: FiltrosUsuarios) {
  return useQuery({
    queryKey: ["usuarios", filtros],
    queryFn: () => api<PaginaUsuarios>(`/usuarios/${consultaUsuarios(filtros)}`),
    placeholderData: keepPreviousData,
  });
}

function useRefrescar() {
  const cliente = useQueryClient();
  return () => Promise.all([cliente.invalidateQueries({ queryKey: ["usuarios"] }), cliente.invalidateQueries({ queryKey: ["bitacora"] })]);
}

export function useCrearPersonal() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (datos: NuevoPersonal) =>
      api<{ usuario: UsuarioAdmin; password_temporal: string }>("/usuarios/", { method: "POST", body: datos }),
    onSuccess: refrescar,
  });
}

export function useCambiarUsuario() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: ({ id, ...cambio }: { id: number } & ({ rol: Rol } | { activo: boolean })) =>
      api<UsuarioAdmin>(`/usuarios/${id}/`, { method: "PATCH", body: cambio }),
    onSettled: refrescar,
  });
}

export function useReiniciarPassword() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (id: number) => api<{ password_temporal: string }>(`/usuarios/${id}/reiniciar-password/`, { method: "POST" }),
    onSuccess: refrescar,
  });
}

/** Control escolar: contraseña temporal para el alumno de un folio. */
export function useReiniciarPasswordAlumno() {
  return useMutation({
    mutationFn: (folio: number) =>
      api<{ password_temporal: string }>(`/solicitudes/${folio}/reiniciar-password/`, { method: "POST" }),
  });
}
