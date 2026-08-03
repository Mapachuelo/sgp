import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexto/auth-context';
import Layout from './componentes/layout';
import RutaProtegida from './componentes/ruta-protegida';
import LoginPage from './funcionalidades/auth/login-page';
import RegistroPage from './funcionalidades/auth/registro-page';
import VerificarPage from './funcionalidades/auth/verificar-page';
import ClienteDashboard from './funcionalidades/cliente/cliente-dashboard';
import NuevaReserva from './funcionalidades/cliente/nueva-reserva';
import MiPerfil from './funcionalidades/cliente/mi-perfil';
import EmpleadoDashboard from './funcionalidades/empleado/empleado-dashboard';
import EmpleadoDisponibilidad from './funcionalidades/empleado/mi-disponibilidad';
import EmpleadoPerfil from './funcionalidades/empleado/mi-perfil';
import AdminDashboard from './funcionalidades/admin/admin-dashboard';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegistroPage />} />
          <Route path="/verificar" element={<VerificarPage />} />

          <Route element={<RutaProtegida roles={['cliente']}><Layout /></RutaProtegida>}>
            <Route path="/cliente" element={<ClienteDashboard />} />
            <Route path="/cliente/reservar" element={<NuevaReserva />} />
            <Route path="/cliente/perfil" element={<MiPerfil />} />
          </Route>

          <Route element={<RutaProtegida roles={['empleado']}><Layout /></RutaProtegida>}>
            <Route path="/empleado" element={<EmpleadoDashboard />} />
            <Route path="/empleado/disponibilidad" element={<EmpleadoDisponibilidad />} />
            <Route path="/empleado/perfil" element={<EmpleadoPerfil />} />
          </Route>

          <Route element={<RutaProtegida roles={['admin']}><Layout /></RutaProtegida>}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
