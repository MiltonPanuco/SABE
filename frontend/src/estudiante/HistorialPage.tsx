// Vista 5 de stitch/sabe_estudiantes: acuse del folio más reciente y tabla con todos los folios.
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSolicitudes } from "../api/solicitudes";
import { Simbolo, Spinner } from "../components/acceso";
import { Acuse, BotonImprimir, ChipEstadoFolio, resolucionFolio } from "./folio";

export function HistorialPage() {
  const { data: folios, isPending, error } = useSolicitudes();
  const navigate = useNavigate();

  if (isPending) {
    return (
      <Tarjeta>
        <Spinner className="h-5 w-5 text-primary-container" /> Cargando tus solicitudes…
      </Tarjeta>
    );
  }
  if (error) return <Tarjeta>{error.message}</Tarjeta>;

  if (folios.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-space-lg">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center rounded-xl bg-surface-container-lowest p-8 text-center shadow-sm">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
            <Simbolo nombre="inbox" className="text-[32px]!" />
          </div>
          <h3 className="font-headline-sm text-lg font-bold text-primary">Aún no tienes solicitudes</h3>
          <p className="mt-1 mb-4 max-w-sm font-body-md text-sm text-on-surface-variant">
            No se ha registrado ninguna solicitud de alta o baja para el ciclo escolar actual.
          </p>
          <Link
            to="/estudiante/catalogo"
            className="cursor-pointer rounded-lg bg-primary-container px-4 py-2 font-label-md text-sm font-semibold text-on-primary hover:bg-primary"
          >
            Explorar Catálogo
          </Link>
        </div>
      </div>
    );
  }

  const [ultimo] = folios;
  return (
    <div className="flex flex-1 flex-col gap-space-lg">
      <Acuse
        solicitud={ultimo}
        acciones={
          <>
            <BotonImprimir className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary-container px-space-lg py-2.5 font-label-md text-label-md font-bold text-on-primary shadow-sm transition-all hover:bg-primary sm:w-auto" />
            <Link
              to="/estudiante"
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-surface-container-high px-space-md py-2.5 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-highest sm:w-auto"
            >
              <Simbolo nombre="dashboard" className="text-[18px]!" /> Volver al Dashboard
            </Link>
          </>
        }
      />

      <div className="mx-auto w-full max-w-4xl rounded-xl bg-surface-container-lowest p-space-lg shadow-sm print:hidden">
        <div className="mb-space-sm flex items-center justify-between pb-space-sm">
          <div className="flex items-center gap-2">
            <Simbolo nombre="history" className="text-primary-container" />
            <h3 className="font-headline-sm text-headline-sm text-primary">Historial de Trámites</h3>
          </div>
          <span className="font-mono font-label-sm text-label-sm text-on-surface-variant">Control Escolar</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left font-body-sm text-body-sm">
            <thead>
              <tr className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                <th className="rounded-l-lg px-3 py-2.5">Folio</th>
                <th className="px-3 py-2.5">Ciclo</th>
                <th className="px-3 py-2.5">Movimientos</th>
                <th className="px-3 py-2.5">Estatus</th>
                <th className="rounded-r-lg px-3 py-2.5">Resolución</th>
              </tr>
            </thead>
            <tbody className="divide-y-0">
              {folios.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => navigate(`/estudiante/historial/${f.id}`)}
                  className="cursor-pointer text-xs transition-colors hover:bg-surface-container-low/60"
                >
                  <td className="px-3 py-3 font-mono font-bold whitespace-nowrap text-primary-container">
                    <Link to={`/estudiante/historial/${f.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
                      #{f.folio_digital}
                    </Link>
                  </td>
                  <td className="px-3 py-3 font-mono whitespace-nowrap">Ciclo {f.ciclo}</td>
                  <td className="px-3 py-3 font-medium">
                    {f.movimientos.map((m) => `${m.tipo_tramite === "ALTA" ? "Alta" : "Baja"} ${m.grupo.materia.nombre}`).join(", ")}
                  </td>
                  <td className="px-3 py-3">
                    <ChipEstadoFolio solicitud={f} className="px-2! py-0.5!" />
                  </td>
                  <td className="px-3 py-3 text-on-surface-variant italic">{resolucionFolio(f)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Tarjeta({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-4xl items-center justify-center gap-2 rounded-xl bg-surface-container-lowest p-8 text-center font-body-md text-on-surface-variant shadow-sm">
      {children}
    </div>
  );
}
