import { Navigate, Route, Routes } from "react-router-dom";
import { RedirigirPorRol, RutaProtegida } from "./auth/RutaProtegida";
import { Layout } from "./components/Layout";
import { ExportacionPage } from "./control/ExportacionPage";
import { ImportacionPage } from "./control/ImportacionPage";
import { LayoutControlEscolar } from "./control/LayoutControlEscolar";
import { OfertaPage } from "./control/OfertaPage";
import { PeriodoPage } from "./control/PeriodoPage";
import { Proximamente } from "./control/Proximamente";
import { RevisarFolioPage } from "./control/RevisarFolioPage";
import { SolicitudesPage } from "./control/SolicitudesPage";
import { CatalogoPage } from "./estudiante/CatalogoPage";
import { DashboardPage } from "./estudiante/DashboardPage";
import { HorarioPage } from "./estudiante/HorarioPage";
import { LayoutEstudiante } from "./estudiante/LayoutEstudiante";
import { ConfirmacionPage } from "./estudiante/ConfirmacionPage";
import { DetalleFolioPage } from "./estudiante/DetalleFolioPage";
import { HistorialPage } from "./estudiante/HistorialPage";
import { CambiarPasswordPage } from "./pages/CambiarPasswordPage";
import { InicioAdministrador, NoEncontrada } from "./pages/Inicios";
import { LoginPage } from "./pages/LoginPage";
import { RecuperarPasswordPage } from "./pages/RecuperarPasswordPage";

// Secciones del menú de control escolar que llegan con funciones posteriores del plan.
const PROXIMAMENTE = [
  { ruta: "bitacora", titulo: "Bitácora de Auditoría", icono: "security_update_good", funcion: "F10 (notificaciones y bitácora)" },
  { ruta: "notificaciones", titulo: "Notificaciones", icono: "notifications", funcion: "F10 (notificaciones y bitácora)" },
];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/recuperar-password" element={<RecuperarPasswordPage />} />

      {/* Con sesión iniciada */}
      <Route element={<RutaProtegida />}>
        <Route path="/cambiar-password" element={<CambiarPasswordPage />} />
        <Route path="/" element={<RedirigirPorRol />} />

        {/* Portal del estudiante con su propio marco (stitch/sabe_estudiantes) */}
        <Route element={<RutaProtegida roles={["estudiante"]} />}>
          <Route path="/estudiante" element={<LayoutEstudiante />}>
            <Route index element={<DashboardPage />} />
            <Route path="horario" element={<HorarioPage />} />
            <Route path="catalogo" element={<CatalogoPage />} />
            <Route path="confirmacion" element={<ConfirmacionPage />} />
            <Route path="historial" element={<HistorialPage />} />
            <Route path="historial/:id" element={<DetalleFolioPage />} />
          </Route>
        </Route>

        {/* Control escolar con el marco de sus pantallas en stitch/ */}
        <Route element={<RutaProtegida roles={["control_escolar"]} />}>
          <Route path="/control-escolar" element={<LayoutControlEscolar />}>
            <Route index element={<Navigate to="solicitudes" replace />} />
            <Route path="solicitudes" element={<SolicitudesPage />} />
            <Route path="solicitudes/:id" element={<RevisarFolioPage />} />
            <Route path="oferta" element={<OfertaPage />} />
            <Route path="periodo" element={<PeriodoPage />} />
            <Route path="importacion" element={<ImportacionPage />} />
            <Route path="exportacion" element={<ExportacionPage />} />
            {PROXIMAMENTE.map((p) => (
              <Route key={p.ruta} path={p.ruta} element={<Proximamente {...p} />} />
            ))}
          </Route>
        </Route>

        <Route element={<Layout />}>
          <Route element={<RutaProtegida roles={["administrador"]} />}>
            <Route path="/administrador" element={<InicioAdministrador />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  );
}
