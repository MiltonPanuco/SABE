// Vista 2 de stitch/sabe_estudiantes: horario semestral en retícula o en lista.
import { useState, type CSSProperties, type ReactNode } from "react";
import { useMiHorario, usePeriodoActivo } from "../api/estudiante";
import type { DiaSemana, Grupo, TipoTramite } from "../api/tipos";
import { useAuth } from "../auth/AuthProvider";
import { Simbolo, Spinner } from "../components/acceso";
import { useCarrito } from "./Carrito";
import { DIAS, horarioTexto, lugar, lugares, minutos } from "./formato";

// Colores de las materias en el orden del prototipo (verde, ámbar, verde, azul).
const COLORES = [
  "bg-on-tertiary-container/10 text-on-tertiary-container",
  "bg-secondary-fixed text-on-secondary-container",
  "bg-on-tertiary-container/10 text-on-tertiary-container",
  "bg-primary-fixed text-primary",
];

/** Una materia del horario: inscrita, o un alta/baja que está en trámite. */
interface Clase {
  grupo: Grupo;
  color: string;
  /** null = inscrita sin movimiento pendiente */
  tramite: TipoTramite | null;
}

function clasesDelAlumno(inscritas: Grupo[], enTramite: { grupo: Grupo; tipo_tramite: TipoTramite }[]): Clase[] {
  const bajas = new Set(enTramite.filter((m) => m.tipo_tramite === "BAJA").map((m) => m.grupo.id));
  const clases: Clase[] = inscritas.map((grupo) => ({ grupo, color: "", tramite: bajas.has(grupo.id) ? "BAJA" : null }));
  for (const m of enTramite) {
    if (m.tipo_tramite === "ALTA") clases.push({ grupo: m.grupo, color: "", tramite: "ALTA" });
  }
  return clases.map((c, i) => ({ ...c, color: COLORES[i % COLORES.length] }));
}

export function HorarioPage() {
  const { usuario } = useAuth();
  const { data: periodo } = usePeriodoActivo();
  const { data, isPending, error } = useMiHorario();
  const [modo, setModo] = useState<"reticula" | "lista">("reticula");

  const clases = data ? clasesDelAlumno(data.inscritas, data.en_tramite) : [];
  const subtitulo = [periodo && `Ciclo ${periodo.ciclo}`, usuario?.estudiante && `Licenciatura en ${usuario.estudiante.programa}`]
    .filter(Boolean)
    .join(" • ");

  const boton = (activo: boolean) =>
    `flex cursor-pointer items-center gap-1 rounded-md px-3 py-1.5 font-label-md text-label-md transition-all ${
      activo ? "bg-surface-container-lowest font-bold text-on-surface" : "text-on-surface-variant hover:text-on-surface"
    }`;

  return (
    <div className="flex flex-1 flex-col gap-space-lg">
      <div className="flex flex-col items-start justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-space-sm">
          <div className="rounded-lg bg-primary-container p-2.5 text-on-primary">
            <Simbolo nombre="calendar_month" className="text-[24px]!" />
          </div>
          <div>
            <h2 className="font-headline-md text-headline-md text-primary">Horario Semestral</h2>
            <span className="font-body-sm text-body-sm text-on-surface-variant">{subtitulo}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 self-stretch sm:self-auto print:hidden">
          <div className="flex items-center rounded-lg bg-surface-container p-1">
            <button type="button" className={boton(modo === "reticula")} onClick={() => setModo("reticula")}>
              <Simbolo nombre="calendar_view_week" className="text-[16px]!" /> Retícula
            </button>
            <button type="button" className={boton(modo === "lista")} onClick={() => setModo("lista")}>
              <Simbolo nombre="view_list" className="text-[16px]!" /> Lista
            </button>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex cursor-pointer items-center gap-1 rounded-lg bg-surface-container-high px-3 py-2 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-highest"
          >
            <Simbolo nombre="print" className="text-[18px]!" /> Imprimir
          </button>
        </div>
      </div>

      {isPending ? (
        <Aviso>
          <Spinner className="h-5 w-5 text-primary-container" /> Cargando tu horario…
        </Aviso>
      ) : error ? (
        <Aviso>{error.message}</Aviso>
      ) : clases.length === 0 ? (
        <Aviso>No tienes materias inscritas{periodo ? ` en el Ciclo ${periodo.ciclo}` : ""}.</Aviso>
      ) : modo === "reticula" ? (
        <Reticula clases={clases} />
      ) : (
        <Lista clases={clases} />
      )}
    </div>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl bg-surface-container-lowest p-8 text-center font-body-md text-on-surface-variant shadow-sm">
      {children}
    </div>
  );
}

/**
 * Retícula: una fila por cada tramo entre horas de inicio y fin de las clases; una clase que dura
 * varios tramos ocupa varias filas. Se omiten los tramos sin ninguna clase.
 */
function Reticula({ clases }: { clases: Clase[] }) {
  const usados = new Set(clases.flatMap((c) => c.grupo.horarios.map((h) => h.dia_semana)));
  const dias: DiaSemana[] = usados.has(6) ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];

  const sesiones = clases.flatMap((clase) =>
    clase.grupo.horarios
      .filter((h) => dias.includes(h.dia_semana))
      .map((h) => ({ clase, dia: h.dia_semana, inicio: minutos(h.hora_inicio), fin: minutos(h.hora_fin), h })),
  );
  const cortes = [...new Set(sesiones.flatMap((s) => [s.inicio, s.fin]))].sort((a, b) => a - b);
  const tramos = cortes
    .slice(0, -1)
    .map((inicio, i) => ({ inicio, fin: cortes[i + 1] }))
    .filter((t) => sesiones.some((s) => s.inicio <= t.inicio && s.fin >= t.fin));
  const fila = (min: number, campo: "inicio" | "fin") => tramos.findIndex((t) => t[campo] === min);
  const ocupado = (dia: number, t: { inicio: number; fin: number }) =>
    sesiones.some((s) => s.dia === dia && s.inicio <= t.inicio && s.fin >= t.fin);

  const columnas: CSSProperties = { gridTemplateColumns: `repeat(${dias.length + 1}, minmax(0, 1fr))` };
  const texto = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  return (
    <div className="overflow-x-auto rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
      <div className="min-w-[720px]">
        <div className="mb-2 grid gap-2 pb-3 text-center font-label-md text-label-md text-on-surface-variant" style={columnas}>
          <div className="rounded-lg bg-surface-container-low py-2 font-mono text-xs sm:text-sm">HORA</div>
          {dias.map((d) => (
            <div key={d} className="rounded-lg bg-surface-container-low py-2 text-xs font-bold text-primary uppercase sm:text-sm">
              {DIAS[d]}
            </div>
          ))}
        </div>
        <div
          className="grid gap-2 font-body-sm text-body-sm"
          style={{ ...columnas, gridTemplateRows: `repeat(${tramos.length}, minmax(90px, auto))` }}
        >
          {tramos.map((t, i) => (
            <div
              key={`hora-${t.inicio}`}
              style={{ gridColumn: 1, gridRow: i + 1 }}
              className="flex flex-col items-center justify-center rounded-lg bg-surface-container-low p-2 text-center font-mono text-on-surface-variant"
            >
              <span className="font-bold">{texto(t.inicio)}</span>
              <span className="text-[11px]">{texto(t.fin)}</span>
            </div>
          ))}
          {tramos.flatMap((t, i) =>
            dias.map((d, j) =>
              ocupado(d, t) ? null : (
                <div
                  key={`vacio-${d}-${t.inicio}`}
                  style={{ gridColumn: j + 2, gridRow: i + 1 }}
                  className="rounded-lg bg-surface-container-low/40 p-2"
                />
              ),
            ),
          )}
          {sesiones.map((s) => (
            <div
              key={`${s.clase.grupo.id}-${s.dia}-${s.inicio}`}
              style={{ gridColumn: dias.indexOf(s.dia) + 2, gridRow: `${fila(s.inicio, "inicio") + 1} / ${fila(s.fin, "fin") + 2}` }}
              className={`flex flex-col justify-between rounded-lg p-2 sm:p-2.5 ${s.clase.color} ${
                s.clase.tramite === "ALTA" ? "border-2 border-dashed border-current/40" : ""
              }`}
            >
              <div>
                <span className="block truncate font-label-sm text-label-sm font-bold">{s.clase.grupo.materia.nombre}</span>
                <span className="block text-[11px] text-on-surface-variant">
                  {lugar(s.h.aula)} • Gpo {s.clase.grupo.num_grupo}
                </span>
              </div>
              <AccionBaja clase={s.clase} compacta />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Lista({ clases }: { clases: Clase[] }) {
  return (
    <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
      {clases.map(({ grupo, tramite }) => (
        <div
          key={grupo.id}
          className="flex flex-col items-start justify-between gap-space-sm rounded-xl bg-surface-container-low p-space-md sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-space-md">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-container font-mono text-[13px] font-bold text-on-primary">
              {grupo.materia.clave}
            </div>
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-headline-sm text-headline-sm text-primary">{grupo.materia.nombre}</h4>
                <Estado tramite={tramite} />
              </div>
              <span className="font-body-md text-body-md text-on-surface-variant">
                Docente: {grupo.docente}
                {lugares(grupo) && ` • ${lugares(grupo)}`}
              </span>
              <span className="mt-1 font-mono text-label-sm text-on-surface">{horarioTexto(grupo.horarios, true)}</span>
            </div>
          </div>
          <AccionBaja clase={{ grupo, tramite, color: "" }} />
        </div>
      ))}
    </div>
  );
}

function Estado({ tramite }: { tramite: TipoTramite | null }) {
  if (tramite === "ALTA")
    return <span className="rounded bg-primary-fixed px-2 py-0.5 font-label-sm text-label-sm font-bold text-primary">Alta en trámite</span>;
  if (tramite === "BAJA")
    return (
      <span className="rounded bg-error-container px-2 py-0.5 font-label-sm text-label-sm font-bold text-on-error-container">Baja en trámite</span>
    );
  return (
    <span className="rounded bg-on-tertiary-container/10 px-2 py-0.5 font-label-sm text-label-sm font-bold text-on-tertiary-container">
      Inscrita
    </span>
  );
}

/** "Solicitar baja" de una materia inscrita; en trámite o ya en el carrito, solo lo indica. */
function AccionBaja({ clase, compacta = false }: { clase: Clase; compacta?: boolean }) {
  const { buscar, agregar } = useCarrito();

  if (clase.tramite) {
    if (!compacta) return null; // en la lista ya lo dice la etiqueta
    return (
      <span className="mt-1 flex items-center gap-1 p-1 text-[11px] font-bold">
        <Simbolo nombre="hourglass_top" className="text-[14px]!" />
        {clase.tramite === "ALTA" ? "Alta en trámite" : "Baja en trámite"}
      </span>
    );
  }

  const enCarrito = Boolean(buscar(clase.grupo.id));
  if (compacta) {
    return (
      <button
        type="button"
        disabled={enCarrito}
        onClick={() => agregar(clase.grupo, "BAJA")}
        className="mt-1 flex cursor-pointer items-center gap-1 rounded p-1 text-[11px] font-bold text-error transition-colors hover:bg-error-container/40 disabled:cursor-default disabled:text-on-surface-variant disabled:hover:bg-transparent print:hidden"
      >
        <Simbolo nombre={enCarrito ? "shopping_bag" : "remove_circle"} className="text-[14px]!" />
        {enCarrito ? "Baja en carrito" : "Solicitar baja"}
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={enCarrito}
      onClick={() => agregar(clase.grupo, "BAJA")}
      className="flex cursor-pointer items-center gap-1 rounded-lg bg-error-container px-3 py-1.5 font-label-md text-xs font-semibold text-on-error-container transition-colors hover:bg-error hover:text-white disabled:cursor-default disabled:bg-surface-container disabled:text-on-surface-variant print:hidden"
    >
      <Simbolo nombre={enCarrito ? "shopping_bag" : "remove_circle"} className="text-[16px]!" />
      {enCarrito ? "Baja en carrito" : "Solicitar baja"}
    </button>
  );
}
