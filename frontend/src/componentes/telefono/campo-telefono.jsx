import { useEffect, useState } from 'react';
import {
  PAISES_TELEFONO,
  construirTelefono,
  obtenerPais,
  separarTelefono,
} from '../../lib/telefonos.js';

export default function CampoTelefono({
  label = 'Teléfono',
  value = '',
  onChange,
  name = 'telefono',
  required = false,
  disabled = false,
  error = '',
  autoComplete = 'tel',
}) {
  const inicial = separarTelefono(value);
  const [codigoPais, setCodigoPais] = useState(inicial.pais.codigo);
  const [numero, setNumero] = useState(inicial.numero);

  useEffect(() => {
    const actual = separarTelefono(value);
    setCodigoPais(actual.pais.codigo);
    setNumero(actual.numero);
  }, [value]);

  const pais = obtenerPais(codigoPais);
  const maxDigitos = pais.longitud || 15 - pais.prefijo.replace('+', '').length;
  const longitudSugerida = pais.longitud || maxDigitos;

  const emitir = (siguientePais, siguienteNumero) => {
    onChange?.(construirTelefono(siguientePais, siguienteNumero), {
      pais: siguientePais,
      numero: siguienteNumero,
    });
  };

  const cambiarPais = (codigo) => {
    const siguiente = obtenerPais(codigo);
    const recortado = numero.slice(0, 15 - siguiente.prefijo.replace('+', '').length);
    setCodigoPais(codigo);
    setNumero(recortado);
    emitir(siguiente, recortado);
  };

  const cambiarNumero = (texto) => {
    const soloDigitos = texto.replace(/\D/g, '').slice(0, maxDigitos);
    setNumero(soloDigitos);
    emitir(pais, soloDigitos);
  };

  const pegarNumero = (evento) => {
    const texto = evento.clipboardData?.getData('text') || '';
    if (!texto.startsWith('+')) return;
    evento.preventDefault();
    const separado = separarTelefono(texto);
    const maximo = separado.pais.longitud || 15 - separado.pais.prefijo.replace('+', '').length;
    const recortado = separado.numero.slice(0, maximo);
    setCodigoPais(separado.pais.codigo);
    setNumero(recortado);
    emitir(separado.pais, recortado);
  };

  return (
    <div>
      <label htmlFor={`${name}-numero`} className="mb-1.5 block text-xs font-medium text-texto-principal">
        {label}
      </label>
      <div className="flex gap-2">
        <select
          aria-label="País del teléfono"
          value={codigoPais}
          onChange={(e) => cambiarPais(e.target.value)}
          disabled={disabled}
          className="h-10 w-[44%] min-w-0 rounded-md border border-control bg-superficie px-2 text-xs text-texto-principal transition-colors focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20 disabled:bg-panel disabled:text-tenue sm:w-[45%]"
        >
          {PAISES_TELEFONO.map((opcion) => (
            <option key={opcion.codigo} value={opcion.codigo}>
              {opcion.nombre} ({opcion.prefijo})
            </option>
          ))}
        </select>
        <input
          id={`${name}-numero`}
          name={name}
          type="tel"
          inputMode="numeric"
          autoComplete={autoComplete}
          value={numero}
          onChange={(e) => cambiarNumero(e.target.value)}
          onPaste={pegarNumero}
          required={required}
          disabled={disabled}
          placeholder={pais.codigo === 'CO' ? '300 123 4567' : 'Número local'}
          className="h-10 min-w-0 flex-1 rounded-md border border-control bg-superficie px-3 text-sm text-texto-principal placeholder:text-tenue/70 transition-colors focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20 disabled:bg-panel disabled:text-tenue"
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-[11px] font-medium text-error">{error}</p>
      ) : (
        <p className="mt-1.5 text-[11px] leading-4 text-tenue">
          {pais.prefijo} · {longitudSugerida} dígitos. Colombia (+57) se selecciona por defecto.
        </p>
      )}
    </div>
  );
}
