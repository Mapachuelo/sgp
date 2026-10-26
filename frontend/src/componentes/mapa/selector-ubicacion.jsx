import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const iconoMarcador = new L.DivIcon({
  html: `<div style="display: flex; justify-content: center; align-items: center; width: 30px; height: 30px;">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#B84C3D" stroke-width="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#F5E6E3"/>
      <circle cx="12" cy="10" r="3" fill="#B84C3D"/>
    </svg>
  </div>`,
  className: 'custom-leaflet-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

const CENTRO_BOGOTA = [4.60971, -74.08175];

function redondear(valor) {
  return Number(Number(valor).toFixed(6));
}

function ClicksMapa({ onCambio }) {
  useMapEvents({
    click(evento) {
      onCambio(redondear(evento.latlng.lat), redondear(evento.latlng.lng));
    },
  });
  return null;
}

function AjustarMapa({ lat, lng }) {
  const map = useMap();

  useEffect(() => {
    const temporizador = setTimeout(() => map.invalidateSize(), 150);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      map.setView([lat, lng], Math.max(map.getZoom(), 15));
    }
    return () => clearTimeout(temporizador);
  }, [lat, lng, map]);

  return null;
}

export default function SelectorUbicacion({ latitud, longitud, onChange }) {
  const lat = Number(latitud);
  const lng = Number(longitud);
  const tieneUbicacion =
    latitud !== '' && longitud !== '' && Number.isFinite(lat) && Number.isFinite(lng);
  const centro = tieneUbicacion ? [lat, lng] : CENTRO_BOGOTA;
  const [mensaje, setMensaje] = useState('');

  const cambiar = (nuevaLat, nuevaLng) => {
    setMensaje('');
    onChange?.(redondear(nuevaLat), redondear(nuevaLng));
  };

  const usarMiUbicacion = () => {
    if (!navigator.geolocation) {
      setMensaje('Tu navegador no permite obtener la ubicacion.');
      return;
    }
    setMensaje('Obteniendo ubicacion...');
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        cambiar(posicion.coords.latitude, posicion.coords.longitude);
        setMensaje('Ubicacion obtenida. Ajusta el marcador si es necesario.');
      },
      () => setMensaje('No se pudo obtener la ubicacion. Selecciona el punto en el mapa.'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-xs font-semibold text-texto-principal uppercase">
          Ubicacion de la sede
        </label>
        <button
          type="button"
          onClick={usarMiUbicacion}
          className="px-3 py-1.5 rounded-lg border border-borde bg-superficie text-xs font-semibold text-primario hover:bg-fondo transition cursor-pointer"
        >
          Usar mi ubicacion
        </button>
      </div>
      <div className="h-64 rounded-xl border border-borde overflow-hidden relative z-0 isolate bg-fondo">
        <MapContainer
          center={centro}
          zoom={tieneUbicacion ? 16 : 12}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {tieneUbicacion && (
            <Marker
              position={[lat, lng]}
              icon={iconoMarcador}
              draggable
              eventHandlers={{
                dragend: (evento) => {
                  const punto = evento.target.getLatLng();
                  cambiar(punto.lat, punto.lng);
                },
              }}
            />
          )}
          <ClicksMapa onCambio={cambiar} />
          <AjustarMapa lat={tieneUbicacion ? lat : NaN} lng={tieneUbicacion ? lng : NaN} />
        </MapContainer>
      </div>
      <p className="text-[11px] text-texto-secundario">
        Haz clic en el mapa o arrastra el marcador para fijar las coordenadas. La latitud y longitud se llenan automaticamente.
      </p>
      {mensaje && <p className="text-[11px] text-info">{mensaje}</p>}
    </div>
  );
}
