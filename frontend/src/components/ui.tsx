import { useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

interface CampoProps extends InputHTMLAttributes<HTMLInputElement> {
  etiqueta: string;
  ayuda?: string;
  error?: string;
}

/** Input con etiqueta, ayuda y error. Para contraseñas agrega el botón Mostrar/Ocultar. */
export function Campo({ etiqueta, ayuda, error, type = "text", ...props }: CampoProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const esPassword = type === "password";
  const descripcion = error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-slate-800">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={id}
          type={esPassword && visible ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={descripcion}
          className={`w-full rounded-lg border bg-white px-3 py-2.5 text-base outline-none transition focus:ring-2 focus:ring-primary/30 sm:text-sm ${
            error ? "border-baja focus:border-baja" : "border-slate-300 focus:border-primary"
          } ${esPassword ? "pr-20" : ""}`}
          {...props}
        />
        {esPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-primary hover:underline"
          >
            {visible ? "Ocultar" : "Mostrar"}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-baja">
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={`${id}-ayuda`} className="text-xs text-slate-500">
            {ayuda}
          </p>
        )
      )}
    </div>
  );
}

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: "primario" | "secundario";
  cargando?: boolean;
}

export function Boton({ variante = "primario", cargando, disabled, children, className = "", ...props }: BotonProps) {
  const estilos =
    variante === "primario"
      ? "bg-primary text-white hover:bg-primary-oscuro"
      : "border border-slate-300 bg-white text-primary hover:bg-slate-50";
  return (
    <button
      disabled={disabled || cargando}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${estilos} ${className}`}
      {...props}
    >
      {cargando ? "Un momento…" : children}
    </button>
  );
}

export function Aviso({ tipo = "error", children }: { tipo?: "error" | "info" | "exito"; children: ReactNode }) {
  const estilos = {
    error: "border-baja/30 bg-red-50 text-red-800",
    info: "border-primary/20 bg-sky-50 text-primary",
    exito: "border-alta/30 bg-emerald-50 text-emerald-800",
  }[tipo];
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2.5 text-sm ${estilos}`}>
      {children}
    </div>
  );
}

/** Pantalla completa con un mensaje centrado (cargando, error de conexión). */
export function PantallaMensaje({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6 text-slate-600">{children}</div>;
}

/** Tarjeta blanca centrada para las pantallas de acceso. */
export function TarjetaAcceso({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <p className="font-display text-3xl font-bold text-primary">SABE</p>
        <p className="text-sm text-slate-500">Sistema de Altas y Bajas de Economía</p>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
      <p className="mt-6 text-center text-xs text-slate-500">
        Unidad Académica de Economía • Universidad Autónoma de Nayarit
      </p>
    </div>
  );
}
