import { useEffect, useRef, useState, useCallback } from 'react';

export default function useWebSocket() {
  const [ultimoEvento, setUltimoEvento] = useState(null);
  const [conectado, setConectado] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConectado(true);
    ws.onclose = () => setConectado(false);
    ws.onerror = () => setConectado(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setUltimoEvento(data);
      } catch {
        // ignorar mensajes no JSON
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const enviar = useCallback((datos) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(datos));
    }
  }, []);

  return { ultimoEvento, conectado, enviar };
}
