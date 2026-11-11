// Contraseña temporal recién creada: se muestra una sola vez (no hay correo, decisión D4).
// La usan Usuarios y Roles (alta y restablecer) y la revisión de folio de control escolar.
import { useState } from "react";
import { Modal } from "../control/Modal";
import { Simbolo } from "./acceso";

export function PasswordTemporal({
  titulo,
  usuario,
  password,
  cerrar,
}: {
  titulo: string;
  /** "Mariana Gómez Torres (mariana.gomez)". */
  usuario: string;
  password: string;
  cerrar: () => void;
}) {
  const [copiada, setCopiada] = useState(false);

  const copiar = () => {
    void navigator.clipboard?.writeText(password).then(
      () => setCopiada(true),
      () => setCopiada(false),
    );
  };

  return (
    <Modal cerrar={cerrar} fondo="bg-primary/40 backdrop-blur-sm" className="max-w-lg p-space-lg" titulo="titulo-password">
      <div className="flex flex-col gap-space-md">
        <div className="flex items-center gap-space-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
            <Simbolo nombre="key" className="text-[24px]!" />
          </div>
          <div>
            <h3 id="titulo-password" className="font-headline-sm text-headline-sm font-bold text-primary">
              {titulo}
            </h3>
            <span className="font-body-sm text-body-sm text-on-surface-variant">{usuario}</span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-space-sm rounded-lg bg-surface-container-low p-space-md">
          <code className="font-mono text-headline-sm font-bold tracking-wider break-all text-primary" data-password>
            {password}
          </code>
          <button
            type="button"
            onClick={copiar}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-surface-container px-space-sm py-1.5 font-label-md text-label-md font-semibold text-primary hover:bg-surface-container-high"
          >
            <Simbolo nombre={copiada ? "check" : "content_copy"} className="text-[18px]!" />
            {copiada ? "Copiada" : "Copiar"}
          </button>
        </div>
        <div className="flex items-start gap-space-xs rounded-lg bg-surface-container-high p-space-sm font-body-sm text-body-sm text-on-surface-variant">
          <Simbolo nombre="warning" className="mt-0.5 shrink-0 text-[18px]! text-secondary" />
          <span>
            Esta contraseña provisional solo se muestra ahora. Entrégala en persona; SABE pedirá cambiarla en el primer ingreso.
          </span>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={cerrar}
            className="rounded-lg bg-primary-container px-space-md py-2 font-label-md text-label-md font-semibold text-on-primary shadow-sm hover:bg-primary"
          >
            Listo
          </button>
        </div>
      </div>
    </Modal>
  );
}
