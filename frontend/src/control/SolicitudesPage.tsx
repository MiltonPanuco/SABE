// Bandeja de control escolar: vista "view-list" de stitch/sabe_solicitudes_control_escolar.
import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useBandeja, useResumenBandeja } from "../api/control";
import type { EstadoBandeja, FiltrosBandeja, Solicitud } from "../api/tipos";
import { Simbolo, Spinner } from "../components/acceso";
import { fechaHora } from "../estudiante/formato";
import { ESTADO_BANDEJA, porRevisar } from "./estado";

const ESTADOS: EstadoBandeja[] = ["pendiente", "parcial", "dictaminada", "rechazada"];

function leerFiltros(params: URLSearchParams): FiltrosBandeja {
  const estado = params.get("estado") ?? "";
  const tipo = params.get("tipo") ?? "";
  return {
    q: params.get("q") ?? "",
    estado: (ESTADOS as string[]).includes(estado) ? (estado as EstadoBandeja) : "",
    tipo: tipo === "normal" || tipo === "extemp" ? tipo : "",
  };
}

export function SolicitudesPage() {
  const [params, setParams] = useSearchParams();
  const filtros = leerFiltros(params);
  const [texto, setTexto] = useState(filtros.q);
  const { data: folios, isPending, error, isFetching } = useBandeja(filtros);
  const { search } = useLocation();

  // El buscador espera 300 ms sin teclear antes de pedir la bandeja.
  useEffect(() => {
    const espera = window.setTimeout(() => cambiar("q", texto.trim()), 300);
    return () => window.clearTimeout(espera);
  }, [texto]); // `cambiar` solo cambia la URL; no hace falta como dependencia.

  function cambiar(nombre: keyof FiltrosBandeja, valor: string) {
    setParams(
      (actuales) => {
        const nuevos = new URLSearchParams(actuales);
        if (valor) nuevos.set(nombre, valor);
        else nuevos.delete(nombre);
        return nuevos;
      },
      { replace: true },
    );
  }

  return (
    <div className="flex w-full flex-col gap-space-lg">
      <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
        <div className="flex flex-col">
          <div className="mb-1 flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
            <span>Ventanilla de Control Escolar</span>
            <Simbolo nombre="chevron_right" className="text-[14px]!" />
            <span className="font-semibold text-primary">Gestión de Trámites</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-primary">Solicitudes Pendientes de Dictamen</h1>
          <p className="mt-space-xs max-w-3xl font-body-md text-body-md text-on-surface-variant">
            Cada folio se revisa por movimiento: apruebas o rechazas cada alta y baja. Un rechazo siempre lleva motivo, y los folios
            extemporáneos solo se aprueban con visto bueno.
          </p>
        </div>
        <Link
          to="/control-escolar/exportacion"
          className="flex shrink-0 items-center justify-center gap-space-xs rounded-xl bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary shadow-md hover:bg-primary"
        >
          <Simbolo nombre="sync_alt" className="text-[20px]!" />
          <span>Exportar Excel para SADCE</span>
        </Link>
      </div>

      <Indicadores />

      <div className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-lowest p-space-md shadow-sm md:flex-row md:items-center">
        <div className="relative flex-1">
          <Simbolo nombre="search" className="absolute top-1/2 left-3 -translate-y-1/2 text-[20px]! text-on-surface-variant" />
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por folio, matrícula o nombre"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest py-space-sm pr-space-md pl-10 font-body-md text-body-md focus:ring-2 focus:ring-primary-container focus:outline-none"
          />
        </div>
        <select
          value={filtros.estado}
          onChange={(e) => cambiar("estado", e.target.value)}
          className="rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-space-sm font-body-md text-body-md"
        >
          <option value="">Estado: todos</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {ESTADO_BANDEJA[e].texto}
            </option>
          ))}
        </select>
        <select
          value={filtros.tipo}
          onChange={(e) => cambiar("tipo", e.target.value)}
          className="rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-space-sm font-body-md text-body-md"
        >
          <option value="">Tipo: todos</option>
          <option value="normal">Dentro de convocatoria</option>
          <option value="extemp">Extemporáneo</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm">
        <div className={`overflow-x-auto transition-opacity ${isFetching && !isPending ? "opacity-70" : ""}`}>
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low font-label-sm text-label-sm tracking-wider text-on-surface-variant uppercase">
                <th className="px-space-lg py-space-sm">Folio</th>
                <th className="px-space-md py-space-sm">Alumno</th>
                <th className="px-space-md py-space-sm">Movimientos</th>
                <th className="px-space-md py-space-sm">Recibido</th>
                <th className="px-space-md py-space-sm text-center">Estado</th>
                <th className="px-space-lg py-space-sm text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="font-body-md text-body-md text-on-surface">
              {folios?.map((f) => <Fila key={f.id} folio={f} volver={search} />)}
            </tbody>
          </table>
          {isPending && (
            <div className="flex items-center justify-center gap-2 p-space-xl font-body-md text-on-surface-variant">
              <Spinner className="h-5 w-5 text-primary-container" /> Cargando folios…
            </div>
          )}
          {error && <div className="p-space-xl text-center font-body-md text-error">{error.message}</div>}
          {folios?.length === 0 && (
            <div className="p-space-xl text-center font-body-md text-on-surface-variant">No hay folios con esos filtros.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Indicadores() {
  const { data } = useResumenBandeja();
  const tarjetas = [
    ["Folios pendientes", data?.folios_pendientes, "pending_actions", "text-secondary"],
    ["Movimientos aprobados", data?.movimientos_aprobados, "check_circle", "text-on-tertiary-container"],
    ["Movimientos rechazados", data?.movimientos_rechazados, "cancel", "text-error"],
    ["Extemporáneos", data?.extemporaneos, "schedule", "text-primary"],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-space-md lg:grid-cols-4">
      {tarjetas.map(([texto, valor, icono, color]) => (
        <div key={texto} className="flex items-center gap-space-md rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container ${color}`}>
            <Simbolo nombre={icono} />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="font-headline-lg text-headline-lg leading-none font-bold text-primary">{valor ?? "–"}</span>
            <span className="mt-1 font-label-sm text-label-sm text-on-surface-variant">{texto}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChipExtemporaneo({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-secondary-container font-label-sm text-label-sm font-bold text-on-secondary-container ${className}`}
    >
      <Simbolo nombre="schedule" className="text-[14px]!" />
      Extemporáneo
    </span>
  );
}

function Fila({ folio, volver }: { folio: Solicitud; volver: string }) {
  const estado = ESTADO_BANDEJA[folio.estado_bandeja];
  const altas = folio.movimientos.filter((m) => m.tipo_tramite === "ALTA").length;
  const bajas = folio.movimientos.length - altas;
  const movimientos = [altas && `${altas} alta${altas > 1 ? "s" : ""}`, bajas && `${bajas} baja${bajas > 1 ? "s" : ""}`]
    .filter(Boolean)
    .join(" • ");
  return (
    <tr className="border-t border-outline-variant/40 transition-colors hover:bg-surface-container-low/60">
      <td className="px-space-lg py-space-md">
        <div className="flex flex-col">
          <span className="font-label-lg text-label-lg font-bold whitespace-nowrap text-primary">{folio.folio_digital}</span>
          {folio.extemporanea && <ChipExtemporaneo className="mt-1 w-fit px-2 py-0.5" />}
        </div>
      </td>
      <td className="px-space-md py-space-md">
        <div className="flex flex-col">
          <span className="font-label-lg text-label-lg font-semibold">{folio.estudiante.nombre}</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {folio.estudiante.matricula} • Lic. en {folio.estudiante.programa}
          </span>
        </div>
      </td>
      <td className="px-space-md py-space-md">
        <span className="font-label-md text-label-md">{movimientos}</span>
      </td>
      <td className="px-space-md py-space-md font-label-md text-label-md whitespace-nowrap text-on-surface-variant">
        {fechaHora(folio.fecha_solicitud)}
      </td>
      <td className="px-space-md py-space-md text-center">
        <span className={`inline-flex items-center rounded-full px-space-sm py-1 font-label-sm text-label-sm font-bold whitespace-nowrap ${estado.chip}`}>
          {estado.texto}
        </span>
      </td>
      <td className="px-space-lg py-space-md text-right">
        <Link
          to={`/control-escolar/solicitudes/${folio.id}`}
          state={{ volver }}
          className="inline-block rounded-lg bg-primary-container px-space-md py-space-xs font-label-md text-label-md whitespace-nowrap text-on-primary transition-colors hover:bg-primary"
        >
          {porRevisar(folio.estado_bandeja) ? "Revisar" : "Ver detalle"}
        </Link>
      </td>
    </tr>
  );
}
