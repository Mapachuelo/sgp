import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/cliente.js';
import { TRADUCCIONES_EN } from './diccionario.js';

const I18nContext = createContext({ idioma: 'es', setIdioma: () => {} });

const ATRIBUTOS = ['placeholder', 'title', 'aria-label'];

function traducirTexto(texto, idioma) {
  if (idioma !== 'en') return texto;
  const clave = texto.trim();
  if (!clave) return texto;
  const traduccion = TRADUCCIONES_EN[clave];
  if (!traduccion) return texto;
  return texto.replace(clave, traduccion);
}

function traducirNodo(raiz, idioma) {
  if (!raiz) return;
  const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode: (nodo) =>
      nodo.parentElement && ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(nodo.parentElement.tagName)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  const textos = [];
  while (walker.nextNode()) textos.push(walker.currentNode);
  textos.forEach((nodo) => {
    const traducido = traducirTexto(nodo.nodeValue, idioma);
    if (traducido !== nodo.nodeValue) nodo.nodeValue = traducido;
  });
  raiz.querySelectorAll?.('[placeholder], [title], [aria-label]').forEach((el) => {
    ATRIBUTOS.forEach((attr) => {
      const valor = el.getAttribute(attr);
      if (!valor) return;
      const traducido = traducirTexto(valor, idioma);
      if (traducido !== valor) el.setAttribute(attr, traducido);
    });
  });
}

export function I18nProvider({ children }) {
  const [idioma, setEstadoIdioma] = useState(() => localStorage.getItem('sgp_idioma') || 'es');

  const setIdioma = (nuevo) => {
    localStorage.setItem('sgp_idioma', nuevo);
    api.preferencias.update({ idioma: nuevo }).catch(() => {});
    window.location.reload();
  };

  useEffect(() => {
    document.documentElement.lang = idioma;
  }, [idioma]);

  useEffect(() => {
    const token = localStorage.getItem('sgp_token');
    if (token && !sessionStorage.getItem('sgp_idioma_sync')) {
      sessionStorage.setItem('sgp_idioma_sync', '1');
      api.preferencias
        .get()
        .then((prefs) => {
          if (prefs?.idioma && prefs.idioma !== idioma) {
            localStorage.setItem('sgp_idioma', prefs.idioma);
            window.location.reload();
          }
        })
        .catch(() => {});
    }
  }, [idioma]);

  useEffect(() => {
    if (idioma !== 'en') return;
    traducirNodo(document.body, idioma);
    const observer = new MutationObserver(() => traducirNodo(document.body, idioma));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [idioma]);

  return (
    <I18nContext.Provider value={{ idioma, setIdioma }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
