import { createContext, useState, useEffect, useCallback } from 'react';
import api from '../api/cliente';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargarUsuario = useCallback(async () => {
    const token = localStorage.getItem('sgp_token');
    if (!token) {
      setCargando(false);
      return;
    }
    try {
      const data = await api.auth.me();
      setUsuario(data);
    } catch {
      localStorage.removeItem('sgp_token');
      localStorage.removeItem('sgp_usuario');
      setUsuario(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarUsuario();
  }, [cargarUsuario]);

  const login = async (email, password) => {
    const data = await api.auth.login({ email, password });
    localStorage.setItem('sgp_token', data.token);
    localStorage.setItem('sgp_usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data;
  };

  const register = async (datos) => {
    const data = await api.auth.register(datos);
    localStorage.setItem('sgp_token', data.token);
    localStorage.setItem('sgp_usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('sgp_token');
    localStorage.removeItem('sgp_usuario');
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, register, logout, setUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}
