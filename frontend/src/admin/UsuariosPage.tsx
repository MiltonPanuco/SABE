// Gestión de Usuarios y Roles de Acceso: stitch/sabe_usuarios_y_roles_administrador.
// Alta de personal, cambio de rol, activar/desactivar y contraseña temporal (se muestra una vez).
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError, descargar } from "../api/client";
import { usePeriodoActivo } from "../api/estudiante";
import { consultaUsuarios, useCambiarUsuario, useCrearPersonal, useReiniciarPassword, useUsuarios } from "../api/usuarios";
import type { FiltrosUsuarios, NuevoPersonal, Rol, UsuarioAdmin } from "../api/tipos";
import { Simbolo, Spinner } from "../components/acceso";
import { PasswordTemporal } from "../components/PasswordTemporal";
import { fechaPeriodo, horaMinuto } from "../control/fechas";
import { useCambiarFiltro } from "../control/filtrosUrl";
import { Modal } from "../control/Modal";
import { useAviso } from "../control/Toast";

const ROLES: Record<Rol, { texto: string; icono: string; chip: string; avatar: string; relleno?: boolean }> = {
  administrador: {
    texto: "Administrador",
    icono: "shield_person",
    chip: "bg-primary-container text-on-primary",
    avatar: "bg-primary-container text-on-primary",
    relleno: true,
  },
  control_escolar: {
    texto: "Control Escolar",
    icono: "badge",
    chip: "bg-secondary-fixed text-on-secondary-fixed",
    avatar: "bg-secondary-fixed text-on-secondary-fixed",
  },
  estudiante: {
    texto: "Estudiante",
    icono: "school",
    chip: "bg-surface-container-high text-primary-container",
    avatar: "bg-surface-container-high text-primary",
  },
};

function leerFiltros(params: URLSearchParams): FiltrosUsuarios {
  const rol = params.get("rol") ?? "";
  const estado = params.get("estado") ?? "";
  return {
    q: params.get("q") ?? "",
    rol: rol in ROLES ? (rol as Rol) : "",
    estado: estado === "activos" || estado === "inactivos" ? estado : "",
    pagina: Math.max(1, Number(params.get("pagina")) || 1),
  };
}

function iniciales(u: UsuarioAdmin): string {
  const palabras = `${u.nombre} ${u.apellidos}`.replace(/\b(Lic|Mtro|Mtra|Dr|Dra|Ing)\.\s*/g, "").trim().split(/\s+/);
  return ((palabras[0]?.[0] ?? "") + (palabras[1]?.[0] ?? "")).toUpperCase() || u.username[0].toUpperCase();
}

/** "Hoy, 11:20 hrs", "Ayer, 19:40 hrs" o "10 Feb 2026, 16:05 hrs". */
function acceso(iso: string): string {
  const fecha = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);
  const dia =
    fecha.toDateString() === hoy.toDateString() ? "Hoy" : fecha.toDateString() === ayer.toDateString() ? "Ayer" : fechaPeriodo(fecha);
  return `${dia}, ${horaMinuto(iso)} hrs`;
}

/** El correo solo se parte antes de la arroba. */
function conCorte(correo: string): ReactNode {
  const [usuario, dominio] = correo.split("@");
  return dominio ? (
    <>
      {usuario}
      <wbr />@{dominio}
    </>
  ) : (
    correo
  );
}

const nombreDe = (u: UsuarioAdmin) => `${u.nombre} ${u.apellidos}`.trim() || u.username;

type Pendiente =
  | { tipo: "rol"; usuario: UsuarioAdmin; rol: Rol }
  | { tipo: "desactivar"; usuario: UsuarioAdmin }
  | { tipo: "reiniciar"; usuario: UsuarioAdmin };

export function UsuariosPage() {
  const [params] = useSearchParams();
  const cambiarFiltro = useCambiarFiltro();
  const filtros = leerFiltros(params);
  const [texto, setTexto] = useState(filtros.q);
  const { data, isPending, error } = useUsuarios(filtros);
  const { data: periodo } = usePeriodoActivo();
  const aviso = useAviso();
  const cambiar = useCambiarUsuario();
  const reiniciar = useReiniciarPassword();
  const [nuevo, setNuevo] = useState(false);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [password, setPassword] = useState<{ titulo: string; usuario: string; password: string } | null>(null);
  const cerrarNuevo = useCallback(() => setNuevo(false), []);
  const cerrarPendiente = useCallback(() => setPendiente(null), []);
  const cerrarPassword = useCallback(() => setPassword(null), []);

  /** Cambia un filtro y vuelve a la primera página. */
  const filtrar = (nombre: string, valor: string) => {
    cambiarFiltro("pagina", "");
    cambiarFiltro(nombre, valor);
  };

  // El buscador espera 300 ms sin teclear.
  useEffect(() => {
    const espera = window.setTimeout(() => {
      if (texto.trim() !== filtros.q) filtrar("q", texto.trim());
    }, 300);
    return () => window.clearTimeout(espera);
  }, [texto]); // Solo al teclear: `cambiarFiltro` lee la URL actual.

  const conteos = data?.conteos;
  const ciclo = periodo?.ciclo ?? "";

  const exportar = () =>
    descargar(`/usuarios/exportar/${consultaUsuarios({ ...filtros, pagina: 1 })}`, `usuarios_sabe_${ciclo.replace("-", "") || "sabe"}.csv`)
      .then(() => aviso("Se descargó la lista de usuarios."))
      .catch((e: Error) => aviso(e.message));

  const activar = (u: UsuarioAdmin) => {
    if (!u.activo) {
      cambiar.mutate(
        { id: u.id, activo: true },
        { onSuccess: () => aviso(`Se activó la cuenta de ${nombreDe(u)}.`), onError: (e) => aviso(e.message) },
      );
    } else setPendiente({ tipo: "desactivar", usuario: u });
  };

  const confirmar = () => {
    if (!pendiente) return;
    const u = pendiente.usuario;
    if (pendiente.tipo === "reiniciar") {
      reiniciar.mutate(u.id, {
        onSuccess: (r) => {
          setPendiente(null);
          setPassword({ titulo: "Contraseña provisional restablecida", usuario: `${nombreDe(u)} (${u.username})`, password: r.password_temporal });
        },
      });
      return;
    }
    const cambio = pendiente.tipo === "rol" ? { rol: pendiente.rol } : { activo: false };
    cambiar.mutate(
      { id: u.id, ...cambio },
      {
        onSuccess: () => {
          setPendiente(null);
          aviso(
            pendiente.tipo === "rol"
              ? `${nombreDe(u)} ahora es ${ROLES[pendiente.rol].texto}.`
              : `Se desactivó la cuenta de ${nombreDe(u)}.`,
          );
        },
      },
    );
  };

  const tabs: [FiltrosUsuarios["rol"], string, number | undefined, string][] = [
    ["", "Todos", conteos?.todos, "bg-white/20"],
    ["estudiante", "Estudiantes", conteos?.estudiantes, "bg-primary-fixed text-on-primary-fixed font-bold"],
    ["control_escolar", "Control Escolar", conteos?.control_escolar, "bg-secondary-fixed text-on-secondary-fixed font-bold"],
    ["administrador", "Administradores", conteos?.administradores, "bg-primary-fixed-dim text-on-primary-fixed font-bold"],
  ];

  return (
    <div className="flex w-full flex-col">
      <div className="mb-space-lg flex flex-col gap-space-md md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-space-xs">
          <nav className="flex flex-wrap items-center gap-space-xs font-label-sm text-label-sm tracking-wider text-on-surface-variant uppercase">
            <span>Ventanilla de Administración</span>
            <span className="text-outline-variant">/</span>
            <span>Seguridad y Accesos</span>
            <span className="text-outline-variant">/</span>
            <span className="font-bold text-primary">Usuarios y Roles</span>
          </nav>
          <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-primary">Gestión de Usuarios y Roles de Acceso</h1>
          <p className="max-w-3xl font-body-md text-body-md text-on-surface-variant">
            Administración de credenciales, asignación de permisos institucionales y auditoría de accesos al sistema SABE UAE
            {ciclo ? ` para la Convocatoria ${ciclo}` : ""}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNuevo(true)}
          className="inline-flex shrink-0 items-center gap-space-xs self-start rounded-lg bg-primary-container px-space-md py-space-sm font-label-lg text-label-lg text-on-primary shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-primary active:translate-y-0 md:self-auto"
        >
          <Simbolo nombre="person_add" className="text-[20px]!" />
          <span>+ Nuevo usuario</span>
        </button>
      </div>

      <div className="mb-space-lg grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Total Registrados" valor={conteos?.todos} unidad="usuarios" unidadClase="text-on-surface-variant font-medium"
          pie={<><span className="inline-block h-2 w-2 rounded-full bg-primary-container" /> UAE • UAN {ciclo && `Convocatoria ${ciclo}`}</>}
          icono="groups" iconoClase="bg-surface-container text-primary" />
        <Kpi titulo="Estudiantes UAE" valor={conteos?.estudiantes_activos} unidad="activos" unidadClase="text-on-tertiary-container font-semibold"
          pie="Economía & Finanzas" icono="school" iconoClase="bg-surface-container-high text-primary-container" />
        <Kpi titulo="Control Escolar" valor={conteos?.control_escolar} valorClase="text-secondary" unidad="ventanillas" unidadClase="text-secondary font-semibold"
          pie="Revisión y Dictaminación" icono="badge" iconoClase="bg-secondary-fixed text-secondary" />
        <Kpi titulo="Administradores" valor={conteos?.administradores} unidad="plenos" unidadClase="text-on-primary-fixed-variant font-semibold"
          pie="Privilegios totales" icono="shield_person" iconoClase="bg-primary-fixed text-primary" relleno />
      </div>

      <div className="mb-space-lg flex items-start gap-space-md rounded-xl bg-surface-container-high p-space-md shadow-sm">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary">
          <Simbolo nombre="info" className="text-[22px]!" />
        </div>
        <div className="flex flex-1 flex-col gap-space-xs">
          <div className="flex flex-wrap items-center gap-space-xs">
            <span className="font-label-lg text-label-lg font-bold text-primary">Regla Institucional de Creación de Cuentas</span>
            <span className="rounded-full bg-secondary-container px-space-xs py-0.5 font-label-sm text-label-sm font-bold text-on-secondary-container">Estricto</span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">
            <strong>Nota importante:</strong> Los alumnos se crean{" "}
            <span className="font-semibold text-primary underline underline-offset-2">exclusivamente por importación de CSV</span> (desde el módulo de{" "}
            <em>Mantenimiento &gt; Importación de Datos</em>, en la Ventanilla de Control Escolar). El formulario manual de nuevo usuario está
            reservado de manera estricta para personal de <strong>Control Escolar</strong> y <strong>Administradores</strong> del sistema.
          </p>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1 md:flex">
          <span className="font-label-sm text-label-sm font-semibold tracking-wider text-on-surface-variant uppercase">Validación Interna</span>
          <span className="flex items-center gap-1 font-label-md text-label-md font-semibold text-primary">
            <Simbolo nombre="verified" className="text-[16px]!" />
            UAE Convocatoria
          </span>
        </div>
      </div>

      <div className="mb-space-md flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1 lg:min-w-[280px]">
          <Simbolo nombre="search" className="absolute top-1/2 left-3 -translate-y-1/2 text-[20px]! text-outline" />
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre, matrícula o correo @uan.edu.mx..."
            aria-label="Buscar usuario"
            className="w-full rounded-lg bg-surface-container-low py-2 pr-4 pl-10 text-body-md text-on-surface transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-space-xs">
          {tabs.map(([rol, etiqueta, n, chip]) => {
            const activo = filtros.rol === rol;
            return (
              <button
                key={etiqueta}
                type="button"
                aria-pressed={activo}
                onClick={() => filtrar("rol", rol)}
                className={`flex items-center gap-1 rounded-lg px-space-sm py-1.5 font-label-md text-label-md font-semibold transition-colors ${
                  activo ? "bg-primary-container text-on-primary" : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                }`}
              >
                <span>{etiqueta}</span>
                <span className={`rounded-full px-1.5 text-xs ${activo ? "bg-white/20" : chip}`}>{n ?? "—"}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-space-sm lg:justify-end">
          <div className="relative">
            <select
              value={filtros.estado}
              onChange={(e) => filtrar("estado", e.target.value)}
              aria-label="Estado"
              className="cursor-pointer appearance-none rounded-lg border-0 bg-surface-container-low py-2 pr-8 pl-3 font-label-md text-label-md font-semibold text-on-surface focus:ring-2 focus:ring-primary-container focus:outline-none"
            >
              <option value="">Estado: Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </select>
            <Simbolo nombre="expand_more" className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[18px]! text-outline" />
          </div>
          <button
            type="button"
            onClick={exportar}
            title="Descargar la lista de usuarios para cotejo institucional"
            className="inline-flex items-center gap-space-xs rounded-lg bg-surface-container px-space-md py-2 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-surface-container-high"
          >
            <Simbolo nombre="download" className="text-[18px]!" />
            <span className="hidden sm:inline">Exportar Auditoría</span>
          </button>
        </div>
      </div>

      <div className="mb-space-lg overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-surface-container-low font-label-sm text-label-sm tracking-wider text-on-surface-variant uppercase">
                <th className="px-space-md py-space-md font-semibold">Usuario / Nombre Institucional</th>
                <th className="px-space-md py-space-md font-semibold">Identificador</th>
                <th className="px-space-md py-space-md font-semibold">Rol Asignado</th>
                <th className="px-space-md py-space-md text-center font-semibold">Estado</th>
                <th className="px-space-md py-space-md font-semibold">Último Acceso</th>
                <th className="px-space-md py-space-md text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-body-md">
              {data?.resultados.map((u) => (
                <Fila
                  key={u.id}
                  u={u}
                  ocupado={cambiar.isPending}
                  onReiniciar={() => setPendiente({ tipo: "reiniciar", usuario: u })}
                  onRol={(rol) => setPendiente({ tipo: "rol", usuario: u, rol })}
                  onActivo={() => activar(u)}
                />
              ))}
            </tbody>
          </table>
          {isPending && (
            <div className="flex justify-center p-space-xl text-primary">
              <Spinner className="h-6 w-6" />
            </div>
          )}
          {error && <p className="p-space-xl text-center font-body-md text-error">{error.message}</p>}
          {data && data.resultados.length === 0 && (
            <p className="p-space-xl text-center font-body-md text-on-surface-variant">Ningún usuario coincide con los filtros.</p>
          )}
        </div>
        {data && (
          <div className="flex flex-col items-center justify-between gap-space-sm bg-surface-container-low px-space-md py-space-sm sm:flex-row">
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Mostrando <strong className="font-semibold text-on-surface">{data.resultados.length}</strong> de{" "}
              <strong className="font-semibold text-on-surface">{data.total}</strong> usuarios registrados{ciclo && ` • Convocatoria ${ciclo}`}
            </span>
            <div className="flex flex-wrap items-center gap-space-xs">
              <BotonPagina deshabilitado={data.pagina <= 1} onClick={() => cambiarFiltro("pagina", String(data.pagina - 1))}>
                Anterior
              </BotonPagina>
              {Array.from({ length: data.paginas }, (_, i) => i + 1).map((n) =>
                n === data.pagina ? (
                  <span key={n} aria-current="page" className="rounded bg-primary-container px-space-sm py-1 text-label-sm font-bold text-on-primary">
                    {n}
                  </span>
                ) : (
                  <BotonPagina key={n} onClick={() => cambiarFiltro("pagina", n === 1 ? "" : String(n))}>
                    {n}
                  </BotonPagina>
                ),
              )}
              <BotonPagina deshabilitado={data.pagina >= data.paginas} onClick={() => cambiarFiltro("pagina", String(data.pagina + 1))}>
                Siguiente
              </BotonPagina>
            </div>
          </div>
        )}
      </div>

      {nuevo && (
        <NuevoUsuario
          cerrar={cerrarNuevo}
          alCrear={(usuario, pass) => {
            setNuevo(false);
            setPassword({ titulo: "Cuenta creada", usuario: `${nombreDe(usuario)} (${usuario.username})`, password: pass });
          }}
        />
      )}
      {pendiente && (
        <Confirmacion
          pendiente={pendiente}
          ocupado={cambiar.isPending || reiniciar.isPending}
          error={(cambiar.error ?? reiniciar.error)?.message}
          cerrar={() => {
            cambiar.reset();
            reiniciar.reset();
            cerrarPendiente();
          }}
          confirmar={confirmar}
        />
      )}
      {password && <PasswordTemporal {...password} cerrar={cerrarPassword} />}
    </div>
  );
}

function Kpi({
  titulo,
  valor,
  valorClase = "text-primary",
  unidad,
  unidadClase,
  pie,
  icono,
  iconoClase,
  relleno,
}: {
  titulo: string;
  valor?: number;
  valorClase?: string;
  unidad: string;
  unidadClase: string;
  pie: ReactNode;
  icono: string;
  iconoClase: string;
  relleno?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
      <div className="flex flex-col">
        <span className="font-label-sm text-label-sm font-semibold tracking-wider text-on-surface-variant uppercase">{titulo}</span>
        <div className="mt-space-xs flex items-baseline gap-space-xs">
          <span className={`font-display-lg text-display-lg leading-none font-bold ${valorClase}`}>{valor ?? "—"}</span>
          <span className={`font-label-sm text-label-sm ${unidadClase}`}>{unidad}</span>
        </div>
        <span className="mt-1 flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">{pie}</span>
      </div>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconoClase}`}>
        <Simbolo nombre={icono} relleno={relleno} className="text-[26px]!" />
      </div>
    </div>
  );
}

function BotonPagina({ deshabilitado, onClick, children }: { deshabilitado?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={deshabilitado}
      onClick={onClick}
      className="rounded bg-surface-container-lowest px-space-sm py-1 text-label-sm font-semibold text-on-surface-variant transition-colors hover:text-primary disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Fila({
  u,
  ocupado,
  onReiniciar,
  onRol,
  onActivo,
}: {
  u: UsuarioAdmin;
  ocupado: boolean;
  onReiniciar: () => void;
  onRol: (rol: Rol) => void;
  onActivo: () => void;
}) {
  const rol = ROLES[u.rol];
  const estudiante = u.rol === "estudiante";
  const otroRol: Rol = u.rol === "administrador" ? "control_escolar" : "administrador";
  return (
    <tr className="transition-colors odd:bg-transparent even:bg-surface-container-low/20 hover:bg-surface-container-low/60">
      <td className="max-w-[17rem] px-space-md py-space-md">
        <div className={`flex items-center gap-space-sm ${u.activo ? "" : "opacity-75"}`}>
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-label-md font-bold shadow-sm ${
              u.activo ? rol.avatar : "bg-surface-variant text-on-surface-variant"
            }`}
          >
            {iniciales(u)}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className={`truncate font-label-lg text-label-lg font-bold ${u.activo ? "text-primary" : "text-on-surface-variant"}`}>
              {nombreDe(u)}
            </span>
            <span className="truncate font-body-sm text-body-sm text-on-surface-variant">
              {u.email}
              {u.programa && ` • Lic. en ${u.programa}`}
            </span>
          </div>
        </div>
      </td>
      <td className="px-space-md py-space-md">
        <span
          className={`inline-block rounded px-2.5 py-1 font-mono text-body-sm font-bold ${
            !u.activo
              ? "bg-surface-container text-on-surface-variant"
              : estudiante
                ? "bg-primary-fixed text-on-primary-fixed"
                : "bg-surface-container font-semibold text-primary"
          }`}
        >
          {u.matricula ?? conCorte(u.email || u.username)}
        </span>
      </td>
      <td className="px-space-md py-space-md">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-label-sm text-label-sm font-semibold ${rol.chip}`}>
          <Simbolo nombre={rol.icono} relleno={rol.relleno} className="text-[16px]!" />
          {rol.texto}
        </span>
      </td>
      <td className="px-space-md py-space-md text-center">
        {u.activo ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2.5 py-0.5 font-label-sm text-label-sm font-bold text-on-tertiary-container">
            <span className="h-2 w-2 rounded-full bg-on-tertiary-container" />
            Activo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-error-container px-2.5 py-0.5 font-label-sm text-label-sm font-bold text-on-error-container">
            <span className="h-2 w-2 rounded-full bg-error" />
            Inactivo
          </span>
        )}
      </td>
      <td className="px-space-md py-space-md">
        <div className="flex flex-col">
          <span className={`text-body-sm font-medium ${u.activo ? "text-on-surface" : "text-on-surface-variant"}`}>
            {u.ultimo_acceso ? acceso(u.ultimo_acceso) : "Nunca"}
          </span>
          {u.ultimo_acceso && (
            <span className="font-body-sm text-[11px] text-on-surface-variant">
              {u.origen}
              {u.ip && ` (IP ${u.ip})`}
            </span>
          )}
        </div>
      </td>
      <td className="px-space-md py-space-md text-right">
        <div className="inline-flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onReiniciar}
            title="Restablecer contraseña provisional"
            aria-label={`Restablecer contraseña de ${nombreDe(u)}`}
            className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
          >
            <Simbolo nombre="lock_reset" className="text-[19px]!" />
          </button>
          {estudiante || u.es_yo ? (
            <div className="group relative">
              <button type="button" disabled className="cursor-not-allowed rounded-lg p-1.5 text-outline-variant opacity-50" aria-label="Cambiar rol (no disponible)">
                <Simbolo nombre="manage_accounts" className="text-[19px]!" />
              </button>
              <div className="absolute right-0 bottom-full z-30 mb-1 hidden rounded bg-inverse-surface px-2 py-1 text-[11px] text-inverse-on-surface shadow-md group-hover:block">
                {estudiante ? "Rol gestionado por Control Escolar" : "No puedes cambiar tu propio rol"}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onRol(otroRol)}
              title={`Cambiar a ${ROLES[otroRol].texto}`}
              aria-label={`Cambiar rol de ${nombreDe(u)} a ${ROLES[otroRol].texto}`}
              className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-secondary"
            >
              <Simbolo nombre="manage_accounts" className="text-[19px]!" />
            </button>
          )}
          <label
            className={`relative ml-1 inline-flex items-center ${u.es_yo ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            title={u.es_yo ? "No puedes desactivar tu propia cuenta" : "Activar / Desactivar"}
          >
            <input
              type="checkbox"
              className="peer sr-only"
              checked={u.activo}
              disabled={u.es_yo || ocupado}
              onChange={onActivo}
              aria-label={`${u.activo ? "Desactivar" : "Activar"} la cuenta de ${nombreDe(u)}`}
            />
            <div className="peer h-4 w-8 rounded-full bg-outline-variant peer-checked:bg-primary-container after:absolute after:top-[2px] after:left-[2px] after:h-3 after:w-3 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
          </label>
        </div>
      </td>
    </tr>
  );
}

const CAMPO =
  "w-full rounded-lg bg-surface-container-low px-3 py-2 text-body-md text-on-surface transition-all placeholder:text-outline focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary-container focus:outline-none";

function NuevoUsuario({ cerrar, alCrear }: { cerrar: () => void; alCrear: (u: UsuarioAdmin, password: string) => void }) {
  const [datos, setDatos] = useState<NuevoPersonal>({ nombre: "", apellidos: "", email: "", rol: "control_escolar" });
  const crear = useCrearPersonal();
  const errores = crear.error instanceof ApiError ? crear.error : null;
  const poner = (campo: keyof NuevoPersonal, valor: string) => setDatos({ ...datos, [campo]: valor });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    crear.mutate(datos, { onSuccess: (r) => alCrear(r.usuario, r.password_temporal) });
  };

  return (
    <Modal cerrar={cerrar} fondo="bg-primary/40 backdrop-blur-sm" className="max-h-[92vh] max-w-lg p-space-lg" titulo="titulo-nuevo">
      <div className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
              <Simbolo nombre="person_add" className="text-[24px]!" />
            </div>
            <div>
              <h3 id="titulo-nuevo" className="font-headline-sm text-headline-sm font-bold text-primary">
                Registrar Personal Escolar o Administrador
              </h3>
              <span className="font-body-sm text-body-sm text-on-surface-variant">UAE • Control Escolar UAN</span>
            </div>
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-outline transition-colors hover:bg-surface-container hover:text-on-surface"
          >
            <Simbolo nombre="close" className="text-[20px]!" />
          </button>
        </div>
        <div className="flex items-start gap-space-xs rounded-lg bg-surface-container-high p-space-sm font-body-sm text-body-sm text-on-surface-variant">
          <Simbolo nombre="warning" className="mt-0.5 shrink-0 text-[18px]! text-secondary" />
          <span>
            <strong>Recordatorio:</strong> No intente registrar alumnos por esta vía. Los estudiantes se habilitan automáticamente por importación del
            archivo CSV de alumnos.
          </span>
        </div>
        <form className="flex flex-col gap-space-md" onSubmit={enviar}>
          <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
            <Campo etiqueta="Nombre" error={errores?.campo("nombre")}>
              <input className={CAMPO} placeholder="Ej. Lic. Mariana" required value={datos.nombre} onChange={(e) => poner("nombre", e.target.value)} />
            </Campo>
            <Campo etiqueta="Apellidos" error={errores?.campo("apellidos")}>
              <input className={CAMPO} placeholder="Ej. Gómez Torres" required value={datos.apellidos} onChange={(e) => poner("apellidos", e.target.value)} />
            </Campo>
          </div>
          <Campo etiqueta="Correo Electrónico Institucional" error={errores?.campo("email")} ayuda="Debe pertenecer exclusivamente al dominio oficial @uan.edu.mx">
            <div className="relative">
              <input
                className={`${CAMPO} pr-10`}
                type="email"
                placeholder="usuario@uan.edu.mx"
                required
                value={datos.email}
                onChange={(e) => poner("email", e.target.value)}
              />
              <Simbolo nombre="mail" className="absolute top-1/2 right-3 -translate-y-1/2 text-[18px]! text-outline" />
            </div>
          </Campo>
          <Campo etiqueta="Rol Institucional a Otorgar" error={errores?.campo("rol")}>
            <select
              className={`${CAMPO} font-label-md text-label-md font-semibold`}
              value={datos.rol}
              onChange={(e) => poner("rol", e.target.value)}
            >
              <option value="control_escolar">Control Escolar (Ventanilla / Dictaminación UAE)</option>
              <option value="administrador">Administrador del Sistema SABE (Privilegios Plenos)</option>
            </select>
          </Campo>
          <div className="flex items-center gap-space-xs rounded-lg bg-surface-container-low p-space-sm">
            <Simbolo nombre="key" className="shrink-0 text-[20px]! text-primary-container" />
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Se generará una contraseña provisional que deberá renovar en su primer ingreso a SABE.
            </span>
          </div>
          {errores && !errores.campo("nombre") && !errores.campo("apellidos") && !errores.campo("email") && !errores.campo("rol") && (
            <p className="font-body-sm text-body-sm text-error">{errores.message}</p>
          )}
          <div className="flex items-center justify-end gap-space-sm pt-space-xs">
            <button
              type="button"
              onClick={cerrar}
              className="rounded-lg bg-surface-container px-space-md py-2 font-label-md text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={crear.isPending}
              className="inline-flex items-center gap-space-xs rounded-lg bg-primary-container px-space-md py-2 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-primary disabled:opacity-60"
            >
              {crear.isPending && <Spinner />}
              Crear usuario institucional
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function Campo({ etiqueta, error, ayuda, children }: { etiqueta: string; error?: string; ayuda?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-space-xs">
      <label className="flex flex-col gap-space-xs">
        <span className="font-label-md text-label-md font-semibold text-on-surface">{etiqueta}</span>
        {children}
      </label>
      {error ? (
        <span className="font-label-sm text-label-sm text-error">{error}</span>
      ) : (
        ayuda && <span className="font-label-sm text-label-sm text-on-surface-variant">{ayuda}</span>
      )}
    </div>
  );
}

function Confirmacion({
  pendiente,
  ocupado,
  error,
  cerrar,
  confirmar,
}: {
  pendiente: Pendiente;
  ocupado: boolean;
  error?: string;
  cerrar: () => void;
  confirmar: () => void;
}) {
  const nombre = nombreDe(pendiente.usuario);
  const textos = {
    rol:
      pendiente.tipo === "rol"
        ? {
            titulo: "Cambiar rol de funcionario",
            icono: "manage_accounts",
            texto: `¿Cambiar el rol de ${nombre} a ${ROLES[pendiente.rol].texto}?`,
            boton: "Cambiar rol",
          }
        : null,
    desactivar: {
      titulo: "Desactivar cuenta",
      icono: "person_off",
      texto: `${nombre} no podrá entrar a SABE y su sesión abierta se cerrará. La cuenta no se borra: puedes activarla de nuevo cuando quieras.`,
      boton: "Desactivar",
    },
    reiniciar: {
      titulo: "Restablecer contraseña provisional",
      icono: "lock_reset",
      texto: `Se generará una contraseña provisional para ${nombre}. La actual dejará de funcionar y deberá cambiarla al entrar.`,
      boton: "Restablecer",
    },
  }[pendiente.tipo]!;

  return (
    <Modal cerrar={cerrar} fondo="bg-primary/40 backdrop-blur-sm" className="max-w-md p-space-lg" titulo="titulo-confirmar">
      <div className="flex flex-col gap-space-md">
        <div className="flex items-center gap-space-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-primary">
            <Simbolo nombre={textos.icono} className="text-[24px]!" />
          </div>
          <h3 id="titulo-confirmar" className="font-headline-sm text-headline-sm font-bold text-primary">
            {textos.titulo}
          </h3>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant">{textos.texto}</p>
        {error && <p className="font-body-sm text-body-sm text-error">{error}</p>}
        <div className="flex items-center justify-end gap-space-sm">
          <button
            type="button"
            onClick={cerrar}
            className="rounded-lg bg-surface-container px-space-md py-2 font-label-md text-label-md font-semibold text-on-surface hover:bg-surface-container-high"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={ocupado}
            className={`inline-flex items-center gap-space-xs rounded-lg px-space-md py-2 font-label-md text-label-md font-semibold shadow-sm disabled:opacity-60 ${
              pendiente.tipo === "desactivar" ? "bg-error text-on-error hover:opacity-90" : "bg-primary-container text-on-primary hover:bg-primary"
            }`}
          >
            {ocupado && <Spinner />}
            {textos.boton}
          </button>
        </div>
      </div>
    </Modal>
  );
}

