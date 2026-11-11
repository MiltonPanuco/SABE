import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { alExpirarSesion, api, ApiError, obtenerTokens, tokens } from "../api/client";
import type { Rol, Usuario } from "../api/tipos";

const CLAVE_ME = ["me"] as const;

interface Sesion {
  /** null = sin sesión; undefined = todavía no se sabe. */
  usuario: Usuario | null | undefined;
  cargando: boolean;
  error: Error | null;
  iniciarSesion: (username: string, password: string) => Promise<Usuario>;
  cerrarSesion: () => void;
  recargarUsuario: () => Promise<unknown>;
}

const SesionContext = createContext<Sesion | null>(null);

async function cargarUsuario(): Promise<Usuario | null> {
  if (!tokens.access()) return null;
  try {
    return await api<Usuario>("/me/");
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: CLAVE_ME,
    queryFn: cargarUsuario,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    alExpirarSesion(() => queryClient.setQueryData(CLAVE_ME, null));
  }, [queryClient]);

  const sesion: Sesion = {
    usuario: data,
    cargando: isPending,
    error,
    async iniciarSesion(username, password) {
      await obtenerTokens(username, password);
      const usuario = await api<Usuario>("/me/");
      queryClient.setQueryData(CLAVE_ME, usuario);
      return usuario;
    },
    cerrarSesion() {
      tokens.borrar();
      queryClient.clear();
      queryClient.setQueryData(CLAVE_ME, null);
    },
    recargarUsuario: refetch,
  };

  return <SesionContext.Provider value={sesion}>{children}</SesionContext.Provider>;
}

export function useAuth(): Sesion {
  const sesion = useContext(SesionContext);
  if (!sesion) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return sesion;
}

/** Ruta de inicio de cada rol. */
export function inicioPorRol(rol: Rol): string {
  return { estudiante: "/estudiante", control_escolar: "/control-escolar", administrador: "/administrador" }[rol];
}
