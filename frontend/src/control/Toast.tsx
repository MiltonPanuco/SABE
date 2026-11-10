// Aviso de las pantallas de control escolar: la píldora azul de stitch/_shared/prototipo.js (toast()).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type MostrarAviso = (mensaje: string) => void;

const AvisoContext = createContext<MostrarAviso | null>(null);

export function AvisoProvider({ children }: { children: ReactNode }) {
  const [mensaje, setMensaje] = useState("");
  const [visible, setVisible] = useState(false);
  const temporizador = useRef<number | undefined>(undefined);

  const mostrar = useCallback<MostrarAviso>((texto) => {
    window.clearTimeout(temporizador.current);
    setMensaje(texto);
    setVisible(true);
    temporizador.current = window.setTimeout(() => setVisible(false), 2800);
  }, []);

  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  return (
    <AvisoContext.Provider value={mostrar}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed bottom-7 left-1/2 z-[99999] max-w-[90vw] -translate-x-1/2 rounded-xl bg-[#002b49] px-5 py-3 text-center font-sans text-[13px] font-semibold text-white shadow-[0_10px_25px_rgba(0,43,73,0.3)] transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {mensaje}
      </div>
    </AvisoContext.Provider>
  );
}

export function useAviso(): MostrarAviso {
  const mostrar = useContext(AvisoContext);
  if (!mostrar) throw new Error("useAviso debe usarse dentro de <AvisoProvider>");
  return mostrar;
}
