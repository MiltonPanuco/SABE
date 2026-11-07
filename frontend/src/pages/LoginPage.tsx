import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import type { Usuario } from "../api/tipos";
import { inicioPorRol, useAuth } from "../auth/AuthProvider";
import { Aviso, Boton, Campo } from "../components/ui";

// Iguales a los de `python manage.py seed_demo`. Solo se muestran en desarrollo o con VITE_ACCESOS_DEMO=1.
const ACCESOS_DEMO = [
  { etiqueta: "Estudiante", username: "210089334", password: "demo1234" },
  { etiqueta: "Estudiante (primer acceso)", username: "230012345", password: "temporal" },
  { etiqueta: "Control Escolar", username: "valeria.ruiz", password: "demo1234" },
  { etiqueta: "Administrador", username: "admin", password: "demo1234" },
];
const MOSTRAR_DEMO = import.meta.env.DEV || import.meta.env.VITE_ACCESOS_DEMO === "1";

const BENEFICIOS = [
  "Consulta en tiempo real de cupos y horarios",
  "Validación oficial por Control Escolar",
  "Comprobante digital inmediato de tu solicitud",
];

function destino(usuario: Usuario, desde: string | undefined) {
  if (usuario.debe_cambiar_password) return "/cambiar-password";
  return desde && desde !== "/" ? desde : inicioPorRol(usuario.rol);
}

export function LoginPage() {
  const { usuario, iniciarSesion } = useAuth();
  const navigate = useNavigate();
  const desde = (useLocation().state as { desde?: string } | null)?.desde;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario && !enviando) return <Navigate to={destino(usuario, desde)} replace />;

  async function entrar(u: string, p: string) {
    setError(null);
    if (!u.trim() || !p) {
      setError("Escribe tu matrícula y tu contraseña.");
      return;
    }
    setEnviando(true);
    try {
      const sesion = await iniciarSesion(u.trim(), p);
      navigate(destino(sesion, desde), { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo iniciar sesión.");
      setEnviando(false);
    }
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    void entrar(username, password);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-primary p-12 text-white lg:flex">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-secondary">
            Unidad Académica de Economía
          </p>
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight">Sistema de Altas y Bajas de Economía</h1>
          <p className="mt-4 max-w-md text-white/80">Altas y bajas de unidades de aprendizaje sin filas ni papeleo.</p>
          <ul className="mt-10 space-y-3">
            {BENEFICIOS.map((b) => (
              <li key={b} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-alta text-xs font-bold">✓</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/60">© 2026 Unidad Académica de Economía • UAN</p>
      </section>

      <section className="flex flex-col justify-center px-4 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <p className="font-display text-3xl font-bold text-primary lg:hidden">SABE</p>
          <h2 className="mt-2 font-display text-2xl font-bold text-slate-900">¡Bienvenido(a) a SABE!</h2>
          <p className="mt-1 text-sm text-slate-600">Ingresa tu matrícula y contraseña para acceder.</p>

          <form onSubmit={enviar} className="mt-8 flex flex-col gap-5" noValidate>
            {error && <Aviso>{error}</Aviso>}
            <Campo
              etiqueta="Matrícula"
              ayuda="Personal de Control Escolar: usa tu usuario."
              autoComplete="username"
              inputMode="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
            <div className="flex flex-col gap-2">
              <Campo
                etiqueta="Contraseña"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Link to="/recuperar-password" className="self-end text-sm font-semibold text-primary hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <Boton type="submit" cargando={enviando} className="w-full">
              Iniciar sesión
            </Boton>
          </form>

          {MOSTRAR_DEMO && (
            <div className="mt-8 rounded-xl border border-dashed border-slate-300 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accesos de demostración</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ACCESOS_DEMO.map((a) => (
                  <Boton
                    key={a.username}
                    variante="secundario"
                    disabled={enviando}
                    onClick={() => {
                      setUsername(a.username);
                      setPassword(a.password);
                      void entrar(a.username, a.password);
                    }}
                  >
                    {a.etiqueta}
                  </Boton>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
