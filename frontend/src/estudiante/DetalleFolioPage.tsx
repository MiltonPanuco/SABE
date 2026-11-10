// Detalle de un folio: contenido de stitch/sabe_detalle_de_folio_sabe_2026_014_estudiante dentro del marco
// del portal, con el diálogo de stitch/sabe_cancelar_solicitud_pendiente_estudiante. Al imprimir sale el acuse.
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCancelarSolicitud, useSolicitud } from "../api/solicitudes";
import type { MovimientoFolio, Solicitud } from "../api/tipos";
import { Simbolo, Spinner } from "../components/acceso";
import { useCarrito } from "./Carrito";
import { Acuse, BotonImprimir, ChipEstadoFolio, ESTADO_MOVIMIENTO } from "./folio";
import { claveGrupo, fechaCorta, fechaLarga, horaDe, horarioTexto } from "./formato";
import { useToast } from "./Toast";

export function DetalleFolioPage() {
  const id = Number(useParams().id);
  const { data: folio, isPending, error } = useSolicitud(id);
  const [cancelando, setCancelando] = useState(false);

  if (isPending) {
    return (
      <Aviso>
        <Spinner className="h-5 w-5 text-primary-container" /> Cargando folio…
      </Aviso>
    );
  }
  if (error) {
    return (
      <Aviso>
        {error.message}{" "}
        <Link to="/estudiante/historial" className="font-semibold text-primary-container hover:underline">
          Volver al historial
        </Link>
      </Aviso>
    );
  }

  const pendientes = folio.movimientos.filter((m) => m.estado === "pendiente");
  const { total, aprobadas } = folio.resumen;

  return (
    <>
      <div className="flex w-full flex-col pb-4 print:hidden">
        {/* Barra de contexto */}
        <div className="mb-2 flex flex-col gap-4 py-4 pt-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/estudiante/historial"
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container px-3 py-1.5 font-label-md text-label-md text-on-surface-variant transition-all hover:bg-surface-container-high hover:text-on-surface"
            >
              <Simbolo nombre="arrow_back" className="text-[18px]!" />
              Volver a Historial y Dictámenes
            </Link>
            <span className="hidden text-outline-variant sm:inline">•</span>
            <span className="hidden font-label-md text-label-md text-outline sm:inline">Trámite #{folio.folio_digital}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <BotonImprimir className="inline-flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-surface-container-lowest px-3.5 py-2 font-label-md text-label-md text-primary shadow-sm transition-all hover:bg-surface-container-low hover:shadow-md" />
            {pendientes.length > 0 && (
              <button
                type="button"
                onClick={() => setCancelando(true)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-error-container px-3.5 py-2 font-label-md text-label-md text-on-error-container transition-all hover:bg-error hover:text-on-error"
              >
                <Simbolo nombre="cancel" className="text-[18px]!" />
                <span>Cancelar solicitud</span>
              </button>
            )}
          </div>
        </div>

        {/* Encabezado del folio */}
        <div className="relative mb-6 overflow-hidden rounded-xl bg-surface-container-lowest p-6 shadow-sm">
          <div className="pointer-events-none absolute top-0 right-0 h-full w-80 bg-gradient-to-l from-surface-container-high/40 to-transparent" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2.5">
                <h1 className="font-headline-lg text-headline-lg tracking-tight text-primary">Folio {folio.folio_digital}</h1>
                <ChipEstadoFolio solicitud={folio} />
                {folio.extemporanea && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary-fixed px-2.5 py-1 font-label-sm text-label-sm font-bold text-secondary">
                    <Simbolo nombre="priority_high" className="text-[14px]!" /> Extemporáneo
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-md bg-surface-container px-2.5 py-1 font-label-sm text-label-sm text-on-surface-variant">
                  <Simbolo nombre="event" className="text-[14px]!" />
                  Enviada el {fechaLarga(folio.fecha_solicitud)}
                </span>
              </div>
              <p className="font-body-md text-body-md text-outline">
                Solicitud de ajuste de carga académica de altas y bajas de la Licenciatura en {folio.estudiante.programa}.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 rounded-xl bg-surface-container-low px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container text-on-primary">
                <Simbolo nombre="swap_horizontal_circle" className="text-[22px]!" />
              </div>
              <div>
                <span className="block font-label-sm text-label-sm leading-none text-outline">Movimientos Solicitados</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-headline-sm text-headline-sm font-bold text-primary">
                    {total} {total === 1 ? "Materia" : "Materias"}
                  </span>
                  {aprobadas > 0 && (
                    <span className="font-label-sm text-label-sm font-semibold text-on-tertiary-container">
                      {aprobadas} {aprobadas === 1 ? "Aprobada" : "Aprobadas"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <Seguimiento folio={folio} />

        {/* Datos del alumno y justificación */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-6 shadow-sm lg:col-span-5">
            <div>
              <div className="mb-4 flex items-center gap-2 pb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                  <Simbolo nombre="badge" className="text-[20px]!" />
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-primary">Datos del Alumno y Trámite</h3>
                  <span className="font-label-sm text-label-sm text-outline">Facultad de Economía • UAN</span>
                </div>
              </div>
              <div className="space-y-3">
                <Dato etiqueta="Estudiante:" valor={folio.estudiante.nombre} fuerte />
                <Dato etiqueta="Matrícula:" valor={folio.estudiante.matricula} />
                <Dato etiqueta="Programa Académico:" valor={`Licenciatura en ${folio.estudiante.programa}`} />
                <Dato etiqueta="Ciclo Escolar:" valor={folio.ciclo} />
                <Dato
                  etiqueta="Periodo de Solicitud:"
                  valor={folio.extemporanea ? `Extemporánea ${folio.ciclo}` : `Convocatoria ${folio.ciclo}`}
                  clase="text-secondary"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col rounded-xl bg-surface-container-lowest p-6 shadow-sm lg:col-span-7">
            <div className="mb-3 flex items-center justify-between gap-2 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                  <Simbolo nombre="description" className="text-[20px]!" />
                </div>
                <h3 className="font-headline-sm text-headline-sm text-primary">Motivo y Justificación de la Solicitud</h3>
              </div>
              <span className="shrink-0 rounded bg-surface-container px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">
                Carácter Declarativo
              </span>
            </div>
            <div className="relative mb-4 rounded-xl bg-surface-container-low p-4">
              <Simbolo nombre="format_quote" className="pointer-events-none absolute right-3 bottom-2 text-[36px]! text-outline-variant/50" />
              <p className="font-body-md text-body-md leading-relaxed whitespace-pre-line text-on-surface italic">
                “{folio.justificacion}”
              </p>
            </div>
          </div>
        </div>

        <TablaMovimientos movimientos={folio.movimientos} />
      </div>

      {/* Lo único que sale al imprimir */}
      <div className="hidden print:block">
        <Acuse solicitud={folio} />
      </div>

      {cancelando && <DialogoCancelar folio={folio} pendientes={pendientes} cerrar={() => setCancelando(false)} />}
    </>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl bg-surface-container-lowest p-8 text-center font-body-md text-on-surface-variant shadow-sm">
      {children}
    </div>
  );
}

function Dato({ etiqueta, valor, fuerte = false, clase = "text-primary" }: { etiqueta: string; valor: string; fuerte?: boolean; clase?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low p-2.5">
      <span className="font-body-sm text-body-sm text-outline">{etiqueta}</span>
      <span className={`text-right font-label-md text-label-md ${fuerte ? "font-bold" : "font-semibold"} ${clase}`}>{valor}</span>
    </div>
  );
}

type EstadoPaso = "hecho" | "activo" | "pendiente" | "no_aplica";

/** "Estado Institucional del Trámite": Ingresada → En dictamen → Cargada en SADCE, según los movimientos. */
function Seguimiento({ folio }: { folio: Solicitud }) {
  const estados = folio.movimientos.map((m) => m.estado);
  const hayPendientes = estados.includes("pendiente");
  const sinCargar = estados.includes("aprobada");
  const cargadas = estados.includes("cargada_sadce");
  const { total, resueltas } = folio.resumen;

  const paso2: EstadoPaso = hayPendientes ? "activo" : "hecho";
  const paso3: EstadoPaso = hayPendientes ? "pendiente" : sinCargar ? "activo" : cargadas ? "hecho" : "no_aplica";
  const etiqueta = hayPendientes ? "Paso 2 de 3" : paso3 === "activo" ? "Paso 3 de 3" : "Concluido";

  const notaPaso2 = hayPendientes
    ? `${resueltas} de ${total} resueltos`
    : folio.estado === "cancelada"
      ? "Cancelada por el estudiante"
      : "Dictamen emitido";
  const notaPaso3 =
    paso3 === "no_aplica"
      ? "Sin movimientos aprobados que cargar"
      : paso3 === "hecho"
        ? "Información cargada en SADCE"
        : "Sujeto a la resolución de Control Escolar";

  return (
    <div className="mb-6 rounded-xl bg-surface-container-lowest p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Simbolo nombre="linear_scale" className="text-[22px]! text-primary" />
          <h2 className="font-headline-sm text-headline-sm text-primary">Estado Institucional del Trámite</h2>
        </div>
        <span className="hidden font-label-sm text-label-sm tracking-wider text-outline uppercase sm:inline">{etiqueta}</span>
      </div>
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Paso
          estado="hecho"
          titulo="1. Ingresada"
          icono="check"
          texto="Captura y validación por estudiante"
          nota={`${fechaCorta(folio.fecha_solicitud)}, ${horaDe(folio.fecha_solicitud)}`}
        />
        <Paso estado={paso2} titulo="2. En dictamen" icono="sync" texto="Control Escolar resuelve movimientos" nota={notaPaso2} />
        <Paso estado={paso3} titulo="3. Cargada en SADCE" icono="description" texto="Control Escolar pasa tu información a SADCE" nota={notaPaso3} />
      </div>
      <div className="flex items-start gap-3 rounded-lg bg-surface-container-low p-3.5 text-on-surface-variant">
        <Simbolo nombre="info" className="mt-0.5 shrink-0 text-[20px]! text-surface-tint" />
        <p className="font-body-sm text-body-sm">
          <strong className="font-semibold text-primary">Aviso Operativo:</strong> El sistema <strong className="text-primary">SABE</strong> es
          una plataforma interna de la Unidad Académica de Economía y opera de manera independiente de SADCE. El único validador de
          las solicitudes es Control Escolar, quien pasa la información a SADCE una vez emitido el dictamen definitivo.
        </p>
      </div>
    </div>
  );
}

const ESTILO_PASO: Record<EstadoPaso, { caja: string; circulo: string; titulo: string; chip: string; chipTexto: string; nota: string }> = {
  hecho: {
    caja: "bg-tertiary-container/10",
    circulo: "bg-on-tertiary-container text-on-tertiary",
    titulo: "text-on-tertiary-container",
    chip: "bg-tertiary-container/20 text-on-tertiary-container",
    chipTexto: "Completado",
    nota: "text-outline",
  },
  activo: {
    caja: "bg-secondary-fixed/30 shadow-sm",
    circulo: "bg-secondary-container text-on-secondary-fixed",
    titulo: "text-secondary",
    chip: "bg-secondary-container/40 text-on-secondary-container",
    chipTexto: "En revisión",
    nota: "font-medium text-secondary",
  },
  pendiente: {
    caja: "bg-surface-container opacity-75",
    circulo: "bg-surface-container-high text-outline",
    titulo: "text-outline",
    chip: "bg-surface-container-high text-outline",
    chipTexto: "Pendiente",
    nota: "text-outline",
  },
  no_aplica: {
    caja: "bg-surface-container opacity-75",
    circulo: "bg-surface-container-high text-outline",
    titulo: "text-outline",
    chip: "bg-surface-container-high text-outline",
    chipTexto: "No aplica",
    nota: "text-outline",
  },
};

function Paso({ estado, titulo, icono, texto, nota }: { estado: EstadoPaso; titulo: string; icono: string; texto: string; nota: string }) {
  const e = ESTILO_PASO[estado];
  const simbolo = estado === "hecho" ? "check" : icono;
  return (
    <div className={`relative flex items-start gap-3.5 rounded-xl p-4 ${e.caja}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${e.circulo}`}>
        <Simbolo nombre={simbolo} className={`text-[18px]! ${estado === "activo" && simbolo === "sync" ? "animate-spin" : ""}`} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`font-label-md text-label-md font-bold ${e.titulo}`}>{titulo}</span>
          <span className={`rounded px-1.5 py-0.5 font-label-sm text-label-sm ${e.chip}`}>{e.chipTexto}</span>
        </div>
        <span className="mt-0.5 block font-body-sm text-body-sm text-on-surface-variant">{texto}</span>
        <span className={`mt-1 block font-label-sm text-label-sm ${e.nota}`}>{nota}</span>
      </div>
    </div>
  );
}

function TablaMovimientos({ movimientos }: { movimientos: MovimientoFolio[] }) {
  return (
    <div className="mb-6 rounded-xl bg-surface-container-lowest p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Simbolo nombre="view_list" className="text-[24px]! text-primary" />
            <h2 className="font-headline-md text-headline-md font-bold text-primary">Movimientos Registrados en el Folio</h2>
          </div>
          <p className="mt-0.5 font-body-sm text-body-sm text-outline">
            Detalle individual por materia, estado de resolución y observaciones de Control Escolar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-label-sm text-label-sm text-outline">Filtro rápido:</span>
          <span className="rounded-full bg-primary-container px-2.5 py-1 font-label-sm text-label-sm text-on-primary">
            Todos ({movimientos.length})
          </span>
        </div>
      </div>
      <div className="-mx-6 overflow-x-auto px-6">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead>
            <tr className="bg-surface-container-low font-label-md text-label-md tracking-wider text-on-surface-variant uppercase">
              <th className="rounded-l-lg px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Asignatura, Grupo y Horario</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Dictaminado Por</th>
              <th className="px-4 py-3">Fecha Dictamen</th>
              <th className="px-4 py-3">Motivo / Observaciones</th>
              <th className="rounded-r-lg px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y-0 text-on-surface">
            {movimientos.map((m, i) => (
              <FilaMovimiento key={m.id} movimiento={m} separador={i > 0} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaMovimiento({ movimiento: m, separador }: { movimiento: MovimientoFolio; separador: boolean }) {
  const { agregar } = useCarrito();
  const navigate = useNavigate();
  const alta = m.tipo_tramite === "ALTA";
  const estado = ESTADO_MOVIMIENTO[m.estado];
  const rechazada = m.estado === "rechazada";

  const observacion = rechazada
    ? m.motivo_rechazo
    : m.estado === "pendiente"
      ? "En análisis de disponibilidad de cupo por Control Escolar."
      : m.estado === "cancelada"
        ? "Retirado de revisión por el estudiante."
        : m.estado === "cargada_sadce"
          ? "Cargado en SADCE por Control Escolar."
          : "Dictamen favorable de Control Escolar.";

  const volverASolicitar = () => {
    agregar(m.grupo, m.tipo_tramite);
    navigate("/estudiante/catalogo");
  };

  return (
    <>
      {separador && (
        <tr>
          <td className="h-2" colSpan={7} />
        </tr>
      )}
      <tr className={`transition-colors hover:bg-surface-container-low/50 ${rechazada ? "bg-error-container/10" : ""}`}>
        <td className="px-4 py-4 align-top">
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-label-md text-label-md font-bold ${
              alta ? "bg-tertiary-container/15 text-on-tertiary-container" : "bg-error-container text-error"
            }`}
          >
            <Simbolo nombre={alta ? "arrow_upward" : "arrow_downward"} className="text-[16px]!" />
            {m.tipo_tramite}
          </span>
        </td>
        <td className="px-4 py-4 align-top">
          <div className="font-headline-sm text-headline-sm leading-tight font-bold text-primary">{m.grupo.materia.nombre}</div>
          <div className="mt-0.5 font-body-sm text-body-sm text-outline">
            Clave: <strong className="text-on-surface">{m.grupo.materia.clave}</strong> • Grupo{" "}
            <span className="rounded bg-surface-container px-1.5 py-0.5 font-bold text-primary">{m.grupo.num_grupo}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 font-label-sm text-label-sm text-on-surface-variant">
            <Simbolo nombre="schedule" className="text-[14px]!" />
            <span>{horarioTexto(m.grupo.horarios)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 font-label-sm text-label-sm text-outline">
            <Simbolo nombre="person" className="text-[14px]!" />
            <span>{m.grupo.docente}</span>
          </div>
        </td>
        <td className="px-4 py-4 align-top">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-label-md text-label-md font-bold whitespace-nowrap ${estado.chip}`}>
            <Simbolo nombre={estado.icono} className="text-[16px]!" />
            {estado.texto}
          </span>
          {estado.nota && <span className={`mt-1 block font-label-sm text-label-sm ${estado.notaClase}`}>{estado.nota}</span>}
        </td>
        <td className="px-4 py-4 align-top">
          <div className="font-label-md text-label-md font-semibold text-primary">Control Escolar</div>
          {m.revisado_por && <span className="font-body-sm text-body-sm text-outline">{m.revisado_por}</span>}
        </td>
        <td className="px-4 py-4 align-top">
          {m.fecha_resolucion ? (
            <>
              <div className="font-label-md text-label-md text-on-surface">{fechaCorta(m.fecha_resolucion)}</div>
              <div className="font-body-sm text-body-sm text-outline">{horaDe(m.fecha_resolucion)}</div>
            </>
          ) : (
            <div className={`font-label-md text-label-md font-semibold ${m.estado === "pendiente" ? "text-secondary" : "text-outline"}`}>
              {m.estado === "pendiente" ? "En espera" : "—"}
            </div>
          )}
        </td>
        <td className="max-w-xs px-4 py-4 align-top">
          <div
            className={`rounded-lg p-2.5 font-body-sm text-body-sm leading-snug ${
              rechazada ? "bg-error-container/40 text-on-error-container" : "bg-surface-container-low text-on-surface"
            }`}
          >
            {observacion}
          </div>
        </td>
        <td className="px-4 py-4 text-right align-top">
          {rechazada ? (
            <button
              type="button"
              onClick={volverASolicitar}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 font-label-sm text-label-sm font-semibold whitespace-nowrap text-on-primary shadow-sm transition-all hover:bg-primary-container"
            >
              <Simbolo nombre="restart_alt" className="text-[16px]!" /> Volver a solicitar
            </button>
          ) : m.estado === "pendiente" ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-surface-container-high px-3 py-1.5 font-label-sm text-label-sm whitespace-nowrap text-on-surface-variant">
              <Simbolo nombre="schedule" className="text-[14px]!" /> En espera
            </span>
          ) : m.estado === "cancelada" ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-surface-container px-3 py-1.5 font-label-sm text-label-sm whitespace-nowrap text-on-surface-variant">
              <Simbolo nombre="block" className="text-[14px]!" /> Sin efecto
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-lg bg-surface-container px-3 py-1.5 font-label-sm text-label-sm font-semibold whitespace-nowrap text-on-tertiary-container">
              <Simbolo nombre="verified" className="text-[16px]!" /> Dictamen favorable
            </span>
          )}
        </td>
      </tr>
    </>
  );
}

/** Diálogo de stitch/sabe_cancelar_solicitud_pendiente_estudiante (sin la frase de lugares reservados). */
function DialogoCancelar({ folio, pendientes, cerrar }: { folio: Solicitud; pendientes: MovimientoFolio[]; cerrar: () => void }) {
  const cancelar = useCancelarSolicitud();
  const mostrarAviso = useToast();

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [cerrar]);

  const confirmar = () =>
    cancelar.mutate(folio.id, {
      onSuccess: () => {
        mostrarAviso("Solicitud cancelada", `El folio ${folio.folio_digital} ha sido dado de baja exitosamente.`);
        cerrar();
      },
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary/60 p-4 backdrop-blur-sm print:hidden"
      onClick={cerrar}
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-cancelar"
    >
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 bg-surface-container-low p-6">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-error-container text-error shadow-sm">
              <Simbolo nombre="warning" className="text-2xl!" />
            </div>
            <div>
              <h2 id="titulo-cancelar" className="font-headline-md text-headline-md leading-tight font-bold text-primary">
                ¿Cancelar solicitud {folio.folio_digital}?
              </h2>
              <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                Solo puedes cancelar movimientos que aún están pendientes. Después podrás volver a solicitar en el catálogo de la Facultad.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar modal"
            onClick={cerrar}
            className="cursor-pointer rounded-lg p-2 text-outline transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <Simbolo nombre="close" className="text-xl!" />
          </button>
        </div>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-6">
          <span className="block font-label-sm text-label-sm tracking-wider text-outline uppercase">
            Movimientos que serán retirados de revisión:
          </span>
          {pendientes.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 rounded-xl bg-surface-container-low p-3.5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 font-label-sm text-label-sm font-bold ${
                      m.tipo_tramite === "ALTA" ? "bg-tertiary-fixed/30 text-on-tertiary-container" : "bg-error-container text-error"
                    }`}
                  >
                    {m.tipo_tramite}
                  </span>
                  <span className="font-label-lg text-label-lg font-bold text-primary">{m.grupo.materia.nombre}</span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Grupo {m.grupo.num_grupo} • Docente: {m.grupo.docente}
                </p>
                <p className="font-body-sm text-body-sm text-outline">{horarioTexto(m.grupo.horarios, true)}</p>
              </div>
              <span className="shrink-0 font-mono text-[10px] text-on-surface-variant">{claveGrupo(m.grupo)}</span>
            </div>
          ))}
          <div className="flex items-start gap-3 rounded-xl bg-error-container/20 p-4">
            <Simbolo nombre="info" className="mt-0.5 shrink-0 text-xl! text-error" />
            <p className="font-body-sm text-body-sm text-on-surface">
              <strong>Aviso:</strong> Al cancelar esta solicitud, los movimientos pendientes quedarán sin efecto y deberás registrar un
              nuevo folio si deseas hacer ajustes.
            </p>
          </div>
          {cancelar.error && <p className="text-xs font-semibold text-error">{cancelar.error.message}</p>}
        </div>
        <div className="flex flex-col-reverse items-center justify-end gap-3 bg-surface-container-low p-6 sm:flex-row">
          <button
            type="button"
            onClick={cerrar}
            className="w-full cursor-pointer rounded-xl bg-surface-container-lowest px-5 py-2.5 font-label-md text-label-md text-primary shadow-sm transition-colors hover:bg-surface-container sm:w-auto"
          >
            Mantener solicitud
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={cancelar.isPending}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-error px-5 py-2.5 font-label-md text-label-md text-on-error shadow-md transition-all hover:bg-error/90 active:scale-95 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
          >
            {cancelar.isPending ? <Spinner className="h-4 w-4" /> : <Simbolo nombre="delete_forever" className="text-[18px]!" />}
            <span>Sí, cancelar solicitud</span>
          </button>
        </div>
      </div>
    </div>
  );
}
