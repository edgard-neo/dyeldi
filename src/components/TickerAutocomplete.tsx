import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, TrendingUp } from 'lucide-react';

export interface SearchResultItem {
  ticker: string;
  name: string;
  price?: number;
  type?: string;
  sector?: string;
}

interface TickerAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectResult?: (result: SearchResultItem) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

export default function TickerAutocomplete({
  value,
  onChange,
  onSelectResult,
  placeholder = 'Digite o ticker (ex: PETR4, VALE3)...',
  className = '',
  inputClassName = '',
  autoFocus = false,
  disabled = false,
}: TickerAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup do debounce no unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    const q = query.trim().toUpperCase();
    if (!q) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/stocks/search?q=${encodeURIComponent(q)}`
      );
      const data = await res.json();

      if (data && Array.isArray(data.results)) {
        setResults(data.results);
        setIsOpen(data.results.length > 0);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    } catch {
      setResults([]);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.toUpperCase();
      onChange(val);
      setSelectedIndex(-1);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (val.trim().length >= 1) {
        debounceRef.current = setTimeout(() => {
          fetchSuggestions(val);
        }, 200);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    },
    [onChange, fetchSuggestions]
  );

  const handleFocus = useCallback(() => {
    if (value.trim().length >= 1) {
      fetchSuggestions(value);
    }
  }, [value, fetchSuggestions]);

  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      onChange(item.ticker);
      setIsOpen(false);
      setSelectedIndex(-1);
      onSelectResult?.(item);
    },
    [onChange, onSelectResult]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : results.length - 1
        );
      } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          e.preventDefault();
          handleSelect(results[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    },
    [isOpen, results, selectedIndex, handleSelect]
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />

        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className={`w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-extrabold text-slate-900 uppercase text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-60 disabled:cursor-not-allowed ${inputClassName}`}
        />

        {loading && (
          <Loader2 className="w-4 h-4 text-indigo-500 animate-spin absolute right-3 pointer-events-none" />
        )}
      </div>

      {/* Dropdown de sugestões */}
      {isOpen && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-white/[0.06] text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider flex justify-between items-center">
            <span>Sugestões B3</span>
            <span>Selecione para preencher</span>
          </div>

          <ul role="listbox">
            {results.map((item, index) => {
              const isSelected = index === selectedIndex;

              return (
                <li key={item.ticker} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 border-b border-slate-50 last:border-none transition ${
                      isSelected
                        ? 'bg-indigo-50 text-indigo-900'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="px-2 py-0.5 bg-slate-900 text-white font-extrabold text-xs rounded shrink-0 font-mono">
                        {item.ticker}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {item.name}
                        </div>
                        {item.type && (
                          <span className="text-xs text-slate-600 dark:text-zinc-400 font-medium">
                            {item.type}
                            {item.sector ? ` • ${item.sector}` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {item.price !== undefined && item.price > 0 && (
                      <div className="text-right shrink-0">
                        <div className="text-xs font-extrabold text-slate-900 flex items-center justify-end gap-1">
                          <TrendingUp className="w-3 h-3 text-emerald-500" />
                          R$ {item.price.toFixed(2)}
                        </div>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                          Cotação B3
                        </span>
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}