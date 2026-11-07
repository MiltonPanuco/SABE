import { Link, Outlet, useNavigate } from "react-router-dom";
import { NOMBRE_ROL } from "../api/tipos";
import { inicioPorRol, useAuth } from "../auth/AuthProvider";

/** Marco de las pantallas con sesión: encabezado con usuario, rol y salida. */
export function Layout() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  if (!usuario) return null;

  const salir = () => {
    cerrarSesion();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-primary text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to={inicioPorRol(usuario.rol)} className="flex items-center gap-3">
            <span className="font-display text-xl font-bold">SABE</span>
            <span className="hidden h-5 w-px bg-white/30 sm:block" />
            <span className="hidden text-sm text-white/80 sm:block">{NOMBRE_ROL[usuario.rol]}</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-right leading-tight md:block">
              <span className="block font-semibold">
                {usuario.nombre} {usuario.apellidos}
              </span>
              <span className="text-xs text-white/70">{usuario.estudiante?.matricula ?? usuario.username}</span>
            </span>
            <Link to="/cambiar-password" className="text-white/80 hover:text-white hover:underline">
              Contraseña
            </Link>
            <button
              onClick={salir}
              className="rounded-lg bg-secondary-container px-3 py-1.5 font-semibold text-primary hover:brightness-95"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
