import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

// Inicio del administrador. Por ahora solo saluda y dice qué viene; se llena en F11.
// El estudiante tiene su portal en src/estudiante/ y control escolar el suyo en src/control/.

function Inicio({ titulo, children, proximamente }: { titulo: string; children?: ReactNode; proximamente: string[] }) {
  const { usuario } = useAuth();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-slate-500">Hola, {usuario?.nombre}</p>
        <h1 className="font-display text-2xl font-bold text-primary">{titulo}</h1>
        {children}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-semibold text-slate-900">Próximamente</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          {proximamente.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function InicioAdministrador() {
  return (
    <Inicio titulo="Administración" proximamente={["Usuarios y roles"]}>
      <p className="mt-1 text-sm text-slate-600">
        Mientras tanto puedes usar el{" "}
        <a href="/admin/" className="font-semibold text-primary hover:underline">
          panel de Django
        </a>
        .
      </p>
    </Inicio>
  );
}

export function NoEncontrada() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-display text-5xl font-bold text-primary">404</p>
      <p className="text-slate-600">Esta página no existe.</p>
      <Link to="/" className="font-semibold text-primary hover:underline">
        Ir al inicio
      </Link>
    </div>
  );
}
