import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const TemaContext = createContext(null);
const CLAVE = 'sgp_tema';
const CONSULTA_SISTEMA = '(prefers-color-scheme: dark)';

function leerPreferencia() {
  try {
    const valor = localStorage.getItem(CLAVE);
    return ['claro', 'oscuro', 'sistema'].includes(valor) ? valor : 'sistema';
  } catch {
    return 'sistema';
  }
}

function sistemaOscuro() {
  return typeof window !== 'undefined' && window.matchMedia(CONSULTA_SISTEMA).matches;
}

export function TemaProvider({ children }) {
  const [preferencia, setPreferencia] = useState(leerPreferencia);
  const [sistemaEsOscuro, setSistemaEsOscuro] = useState(sistemaOscuro);

  useEffect(() => {
    const media = window.matchMedia(CONSULTA_SISTEMA);
    const alCambiar = (evento) => setSistemaEsOscuro(evento.matches);
    media.addEventListener('change', alCambiar);
    return () => media.removeEventListener('change', alCambiar);
  }, []);

  const resuelto = preferencia === 'sistema' ? (sistemaEsOscuro ? 'oscuro' : 'claro') : preferencia;

  useEffect(() => {
    const oscuro = resuelto === 'oscuro';
    const raiz = document.documentElement;
    raiz.dataset.theme = oscuro ? 'dark' : 'light';
    raiz.style.colorScheme = oscuro ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#0f100f' : '#f1f1ee');
    try {
      localStorage.setItem(CLAVE, preferencia);
    } catch {
      /* almacenamiento no disponible */
    }
  }, [preferencia, resuelto]);

  const setTema = useCallback((nuevo) => {
    if (['claro', 'oscuro', 'sistema'].includes(nuevo)) setPreferencia(nuevo);
  }, []);

  const alternar = useCallback(() => {
    setPreferencia((actual) => {
      const actualResuelto = actual === 'sistema' ? (sistemaEsOscuro ? 'oscuro' : 'claro') : actual;
      return actualResuelto === 'oscuro' ? 'claro' : 'oscuro';
    });
  }, [sistemaEsOscuro]);

  const valor = useMemo(
    () => ({ preferencia, resuelto, tema: resuelto, setTema, alternar }),
    [preferencia, resuelto, setTema, alternar]
  );

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

export function useTemaContext() {
  const contexto = useContext(TemaContext);
  if (!contexto) throw new Error('useTema debe usarse dentro de TemaProvider');
  return contexto;
}
