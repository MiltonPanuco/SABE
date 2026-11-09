// Confirmación e Historial del portal. Las pantallas completas (envío del folio, acuse e historial) llegan con F5;
// mientras, se muestra el estado vacío de stitch/sabe_estudiantes.
import { Link } from "react-router-dom";
import { Simbolo } from "../components/acceso";
import { useCarrito } from "./Carrito";

function Vacio({ icono, titulo, texto, boton }: { icono: string; titulo: string; texto: string; boton: string }) {
  return (
    <div className="flex flex-1 flex-col gap-space-lg">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center rounded-xl bg-surface-container-lowest p-8 text-center shadow-sm">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant">
          <Simbolo nombre={icono} className="text-[32px]!" />
        </div>
        <h3 className="font-headline-sm text-lg font-bold text-primary">{titulo}</h3>
        <p className="mt-1 mb-4 max-w-sm font-body-md text-sm text-on-surface-variant">{texto}</p>
        <Link
          to="/estudiante/catalogo"
          className="cursor-pointer rounded-lg bg-primary-container px-4 py-2 font-label-md text-sm font-semibold text-on-primary hover:bg-primary"
        >
          {boton}
        </Link>
      </div>
    </div>
  );
}

export function HistorialPage() {
  return (
    <Vacio
      icono="inbox"
      titulo="Aún no tienes solicitudes"
      texto="No se ha registrado ninguna solicitud de alta o baja para el ciclo escolar actual."
      boton="Explorar Catálogo"
    />
  );
}

export function ConfirmacionPage() {
  const { items } = useCarrito();
  return (
    <Vacio
      icono="rule"
      titulo="Confirmación en preparación"
      texto={`El envío de solicitudes estará disponible muy pronto. Tus ${items.length} movimientos quedan guardados en el carrito.`}
      boton="Volver al catálogo"
    />
  );
}
