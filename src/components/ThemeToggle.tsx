import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export const ThemeToggle: React.FC = () => {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer flex items-center justify-center relative"
      title={resolvedTheme === 'dark' ? 'Mudar para Modo Claro' : 'Mudar para Modo Noturno'}
      aria-label="Alternar tema da aplicação"
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
      ) : (
        <Moon className="w-4 h-4 text-indigo-300" />
      )}
    </button>
  );
};

export default ThemeToggle;
