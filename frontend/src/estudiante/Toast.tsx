// Aviso flotante del portal del estudiante (toast-wrapper de stitch/sabe_estudiantes).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Simbolo } from "../components/acceso";

interface Aviso {
  titulo: string;
  detalle: string;
  advertencia: boolean;
}

type MostrarAviso = (titulo: string, detalle: string, advertencia?: boolean) => void;

const ToastContext = createContext<MostrarAviso | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [visible, setVisible] = useState(false);
  const temporizador = useRef<number | undefined>(undefined);

  const mostrar = useCallback<MostrarAviso>((titulo, detalle, advertencia = false) => {
    window.clearTimeout(temporizador.current);
    setAviso({ titulo, detalle, advertencia });
    setVisible(true);
    // Se cierra solo a los 3.5 s, como en stitch.
    temporizador.current = window.setTimeout(() => setVisible(false), 3500);
  }, []);

  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  return (
    <ToastContext.Provider value={mostrar}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed top-20 right-3 left-3 z-50 flex transform justify-end transition-all duration-300 sm:top-24 sm:right-6 sm:left-auto ${
          visible ? "translate-y-0 scale-100 opacity-100" : "-translate-y-4 scale-95 opacity-0"
        }`}
      >
        {aviso && (
          <div
            className={`flex w-full max-w-full items-start gap-3 rounded-xl p-3 text-white shadow-2xl sm:w-80 sm:p-4 md:w-96 ${
              visible ? "pointer-events-auto" : ""
            } ${aviso.advertencia ? "border border-amber-400/30 bg-amber-600" : "border border-white/10 bg-[#002B49]"}`}
          >
            <Simbolo
              nombre={aviso.advertencia ? "warning" : "check_circle"}
              className={`mt-0.5 shrink-0 text-[22px]! sm:text-[24px]! ${aviso.advertencia ? "text-amber-200" : "text-emerald-400"}`}
            />
            <div className="mr-1 flex min-w-0 flex-1 flex-col">
              <span className="truncate font-label-md text-xs font-bold tracking-wide text-white sm:text-label-md">
                {aviso.titulo}
              </span>
              <span className="mt-0.5 font-body-sm text-[11px] leading-snug text-slate-200 sm:text-[12px]">{aviso.detalle}</span>
            </div>
            <button
              type="button"
              onClick={() => setVisible(false)}
              title="Cerrar notificación"
              className="shrink-0 cursor-pointer rounded-lg p-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus:outline-none"
            >
              <Simbolo nombre="close" className="text-[16px]! sm:text-[18px]!" />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): MostrarAviso {
  const mostrar = useContext(ToastContext);
  if (!mostrar) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return mostrar;
}
