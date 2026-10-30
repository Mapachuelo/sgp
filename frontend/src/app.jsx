import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexto/auth-context';
import { useTema } from './hooks/use-tema.js';
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
import MisServicios from './funcionalidades/empleado/mis-servicios';
import AdminDashboard from './funcionalidades/admin/admin-dashboard';
import EmpleadosSeccion from './funcionalidades/admin/secciones/empleados-seccion';
import ServiciosSeccion from './funcionalidades/admin/secciones/servicios-seccion';
import SedesSeccion from './funcionalidades/admin/secciones/sedes-seccion';
import HorariosSeccion from './funcionalidades/admin/secciones/horarios-seccion';
import ReportesSeccion from './funcionalidades/admin/secciones/reportes-seccion';
import ClientesSeccion from './funcionalidades/admin/secciones/clientes-seccion';
import LogsSeccion from './funcionalidades/admin/secciones/logs-seccion';
import PresentacionSeccion from './funcionalidades/admin/secciones/presentacion-seccion';
import PresentacionPage from './funcionalidades/presentacion/presentacion-page';

const toastOptions = {
  style: {
    background: 'var(--color-superficie)',
    border: '1px solid var(--color-borde)',
    borderRadius: '8px',
    color: 'var(--color-texto-principal)',
    boxShadow: 'var(--shadow-float)',
    fontFamily: '"Archivo Variable", system-ui, sans-serif',
    fontSize: '13px',
  },
};

export default function App() {
  const { tema } = useTema();
  const sonnerTheme = tema === 'oscuro' ? 'dark' : 'light';

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<PresentacionPage />} />
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
            <Route path="/empleado/servicios" element={<MisServicios />} />
            <Route path="/empleado/perfil" element={<EmpleadoPerfil />} />
          </Route>

          <Route element={<RutaProtegida roles={['admin']}><Layout /></RutaProtegida>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/agenda" element={<HorariosSeccion />} />
            <Route path="/admin/equipo" element={<EmpleadosSeccion />} />
            <Route path="/admin/servicios" element={<ServiciosSeccion />} />
            <Route path="/admin/presentacion" element={<PresentacionSeccion />} />
            <Route path="/admin/sedes" element={<SedesSeccion />} />
            <Route path="/admin/horarios" element={<HorariosSeccion />} />
            <Route path="/admin/clientes" element={<ClientesSeccion />} />
            <Route path="/admin/reportes" element={<ReportesSeccion />} />
            <Route path="/admin/actividad" element={<LogsSeccion />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster
          position="top-right"
          theme={sonnerTheme}
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
