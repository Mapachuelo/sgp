import { useEffect, useState } from 'react';
import {
  PAISES_TELEFONO,
  construirTelefono,
  obtenerPais,
  separarTelefono,
} from '../../lib/telefonos.js';

export default function CampoTelefono({
  label = 'Telefono',
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
      <label htmlFor={`${name}-numero`} className="block text-xs font-semibold text-texto-principal uppercase mb-1">
        {label}
      </label>
      <div className="flex gap-2">
        <select
          aria-label="Pais del telefono"
          value={codigoPais}
          onChange={(e) => cambiarPais(e.target.value)}
          disabled={disabled}
          className="w-[42%] sm:w-[45%] px-2 py-2 border border-borde rounded-lg text-xs bg-fondo/20 focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario transition disabled:opacity-60"
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
          placeholder={pais.codigo === 'CO' ? '300 123 4567' : 'Numero local'}
          className="flex-1 min-w-0 px-3 py-2 border border-borde rounded-lg text-sm bg-fondo/20 focus:outline-none focus:ring-2 focus:ring-primario/30 focus:border-primario transition disabled:opacity-60"
        />
      </div>
      {error ? (
        <p className="text-[11px] text-error mt-1">{error}</p>
      ) : (
        <p className="text-[11px] text-texto-secundario mt-1">
          {pais.prefijo} · {longitudSugerida} digitos. Colombia (+57) se selecciona por defecto.
        </p>
      )}
    </div>
  );
}
