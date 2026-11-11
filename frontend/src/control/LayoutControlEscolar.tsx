// Marco de las pantallas de control escolar: menú lateral y encabezado que comparten las 6 pantallas
// de control escolar en stitch/ (aquí, el de sabe_solicitudes_control_escolar).
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useCampana } from "../api/avisos";
import { usePeriodoActivo } from "../api/estudiante";
import { useAuth } from "../auth/AuthProvider";
import { Simbolo } from "../components/acceso";
import { AvisoProvider } from "./Toast";

export const SECCIONES_CONTROL = {
  tramites: [
    { ruta: "solicitudes", icono: "pending_actions", texto: "Solicitudes Pendientes" },
    { ruta: "oferta", icono: "menu_book", texto: "Oferta Académica" },
  ],
  mantenimiento: [
    { ruta: "periodo", icono: "event_available", texto: "Periodo y Convocatoria" },
    { ruta: "importacion", icono: "badge", texto: "Importación de Datos (CSV)" },
    { ruta: "exportacion", icono: "sync_alt", texto: "Exportar Excel para SADCE" },
    { ruta: "bitacora", icono: "security_update_good", texto: "Bitácora de Auditoría" },
  ],
};

// Pantallas de stitch con el pie institucional.
// Pie institucional de stitch y su leyenda derecha, por pantalla.
const PIES: Record<string, string> = {
  "/control-escolar/periodo": "Plataforma auxiliar independiente de SADCE Central",
  "/control-escolar/importacion":
    "Plataforma interna auxiliar. No se conecta ni sincroniza automáticamente con SADCE; la captura final corresponde a Control Escolar.",
  "/control-escolar/notificaciones": "Plataforma auxiliar independiente de SADCE Central",
};

export function LayoutControlEscolar() {
  const { usuario, cerrarSesion } = useAuth();
  const { data: periodo } = usePeriodoActivo();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { data: campana } = useCampana();

  // En teléfono el menú es un panel: Esc lo cierra y la página de atrás no se desplaza.
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

  useEffect(() => {
    setMenuAbierto(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  if (!usuario) return null;

  const salir = () => {
    cerrarSesion();
    navigate("/login", { replace: true });
  };

  return (
    <AvisoProvider>
      <div className="tema-portal min-h-screen overflow-x-hidden bg-background font-body-md text-body-md text-on-surface antialiased">
        {/* Fondo del menú en teléfono */}
        <div
          onClick={() => setMenuAbierto(false)}
          className={`fixed inset-0 z-50 bg-[#001629]/50 transition-opacity duration-300 lg:hidden ${
            menuAbierto ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
        />
        <aside
          className={`fixed top-0 left-0 z-50 flex print:hidden h-full w-72 max-w-[85vw] flex-col justify-between overflow-y-auto bg-surface-container-low shadow-[0_1px_8px_rgba(0,43,73,0.06)] transition-transform duration-300 lg:translate-x-0 ${
            menuAbierto ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex flex-col">
            <div className="flex h-16 items-center gap-space-sm bg-surface-container px-space-lg">
              <Simbolo nombre="account_balance" className="text-[26px]! text-primary" />
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm leading-none tracking-tight text-primary">UAE • UAN</span>
                <span className="mt-space-xs font-label-sm text-label-sm leading-none text-on-surface-variant">
                  Unidad Académica de Economía
                </span>
              </div>
            </div>
            <Seccion titulo="Gestión de Trámites" enlaces={SECCIONES_CONTROL.tramites} className="py-space-sm" />
            <Seccion titulo="Mantenimiento" enlaces={SECCIONES_CONTROL.mantenimiento} className="py-space-xs" />
          </div>
          <div className="m-space-md flex items-center gap-space-sm rounded-xl bg-surface-container p-space-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container-lowest text-primary shadow-[0_1px_3px_rgba(0,43,73,0.08)]">
              <Simbolo nombre="shield" className="text-[22px]!" />
            </div>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md font-semibold text-on-surface">Escudo UAE</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">SABES Control UAE</span>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col lg:pl-72 print:pl-0">
          <header className="fixed top-0 right-0 left-0 z-40 flex print:hidden h-16 items-center justify-between gap-2 bg-surface/85 px-3 shadow-[0_1px_8px_rgba(0,43,73,0.04)] backdrop-blur-xl sm:px-space-lg lg:left-72">
            <div className="flex min-w-0 items-center gap-2 sm:gap-space-md">
              <button
                type="button"
                onClick={() => setMenuAbierto(true)}
                title="Abrir menú lateral"
                className="flex shrink-0 cursor-pointer items-center justify-center rounded-lg p-1.5 text-primary hover:bg-surface-container lg:hidden"
              >
                <Simbolo nombre="menu" />
              </button>
              <img alt="SABE" className="h-8 w-auto shrink-0 object-contain" src="/img/sabe-logo.png" />
              <div className="hidden items-center gap-space-xs sm:flex">
                <span className="font-headline-sm text-headline-sm text-primary">SABE</span>
                <span className="hidden font-body-sm text-body-sm text-on-surface-variant md:inline">• Sistema de Altas y Bajas</span>
              </div>
              {periodo && (
                <span className="inline-flex shrink-0 items-center gap-space-xs rounded-full bg-primary-fixed px-space-sm py-space-xs font-label-sm text-label-sm text-on-primary-fixed">
                  <Simbolo nombre="schedule" className="text-[16px]!" />
                  <span>
                    <span className="hidden sm:inline">Ciclo Escolar </span>
                    {periodo.ciclo}
                  </span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-space-sm sm:gap-space-lg">
              {/* Campana y salida: prototipo.js las agrega antes del usuario, con 8 px de margen. */}
              <div className="flex items-center gap-2 sm:mr-2">
                <BotonEncabezado
                  icono="notifications"
                  titulo={campana?.no_leidas ? `Notificaciones (${campana.no_leidas} sin leer)` : "Notificaciones"}
                  insignia={campana?.no_leidas}
                  onClick={() => navigate("/control-escolar/notificaciones")}
                />
                <BotonEncabezado icono="logout" titulo="Cerrar sesión" onClick={salir} />
              </div>
              <div className="flex items-center gap-space-sm text-right">
                <div className="hidden flex-col md:flex">
                  <span className="font-label-lg text-label-lg leading-tight font-semibold text-on-surface">
                    {usuario.nombre} {usuario.apellidos}
                  </span>
                  <span className="font-label-sm text-label-sm leading-tight text-on-surface-variant">Ventanilla Control Escolar UAE</span>
                </div>
                <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-primary sm:flex">
                  <Simbolo nombre="person" className="text-[18px]! text-on-primary" />
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 bg-surface px-margin-sm pt-16 pb-space-md sm:px-space-lg print:pt-0">
            <Outlet />
          </main>
          {PIES[pathname] && <Pie ciclo={periodo?.ciclo} leyenda={PIES[pathname]} />}
        </div>
      </div>
    </AvisoProvider>
  );
}

function Pie({ ciclo, leyenda }: { ciclo?: string; leyenda: string }) {
  return (
    <footer className="mt-auto w-full bg-surface-container-low px-margin-sm py-space-md shadow-[0_-1px_6px_rgba(0,43,73,0.03)] sm:px-space-lg print:hidden">
      <div className="flex w-full flex-col items-center justify-between gap-space-sm text-center font-label-md text-label-md text-on-surface-variant md:flex-row md:text-left">
        <div>
          © 2026 Universidad Autónoma de Nayarit • Unidad Académica de Economía (UAE).
          {ciclo && <strong> Ciclo Escolar {ciclo}</strong>}.
        </div>
        <div className="flex items-center gap-space-xs">
          <Simbolo nombre="info" className="text-[16px]! text-on-surface-variant" />
          <span>{leyenda}</span>
        </div>
      </div>
    </footer>
  );
}

function Seccion({
  titulo,
  enlaces,
  className,
}: {
  titulo: string;
  enlaces: { ruta: string; icono: string; texto: string }[];
  className: string;
}) {
  return (
    <div className={`px-space-md ${className}`}>
      <div className="px-space-sm py-space-xs font-label-sm text-label-sm tracking-wider text-on-surface-variant uppercase">{titulo}</div>
      <nav className="mt-space-xs flex flex-col gap-space-xs">
        {enlaces.map((e) => (
          <NavLink
            key={e.ruta}
            to={`/control-escolar/${e.ruta}`}
            className={({ isActive }) =>
              `flex items-center gap-space-sm rounded-lg px-space-md py-space-sm transition-colors ${
                isActive
                  ? "bg-primary-container font-semibold text-on-primary-container"
                  : "font-label-lg text-label-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`
            }
          >
            <Simbolo nombre={e.icono} className="text-[20px]!" />
            <span>{e.texto}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function BotonEncabezado({
  icono,
  titulo,
  insignia,
  onClick,
}: {
  icono: string;
  titulo: string;
  /** Número de no leídas (la insignia de la campana del portal del estudiante). */
  insignia?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] text-on-surface-variant hover:bg-surface-container"
    >
      <Simbolo nombre={icono} className="text-[22px]!" />
      {!!insignia && (
        <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-secondary-container px-1 text-[10px] leading-none font-bold text-[#002B49]">
          {insignia > 99 ? "99+" : insignia}
        </span>
      )}
    </button>
  );
}
