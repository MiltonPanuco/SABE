// Vista 1 de stitch/sabe_estudiantes: tarjeta del alumno, convocatoria, trámite en curso y accesos.
import { Link } from "react-router-dom";
import { usePeriodoActivo } from "../api/estudiante";
import { useSolicitudes } from "../api/solicitudes";
import type { Solicitud } from "../api/tipos";
import { useAuth } from "../auth/AuthProvider";
import { Simbolo } from "../components/acceso";
import { ChipEstadoFolio } from "./folio";
import { fechaLarga } from "./formato";

const ACCESOS = [
  { ruta: "/estudiante/catalogo", icono: "add_box", fondo: "bg-primary-fixed text-primary", titulo: "Solicitar Alta", texto: "Asignaturas con cupo" },
  {
    ruta: "/estudiante/horario",
    icono: "remove_circle_outline",
    fondo: "bg-error-container text-on-error-container",
    titulo: "Solicitar Baja",
    texto: "Desde tu horario actual",
  },
  { ruta: "/estudiante/horario", icono: "calendar_month", fondo: "bg-surface-container-high text-primary", titulo: "Horario", texto: "Revisa tus materias inscritas" },
  {
    ruta: "/estudiante/historial",
    icono: "receipt_long",
    fondo: "bg-tertiary-fixed text-on-tertiary-fixed-variant",
    titulo: "Historial & Acuse",
    texto: "Comprobantes oficiales",
  },
];

export function DashboardPage() {
  const { usuario } = useAuth();
  const { data: periodo } = usePeriodoActivo();
  const { data: folios } = useSolicitudes();
  if (!usuario) return null;
  // Se sigue el folio pendiente más reciente (la lista viene del más nuevo al más viejo).
  const enCurso = folios?.find((f) => f.estado === "pendiente");

  const perfil = usuario.estudiante;
  const ciclo = periodo?.ciclo ?? "";
  const abierta = periodo?.convocatoria_abierta ?? false;

  return (
    <div className="flex flex-1 flex-col gap-space-lg">
      {/* Tarjeta del alumno */}
      <div className="relative w-full overflow-hidden rounded-xl bg-surface-container-lowest p-4 shadow-md sm:p-space-lg">
        <div className="relative z-10 flex flex-col items-start justify-between gap-4 sm:gap-space-lg lg:flex-row lg:items-center">
          <div className="flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-space-md lg:w-auto">
            <div className="relative shrink-0">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-surface-container-high bg-surface-container-lowest p-1.5 shadow-md sm:h-16 sm:w-16">
                <img alt="Escudo Oficial UAE" className="h-full w-full object-contain" src="/img/escudo-uae.png" />
              </div>
              <div className="absolute -right-1 -bottom-1 h-3.5 w-3.5 rounded-full bg-on-tertiary-container shadow-sm sm:h-4 sm:w-4" />
            </div>
            <div className="flex min-w-0 flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-headline-lg text-[18px] font-bold text-primary sm:text-headline-lg">
                  {usuario.nombre} {usuario.apellidos}
                </h1>
                <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 font-mono text-label-sm font-bold text-on-primary-container">
                  #{perfil?.matricula ?? usuario.username}
                </span>
                {perfil && (
                  <span className="rounded-full bg-on-tertiary-container/10 px-2.5 py-0.5 font-label-sm text-label-sm font-semibold text-on-tertiary-container">
                    {perfil.semestre}° Semestre
                  </span>
                )}
              </div>
              <span className="mt-1 font-body-md text-xs leading-snug text-on-surface-variant sm:text-body-md">
                {[perfil && `Licenciatura en ${perfil.programa}`, "Unidad Académica de Economía", ciclo && `Período ${ciclo}`]
                  .filter(Boolean)
                  .join(" • ")}
              </span>
            </div>
          </div>
          <div className="flex w-full flex-row items-center justify-stretch gap-2 sm:justify-end sm:gap-space-sm lg:w-auto">
            <Link
              to="/estudiante/horario"
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-surface-container-high px-3 py-2.5 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-highest sm:px-space-md lg:flex-none"
            >
              <Simbolo nombre="calendar_today" className="text-[18px]!" />
              <span>Ver Horario</span>
            </Link>
            <Link
              to="/estudiante/catalogo"
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary-container px-4 py-2.5 font-label-md text-label-md text-on-primary shadow-sm transition-all hover:bg-primary sm:px-space-lg lg:flex-none"
            >
              <Simbolo nombre="post_add" className="text-[18px]!" />
              <span>Modificar Carga</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Convocatoria */}
      <div className="flex w-full flex-col items-start justify-between gap-4 rounded-xl bg-gradient-to-r from-primary-container via-[#00385e] to-primary p-4 text-on-primary shadow-lg sm:gap-space-lg sm:p-space-lg md:flex-row md:items-center">
        <div className="flex items-start gap-3 sm:gap-space-md">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container sm:h-12 sm:w-12">
            <Simbolo nombre="campaign" className="text-[24px]! sm:text-[28px]!" />
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-secondary-container/20 px-2 py-0.5 font-label-sm text-label-sm font-bold tracking-wider text-secondary-fixed uppercase">
                {ciclo ? `Convocatoria ${ciclo}` : "Sin periodo activo"}
              </span>
            </div>
            <h2 className="mt-1 font-headline-md text-base font-semibold text-surface-bright sm:text-headline-md">
              Convocatoria de Altas y Bajas de Unidades de Aprendizaje
            </h2>
            <p className="mt-1 font-body-md text-xs text-on-primary-container sm:text-body-md">
              Fechas oficiales de atención de Control Escolar para el <strong>Ciclo {ciclo}</strong>.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg bg-white/10 px-3 py-2 font-mono text-xs text-secondary-fixed">
          <Simbolo nombre={abierta ? "verified" : "event_busy"} className="text-[16px]!" />
          <span>{abierta ? "Control Escolar Activo" : "Convocatoria cerrada"}</span>
        </div>
      </div>

      {/* Trámite en curso y accesos rápidos */}
      <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-4 shadow-sm sm:p-space-lg lg:col-span-7">
          {enCurso ? (
            <Seguimiento folio={enCurso} />
          ) : (
          <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-low text-primary-container">
              <Simbolo nombre="assignment_late" className="text-[32px]!" />
            </div>
            <h3 className="font-headline-sm text-lg font-bold text-primary">Sin trámite en curso</h3>
            <p className="mt-1 mb-4 max-w-md font-body-md text-sm text-on-surface-variant">
              Aún no has enviado ninguna solicitud de alta o baja para el Ciclo {ciclo}. Explora las asignaturas con cupo disponible.
            </p>
            <Link
              to="/estudiante/catalogo"
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 font-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-primary"
            >
              <Simbolo nombre="search" className="text-[18px]!" />
              <span>Ir al catálogo de asignaturas</span>
            </Link>
          </div>
          )}
        </div>

        <div className="flex flex-col gap-space-md lg:col-span-5">
          <div className="grid flex-1 grid-cols-2 gap-space-sm">
            {ACCESOS.map((a) => (
              <Link
                key={a.titulo}
                to={a.ruta}
                className="group flex cursor-pointer flex-col items-start justify-between rounded-xl bg-surface-container-lowest p-space-md text-left shadow-sm transition-all hover:bg-surface-container-low"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-transform group-hover:scale-105 ${a.fondo}`}>
                  <Simbolo nombre={a.icono} />
                </div>
                <div>
                  <span className="block font-headline-sm text-headline-sm text-primary">{a.titulo}</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">{a.texto}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** "Seguimiento de Solicitud" de stitch: folio en curso, revisor, los 3 pasos y los movimientos. */
function Seguimiento({ folio }: { folio: Solicitud }) {
  return (
    <div>
      <div className="mb-space-md flex items-center justify-between gap-2">
        <div className="flex items-center gap-space-xs">
          <Simbolo nombre="pending_actions" className="text-primary-container" />
          <h3 className="font-headline-sm text-headline-sm text-primary">Seguimiento de Solicitud</h3>
        </div>
        <ChipEstadoFolio solicitud={folio} className="text-xs" />
      </div>
      <Link
        to={`/estudiante/historial/${folio.id}`}
        className="mb-space-md flex flex-col items-start justify-between gap-space-sm rounded-xl bg-surface-container-low p-3 transition-colors hover:bg-surface-container sm:flex-row sm:items-center sm:p-space-md"
      >
        <div className="flex flex-col">
          <span className="font-mono font-label-sm text-label-sm text-on-surface-variant">FOLIO ASIGNADO</span>
          <span className="font-mono font-headline-md text-headline-md font-bold text-primary">#{folio.folio_digital}</span>
          <span className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">Enviado: {fechaLarga(folio.fecha_solicitud)}</span>
        </div>
        <div className="flex items-center gap-1 text-left sm:flex-col sm:items-end sm:text-right">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Revisor responsable</span>
          <span className="font-label-md text-label-md font-semibold text-on-surface">Control Escolar</span>
        </div>
      </Link>

      <div className="px-2 py-space-md">
        <div className="relative flex items-center justify-between">
          <div className="absolute top-1/2 right-6 left-6 h-1 -translate-y-1/2 bg-surface-container-highest" />
          <div className="absolute top-1/2 right-1/2 left-6 h-1 -translate-y-1/2 bg-on-tertiary-container" />
          <div className="z-10 flex flex-col items-center gap-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-tertiary-container text-xs font-bold text-on-tertiary-container shadow-sm ring-4 ring-surface-container-lowest sm:h-10 sm:w-10 sm:text-base">
              <Simbolo nombre="done" className="text-[18px]! sm:text-[20px]!" />
            </div>
            <span className="text-center font-label-sm text-[11px] font-bold text-on-surface">
              Paso 1<br />
              <span className="font-normal text-on-surface-variant">Ingresada</span>
            </span>
          </div>
          <div className="z-10 flex flex-col items-center gap-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-container font-bold text-on-secondary-container shadow-md ring-4 ring-surface-container-lowest sm:h-10 sm:w-10">
              <Simbolo nombre="hourglass_top" className="text-[18px]! sm:text-[20px]!" />
            </div>
            <span className="text-center font-label-sm text-[11px] font-bold text-on-secondary-container">
              Paso 2<br />
              <span className="font-semibold">En dictamen</span>
            </span>
          </div>
          <div className="z-10 flex flex-col items-center gap-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-high font-bold text-on-surface-variant ring-4 ring-surface-container-lowest sm:h-10 sm:w-10">
              <Simbolo nombre="database" className="text-[18px]! sm:text-[20px]!" />
            </div>
            <span className="text-center font-label-sm text-[11px] font-bold text-on-surface-variant">
              Paso 3<br />
              <span className="font-normal">Cargada en SADCE</span>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-space-sm border-t border-surface-container-high/40 pt-space-sm">
        <span className="mb-1.5 block font-mono font-label-sm text-xs text-on-surface-variant uppercase">Resumen de solicitud:</span>
        <div className="flex flex-wrap gap-2">
          {folio.movimientos.map((m) => {
            const alta = m.tipo_tramite === "ALTA";
            return (
              <span
                key={m.id}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-label-md text-xs font-semibold ${
                  alta ? "bg-on-tertiary-container/10 text-on-tertiary-container" : "bg-error-container text-on-error-container"
                }`}
              >
                <Simbolo nombre={alta ? "add_circle" : "remove_circle"} className="text-[15px]!" /> {alta ? "Alta" : "Baja"}:{" "}
                {m.grupo.materia.nombre} (Gpo {m.grupo.num_grupo})
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
