// Diseño: stitch/sabe_inicio_de_sesi_n_institucional_uan_uae
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import type { Usuario } from "../api/tipos";
import { inicioPorRol, useAuth } from "../auth/AuthProvider";
import { AlertaAcceso, CampoAcceso, CICLO, Icono, Spinner } from "../components/acceso";

// Iguales a los de `python manage.py seed_demo`. Solo se muestran en desarrollo o con VITE_ACCESOS_DEMO=1.
// Como en stitch, el botón solo llena los campos; el usuario presiona "Iniciar sesión".
const ACCESOS_DEMO = [
  { etiqueta: "Estudiante (primer acceso)", username: "230012345", password: "temporal" },
  { etiqueta: "Estudiante", username: "210089334", password: "demo1234" },
  { etiqueta: "Control Escolar", username: "valeria.ruiz", password: "demo1234" },
  // En el despliegue público el administrador tiene su propia contraseña (SABE_ADMIN_PASSWORD).
  ...(import.meta.env.DEV ? [{ etiqueta: "Administrador", username: "admin", password: "demo1234" }] : []),
];
const MOSTRAR_DEMO = import.meta.env.DEV || import.meta.env.VITE_ACCESOS_DEMO === "1";

const BENEFICIOS = [
  "Consulta en tiempo real de cupos y horarios",
  "Validación oficial por Control Escolar",
  "Comprobante digital inmediato de inscripción",
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

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password.trim()) {
      setError("Por favor ingresa tanto tu matrícula como tu contraseña.");
      return;
    }
    setEnviando(true);
    try {
      const sesion = await iniciarSesion(username.trim(), password);
      navigate(destino(sesion, desde), { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo iniciar sesión.");
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full flex-col overflow-x-hidden bg-slate-50 font-display text-slate-800 lg:flex-row">
      {/* Columna izquierda: fachada de la facultad con degradado institucional */}
      <section className="relative flex w-full flex-col justify-between overflow-hidden bg-uan-dark p-5 text-white sm:p-8 lg:w-[48%] xl:w-[46%] xl:p-14">
        <img
          alt="Fachada de la Unidad Académica de Economía - UAN"
          src="/img/fachada-uae.png"
          className="absolute inset-0 h-full w-full object-cover object-center contrast-105 saturate-110"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-uan-dark via-uan-navy/85 to-uan-navy/70 mix-blend-multiply" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-sky-900/40 via-transparent to-uan-dark/95" />

        <header className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="frost-glass h-12 w-12 rounded-xl bg-white/95 p-1.5 shadow-xl ring-2 ring-white/30 transition-transform duration-300 hover:scale-105 sm:h-16 sm:w-16 sm:rounded-2xl sm:p-2 xl:h-20 xl:w-20">
              <img alt="Escudo Unidad Académica de Economía" src="/img/escudo-uae.png" className="h-full w-full object-contain" />
            </div>
            <h2 className="text-sm font-bold leading-tight tracking-tight text-white sm:text-base xl:text-lg">
              Unidad Académica de Economía
            </h2>
          </div>
          <span className="frost-glass whitespace-nowrap rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold text-slate-200">
            Convocatoria {CICLO}
          </span>
        </header>

        <div className="relative z-10 my-auto max-w-xl py-4 sm:py-8 lg:py-10">
          <h1 className="text-2xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-3xl xl:text-4xl 2xl:text-5xl">
            Sistema de Altas y Bajas de Economía
          </h1>
          <p className="mt-4 max-w-md text-base font-light leading-relaxed text-slate-200 xl:text-lg">
            Altas y bajas de unidades de aprendizaje sin filas ni papeleo. Diseñado especialmente para la Unidad Académica de
            Economía
          </p>
          <ul className="mt-6 hidden space-y-3.5 text-sm font-medium text-slate-200/90 sm:block lg:mt-8">
            {BENEFICIOS.map((b) => (
              <li key={b} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-sky-400/40 bg-sky-500/20 text-sky-400">
                  ✓
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <footer className="relative z-10 hidden items-center justify-between border-t border-white/10 pt-5 text-xs text-slate-300 lg:flex">
          <p>© 2026 Unidad Académica de Economía • UAN</p>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
          </span>
        </footer>
      </section>

      {/* Columna derecha: formulario */}
      <section className="flex flex-1 flex-col justify-between overflow-y-auto bg-slate-50 p-4 sm:p-8 lg:p-12 xl:p-16">
        <div className="mx-auto my-auto w-full max-w-md py-4 sm:py-8">
          <div className="mb-8 text-center">
            <div className="inline-flex max-w-[220px] items-center justify-center rounded-2xl border border-slate-100/80 bg-white px-6 py-3.5 shadow-custom transition-shadow duration-300 hover:shadow-md">
              <img alt="SABE" src="/img/sabe-logo.png" className="mx-auto h-12 w-auto object-contain sm:h-14" />
            </div>
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">¡Bienvenido(a) a SABE!</h2>
            <p className="mt-2 text-sm leading-normal text-slate-500">
              Ingresa tu matrícula institucional y contraseña para acceder al sistema de selección de materias.
            </p>
          </div>

          <div className="relative rounded-2xl border border-slate-100 bg-white p-5 shadow-custom sm:p-8">
            {error && <AlertaAcceso>{error}</AlertaAcceso>}
            <form className="space-y-5" onSubmit={enviar} noValidate>
              <CampoAcceso
                etiqueta="Matrícula Institucional"
                icono="usuario"
                obligatorio
                ayuda="Número de control asignado por Servicios Escolares."
                autoComplete="username"
                placeholder="Ej. 210089334"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
              <CampoAcceso
                etiqueta="Contraseña"
                icono="candado"
                obligatorio
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="flex items-center justify-between pt-1">
                <div className="flex w-full justify-end">
                  <Link
                    to="/recuperar-password"
                    className="text-xs font-semibold text-sky-600 transition-colors hover:text-sky-700 hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              </div>
              <button
                type="submit"
                disabled={enviando}
                className="flex h-12 w-full transform cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-uan-navy px-4 text-base font-bold text-white shadow-lg shadow-uan-navy/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#003861] hover:shadow-xl hover:shadow-uan-navy/30 active:bg-[#002038] disabled:translate-y-0 disabled:opacity-80"
              >
                {enviando ? (
                  <>
                    <Spinner className="-ml-1 mr-2 h-4 w-4 text-white" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <span>Iniciar sesión</span>
                    <Icono nombre="entrar" className="h-4 w-4 text-sky-300" />
                  </>
                )}
              </button>
            </form>

            {MOSTRAR_DEMO && (
              <div className="mt-6 border-t border-slate-200 pt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Accesos de demostración</p>
                <div className="flex flex-wrap gap-2">
                  {ACCESOS_DEMO.map((a) => (
                    <button
                      key={a.etiqueta}
                      type="button"
                      onClick={() => {
                        setUsername(a.username);
                        setPassword(a.password);
                        setError(null);
                      }}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                    >
                      {a.etiqueta}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
            <a className="transition-colors hover:text-uan-navy" href="https://www.uan.edu.mx" rel="noopener noreferrer" target="_blank">
              Portal Institucional UAN
            </a>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400">Control Escolar Economía</span>
          </div>
        </div>

        <footer className="mt-auto border-t border-slate-200/60 pt-6 text-center text-xs text-slate-400">
          <p className="font-semibold text-slate-600">Convocatoria {CICLO}</p>
          <p className="mt-1 text-[11px] text-slate-400">Unidad Académica de Economía • Universidad Autónoma de Nayarit (UAN)</p>
        </footer>
      </section>
    </main>
  );
}
