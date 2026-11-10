// Envío del carrito como folio, compartido por la Confirmación normal y la extemporánea.
import { useValidarCarrito } from "../api/estudiante";
import { ApiError } from "../api/client";
import { useCrearSolicitud } from "../api/solicitudes";
import type { ResultadoMovimiento, Solicitud } from "../api/tipos";
import { useCarrito } from "./Carrito";

export function useEnviarCarrito() {
  const { items, movimientos, quitar, vaciar } = useCarrito();
  const validacion = useValidarCarrito(movimientos);
  const crear = useCrearSolicitud();

  // Con datos de un carrito anterior (placeholder) todavía no se sabe si el actual es válido.
  const revisando = items.length > 0 && (validacion.isPending || validacion.isPlaceholderData);
  const resultados = new Map<number, ResultadoMovimiento>(
    revisando ? [] : (validacion.data?.movimientos ?? []).map((r) => [r.grupo, r]),
  );
  const invalido = items.length > 0 && !revisando && validacion.data?.valido === false;

  const error = crear.error instanceof ApiError ? crear.error : null;

  const enviar = (justificacion: string, alTerminar: (solicitud: Solicitud) => void) =>
    crear.mutate(
      { justificacion, movimientos },
      {
        onSuccess: (solicitud) => {
          vaciar();
          alTerminar(solicitud);
        },
      },
    );

  return {
    items,
    quitar,
    resultados,
    revisando,
    invalido,
    errorValidacion: validacion.error,
    enviando: crear.isPending,
    /** Error general del envío (convocatoria, movimientos inválidos, red). */
    errorEnvio: error && !error.campo("justificacion") ? error.message : crear.error && !error ? crear.error.message : null,
    /** Error de la justificación que respondió el backend. */
    errorJustificacion: error?.campo("justificacion"),
    enviar,
  };
}
