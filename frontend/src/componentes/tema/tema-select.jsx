import { useTema } from '../../hooks/use-tema.js';

export default function TemaSelect({ className = '', label = 'Tema' }) {
  const { preferencia, setTema } = useTema();
  return (
    <label className={`inline-flex items-center gap-1.5 text-[11px] text-tenue ${className}`}>
      <span className="sr-only">{label}</span>
      <select
        value={preferencia}
        onChange={(e) => setTema(e.target.value)}
        aria-label={label}
        className="h-8 rounded-md border border-borde bg-superficie px-1.5 text-[11px] text-texto-secundario focus:border-acento focus:outline-none focus:ring-2 focus:ring-acento/20"
      >
        <option value="sistema">Sistema</option>
        <option value="claro">Claro</option>
        <option value="oscuro">Oscuro</option>
      </select>
    </label>
  );
}
