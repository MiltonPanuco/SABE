// Bitácora de Auditoría: stitch/sabe_bitacora_auditoria. Solo lectura, filtros en la URL y descarga en CSV.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { rutaBitacora, useBitacora } from "../api/avisos";
import { descargar } from "../api/client";
import { usePeriodoActivo } from "../api/estudiante";
import type { CategoriaBitacora, FiltrosBitacora } from "../api/tipos";
import { Simbolo, Spinner } from "../components/acceso";
import { fechaPeriodo, horaMinuto } from "./fechas";
import { useCambiarFiltro } from "./filtrosUrl";
import { useVentanilla } from "./LayoutControlEscolar";
import { useAviso } from "./Toast";

const CATEGORIAS: CategoriaBitacora[] = ["Dictamen", "Importación", "Exportación", "Oferta", "Periodo", "Usuarios", "Acceso"];
const ROLES: [FiltrosBitacora["rol"], string][] = [
  ["control_escolar", "Control Escolar"],
  ["administrador", "Administrador"],
  ["estudiante", "Estudiante"],
];

// Colores de los chips de acción (CHIPC del prototipo).
const CHIPS: Record<CategoriaBitacora, string> = {
  Dictamen: "bg-primary-fixed text-on-primary-fixed",
  Importación: "bg-secondary-fixed text-on-secondary-fixed",
  Exportación: "bg-tertiary-fixed text-on-tertiary-fixed",
  Oferta: "bg-surface-container text-on-surface",
  Periodo: "bg-secondary-container text-on-secondary-container",
  Usuarios: "bg-error-container text-on-error-container",
  Acceso: "bg-surface-container-high text-on-surface-variant",
  Otros: "bg-surface-container text-on-surface-variant",
};

function leerFiltros(params: URLSearchParams): FiltrosBitacora {
  const categoria = params.get("categoria") ?? "";
  const rol = params.get("rol") ?? "";
  return {
    q: params.get("q") ?? "",
    categoria: (CATEGORIAS as string[]).includes(categoria) ? (categoria as CategoriaBitacora) : "",
    rol: ROLES.some(([valor]) => valor === rol) ? (rol as FiltrosBitacora["rol"]) : "",
  };
}

const CAMPO = "rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-space-sm font-body-md text-body-md";

export function BitacoraPage() {
  const ventanilla = useVentanilla();
  const [params] = useSearchParams();
  const cambiar = useCambiarFiltro();
  const filtros = leerFiltros(params);
  const [texto, setTexto] = useState(filtros.q);
  const { data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useBitacora(filtros);
  const { data: periodo } = usePeriodoActivo();
  const aviso = useAviso();
  const [bajando, setBajando] = useState(false);

  // El buscador espera 300 ms sin teclear.
  useEffect(() => {
    const espera = window.setTimeout(() => cambiar("q", texto.trim()), 300);
    return () => window.clearTimeout(espera);
  }, [texto]); // Solo al teclear: `cambiar` lee la URL actual.

  const registros = data?.pages.flatMap((p) => p.resultados) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const csv = () => {
    setBajando(true);
    const nombre = periodo ? `bitacora_sabe_${periodo.ciclo.replace("-", "")}.csv` : "bitacora_sabe.csv";
    descargar(`/bitacora/exportar/${rutaBitacora(filtros)}`, nombre)
      .then(() => aviso(`Se descargó la bitácora (${total} registro${total === 1 ? "" : "s"}).`))
      .catch((e: Error) => aviso(e.message))
      .finally(() => setBajando(false));
  };

  return (
    <div className="flex w-full flex-col gap-space-lg">
      <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
        <div className="flex flex-col">
          <div className="mb-1 flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
            <span>{ventanilla}</span>
            <Simbolo nombre="chevron_right" className="text-[14px]!" />
            <span className="font-semibold text-primary">Bitácora de Auditoría</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-primary">Bitácora de Auditoría</h1>
          <p className="mt-space-xs max-w-3xl font-body-md text-body-md text-on-surface-variant">
            Registro de quién hizo qué y cuándo: dictámenes, importaciones, exportaciones, cambios de periodo y de usuarios. Solo lectura.
          </p>
        </div>
        <button
          type="button"
          onClick={csv}
          disabled={bajando || !total}
          className="flex shrink-0 items-center gap-space-xs self-start rounded-xl bg-surface-container-low px-space-lg py-space-sm font-label-lg text-label-lg text-on-surface shadow-sm hover:bg-surface-container disabled:opacity-60 lg:self-auto"
        >
          {bajando ? <Spinner /> : <Simbolo nombre="download" className="text-[20px]!" />}
          Descargar CSV
        </button>
      </div>

      <div className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-lowest p-space-md shadow-sm md:flex-row md:items-center">
        <div className="relative flex-1">
          <Simbolo nombre="search" className="absolute top-1/2 left-3 -translate-y-1/2 text-[20px]! text-on-surface-variant" />
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por usuario, folio o detalle"
            aria-label="Buscar en la bitácora"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest py-space-sm pr-space-md pl-10 font-body-md text-body-md focus:ring-2 focus:ring-primary-container focus:outline-none"
          />
        </div>
        <select value={filtros.categoria} onChange={(e) => cambiar("categoria", e.target.value)} aria-label="Acción" className={CAMPO}>
          <option value="">Acción: todas</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={filtros.rol} onChange={(e) => cambiar("rol", e.target.value)} aria-label="Rol" className={CAMPO}>
          <option value="">Rol: todos</option>
          {ROLES.map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low font-label-sm text-label-sm tracking-wider text-on-surface-variant uppercase">
                <th className="px-space-lg py-space-sm">Fecha y hora</th>
                <th className="px-space-md py-space-sm">Usuario</th>
                <th className="px-space-md py-space-sm">Acción</th>
                <th className="px-space-md py-space-sm">Detalle</th>
              </tr>
            </thead>
            <tbody className="font-body-md text-body-md text-on-surface">
              {registros.map((r) => (
                <tr key={r.id} className="border-t border-outline-variant/40 transition-colors hover:bg-surface-container-low/60">
                  <td className="px-space-lg py-space-md font-label-md text-label-md whitespace-nowrap text-on-surface-variant">
                    {fechaPeriodo(r.fecha)} {horaMinuto(r.fecha)}
                  </td>
                  <td className="px-space-md py-space-md">
                    <div className="flex flex-col">
                      <span className="font-label-lg text-label-lg font-semibold">{r.usuario}</span>
                      {r.rol && <span className="font-label-sm text-label-sm text-on-surface-variant">{r.rol}</span>}
                    </div>
                  </td>
                  <td className="px-space-md py-space-md">
                    <span className={`inline-flex rounded-full px-space-sm py-1 font-label-sm text-label-sm font-bold ${CHIPS[r.categoria]}`}>
                      {r.categoria}
                    </span>
                  </td>
                  <td className="min-w-[16rem] px-space-md py-space-md font-body-md text-body-md">{r.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {isPending && (
            <div className="flex justify-center p-space-xl text-primary">
              <Spinner className="h-6 w-6" />
            </div>
          )}
          {error && <p className="p-space-xl text-center font-body-md text-error">{error.message}</p>}
          {data && registros.length === 0 && (
            <div className="p-space-xl text-center font-body-md text-on-surface-variant">No hay registros con esos filtros.</div>
          )}
        </div>
        <div className="flex flex-col items-center justify-between gap-space-sm bg-surface-container-low px-space-lg py-space-sm font-label-sm text-label-sm text-on-surface-variant sm:flex-row">
          <span>
            Mostrando {registros.length} de {total} registro{total === 1 ? "" : "s"}
          </span>
          {hasNextPage && (
            <button
              type="button"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              className="rounded-lg bg-surface-container-lowest px-space-md py-space-xs font-label-md text-label-md font-semibold text-primary shadow-sm hover:bg-surface-container-high disabled:opacity-60"
            >
              {isFetchingNextPage ? "Cargando…" : "Cargar más registros"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
