// Secciones del menú de control escolar que todavía no existen. Cada una llega con su función del plan.
import { Link } from "react-router-dom";
import { Simbolo } from "../components/acceso";

export function Proximamente({ titulo, icono, funcion }: { titulo: string; icono: string; funcion: string }) {
  return (
    <div className="flex w-full flex-col gap-space-lg">
      <h1 className="font-headline-lg text-headline-lg tracking-tight text-primary">{titulo}</h1>
      <div className="flex flex-col items-center gap-space-sm rounded-2xl bg-surface-container-lowest p-space-xl text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface-container text-primary">
          <Simbolo nombre={icono} className="text-[28px]!" />
        </div>
        <p className="font-headline-sm text-headline-sm text-primary">Próximamente</p>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          Esta sección llega con {funcion}. Mientras tanto puedes revisar y dictaminar las solicitudes.
        </p>
        <Link
          to="/control-escolar/solicitudes"
          className="mt-space-xs rounded-lg bg-primary-container px-space-md py-space-xs font-label-md text-label-md text-on-primary hover:bg-primary"
        >
          Ir a Solicitudes Pendientes
        </Link>
      </div>
    </div>
  );
}
