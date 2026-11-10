// Filtros guardados en la URL (?q=&estado=...) para que "Volver" los conserve.
import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Cambia un filtro sin perder los demás. Parte de la URL actual y no de los parámetros del último
 * render: si se cambian dos filtros seguidos, React Router entregaría al segundo los valores viejos
 * y el primero se perdería.
 */
export function useCambiarFiltro() {
  const [, setParams] = useSearchParams();
  return useCallback(
    (nombre: string, valor: string) => {
      const nuevos = new URLSearchParams(window.location.search);
      if (valor) nuevos.set(nombre, valor);
      else nuevos.delete(nombre);
      setParams(nuevos, { replace: true });
    },
    [setParams],
  );
}
