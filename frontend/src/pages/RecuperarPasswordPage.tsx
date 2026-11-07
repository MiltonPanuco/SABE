import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Aviso, Boton, Campo, TarjetaAcceso } from "../components/ui";

// El envío por correo depende de la decisión D4 de docs/PLAN.md.
// Mientras tanto, la pantalla explica cómo recuperar el acceso en ventanilla.
export function RecuperarPasswordPage() {
  const [matricula, setMatricula] = useState("");
  const [enviado, setEnviado] = useState(false);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    if (matricula.trim()) setEnviado(true);
  };

  return (
    <TarjetaAcceso>
      <h1 className="font-display text-2xl font-bold text-slate-900">Recupera tu acceso</h1>
      <p className="mt-1 text-sm text-slate-600">Escribe tu matrícula para restablecer tu contraseña.</p>

      {enviado ? (
        <div className="mt-6 flex flex-col gap-4">
          <Aviso tipo="info">
            Por ahora la recuperación se hace en persona: acude a la ventanilla de Control Escolar con tu matrícula{" "}
            <strong>{matricula.trim()}</strong> y te asignarán una contraseña temporal.
          </Aviso>
          <Link to="/login" className="text-center text-sm font-semibold text-primary hover:underline">
            Volver a iniciar sesión
          </Link>
        </div>
      ) : (
        <form onSubmit={enviar} className="mt-6 flex flex-col gap-5">
          <Campo
            etiqueta="Matrícula"
            autoComplete="username"
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            autoFocus
            required
          />
          <Boton type="submit" className="w-full">
            Continuar
          </Boton>
          <Link to="/login" className="text-center text-sm font-semibold text-primary hover:underline">
            Volver a iniciar sesión
          </Link>
        </form>
      )}
    </TarjetaAcceso>
  );
}
