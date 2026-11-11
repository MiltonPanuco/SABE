// Exportación a SADCE: stitch/sabe_lotes_exportados_a_sadce_control_escolar.
// Lotes del periodo activo, movimientos aprobados por exportar y columnas del archivo (pestañas en la
// URL), con "Generar Excel de intercambio" y "Marcar como cargado en SADCE".
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { descargar } from "../api/client";
import {
  useGenerarLote,
  useLotes,
  useMarcarCargado,
  usePendientesExportacion,
  usePlantillaSadce,
  useResumenExportacion,
} from "../api/control";
import { usePeriodoActivo } from "../api/estudiante";
import type { EstadoLote, FiltrosLotes, FormatoLote, Lote, ResumenExportacion } from "../api/tipos";
import { Simbolo, Spinner } from "../components/acceso";
import { horarioDictamen, unir } from "../estudiante/formato";
import { diaHora, fechaPeriodo, horaMinuto } from "./fechas";
import { useCambiarFiltro } from "./filtrosUrl";
import { Modal } from "./Modal";
import { useAviso } from "./Toast";

type Vista = "lotes" | "pendientes" | "plantilla";
const VISTAS: Vista[] = ["lotes", "pendientes", "plantilla"];
const POR_PAGINA = 10;

const FORMATOS: Record<FormatoLote, { texto: string; icono: string; color: string }> = {
  xlsx: { texto: "Excel (.xlsx)", icono: "table_view", color: "text-tertiary-container" },
  csv: { texto: "CSV (.csv UTF-8)", icono: "data_object", color: "text-primary" },
};

function plural(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

function leerFiltros(params: URLSearchParams): FiltrosLotes {
  const formato = params.get("formato") ?? "";
  const estado = params.get("estado") ?? "";
  return {
    q: params.get("q") ?? "",
    formato: formato === "xlsx" || formato === "csv" ? formato : "",
    estado: estado === "exportado" || estado === "cargado" ? estado : "",
  };
}

function leerVista(params: URLSearchParams): Vista {
  const vista = params.get("vista") ?? "";
  return (VISTAS as string[]).includes(vista) ? (vista as Vista) : "lotes";
}

/** "Hoy, 11:20 hrs" o "12 Feb 2026, 11:20 hrs" */
function cuando(iso: string): string {
  const fecha = new Date(iso);
  const hoy = new Date().toDateString() === fecha.toDateString();
  return `${hoy ? "Hoy" : fechaPeriodo(fecha)}, ${horaMinuto(iso)} hrs`;
}

/** "8 Altas de asignatura, 4 Bajas" */
function desglose(altas: number, bajas: number): string {
  const partes = [];
  if (altas) partes.push(`${plural(altas, "Alta", "Altas")} de asignatura`);
  if (bajas) partes.push(plural(bajas, "Baja", "Bajas"));
  return partes.join(", ");
}

/** "10 Feb, 15:40" */
function diaComaHora(iso: string): string {
  const [dia, mes, hora] = diaHora(iso).split(" ");
  return `${dia} ${mes}, ${hora}`;
}

const archivoDe = (lote: Lote) => `${lote.folio}.${lote.formato}`;

export function ExportacionPage() {
  const { data: periodo, isPending: cargandoPeriodo } = usePeriodoActivo();
  const [params] = useSearchParams();
  const cambiar = useCambiarFiltro();
  const vista = leerVista(params);
  const aviso = useAviso();
  const { data: resumen } = useResumenExportacion();
  const [generando, setGenerando] = useState(false);
  const [porMarcar, setPorMarcar] = useState<Lote | null>(null);
  const cerrarGenerar = useCallback(() => setGenerando(false), []);
  const cerrarMarcar = useCallback(() => setPorMarcar(null), []);

  const bajar = (lote: Lote) =>
    descargar(`/exportaciones/${lote.id}/descargar/`, archivoDe(lote)).catch((e: Error) => aviso(e.message));

  if (!cargandoPeriodo && !periodo) {
    return (
      <div className="flex w-full flex-col gap-space-lg">
        <h1 className="font-display-lg text-display-lg tracking-tight text-primary">Exportación a SADCE — Historial de Lotes</h1>
        <div className="flex flex-col items-center gap-space-sm rounded-2xl bg-surface-container-lowest p-space-xl text-center shadow-sm">
          <p className="font-headline-sm text-headline-sm text-primary">No hay un periodo activo.</p>
          <Link
            to="/control-escolar/periodo"
            className="rounded-lg bg-primary-container px-space-md py-space-xs font-label-md text-label-md text-on-primary hover:bg-primary"
          >
            Ir a Periodo y Convocatoria
          </Link>
        </div>
      </div>
    );
  }

  const pendientes = resumen?.pendientes ?? 0;

  return (
    <div className="flex w-full flex-col">
      {/* Migas y encabezado */}
      <div className="mb-space-lg flex flex-col gap-space-xs">
        <nav className="flex flex-wrap items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
          <span>Ventanilla de Control Escolar</span>
          <Simbolo nombre="chevron_right" className="text-[14px]!" />
          <span>Mantenimiento</span>
          <Simbolo nombre="chevron_right" className="text-[14px]!" />
          <span className="font-semibold text-on-surface">Exportación a SADCE</span>
          <Simbolo nombre="chevron_right" className="text-[14px]!" />
          <span className="font-bold text-primary">
            {vista === "lotes" ? "Lotes Exportados" : vista === "pendientes" ? "Movimientos Pendientes" : "Plantilla del Excel"}
          </span>
        </nav>
        <div className="mt-space-xs flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
          <div>
            <h1 className="font-display-lg text-display-lg tracking-tight text-primary">Exportación a SADCE — Historial de Lotes</h1>
            <p className="mt-1 max-w-3xl font-body-lg text-body-lg text-on-surface-variant">
              Historial de Excel generados para que Control Escolar pase la información a SADCE.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <button
              type="button"
              onClick={() => cambiar("vista", "plantilla")}
              className="flex items-center gap-space-xs rounded-lg bg-surface-container-high px-space-md py-space-sm font-label-lg text-label-lg font-semibold text-on-surface shadow-sm transition-colors hover:bg-surface-container"
            >
              <Simbolo nombre="table_chart" className="text-[18px]!" />
              <span>Ver guía de estructura plana SADCE</span>
            </button>
            <button
              type="button"
              onClick={() => setGenerando(true)}
              disabled={!resumen || pendientes === 0}
              title={resumen && pendientes === 0 ? "No hay movimientos aprobados por exportar." : undefined}
              className="flex items-center gap-space-xs rounded-lg bg-primary-container px-space-md py-space-sm font-label-lg text-label-lg font-semibold text-on-primary shadow-md transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary-container"
            >
              <Simbolo nombre="file_download" className="text-[20px]!" />
              <span>Generar Excel de intercambio</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pestañas */}
      <div className="mb-space-lg flex items-center gap-space-sm overflow-x-auto pb-1" role="tablist">
        <Pestana activa={vista === "lotes"} icono="archive" texto="Lotes Exportados" alElegir={() => cambiar("vista", "")}>
          {resumen && (
            <span className="ml-space-xs rounded-full bg-primary-fixed px-2 py-0.5 font-label-sm text-label-sm font-bold text-on-primary-fixed">
              {plural(resumen.lotes, "lote", "lotes")}
            </span>
          )}
        </Pestana>
        <Pestana
          activa={vista === "pendientes"}
          icono="pending_actions"
          texto="Movimientos Pendientes de Exportar"
          alElegir={() => cambiar("vista", "pendientes")}
        >
          {resumen && (
            <span className="ml-space-xs rounded-full bg-secondary-fixed px-2 py-0.5 font-label-sm text-label-sm font-bold text-on-secondary-fixed">
              {plural(pendientes, "pendiente", "pendientes")}
            </span>
          )}
        </Pestana>
        <Pestana
          activa={vista === "plantilla"}
          icono="description"
          texto="Plantilla del Excel"
          alElegir={() => cambiar("vista", "plantilla")}
        />
      </div>

      <Tarjetas resumen={resumen} />

      <div className="mb-space-xl flex flex-col gap-space-lg rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        {vista === "lotes" && (
          <TablaLotes
            ciclo={periodo?.ciclo ?? ""}
            ultimo={resumen?.ultima?.folio}
            bajar={bajar}
            marcar={setPorMarcar}
          />
        )}
        {vista === "pendientes" && <TablaPendientes />}
        {vista === "plantilla" && <Plantilla />}
      </div>

      <div className="mb-space-xl flex flex-col items-start gap-space-md rounded-xl bg-surface-container p-space-lg shadow-sm md:flex-row">
        <div className="flex-1">
          <h3 className="font-headline-sm text-headline-sm font-bold text-primary">Aviso Operativo de Cierre de Trámites</h3>
          <p className="mt-1 font-body-md text-body-md leading-relaxed text-on-surface-variant">
            SABE no se conecta con SADCE. Control Escolar descarga el Excel, pasa la información a SADCE por su cuenta y después marca el
            lote como cargado.
          </p>
        </div>
      </div>

      {generando && resumen && (
        <ModalGenerar
          resumen={resumen}
          ciclo={periodo?.ciclo ?? ""}
          cerrar={cerrarGenerar}
          alGenerar={(lote) => {
            setGenerando(false);
            cambiar("vista", "");
            aviso(`${lote.folio} generado con éxito.`);
            void bajar(lote);
          }}
        />
      )}
      {porMarcar && <ModalCargado lote={porMarcar} ciclo={periodo?.ciclo ?? ""} cerrar={cerrarMarcar} />}
    </div>
  );
}

function Pestana({
  activa,
  icono,
  texto,
  alElegir,
  children,
}: {
  activa: boolean;
  icono: string;
  texto: string;
  alElegir: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      onClick={alElegir}
      className={`flex shrink-0 items-center gap-space-xs rounded-xl px-space-md py-space-sm font-label-lg text-label-lg ${
        activa
          ? "bg-surface-container-lowest font-bold text-primary shadow-sm"
          : "bg-surface-container font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
      }`}
    >
      <Simbolo nombre={icono} className="text-[18px]!" />
      <span>{texto}</span>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Tarjetas
// ---------------------------------------------------------------------------

function Tarjeta({ titulo, icono, iconoClase, children }: { titulo: string; icono: string; iconoClase: string; children: ReactNode }) {
  return (
    <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
      <div className="flex items-start justify-between gap-space-sm">
        <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">{titulo}</span>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconoClase}`}>
          <Simbolo nombre={icono} className="text-[18px]!" />
        </div>
      </div>
      {children}
    </div>
  );
}

function Tarjetas({ resumen }: { resumen: ResumenExportacion | undefined }) {
  const r = resumen;
  return (
    <div className="mb-space-xl grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-4">
      <Tarjeta titulo="Total Movimientos Dictaminados" icono="assignment_turned_in" iconoClase="bg-surface-container text-primary">
        <div className="my-space-sm">
          <div className="font-display-lg text-display-lg font-bold tracking-tight text-primary">{r?.dictaminados ?? "—"}</div>
        </div>
        <div className="flex items-center gap-space-sm rounded-lg bg-surface-container-low px-space-sm py-1 pt-space-xs">
          <div className="flex items-center gap-1 font-label-sm text-label-sm font-semibold text-tertiary-container">
            <span className="h-2 w-2 rounded-full bg-on-tertiary-container" />
            <span>{plural(r?.altas ?? 0, "Alta", "Altas")}</span>
          </div>
          <span className="text-outline-variant">•</span>
          <div className="flex items-center gap-1 font-label-sm text-label-sm font-semibold text-error">
            <span className="h-2 w-2 rounded-full bg-error" />
            <span>{plural(r?.bajas ?? 0, "Baja", "Bajas")}</span>
          </div>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Movimientos Cargados en SADCE" icono="check_circle" iconoClase="bg-tertiary-fixed text-on-tertiary-fixed-variant">
        <div className="my-space-sm flex items-baseline gap-space-sm">
          <span className="font-display-lg text-display-lg font-bold tracking-tight text-primary">{r?.cargados ?? "—"}</span>
          <span className="rounded-full bg-tertiary-fixed px-space-xs py-0.5 font-label-sm text-label-sm font-bold text-on-tertiary-fixed-variant">
            {r?.porcentaje_cargado ?? 0}% completado
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
          <div className="h-full rounded-full bg-on-tertiary-container" style={{ width: `${r?.porcentaje_cargado ?? 0}%` }} />
        </div>
      </Tarjeta>

      <Tarjeta titulo="Lotes en Espera de Carga" icono="hourglass_top" iconoClase="bg-secondary-fixed text-on-secondary-fixed-variant">
        <div className="my-space-sm flex items-baseline gap-space-sm">
          <span className="font-display-lg text-display-lg font-bold tracking-tight text-primary">{r?.lotes_en_espera ?? "—"}</span>
          <span className="font-body-md text-body-md font-medium text-on-surface-variant">{r?.lotes_en_espera === 1 ? "lote" : "lotes"}</span>
          <span className="rounded-full bg-secondary-fixed px-space-xs py-0.5 font-label-sm text-label-sm font-bold text-on-secondary-fixed">
            Pendientes
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {plural(r?.movimientos_en_espera ?? 0, "movimiento", "movimientos")} por validar en SADCE Central
        </p>
      </Tarjeta>

      <Tarjeta titulo="Última Exportación" icono="history" iconoClase="bg-surface-container text-primary">
        {r?.ultima ? (
          <>
            <div className="my-space-sm">
              <span className="font-headline-md text-headline-md font-bold text-primary">{cuando(r.ultima.fecha)}</span>
              {r.ultima.usuario && <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">Por {r.ultima.usuario}</p>}
            </div>
            <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
              <Simbolo nombre="verified" className="text-[14px]! text-tertiary-container" />
              <span>{r.ultima.folio} generado con éxito</span>
            </div>
          </>
        ) : (
          <div className="my-space-sm">
            <span className="font-headline-md text-headline-md font-bold text-primary">Sin exportaciones</span>
            <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">Aún no se genera ningún lote en este ciclo.</p>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lotes exportados
// ---------------------------------------------------------------------------

function Pastilla({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={`flex items-center gap-1 rounded px-space-sm py-1 font-label-sm text-label-sm ${
        activa ? "bg-surface-container-lowest font-bold text-primary shadow-xs" : "text-on-surface-variant hover:bg-surface-container"
      }`}
    >
      {children}
    </button>
  );
}

const TH = "py-space-sm px-space-md";

function TablaLotes({
  ciclo,
  ultimo,
  bajar,
  marcar,
}: {
  ciclo: string;
  ultimo: string | undefined;
  bajar: (lote: Lote) => void;
  marcar: (lote: Lote) => void;
}) {
  const [params] = useSearchParams();
  const cambiar = useCambiarFiltro();
  const filtros = leerFiltros(params);
  const [texto, setTexto] = useState(filtros.q);
  const [pagina, setPagina] = useState(1);
  const { data: lotes, isPending, error, refetch, isFetching } = useLotes(filtros);

  // El buscador espera 300 ms sin teclear antes de pedir la lista.
  useEffect(() => {
    const espera = window.setTimeout(() => cambiar("q", texto.trim()), 300);
    return () => window.clearTimeout(espera);
  }, [texto]); // Solo al teclear: `cambiar` lee la URL actual.

  // Con otros filtros se vuelve a la primera página.
  const clave = `${filtros.q}|${filtros.formato}|${filtros.estado}`;
  useEffect(() => setPagina(1), [clave]);

  const total = lotes?.length ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const visibles = (lotes ?? []).slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const movimientos = (lotes ?? []).reduce((suma, l) => suma + l.total_registros, 0);

  return (
    <>
      <div className="flex flex-col justify-between gap-space-md md:flex-row md:items-center">
        <div className="flex max-w-lg flex-1 items-center gap-space-sm">
          <div className="relative w-full">
            <Simbolo nombre="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px]! text-outline" />
            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={`Buscar por número de lote (ej. LOTE-${ciclo.replace("-", "")}-001) o usuario...`}
              aria-label="Buscar lote"
              className="w-full rounded-lg bg-surface-container-low py-2 pl-10 pr-4 font-body-md text-body-md text-on-surface shadow-inner focus:bg-surface-container-lowest focus:outline-none"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <div className="flex items-center gap-space-xs rounded-lg bg-surface-container-low p-1">
            <span className="px-space-xs font-label-sm text-label-sm uppercase text-on-surface-variant">Formato:</span>
            <Pastilla activa={!filtros.formato} onClick={() => cambiar("formato", "")}>Todos</Pastilla>
            <Pastilla activa={filtros.formato === "xlsx"} onClick={() => cambiar("formato", "xlsx")}>Excel</Pastilla>
            <Pastilla activa={filtros.formato === "csv"} onClick={() => cambiar("formato", "csv")}>CSV</Pastilla>
          </div>
          <div className="flex items-center gap-space-xs rounded-lg bg-surface-container-low p-1">
            <span className="px-space-xs font-label-sm text-label-sm uppercase text-on-surface-variant">Estado:</span>
            <Pastilla activa={!filtros.estado} onClick={() => cambiar("estado", "")}>Todos</Pastilla>
            {(["exportado", "cargado"] as EstadoLote[]).map((estado) => (
              <Pastilla key={estado} activa={filtros.estado === estado} onClick={() => cambiar("estado", estado)}>
                <span className={`h-1.5 w-1.5 rounded-full ${estado === "exportado" ? "bg-secondary-container" : "bg-on-tertiary-container"}`} />
                {estado === "exportado" ? "Exportado" : "Cargado"}
              </Pastilla>
            ))}
          </div>
          <button
            type="button"
            title="Refrescar lista"
            aria-label="Refrescar lista"
            onClick={() => void refetch()}
            className="rounded-lg bg-surface-container p-2 text-primary transition-colors hover:bg-surface-container-high"
          >
            <Simbolo nombre="refresh" className={`text-[20px]! ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left font-body-md text-body-md">
          <thead>
            <tr className="bg-surface-container-low font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">
              <th className={`${TH} rounded-l-lg`}>Lote ID</th>
              <th className={TH}>Fecha y Hora</th>
              <th className={TH}>Quién Exportó</th>
              <th className={TH}>Formato</th>
              <th className={`${TH} text-center`}>Movimientos</th>
              <th className={TH}>Estado SADCE</th>
              <th className={`${TH} rounded-r-lg text-right`}>Acciones de Ventanilla</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((lote) => (
              <FilaLote key={lote.id} lote={lote} reciente={lote.folio === ultimo} bajar={bajar} marcar={marcar} />
            ))}
          </tbody>
        </table>
        {isPending && (
          <div className="flex justify-center p-space-lg text-primary">
            <Spinner className="h-6 w-6" />
          </div>
        )}
        {error && <p className="p-space-lg text-center font-body-md text-body-md text-error">{error.message}</p>}
        {lotes && total === 0 && (
          <p className="p-space-lg text-center font-body-md text-body-md text-on-surface-variant">
            {filtros.q || filtros.formato || filtros.estado
              ? "Ningún lote coincide con la búsqueda."
              : "Aún no se genera ningún lote en este ciclo."}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center justify-between gap-space-md rounded-xl bg-surface-container-low p-space-md pt-space-md sm:flex-row">
        <div className="font-body-sm text-body-sm text-on-surface-variant">
          Mostrando{" "}
          <strong className="text-on-surface">
            {visibles.length} de {plural(total, "lote", "lotes")}
          </strong>{" "}
          generados en el Ciclo {ciclo} (Total acumulado: {plural(movimientos, "movimiento", "movimientos")})
        </div>
        <div className="flex items-center gap-space-xs">
          <BotonPagina deshabilitado={pagina === 1} onClick={() => setPagina(pagina - 1)}>
            Anterior
          </BotonPagina>
          {Array.from({ length: paginas }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPagina(n)}
              aria-current={n === pagina ? "page" : undefined}
              className={`rounded px-space-sm py-1 font-label-sm text-label-sm ${
                n === pagina ? "bg-primary font-bold text-on-primary" : "bg-surface-container-lowest text-on-surface hover:bg-surface-container"
              }`}
            >
              {n}
            </button>
          ))}
          <BotonPagina deshabilitado={pagina === paginas} onClick={() => setPagina(pagina + 1)}>
            Siguiente
          </BotonPagina>
        </div>
      </div>
    </>
  );
}

function BotonPagina({ deshabilitado, onClick, children }: { deshabilitado: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={deshabilitado}
      onClick={onClick}
      className="rounded bg-surface-container-lowest px-space-sm py-1 font-label-sm text-label-sm text-on-surface hover:bg-surface-container disabled:cursor-not-allowed disabled:text-outline-variant disabled:hover:bg-surface-container-lowest"
    >
      {children}
    </button>
  );
}

const TD = "py-space-md px-space-md";

function FilaLote({ lote, reciente, bajar, marcar }: { lote: Lote; reciente: boolean; bajar: (l: Lote) => void; marcar: (l: Lote) => void }) {
  const formato = FORMATOS[lote.formato];
  return (
    <tr className="transition-colors hover:bg-surface-container-low/60">
      <td className={`${TD} font-semibold text-primary`}>
        <div className="flex items-center gap-space-xs">
          <Simbolo nombre="folder_zip" className={`text-[20px]! ${reciente ? "text-primary" : "text-outline"}`} />
          <span className="font-headline-sm text-headline-sm tracking-tight text-primary">{lote.folio}</span>
        </div>
      </td>
      <td className={TD}>
        <div className="flex flex-col">
          <span className="font-semibold text-on-surface">{fechaPeriodo(lote.fecha)}</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">{horaMinuto(lote.fecha)} hrs</span>
        </div>
      </td>
      <td className={TD}>
        <div className="flex flex-col">
          <span className="font-semibold text-on-surface">{lote.usuario ?? "—"}</span>
          <span className="font-body-sm text-body-sm text-on-surface-variant">Ventanilla UAE</span>
        </div>
      </td>
      <td className={TD}>
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-space-xs py-0.5 font-label-sm text-label-sm font-semibold text-primary">
          <Simbolo nombre={formato.icono} className={`text-[16px]! ${formato.color}`} />
          {formato.texto}
        </span>
      </td>
      <td className={`${TD} text-center`}>
        <span
          className={`rounded-full px-space-sm py-1 font-label-md text-label-md font-bold ${
            reciente ? "bg-primary-fixed text-on-primary-fixed" : "bg-surface-container text-on-surface"
          }`}
        >
          {lote.total_registros} {lote.total_registros === 1 ? "mov" : "movs"}
        </span>
      </td>
      <td className={TD}>
        {lote.cargado ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-fixed px-space-sm py-1 font-label-sm text-label-sm font-bold text-on-tertiary-fixed-variant">
            <Simbolo nombre="check_circle" className="text-[16px]!" />
            Cargado en SADCE
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-fixed px-space-sm py-1 font-label-sm text-label-sm font-bold text-on-secondary-fixed shadow-xs">
            <Simbolo nombre="schedule" className="text-[16px]!" />
            Exportado (Pendiente)
          </span>
        )}
      </td>
      <td className={`${TD} text-right`}>
        <div className="flex items-center justify-end gap-space-xs">
          {lote.cargado ? (
            <>
              <button
                type="button"
                title="Descarga histórica"
                aria-label={`Descargar ${archivoDe(lote)}`}
                onClick={() => bajar(lote)}
                className="rounded-lg bg-surface-container p-2 text-primary transition-colors hover:bg-surface-container-high"
              >
                <Simbolo nombre="download" className="text-[18px]!" />
              </button>
              <div className="flex items-center gap-1 rounded-lg bg-surface-container-high px-space-sm py-1 font-label-sm text-label-sm font-semibold text-on-surface-variant">
                <Simbolo nombre="verified" className="text-[16px]! text-tertiary-container" />
                <span>Cargado {lote.fecha_carga && diaComaHora(lote.fecha_carga)}</span>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                title="Volver a descargar archivo"
                aria-label={`Descargar ${archivoDe(lote)}`}
                onClick={() => bajar(lote)}
                className="flex items-center gap-1 rounded-lg bg-surface-container p-2 font-label-sm text-label-sm font-semibold text-primary transition-colors hover:bg-surface-container-high"
              >
                <Simbolo nombre="download" className="text-[18px]!" />
                <span className="hidden xl:inline">Descargar</span>
              </button>
              <button
                type="button"
                onClick={() => marcar(lote)}
                className="flex items-center gap-1 rounded-lg bg-secondary-container px-space-sm py-1.5 font-label-sm text-label-sm font-bold text-on-secondary-container shadow-sm transition-colors hover:bg-secondary hover:text-on-secondary"
              >
                <Simbolo nombre="task_alt" className="text-[18px]!" />
                <span>Marcar como cargado en SADCE</span>
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Movimientos pendientes y plantilla
// ---------------------------------------------------------------------------

function TablaPendientes() {
  const { data: movimientos, isPending, error } = usePendientesExportacion();
  return (
    <>
      <div>
        <h2 className="font-headline-sm text-headline-sm font-bold text-primary">Movimientos aprobados listos para exportar</h2>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
          Todos entran al siguiente Excel de intercambio. Un movimiento solo se exporta en un lote.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left font-body-md text-body-md">
          <thead>
            <tr className="bg-surface-container-low font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">
              <th className={`${TH} rounded-l-lg`}>Folio</th>
              <th className={TH}>Matrícula</th>
              <th className={TH}>Alumno</th>
              <th className={TH}>Tipo Trámite</th>
              <th className={TH}>Unidad de Aprendizaje</th>
              <th className={TH}>Horario</th>
              <th className={TH}>Docente</th>
              <th className={`${TH} rounded-r-lg`}>Estado SADCE</th>
            </tr>
          </thead>
          <tbody>
            {movimientos?.map((m) => (
              <tr key={m.id} className="transition-colors hover:bg-surface-container-low/60">
                <td className={`${TD} whitespace-nowrap font-semibold text-primary`}>{m.folio}</td>
                <td className={`${TD} font-mono text-on-surface`}>{m.matricula}</td>
                <td className={TD}>
                  <div className="flex flex-col">
                    <span className="font-semibold text-on-surface">{m.alumno}</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">{m.programa}</span>
                  </div>
                </td>
                <td className={TD}>
                  <span
                    className={`rounded px-2 py-0.5 font-label-sm text-label-sm font-bold ${
                      m.tipo === "ALTA" ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-error-container text-on-error-container"
                    }`}
                  >
                    {m.tipo === "ALTA" ? "Alta" : "Baja"}
                  </span>
                </td>
                <td className={TD}>
                  <div className="flex flex-col">
                    <span className="font-semibold text-on-surface">{m.materia}</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {m.clave} • Gpo {m.grupo}
                    </span>
                  </div>
                </td>
                <td className={`${TD} font-body-sm text-body-sm text-on-surface-variant`}>{horarioDictamen(m.horarios)}</td>
                <td className={`${TD} text-on-surface`}>{m.docente}</td>
                <td className={TD}>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-secondary-fixed px-space-sm py-1 font-label-sm text-label-sm font-bold text-on-secondary-fixed">
                    <Simbolo nombre="schedule" className="text-[14px]!" />
                    Listo para exportar
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isPending && (
          <div className="flex justify-center p-space-lg text-primary">
            <Spinner className="h-6 w-6" />
          </div>
        )}
        {error && <p className="p-space-lg text-center font-body-md text-body-md text-error">{error.message}</p>}
        {movimientos?.length === 0 && (
          <p className="p-space-lg text-center font-body-md text-body-md text-on-surface-variant">No hay movimientos aprobados por exportar.</p>
        )}
      </div>
    </>
  );
}

function Plantilla() {
  const { data: columnas, isPending, error } = usePlantillaSadce();
  return (
    <>
      <div>
        <h2 className="font-headline-sm text-headline-sm font-bold text-primary">Estructura plana del Excel de intercambio</h2>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
          Una fila por movimiento (cada alta o baja aprobada) y un solo renglón de encabezados, en este orden. El CSV usa las mismas
          columnas, en UTF-8.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left font-body-md text-body-md">
          <thead>
            <tr className="bg-surface-container-low font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">
              <th className={`${TH} rounded-l-lg`}>#</th>
              <th className={TH}>Columna</th>
              <th className={TH}>Contenido</th>
              <th className={`${TH} rounded-r-lg`}>Ejemplo</th>
            </tr>
          </thead>
          <tbody>
            {columnas?.map((c, i) => (
              <tr key={c.encabezado} className="transition-colors hover:bg-surface-container-low/60">
                <td className={`${TD} font-mono text-on-surface-variant`}>{String.fromCharCode(65 + i)}</td>
                <td className={`${TD} whitespace-nowrap font-semibold text-primary`}>{c.encabezado}</td>
                <td className={`${TD} text-on-surface`}>{c.descripcion}</td>
                <td className={`${TD} whitespace-nowrap font-mono text-on-surface-variant`}>{c.ejemplo}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isPending && (
          <div className="flex justify-center p-space-lg text-primary">
            <Spinner className="h-6 w-6" />
          </div>
        )}
        {error && <p className="p-space-lg text-center font-body-md text-body-md text-error">{error.message}</p>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Ventanas
// ---------------------------------------------------------------------------

function EncabezadoModal({ icono, titulo, id, ciclo, cerrar }: { icono: string; titulo: string; id: string; ciclo: string; cerrar: () => void }) {
  return (
    <div className="flex items-center justify-between bg-primary-container p-space-lg text-on-primary">
      <div className="flex items-center gap-space-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-highest/20 text-primary-fixed">
          <Simbolo nombre={icono} className="text-[24px]!" />
        </div>
        <div>
          <h2 id={id} className="font-headline-md text-headline-md font-bold tracking-tight text-on-primary">
            {titulo}
          </h2>
          <p className="font-label-sm text-label-sm text-primary-fixed">Ventanilla de Control Escolar UAE • Convocatoria {ciclo}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar"
        className="rounded-lg p-1 text-surface-variant transition-colors hover:bg-surface-container-highest/20 hover:text-on-primary"
      >
        <Simbolo nombre="close" className="text-[22px]!" />
      </button>
    </div>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-space-sm pb-space-xs">
      <span className="font-label-sm text-label-sm uppercase text-on-surface-variant">{etiqueta}</span>
      {children}
    </div>
  );
}

function ModalGenerar({
  resumen,
  ciclo,
  cerrar,
  alGenerar,
}: {
  resumen: ResumenExportacion;
  ciclo: string;
  cerrar: () => void;
  alGenerar: (lote: Lote) => void;
}) {
  const [formato, setFormato] = useState<FormatoLote>("xlsx");
  const generar = useGenerarLote();
  const { data: movimientos } = usePendientesExportacion();
  const altas = movimientos?.filter((m) => m.tipo === "ALTA").length ?? 0;
  const bajas = (movimientos?.length ?? 0) - altas;
  const alumnos = new Set(movimientos?.map((m) => m.matricula)).size;
  const programas = [...new Set(movimientos?.map((m) => m.programa))].sort();
  const siguiente = `LOTE-${ciclo.replace("-", "")}-${String(resumen.lotes + 1).padStart(3, "0")}`;

  return (
    <Modal cerrar={cerrar} fondo="bg-primary/40 backdrop-blur-sm" className="flex max-h-[90vh] max-w-xl flex-col overflow-hidden" titulo="titulo-generar">
      <EncabezadoModal icono="file_download" titulo="Generar Excel de intercambio" id="titulo-generar" ciclo={ciclo} cerrar={cerrar} />
      <div className="flex flex-col gap-space-md overflow-y-auto p-space-lg">
        <div className="flex items-start gap-space-sm rounded-xl bg-primary-fixed/50 p-space-md text-on-primary-fixed">
          <Simbolo nombre="info" className="mt-0.5 shrink-0 text-[22px]! text-primary" />
          <div className="font-body-md text-body-md font-medium">
            Se incluirán <strong>{plural(resumen.pendientes, "movimiento aprobado", "movimientos aprobados")}</strong> que aún no se
            exportan. Después de pasarlos a SADCE, marca el lote como cargado.
          </div>
        </div>
        <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
          <Dato etiqueta="Identificador de Lote:">
            <span className="rounded bg-surface-container-highest px-space-xs py-0.5 font-label-lg text-label-lg font-bold text-primary">{siguiente}</span>
          </Dato>
          {movimientos && (
            <>
              <Dato etiqueta="Población estudiantil:">
                <span className="text-right font-body-md text-body-md font-semibold text-on-surface">
                  {plural(alumnos, "alumno", "alumnos")} de {unir(programas)}
                </span>
              </Dato>
              <Dato etiqueta="Desglose de movimientos:">
                <span className="text-right font-body-md text-body-md text-on-surface">
                  {desglose(altas, bajas)}
                </span>
              </Dato>
            </>
          )}
        </div>
        <fieldset className="flex flex-col gap-space-xs">
          <legend className="mb-space-xs font-label-sm text-label-sm uppercase text-on-surface-variant">Formato del archivo</legend>
          <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
            {(Object.keys(FORMATOS) as FormatoLote[]).map((f) => (
              <label
                key={f}
                className={`flex cursor-pointer items-center gap-space-sm rounded-xl border-2 p-space-sm transition-colors ${
                  formato === f ? "border-primary bg-primary-fixed/30" : "border-transparent bg-surface-container-low hover:bg-surface-container"
                }`}
              >
                <input
                  type="radio"
                  name="formato"
                  value={f}
                  checked={formato === f}
                  onChange={() => setFormato(f)}
                  className="h-4 w-4 accent-primary"
                />
                <Simbolo nombre={FORMATOS[f].icono} className={`text-[20px]! ${FORMATOS[f].color}`} />
                <span className="font-label-lg text-label-lg font-semibold text-on-surface">{FORMATOS[f].texto}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {generar.error && <p className="font-body-sm text-body-sm text-error">{generar.error.message}</p>}
      </div>
      <div className="flex flex-col-reverse items-stretch justify-end gap-space-sm bg-surface-container-low p-space-md sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={cerrar}
          className="rounded-lg bg-surface-container px-space-md py-space-sm font-label-lg text-label-lg font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={generar.isPending}
          onClick={() => generar.mutate(formato, { onSuccess: alGenerar })}
          className="flex items-center justify-center gap-space-xs rounded-lg bg-primary-container px-space-md py-space-sm font-label-lg text-label-lg font-bold text-on-primary shadow-md transition-colors hover:bg-primary disabled:opacity-60"
        >
          {generar.isPending ? <Spinner /> : <Simbolo nombre="file_download" className="text-[20px]!" />}
          Generar y descargar
        </button>
      </div>
    </Modal>
  );
}

function ModalCargado({ lote, ciclo, cerrar }: { lote: Lote; ciclo: string; cerrar: () => void }) {
  const [verificado, setVerificado] = useState(false);
  const marcar = useMarcarCargado();
  const aviso = useAviso();

  const confirmar = () =>
    marcar.mutate(lote.id, {
      onSuccess: (hecho) => {
        cerrar();
        aviso(`${hecho.folio} marcado como cargado en SADCE. ${plural(hecho.alumnos, "alumno notificado", "alumnos notificados")}.`);
      },
    });

  return (
    <Modal cerrar={cerrar} fondo="bg-primary/40 backdrop-blur-sm" className="flex max-h-[90vh] max-w-xl flex-col overflow-hidden" titulo="titulo-cargado">
      <EncabezadoModal icono="task_alt" titulo="Confirmar Carga Manual en SADCE" id="titulo-cargado" ciclo={ciclo} cerrar={cerrar} />
      <div className="flex flex-col gap-space-md overflow-y-auto p-space-lg">
        <div className="flex items-start gap-space-sm rounded-xl bg-secondary-fixed/50 p-space-md text-on-secondary-fixed">
          <Simbolo nombre="notification_important" className="mt-0.5 shrink-0 text-[22px]! text-secondary" />
          <div className="font-body-md text-body-md font-medium">
            Se marcarán <strong>{plural(lote.total_registros, "movimiento", "movimientos")}</strong> como cargados en SADCE y se notificará
            a los alumnos.
          </div>
        </div>
        <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
          <Dato etiqueta="Identificador de Lote:">
            <span className="rounded bg-surface-container-highest px-space-xs py-0.5 font-label-lg text-label-lg font-bold text-primary">{lote.folio}</span>
          </Dato>
          <Dato etiqueta="Población estudiantil:">
            <span className="text-right font-body-md text-body-md font-semibold text-on-surface">
              {plural(lote.alumnos, "alumno", "alumnos")} de {unir(lote.programas)}
            </span>
          </Dato>
          <Dato etiqueta="Desglose de movimientos:">
            <span className="text-right font-body-md text-body-md text-on-surface">{desglose(lote.altas, lote.bajas)}</span>
          </Dato>
        </div>
        <label className="flex cursor-pointer items-start gap-space-sm rounded-lg p-space-sm transition-colors hover:bg-surface-container-low">
          <input
            type="checkbox"
            checked={verificado}
            onChange={(e) => setVerificado(e.target.checked)}
            className="mt-1 h-4 w-4 cursor-pointer rounded accent-primary"
          />
          <span className="select-none font-body-sm text-body-sm leading-tight text-on-surface">
            Confirmo que verifiqué la carga manual en el sistema SADCE de la Universidad Autónoma de Nayarit.
          </span>
        </label>
        {marcar.error && <p className="font-body-sm text-body-sm text-error">{marcar.error.message}</p>}
      </div>
      <div className="flex flex-col-reverse items-stretch justify-end gap-space-sm bg-surface-container-low p-space-md sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={cerrar}
          className="rounded-lg bg-surface-container px-space-md py-space-sm font-label-lg text-label-lg font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!verificado || marcar.isPending}
          onClick={confirmar}
          className="flex items-center justify-center gap-space-xs rounded-lg bg-tertiary-container px-space-md py-space-sm font-label-lg text-label-lg font-bold text-on-tertiary shadow-md transition-colors hover:bg-tertiary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-tertiary-container"
        >
          {marcar.isPending ? <Spinner /> : <Simbolo nombre="check_circle" className="text-[20px]!" />}
          Confirmar carga y notificar
        </button>
      </div>
    </Modal>
  );
}
