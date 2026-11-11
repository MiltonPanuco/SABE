import type { ReactNode } from "react";

/** Pantalla completa con un mensaje centrado (cargando, error de conexión). */
export function PantallaMensaje({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6 text-slate-600">{children}</div>;
}
