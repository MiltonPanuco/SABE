// Centro de Notificaciones y Eventos Operativos: stitch/sabe_notificaciones_de_control_escolar_uae_uan.
// Sin lo que SABE no tiene (canales, configurar alertas, servidor, adjuntos): ver PLAN.md, F10.
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLeer, useLeerTodas, useNotificaciones, useResumenOperativo } from "../api/avisos";
import { useResumenExportacion, useResumenBandeja } from "../api/control";
import { usePeriodoActivo } from "../api/estudiante";
import type { CategoriaNotificacion, FiltrosNotificaciones, Notificacion } from "../api/tipos";
import { Simbolo, Spinner } from "../components/acceso";
import { fechaEvento, haceCuanto, pillsDe } from "../components/notificaciones";
import { cierreAutomatico, faltan } from "./fechas";
import { useCambiarFiltro } from "./filtrosUrl";

const POR_PAGINA = 20;

function leerFiltros(params: URLSearchParams, limite: number): FiltrosNotificaciones {
  const categoria = params.get("categoria") ?? "";
  return {
    estado: params.get("estado") === "no_leidas" ? "no_leidas" : "",
    categoria: ["nuevas", "cancelaciones", "sistema"].includes(categoria) ? (categoria as CategoriaNotificacion) : "",
    q: "",
    orden: params.get("orden") === "antiguas" ? "antiguas" : "",
    limite,
  };
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

export function NotificacionesPage() {
  const [params] = useSearchParams();
  const cambiar = useCambiarFiltro();
  const [limite, setLimite] = useState(POR_PAGINA);
  const filtros = leerFiltros(params, limite);
  const { data, isPending, error, isFetching } = useNotificaciones(filtros);
  const leerTodas = useLeerTodas();
  const { data: periodo } = usePeriodoActivo();
  const avisos = data?.resultados ?? [];
  const conteos = data?.conteos;
  const ultima = avisos.length && !filtros.orden ? avisos[0].fecha : null;

  const elegir = (estado: string, categoria: string) => {
    cambiar("estado", estado);
    cambiar("categoria", categoria);
    setLimite(POR_PAGINA);
  };

  const chip = (activo: boolean) =>
    `rounded-lg px-space-md py-space-xs font-label-md text-label-md transition-all ${
      activo ? "bg-primary font-semibold text-on-primary" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
    }`;
  const sinFiltro = !filtros.estado && !filtros.categoria;

  return (
    <div className="flex w-full flex-col">
      {/* Migas y franja de monitoreo */}
      <div className="mb-space-md flex flex-col justify-between gap-space-sm md:flex-row md:items-center">
        <nav className="flex flex-wrap items-center gap-space-xs font-label-md text-label-md text-on-surface-variant">
          <Simbolo nombre="desk" className="text-[18px]!" />
          <span>Ventanilla de Control Escolar</span>
          <Simbolo nombre="chevron_right" className="text-[16px]!" />
          <span className="font-semibold text-primary">Notificaciones y Alertas del Sistema</span>
        </nav>
        <div className="inline-flex items-center gap-space-sm self-start rounded-full bg-surface-container-high px-space-md py-space-xs text-on-surface md:self-auto">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-600" />
          <span className="font-label-sm text-label-sm font-semibold text-primary">Monitoreo activo</span>
          {ultima && <span className="font-label-sm text-label-sm text-on-surface-variant">• Última recepción: {haceCuanto(ultima)}</span>}
        </div>
      </div>

      {/* Banda azul */}
      <div className="relative mb-space-lg overflow-hidden rounded-xl bg-gradient-to-r from-primary-container via-[#043d66] to-primary p-space-lg text-on-primary shadow-md">
        <div className="pointer-events-none absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-white/5 blur-2xl" />
        <div className="pointer-events-none absolute top-0 right-32 h-32 w-32 rounded-full bg-secondary-container/10 blur-xl" />
        <div className="relative z-10 flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
          <div className="flex max-w-3xl items-start gap-space-md">
            <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest/10 text-tertiary-fixed shadow-inner backdrop-blur-md sm:flex">
              <Simbolo nombre="notifications_active" className="text-[32px]!" />
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm text-surface-container-highest">Ventanilla de Control Escolar • UAE UAN</span>
              <h1 className="mt-space-xs font-display-lg text-display-lg tracking-tight text-white">Centro de Notificaciones y Eventos Operativos</h1>
              <p className="mt-space-xs font-body-md text-body-md leading-relaxed text-surface-container-high/90">
                Monitoreo de eventos de la Convocatoria {periodo?.ciclo ?? ""}: solicitudes entrantes, cancelaciones de alumnos y estatus de
                carga de información.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => leerTodas.mutate()}
            disabled={!data?.no_leidas || leerTodas.isPending}
            className="inline-flex shrink-0 items-center gap-space-xs self-start rounded-lg bg-surface-container-lowest px-space-md py-space-sm font-label-lg text-label-lg font-semibold text-primary shadow-sm transition-all hover:bg-surface-container-high active:scale-[0.98] disabled:opacity-60 lg:self-center"
          >
            <Simbolo nombre="done_all" className="text-[20px]!" />
            <span>Marcar todas como leídas</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-gutter lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-space-md lg:col-span-8">
          {/* Filtros */}
          <div className="flex flex-wrap items-center justify-between gap-space-sm rounded-xl bg-surface-container-lowest p-space-sm shadow-sm">
            <div className="flex flex-wrap items-center gap-space-xs">
              <button type="button" aria-pressed={sinFiltro} onClick={() => elegir("", "")} className={chip(sinFiltro)}>
                Todas <span className="ml-1 opacity-80">({conteos?.todas ?? 0})</span>
              </button>
              {(
                [
                  ["nuevas", "Nuevas Solicitudes", "text-primary"],
                  ["cancelaciones", "Cancelaciones de Alumnos", "text-error"],
                  ["sistema", "Procesos del Sistema & CSV", "text-secondary"],
                ] as const
              ).map(([categoria, texto, color]) => {
                const activo = filtros.categoria === categoria;
                return (
                  <button key={categoria} type="button" aria-pressed={activo} onClick={() => elegir("", categoria)} className={chip(activo)}>
                    {texto}
                    <span className={`ml-1 font-semibold ${activo ? "opacity-80" : color}`}>({conteos?.[categoria] ?? 0})</span>
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={filtros.estado === "no_leidas"}
                onClick={() => elegir("no_leidas", "")}
                className={chip(filtros.estado === "no_leidas")}
              >
                No leídas
                <span className="ml-1 rounded-full bg-secondary-container px-1.5 py-0.5 text-[11px] font-bold text-on-secondary-fixed">
                  {conteos?.no_leidas ?? 0}
                </span>
              </button>
            </div>
            <label className="flex items-center gap-space-xs px-space-sm">
              <span className="font-label-sm text-label-sm text-on-surface-variant">Orden:</span>
              <select
                value={filtros.orden}
                onChange={(e) => cambiar("orden", e.target.value)}
                className="cursor-pointer border-0 bg-transparent py-0 pr-6 pl-0 font-label-md text-label-md font-semibold text-primary focus:ring-0"
              >
                <option value="">Más recientes</option>
                <option value="antiguas">Más antiguas</option>
              </select>
            </label>
          </div>

          {/* Eventos */}
          <div className="flex flex-col gap-space-sm">
            {isPending && (
              <div className="flex justify-center p-space-lg text-primary">
                <Spinner className="h-6 w-6" />
              </div>
            )}
            {error && <p className="rounded-xl bg-error-container p-space-md text-on-error-container">{error.message}</p>}
            {data && avisos.length === 0 && (
              <div className="flex flex-col items-center gap-space-xs rounded-xl bg-surface-container-lowest p-space-xl text-center shadow-sm">
                <Simbolo nombre="notifications_off" className="text-[28px]! text-on-surface-variant" />
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {sinFiltro ? "No hay eventos registrados." : "Ningún evento coincide con el filtro."}
                </p>
              </div>
            )}
            {avisos.map((aviso) => (
              <Evento key={aviso.id} aviso={aviso} />
            ))}
          </div>

          {data && (
            <div className="flex flex-col items-center justify-between gap-space-sm rounded-xl bg-surface-container-low p-space-md sm:flex-row">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Mostrando {plural(avisos.length, "evento registrado", "eventos registrados")}
                {data.total > avisos.length ? ` de ${data.total}` : ""}
              </span>
              {data.total > avisos.length && (
                <button
                  type="button"
                  disabled={isFetching}
                  onClick={() => setLimite(limite + POR_PAGINA)}
                  className="rounded-lg bg-surface-container-lowest px-space-md py-space-xs font-label-md text-label-md font-semibold text-primary shadow-sm transition-colors hover:bg-surface-container-high"
                >
                  Cargar eventos anteriores
                </button>
              )}
            </div>
          )}
        </div>

        <ResumenLateral />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjetas de eventos (clases de los <article> de stitch)
// ---------------------------------------------------------------------------

const ESTILOS: Partial<Record<Notificacion["tipo"], { borde: string; chip: string; chipClase: string; icono: string }>> = {
  nueva_solicitud: {
    borde: "border-l-primary",
    chip: "Nueva Solicitud",
    chipClase: "bg-primary-container text-on-primary-fixed-variant",
    icono: "assignment_add",
  },
  solicitud_extemporanea: {
    borde: "border-l-secondary-container",
    chip: "Solicitud Extemporánea",
    chipClase: "bg-amber-100 text-amber-900",
    icono: "event_busy",
  },
  cancelacion: {
    borde: "border-l-secondary-container",
    chip: "Cancelación de Alumno",
    chipClase: "bg-error-container text-on-error-container",
    icono: "cancel",
  },
  importacion: { borde: "border-l-tertiary-fixed-dim", chip: "Proceso Concluido", chipClase: "bg-emerald-100 text-emerald-800", icono: "task_alt" },
  exportacion_pendiente: {
    borde: "border-l-primary-fixed-dim",
    chip: "Exportación a SADCE",
    chipClase: "bg-primary-fixed text-on-primary-fixed",
    icono: "file_download",
  },
};
const GENERICO = { borde: "border-l-outline-variant", chip: "Aviso", chipClase: "bg-surface-container text-on-surface-variant", icono: "campaign" };

function Evento({ aviso }: { aviso: Notificacion }) {
  const navigate = useNavigate();
  const leer = useLeer();
  const estilo = ESTILOS[aviso.tipo] ?? GENERICO;
  const { datos } = aviso;

  /** Abre el destino y lo marca como leído. */
  const ir = (ruta: string) => {
    if (!aviso.leida) leer.mutate(aviso.id);
    navigate(ruta);
  };
  const folio = aviso.solicitud ? `/control-escolar/solicitudes/${aviso.solicitud}` : null;

  return (
    <article
      className={`relative flex flex-col gap-space-sm rounded-xl border-l-4 bg-surface-container-lowest p-space-md shadow-sm transition-all hover:shadow-md ${estilo.borde}`}
    >
      <div className="flex flex-col items-start justify-between gap-space-sm sm:flex-row">
        <div className="flex flex-wrap items-center gap-space-sm">
          <span className={`inline-flex items-center gap-1 rounded-full px-space-sm py-0.5 font-label-sm text-label-sm font-semibold ${estilo.chipClase}`}>
            <Simbolo nombre={estilo.icono} className="text-[14px]!" />
            {estilo.chip}
          </span>
          {aviso.folio && (
            <span className="rounded bg-surface-container-highest/60 px-2 py-0.5 font-label-sm text-label-sm font-semibold text-secondary-container">
              Folio {aviso.folio}
            </span>
          )}
          {aviso.tipo === "importacion" && datos.archivo && (
            <span className="rounded bg-surface-container-high px-2 py-0.5 font-mono font-label-sm text-label-sm break-all text-on-surface-variant">
              {datos.archivo}
            </span>
          )}
          {!aviso.leida && (
            <>
              <span className="h-2 w-2 animate-ping rounded-full bg-primary" />
              <span className="font-label-sm text-label-sm font-bold text-primary">Sin leer</span>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
          <Simbolo nombre="schedule" className="text-[16px]!" />
          <span>{fechaEvento(aviso.fecha)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-space-xs">
        <h2 className="font-headline-sm text-headline-sm text-primary">{aviso.titulo || aviso.mensaje}</h2>
        {aviso.titulo && (
          <p className="font-body-md text-body-md leading-relaxed text-on-surface-variant">
            <Resaltado texto={aviso.mensaje} nombre={datos.alumno} matricula={datos.matricula} />
            {(aviso.tipo === "nueva_solicitud" || aviso.tipo === "solicitud_extemporanea") && datos.justificacion && (
              <> Justificación manifestada: {datos.justificacion}</>
            )}
          </p>
        )}
      </div>

      {pillsDe(datos).length > 0 && aviso.tipo !== "solicitud_extemporanea" && (
        <div className="flex flex-wrap items-center gap-space-md rounded-lg bg-surface-container-low p-space-sm font-body-sm text-body-sm">
          {pillsDe(datos).map((m, i) => (
            <div key={i} className={`flex items-center gap-1 font-semibold ${m.tipo === "ALTA" ? "text-on-tertiary-container" : "text-error"}`}>
              <Simbolo nombre={m.tipo === "ALTA" ? "add_circle" : "remove_circle"} className="text-[16px]!" />
              <span>
                {m.tipo === "ALTA" ? "+" : "-"} {m.materia} (Gpo {m.grupo})
              </span>
            </div>
          ))}
        </div>
      )}

      {aviso.tipo === "importacion" && (
        <div className="grid grid-cols-3 gap-space-xs rounded-lg bg-surface-container-low p-space-sm text-center">
          <Metrica titulo="Creados" valor={datos.creados} color="text-emerald-700" />
          <Metrica titulo={datos.tipo === "cargas" ? "Sin cambios" : "Actualizados"} valor={datos.actualizados} color="text-primary" />
          <Metrica titulo="Rechazados" valor={datos.excluidos} color="text-error" />
        </div>
      )}

      <Acciones aviso={aviso} ir={ir} folio={folio} />
    </article>
  );
}

/** El texto del aviso con el nombre en negritas y la matrícula en monoespaciado, como en stitch. */
function Resaltado({ texto, nombre, matricula }: { texto: string; nombre?: string; matricula?: string }) {
  if (!nombre || !texto.startsWith(nombre)) return <>{texto}</>;
  const resto = texto.slice(nombre.length);
  const partes = matricula ? resto.split(matricula) : [resto];
  return (
    <>
      <strong className="text-on-surface">{nombre}</strong>
      {partes.map((parte, i) => (
        <span key={i}>
          {i > 0 && <code className="font-mono font-semibold text-primary">{matricula}</code>}
          {parte}
        </span>
      ))}
    </>
  );
}

function Metrica({ titulo, valor, color }: { titulo: string; valor?: number; color: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-label-sm text-label-sm text-on-surface-variant">{titulo}</span>
      <span className={`font-headline-sm text-headline-sm font-bold ${color}`}>{valor ?? 0}</span>
    </div>
  );
}

function Acciones({ aviso, ir, folio }: { aviso: Notificacion; ir: (ruta: string) => void; folio: string | null }) {
  const fila = "flex flex-col items-stretch justify-between gap-space-sm pt-space-xs sm:flex-row sm:items-center";
  switch (aviso.tipo) {
    case "nueva_solicitud":
      return (
        <div className={`${fila} mt-space-xs`}>
          <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
            <Simbolo nombre="fact_check" className="text-[16px]! text-primary" />
            <span>
              Revisión: <strong>Control Escolar</strong>
            </span>
          </div>
          {folio && (
            <div className="flex items-center gap-space-sm">
              <button
                type="button"
                onClick={() => ir(folio)}
                className="rounded-lg px-space-md py-space-xs font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                Ver expediente
              </button>
              <BotonPrimario onClick={() => ir(folio)} icono="arrow_forward" despues>
                Revisar y Dictaminar
              </BotonPrimario>
            </div>
          )}
        </div>
      );
    case "solicitud_extemporanea":
      return (
        <div className={fila}>
          <div className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            <Simbolo nombre="gavel" className="text-[16px]! text-amber-600" />
            <span>Requiere visto bueno de Control Escolar</span>
          </div>
          {folio && (
            <button
              type="button"
              onClick={() => ir(folio)}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-secondary px-space-md py-space-xs font-label-md text-label-md font-semibold text-white transition-colors hover:bg-on-secondary-container"
            >
              <Simbolo nombre="verified" className="text-[18px]!" />
              <span>Evaluar caso extemporáneo</span>
            </button>
          )}
        </div>
      );
    case "cancelacion":
      return (
        <div className={fila}>
          <span className="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            <Simbolo nombre="check_circle" className="text-[16px]! text-emerald-600" />
            {plural(aviso.datos.canceladas ?? 0, "movimiento cancelado", "movimientos cancelados")} antes del dictamen
          </span>
          {folio && (
            <button
              type="button"
              onClick={() => ir(folio)}
              className="rounded-lg px-space-md py-space-xs font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container"
            >
              Ver historial de movimientos
            </button>
          )}
        </div>
      );
    case "importacion":
      return (
        <div className="flex items-center justify-end gap-space-sm pt-space-xs">
          <button
            type="button"
            onClick={() => ir("/control-escolar/importacion")}
            className="inline-flex items-center gap-1 rounded-lg bg-surface-container-high px-space-md py-space-xs font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container"
          >
            <span>Ir a Importación de Datos</span>
            <Simbolo nombre="arrow_outward" className="text-[16px]!" />
          </button>
        </div>
      );
    case "exportacion_pendiente":
      return (
        <div className={fila}>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            Formato de salida: <strong>Excel de intercambio (.xlsx)</strong>
          </span>
          <button
            type="button"
            onClick={() => ir("/control-escolar/exportacion")}
            className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary-container px-space-md py-space-xs font-label-md text-label-md font-semibold text-on-primary transition-colors hover:bg-primary"
          >
            <Simbolo nombre="file_download" className="text-[18px]!" />
            <span>Generar archivo de exportación</span>
          </button>
        </div>
      );
    default:
      return null;
  }
}

function BotonPrimario({ onClick, icono, despues, children }: { onClick: () => void; icono: string; despues?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg bg-primary px-space-md py-space-xs font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-primary-container"
    >
      {!despues && <Simbolo nombre={icono} className="text-[16px]!" />}
      <span>{children}</span>
      {despues && <Simbolo nombre={icono} className="text-[16px]!" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Columna derecha
// ---------------------------------------------------------------------------

function Kpi({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-container-low p-space-md">
      <span className="font-label-sm text-label-sm font-medium text-on-surface-variant">{titulo}</span>
      {children}
    </div>
  );
}

function ResumenLateral() {
  const { data: bandeja } = useResumenBandeja();
  const { data: operativo } = useResumenOperativo();
  const { data: exportacion } = useResumenExportacion();
  const { data: periodo } = usePeriodoActivo();
  const hoy = operativo?.cancelaciones_hoy ?? 0;
  const diferencia = hoy - (operativo?.cancelaciones_ayer ?? 0);
  const abierta = periodo && new Date(periodo.convocatoria_fin) > new Date();

  return (
    <aside className="flex flex-col gap-space-md lg:sticky lg:top-20 lg:col-span-4">
      <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        <div className="flex items-center justify-between border-b border-surface-container-high pb-space-sm">
          <div className="flex items-center gap-space-xs">
            <Simbolo nombre="analytics" className="text-[22px]! text-primary" />
            <h3 className="font-headline-sm text-headline-sm text-primary">Resumen Operativo</h3>
          </div>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-label-sm text-label-sm font-semibold text-emerald-800">En línea</span>
        </div>
        <div className="grid grid-cols-2 gap-space-sm">
          <Kpi titulo="Pendientes">
            <div className="flex items-baseline gap-1">
              <span className="font-display-lg text-display-lg font-bold text-primary">{bandeja?.folios_pendientes ?? "—"}</span>
              <span className="font-label-sm text-label-sm font-semibold text-secondary">
                {bandeja?.folios_pendientes === 1 ? "trámite" : "trámites"}
              </span>
            </div>
            <Link to="/control-escolar/solicitudes" className="font-label-sm text-label-sm font-semibold text-secondary hover:underline">
              Ir a la bandeja
            </Link>
          </Kpi>
          <Kpi titulo="Cancelaciones Hoy">
            <div className="flex items-baseline gap-1">
              <span className="font-display-lg text-display-lg font-bold text-error">{operativo ? hoy : "—"}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">{hoy === 1 ? "alumno" : "alumnos"}</span>
            </div>
            {operativo && (
              <span
                className={`mt-1 flex items-center gap-0.5 font-label-sm text-label-sm ${diferencia > 0 ? "text-error" : "text-emerald-700"}`}
              >
                {diferencia !== 0 && <Simbolo nombre={diferencia > 0 ? "arrow_upward" : "arrow_downward"} className="text-[14px]!" />}
                {diferencia === 0 ? "Igual que ayer" : `${Math.abs(diferencia)} ${diferencia > 0 ? "más" : "menos"} que ayer`}
              </span>
            )}
          </Kpi>
          <Kpi titulo="Folios Extemporáneos">
            <div className="flex items-baseline gap-1">
              <span className="font-display-lg text-display-lg font-bold text-secondary">{bandeja?.extemporaneos ?? "—"}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">{bandeja?.extemporaneos === 1 ? "folio" : "folios"}</span>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant">En la bandeja del ciclo</span>
          </Kpi>
          <Kpi titulo="Lotes SADCE">
            <div className="flex items-baseline gap-1">
              <span className="font-display-lg text-display-lg font-bold text-primary">{exportacion?.pendientes ?? "—"}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {exportacion?.pendientes === 1 ? "mov." : "movs."}
              </span>
            </div>
            <span className="font-label-sm text-label-sm font-semibold text-secondary">Listo p/ envío</span>
          </Kpi>
        </div>

        {periodo && (
          <div className="relative flex flex-col gap-space-xs overflow-hidden rounded-xl bg-primary-container p-space-md text-on-primary">
            <div className="flex items-center gap-space-xs">
              <Simbolo nombre="timer" className="text-[20px]! text-secondary-fixed" />
              <span className="font-label-md text-label-md font-bold tracking-wide text-secondary-fixed uppercase">
                {abierta ? "Próximo corte de ciclo" : "Convocatoria cerrada"}
              </span>
            </div>
            <div className="font-headline-sm text-headline-sm font-bold text-white">
              {cierreAutomatico(periodo.convocatoria_fin).replace(/:\d\d$/, "").replace(/ (\d\d:\d\d)$/, " • $1")} hrs
            </div>
            <p className="font-body-sm text-body-sm text-on-primary-container">
              Cierre definitivo para recepción de solicitudes de la Convocatoria {periodo.ciclo}.
            </p>
            {abierta && (
              <div className="mt-space-xs inline-flex items-center gap-1 font-label-sm text-label-sm font-semibold text-tertiary-fixed">
                <Simbolo nombre="hourglass_top" className="text-[16px]!" />
                <span>Restan: {faltan(periodo.convocatoria_fin)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
        <span className="font-label-md text-label-md font-semibold text-on-surface">Acciones Rápidas de Ventanilla</span>
        <div className="grid grid-cols-1 gap-space-xs">
          <Atajo ruta="/control-escolar/solicitudes" icono="rule" texto="Auditar Cruces y Validaciones" />
          <Atajo ruta="/control-escolar/exportacion" icono="sync_alt" texto="Preparar Exportación SADCE" />
        </div>
      </div>
    </aside>
  );
}

function Atajo({ ruta, icono, texto }: { ruta: string; icono: string; texto: string }) {
  return (
    <Link
      to={ruta}
      className="flex items-center justify-between rounded-lg bg-surface-container-low p-space-sm font-label-md text-label-md text-primary transition-colors hover:bg-surface-container"
    >
      <span className="flex items-center gap-2">
        <Simbolo nombre={icono} className="text-[18px]!" />
        <span>{texto}</span>
      </span>
      <Simbolo nombre="chevron_right" className="text-[18px]!" />
    </Link>
  );
}
