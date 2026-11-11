// Contenido de stitch/sabe_convocatoria_cerrada_solicitud_extempor_nea_estudiante dentro del marco del portal:
// aviso de cierre y solicitud extemporánea. Antes de que abra la convocatoria, el mismo aviso sin formulario.
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMiHorario } from "../api/estudiante";
import { useSolicitudes } from "../api/solicitudes";
import type { PeriodoActivo, Solicitud } from "../api/tipos";
import { useAuth } from "../auth/AuthProvider";
import { Simbolo, Spinner } from "../components/acceso";
import { useEnviarCarrito } from "./enviar";
import { ChipEstadoFolio, resolucionFolio } from "./folio";
import { fechaEnTexto, fechaModulo, horarioTexto, problemasDe } from "./formato";

const MINIMO = 100;
const MAXIMO = 500;

export function ConvocatoriaCerrada({ periodo, modo }: { periodo: PeriodoActivo; modo: "cerrada" | "no_abre" }) {
  const [vista, setVista] = useState<"aviso" | "formulario">("aviso");
  const [historial, setHistorial] = useState(false);
  const [enviado, setEnviado] = useState<Solicitud | null>(null);
  const cerrada = modo === "cerrada";

  return (
    <div className="flex w-full flex-col">
      <div className="mb-6 flex w-full flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center rounded-xl bg-surface-container p-2.5 shadow-sm">
            <Simbolo nombre="pending_actions" className="text-2xl! text-primary" />
          </div>
          <div>
            <span className="font-label-sm text-label-sm text-outline">Ciclo Escolar {periodo.ciclo} • Facultad de Economía</span>
            <h1 className="mt-0.5 font-headline-lg text-headline-lg text-primary">
              {cerrada ? "Convocatoria cerrada" : "Convocatoria por abrir"}
            </h1>
          </div>
        </div>
        {cerrada && (
          <div className="inline-flex self-start rounded-xl bg-surface-container-low p-1.5 shadow-sm md:self-auto">
            <Pestana activa={vista === "aviso"} icono="event_busy" onClick={() => setVista("aviso")}>
              Aviso de Cierre
            </Pestana>
            <Pestana activa={vista === "formulario"} icono="edit_document" onClick={() => setVista("formulario")} punto>
              Solicitud Extemporánea
            </Pestana>
          </div>
        )}
      </div>

      {vista === "aviso" || !cerrada ? (
        <Aviso periodo={periodo} cerrada={cerrada} solicitar={() => setVista("formulario")} verHistorial={() => setHistorial(true)} />
      ) : (
        <FormularioExtemporaneo periodo={periodo} volver={() => setVista("aviso")} enviado={setEnviado} />
      )}

      {enviado && <Exito solicitud={enviado} />}
      {historial && <HistorialPrevio cerrar={() => setHistorial(false)} />}
    </div>
  );
}

function Pestana({ activa, icono, onClick, punto = false, children }: { activa: boolean; icono: string; onClick: () => void; punto?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 font-label-lg text-label-lg transition-all duration-200 ${
        activa ? "bg-primary-container text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
      }`}
    >
      <Simbolo nombre={icono} className="text-[18px]!" />
      <span>{children}</span>
      {punto && <span className="h-2 w-2 rounded-full bg-secondary-container" />}
    </button>
  );
}

function Aviso({ periodo, cerrada, solicitar, verHistorial }: { periodo: PeriodoActivo; cerrada: boolean; solicitar: () => void; verHistorial: () => void }) {
  const { usuario } = useAuth();
  const { data: horario } = useMiHorario();
  const perfil = usuario?.estudiante;
  const ciclo = periodo.ciclo;
  const fechaModulos = cerrada ? `Cerrado el ${fechaModulo(periodo.convocatoria_fin)}` : `Abre el ${fechaModulo(periodo.convocatoria_inicio)}`;
  const inscritas = horario?.inscritas.length;

  return (
    <section className="w-full space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-surface-container-lowest p-6 shadow-md md:p-8">
        <div className="pointer-events-none absolute -top-8 -right-8 h-64 w-64 rounded-full bg-secondary-fixed/20 blur-3xl" />
        <div className="pointer-events-none absolute right-6 bottom-4 hidden opacity-5 lg:block">
          <img alt="Escudo UAE" className="h-48 w-48 object-contain" src="/img/escudo-uae.png" />
        </div>
        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex max-w-3xl items-start gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-secondary-fixed/60 text-secondary shadow-sm">
              <Simbolo nombre={cerrada ? "hourglass_disabled" : "hourglass_top"} className="text-3xl!" />
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2.5">
                <span className="flex items-center gap-1.5 rounded-full bg-error-container px-3 py-0.5 font-label-sm text-label-sm font-bold text-on-error-container">
                  <span className="h-1.5 w-1.5 rounded-full bg-error" />
                  Convocatoria {ciclo}
                </span>
                <span className="font-label-sm text-label-sm text-outline">
                  {cerrada ? "Límite oficial de registro rebasado" : "Registro aún no disponible"}
                </span>
              </div>
              <p className="font-headline-sm text-headline-sm leading-snug font-bold text-primary">
                {cerrada
                  ? `La convocatoria ${ciclo} cerró el ${fechaEnTexto(periodo.convocatoria_fin)}. Aún puedes enviar una solicitud extemporánea; requiere visto bueno de Control Escolar.`
                  : `La convocatoria ${ciclo} abre el ${fechaEnTexto(periodo.convocatoria_inicio)}. Mientras tanto puedes revisar el catálogo y preparar tu carrito.`}
              </p>
              <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
                {cerrada
                  ? "El registro regular en línea ha concluido. Puedes registrar una petición extemporánea que quedará sujeta a validación y visto bueno de Control Escolar."
                  : "El envío de solicitudes se habilita en la fecha de apertura. Tu carrito se conserva mientras tengas la sesión abierta."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
            {cerrada ? (
              <button
                type="button"
                onClick={solicitar}
                className="flex cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-primary px-6 py-3.5 font-label-lg text-label-lg text-on-primary shadow-md transition-all hover:scale-[1.02] hover:bg-primary-container active:scale-[0.98]"
              >
                <Simbolo nombre="post_add" className="text-secondary-fixed-dim" />
                <span>Solicitar de forma extemporánea</span>
                <Simbolo nombre="arrow_forward" className="text-sm!" />
              </button>
            ) : (
              <Link
                to="/estudiante/catalogo"
                className="flex cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-primary px-6 py-3.5 font-label-lg text-label-lg text-on-primary shadow-md transition-all hover:bg-primary-container"
              >
                <Simbolo nombre="post_add" className="text-secondary-fixed-dim" />
                <span>Ir al catálogo</span>
                <Simbolo nombre="arrow_forward" className="text-sm!" />
              </Link>
            )}
            <button
              type="button"
              onClick={verHistorial}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-surface-container px-5 py-3 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container-high"
            >
              <Simbolo nombre="folder_shared" className="text-[18px]!" />
              <span>Ver folios anteriores</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Ficha del estudiante */}
        <div className="flex flex-col justify-between rounded-2xl bg-surface-container-lowest p-6 shadow-sm lg:col-span-5">
          <div>
            <div className="flex items-center justify-between pb-4">
              <span className="font-label-sm text-label-sm tracking-wider text-outline uppercase">Ficha del Estudiante</span>
              <span className="rounded-full bg-surface-container-high px-2.5 py-1 font-label-sm text-label-sm font-semibold text-primary">
                Semestre Activo
              </span>
            </div>
            <div className="mt-2 flex items-center gap-4">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-container text-primary-fixed shadow-inner">
                  <Simbolo nombre="school" className="text-3xl!" />
                </div>
                <div className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-tertiary-container text-tertiary-fixed">
                  <Simbolo nombre="check" className="text-[12px]! font-bold" />
                </div>
              </div>
              <div>
                <h2 className="font-headline-sm text-headline-sm font-bold text-primary">
                  {usuario?.nombre} {usuario?.apellidos}
                </h2>
                <p className="font-body-md text-body-md font-medium text-on-surface-variant">Matrícula: {perfil?.matricula ?? usuario?.username}</p>
                {perfil && <p className="font-body-sm text-body-sm text-outline">Licenciatura en {perfil.programa}</p>}
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface-container-low p-3.5">
                <span className="block font-label-sm text-label-sm text-outline">Semestre de Avance</span>
                <span className="mt-0.5 block font-headline-md text-headline-md font-bold text-primary">
                  {perfil ? `${perfil.semestre}° Semestre` : "—"}
                </span>
              </div>
              <div className="rounded-xl bg-surface-container-low p-3.5">
                <span className="block font-label-sm text-label-sm text-outline">Carga Inscrita Actual</span>
                <span className="mt-0.5 block font-headline-md text-headline-md font-bold text-primary">
                  {inscritas === undefined ? "—" : `${inscritas} ${inscritas === 1 ? "Asignatura" : "Asignaturas"}`}
                </span>
                <span className="mt-1 block font-body-sm text-body-sm text-outline">Horario registrado</span>
              </div>
            </div>
          </div>
          <div className="-mx-6 mt-6 -mb-6 flex items-center justify-between rounded-b-2xl bg-surface-container-low/60 p-6 pt-4">
            <div className="flex items-center gap-2">
              <Simbolo nombre="school" className="text-lg! text-outline" />
              <span className="font-label-sm text-label-sm text-outline">Unidad Académica de Economía • UAN</span>
            </div>
            <span className="font-label-sm text-label-sm font-bold text-primary">Ciclo {ciclo}</span>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-7">
          {/* Estado de módulos */}
          <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                  <Simbolo nombre="lock_clock" className="text-[20px]!" />
                </div>
                <h3 className="font-headline-sm text-headline-sm font-semibold text-primary">Estado de Módulos - Convocatoria {ciclo}</h3>
              </div>
              <span className="shrink-0 rounded-md bg-error-container/40 px-2.5 py-1 font-label-sm text-label-sm font-bold text-error">
                Bloqueado por Calendario
              </span>
            </div>
            <div className="space-y-3">
              <Modulo icono="add_circle" titulo="Módulo de Altas" texto={fechaModulos} />
              <Modulo icono="remove_circle" titulo="Módulo de Bajas" texto={fechaModulos} />
              {cerrada ? (
                <div className="flex items-center justify-between rounded-xl bg-secondary-fixed/20 p-3">
                  <div className="flex items-center gap-3">
                    <Simbolo nombre="assignment_late" className="text-secondary" />
                    <div>
                      <span className="block font-label-lg text-label-lg leading-tight font-bold text-primary">Módulo de Petición Extemporánea</span>
                      <span className="font-body-sm text-body-sm font-medium text-secondary">Habilitado con dictamen de Control Escolar</span>
                    </div>
                  </div>
                  <span className="rounded-full bg-secondary-fixed/70 px-2.5 py-1 font-label-sm text-label-sm font-bold text-secondary">Disponible</span>
                </div>
              ) : (
                <Modulo icono="assignment_late" titulo="Módulo de Petición Extemporánea" texto="Disponible al cierre de la convocatoria" />
              )}
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-2xl bg-surface-container-high/60 p-5">
            <Simbolo nombre="verified_user" className="mt-0.5 text-2xl! text-primary" />
            <div>
              <span className="mb-1 block font-label-md text-label-md font-bold text-primary">Aviso de Control Escolar</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Toda solicitud extemporánea queda sujeta a revisión y visto bueno de Control Escolar según la disponibilidad de cupos y
                horarios para el ciclo {ciclo}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Modulo({ icono, titulo, texto }: { icono: string; titulo: string; texto: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-container-low p-3 opacity-75">
      <div className="flex items-center gap-3">
        <Simbolo nombre={icono} className="text-outline" />
        <div>
          <span className="block font-label-lg text-label-lg leading-tight text-primary">{titulo}</span>
          <span className="font-body-sm text-body-sm text-outline">{texto}</span>
        </div>
      </div>
      <span className="rounded bg-surface-container px-2 py-1 font-label-sm text-label-sm font-bold text-outline uppercase">Inactivo</span>
    </div>
  );
}

function FormularioExtemporaneo({ periodo, volver, enviado }: { periodo: PeriodoActivo; volver: () => void; enviado: (s: Solicitud) => void }) {
  const envio = useEnviarCarrito();
  const [justificacion, setJustificacion] = useState("");
  const [acepta, setAcepta] = useState(false);
  const largo = justificacion.trim().length;
  const puedeEnviar =
    envio.items.length > 0 && largo >= MINIMO && acepta && !envio.revisando && !envio.invalido && !envio.enviando;

  return (
    <section className="w-full space-y-6">
      <div className="rounded-2xl bg-surface-container-lowest p-6 shadow-sm md:p-8">
        <div className="flex flex-col justify-between gap-4 pb-6 md:flex-row md:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={volver}
                className="inline-flex cursor-pointer items-center gap-1 font-label-sm text-label-sm text-outline transition-colors hover:text-primary"
              >
                <Simbolo nombre="arrow_back" className="text-base!" /> Volver al aviso general
              </button>
              <span className="text-outline-variant">•</span>
              <span className="font-label-sm text-label-sm text-outline">Unidad Académica de Economía</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-headline-lg text-headline-lg font-bold text-primary">Confirmación de Solicitud Extemporánea</h2>
              <span className="flex items-center gap-1.5 rounded-full bg-secondary-fixed px-3 py-1 font-label-md text-label-md font-bold text-secondary shadow-sm">
                <Simbolo nombre="priority_high" className="text-[16px]!" /> Extemporáneo
              </span>
            </div>
            <p className="mt-1.5 font-body-md text-body-md text-on-surface-variant">
              Revisa a detalle la modificación solicitada. Completa la justificación formal antes de remitir el expediente a Control Escolar.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4 rounded-xl bg-surface-container-low px-4 py-3">
            <img alt="Escudo UAE" className="h-12 w-auto object-contain" src="/img/escudo-uae.png" />
            <div className="h-8 w-px bg-outline-variant" />
            <div>
              <span className="block font-label-sm text-label-sm text-outline">Folio de Trámite</span>
              <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-primary">Se asigna al enviar</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-label-md text-label-md font-bold tracking-wider text-outline uppercase">
              Resumen de Movimientos Propuestos ({envio.items.length})
            </span>
            <span className="font-label-sm text-label-sm text-outline">Ajuste de materias para la Convocatoria {periodo.ciclo}</span>
          </div>
          {envio.items.length === 0 && (
            <div className="rounded-xl bg-surface-container-low p-4 text-center font-body-sm text-body-sm text-on-surface-variant">
              No has seleccionado movimientos.{" "}
              <Link to="/estudiante/catalogo" className="font-semibold text-primary-container hover:underline">
                Agrega altas desde el catálogo o bajas desde tu horario.
              </Link>
            </div>
          )}
          {envio.items.map(({ grupo, tipo }) => {
            const alta = tipo === "ALTA";
            const problemas = problemasDe(envio.resultados.get(grupo.id));
            return (
              <div
                key={grupo.id}
                className={`flex flex-col justify-between gap-4 rounded-xl p-4 shadow-sm transition-colors md:flex-row md:items-center md:p-5 ${
                  problemas.length ? "border border-error bg-error-container/20" : "bg-surface-container-low hover:bg-surface-container"
                }`}
              >
                <div className="flex items-start gap-4">
                  <span
                    className={`mt-0.5 flex items-center gap-1 self-start rounded-lg px-3 py-1 font-label-sm text-label-sm font-bold ${
                      alta ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-error-container text-on-error-container"
                    }`}
                  >
                    <Simbolo nombre={alta ? "add_task" : "do_not_disturb_on"} className="text-[16px]!" /> {tipo}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-headline-sm text-headline-sm font-bold text-primary">{grupo.materia.nombre}</span>
                      <span className="rounded bg-surface-container-high px-2 py-0.5 font-label-sm text-label-sm text-outline">Gpo. {grupo.num_grupo}</span>
                    </div>
                    <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">Docente: {grupo.docente}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 font-label-sm text-label-sm text-outline">
                      <span className="flex items-center gap-1">
                        <Simbolo nombre="schedule" className="text-[14px]!" /> {horarioTexto(grupo.horarios)}
                      </span>
                      <span>•</span>
                      {alta ? (
                        <span className="font-semibold text-on-tertiary-container">Cupo disponible: {Math.max(grupo.cupo_disponible, 0)} lugares</span>
                      ) : (
                        <span className="font-medium text-error">Asignatura inscrita</span>
                      )}
                    </div>
                    {problemas.map((texto) => (
                      <span key={texto} className="mt-1 flex items-start gap-1 text-[11px] leading-snug font-semibold text-error">
                        <Simbolo nombre="block" className="mt-px text-[13px]!" /> {texto}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-4 md:justify-end">
                  <span
                    className={`rounded-lg px-3 py-1.5 font-label-md text-label-md font-bold ${
                      alta ? "bg-primary-fixed text-on-primary-fixed" : "bg-surface-container-highest text-on-surface-variant"
                    }`}
                  >
                    {alta ? "Asignatura a dar de alta" : "Asignatura a dar de baja"}
                  </span>
                  <button
                    type="button"
                    onClick={() => envio.quitar(grupo.id)}
                    title="Quitar del carrito"
                    className="cursor-pointer p-1 text-on-surface-variant hover:text-error"
                  >
                    <Simbolo nombre="delete" className="text-[18px]!" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-6 rounded-2xl bg-surface-container-lowest p-6 shadow-sm md:p-8">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 font-headline-sm text-headline-sm font-bold text-primary" htmlFor="justificacion-extemporanea">
              <span>Justificación Reforzada Obligatoria</span>
              <span className="text-base text-error">*</span>
            </label>
            <span className="font-label-sm text-label-sm text-outline">
              {justificacion.length} / {MAXIMO} caracteres (mínimo {MINIMO})
            </span>
          </div>
          <p className="mb-3 font-body-md text-body-md text-on-surface-variant">
            Explica el motivo por el cual solicitas este ajuste en la Convocatoria {periodo.ciclo}. Especifica razones de horario, laborales o
            académicas respaldadas con comprobante si aplica.
          </p>
          <textarea
            id="justificacion-extemporanea"
            rows={6}
            maxLength={MAXIMO}
            value={justificacion}
            onChange={(e) => setJustificacion(e.target.value)}
            placeholder="Describe detalladamente la causa extemporánea..."
            className="w-full resize-y rounded-xl bg-surface-container-low p-4 font-body-md text-body-md text-on-surface shadow-inner transition-all placeholder:text-outline focus:ring-2 focus:ring-primary focus:outline-none"
          />
          {envio.errorJustificacion ? (
            <p className="mt-2 text-xs font-semibold text-error">{envio.errorJustificacion}</p>
          ) : (
            largo < MINIMO && (
              <div className="mt-2 flex items-center gap-1.5 font-label-sm text-label-sm text-secondary">
                <Simbolo nombre="info" className="text-[16px]!" />
                <span>Se requieren al menos {MINIMO} caracteres fundamentados para remitir a Control Escolar.</span>
              </div>
            )
          )}
        </div>

        <div className="flex items-start gap-4 rounded-2xl bg-secondary-fixed/30 p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-fixed text-secondary">
            <Simbolo nombre="gavel" className="text-2xl!" />
          </div>
          <div>
            <span className="mb-1 block font-label-lg text-label-lg font-bold text-secondary">Nota Institucional UAE</span>
            <p className="font-body-md text-body-md leading-relaxed font-medium text-on-surface">
              Esta solicitud solo se aprueba con visto bueno de Control Escolar. La resolución estará sujeta a disponibilidad de cupo y
              validación de horarios.
            </p>
          </div>
        </div>

        <div className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-container-low p-4 select-none">
          <input
            id="protesta"
            type="checkbox"
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
            className="mt-1 h-5 w-5 cursor-pointer rounded accent-primary"
          />
          <label className="cursor-pointer font-body-md text-body-md text-on-surface" htmlFor="protesta">
            <span className="font-semibold text-primary">Declaro bajo protesta de decir verdad</span> que los motivos aquí expuestos son
            verídicos y que cuento con la documentación probatoria requerida si Control Escolar me la solicita para corroborar este trámite.
          </label>
        </div>

        {envio.invalido && <p className="text-xs font-semibold text-error">Corrige los movimientos marcados para continuar.</p>}
        {envio.errorEnvio && <p className="text-xs font-semibold text-error">{envio.errorEnvio}</p>}

        <div className="flex flex-col-reverse items-center justify-between gap-4 pt-4 sm:flex-row">
          <Link
            to="/estudiante/catalogo"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-container px-6 py-3 font-label-lg text-label-lg text-on-surface-variant transition-colors hover:bg-surface-container-high sm:w-auto"
          >
            <Simbolo nombre="arrow_back" className="text-[20px]!" />
            <span>Regresar al catálogo</span>
          </Link>
          <button
            type="button"
            disabled={!puedeEnviar}
            onClick={() => envio.enviar(justificacion, enviado)}
            className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-primary px-8 py-3.5 font-label-lg text-label-lg text-on-primary shadow-md transition-all hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {envio.enviando ? <Spinner className="h-5 w-5" /> : <Simbolo nombre="send" className="text-secondary-fixed" />}
            <span>{envio.enviando ? "Enviando..." : "Enviar solicitud extemporánea"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function Modal({ children, cerrar }: { children: ReactNode; cerrar?: () => void }) {
  useEffect(() => {
    if (!cerrar) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [cerrar]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={cerrar}>
      <div onClick={(e) => e.stopPropagation()} className="contents">
        {children}
      </div>
    </div>
  );
}

/** Modal de éxito de stitch, sin la línea del correo (no se envía correo todavía). */
function Exito({ solicitud }: { solicitud: Solicitud }) {
  const navigate = useNavigate();
  return (
    <Modal>
      <div className="relative w-full max-w-lg rounded-2xl bg-surface-container-lowest p-6 shadow-2xl md:p-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-tertiary-fixed text-on-tertiary-fixed shadow-sm">
          <Simbolo nombre="verified" className="text-3xl!" />
        </div>
        <div className="text-center">
          <span className="rounded-full bg-secondary-fixed/50 px-3 py-1 font-label-sm text-label-sm font-bold tracking-wider text-secondary uppercase">
            Trámite Registrado con Éxito
          </span>
          <h3 className="mt-2 font-headline-lg text-headline-lg font-bold text-primary">Solicitud Extemporánea Recibida</h3>
          <p className="mt-2 font-body-md text-body-md text-on-surface-variant">Tu expediente ha sido turnado a Control Escolar con el folio:</p>
          <div className="my-4 flex items-center justify-center gap-3 rounded-xl bg-surface-container-low p-4">
            <Simbolo nombre="confirmation_number" className="text-2xl! text-primary" />
            <span className="font-headline-md text-headline-md font-bold tracking-wider text-primary">{solicitud.folio_digital}</span>
          </div>
          <p className="rounded-lg bg-surface-container-high/40 p-3 text-left font-body-sm text-body-sm text-outline">
            Control Escolar notificará el dictamen y realizará la captura correspondiente mediante archivo de exportación.
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => navigate("/estudiante")}
            className="w-full cursor-pointer rounded-xl bg-primary py-3 font-label-lg text-label-lg text-on-primary transition-colors hover:bg-primary-container"
          >
            Aceptar y volver al panel principal
          </button>
          <button
            type="button"
            onClick={() => navigate(`/estudiante/historial/${solicitud.id}`)}
            className="w-full cursor-pointer rounded-xl bg-surface-container py-2.5 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container-high"
          >
            Ver acuse
          </button>
        </div>
      </div>
    </Modal>
  );
}

function HistorialPrevio({ cerrar }: { cerrar: () => void }) {
  const { data: folios, isPending } = useSolicitudes();
  return (
    <Modal cerrar={cerrar}>
      <div className="relative w-full max-w-xl rounded-2xl bg-surface-container-lowest p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2.5">
            <Simbolo nombre="history" className="text-2xl! text-primary" />
            <h3 className="font-headline-sm text-headline-sm font-bold text-primary">Historial de Folios Previos</h3>
          </div>
          <button type="button" onClick={cerrar} className="cursor-pointer rounded-lg p-1 text-outline hover:bg-surface-container hover:text-primary">
            <Simbolo nombre="close" />
          </button>
        </div>
        <div className="my-4 max-h-[50vh] space-y-3 overflow-y-auto">
          {isPending ? (
            <div className="flex justify-center p-4">
              <Spinner className="h-5 w-5 text-primary-container" />
            </div>
          ) : !folios?.length ? (
            <p className="rounded-xl bg-surface-container-low p-3.5 text-center font-body-sm text-body-sm text-on-surface-variant">
              Aún no tienes folios registrados.
            </p>
          ) : (
            folios.map((f) => (
              <Link
                key={f.id}
                to={`/estudiante/historial/${f.id}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3.5 transition-colors hover:bg-surface-container"
              >
                <div>
                  <span className="font-label-lg text-label-lg font-bold text-primary">
                    {f.folio_digital} (Convocatoria {f.ciclo})
                  </span>
                  <span className="block font-body-sm text-body-sm text-outline">{resolucionFolio(f)}</span>
                </div>
                <ChipEstadoFolio solicitud={f} className="shrink-0" />
              </Link>
            ))
          )}
        </div>
        <div className="pt-3">
          <button
            type="button"
            onClick={cerrar}
            className="w-full cursor-pointer rounded-xl bg-surface-container py-2.5 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container-high"
          >
            Cerrar consulta
          </button>
        </div>
      </div>
    </Modal>
  );
}
