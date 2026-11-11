// Revisión de un folio por control escolar: vista "view-detail" de stitch/sabe_solicitudes_control_escolar.
import { useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAprobar, useRechazar, useRevision } from "../api/control";
import { useSolicitud } from "../api/solicitudes";
import { useReiniciarPasswordAlumno } from "../api/usuarios";
import type { Choque, MovimientoFolio, RevisionMovimiento, Solicitud } from "../api/tipos";
import { Simbolo, Spinner } from "../components/acceso";
import { PasswordTemporal } from "../components/PasswordTemporal";
import { DIAS_CORTOS, fechaHora, hora, horarioDictamen, unir } from "../estudiante/formato";
import { ESTADO_BANDEJA } from "./estado";
import { Modal } from "./Modal";
import { ChipExtemporaneo } from "./SolicitudesPage";
import { useAviso } from "./Toast";

export function RevisarFolioPage() {
  const id = Number(useParams().id);
  const { data: folio, isPending, error } = useSolicitud(id);
  const { data: revision } = useRevision(id);
  const { state } = useLocation();
  const volver = `/control-escolar/solicitudes${(state as { volver?: string } | null)?.volver ?? ""}`;
  const [vistoBueno, setVistoBueno] = useState(false);

  if (isPending) {
    return (
      <div className="flex items-center justify-center gap-2 p-space-xl text-on-surface-variant">
        <Spinner className="h-5 w-5 text-primary-container" /> Cargando folio…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-start gap-space-sm">
        <VolverA ruta={volver} />
        <p className="font-body-md text-error">{error.message}</p>
      </div>
    );
  }

  const estado = ESTADO_BANDEJA[folio.estado_bandeja];
  const aprobadas = folio.movimientos.filter((m) => m.estado === "aprobada").length;
  const revisiones = new Map((revision?.movimientos ?? []).map((r) => [r.id, r]));

  return (
    <div className="flex w-full flex-col gap-space-lg">
      <div className="flex flex-col">
        <VolverA ruta={volver} />
        <div className="flex flex-wrap items-center gap-space-sm">
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-primary">Folio {folio.folio_digital}</h1>
          <span className={`inline-flex items-center rounded-full px-space-sm py-1 font-label-sm text-label-sm font-bold ${estado.chip}`}>
            {estado.texto}
          </span>
          {folio.extemporanea && <ChipExtemporaneo className="px-space-sm py-1" />}
        </div>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
          Recibido el {fechaHora(folio.fecha_solicitud)}. Revisa la justificación y dictamina cada movimiento.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-space-lg xl:grid-cols-12">
        <div className="flex flex-col gap-space-md xl:col-span-4">
          <Tarjeta icono="badge" titulo="Expediente del alumno">
            <div className="grid grid-cols-2 gap-space-sm font-body-md text-body-md">
              <Dato etiqueta="Nombre" valor={folio.estudiante.nombre} />
              <Dato etiqueta="Matrícula" valor={folio.estudiante.matricula} />
              <Dato etiqueta="Programa" valor={`Lic. en ${folio.estudiante.programa}`} />
              <Dato etiqueta="Avance" valor={`${folio.estudiante.semestre}° semestre`} />
            </div>
            <RestablecerPassword folio={folio} />
          </Tarjeta>
          <Tarjeta icono="format_quote" titulo="Justificación del alumno">
            <p className="font-body-md text-body-md break-words text-on-surface-variant italic">“{folio.justificacion}”</p>
          </Tarjeta>
          {folio.extemporanea && (
            <label className="flex cursor-pointer items-start gap-space-sm rounded-xl bg-secondary-fixed/40 p-space-md">
              <input
                type="checkbox"
                checked={vistoBueno}
                onChange={(e) => setVistoBueno(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span className="font-body-md text-body-md text-on-surface">
                <strong>Visto bueno de Control Escolar.</strong> Este folio es extemporáneo: solo se puede aprobar si confirmas que revisaste el
                justificante y autorizas el trámite.
              </span>
            </label>
          )}
        </div>

        <div className="flex flex-col gap-space-md xl:col-span-8">
          {folio.movimientos.map((m) => (
            <TarjetaMovimiento key={m.id} folio={folio} movimiento={m} revision={revisiones.get(m.id)} vistoBueno={vistoBueno} />
          ))}
        </div>
      </div>

      {aprobadas > 0 && (
        <div className="flex flex-col justify-between gap-space-sm rounded-xl bg-tertiary-fixed/50 p-space-md md:flex-row md:items-center">
          <span className="font-body-md text-body-md text-on-tertiary-fixed">
            <strong>
              {aprobadas} movimiento{aprobadas > 1 ? "s" : ""} aprobado{aprobadas > 1 ? "s" : ""}.
            </strong>{" "}
            Ya puede{aprobadas > 1 ? "n" : ""} incluirse en el Excel de intercambio para SADCE.
          </span>
          <Link
            to="/control-escolar/exportacion"
            className="w-fit rounded-lg bg-primary-container px-space-md py-space-xs font-label-md text-label-md text-on-primary"
          >
            Ir a Exportar Excel para SADCE
          </Link>
        </div>
      )}
    </div>
  );
}

function VolverA({ ruta }: { ruta: string }) {
  return (
    <Link to={ruta} className="mb-space-xs flex w-fit items-center gap-1 font-label-md text-label-md text-primary hover:underline">
      <Simbolo nombre="arrow_back" className="text-[18px]!" />
      Volver a solicitudes
    </Link>
  );
}

function Tarjeta({ icono, titulo, children }: { icono: string; titulo: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
      <h2 className="mb-space-sm flex items-center gap-space-xs font-headline-sm text-headline-sm font-bold text-primary">
        <Simbolo nombre={icono} />
        {titulo}
      </h2>
      {children}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0">
      <div className="font-label-sm text-label-sm text-on-surface-variant uppercase">{etiqueta}</div>
      <div className="font-semibold break-words">{valor}</div>
    </div>
  );
}

/** "Finanzas Corporativas II (Mar y Jue 10:00 a 12:00)" */
function textoTraslape(c: Choque): string {
  return `${c.materia} (${unir(c.dias.map((d) => DIAS_CORTOS[d]))} ${hora(c.hora_inicio)} a ${hora(c.hora_fin)})`;
}

function lugares(n: number, de: number): string {
  return `${n} ${n === 1 ? "lugar disponible" : "lugares disponibles"} de ${de}`;
}

const CAJA = {
  error: "bg-error-container/70 text-on-error-container font-semibold",
  ok: "bg-tertiary-fixed/60 text-on-tertiary-fixed font-semibold",
  info: "bg-surface-container-low text-on-surface-variant",
};

function Caja({ tono, icono, children }: { tono: keyof typeof CAJA; icono: string; children: ReactNode }) {
  return (
    <div className={`flex items-center gap-space-xs rounded-xl p-space-sm font-label-md text-label-md ${CAJA[tono]}`}>
      <Simbolo nombre={icono} className="shrink-0 text-[18px]!" />
      <span>{children}</span>
    </div>
  );
}

/** Validación del movimiento: choques, cupo y lo que impida aprobarlo hoy (de GET /revision/). */
function Validacion({ movimiento, revision }: { movimiento: MovimientoFolio; revision?: RevisionMovimiento }) {
  const { grupo } = movimiento;
  if (movimiento.tipo_tramite === "BAJA") {
    return (
      <Caja tono="info" icono="info">
        Se libera 1 lugar. Las bajas no requieren validación de horario.
      </Caja>
    );
  }
  const cupo = lugares(grupo.cupo_disponible, grupo.cupo_maximo);
  // Aprobada: pasó la revisión al aprobarse (como en stitch). Rechazada o cancelada: no hay nada que revisar.
  if (movimiento.estado === "aprobada" || movimiento.estado === "cargada_sadce") {
    return (
      <Caja tono="ok" icono="check_circle">
        Libre de traslapes. {cupo}.
      </Caja>
    );
  }
  if (movimiento.estado !== "pendiente") return null;
  if (!revision) {
    return (
      <Caja tono="info" icono="hourglass_top">
        Revisando cupo y horario…
      </Caja>
    );
  }
  const cajas: ReactNode[] = [];
  if (revision.choques.length) {
    cajas.push(
      <Caja key="choques" tono="error" icono="warning">
        Traslape de horario con {revision.choques.map(textoTraslape).join(", ")}. Esta alta no se puede aprobar.
      </Caja>,
    );
  }
  for (const e of revision.errores) {
    cajas.push(
      <Caja key={e.codigo} tono="error" icono={e.codigo === "baja_pendiente" ? "swap_horiz" : "block"}>
        {e.codigo === "sin_cupo" ? `Sin cupo: ${cupo}.` : e.detalle}
      </Caja>,
    );
  }
  if (cajas.length) return <>{cajas}</>;
  return (
    <Caja tono="ok" icono="check_circle">
      Libre de traslapes. {cupo}.
    </Caja>
  );
}

function TarjetaMovimiento({
  folio,
  movimiento,
  revision,
  vistoBueno,
}: {
  folio: Solicitud;
  movimiento: MovimientoFolio;
  revision?: RevisionMovimiento;
  vistoBueno: boolean;
}) {
  const alta = movimiento.tipo_tramite === "ALTA";
  const { grupo } = movimiento;
  return (
    <div className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-lowest p-space-md shadow-sm">
      <div className="flex items-start gap-space-sm">
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-space-sm py-1 font-label-sm text-label-sm font-bold ${
            alta ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-error-container text-on-error-container"
          }`}
        >
          <Simbolo nombre={alta ? "add_circle" : "do_not_disturb_on"} className="text-[14px]!" />
          {movimiento.tipo_tramite}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="font-headline-sm text-headline-sm font-bold text-primary">{grupo.materia.nombre}</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {grupo.materia.clave} • Grupo {grupo.num_grupo} • {grupo.docente}
          </span>
          <span className="mt-1 flex items-center gap-1 font-label-md text-label-md text-on-surface">
            <Simbolo nombre="schedule" className="text-[16px]!" />
            {horarioDictamen(grupo.horarios)}
          </span>
        </div>
      </div>
      <Validacion movimiento={movimiento} revision={revision} />
      <Pie folio={folio} movimiento={movimiento} revision={revision} vistoBueno={vistoBueno} />
    </div>
  );
}

function Pie({
  folio,
  movimiento,
  revision,
  vistoBueno,
}: {
  folio: Solicitud;
  movimiento: MovimientoFolio;
  revision?: RevisionMovimiento;
  vistoBueno: boolean;
}) {
  const aprobar = useAprobar();
  const rechazar = useRechazar();
  const aviso = useAviso();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const [fallo, setFallo] = useState("");

  const quien = `${movimiento.revisado_por ?? "Control Escolar"} • ${movimiento.fecha_resolucion ? fechaHora(movimiento.fecha_resolucion) : ""}`;
  if (movimiento.estado === "aprobada" || movimiento.estado === "cargada_sadce") {
    return (
      <div className="flex items-center gap-space-xs font-label-md text-label-md font-semibold text-on-tertiary-container">
        <Simbolo nombre="verified" className="text-[18px]!" />
        Aprobado por {quien}
      </div>
    );
  }
  if (movimiento.estado === "rechazada") {
    return (
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-space-xs font-label-md text-label-md font-semibold text-error">
          <Simbolo nombre="cancel" className="text-[18px]!" />
          Rechazado por {quien}
        </span>
        <span className="font-body-sm text-body-sm break-words text-on-surface-variant">Motivo: {movimiento.motivo_rechazo}</span>
      </div>
    );
  }
  if (movimiento.estado === "cancelada") {
    return (
      <div className="flex items-center gap-space-xs font-label-md text-label-md font-semibold text-on-surface-variant">
        <Simbolo nombre="block" className="text-[18px]!" />
        Cancelado por el alumno
      </div>
    );
  }

  const alta = movimiento.tipo_tramite === "ALTA";
  const bloqueada = alta && (!revision || revision.choques.length > 0 || revision.errores.length > 0);
  const ocupado = aprobar.isPending || rechazar.isPending;

  const alAprobar = () => {
    setFallo("");
    if (folio.extemporanea && !vistoBueno) {
      aviso("Marca el visto bueno de Control Escolar para aprobar un folio extemporáneo.");
      return;
    }
    aprobar.mutate(
      { movimiento: movimiento.id, visto_bueno: vistoBueno },
      {
        onSuccess: () => aviso("Movimiento aprobado. Se notificó al alumno."),
        onError: (error) => setFallo(error.message),
      },
    );
  };

  const alRechazar = () => {
    setFallo("");
    if (!motivo.trim()) {
      setFaltaMotivo(true);
      return;
    }
    rechazar.mutate(
      { movimiento: movimiento.id, motivo },
      {
        onSuccess: () => aviso("Movimiento rechazado. El alumno verá el motivo."),
        onError: (error) => setFallo(error.message),
      },
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-space-sm">
        <button
          type="button"
          onClick={alAprobar}
          disabled={bloqueada || ocupado}
          className={`flex items-center gap-space-xs rounded-xl px-space-lg py-space-sm font-label-lg text-label-lg transition-colors ${
            bloqueada ? "cursor-not-allowed bg-surface-container text-on-surface-variant" : "cursor-pointer bg-tertiary-container text-on-primary hover:opacity-90"
          }`}
        >
          <Simbolo nombre="check" className="text-[18px]!" />
          {aprobar.isPending ? "Aprobando..." : "Aprobar movimiento"}
        </button>
        <button
          type="button"
          onClick={() => setRechazando(true)}
          disabled={ocupado}
          className="flex cursor-pointer items-center gap-space-xs rounded-xl bg-error-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-error-container transition-colors hover:opacity-90"
        >
          <Simbolo nombre="close" className="text-[18px]!" />
          Rechazar
        </button>
      </div>
      {fallo && <p className="font-label-sm text-label-sm text-error">{fallo}</p>}
      {rechazando && (
        <div className="mt-space-sm">
          <label className="font-label-md text-label-md font-semibold text-on-surface" htmlFor={`motivo-${movimiento.id}`}>
            Motivo del rechazo (obligatorio, lo verá el alumno)
          </label>
          <textarea
            id={`motivo-${movimiento.id}`}
            rows={2}
            autoFocus
            maxLength={500}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              setFaltaMotivo(false);
            }}
            placeholder="Ej. El grupo no tiene cupo disponible."
            className="mt-1 w-full rounded-xl border border-outline-variant p-space-sm font-body-md text-body-md focus:ring-2 focus:ring-error focus:outline-none"
          />
          {faltaMotivo && <p className="mt-1 font-label-sm text-label-sm text-error">Escribe el motivo para poder rechazar.</p>}
          <div className="mt-space-sm flex gap-space-sm">
            <button
              type="button"
              onClick={alRechazar}
              disabled={ocupado}
              className="cursor-pointer rounded-lg bg-error px-space-md py-space-xs font-label-md text-label-md text-on-error"
            >
              {rechazar.isPending ? "Rechazando..." : "Confirmar rechazo"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRechazando(false);
                setFaltaMotivo(false);
              }}
              className="cursor-pointer rounded-lg bg-surface-container px-space-md py-space-xs font-label-md text-label-md"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Control escolar restablece la contraseña del alumno del folio (ventanilla, "Recuperar contraseña").
 * La temporal se muestra una sola vez.
 */
function RestablecerPassword({ folio }: { folio: Solicitud }) {
  const [confirmando, setConfirmando] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const reiniciar = useReiniciarPasswordAlumno();
  const { nombre, matricula } = folio.estudiante;

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="mt-space-sm inline-flex items-center gap-1 self-start rounded-lg px-space-sm py-1 font-label-md text-label-md font-semibold text-primary hover:bg-surface-container"
      >
        <Simbolo nombre="lock_reset" className="text-[18px]!" />
        Restablecer contraseña
      </button>
      {confirmando && (
        <Modal cerrar={() => setConfirmando(false)} fondo="bg-primary/40 backdrop-blur-sm" className="max-w-md p-space-lg" titulo="titulo-restablecer">
          <div className="flex flex-col gap-space-md">
            <h3 id="titulo-restablecer" className="font-headline-sm text-headline-sm font-bold text-primary">
              Restablecer contraseña del alumno
            </h3>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Se generará una contraseña provisional para {nombre} ({matricula}). La actual dejará de funcionar y deberá cambiarla al entrar.
            </p>
            {reiniciar.error && <p className="font-body-sm text-body-sm text-error">{reiniciar.error.message}</p>}
            <div className="flex items-center justify-end gap-space-sm">
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="rounded-lg bg-surface-container px-space-md py-2 font-label-md text-label-md font-semibold text-on-surface hover:bg-surface-container-high"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={reiniciar.isPending}
                onClick={() =>
                  reiniciar.mutate(folio.id, {
                    onSuccess: (r) => {
                      setConfirmando(false);
                      setPassword(r.password_temporal);
                    },
                  })
                }
                className="inline-flex items-center gap-space-xs rounded-lg bg-primary-container px-space-md py-2 font-label-md text-label-md font-semibold text-on-primary shadow-sm hover:bg-primary disabled:opacity-60"
              >
                {reiniciar.isPending && <Spinner />}
                Restablecer
              </button>
            </div>
          </div>
        </Modal>
      )}
      {password && (
        <PasswordTemporal
          titulo="Contraseña provisional restablecida"
          usuario={`${nombre} (${matricula})`}
          password={password}
          cerrar={() => setPassword(null)}
        />
      )}
    </>
  );
}
