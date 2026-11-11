import { Link } from "react-router-dom";

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
