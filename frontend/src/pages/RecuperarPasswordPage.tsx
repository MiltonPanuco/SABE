// Diseño: stitch/sabe_recuperar_contrase_a_uan_uae (estados 1 y 2).
// El HTML de stitch usa la paleta de DESIGN.md pero su configuración de Tailwind no la incluye,
// por eso su screen.png sale sin degradado y con el botón blanco. Aquí se usa la paleta que pretende.
//
// Conflicto pendiente (D4 en docs/PLAN.md): el diseño envía un enlace por correo y tiene un
// paso 3 para crear la contraseña desde ese enlace. El backend todavía no envía correos, así que
// el estado 2 indica acudir a ventanilla en lugar de decir que se envió un enlace.
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CICLO, Simbolo, Spinner } from "../components/acceso";

const DIGITOS = 9;

export function RecuperarPasswordPage() {
  const [matricula, setMatricula] = useState("");
  const [error, setError] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const completa = matricula.length === DIGITOS;

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!completa) {
      setError(true);
      return;
    }
    setError(false);
    setEnviando(true);
    // Sin envío real todavía (D4); la pausa imita la respuesta del servidor del prototipo.
    setTimeout(() => {
      setEnviando(false);
      setEnviado(true);
    }, 600);
  }

  return (
    <main className="flex min-h-screen w-full flex-col overflow-x-hidden bg-slate-50 font-display text-slate-800 lg:flex-row">
      <div className="flex w-full flex-col">
        <div className="flex min-h-screen w-full flex-col lg:flex-row">
          {/* Columna izquierda institucional */}
          <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary-container p-12 text-on-primary lg:flex lg:w-1/2 xl:w-5/12">
            <div className="absolute inset-0 z-0">
              <div
                className="h-full w-full scale-105 transform bg-cover bg-center transition-transform duration-1000 ease-out hover:scale-100"
                style={{ backgroundImage: "url('/img/fachada-uae.png')" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary-container via-primary-container/90 to-primary-container/75 mix-blend-multiply" />
              <div className="absolute inset-0 bg-gradient-to-r from-primary-container via-primary-container/85 to-transparent" />
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-4">
                <div className="rounded-xl border border-white/10 bg-surface-container-lowest/10 p-2.5 shadow-lg backdrop-blur-md">
                  <img alt="Escudo Oficial Facultad de Economía UAE UAN" src="/img/escudo-uae.png" className="h-14 w-auto object-contain drop-shadow" />
                </div>
                <div>
                  <span className="mb-1 inline-block rounded-full bg-secondary-container px-2.5 py-0.5 text-label-sm font-semibold uppercase tracking-wider text-on-secondary-fixed">
                    Convocatoria {CICLO}
                  </span>
                  <h1 className="text-headline-md font-bold tracking-tight text-on-primary">Facultad de Economía</h1>
                  <p className="text-body-sm font-medium tracking-wide text-on-primary-container">Universidad Autónoma de Nayarit</p>
                </div>
              </div>
            </div>

            <div className="relative z-10 space-y-6 py-10">
              <div className="inline-flex items-center gap-2.5 rounded-full bg-white/10 px-3 py-1.5 text-label-md text-on-primary-container backdrop-blur-md">
                <Simbolo nombre="lock_reset" className="text-base text-secondary-container" />
                Ventanilla de Control Escolar - UAE
              </div>
              <blockquote className="space-y-2">
                <p className="text-display-lg font-bold leading-tight text-on-primary">Recuperación de credenciales de acceso.</p>
                <p className="text-body-md leading-relaxed text-on-primary-container">
                  El Sistema de Altas y Bajas de Economía (SABE) permite a la comunidad estudiantil gestionar sus unidades de aprendizaje
                  durante la Convocatoria {CICLO}.
                </p>
              </blockquote>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="rounded-xl bg-surface-container-lowest/10 p-4 backdrop-blur-md">
                  <div className="mb-1 flex items-center gap-2 text-secondary-fixed">
                    <Simbolo nombre="school" className="text-xl" />
                    <span className="text-label-md">Alumnos UAE</span>
                  </div>
                  <p className="text-body-sm text-on-primary-container">Acceso exclusivo con matrícula institucional asignada.</p>
                </div>
                <div className="rounded-xl bg-surface-container-lowest/10 p-4 backdrop-blur-md">
                  <div className="mb-1 flex items-center gap-2 text-secondary-fixed">
                    <Simbolo nombre="support_agent" className="text-xl" />
                    <span className="text-label-md">Atención Presencial</span>
                  </div>
                  <p className="text-body-sm text-on-primary-container">Ventanilla de Control Escolar en el Edificio A de la Facultad.</p>
                </div>
              </div>
            </div>

            <footer className="relative z-10 flex flex-col items-center justify-between gap-2 border-t border-white/10 pt-6 text-body-sm text-on-primary-container sm:flex-row">
              <span>© 2026 Universidad Autónoma de Nayarit</span>
              <span className="inline-flex items-center gap-1.5 text-label-sm">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-tertiary-fixed" />
                Plataforma Institucional SABE
              </span>
            </footer>
          </aside>

          {/* Columna derecha */}
          <div className="flex w-full flex-col justify-between bg-surface p-6 sm:p-10 lg:w-1/2 lg:p-14 xl:w-7/12">
            <div className="mb-6 flex items-center justify-between border-b border-surface-container-high pb-6 lg:hidden">
              <div className="flex items-center gap-3">
                <img alt="Logo UAE" src="/img/escudo-uae.png" className="h-10 w-auto object-contain" />
                <div>
                  <h2 className="text-label-lg font-bold text-primary">UAE • UAN</h2>
                  <p className="text-label-sm text-on-surface-variant">Convocatoria {CICLO}</p>
                </div>
              </div>
              <span className="rounded bg-secondary-container/20 px-2.5 py-1 text-label-sm font-bold text-secondary">SABE</span>
            </div>

            <section className="mx-auto my-auto w-full max-w-lg py-4">
              <div className="mb-8 text-center">
                <img alt="SABE" src="/img/sabe-logo.png" className="mx-auto mb-3 h-16 w-auto object-contain drop-shadow-sm sm:h-20" />
                <p className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">
                  Facultad de Economía • Universidad Autónoma de Nayarit
                </p>
              </div>

              {enviado ? (
                <article>
                  <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-8 shadow-xl sm:p-10">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-tertiary-fixed/30 shadow-sm">
                      <Simbolo nombre="support_agent" relleno className="text-4xl text-on-tertiary-container" />
                    </div>
                    <header className="mb-6 text-center">
                      <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-tertiary-fixed/20 px-3 py-1 text-label-sm font-semibold text-on-tertiary-container">
                        <Simbolo nombre="check_circle" className="text-sm" />
                        Petición Procesada
                      </span>
                      <h2 className="text-headline-lg font-bold tracking-tight text-on-surface">Acude a Control Escolar</h2>
                    </header>
                    <div className="mb-5 space-y-3 rounded-xl bg-surface-container p-4">
                      <p className="text-body-md leading-relaxed text-on-surface">
                        Por ahora el restablecimiento se hace en ventanilla: Control Escolar te asignará una contraseña temporal que
                        cambiarás al iniciar sesión.
                      </p>
                      <div className="inline-flex items-center gap-2 rounded-lg bg-surface-container-lowest px-3 py-1.5 text-on-surface shadow-sm">
                        <Simbolo nombre="account_circle" className="text-base text-primary" />
                        <span className="text-label-md">Matrícula indicada:</span>
                        <span className="font-bold tracking-wide text-primary">{matricula}</span>
                      </div>
                    </div>
                    <div className="mb-6 flex items-start gap-3 rounded-xl bg-secondary-fixed/30 p-4 text-on-secondary-fixed">
                      <Simbolo nombre="help" className="mt-0.5 shrink-0 text-2xl text-secondary-container" />
                      <div className="space-y-1">
                        <p className="text-label-md font-bold text-on-surface">Lleva tu credencial o una identificación oficial.</p>
                        <p className="text-body-sm text-on-surface-variant">
                          Atención en ventanilla de la Unidad Académica de Economía (Edificio A, Planta Baja), de lunes a viernes en
                          horario de 8:00 a 19:00 hrs.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-surface-container pt-4">
                      <button
                        type="button"
                        onClick={() => setEnviado(false)}
                        className="inline-flex items-center gap-1.5 text-label-md text-on-surface-variant transition-colors hover:text-on-surface"
                      >
                        <Simbolo nombre="replay" className="text-sm" />
                        Probar otra matrícula
                      </button>
                      <Link
                        to="/login"
                        className="inline-flex items-center gap-1 text-label-md font-semibold text-primary transition-colors hover:text-on-primary-fixed-variant"
                      >
                        Volver al inicio de sesión
                        <Simbolo nombre="login" className="text-sm" />
                      </Link>
                    </div>
                  </div>
                </article>
              ) : (
                <article>
                  <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-8 shadow-xl sm:p-10">
                    <header className="mb-6">
                      <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1 text-label-sm text-on-surface-variant">
                        <Simbolo nombre="key" className="text-sm text-primary" />
                        Paso 1 de 2: Solicitud
                      </span>
                      <h2 className="text-headline-lg font-bold tracking-tight text-on-surface">Recupera tu acceso</h2>
                      <p className="mt-2 text-body-md text-on-surface-variant">
                        Ingresa tu matrícula institucional de 9 dígitos para recibir las instrucciones de restablecimiento.
                      </p>
                    </header>

                    {error && (
                      <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl bg-error-container p-4 text-on-error-container">
                        <Simbolo nombre="error" className="mt-0.5 shrink-0 text-xl text-error" />
                        <div>
                          <p className="text-label-md font-bold">Matrícula no válida</p>
                          <p className="text-body-sm">
                            Asegúrate de ingresar exactamente 9 dígitos numéricos correspondientes a tu registro escolar.
                          </p>
                        </div>
                      </div>
                    )}

                    <form className="space-y-6" onSubmit={enviar} noValidate>
                      <div>
                        <label htmlFor="student-matricula" className="mb-2 block text-label-md font-semibold text-on-surface">
                          Matrícula Institucional
                        </label>
                        <div className="relative rounded-xl shadow-sm">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-outline">
                            <Simbolo nombre="badge" className="text-xl" />
                          </div>
                          <input
                            id="student-matricula"
                            inputMode="numeric"
                            autoComplete="username"
                            maxLength={DIGITOS}
                            placeholder="Ej. 210089334"
                            value={matricula}
                            onChange={(e) => {
                              const limpia = e.target.value.replace(/[^0-9]/g, "");
                              setMatricula(limpia);
                              if (limpia.length === DIGITOS) setError(false);
                            }}
                            autoFocus
                            className="block w-full rounded-xl bg-surface py-3 pl-11 pr-14 text-body-md text-on-surface shadow-inner transition-colors focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary-container/20"
                          />
                          <div
                            aria-hidden
                            className={`pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-label-sm ${
                              completa ? "text-on-tertiary-container" : "text-outline"
                            }`}
                          >
                            {matricula.length}/{DIGITOS}
                          </div>
                        </div>
                        <p className="mt-2 flex items-center gap-1.5 text-body-sm text-on-surface-variant">
                          <Simbolo nombre="info" className="text-sm text-secondary" />
                          <span>
                            Solo números. Ejemplo para estudiantes vigentes de Economía:{" "}
                            <span className="font-semibold text-primary">210089334</span>
                          </span>
                        </p>
                      </div>
                      <button
                        type="submit"
                        disabled={enviando}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container px-6 py-3.5 text-label-lg text-on-primary shadow-md transition-all duration-200 hover:bg-on-primary-fixed-variant hover:shadow-lg active:scale-[0.99] disabled:opacity-80"
                      >
                        {enviando ? (
                          <>
                            <Spinner className="-ml-1 mr-2 h-4 w-4 text-white" />
                            Procesando...
                          </>
                        ) : (
                          <>
                            <span>Continuar</span>
                            <Simbolo nombre="arrow_forward" className="text-base" />
                          </>
                        )}
                      </button>
                    </form>

                    <footer className="mt-8 border-t border-surface-container pt-6 text-center">
                      <Link
                        to="/login"
                        className="group inline-flex items-center gap-2 text-label-md font-semibold text-primary transition-colors hover:text-on-primary-fixed-variant"
                      >
                        <Simbolo nombre="arrow_back" className="text-base transition-transform group-hover:-translate-x-1" />
                        Volver a iniciar sesión
                      </Link>
                    </footer>
                  </div>
                </article>
              )}
            </section>

            <footer className="mt-8 border-t border-surface-container-high pt-6 text-center text-body-sm text-on-surface-variant">
              Convocatoria {CICLO} • Facultad de Economía • Universidad Autónoma de Nayarit
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}
