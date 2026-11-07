// Piezas de las pantallas de acceso (login, cambio y recuperación de contraseña),
// copiadas de stitch/sabe_inicio_de_sesi_n_* y stitch/sabe_cambio_obligatorio_*.
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

// Ciclo que muestran los textos fijos de las pantallas de acceso.
// TODO(F3): leerlo de GET /api/periodos/activo/ cuando exista una versión pública.
export const CICLO = "2026-A";

// Trazos de los iconos SVG de stitch (Heroicons outline).
const TRAZOS = {
  usuario: ["M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"],
  candado: ["M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"],
  llave: [
    "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z",
  ],
  checkCirculo: ["M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"],
  ojo: [
    "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
    "M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  ],
  ojoTachado: [
    "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18",
  ],
  entrar: [
    "M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1",
  ],
  flecha: ["M14 5l7 7m0 0l-7 7m7-7H3"],
  edificio: [
    "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  ],
  escudo: [
    "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  ],
  advertencia: [
    "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  ],
  palomita: ["M5 13l4 4L19 7"],
} as const;

export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ nombre, className = "h-5 w-5", grosor = 2 }: { nombre: NombreIcono; className?: string; grosor?: number }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={grosor} viewBox="0 0 24 24" aria-hidden>
      {TRAZOS[nombre].map((d) => (
        <path key={d} d={d} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

// La hoja de Google fija font-size: 24px fuera de las capas de Tailwind v4, así que una clase como
// text-sm no la gana. El tamaño se pasa en línea a partir de la misma clase que usa stitch.
const TAMANO_SIMBOLO: Record<string, string> = {
  "text-xs": "0.75rem",
  "text-sm": "0.875rem",
  "text-base": "1rem",
  "text-lg": "1.125rem",
  "text-xl": "1.25rem",
  "text-2xl": "1.5rem",
  "text-3xl": "1.875rem",
  "text-4xl": "2.25rem",
};

/** Icono de Material Symbols (los usa la pantalla de recuperar contraseña). */
export function Simbolo({ nombre, className = "", relleno = false }: { nombre: string; className?: string; relleno?: boolean }) {
  const tamano = className.split(/\s+/).map((c) => TAMANO_SIMBOLO[c]).find(Boolean);
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ ...(tamano && { fontSize: tamano }), ...(relleno && { fontVariationSettings: "'FILL' 1" }) }}
      aria-hidden
    >
      {nombre}
    </span>
  );
}

interface CampoAccesoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  etiqueta: string;
  icono: NombreIcono;
  obligatorio?: boolean;
  ayuda?: string;
  error?: string;
  /** "grande": login (h-12, iconos de 20px). "normal": cambio de contraseña (iconos de 16px). */
  tamano?: "grande" | "normal";
}

/** Campo con etiqueta en mayúsculas, icono a la izquierda y, si es contraseña, el ojo para mostrarla. */
export function CampoAcceso({
  etiqueta,
  icono,
  obligatorio,
  ayuda,
  error,
  tamano = "grande",
  type = "text",
  ...props
}: CampoAccesoProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const esPassword = type === "password";
  const grande = tamano === "grande";
  const iconoClase = grande ? "h-5 w-5" : "h-4 w-4";
  const borde = error
    ? "border-red-300 focus:border-red-500 focus:ring-red-500/15"
    : grande
      ? "border-slate-200 focus:border-uan-navy focus:ring-uan-navy/15"
      : "border-slate-300 focus:border-uan-navy focus:ring-uan-navy";

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700">
        {etiqueta} {obligatorio && <span className="text-rose-500">*</span>}
      </label>
      <div className={`relative ${grande ? "rounded-xl shadow-sm" : ""}`}>
        <div className={`pointer-events-none absolute inset-y-0 left-0 flex items-center text-slate-400 pl-3.5`}>
          <Icono nombre={icono} className={iconoClase} />
        </div>
        <input
          id={id}
          type={esPassword && visible ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined}
          className={
            grande
              ? `block h-12 w-full rounded-xl border bg-slate-50/50 py-3 pl-11 ${esPassword ? "pr-11" : "pr-4"} text-base text-slate-900 transition-all duration-200 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 ${borde}`
              : `w-full rounded-xl border bg-slate-50/50 py-2.5 pl-10 pr-10 text-sm text-slate-900 transition placeholder:text-slate-400 focus:outline-none focus:ring-2 ${borde}`
          }
          {...props}
        />
        {esPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? `Ocultar ${etiqueta.toLowerCase()}` : `Mostrar ${etiqueta.toLowerCase()}`}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none"
          >
            <Icono nombre={visible ? "ojoTachado" : "ojo"} className={iconoClase} />
          </button>
        )}
      </div>
      {error ? (
        <span id={`${id}-error`} className="mt-1 block text-[11px] font-medium text-red-600">
          {error}
        </span>
      ) : (
        ayuda && (
          <span id={`${id}-ayuda`} className="mt-1 block text-[11px] text-slate-400">
            {ayuda}
          </span>
        )
      )}
    </div>
  );
}

/** Alerta roja de la tarjeta de login (#feedback-alert en stitch). */
export function AlertaAcceso({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
      <svg className="h-4 w-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
        <path
          clipRule="evenodd"
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
        />
      </svg>
      <span>{children}</span>
    </div>
  );
}

/** Spinner del botón de login mientras se envía. */
export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
