import { Route, Routes } from "react-router-dom";
import { RedirigirPorRol, RutaProtegida } from "./auth/RutaProtegida";
import { Layout } from "./components/Layout";
import { CambiarPasswordPage } from "./pages/CambiarPasswordPage";
import { InicioAdministrador, InicioControlEscolar, InicioEstudiante, NoEncontrada } from "./pages/Inicios";
import { LoginPage } from "./pages/LoginPage";
import { RecuperarPasswordPage } from "./pages/RecuperarPasswordPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/recuperar-password" element={<RecuperarPasswordPage />} />

      {/* Con sesión iniciada */}
      <Route element={<RutaProtegida />}>
        <Route path="/cambiar-password" element={<CambiarPasswordPage />} />
        <Route path="/" element={<RedirigirPorRol />} />

        <Route element={<Layout />}>
          <Route element={<RutaProtegida roles={["estudiante"]} />}>
            <Route path="/estudiante" element={<InicioEstudiante />} />
          </Route>
          <Route element={<RutaProtegida roles={["control_escolar"]} />}>
            <Route path="/control-escolar" element={<InicioControlEscolar />} />
          </Route>
          <Route element={<RutaProtegida roles={["administrador"]} />}>
            <Route path="/administrador" element={<InicioAdministrador />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  );
}
