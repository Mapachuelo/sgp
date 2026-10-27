import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
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

const toastOptions = {
  style: {
    background: '#ffffff',
    border: '1px solid #e2e1db',
    borderRadius: '8px',
    color: '#161716',
    boxShadow: '0 16px 48px rgba(22,23,22,0.14), 0 2px 8px rgba(22,23,22,0.06)',
    fontFamily: '"Archivo Variable", system-ui, sans-serif',
    fontSize: '13px',
  },
};

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
            <Route path="/empleado/agenda" element={<EmpleadoDashboard vista="agenda" />} />
            <Route path="/empleado/disponibilidad" element={<EmpleadoDisponibilidad />} />
            <Route path="/empleado/perfil" element={<EmpleadoPerfil />} />
          </Route>

          <Route element={<RutaProtegida roles={['admin']}><Layout /></RutaProtegida>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/agenda" element={<AdminDashboard seccionInicial="horarios" />} />
            <Route path="/admin/equipo" element={<AdminDashboard seccionInicial="empleados" />} />
            <Route path="/admin/servicios" element={<AdminDashboard seccionInicial="servicios" />} />
            <Route path="/admin/sedes" element={<AdminDashboard seccionInicial="sedes" />} />
            <Route path="/admin/horarios" element={<AdminDashboard seccionInicial="horarios" />} />
            <Route path="/admin/clientes" element={<AdminDashboard seccionInicial="clientes" />} />
            <Route path="/admin/reportes" element={<AdminDashboard seccionInicial="reportes" />} />
            <Route path="/admin/actividad" element={<AdminDashboard seccionInicial="logs" />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster
          position="top-right"
          theme="light"
          richColors={false}
          closeButton
          toastOptions={toastOptions}
          offset={16}
          mobileOffset={{ top: 16, bottom: 76 }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
