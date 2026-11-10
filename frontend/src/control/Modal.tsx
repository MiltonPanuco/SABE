// Ventana sobre la página para los formularios de control escolar (periodo y oferta en stitch).
// Esc y el fondo la cierran, y la página de atrás no se desplaza mientras está abierta.
import { useEffect, type ReactNode } from "react";

export function Modal({
  cerrar,
  fondo = "bg-primary/60 backdrop-blur-sm",
  className = "",
  titulo,
  children,
}: {
  cerrar: () => void;
  /** Clases del fondo: cada pantalla de stitch usa el suyo. */
  fondo?: string;
  /** Clases de la tarjeta. */
  className?: string;
  /** Id del título, para lectores de pantalla. */
  titulo?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && cerrar();
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.body.classList.remove("overflow-hidden");
      document.removeEventListener("keydown", alTeclear);
    };
  }, [cerrar]);

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center p-space-md print:hidden ${fondo}`}
      onMouseDown={(e) => e.target === e.currentTarget && cerrar()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titulo}
    >
      <div className={`w-full overflow-y-auto rounded-2xl bg-surface-container-lowest shadow-xl ${className}`}>{children}</div>
    </div>
  );
}
