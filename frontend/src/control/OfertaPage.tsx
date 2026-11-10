// Oferta académica del periodo activo: stitch/sabe_oferta_academica_control_escolar.
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { useCrearDocente, useDocentes, useGuardarGrupo, useOferta, useProgramas, useVisibilidadGrupo } from "../api/control";
import { usePeriodoActivo } from "../api/estudiante";
import type { DiaSemana, FiltrosOferta, Grupo } from "../api/tipos";
import { Simbolo, Spinner } from "../components/acceso";
import { DIAS_CORTOS, hora } from "../estudiante/formato";
import { useCambiarFiltro } from "./filtrosUrl";
import { Modal } from "./Modal";
import { useAviso } from "./Toast";

const DIAS = Object.entries(DIAS_CORTOS).map(([n, texto]) => ({ dia: Number(n) as DiaSemana, texto }));
const NUEVO_DOCENTE = "nuevo";

function leerFiltros(params: URLSearchParams): FiltrosOferta {
  const cupo = params.get("cupo") ?? "";
  return {
    q: params.get("q") ?? "",
    programa: params.get("programa") ?? "",
    cupo: cupo === "con" || cupo === "sin" ? cupo : "",
  };
}

/** "Lun 08:00 a 10:00 • Mié 08:00 a 10:00" (un día por bloque, como en stitch). */
function horarioOferta(grupo: Grupo): string {
  return [...grupo.horarios]
    .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio))
    .map((h) => `${DIAS_CORTOS[h.dia_semana]} ${hora(h.hora_inicio)} a ${hora(h.hora_fin)}`)
    .join(" • ");
}

/** Primer mensaje de un error de DRF, aunque venga anidado (horarios: [{non_field_errors: [...]}]). */
function primerMensaje(datos: unknown): string | null {
  if (typeof datos === "string") return datos;
  if (Array.isArray(datos)) {
    for (const d of datos) {
      const m = primerMensaje(d);
      if (m) return m;
    }
    return null;
  }
  if (datos && typeof datos === "object") {
    for (const d of Object.values(datos)) {
      const m = primerMensaje(d);
      if (m) return m;
    }
  }
  return null;
}

export function OfertaPage() {
  const { data: periodo, isPending: cargandoPeriodo } = usePeriodoActivo();
  const [params] = useSearchParams();
  const cambiar = useCambiarFiltro();
  const filtros = leerFiltros(params);
  const [texto, setTexto] = useState(filtros.q);
  const { data: programas } = useProgramas();
  const { data: grupos, isPending, error, isFetching } = useOferta(filtros);
  // null: cerrado; "nuevo": publicar; Grupo: editar.
  const [formulario, setFormulario] = useState<Grupo | "nuevo" | null>(null);
  const cerrar = useCallback(() => setFormulario(null), []);

  useEffect(() => {
    const espera = window.setTimeout(() => cambiar("q", texto.trim()), 300);
    return () => window.clearTimeout(espera);
  }, [texto]); // Solo al teclear: `cambiar` lee la URL actual, no necesita ser dependencia.


  if (!cargandoPeriodo && !periodo) {
    return (
      <div className="flex w-full flex-col gap-space-lg">
        <h1 className="font-headline-lg text-headline-lg tracking-tight text-primary">Oferta Académica</h1>
        <div className="flex flex-col items-center gap-space-sm rounded-2xl bg-surface-container-lowest p-space-xl text-center shadow-sm">
          <p className="font-headline-sm text-headline-sm text-primary">No hay un periodo activo.</p>
          <Link
            to="/control-escolar/periodo"
            className="rounded-lg bg-primary-container px-space-md py-space-xs font-label-md text-label-md text-on-primary hover:bg-primary"
          >
            Ir a Periodo y Convocatoria
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-space-lg">
      <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-center">
        <div className="flex flex-col">
          <div className="mb-1 flex items-center gap-space-xs font-label-sm text-label-sm text-on-surface-variant">
            <span>Ventanilla de Control Escolar</span>
            <Simbolo nombre="chevron_right" className="text-[14px]!" />
            <span className="font-semibold text-primary">Oferta Académica</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-primary">
            Oferta Académica del Ciclo {periodo?.ciclo ?? ""}
          </h1>
          <p className="mt-space-xs max-w-3xl font-body-md text-body-md text-on-surface-variant">
            Esta es la oferta que ven los alumnos en el catálogo. El cupo disponible se calcula: cupo máximo menos alumnos inscritos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormulario("nuevo")}
          className="flex shrink-0 cursor-pointer items-center justify-center gap-space-xs rounded-xl bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary shadow-md hover:bg-primary"
        >
          <Simbolo nombre="add_circle" className="text-[20px]!" />
          Publicar asignatura
        </button>
      </div>

      <div className="flex flex-col gap-space-sm rounded-2xl bg-surface-container-lowest p-space-md shadow-sm md:flex-row md:items-center">
        <div className="relative flex-1">
          <Simbolo nombre="search" className="absolute top-1/2 left-3 -translate-y-1/2 text-[20px]! text-on-surface-variant" />
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por materia, clave o docente"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest py-space-sm pr-space-md pl-10 font-body-md text-body-md focus:ring-2 focus:ring-primary-container focus:outline-none"
          />
        </div>
        <select
          value={filtros.programa}
          onChange={(e) => cambiar("programa", e.target.value)}
          className="rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-space-sm font-body-md text-body-md"
        >
          <option value="">Programa: todos</option>
          {programas?.map((p) => (
            <option key={p.id} value={p.nombre}>
              {p.nombre}
            </option>
          ))}
        </select>
        <select
          value={filtros.cupo}
          onChange={(e) => cambiar("cupo", e.target.value)}
          className="rounded-xl border border-outline-variant bg-surface-container-lowest px-space-md py-space-sm font-body-md text-body-md"
        >
          <option value="">Cupo: todos</option>
          <option value="con">Con cupo</option>
          <option value="sin">Sin cupo</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm">
        <div className={`overflow-x-auto transition-opacity ${isFetching && !isPending ? "opacity-70" : ""}`}>
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low font-label-sm text-label-sm tracking-wider text-on-surface-variant uppercase">
                <th className="px-space-lg py-space-sm">Asignatura</th>
                <th className="px-space-md py-space-sm">Grupo y docente</th>
                <th className="px-space-md py-space-sm">Horario</th>
                <th className="px-space-md py-space-sm">Cupo</th>
                <th className="px-space-md py-space-sm text-center">Estado</th>
                <th className="px-space-lg py-space-sm text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="font-body-md text-body-md text-on-surface">
              {grupos?.map((g) => <Fila key={g.id} grupo={g} editar={() => setFormulario(g)} />)}
            </tbody>
          </table>
          {isPending && (
            <div className="flex items-center justify-center gap-2 p-space-xl font-body-md text-on-surface-variant">
              <Spinner className="h-5 w-5 text-primary-container" /> Cargando oferta…
            </div>
          )}
          {error && <div className="p-space-xl text-center font-body-md text-error">{error.message}</div>}
          {grupos?.length === 0 && (
            <div className="p-space-xl text-center font-body-md text-on-surface-variant">No hay asignaturas con esos filtros.</div>
          )}
        </div>
      </div>

      {formulario && periodo && (
        <FormularioGrupo grupo={formulario === "nuevo" ? null : formulario} ciclo={periodo.ciclo} cerrar={cerrar} />
      )}
    </div>
  );
}

function Fila({ grupo: g, editar }: { grupo: Grupo; editar: () => void }) {
  const visibilidad = useVisibilidadGrupo();
  const aviso = useAviso();
  const disponibles = g.cupo_disponible;
  const inscritos = g.cupo_maximo - disponibles;
  const porcentaje = g.cupo_maximo ? Math.min(Math.round((inscritos / g.cupo_maximo) * 100), 100) : 100;
  const barra = disponibles <= 0 ? "bg-error" : porcentaje >= 85 ? "bg-secondary-container" : "bg-tertiary-container";

  const alternar = () =>
    visibilidad.mutate(
      { id: g.id, visible: !g.visible },
      {
        onSuccess: (r) =>
          aviso(r.visible ? "Asignatura publicada en el catálogo." : "Asignatura desactivada: los alumnos ya no la ven."),
        onError: (e) => aviso(e.message),
      },
    );

  return (
    <tr className={`border-t border-outline-variant/40 transition-colors hover:bg-surface-container-low/60 ${g.visible ? "" : "opacity-60"}`}>
      <td className="px-space-lg py-space-md">
        <div className="flex flex-col">
          <span className="font-label-lg text-label-lg font-bold text-primary">{g.materia.nombre}</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {g.materia.clave} • {g.materia.programa}
          </span>
        </div>
      </td>
      <td className="px-space-md py-space-md">
        <div className="flex flex-col">
          <span className="font-label-md text-label-md font-semibold">Grupo {g.num_grupo}</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">{g.docente}</span>
        </div>
      </td>
      <td className="px-space-md py-space-md font-label-md text-label-md">{horarioOferta(g)}</td>
      <td className="min-w-[150px] px-space-md py-space-md">
        <div className="flex flex-col gap-1">
          <span className="font-label-md text-label-md font-semibold">
            {disponibles > 0 ? `${disponibles} disponibles` : "Sin cupo"}{" "}
            <span className="font-normal text-on-surface-variant">de {g.cupo_maximo}</span>
          </span>
          <div className="h-1.5 rounded-full bg-surface-container">
            <div className={`h-1.5 rounded-full ${barra}`} style={{ width: `${porcentaje}%` }} />
          </div>
        </div>
      </td>
      <td className="px-space-md py-space-md text-center">
        <span
          className={`inline-flex items-center rounded-full px-space-sm py-1 font-label-sm text-label-sm font-bold ${
            g.visible ? "bg-tertiary-fixed text-on-tertiary-fixed" : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {g.visible ? "Publicada" : "Desactivada"}
        </span>
      </td>
      <td className="px-space-lg py-space-md text-right">
        <div className="flex justify-end gap-space-xs">
          <button
            type="button"
            onClick={editar}
            className="cursor-pointer rounded-lg bg-surface-container px-space-sm py-space-xs font-label-md text-label-md hover:bg-surface-container-high"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={alternar}
            disabled={visibilidad.isPending}
            className={`cursor-pointer rounded-lg px-space-sm py-space-xs font-label-md text-label-md disabled:opacity-60 ${
              g.visible ? "bg-error-container text-on-error-container" : "bg-tertiary-fixed text-on-tertiary-fixed"
            }`}
          >
            {g.visible ? "Desactivar" : "Activar"}
          </button>
        </div>
      </td>
    </tr>
  );
}

interface FilaDia {
  id: number;
  dia: DiaSemana;
  inicio: string;
  fin: string;
}

let siguienteId = 1;
const filaDia = (dia: DiaSemana = 1, inicio = "08:00", fin = "10:00"): FilaDia => ({ id: siguienteId++, dia, inicio, fin });

const CAMPO = "mt-1 w-full rounded-xl border border-outline-variant px-space-md py-space-sm";

function FormularioGrupo({ grupo, ciclo, cerrar }: { grupo: Grupo | null; ciclo: string; cerrar: () => void }) {
  const { data: programas } = useProgramas();
  const { data: docentes } = useDocentes();
  const guardar = useGuardarGrupo();
  const crearDocente = useCrearDocente();
  const aviso = useAviso();

  const [nombre, setNombre] = useState(grupo?.materia.nombre ?? "");
  const [clave, setClave] = useState(grupo?.materia.clave ?? "");
  const [programa, setPrograma] = useState("");
  const [numGrupo, setNumGrupo] = useState(grupo?.num_grupo ?? "");
  const [cupo, setCupo] = useState(grupo ? String(grupo.cupo_maximo) : "");
  const [docente, setDocente] = useState("");
  const [dias, setDias] = useState<FilaDia[]>(() =>
    grupo?.horarios.length
      ? [...grupo.horarios]
          .sort((a, b) => a.dia_semana - b.dia_semana)
          .map((h) => filaDia(h.dia_semana, hora(h.hora_inicio), hora(h.hora_fin)))
      : [filaDia()],
  );
  const [nuevoDocente, setNuevoDocente] = useState({ nombre: "", grado_academico: "" });
  const [error, setError] = useState<string | null>(null);

  // El programa y el docente llegan por nombre en el grupo; se buscan sus ids cuando cargan los catálogos.
  useEffect(() => {
    if (!programa && programas?.length) {
      const actual = grupo ? programas.find((p) => p.nombre === grupo.materia.programa) : programas[0];
      if (actual) setPrograma(String(actual.id));
    }
  }, [programas, grupo, programa]);
  useEffect(() => {
    if (!docente && grupo && docentes) {
      const actual = docentes.find((d) => d.nombre === grupo.docente);
      if (actual) setDocente(String(actual.id));
    }
  }, [docentes, grupo, docente]);

  const cambiarDia = (id: number, cambios: Partial<FilaDia>) =>
    setDias((actuales) => actuales.map((d) => (d.id === id ? { ...d, ...cambios } : d)));

  function validar(): string | null {
    if (!nombre.trim() || !clave.trim() || !numGrupo.trim() || !docente || docente === NUEVO_DOCENTE)
      return "Completa asignatura, clave, grupo y docente.";
    if (!(parseInt(cupo, 10) > 0)) return "El cupo máximo debe ser mayor a 0.";
    for (const d of dias) {
      if (!d.inicio || !d.fin) return "Indica hora de inicio y fin en cada día.";
      if (d.fin <= d.inicio) return "La hora de fin debe ser posterior a la de inicio.";
    }
    return null;
  }

  function publicar() {
    const problema = validar();
    setError(problema);
    if (problema) return;
    guardar.mutate(
      {
        id: grupo?.id,
        clave: clave.trim(),
        nombre_materia: nombre.trim(),
        programa: Number(programa),
        num_grupo: numGrupo.trim(),
        cupo_maximo: parseInt(cupo, 10),
        docente: Number(docente),
        horarios: dias.map((d) => ({ dia_semana: d.dia, hora_inicio: d.inicio, hora_fin: d.fin })),
      },
      {
        onSuccess: () => {
          aviso(grupo ? "Asignatura actualizada." : "Asignatura publicada en el catálogo de los alumnos.");
          cerrar();
        },
        onError: (e) => setError((e instanceof ApiError && primerMensaje(e.datos)) || e.message),
      },
    );
  }

  function agregarDocente() {
    if (!nuevoDocente.nombre.trim()) {
      setError("Escribe el nombre del docente.");
      return;
    }
    crearDocente.mutate(nuevoDocente, {
      onSuccess: (d) => {
        setDocente(String(d.id));
        setNuevoDocente({ nombre: "", grado_academico: "" });
        setError(null);
        aviso(`Docente ${d.nombre} agregado al catálogo.`);
      },
      onError: (e) => setError((e instanceof ApiError && primerMensaje(e.datos)) || e.message),
    });
  }

  return (
    <Modal cerrar={cerrar} fondo="bg-black/40" className="max-h-[92vh] max-w-2xl p-space-lg" titulo="titulo-grupo">
      <div className="mb-space-md flex items-start justify-between">
        <div>
          <h2 id="titulo-grupo" className="font-headline-md text-headline-md font-bold text-primary">
            {grupo ? "Editar asignatura" : "Publicar asignatura"}
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Ciclo {ciclo} (periodo activo)</p>
        </div>
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar"
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg hover:bg-surface-container"
        >
          <Simbolo nombre="close" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="font-label-md text-label-md font-semibold" htmlFor="m-nom">
            Asignatura *
          </label>
          <input id="m-nom" value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} placeholder="Ej. Economía de la Innovación" />
        </div>
        <div>
          <label className="font-label-md text-label-md font-semibold" htmlFor="m-clave">
            Clave *
          </label>
          <input id="m-clave" value={clave} onChange={(e) => setClave(e.target.value)} className={CAMPO} placeholder="Ej. EC704" />
        </div>
        <div>
          <label className="font-label-md text-label-md font-semibold" htmlFor="m-prog">
            Programa *
          </label>
          <select id="m-prog" value={programa} onChange={(e) => setPrograma(e.target.value)} className={CAMPO}>
            {programas?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="font-label-md text-label-md font-semibold" htmlFor="m-gpo">
            Grupo *
          </label>
          <input id="m-gpo" value={numGrupo} onChange={(e) => setNumGrupo(e.target.value)} className={CAMPO} placeholder="Ej. 01" />
        </div>
        <div>
          <label className="font-label-md text-label-md font-semibold" htmlFor="m-cupo">
            Cupo máximo *
          </label>
          <input
            id="m-cupo"
            type="number"
            min={1}
            value={cupo}
            onChange={(e) => setCupo(e.target.value)}
            className={CAMPO}
            placeholder="Ej. 30"
          />
        </div>
        <div className="md:col-span-2">
          <label className="font-label-md text-label-md font-semibold" htmlFor="m-doc">
            Docente *
          </label>
          <select id="m-doc" value={docente} onChange={(e) => setDocente(e.target.value)} className={CAMPO}>
            <option value="">Selecciona un docente del catálogo</option>
            {docentes?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
            <option value={NUEVO_DOCENTE}>+ Nuevo docente</option>
          </select>
          {docente === NUEVO_DOCENTE && (
            <div className="mt-space-xs flex flex-col gap-space-xs rounded-xl bg-surface-container-low p-space-sm sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="font-label-sm text-label-sm font-semibold" htmlFor="m-doc-nombre">
                  Nombre
                </label>
                <input
                  id="m-doc-nombre"
                  value={nuevoDocente.nombre}
                  onChange={(e) => setNuevoDocente({ ...nuevoDocente, nombre: e.target.value })}
                  className={CAMPO}
                  placeholder="Ej. Dr. Javier Medina"
                />
              </div>
              <div className="sm:w-48">
                <label className="font-label-sm text-label-sm font-semibold" htmlFor="m-doc-grado">
                  Grado académico
                </label>
                <input
                  id="m-doc-grado"
                  value={nuevoDocente.grado_academico}
                  onChange={(e) => setNuevoDocente({ ...nuevoDocente, grado_academico: e.target.value })}
                  className={CAMPO}
                  placeholder="Ej. Doctorado"
                />
              </div>
              <button
                type="button"
                onClick={agregarDocente}
                disabled={crearDocente.isPending}
                className="cursor-pointer rounded-xl bg-primary-container px-space-md py-space-sm font-label-md text-label-md text-on-primary hover:bg-primary disabled:opacity-60"
              >
                Guardar docente
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-space-md">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-label-md font-semibold">Horario por día y hora *</span>
          <button
            type="button"
            onClick={() => setDias((actuales) => [...actuales, filaDia()])}
            className="flex cursor-pointer items-center gap-1 font-label-md text-label-md font-semibold text-primary"
          >
            <Simbolo nombre="add" className="text-[18px]!" />
            Agregar día
          </button>
        </div>
        <div className="mt-space-xs flex flex-col gap-space-xs">
          {dias.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-space-xs">
              <select
                value={d.dia}
                onChange={(e) => cambiarDia(d.id, { dia: Number(e.target.value) as DiaSemana })}
                aria-label="Día"
                className="rounded-lg border border-outline-variant px-space-sm py-space-xs"
              >
                {DIAS.map((x) => (
                  <option key={x.dia} value={x.dia}>
                    {x.texto}
                  </option>
                ))}
              </select>
              <input
                type="time"
                value={d.inicio}
                onChange={(e) => cambiarDia(d.id, { inicio: e.target.value })}
                aria-label="Hora de inicio"
                className="rounded-lg border border-outline-variant px-space-sm py-space-xs"
              />
              <span className="text-on-surface-variant">a</span>
              <input
                type="time"
                value={d.fin}
                onChange={(e) => cambiarDia(d.id, { fin: e.target.value })}
                aria-label="Hora de fin"
                className="rounded-lg border border-outline-variant px-space-sm py-space-xs"
              />
              <button
                type="button"
                title="Quitar día"
                onClick={() => setDias((actuales) => (actuales.length > 1 ? actuales.filter((x) => x.id !== d.id) : actuales))}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg hover:bg-surface-container"
              >
                <Simbolo nombre="delete" className="text-[18px]!" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="mt-space-md font-label-md text-label-md text-error">{error}</p>}

      <div className="mt-space-lg flex justify-end gap-space-sm">
        <button type="button" onClick={cerrar} className="cursor-pointer rounded-xl bg-surface-container px-space-lg py-space-sm font-label-lg text-label-lg">
          Cancelar
        </button>
        <button
          type="button"
          onClick={publicar}
          disabled={guardar.isPending}
          className="flex cursor-pointer items-center gap-space-xs rounded-xl bg-primary-container px-space-lg py-space-sm font-label-lg text-label-lg text-on-primary hover:bg-primary disabled:opacity-60"
        >
          {guardar.isPending && <Spinner className="h-[18px] w-[18px]" />}
          Publicar
        </button>
      </div>
    </Modal>
  );
}
