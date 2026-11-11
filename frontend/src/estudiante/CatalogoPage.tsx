// Vista 3 de stitch/sabe_estudiantes: catálogo de asignaturas con cupo y choques, y el carrito flotante.
// Los choques y errores vienen del backend, calculados con el carrito (F4).
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useGrupos, useMiHorario, useValidarCarrito } from "../api/estudiante";
import type { Choque, Grupo, ResultadoMovimiento } from "../api/tipos";
import { Simbolo, Spinner } from "../components/acceso";
import { useCarrito } from "./Carrito";
import { claveGrupo, diasLargos, hora, horarioTexto, normalizar, problemasDe, sufijoOrigen } from "./formato";

export function CatalogoPage() {
  const { items, movimientos, abierto, setAbierto } = useCarrito();
  const grupos = useGrupos(movimientos);
  const horario = useMiHorario();
  const [busqueda, setBusqueda] = useState("");

  // Lo ya inscrito no se ofrece; las altas en trámite se muestran como tales.
  const inscritos = useMemo(() => new Set(horario.data?.inscritas.map((g) => g.id)), [horario.data]);
  const altasEnTramite = useMemo(
    () => new Set(horario.data?.en_tramite.filter((m) => m.tipo_tramite === "ALTA").map((m) => m.grupo.id)),
    [horario.data],
  );

  const visibles = useMemo(() => {
    const termino = normalizar(busqueda.trim());
    return (grupos.data ?? [])
      .filter((g) => !inscritos.has(g.id))
      .filter((g) => !termino || normalizar(`${g.materia.nombre} ${g.materia.clave} ${g.docente}`).includes(termino));
  }, [grupos.data, inscritos, busqueda]);

  const cargando = grupos.isPending || horario.isPending;
  const error = grupos.error ?? horario.error;

  return (
    <div className="relative flex flex-1 flex-col gap-space-lg">
      <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
        <div className="flex flex-col items-stretch justify-between gap-space-md md:flex-row md:items-center">
          <div className="relative flex-1">
            <Simbolo nombre="search" className="absolute top-1/2 left-3.5 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre de asignatura, clave (ej: EC605) o docente..."
              aria-label="Buscar asignatura"
              className="w-full rounded-lg border border-gray-500 bg-surface-container-low py-2.5 pr-4 pl-11 text-body-md text-on-surface focus:ring-2 focus:ring-primary-container focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <button
              type="button"
              onClick={() => setAbierto(!abierto)}
              className="flex cursor-pointer items-center gap-2 rounded-lg bg-primary-container px-space-md py-2.5 font-label-md text-label-md text-on-primary shadow-sm transition-all hover:bg-primary"
            >
              <Simbolo nombre="shopping_bag" className="text-[18px]!" />
              <span>Carrito de Solicitud</span>
              <span className="rounded-full bg-secondary-container px-1.5 font-mono text-[11px] font-bold text-on-secondary-container">
                {items.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {cargando ? (
        <Aviso>
          <Spinner className="h-5 w-5 text-primary-container" /> Cargando asignaturas…
        </Aviso>
      ) : error ? (
        <Aviso>{error.message}</Aviso>
      ) : visibles.length === 0 ? (
        <Aviso>{busqueda ? "Ninguna asignatura coincide con tu búsqueda." : "No hay asignaturas publicadas para este periodo."}</Aviso>
      ) : (
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2 lg:grid-cols-3">
          {visibles.map((g) => (
            <Tarjeta key={g.id} grupo={g} enTramite={altasEnTramite.has(g.id)} />
          ))}
        </div>
      )}

      {/* Espacio para que el carrito abierto no tape las últimas tarjetas */}
      {abierto && <div className="h-72" aria-hidden />}
      <CajonCarrito />
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

function Cupo({ disponible }: { disponible: number }) {
  const estilo =
    disponible <= 0
      ? "font-bold bg-error-container text-on-error-container"
      : disponible <= 3
        ? "font-semibold bg-secondary-container/20 text-on-secondary-container"
        : "font-semibold bg-on-tertiary-container/10 text-on-tertiary-container";
  return (
    <span className={`shrink-0 rounded px-2 py-0.5 font-label-sm text-xs ${estilo}`}>
      Cupo: {Math.max(disponible, 0)} disponibles
    </span>
  );
}

function TextoChoque({ choque }: { choque: Choque }) {
  return (
    <span>
      Choca con <strong>{choque.materia}</strong>
      {sufijoOrigen(choque.origen)} el <strong>{diasLargos(choque.dias)}</strong> de{" "}
      <strong>
        {hora(choque.hora_inicio)} a {hora(choque.hora_fin)} hrs
      </strong>
      .
    </span>
  );
}

function Tarjeta({ grupo, enTramite }: { grupo: Grupo; enTramite: boolean }) {
  const { buscar, agregar, quitar } = useCarrito();
  const choque = grupo.choques[0];
  const sinCupo = grupo.cupo_disponible <= 0;
  const enCarrito = Boolean(buscar(grupo.id));
  // Otro grupo de una materia que ya cursa, ya pidió o trae en el carrito.
  const mismaMateria = grupo.errores.find((e) => e.codigo === "misma_materia");
  const conflicto = Boolean(choque || mismaMateria);

  const deshabilitado = "flex flex-1 cursor-not-allowed items-center justify-center gap-1 rounded-lg bg-surface-container py-2 font-label-md font-semibold text-outline";

  let accion;
  if (enTramite) {
    accion = (
      <button type="button" disabled className={`${deshabilitado} text-label-md`}>
        <Simbolo nombre="hourglass_top" className="text-[18px]!" /> Alta en trámite
      </button>
    );
  } else if (enCarrito) {
    accion = (
      <button
        type="button"
        onClick={() => quitar(grupo.id)}
        className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg border border-on-tertiary-container/40 py-2 font-label-md text-label-md font-semibold text-on-tertiary-container transition-colors hover:bg-on-tertiary-container/10"
      >
        <Simbolo nombre="check_circle" className="text-[18px]!" /> En el carrito
      </button>
    );
  } else if (mismaMateria) {
    accion = (
      <button type="button" disabled title={mismaMateria.detalle} className={`${deshabilitado} text-xs`}>
        <Simbolo nombre="error" className="text-[16px]!" /> Ya tienes esta materia en otro grupo
      </button>
    );
  } else if (choque) {
    accion = (
      <button type="button" disabled title="No es posible agregar por choque de horario" className={`${deshabilitado} text-xs`}>
        <Simbolo nombre="error" className="text-[16px]!" /> Choca con {choque.materia} ({hora(choque.hora_inicio)} - {hora(choque.hora_fin)})
      </button>
    );
  } else if (sinCupo) {
    accion = (
      <button type="button" disabled className={`${deshabilitado} text-label-md`}>
        <Simbolo nombre="block" className="text-[18px]!" /> Sin cupo disponible
      </button>
    );
  } else {
    accion = (
      <button
        type="button"
        onClick={() => agregar(grupo, "ALTA")}
        className="flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-lg bg-on-tertiary-container py-2 font-label-md text-label-md font-semibold text-surface-bright transition-colors hover:bg-tertiary"
      >
        <Simbolo nombre="add_circle" className="text-[18px]!" /> Solicitar Alta
      </button>
    );
  }

  return (
    <div
      className={`flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-md shadow-sm transition-all hover:shadow-md ${
        conflicto ? "border border-error/30" : ""
      } ${sinCupo && !conflicto ? "opacity-80" : ""}`}
    >
      <div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="rounded bg-surface-container-high px-2 py-0.5 font-mono text-label-sm font-bold text-primary">{claveGrupo(grupo)}</span>
          <Cupo disponible={grupo.cupo_disponible} />
        </div>
        <h3 className="font-headline-sm text-headline-sm text-primary">{grupo.materia.nombre}</h3>
        <span className="mt-1 block font-body-sm text-body-sm text-on-surface-variant">Docente: {grupo.docente}</span>
        <div
          className={`mt-space-sm flex items-center gap-1.5 font-label-sm ${
            conflicto ? "text-xs font-bold text-error" : "text-label-sm text-on-surface"
          }`}
        >
          <Simbolo nombre="schedule" className={`text-[16px]! ${conflicto ? "" : "text-primary-container"}`} />
          <span>{horarioTexto(grupo.horarios)}</span>
        </div>
        {conflicto && (
          <div className="mt-2 rounded border border-error/20 bg-error-container/30 p-2 text-xs text-on-error-container">
            <span className="flex items-center gap-1 font-bold">
              <Simbolo nombre="block" className="text-[15px]!" /> Conflicto:
            </span>
            {mismaMateria && <span className="block">{mismaMateria.detalle}</span>}
            {grupo.choques.map((c) => (
              <TextoChoque key={`${c.grupo}-${c.hora_inicio}`} choque={c} />
            ))}
          </div>
        )}
      </div>
      <div className="mt-space-md flex items-center gap-2 pt-space-sm">{accion}</div>
    </div>
  );
}

/** Cajón flotante del carrito (cart-drawer de stitch). */
function CajonCarrito() {
  const { items, movimientos, quitar, abierto, setAbierto } = useCarrito();
  const navigate = useNavigate();
  const validacion = useValidarCarrito(movimientos);
  // Con datos de un carrito anterior (placeholder) todavía no se sabe si el actual es válido.
  const revisando = items.length > 0 && (validacion.isPending || validacion.isPlaceholderData);
  const resultados = new Map<number, ResultadoMovimiento>(
    (validacion.data?.movimientos ?? []).map((r) => [r.grupo, r]),
  );
  const invalido = items.length > 0 && !revisando && validacion.data?.valido === false;

  return (
    <div
      className={`fixed right-3 bottom-3 left-3 z-40 max-w-md rounded-xl bg-surface-container-lowest p-space-md shadow-2xl transition-transform duration-300 sm:right-6 sm:bottom-6 sm:left-auto sm:w-full ${
        abierto ? "translate-y-0" : "translate-y-[120%]"
      }`}
      aria-hidden={!abierto}
    >
      <div className="mb-space-sm flex items-center justify-between border-b border-surface-container-high pb-space-sm">
        <div className="flex items-center gap-2">
          <Simbolo nombre="shopping_bag" className="text-primary-container" />
          <span className="font-headline-sm text-base text-primary sm:text-headline-sm">Carrito de Solicitudes</span>
          <span className="rounded-full bg-primary-fixed px-2 py-0.5 font-mono text-label-sm font-bold whitespace-nowrap text-primary">
            {items.length} movimientos
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          title="Ocultar carrito"
          tabIndex={abierto ? 0 : -1}
          className="cursor-pointer text-on-surface-variant hover:text-on-surface"
        >
          <Simbolo nombre="expand_more" />
        </button>
      </div>
      <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
        {items.length === 0 ? (
          <p className="py-4 text-center font-body-sm text-xs text-on-surface-variant">
            Tu carrito está vacío. Agrega altas desde el catálogo o bajas desde tu horario.
          </p>
        ) : (
          items.map(({ grupo, tipo }) => {
            const alta = tipo === "ALTA";
            const resultado = revisando ? undefined : resultados.get(grupo.id);
            const problemas = problemasDe(resultado);
            return (
              <div
                key={grupo.id}
                className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 ${
                  problemas.length
                    ? "border-error bg-error-container/20"
                    : `bg-surface-container-low ${alta ? "border-on-tertiary-container/30" : "border-error/30"}`
                }`}
              >
                <div className="flex items-start gap-2">
                  <Simbolo
                    nombre={alta ? "add_circle" : "remove_circle"}
                    className={`text-[20px]! ${alta ? "text-on-tertiary-container" : "text-error"}`}
                  />
                  <div className="flex flex-col">
                    <span className={`font-label-md text-xs leading-tight font-bold ${alta ? "text-on-tertiary-container" : "text-error"}`}>
                      {tipo}: {grupo.materia.nombre}
                    </span>
                    <span className="font-mono text-[10px] text-on-surface-variant">{claveGrupo(grupo)}</span>
                    {problemas.map((texto) => (
                      <span key={texto} className="mt-0.5 flex items-start gap-1 text-[11px] leading-snug font-semibold text-error">
                        <Simbolo nombre="block" className="mt-px text-[13px]!" /> {texto}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => quitar(grupo.id)}
                  title="Eliminar"
                  tabIndex={abierto ? 0 : -1}
                  className="cursor-pointer p-1 text-on-surface-variant hover:text-error"
                >
                  <Simbolo nombre="delete" className="text-[18px]!" />
                </button>
              </div>
            );
          })
        )}
      </div>
      {validacion.isError ? (
        <p className="mt-space-sm text-xs font-semibold text-error">{validacion.error.message}</p>
      ) : invalido ? (
        <p className="mt-space-sm text-xs font-semibold text-error">Corrige los movimientos marcados para continuar.</p>
      ) : null}
      <button
        type="button"
        disabled={items.length === 0 || revisando || invalido || validacion.isError}
        tabIndex={abierto ? 0 : -1}
        onClick={() => navigate("/estudiante/confirmacion")}
        className="mt-space-md flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary-container py-2.5 font-label-md text-label-md font-bold text-on-primary shadow-sm transition-all hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>Proceder a Confirmación</span>
        <Simbolo nombre="arrow_forward" className="text-[18px]!" />
      </button>
    </div>
  );
}
