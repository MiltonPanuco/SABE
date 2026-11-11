// Periodo y convocatoria: stitch/sabe_periodo_y_convocatoria_control_escolar.
import { useCallback, useState, type FormEvent, type ReactNode } from "react";
import { useActivarPeriodo, useGuardarPeriodo, usePeriodos, useProgramas, useUltimaModificacion } from "../api/control";
import { ApiError } from "../api/client";
import type { EstadoConvocatoria, Periodo } from "../api/tipos";
import { Simbolo, Spinner } from "../components/acceso";
import {
  aInputFechaHora,
  avanceVentana,
  cierreAutomatico,
  deInputFechaHora,
  diaHora,
  dia,
  faltan,
  fechaBitacora,
  horaMinuto,
  rangoFechas,
  semanas,
} from "./fechas";
import { Modal } from "./Modal";
import { useVentanilla } from "./LayoutControlEscolar";
import { useAviso } from "./Toast";

/** "2026-A" → "26A" (insignia de la tabla). */
const insignia = (ciclo: string) => ciclo.slice(2).replace("-", "");

export function PeriodoPage() {
  const ventanilla = useVentanilla();
  const { data: periodos, isPending, error } = usePeriodos();
  const activo = periodos?.find((p) => p.activo) ?? null;
  // null: cerrado; "nuevo": alta; Periodo: edición.
  const [formulario, setFormulario] = useState<Periodo | "nuevo" | null>(null);
  const [porActivar, setPorActivar] = useState<Periodo | null>(null);
  const cerrarFormulario = useCallback(() => setFormulario(null), []);
  const cerrarActivar = useCallback(() => setPorActivar(null), []);

  return (
    <div className="flex w-full flex-col gap-space-lg">
      <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
        <div className="flex flex-col">
          <div className="mb-1 flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
            <span>{ventanilla}</span>
            <Simbolo nombre="chevron_right" className="text-[14px]!" />
            <span className="font-semibold text-primary">Parámetros Operativos</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-primary">Gestión de Periodos y Convocatoria</h1>
          <p className="mt-space-xs max-w-3xl font-body-md text-body-md text-on-surface-variant">
            Configuración de calendarios académicos oficiales, ventanas de captura de altas/bajas de la Facultad de Economía y
            control de ciclo activo para el sistema SABE.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-space-sm print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex cursor-pointer items-center gap-space-xs rounded-xl bg-surface-container-low px-space-md py-space-sm font-label-lg text-label-lg text-on-surface shadow-sm transition-all duration-150 hover:bg-surface-container"
          >
            <Simbolo nombre="print" className="text-[18px]!" />
            <span>Reporte Histórico</span>
          </button>
          <button
            type="button"
            onClick={() => setFormulario("nuevo")}
            className="flex cursor-pointer items-center gap-space-xs rounded-xl bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary shadow-md transition-all duration-150 hover:bg-primary"
          >
            <Simbolo nombre="add_circle" className="text-[20px]!" />
            <span>+ Nuevo periodo</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col items-start justify-between gap-space-md rounded-xl bg-secondary-fixed/20 p-space-md shadow-sm md:flex-row md:items-center">
        <div className="flex items-start gap-space-md">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container shadow-sm md:mt-0">
            <Simbolo nombre="gavel" className="text-[22px]!" />
          </div>
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-space-xs">
              <span className="font-headline-sm text-headline-sm font-bold text-secondary">Regla de Operación Institucional:</span>
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                Solo puede haber un periodo activo. Al activar otro, el anterior se desactiva.
              </span>
            </div>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              Al cambiar el periodo activo, las solicitudes y la oferta académica visible para los alumnos de Economía y Finanzas se
              vincularán al nuevo ciclo escolar seleccionado. El cambio tiene impacto sincrónico con las validaciones de cupo.
            </p>
          </div>
        </div>
      </div>

      {isPending && (
        <div className="flex items-center justify-center gap-2 p-space-xl font-body-md text-on-surface-variant">
          <Spinner className="h-5 w-5 text-primary-container" /> Cargando periodos…
        </div>
      )}
      {error && <div className="rounded-2xl bg-surface-container-lowest p-space-xl text-center font-body-md text-error">{error.message}</div>}
      {periodos && (activo ? <PeriodoActivo periodo={activo} /> : <SinPeriodoActivo />)}
      {periodos && <TablaPeriodos periodos={periodos} editar={setFormulario} activar={setPorActivar} />}

      {formulario && (
        <FormularioPeriodo periodo={formulario === "nuevo" ? null : formulario} activo={activo} cerrar={cerrarFormulario} />
      )}
      {porActivar && <ConfirmarActivar periodo={porActivar} activo={activo} cerrar={cerrarActivar} />}
    </div>
  );
}

function SinPeriodoActivo() {
  return (
    <div className="flex flex-col items-center gap-space-sm rounded-2xl bg-surface-container-lowest p-space-xl text-center shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container text-primary">
        <Simbolo nombre="event_busy" />
      </div>
      <p className="font-headline-sm text-headline-sm text-primary">No hay un periodo activo.</p>
      <p className="font-body-md text-body-md text-on-surface-variant">Activa uno de la tabla.</p>
    </div>
  );
}

const CONVOCATORIA: Record<EstadoConvocatoria, { texto: string; icono: string }> = {
  abierta: { texto: "Convocatoria abierta (En curso)", icono: "hourglass_top" },
  programada: { texto: "Convocatoria programada", icono: "schedule" },
  cerrada: { texto: "Convocatoria cerrada", icono: "lock" },
};

function PeriodoActivo({ periodo }: { periodo: Periodo }) {
  const { data: programas } = useProgramas();
  const estado = periodo.estado_convocatoria;
  const avance = avanceVentana(periodo.convocatoria_inicio, periodo.convocatoria_fin);
  const abierta = estado === "abierta";
  const circunferencia = 314.159;

  return (
    <div className="grid grid-cols-1 gap-space-lg xl:grid-cols-12">
      <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-surface-container-lowest p-space-lg shadow-sm xl:col-span-8">
        <div className="relative z-10 flex flex-col justify-between gap-space-md sm:flex-row sm:items-start">
          <div>
            <div className="mb-space-xs flex flex-wrap items-center gap-space-sm sm:flex-nowrap">
              <span className="font-headline-lg text-display-lg font-bold tracking-tight whitespace-nowrap text-primary">
                Ciclo {periodo.ciclo}
              </span>
              <span className="inline-flex shrink-0 items-center whitespace-nowrap gap-1.5 rounded-full bg-tertiary-fixed px-space-sm py-1 font-label-sm text-label-sm font-bold text-on-tertiary-fixed shadow-xs">
                <span className="h-2 w-2 animate-ping rounded-full bg-on-tertiary-container" />
                Periodo Activo
              </span>
            </div>
            <p className="flex items-center gap-space-xs font-body-md text-body-md text-on-surface-variant">
              <Simbolo nombre="school" className="text-[18px]! text-primary" />
              {programas?.map((p) => `Licenciatura en ${p.nombre}`).join(" • ")}
            </p>
          </div>
          <div className="flex flex-col items-start rounded-xl bg-surface-container-low p-space-sm sm:items-end">
            <div className="inline-flex items-center gap-1.5 font-label-md text-label-md font-bold text-secondary">
              <Simbolo nombre={CONVOCATORIA[estado].icono} className="text-[16px]! text-secondary" />
              <span>{CONVOCATORIA[estado].texto}</span>
            </div>
            <span className="mt-0.5 font-label-sm text-label-sm text-on-surface-variant">
              {estado === "abierta" && (
                <>
                  Cierra en <strong>{faltan(periodo.convocatoria_fin)}</strong> ({diaHora(periodo.convocatoria_fin)} hrs)
                </>
              )}
              {estado === "programada" && (
                <>
                  Abre en <strong>{faltan(periodo.convocatoria_inicio)}</strong> ({diaHora(periodo.convocatoria_inicio)} hrs)
                </>
              )}
              {estado === "cerrada" && <>Cerró el {diaHora(periodo.convocatoria_fin)} hrs</>}
            </span>
          </div>
        </div>

        <div className="relative z-10 my-space-lg grid grid-cols-1 gap-space-md rounded-xl bg-surface-container-low/60 p-space-md pt-space-md md:grid-cols-2">
          <div className="flex items-start gap-space-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest text-primary">
              <Simbolo nombre="calendar_month" className="text-[20px]!" />
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm font-semibold tracking-wider text-on-surface-variant uppercase">
                Semestre Lectivo Oficial
              </span>
              <span className="mt-0.5 font-headline-sm text-headline-sm font-semibold text-on-surface">
                {rangoFechas(periodo.fecha_inicio, periodo.fecha_fin)}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {semanas(periodo.fecha_inicio, periodo.fecha_fin)} semanas académicas • UAN Central
              </span>
            </div>
          </div>
          <div className="flex items-start gap-space-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-on-primary-fixed">
              <Simbolo nombre="rule_folder" className="text-[20px]!" />
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-label-sm font-semibold tracking-wider text-on-surface-variant uppercase">
                Ventana de Altas y Bajas SABE
              </span>
              <span className="mt-0.5 font-headline-sm text-headline-sm font-semibold text-on-surface">
                {diaHora(periodo.convocatoria_inicio)} — {diaHora(periodo.convocatoria_fin)}
              </span>
              <span className="font-body-sm text-body-sm font-semibold text-secondary">
                {abierta ? "Ventanilla en línea habilitada para alumnos" : "Ventanilla en línea cerrada para alumnos"}
              </span>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute -right-8 -bottom-10 text-primary opacity-5">
          <Simbolo nombre="history_edu" className="text-[240px]!" />
        </div>
      </div>

      <div className="flex flex-col gap-space-md xl:col-span-4">
        <div className="flex h-full flex-col justify-between rounded-2xl bg-surface-container-lowest p-space-lg shadow-sm">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md font-bold tracking-wider text-on-surface uppercase">Avance de Ventana</span>
              <span className="rounded-full bg-secondary-fixed/30 px-2 py-0.5 font-label-sm text-label-sm font-bold text-secondary">
                Día {avance.dia} de {avance.total}
              </span>
            </div>
            <div className="mt-space-md flex flex-col items-center justify-center py-2">
              <svg className="h-36 w-36 -rotate-90 transform" viewBox="0 0 120 120" aria-hidden="true">
                <circle className="stroke-surface-container" cx="60" cy="60" fill="none" r="50" strokeWidth="10" />
                <circle
                  className="stroke-secondary-container"
                  cx="60"
                  cy="60"
                  fill="none"
                  r="50"
                  strokeDasharray={circunferencia}
                  strokeDashoffset={circunferencia * (1 - avance.porcentaje / 100)}
                  strokeLinecap="round"
                  strokeWidth="10"
                />
              </svg>
              <div className="-mt-24 mb-6 text-center">
                <span className="block font-display-lg text-headline-lg leading-none font-bold text-primary">{avance.porcentaje}%</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Tiempo transcurrido</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1 rounded-xl bg-surface-container-low p-space-sm">
            <Dato etiqueta="Cierre automático:" className="text-on-surface">
              {cierreAutomatico(periodo.convocatoria_fin)}
            </Dato>
            <Dato etiqueta="Acceso estudiantil:" className={abierta ? "text-tertiary" : "text-error"}>
              {abierta ? "HABILITADO" : "CERRADO"}
            </Dato>
            <Dato etiqueta="Reporte Control Escolar:" className="text-primary">
              Generación al cierre
            </Dato>
          </div>
        </div>
      </div>
    </div>
  );
}

function Dato({ etiqueta, className, children }: { etiqueta: string; className: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-space-sm font-label-sm text-label-sm">
      <span className="text-on-surface-variant">{etiqueta}</span>
      <span className={`text-right font-semibold ${className}`}>{children}</span>
    </div>
  );
}

function TablaPeriodos({
  periodos,
  editar,
  activar,
}: {
  periodos: Periodo[];
  editar: (p: Periodo) => void;
  activar: (p: Periodo) => void;
}) {
  const { data: ultima } = useUltimaModificacion();
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm">
      <div className="flex flex-col justify-between gap-space-md p-space-lg sm:flex-row sm:items-center">
        <div>
          <h2 className="font-headline-sm text-headline-sm font-bold text-primary">Catálogo Histórico de Ciclos Escolares</h2>
          <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
            Control de registros, fechas oficiales de convocatoria y activación de ciclos escolares para Control Escolar.
          </p>
        </div>
        <div className="flex items-center gap-space-xs">
          <span className="inline-flex items-center gap-1 rounded-lg bg-surface-container px-space-sm py-1 font-label-sm text-label-sm whitespace-nowrap text-on-surface-variant">
            <Simbolo nombre="filter_list" className="text-[16px]!" />
            Mostrando: {periodos.length} {periodos.length === 1 ? "ciclo registrado" : "ciclos registrados"}
          </span>
        </div>
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="bg-surface-container-low font-label-sm text-label-sm tracking-wider text-on-surface-variant uppercase">
              <th className="px-space-lg py-space-sm">Ciclo</th>
              <th className="px-space-md py-space-sm">Inicio y Fin del Semestre</th>
              <th className="px-space-md py-space-sm">Inicio y Fin de Convocatoria</th>
              <th className="px-space-md py-space-sm text-center">Estado del Periodo</th>
              <th className="px-space-md py-space-sm text-center">Estado de Convocatoria</th>
              <th className="px-space-lg py-space-sm text-right print:hidden">Acciones</th>
            </tr>
          </thead>
          <tbody className="font-body-md text-body-md text-on-surface">
            {periodos.map((p, i) => (
              <FilaPeriodo key={p.id} periodo={p} par={i % 2 === 0} editar={() => editar(p)} activar={() => activar(p)} />
            ))}
          </tbody>
        </table>
      </div>
      {ultima && (
        <div className="flex flex-col items-center justify-between gap-space-sm bg-surface-container-low p-space-md font-label-sm text-label-sm text-on-surface-variant sm:flex-row">
          <div className="flex items-center gap-space-xs">
            <Simbolo nombre="security" className="text-[16px]! text-primary" />
            <span>
              Última modificación registrada por: <strong>{ultima.usuario ?? "usuario eliminado"}</strong> ({fechaBitacora(ultima.fecha)})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function FilaPeriodo({
  periodo: p,
  par,
  editar,
  activar,
}: {
  periodo: Periodo;
  par: boolean;
  editar: () => void;
  activar: () => void;
}) {
  const concluido = dia(p.fecha_fin).getTime() < Date.now();
  const fondo = par
    ? "bg-surface-container-lowest hover:bg-surface-container-low/50"
    : "bg-surface-container-low/30 hover:bg-surface-container-low/70";
  const negrita = p.activo ? "font-semibold" : "";
  return (
    <tr className={`transition-colors ${fondo}`}>
      <td className="px-space-lg py-space-md">
        <div className="flex items-center gap-space-xs">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-label-md text-label-md font-bold ${
              p.activo ? "bg-primary-container text-on-primary" : "bg-surface-container text-on-surface-variant"
            }`}
          >
            {insignia(p.ciclo)}
          </div>
          <div className="flex flex-col">
            <span
              className={`font-headline-sm text-headline-sm whitespace-nowrap ${p.activo ? "font-bold text-primary" : "font-semibold text-on-surface"}`}
            >
              {p.ciclo}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">UAE Semestral</span>
          </div>
        </div>
      </td>
      <td className="px-space-md py-space-md">
        <div className="flex flex-col">
          <span className={`font-label-md text-label-md text-on-surface ${negrita}`}>{rangoFechas(p.fecha_inicio, p.fecha_fin)}</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {p.activo ? "Calendario Oficial UAN" : concluido ? "Concluido" : "Próximo"}
          </span>
        </div>
      </td>
      <td className="px-space-md py-space-md">
        <div className="flex flex-col">
          <span className={`font-label-md text-label-md text-on-surface ${negrita}`}>
            {rangoFechas(p.convocatoria_inicio, p.convocatoria_fin)}
          </span>
          {p.estado_convocatoria === "abierta" && (
            <span className="font-label-sm text-label-sm font-semibold text-secondary">Cierra {horaMinuto(p.convocatoria_fin)} hrs</span>
          )}
          {p.estado_convocatoria === "programada" && (
            <span className="font-label-sm text-label-sm text-on-surface-variant">Abre {diaHora(p.convocatoria_inicio)} hrs</span>
          )}
          {p.estado_convocatoria === "cerrada" && (
            <span className="font-label-sm text-label-sm text-on-surface-variant">Convocatoria finalizada</span>
          )}
        </div>
      </td>
      <td className="px-space-md py-space-md text-center">
        {p.activo ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-fixed px-space-sm py-1 font-label-sm text-label-sm font-bold text-on-tertiary-fixed">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-on-tertiary-container" />
            ACTIVO
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-surface-container px-space-sm py-1 font-label-sm text-label-sm font-semibold text-on-surface-variant">
            Inactivo
          </span>
        )}
      </td>
      <td className="px-space-md py-space-md text-center">
        <ChipConvocatoria estado={p.estado_convocatoria} />
      </td>
      <td className="px-space-lg py-space-md text-right print:hidden">
        <div className="flex items-center justify-end gap-space-xs">
          <button
            type="button"
            onClick={editar}
            title="Editar fechas"
            aria-label={`Editar ${p.ciclo}`}
            className="cursor-pointer rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
          >
            <Simbolo nombre="edit" className="text-[20px]!" />
          </button>
          {p.activo ? (
            <span className="inline-flex cursor-default items-center gap-1 rounded-lg bg-surface-container px-space-sm py-1 font-label-sm text-label-sm font-semibold text-on-surface-variant">
              <Simbolo nombre="task_alt" className="text-[16px]!" />
              En uso
            </span>
          ) : (
            <button
              type="button"
              onClick={activar}
              className="cursor-pointer rounded-lg bg-surface-container-high px-space-sm py-1 font-label-sm text-label-sm font-semibold text-on-surface transition-colors hover:bg-primary-container hover:text-on-primary"
            >
              Activar
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function ChipConvocatoria({ estado }: { estado: EstadoConvocatoria }) {
  if (estado === "abierta")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-fixed px-space-sm py-1 font-label-sm text-label-sm font-bold text-on-tertiary-fixed">
        <Simbolo nombre="lock_open" className="text-[14px]!" />
        Abierta
      </span>
    );
  if (estado === "programada")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-space-sm py-1 font-label-sm text-label-sm font-semibold text-on-primary-fixed">
        <Simbolo nombre="schedule" className="text-[14px]!" />
        Programada
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-space-sm py-1 font-label-sm text-label-sm text-on-surface-variant">
      <Simbolo nombre="lock" className="text-[14px]!" />
      Cerrada
    </span>
  );
}

const CAMPO =
  "w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-space-sm py-2 text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-none";

function FormularioPeriodo({ periodo, activo, cerrar }: { periodo: Periodo | null; activo: Periodo | null; cerrar: () => void }) {
  const guardar = useGuardarPeriodo();
  const aviso = useAviso();
  const [ciclo, setCiclo] = useState(periodo?.ciclo ?? "");
  const [inicio, setInicio] = useState(periodo?.fecha_inicio ?? "");
  const [fin, setFin] = useState(periodo?.fecha_fin ?? "");
  const [abre, setAbre] = useState(periodo ? aInputFechaHora(periodo.convocatoria_inicio) : "");
  const [cierra, setCierra] = useState(periodo ? aInputFechaHora(periodo.convocatoria_fin) : "");
  const [activar, setActivar] = useState(false);
  const error = guardar.error instanceof ApiError ? guardar.error : null;
  const campo = (nombre: string) => error?.campo(nombre);
  // Errores que no son de un campo del formulario (por ejemplo, movimientos pendientes al activar).
  const general =
    guardar.error && !["ciclo", "fecha_inicio", "fecha_fin", "convocatoria_inicio", "convocatoria_fin"].some((c) => campo(c))
      ? guardar.error.message
      : null;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    guardar.mutate(
      {
        id: periodo?.id,
        ciclo,
        fecha_inicio: inicio,
        fecha_fin: fin,
        convocatoria_inicio: deInputFechaHora(abre),
        convocatoria_fin: deInputFechaHora(cierra),
        activar,
      },
      {
        onSuccess: (guardado) => {
          aviso(
            activar && guardado.activo
              ? `Periodo ${guardado.ciclo} guardado con éxito. Se ha establecido como ciclo activo.`
              : `Periodo ${guardado.ciclo} guardado con éxito.`,
          );
          cerrar();
        },
      },
    );
  };

  return (
    <Modal cerrar={cerrar} className="flex max-h-[92vh] max-w-xl flex-col" titulo="titulo-periodo">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-surface-container-low p-space-lg shadow-xs">
        <div className="flex items-center gap-space-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary">
            <Simbolo nombre={periodo ? "edit_calendar" : "calendar_add_on"} className="text-[22px]!" />
          </div>
          <div>
            <h3 id="titulo-periodo" className="font-headline-md text-headline-md font-bold text-primary">
              {periodo ? "Editar periodo escolar" : "Registrar Nuevo Periodo Escolar"}
            </h3>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              {periodo ? `Ciclo ${periodo.ciclo}` : "Apertura de ciclo para la Facultad de Economía"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar"
          className="cursor-pointer rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-error"
        >
          <Simbolo nombre="close" className="text-[20px]!" />
        </button>
      </div>
      <form className="flex flex-col gap-space-md p-space-lg" onSubmit={enviar}>
        <div className="flex flex-col gap-1">
          <label
            className="flex flex-wrap items-center justify-between gap-x-2 font-label-md text-label-md font-semibold text-on-surface"
            htmlFor="input-ciclo"
          >
            <span>Ciclo Escolar</span>
            <span className="font-label-sm text-label-sm font-normal text-on-surface-variant">Formato obligatorio: AAAA-A / AAAA-B</span>
          </label>
          <div className="relative">
            <input
              id="input-ciclo"
              value={ciclo}
              onChange={(e) => setCiclo(e.target.value.toUpperCase())}
              pattern="[0-9]{4}-[A-Ba-b]"
              placeholder="ej. 2026-B"
              required
              className="w-full rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-space-md py-2.5 font-headline-sm text-headline-sm font-semibold tracking-wider text-on-surface uppercase placeholder:text-outline-variant focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <Simbolo nombre="badge" className="absolute top-3 right-3 text-[20px]! text-outline" />
          </div>
          <ErrorCampo texto={campo("ciclo")} />
        </div>

        <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
          <span className="flex items-center gap-1 font-label-sm text-label-sm font-bold tracking-wider text-primary uppercase">
            <Simbolo nombre="date_range" className="text-[16px]!" />
            Duración del Semestre Lectivo (Oficial UAE/UAN)
          </span>
          <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
            <CampoFecha id="sem-inicio" etiqueta="Inicio de semestre" tipo="date" valor={inicio} cambiar={setInicio} error={campo("fecha_inicio")} />
            <CampoFecha id="sem-fin" etiqueta="Fin de semestre" tipo="date" valor={fin} cambiar={setFin} error={campo("fecha_fin")} />
          </div>
        </div>

        <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
          <span className="flex items-center gap-1 font-label-sm text-label-sm font-bold tracking-wider text-secondary uppercase">
            <Simbolo nombre="access_time" className="text-[16px]!" />
            Ventana de Convocatoria SABE (Altas y Bajas)
          </span>
          <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
            <CampoFecha
              id="conv-inicio"
              etiqueta="Apertura de captura"
              tipo="datetime-local"
              valor={abre}
              cambiar={setAbre}
              error={campo("convocatoria_inicio")}
            />
            <CampoFecha
              id="conv-fin"
              etiqueta="Cierre estricto"
              tipo="datetime-local"
              valor={cierra}
              cambiar={setCierra}
              error={campo("convocatoria_fin")}
            />
          </div>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Al vencer esta fecha y hora, los estudiantes no podrán enviar nuevas adiciones ni cancelaciones de UA.
          </span>
        </div>

        {!periodo?.activo && (
          <div className="flex flex-col gap-space-xs rounded-xl bg-secondary-fixed/20 p-space-md">
            <label className="flex cursor-pointer items-start gap-space-sm select-none">
              <input
                type="checkbox"
                checked={activar}
                onChange={(e) => setActivar(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
              />
              <div className="flex flex-col">
                <span className="font-label-md text-label-md font-bold text-on-surface">Establecer como periodo activo inmediatamente</span>
                {activo && (
                  <span className="mt-0.5 font-body-sm text-body-sm font-semibold text-secondary">
                    Advertencia: Desactivará automáticamente el ciclo actual ({activo.ciclo}) y cambiará los formularios de todos los
                    usuarios.
                  </span>
                )}
              </div>
            </label>
          </div>
        )}

        {general && <p className="rounded-xl bg-error-container p-space-sm font-label-md text-label-md text-on-error-container">{general}</p>}

        <div className="mt-space-sm flex items-center justify-end gap-space-sm border-t border-surface-container pt-space-sm">
          <button
            type="button"
            onClick={cerrar}
            className="cursor-pointer rounded-xl bg-surface-container px-space-md py-2.5 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardar.isPending}
            className="flex cursor-pointer items-center gap-space-xs rounded-xl bg-primary-container px-space-lg py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
          >
            {guardar.isPending ? <Spinner className="h-[18px] w-[18px]" /> : <Simbolo nombre="save" className="text-[18px]!" />}
            <span>Guardar periodo</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CampoFecha({
  id,
  etiqueta,
  tipo,
  valor,
  cambiar,
  error,
}: {
  id: string;
  etiqueta: string;
  tipo: "date" | "datetime-local";
  valor: string;
  cambiar: (v: string) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-label-sm text-label-sm font-medium text-on-surface" htmlFor={id}>
        {etiqueta}
      </label>
      <input id={id} type={tipo} value={valor} onChange={(e) => cambiar(e.target.value)} required className={CAMPO} />
      <ErrorCampo texto={error} />
    </div>
  );
}

function ErrorCampo({ texto }: { texto?: string }) {
  return texto ? <span className="font-label-sm text-label-sm text-error">{texto}</span> : null;
}

/** Confirmación de "Activar" con el texto del confirm() de stitch. */
function ConfirmarActivar({ periodo, activo, cerrar }: { periodo: Periodo; activo: Periodo | null; cerrar: () => void }) {
  const activarPeriodo = useActivarPeriodo();
  const aviso = useAviso();
  const confirmar = () =>
    activarPeriodo.mutate(periodo.id, {
      onSuccess: () => {
        aviso(`El ciclo ${periodo.ciclo} ha sido establecido como ACTIVO.`);
        cerrar();
      },
      onError: (e) => {
        aviso(e.message);
        cerrar();
      },
    });

  return (
    <Modal cerrar={cerrar} className="max-w-md p-space-lg" titulo="titulo-activar">
      <div className="flex items-start gap-space-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container">
          <Simbolo nombre="gavel" className="text-[22px]!" />
        </div>
        <div className="flex flex-col gap-space-xs">
          <h3 id="titulo-activar" className="font-headline-sm text-headline-sm font-bold text-primary">
            Regla de negocio UAE
          </h3>
          <p className="font-body-md text-body-md text-on-surface">
            Solo puede haber un periodo escolar activo. ¿Deseas activar el ciclo <strong>{periodo.ciclo}</strong>?
          </p>
          {activo && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              El ciclo actual {activo.ciclo} pasará automáticamente al estado INACTIVO.
            </p>
          )}
        </div>
      </div>
      <div className="mt-space-lg flex items-center justify-end gap-space-sm">
        <button
          type="button"
          onClick={cerrar}
          className="cursor-pointer rounded-xl bg-surface-container px-space-md py-2.5 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={activarPeriodo.isPending}
          className="flex cursor-pointer items-center gap-space-xs rounded-xl bg-primary-container px-space-lg py-2.5 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-colors hover:bg-primary disabled:opacity-60"
        >
          {activarPeriodo.isPending && <Spinner className="h-[18px] w-[18px]" />}
          Activar {periodo.ciclo}
        </button>
      </div>
    </Modal>
  );
}
