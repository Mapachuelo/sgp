import { Moon, Sun } from 'lucide-react';
import { useTema } from '../../hooks/use-tema.js';

export default function BotonTema({ className = '' }) {
  const { resuelto, alternar } = useTema();
  const oscuro = resuelto === 'oscuro';
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={oscuro ? 'Modo claro' : 'Modo oscuro'}
      className={`flex h-8 w-8 items-center justify-center rounded-md border border-borde text-texto-secundario transition-colors hover:bg-panel hover:text-texto-principal ${className}`}
    >
      {oscuro ? <Sun className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" /> : <Moon className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />}
    </button>
  );
}
