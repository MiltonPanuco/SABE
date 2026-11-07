import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { inicioPorRol, useAuth } from "../auth/AuthProvider";
import { Aviso, Boton, Campo, TarjetaAcceso } from "../components/ui";

const MINIMO = 8;

function Requisito({ cumple, children }: { cumple: boolean; children: string }) {
  return (
    <li className={`flex items-center gap-2 text-sm ${cumple ? "text-emerald-700" : "text-slate-500"}`}>
      <span aria-hidden>{cumple ? "✓" : "✕"}</span>
      {children}
      <span className="sr-only">{cumple ? "(cumple)" : "(pendiente)"}</span>
    </li>
  );
}

export function CambiarPasswordPage() {
  const { usuario, recargarUsuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!usuario) return null;
  const obligatorio = usuario.debe_cambiar_password;
  const largoOk = nueva.length >= MINIMO;
  const coincide = nueva.length > 0 && nueva === confirmar;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!largoOk || !coincide || !usuario) return;
    setError(null);
    setEnviando(true);
    try {
      await api("/auth/cambiar-password/", { method: "POST", body: { actual, nueva } });
      await recargarUsuario();
      navigate(inicioPorRol(usuario.rol), { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, null));
      setEnviando(false);
    }
  }

  const errorGeneral = error && !error.campo("actual") && !error.campo("nueva") ? error.message : null;

  return (
    <TarjetaAcceso>
      {obligatorio && (
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Paso obligatorio</p>
      )}
      <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">
        {obligatorio ? "Cambia tu contraseña temporal" : "Cambiar contraseña"}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {obligatorio
          ? "Es tu primer acceso. Crea una contraseña personal para continuar."
          : "Escribe tu contraseña actual y la nueva."}
      </p>

      <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {usuario.estudiante ? "Matrícula" : "Usuario"}: <strong>{usuario.estudiante?.matricula ?? usuario.username}</strong>
        {usuario.estudiante && <span className="text-slate-500"> • Lic. en {usuario.estudiante.programa}</span>}
      </div>

      <form onSubmit={enviar} className="mt-6 flex flex-col gap-5" noValidate>
        {errorGeneral && <Aviso>{errorGeneral}</Aviso>}
        <Campo
          etiqueta={obligatorio ? "Contraseña actual (temporal)" : "Contraseña actual"}
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          error={error?.campo("actual")}
          autoFocus
        />
        <Campo
          etiqueta="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          error={error?.campo("nueva")}
        />
        <Campo
          etiqueta="Confirmar contraseña"
          type="password"
          autoComplete="new-password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
        />
        <ul className="flex flex-col gap-1">
          <Requisito cumple={largoOk}>{`Mínimo ${MINIMO} caracteres`}</Requisito>
          <Requisito cumple={coincide}>Coincide con la confirmación</Requisito>
        </ul>
        <Boton type="submit" cargando={enviando} disabled={!actual || !largoOk || !coincide} className="w-full">
          Guardar y continuar
        </Boton>
      </form>

      <div className="mt-6 text-center text-sm">
        {obligatorio ? (
          <button onClick={cerrarSesion} className="font-semibold text-primary hover:underline">
            Cerrar sesión
          </button>
        ) : (
          <Link to={inicioPorRol(usuario.rol)} className="font-semibold text-primary hover:underline">
            Cancelar
          </Link>
        )}
      </div>
    </TarjetaAcceso>
  );
}
