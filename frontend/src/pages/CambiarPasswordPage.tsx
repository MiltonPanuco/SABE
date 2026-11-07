// Diseño: stitch/sabe_cambio_obligatorio_de_contrase_a_uan_uae
import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { inicioPorRol, useAuth } from "../auth/AuthProvider";
import { AlertaAcceso, CampoAcceso, CICLO, Icono, Spinner } from "../components/acceso";

const MINIMO = 8;

// Misma regla que la barra de stitch. Solo orienta: quien decide es el servidor (validadores de Django).
function fuerza(password: string) {
  if (!password) return { ancho: "0%", barra: "bg-slate-300", texto: "Pendiente", color: "text-slate-500" };
  if (password.length < MINIMO) return { ancho: "33%", barra: "bg-red-500", texto: "Débil", color: "text-red-500" };
  const segura = password.length >= 10 && /\d/.test(password) && (/[A-Z]/.test(password) || /[^A-Za-z0-9]/.test(password));
  return segura
    ? { ancho: "100%", barra: "bg-emerald-500", texto: "Segura", color: "text-emerald-600" }
    : { ancho: "66%", barra: "bg-amber-500", texto: "Media", color: "text-amber-600" };
}

function Regla({ cumple, children }: { cumple: boolean; children: string }) {
  return (
    <div className={`flex items-center gap-2 transition-colors ${cumple ? "font-semibold text-emerald-600" : "font-medium text-slate-500"}`}>
      <span
        aria-hidden
        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
          cumple ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-600"
        }`}
      >
        {cumple ? "✓" : "✕"}
      </span>
      <span>{children}</span>
      <span className="sr-only">{cumple ? "(cumple)" : "(pendiente)"}</span>
    </div>
  );
}

export function CambiarPasswordPage() {
  const { usuario, recargarUsuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  // Validación local con los mismos mensajes que stitch (allá salen en alert()).
  const [aviso, setAviso] = useState<string | null>(null);
  const formulario = useRef<HTMLFormElement>(null);

  if (!usuario) return null;
  const obligatorio = usuario.debe_cambiar_password;
  const largoOk = nueva.length >= MINIMO;
  const coincide = nueva.length > 0 && nueva === confirmar;
  const medidor = fuerza(nueva);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!usuario) return;
    const enfocar = (nombre: string) => formulario.current?.querySelector<HTMLInputElement>(`[name="${nombre}"]`)?.focus();
    if (!actual.trim()) {
      setAviso(obligatorio ? "Por favor introduce tu contraseña actual temporal." : "Por favor introduce tu contraseña actual.");
      return enfocar("actual");
    }
    if (!largoOk) {
      setAviso(`La nueva contraseña debe contener al menos ${MINIMO} caracteres.`);
      return enfocar("nueva");
    }
    if (!coincide) {
      setAviso("Las contraseñas no coinciden. Por favor verifica.");
      return enfocar("confirmar");
    }
    setAviso(null);
    setError(null);
    setEnviando(true);
    try {
      await api("/auth/cambiar-password/", { method: "POST", body: { actual, nueva } });
      setExito(true);
      // Como en stitch: el aviso de éxito se ve un momento y luego entra al portal.
      await Promise.all([recargarUsuario(), new Promise((r) => setTimeout(r, 2800))]);
      navigate(inicioPorRol(usuario.rol), { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, null));
      setEnviando(false);
    }
  }

  const errorGeneral = aviso ?? (error && !error.campo("actual") && !error.campo("nueva") ? error.message : null);
  const identificador = usuario.estudiante?.matricula ?? usuario.username;

  return (
    <div className="flex min-h-screen flex-col bg-surface font-display text-slate-800 antialiased">
      <header className="z-20 flex w-full items-center justify-between border-b border-slate-200/80 bg-white px-4 py-2.5 text-xs font-medium md:px-8 md:text-sm">
        <div className="flex items-center space-x-2 text-slate-700">
          <span className="inline-block h-2 w-2 rounded-full bg-uan-gold" />
          <span className="font-bold uppercase tracking-wide text-uan-navy">
            {obligatorio ? "Cambio obligatorio de contraseña" : "Cambio de contraseña"} • UAN
          </span>
        </div>
      </header>

      <main className="grid min-h-[calc(100vh-45px)] flex-1 grid-cols-1 lg:grid-cols-12">
        {/* Columna izquierda institucional */}
        <section
          aria-label="Información Institucional"
          className="relative hidden min-h-[640px] flex-col justify-between overflow-hidden p-8 text-white lg:col-span-5 lg:flex xl:p-12"
        >
          <img alt="Fachada de la Facultad de Economía UAN" src="/img/fachada-uae.png" className="absolute inset-0 h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#002b49]/95 via-[#002b49]/80 to-[#001728]/95 backdrop-blur-[2px]" />

          <div className="relative z-10">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-white/95 p-2 shadow-lg shadow-black/20 ring-1 ring-white/30 backdrop-blur-md">
                <img alt="Escudo Oficial de la UAE Economía" src="/img/escudo-uae.png" className="h-14 w-12 object-contain" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-uan-gold">Ciclo Escolar {CICLO}</span>
                <h2 className="text-lg font-extrabold leading-tight tracking-tight text-white">Facultad de Economía</h2>
                <p className="text-xs font-medium text-slate-300">Universidad Autónoma de Nayarit</p>
              </div>
            </div>
            <div className="mt-8 rounded-2xl border border-white/20 bg-white/10 p-4 shadow-inner backdrop-blur-md">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg bg-uan-gold/20 p-2 text-uan-gold">
                  <Icono nombre="candado" className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Ventanilla de Control Escolar - Unidad Académica de Economía</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-200">
                    {obligatorio
                      ? `Primer inicio de sesión detectado. Actualización obligatoria de clave temporal asignada por Control Escolar para la Convocatoria ${CICLO}.`
                      : `Actualiza tu clave de acceso a SABE para la Convocatoria ${CICLO}.`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 my-8 space-y-4">
            <div>
              <h4 className="text-base font-bold tracking-tight text-white">Garantiza tu acceso para el proceso de altas y bajas</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-200">
                El Sistema de Altas y Bajas de Economía (SABE) es gestionado por Control Escolar para la Convocatoria {CICLO}.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md">
                <div className="mb-1.5 flex items-center gap-2">
                  <Icono nombre="edificio" className="h-4 w-4 text-uan-gold" grosor={2.2} />
                  <span className="text-xs font-semibold text-white">Control Escolar</span>
                </div>
                <p className="text-[11px] leading-snug text-slate-300">Ventanilla y soporte presencial en la Facultad.</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-md">
                <div className="mb-1.5 flex items-center gap-2">
                  <Icono nombre="escudo" className="h-4 w-4 text-emerald-400" grosor={2.2} />
                  <span className="text-xs font-semibold text-white">Acceso Oficial</span>
                </div>
                <p className="text-[11px] leading-snug text-slate-300">Gestión directa de cuentas para estudiantes autorizados.</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/20 pt-4 text-[11px] text-slate-300">
            <span>© 2026 Universidad Autónoma de Nayarit</span>
            <span className="font-medium text-white/90">Plataforma Institucional SABE</span>
          </div>
        </section>

        {/* Columna derecha: tarjeta del formulario */}
        <section
          aria-label="Formulario de actualización de contraseña"
          className="col-span-1 flex flex-col justify-between overflow-y-auto bg-[#f8f9ff] p-4 sm:p-8 lg:col-span-7 xl:p-12"
        >
          <div className="mx-auto my-auto w-full max-w-xl py-4">
            <div className="mb-6 text-center">
              <div className="mb-2 inline-flex items-center justify-center">
                <img alt="SABE" src="/img/sabe-logo.png" className="h-14 w-auto object-contain sm:h-16" />
              </div>
              <h1 className="mt-1 text-xs font-bold uppercase tracking-wider text-uan-navy sm:text-sm">
                Facultad de Economía • Universidad Autónoma de Nayarit
              </h1>
            </div>

            <div className="relative rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/70 sm:p-8">
              {obligatorio && (
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                    <svg className="h-3.5 w-3.5 text-amber-600" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                      <path
                        clipRule="evenodd"
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
                      />
                    </svg>
                    Paso Obligatorio • Seguridad de Acceso
                  </span>
                </div>
              )}
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                {obligatorio ? "Cambia tu contraseña temporal" : "Cambia tu contraseña"}
              </h2>

              {obligatorio && (
                <div className="mt-3 flex items-start gap-3 rounded-r-xl border-l-4 border-uan-gold bg-amber-50/90 p-3.5 text-amber-900">
                  <Icono nombre="advertencia" className="mt-0.5 h-5 w-5 flex-shrink-0 text-uan-gold" />
                  <p className="text-xs font-medium leading-relaxed sm:text-[13px]">
                    <strong className="font-bold">Es tu primer acceso.</strong> Debes crear una contraseña personal para continuar. Esta
                    clave será tu nuevo acceso oficial para altas, bajas y consulta de horario.
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-uan-navy">{usuario.estudiante ? "Matrícula:" : "Usuario:"}</span>
                  <span className="rounded border border-slate-200 bg-white px-2 py-0.5 font-mono font-semibold text-slate-800">
                    {identificador}
                  </span>
                </div>
                {usuario.estudiante && <div className="font-medium text-slate-500">Licenciatura en {usuario.estudiante.programa}</div>}
                <div className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-uan-gold">Convocatoria {CICLO}</div>
              </div>

              <form ref={formulario} className="mt-5 space-y-4" onSubmit={enviar} noValidate>
                {errorGeneral && <AlertaAcceso>{errorGeneral}</AlertaAcceso>}
                <CampoAcceso
                  tamano="normal"
                  etiqueta={obligatorio ? "Contraseña actual (temporal)" : "Contraseña actual"}
                  icono="llave"
                  type="password"
                  name="actual"
                  autoComplete="current-password"
                  placeholder={obligatorio ? "Ingresa la clave temporal entregada" : "Ingresa tu contraseña actual"}
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  error={error?.campo("actual")}
                  autoFocus
                />
                <div>
                  <CampoAcceso
                    tamano="normal"
                    etiqueta="Nueva contraseña"
                    icono="candado"
                    type="password"
                    name="nueva"
                    autoComplete="new-password"
                    placeholder="Define tu nueva clave personal"
                    value={nueva}
                    onChange={(e) => setNueva(e.target.value)}
                    error={error?.campo("nueva")}
                  />
                  <div className="mt-2">
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="font-medium text-slate-500">Seguridad de la clave:</span>
                      <span className={`font-bold ${medidor.color}`}>{medidor.texto}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full transition-[width,background-color] duration-300 ${medidor.barra}`}
                        style={{ width: medidor.ancho }}
                      />
                    </div>
                  </div>
                </div>
                <CampoAcceso
                  tamano="normal"
                  etiqueta="Confirmar contraseña"
                  icono="checkCirculo"
                  type="password"
                  name="confirmar"
                  autoComplete="new-password"
                  placeholder="Repite exactamente tu nueva contraseña"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                />

                <div className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-xs">
                  <Regla cumple={largoOk}>{`Mínimo ${MINIMO} caracteres`}</Regla>
                  <Regla cumple={coincide}>Coincide con la confirmación</Regla>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={enviando}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-uan-navy px-4 py-3 text-sm font-bold text-white shadow-lg shadow-uan-navy/20 transition duration-150 hover:bg-uan-navy-hover focus:ring-4 focus:ring-uan-navy/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>Guardar y continuar</span>
                    <Icono nombre="flecha" className="h-4 w-4" grosor={2.2} />
                  </button>
                </div>
              </form>

              <div className="mt-4 text-center">
                <p className="text-[11px] text-slate-400">Ventanilla de Control Escolar - Unidad Académica de Economía • Convocatoria {CICLO}</p>
                {/* No está en stitch (el diseño no permite salir del paso obligatorio). Ver conflictos en el PR. */}
                {obligatorio ? (
                  <button onClick={cerrarSesion} className="mt-2 text-[11px] font-semibold text-slate-500 hover:text-uan-navy hover:underline">
                    Cerrar sesión
                  </button>
                ) : (
                  <Link to={inicioPorRol(usuario.rol)} className="mt-2 inline-block text-[11px] font-semibold text-slate-500 hover:text-uan-navy hover:underline">
                    Cancelar y volver
                  </Link>
                )}
              </div>
            </div>
          </div>

          <footer className="mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
            <p>Convocatoria {CICLO} • Facultad de Economía, UAN • Ventanilla de Control Escolar</p>
          </footer>
        </section>
      </main>

      {exito && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="exito-titulo">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-2xl sm:p-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-8 ring-emerald-50">
              <Icono nombre="palomita" className="h-8 w-8" grosor={2.5} />
            </div>
            <h3 id="exito-titulo" className="mb-2 text-xl font-bold text-slate-900">
              ¡Contraseña actualizada con éxito!
            </h3>
            <p className="mb-6 text-xs text-slate-600 sm:text-sm">
              Tus nuevas credenciales han sido verificadas y registradas para la <strong className="text-uan-navy">Convocatoria {CICLO}</strong> por
              Control Escolar. Redirigiendo a tu portal institucional de altas y bajas...
            </p>
            <div className="flex items-center justify-center gap-3 text-xs font-semibold text-uan-navy">
              <Spinner className="h-5 w-5 text-uan-navy" />
              <span>Accediendo al módulo de Economía...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
