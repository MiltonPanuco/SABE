import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Rol } from "../api/tipos";
import { PantallaMensaje } from "../components/ui";
import { inicioPorRol, useAuth } from "./AuthProvider";

/**
 * Deja pasar solo con sesión iniciada y, si se indica, con alguno de los roles.
 * Con contraseña temporal, cualquier ruta lleva a /cambiar-password.
 * Un rol sin acceso vuelve a su propio inicio.
 */
export function RutaProtegida({ roles }: { roles?: Rol[] }) {
  const { usuario, cargando, error } = useAuth();
  const { pathname } = useLocation();

  if (cargando) return <PantallaMensaje>Cargando…</PantallaMensaje>;
  if (error) return <PantallaMensaje>{error.message}</PantallaMensaje>;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: pathname }} />;
  if (usuario.debe_cambiar_password && pathname !== "/cambiar-password") {
    return <Navigate to="/cambiar-password" replace />;
  }
  if (roles && !roles.includes(usuario.rol)) return <Navigate to={inicioPorRol(usuario.rol)} replace />;
  return <Outlet />;
}

/** "/" lleva al inicio del rol con sesión. */
export function RedirigirPorRol() {
  const { usuario } = useAuth();
  return <Navigate to={usuario ? inicioPorRol(usuario.rol) : "/login"} replace />;
}
