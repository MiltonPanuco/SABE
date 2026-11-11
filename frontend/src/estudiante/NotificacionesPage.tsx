// Centro de Notificaciones del estudiante: stitch/sabe_panel_de_notificaciones_estudiante_y_control_escolar.
// Va dentro del portal del estudiante; "Ver dictamen…" abre la página del folio en lugar del modal de stitch.
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLeer, useLeerTodas, useNotificaciones } from "../api/avisos";
import { usePeriodoActivo } from "../api/estudiante";
import type { CategoriaNotificacion, FiltrosNotificaciones, HorarioClase, Notificacion } from "../api/tipos";
import { useAuth } from "../auth/AuthProvider";
import { Simbolo, Spinner } from "../components/acceso";
import { cuandoAviso, porDia } from "../components/notificaciones";
import { avanceVentana, diaHora } from "../control/fechas";
import { useCambiarFiltro } from "../control/filtrosUrl";
import { horarioDictamen } from "./formato";

const POR_PAGINA = 20;
const CATEGORIAS: { valor: "" | CategoriaNotificacion; texto: string }[] = [
  { valor: "", texto: "Todas las categorías" },
  { valor: "tramites", texto: "Trámites y Folios" },
  { valor: "resoluciones", texto: "Resoluciones" },
  { valor: "convocatoria", texto: "Convocatoria UAN" },
];

function leerFiltros(params: URLSearchParams, limite: number): FiltrosNotificaciones {
  const categoria = params.get("categoria") ?? "";
  return {
    estado: params.get("estado") === "no_leidas" ? "no_leidas" : "",
    categoria: CATEGORIAS.some((c) => c.valor === categoria) ? (categoria as CategoriaNotificacion) : "",
    q: params.get("q") ?? "",
    orden: "",
    limite,
  };
}

/** "08 Feb" y "13 Feb (23:59)" para la caja de la convocatoria. */
function diaCorto(iso: string) {
  return diaHora(iso).split(" ").slice(0, 2).join(" ");
}

export function NotificacionesPage() {
  const [params] = useSearchParams();
  const cambiar = useCambiarFiltro();
  const [limite, setLimite] = useState(POR_PAGINA);
  const filtros = leerFiltros(params, limite);
  const [texto, setTexto] = useState(filtros.q);
  const { data, isPending, error, isFetching } = useNotificaciones(filtros);
  const leerTodas = useLeerTodas();
  const { usuario } = useAuth();
  const { data: periodo } = usePeriodoActivo();
  const perfil = usuario?.estudiante;

  // El buscador espera 300 ms sin teclear.
  useEffect(() => {
    const espera = window.setTimeout(() => cambiar("q", texto.trim()), 300);
    return () => window.clearTimeout(espera);
  }, [texto]); // Solo al teclear: `cambiar` lee la URL actual.

  const conteos = data?.conteos;
  const avisos = data?.resultados ?? [];

  return (
    <div className="flex w-full flex-col gap-space-lg pb-space-xl">
      {/* Barra del perfil */}
      <div className="flex w-full flex-col items-center justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm md:flex-row">
        <span className="hidden font-label-sm text-label-sm text-on-surface-variant md:inline">
          {periodo ? `Ciclo ${periodo.ciclo} • ` : ""}Facultad de Economía UAN
        </span>
        {usuario && (
          <div className="flex w-full items-center justify-between gap-space-sm rounded-full bg-surface-container-low/70 px-space-md py-space-xs md:w-auto md:justify-start">
            <div className="flex min-w-0 items-center gap-space-sm">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
                <Simbolo nombre="account_circle" className="text-[16px]!" />
              </div>
              <div className="flex min-w-0 flex-col text-left">
                <span className="truncate font-label-md text-label-md leading-none font-semibold text-on-surface">
                  {usuario.nombre} {usuario.apellidos}
                </span>
                {perfil && (
                  <span className="mt-0.5 truncate font-body-sm text-body-sm leading-none text-on-surface-variant">
                    Mat. {perfil.matricula} • Licenciatura en {perfil.programa}
                  </span>
                )}
              </div>
            </div>
            <span className="ml-space-sm rounded bg-tertiary-container px-space-xs py-0.5 font-label-sm text-label-sm font-semibold tracking-wider text-tertiary-fixed-dim uppercase">
              Activo
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-space-md lg:col-span-8">
          {/* Encabezado y filtros */}
          <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <div className="flex flex-col justify-between gap-space-sm sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-space-xs">
                  <Simbolo nombre="notifications_active" className="text-[24px]! text-primary" />
                  <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Centro de Notificaciones</h1>
                </div>
                <p className="mt-0.5 font-body-md text-body-md text-on-surface-variant">
                  Historial de avisos oficiales, resoluciones del proceso SABE y avisos de convocatoria
                  {periodo ? ` para el Ciclo ${periodo.ciclo}` : ""}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => leerTodas.mutate()}
                disabled={!data?.no_leidas || leerTodas.isPending}
                className="flex items-center gap-space-xs self-start rounded-lg px-space-md py-space-xs font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container disabled:opacity-50 disabled:hover:bg-transparent sm:self-center"
              >
                <Simbolo nombre="done_all" className="text-[18px]!" />
                <span>Marcar todas como leídas</span>
              </button>
            </div>
            <div className="flex flex-col items-stretch justify-between gap-space-sm pt-space-xs sm:flex-row sm:items-center">
              <div className="flex items-center gap-space-xs rounded-lg bg-surface-container-low p-1" role="tablist">
                <Pestana activa={!filtros.estado} onClick={() => cambiar("estado", "")} texto="Todas">
                  <span className="rounded-full bg-surface-container px-1.5 font-label-sm text-label-sm text-on-surface-variant">
                    {conteos?.todas ?? 0}
                  </span>
                </Pestana>
                <Pestana activa={filtros.estado === "no_leidas"} onClick={() => cambiar("estado", "no_leidas")} texto="Sin leer">
                  <span className="rounded-full bg-secondary-container px-1.5 font-label-sm text-label-sm font-bold text-on-secondary-container">
                    {conteos?.no_leidas ?? 0}
                  </span>
                </Pestana>
              </div>
              <div className="relative flex-1 sm:max-w-xs">
                <Simbolo nombre="search" className="absolute top-2.5 left-3 text-[18px]! text-on-surface-variant" />
                <input
                  type="text"
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder={`Buscar por folio ej. SABE-${new Date().getFullYear()}...`}
                  aria-label="Buscar notificación"
                  className="w-full rounded-lg bg-surface-container-low py-1.5 pr-space-md pl-9 font-body-md text-body-md text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-space-xs pt-space-xs">
              {CATEGORIAS.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  aria-pressed={filtros.categoria === c.valor}
                  onClick={() => cambiar("categoria", c.valor)}
                  className={`rounded-full px-space-sm py-1 font-label-sm text-label-sm transition-all ${
                    filtros.categoria === c.valor
                      ? "bg-primary font-semibold text-on-primary"
                      : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {c.texto}
                </button>
              ))}
            </div>
          </div>

          {/* Avisos por día */}
          <div className="flex flex-col gap-space-md">
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
                  {filtros.q || filtros.categoria || filtros.estado
                    ? "Ninguna notificación coincide con los filtros."
                    : "No tienes notificaciones por ahora."}
                </p>
              </div>
            )}
            {porDia(avisos).map(([dia, delDia], i) => (
              <div key={dia} className="flex flex-col gap-space-md">
                <div className={`flex items-center gap-space-sm px-space-xs ${i ? "pt-space-xs" : ""}`}>
                  <span className="font-label-sm text-label-sm font-bold tracking-wider text-on-surface-variant uppercase">{dia}</span>
                  <div className="h-px flex-1 bg-outline-variant/30" />
                </div>
                {delDia.map((aviso) => (
                  <Tarjeta key={aviso.id} aviso={aviso} />
                ))}
              </div>
            ))}
            {data && data.total > avisos.length && (
              <button
                type="button"
                onClick={() => setLimite(limite + POR_PAGINA)}
                disabled={isFetching}
                className="self-center rounded-lg bg-surface-container-lowest px-space-md py-space-xs font-label-md text-label-md font-semibold text-primary shadow-sm hover:bg-surface-container-high"
              >
                Cargar anteriores ({data.total - avisos.length})
              </button>
            )}
          </div>
        </div>

        {/* Columna derecha */}
        <div className="flex flex-col gap-space-md lg:col-span-4">
          <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <div className="flex items-center justify-between">
              <img alt="SABE" className="h-10 w-auto object-contain" src="/img/sabe-logo.png" />
              <img alt="Escudo Unidad Académica de Economía UAN" className="h-14 w-auto object-contain" src="/img/escudo-uae.png" />
            </div>
            <div>
              <span className="font-label-sm text-label-sm font-bold tracking-wider text-on-surface-variant uppercase">
                Unidad Académica de Economía
              </span>
              <h2 className="mt-0.5 font-headline-sm text-headline-sm font-bold text-on-surface">Sistema de Notificaciones Oficiales</h2>
              <p className="mt-1 font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
                Notificaciones emitidas por Control Escolar de la Unidad Académica de Economía para seguimiento de trámites oficiales.
              </p>
            </div>
            {periodo && <Convocatoria periodo={periodo} />}
          </div>
          <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Atención y Soporte</h2>
            <div className="flex flex-col gap-space-xs rounded-lg bg-surface-container-low p-space-md">
              <span className="flex items-center gap-1.5 font-label-md text-label-md font-semibold text-primary">
                <Simbolo nombre="info" className="text-[18px]!" />
                Estado del Sistema
              </span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Recepción de solicitudes y dictámenes en línea activos durante toda la jornada.
              </p>
            </div>
            <div className="flex items-start gap-space-sm rounded-lg bg-surface-container p-space-sm">
              <Simbolo nombre="support_agent" className="mt-0.5 shrink-0 text-[20px]! text-primary" />
              <div className="font-body-sm text-body-sm text-on-surface">
                ¿Dudas sobre un dictamen? Acude a ventanilla 3 de la Facultad de Economía de 09:00 a 14:00 hrs con tu acuse impreso.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pestana({ activa, onClick, texto, children }: { activa: boolean; onClick: () => void; texto: string; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      onClick={onClick}
      className={`flex items-center gap-space-xs rounded-lg px-space-md py-1.5 font-label-md text-label-md transition-all ${
        activa ? "bg-surface-container-lowest font-semibold text-on-surface shadow-sm" : "text-on-surface-variant hover:text-on-surface"
      }`}
    >
      <span>{texto}</span>
      {children}
    </button>
  );
}

function Convocatoria({ periodo }: { periodo: { ciclo: string; convocatoria_inicio: string; convocatoria_fin: string } }) {
  const ahora = new Date();
  const abre = new Date(periodo.convocatoria_inicio);
  const cierra = new Date(periodo.convocatoria_fin);
  const estado = ahora < abre ? "Programada" : ahora > cierra ? "Cerrada" : "En Curso";
  const { porcentaje } = avanceVentana(periodo.convocatoria_inicio, periodo.convocatoria_fin, ahora);
  return (
    <div className="flex flex-col gap-space-sm rounded-lg bg-surface-container-low p-space-md">
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-label-sm font-semibold text-on-surface">Convocatoria {periodo.ciclo}</span>
        <span
          className={`rounded px-2 py-0.5 font-label-sm text-label-sm font-bold ${
            estado === "En Curso" ? "bg-tertiary-container text-tertiary-fixed-dim" : "bg-surface-container-high text-on-surface-variant"
          }`}
        >
          {estado}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-outline-variant/30">
        <div className="h-full bg-secondary-container" style={{ width: `${porcentaje}%` }} />
      </div>
      <div className="flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
        <span>Inició: {diaCorto(periodo.convocatoria_inicio)}</span>
        <span>
          Cierre: {diaCorto(periodo.convocatoria_fin)} ({diaHora(periodo.convocatoria_fin).split(" ")[2]})
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tarjetas (clases de los <article> de stitch, por tipo)
// ---------------------------------------------------------------------------

interface Estilo {
  icono: string;
  caja: string;
  chip?: string;
  chipClase?: string;
  barra: string;
}

function estiloDe(aviso: Notificacion): Estilo {
  const alta = aviso.datos.movimiento !== "BAJA";
  switch (aviso.tipo) {
    case "cargada_sadce":
      return {
        icono: "verified",
        caja: "bg-tertiary-container text-on-tertiary-container",
        chip: "Cargada en SADCE",
        chipClase: "bg-tertiary-container text-tertiary-fixed-dim font-semibold",
        barra: "bg-primary",
      };
    case "movimiento_aprobado":
      return {
        icono: alta ? "add_task" : "task_alt",
        caja: "bg-tertiary-container text-tertiary-fixed-dim",
        chip: alta ? "Alta Aprobada" : "Baja Aprobada",
        chipClase: "bg-surface-container text-on-surface-variant font-semibold",
        barra: "bg-primary",
      };
    case "movimiento_rechazado":
      return {
        icono: "cancel",
        caja: "bg-error-container text-error",
        chip: alta ? "Alta No Procedente" : "Baja No Procedente",
        chipClase: "bg-error-container text-error font-bold",
        barra: "bg-primary",
      };
    case "folio_enviado":
      return {
        icono: "send",
        caja: "bg-surface-container-high text-primary",
        chip: "Enviada a Revisión",
        chipClase: "bg-surface-container-high text-primary font-semibold",
        barra: "bg-primary",
      };
    case "convocatoria_cierra":
      return {
        icono: "timer",
        caja: "bg-secondary-fixed text-on-secondary-fixed",
        chip: "Aviso Oficial",
        chipClase: "bg-secondary-fixed text-on-secondary-fixed font-bold",
        barra: "bg-secondary-container",
      };
    default:
      return { icono: "campaign", caja: "bg-surface-container-high text-primary", barra: "bg-primary" };
  }
}

/** "Folio SABE-2026-014. …" con el folio en negritas, como en stitch. */
function conFolio(texto: string, folio: string | null): ReactNode {
  if (!folio || !texto.includes(folio)) return texto;
  const [antes, despues] = texto.split(folio, 2);
  return (
    <>
      {antes}
      <strong className="font-semibold text-on-surface">{folio}</strong>
      {despues}
    </>
  );
}

function Tarjeta({ aviso }: { aviso: Notificacion }) {
  const navigate = useNavigate();
  const leer = useLeer();
  const estilo = estiloDe(aviso);
  const rechazado = aviso.tipo === "movimiento_rechazado";
  // El folio va en su chip; en las altas aprobadas va en negritas dentro del texto (como en stitch).
  const chipFolio = aviso.folio && aviso.tipo !== "movimiento_aprobado";
  const cuerpo = rechazado && aviso.folio ? aviso.mensaje.replace(`Folio ${aviso.folio}. `, "") : aviso.mensaje;
  const abrible = aviso.solicitud !== null;

  const abrir = () => {
    if (!aviso.leida) leer.mutate(aviso.id);
    if (abrible) navigate(`/estudiante/historial/${aviso.solicitud}`);
  };

  return (
    <article
      onClick={abrir}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), abrir())}
      role={abrible ? "link" : undefined}
      tabIndex={0}
      className={`group relative overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-sm transition-all hover:shadow-md ${
        abrible ? "cursor-pointer" : ""
      } ${aviso.leida ? "opacity-90" : ""}`}
    >
      {!aviso.leida && <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${estilo.barra}`} />}
      <div className="flex items-start gap-space-md">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${estilo.caja}`}>
          <Simbolo nombre={estilo.icono} className="text-[22px]!" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-col justify-between gap-space-xs sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-space-xs">
              {chipFolio && (
                <span
                  className={`rounded px-space-xs py-0.5 font-label-sm text-label-sm ${
                    aviso.leida ? "bg-surface-container font-semibold text-on-surface-variant" : "bg-surface-container-high font-bold text-primary"
                  }`}
                >
                  {aviso.folio}
                </span>
              )}
              {estilo.chip && <span className={`rounded px-space-xs py-0.5 font-label-sm text-label-sm ${estilo.chipClase}`}>{estilo.chip}</span>}
              {!aviso.leida && <span className={`inline-block h-2 w-2 rounded-full ${estilo.barra}`} aria-label="Sin leer" />}
            </div>
            <span className="shrink-0 font-body-sm text-body-sm text-on-surface-variant">{cuandoAviso(aviso.fecha)}</span>
          </div>
          <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface transition-colors group-hover:text-primary">
            {aviso.titulo || aviso.mensaje}
          </h2>
          {aviso.titulo && (
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
              {aviso.tipo === "movimiento_aprobado" ? conFolio(cuerpo, aviso.folio) : cuerpo}
            </p>
          )}
          <Pie aviso={aviso} />
        </div>
      </div>
    </article>
  );
}

function Pie({ aviso }: { aviso: Notificacion }) {
  const { datos } = aviso;
  if (aviso.tipo === "cargada_sadce") {
    return (
      <div className="mt-space-sm flex items-center gap-space-md font-label-sm text-label-sm font-semibold text-primary">
        <span className="inline-flex items-center gap-1 transition-transform group-hover:translate-x-1">
          Ver dictamen completo y movimientos
          <Simbolo nombre="arrow_forward" className="text-[16px]!" />
        </span>
      </div>
    );
  }
  if (aviso.tipo === "movimiento_aprobado" && datos.horarios?.length) {
    const horarios: HorarioClase[] = datos.horarios.map((h) => ({ ...h, aula: "" }));
    return (
      <div className="mt-space-sm flex flex-wrap items-center gap-space-sm font-body-sm text-body-sm text-on-surface-variant">
        <span className="inline-flex items-center gap-1">
          <Simbolo nombre="schedule" className="text-[16px]! text-tertiary-fixed-dim" />
          {horarioDictamen(horarios)}
        </span>
        {datos.docente && (
          <>
            <span>•</span>
            <span>{datos.docente}</span>
          </>
        )}
      </div>
    );
  }
  if (aviso.tipo === "movimiento_rechazado") {
    return (
      <div className="mt-space-sm flex items-center gap-space-sm">
        <span className="flex items-center gap-1 font-label-sm text-label-sm font-semibold text-error">
          <Simbolo nombre="info" className="text-[16px]!" />
          Ver dictamen de Control Escolar
        </span>
      </div>
    );
  }
  if (aviso.tipo === "convocatoria_cierra") {
    return (
      <div className="mt-space-sm flex items-center gap-space-md">
        <Link
          to="/estudiante"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 font-label-sm text-label-sm font-bold text-secondary hover:underline"
        >
          Ver calendario de la Unidad Académica de Economía
          <Simbolo nombre="open_in_new" className="text-[16px]!" />
        </Link>
      </div>
    );
  }
  return null;
}
