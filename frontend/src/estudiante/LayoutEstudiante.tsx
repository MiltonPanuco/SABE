// Marco del portal del estudiante: encabezado, menú lateral y pie de stitch/sabe_estudiantes.
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { usePeriodoActivo } from "../api/estudiante";
import { useAuth } from "../auth/AuthProvider";
import { Simbolo } from "../components/acceso";
import { CarritoProvider, useCarrito } from "./Carrito";
import { nombreCorto } from "./formato";
import { ToastProvider } from "./Toast";

// Secciones del portal con su título en el encabezado (mapa `titles` de stitch).
const SECCIONES = [
  { ruta: "/estudiante", icono: "space_dashboard", menu: "Inicio / Dashboard", titulo: "Portal Estudiantil • Dashboard" },
  { ruta: "/estudiante/horario", icono: "calendar_month", menu: "Horario Semestral", titulo: "Horario Semestral Inscrito" },
  { ruta: "/estudiante/catalogo", icono: "post_add", menu: "Catálogo & Carrito", titulo: "Catálogo de Asignaturas & Carrito" },
  { ruta: "/estudiante/confirmacion", icono: "rule", menu: "Confirmación", titulo: "Validación y Confirmación de Trámite" },
  { ruta: "/estudiante/historial", icono: "receipt_long", menu: "Historial & Acuse", titulo: "Comprobante Digital e Historial" },
];

export function LayoutEstudiante() {
  return (
    <ToastProvider>
      <CarritoProvider>
        <Portal />
      </CarritoProvider>
    </ToastProvider>
  );
}

function Portal() {
  const { usuario, cerrarSesion } = useAuth();
  const { data: periodo } = usePeriodoActivo();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Con el menú abierto la página de atrás no se desplaza; Esc lo cierra.
  useEffect(() => {
    if (!menuAbierto) return;
    document.body.classList.add("overflow-hidden");
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setMenuAbierto(false);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.body.classList.remove("overflow-hidden");
      document.removeEventListener("keydown", alTeclear);
    };
  }, [menuAbierto]);

  // Cambiar de sección cierra el menú y vuelve arriba.
  useEffect(() => {
    setMenuAbierto(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  if (!usuario) return null;
  const perfil = usuario.estudiante;
  const programa = perfil ? `Licenciatura en ${perfil.programa}` : "";
  const ciclo = periodo?.ciclo;
  const ruta = pathname.replace(/\/$/, "");
  const seccion = /^\/estudiante\/historial\/\d+$/.test(ruta)
    ? { titulo: "Detalle de Folio" }
    : (SECCIONES.find((s) => s.ruta === ruta) ?? SECCIONES[0]);

  const salir = () => {
    cerrarSesion();
    navigate("/login", { replace: true });
  };

  return (
    <div className="tema-portal flex min-h-screen flex-col justify-between overflow-x-hidden bg-surface font-body-md text-on-surface antialiased">
      <header className="fixed top-0 right-0 left-0 z-40 bg-surface/95 shadow-[0_1px_8px_rgba(0,43,73,0.06)] backdrop-blur-md print:hidden">
        <div className="relative mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-2 px-3 sm:h-20 sm:gap-gutter sm:px-gutter">
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setMenuAbierto(true)}
              title="Abrir menú lateral"
              className="flex cursor-pointer items-center justify-center rounded-lg border border-surface-container-high p-1.5 text-primary transition-all hover:bg-surface-container-high focus:outline-none active:scale-95 sm:p-2"
            >
              <Simbolo nombre="menu" className="text-[22px]! sm:text-[24px]!" />
            </button>
            <div className="flex items-center gap-2 sm:gap-3">
              <img alt="SABE" className="h-7 w-auto object-contain sm:h-9" src="/img/sabe-logo.png" />
              <div className="hidden h-4 w-px bg-surface-container-high sm:h-5 md:block" />
              <div className="hidden items-center gap-2 md:flex">
                <span className="h-2 w-2 rounded-full bg-secondary-container" />
                <span className="max-w-[160px] truncate font-headline-sm text-label-lg font-bold tracking-tight text-primary lg:max-w-none">
                  {seccion.titulo}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-space-md">
            <div className="hidden items-center gap-2 rounded-lg border border-surface-container-high bg-surface-container-low px-3 py-1.5 text-label-sm font-medium text-on-surface-variant lg:flex">
              <Simbolo nombre="event_available" className="text-[16px]! text-primary-container" />
              <span>
                Período Vigente: <strong className="text-on-surface">&nbsp;{ciclo ? `Ciclo ${ciclo}` : "Sin periodo activo"}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-surface-container-high/60 bg-surface-container-low px-2 py-1 sm:gap-space-xs sm:rounded-xl sm:px-space-md sm:py-1.5">
              <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-on-tertiary-container" />
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-1">
                  <span className="max-w-[90px] truncate font-label-md text-[11px] leading-tight font-bold text-on-surface sm:max-w-[150px] sm:text-label-md">
                    {nombreCorto(usuario.nombre, usuario.apellidos)}
                  </span>
                  <span className="hidden font-mono text-label-sm text-on-surface-variant sm:inline">
                    #{perfil?.matricula ?? usuario.username}
                  </span>
                </div>
                <span className="hidden max-w-[200px] truncate font-body-sm text-[11px] leading-none text-on-surface-variant md:inline">
                  {programa}
                </span>
              </div>
            </div>

            <div className="relative flex shrink-0 items-center gap-1 text-on-surface-variant">
              <Campana ciclo={ciclo} />
              <button
                type="button"
                onClick={salir}
                title="Cerrar Sesión"
                className="flex cursor-pointer items-center gap-1 rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container sm:p-2"
              >
                <Simbolo nombre="logout" className="text-[18px]! sm:text-[20px]!" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Fondo oscuro y menú lateral */}
      <div
        onClick={() => setMenuAbierto(false)}
        className={`fixed inset-0 z-50 bg-[#001629]/65 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
          menuAbierto ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <MenuLateral
        abierto={menuAbierto}
        cerrar={() => setMenuAbierto(false)}
        nombre={`${usuario.nombre} ${usuario.apellidos}`}
        programa={programa}
        ciclo={ciclo}
      />

      <main className="flex min-w-0 flex-1 flex-col bg-surface pt-20 print:pt-0">
        <div className="flex flex-1 flex-col pt-8 print:pt-0">
          <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-margin-sm pb-16 lg:px-margin">
            <Outlet />
          </div>
        </div>
      </main>

      <footer className="mt-auto w-full border-t border-surface-container-high/40 bg-surface-container-lowest shadow-[0_-1px_6px_rgba(0,43,73,0.04)] print:hidden">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-space-md px-gutter py-space-md md:flex-row">
          <div className="flex flex-col items-center md:items-start">
            <span className="font-headline-sm text-label-lg font-bold text-primary">Unidad Académica de Economía • Control Escolar</span>
            <span className="text-xs text-on-surface-variant">Sistema de Altas y Bajas de Economía (SABE)</span>
          </div>
          <div className="flex items-center gap-space-lg">
            <span className="font-mono text-label-sm text-on-surface-variant">{ciclo ? `Convocatoria ${ciclo}` : ""}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MenuLateral({
  abierto,
  cerrar,
  nombre,
  programa,
  ciclo,
}: {
  abierto: boolean;
  cerrar: () => void;
  nombre: string;
  programa: string;
  ciclo?: string;
}) {
  const { items } = useCarrito();
  return (
    <aside
      aria-hidden={!abierto}
      className={`fixed top-0 left-0 z-50 print:hidden flex h-screen w-72 max-w-[85vw] shrink-0 transform flex-col justify-between overflow-y-auto bg-[#002B49] text-white shadow-2xl transition-transform duration-300 ease-in-out ${
        abierto ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div>
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-amber-300/90 uppercase">
              <Simbolo nombre="school" className="text-[15px]! text-amber-400" /> SABE • Control Escolar
            </span>
            <button
              type="button"
              onClick={cerrar}
              title="Cerrar menú"
              className="flex cursor-pointer items-center justify-center rounded-lg p-1.5 text-slate-300 transition-all hover:bg-white/15 hover:text-white focus:outline-none"
            >
              <Simbolo nombre="close" className="text-[22px]!" />
            </button>
          </div>
          <div className="flex items-center justify-center rounded-xl bg-white p-3 shadow-md">
            <img alt="SABE" className="h-9 w-auto max-w-[180px] object-contain sm:h-10" src="/img/sabe-logo.png" />
          </div>
          <p className="flex items-center justify-center gap-1.5 text-center text-[11.5px] font-medium text-amber-300/95 italic">
            <Simbolo nombre="auto_awesome" className="text-[14px]! text-amber-400" />
            "Altas y bajas sin filas ni papeleo"
          </p>
        </div>
        <nav className="space-y-2 p-3 sm:p-4">
          <div className="px-3 py-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">Navegación del Estudiante</div>
          {SECCIONES.map((s) => (
            <NavLink
              key={s.ruta}
              to={s.ruta}
              // El inicio solo se marca en /estudiante; Historial también en el detalle de un folio.
              end={s.ruta !== "/estudiante/historial"}
              onClick={cerrar}
              tabIndex={abierto ? 0 : -1}
              className={({ isActive }) =>
                `flex w-full cursor-pointer items-center justify-between rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition-all ${
                  isActive
                    ? "border-l-4 border-secondary-container bg-white/15 pl-3 text-white shadow-md"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <Simbolo
                      nombre={s.icono}
                      className={`text-[20px]! ${isActive ? "text-secondary-container" : "text-slate-400"}`}
                    />
                    <span>{s.menu}</span>
                  </div>
                  {s.ruta === "/estudiante/catalogo" && (
                    <span className="rounded-full bg-secondary-container px-2 py-0.5 text-xs font-bold text-[#002B49]">
                      {items.length}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="border-t border-white/10 bg-[#001b2e]/80 p-3 sm:p-4">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:h-12 sm:w-12">
            <img alt="Escudo Oficial UAE" className="h-full w-full object-contain" src="/img/escudo-uae.png" />
          </div>
          <div className="overflow-hidden">
            <h4 className="truncate text-xs font-bold text-white">{nombre}</h4>
            <p className="truncate text-[11px] text-slate-300">{programa}</p>
            {ciclo && (
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[10px] font-semibold text-emerald-400">Ciclo {ciclo}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

/** Campana de avisos. Las notificaciones reales llegan en F10; mientras, el panel sale vacío. */
function Campana({ ciclo }: { ciclo?: string }) {
  const [abierta, setAbierta] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierta) return;
    const alClic = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierta(false);
    };
    document.addEventListener("click", alClic);
    return () => document.removeEventListener("click", alClic);
  }, [abierta]);

  return (
    <div className="relative" ref={caja}>
      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        title="Notificaciones"
        className="relative cursor-pointer rounded-lg p-1.5 text-on-surface-variant transition-all hover:bg-surface-container-high sm:p-2"
      >
        <Simbolo nombre="notifications" className="text-[18px]! sm:text-[20px]!" />
      </button>
      {abierta && (
        <div className="absolute right-0 z-50 mt-2 flex w-80 flex-col gap-2 rounded-xl border border-surface-container-high bg-surface-container-lowest p-space-md shadow-2xl sm:w-96">
          <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
            <div className="flex items-center gap-1.5">
              <Simbolo nombre="notifications_active" className="text-[18px]! text-primary-container" />
              <h4 className="font-headline-sm text-xs font-bold tracking-wide text-primary uppercase">Notificaciones Institucionales</h4>
            </div>
            {ciclo && <span className="rounded bg-primary-fixed px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">Ciclo {ciclo}</span>}
          </div>
          <div className="flex flex-col items-center gap-1 py-4 text-center">
            <Simbolo nombre="notifications_off" className="text-[22px]! text-on-surface-variant" />
            <p className="font-body-sm text-[11px] text-on-surface-variant">No tienes notificaciones por ahora.</p>
          </div>
          <div className="border-t border-surface-container-high pt-2 text-center">
            <button
              type="button"
              onClick={() => setAbierta(false)}
              className="cursor-pointer font-label-sm text-xs font-semibold text-primary-container hover:underline"
            >
              Cerrar notificaciones
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
