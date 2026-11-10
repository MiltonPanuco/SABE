// Vista 4 de stitch/sabe_estudiantes (resumen, justificación y declaración) cuando la convocatoria está abierta;
// fuera de ella, la pantalla de stitch/sabe_convocatoria_cerrada_solicitud_extempor_nea_estudiante.
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePeriodoActivo } from "../api/estudiante";
import type { PeriodoActivo } from "../api/tipos";
import { Simbolo, Spinner } from "../components/acceso";
import { ConvocatoriaCerrada } from "./ConvocatoriaCerrada";
import { useEnviarCarrito } from "./enviar";
import { claveGrupo, horarioTexto, problemasDe } from "./formato";
import { useToast } from "./Toast";

export function ConfirmacionPage() {
  const { data: periodo, isPending, error } = usePeriodoActivo();

  if (isPending) {
    return (
      <Aviso>
        <Spinner className="h-5 w-5 text-primary-container" /> Cargando convocatoria…
      </Aviso>
    );
  }
  if (error) return <Aviso>{error.message}</Aviso>;
  if (!periodo) return <Aviso>No hay un periodo activo. Control Escolar publicará la próxima convocatoria.</Aviso>;
  if (periodo.convocatoria_abierta) return <Formulario periodo={periodo} />;
  const noAbre = Date.now() < Date.parse(periodo.convocatoria_inicio);
  return <ConvocatoriaCerrada periodo={periodo} modo={noAbre ? "no_abre" : "cerrada"} />;
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl items-center justify-center gap-2 rounded-xl bg-surface-container-lowest p-8 text-center font-body-md text-on-surface-variant shadow-sm">
      {children}
    </div>
  );
}

function Formulario({ periodo }: { periodo: PeriodoActivo }) {
  const envio = useEnviarCarrito();
  const navigate = useNavigate();
  const mostrarAviso = useToast();
  const [justificacion, setJustificacion] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [tocado, setTocado] = useState(false);

  const conJustificacion = justificacion.trim().length > 0;
  const puedeEnviar =
    envio.items.length > 0 && conJustificacion && acepta && !envio.revisando && !envio.invalido && !envio.enviando;

  const enviar = () =>
    envio.enviar(justificacion, (solicitud) => {
      mostrarAviso("Solicitud Enviada a Control Escolar", `Folio asignado: ${solicitud.folio_digital}.`);
      navigate("/estudiante/historial");
    });

  return (
    <div className="flex flex-1 flex-col gap-space-lg">
      <div className="mx-auto w-full max-w-4xl rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <div className="mb-space-md flex items-center justify-between gap-2 border-b border-surface-container-high pb-space-md">
          <div className="flex items-center gap-space-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary">
              <Simbolo nombre="fact_check" />
            </div>
            <div>
              <h2 className="font-headline-md text-headline-md text-primary">Resumen de Solicitud de Trámite</h2>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Revisa detenidamente los movimientos antes de enviar a Control Escolar.
              </span>
            </div>
          </div>
          <span className="shrink-0 rounded bg-secondary-fixed px-2.5 py-1 font-mono font-label-sm text-label-sm font-bold text-on-secondary-container">
            Ciclo {periodo.ciclo}
          </span>
        </div>

        {/* Tabla de movimientos del carrito */}
        <div className="mb-space-lg overflow-x-auto">
          <table className="w-full min-w-[560px] text-left font-body-sm text-body-sm">
            <thead>
              <tr className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                <th className="rounded-l-lg px-4 py-3">Movimiento</th>
                <th className="px-4 py-3">Asignatura / Clave</th>
                <th className="px-4 py-3">Horario</th>
                <th className="rounded-r-lg px-4 py-3">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y-0">
              {envio.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-xs text-on-surface-variant">
                    No has seleccionado movimientos en el carrito. Regresa al catálogo para agregar asignaturas.
                  </td>
                </tr>
              ) : (
                envio.items.map(({ grupo, tipo }) => {
                  const alta = tipo === "ALTA";
                  const problemas = problemasDe(envio.resultados.get(grupo.id));
                  return (
                    <tr
                      key={grupo.id}
                      className={problemas.length ? "bg-error-container/30" : alta ? "bg-on-tertiary-container/5" : "bg-error-container/20"}
                    >
                      <td className="px-4 py-3 align-top">
                        <span className={`flex items-center gap-1.5 text-xs font-bold ${alta ? "text-on-tertiary-container" : "text-error"}`}>
                          <Simbolo nombre={alta ? "add_circle" : "remove_circle"} className="text-[16px]!" /> {tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="block font-label-md text-xs font-semibold text-on-surface">{grupo.materia.nombre}</span>
                        <span className="font-mono text-[10px] text-on-surface-variant">{claveGrupo(grupo)}</span>
                        {problemas.map((texto) => (
                          <span key={texto} className="mt-0.5 flex items-start gap-1 text-[11px] leading-snug font-semibold text-error">
                            <Simbolo nombre="block" className="mt-px text-[13px]!" /> {texto}
                          </span>
                        ))}
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs text-on-surface">{horarioTexto(grupo.horarios)}</td>
                      <td className="px-4 py-3 align-top">
                        <button
                          type="button"
                          onClick={() => envio.quitar(grupo.id)}
                          className="cursor-pointer text-xs font-semibold text-error hover:underline"
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Justificación */}
        <div className="mb-space-md flex flex-col gap-2">
          <label className="flex items-center justify-between font-label-md text-label-md text-on-surface" htmlFor="justificacion">
            <span className="font-bold">
              Motivo o Justificación Académica del Trámite <span className="text-error">*</span>
            </span>
            <span className="font-mono font-label-sm text-xs text-on-surface-variant">Obligatorio para dictamen</span>
          </label>
          <textarea
            id="justificacion"
            rows={3}
            maxLength={500}
            value={justificacion}
            onChange={(e) => {
              setJustificacion(e.target.value);
              setTocado(true);
            }}
            placeholder="Escribe el motivo de tus movimientos (ej. ajuste de seriación, horario, etc.)..."
            className="w-full rounded-lg bg-surface-container-low p-space-sm text-body-md text-on-surface focus:ring-2 focus:ring-primary-container focus:outline-none"
          />
          {((tocado && !conJustificacion) || envio.errorJustificacion) && (
            <p className="text-xs font-semibold text-error">
              {envio.errorJustificacion ?? "Debes ingresar una justificación académica antes de enviar."}
            </p>
          )}
        </div>

        {/* Declaración */}
        <div className="mb-space-lg flex items-start gap-2.5 rounded-lg border border-surface-container-high bg-surface-container-high/40 p-space-sm">
          <input
            id="declaracion"
            type="checkbox"
            checked={acepta}
            onChange={(e) => {
              setAcepta(e.target.checked);
              setTocado(true);
            }}
            className="mt-1 h-4 w-4 cursor-pointer rounded accent-primary-container"
          />
          <label className="cursor-pointer font-body-sm text-xs text-on-surface select-none" htmlFor="declaracion">
            <strong>Declaro bajo protesta de decir verdad</strong> que los datos proporcionados son verídicos y acepto que el trámite está
            sujeto a la resolución definitiva de <strong>Control Escolar</strong> según la normatividad institucional.
          </label>
        </div>
        {tocado && !acepta && (
          <p className="mb-2 text-xs font-semibold text-error">Es obligatorio aceptar la declaración bajo protesta de decir verdad.</p>
        )}
        {envio.invalido && <p className="mb-2 text-xs font-semibold text-error">Corrige los movimientos marcados para continuar.</p>}
        {envio.errorEnvio && <p className="mb-2 text-xs font-semibold text-error">{envio.errorEnvio}</p>}

        <div className="flex flex-col items-center justify-between gap-space-sm border-t border-surface-container-high pt-2 sm:flex-row">
          <Link
            to="/estudiante/catalogo"
            className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-surface-container-high px-space-md py-2.5 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-highest sm:w-auto"
          >
            <Simbolo nombre="arrow_back" className="text-[18px]!" /> Regresar al Catálogo
          </Link>
          <button
            type="button"
            disabled={!puedeEnviar}
            onClick={enviar}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-on-tertiary-container px-space-xl py-3 font-headline-sm text-headline-sm font-bold text-surface-bright shadow-md transition-all hover:bg-tertiary disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <Simbolo nombre="send" className="text-[20px]!" /> {envio.enviando ? "Enviando..." : "Enviar Solicitud Definitiva"}
          </button>
        </div>
      </div>
    </div>
  );
}
