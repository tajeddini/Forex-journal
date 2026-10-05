import { useState, useRef, useEffect, useMemo, type KeyboardEvent } from 'react';
import { ChevronDown, Check, X, Search, Plus } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  badge?: string;
  group?: string;
  color?: string;
}

export interface MultiSelectProps {
  label?: string;
  placeholder?: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  allowCustom?: boolean;
  customPlaceholder?: string;
  error?: string;
  helperText?: string;
  className?: string;
  presets?: MultiSelectOption[];
  singleSelect?: boolean;
  disabled?: boolean;
}

export function MultiSelect({
  label,
  placeholder = 'انتخاب کنید...',
  options,
  selectedValues = [],
  onChange,
  allowCustom = true,
  customPlaceholder = 'جستجو یا تایپ مقدار جدید...',
  error,
  helperText,
  className = '',
  presets,
  singleSelect = false,
  disabled = false,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  // Combined options (existing options + any currently selected custom values)
  const allAvailableOptions = useMemo(() => {
    const list = [...options];
    selectedValues.forEach(val => {
      if (!list.some(o => o.value === val)) {
        list.push({ value: val, label: val });
      }
    });
    return list;
  }, [options, selectedValues]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allAvailableOptions;
    return allAvailableOptions.filter(
      opt =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [allAvailableOptions, search]);

  // Grouped options
  const groupedOptions = useMemo(() => {
    const groups: Record<string, MultiSelectOption[]> = {};
    filteredOptions.forEach(opt => {
      const g = opt.group || 'سایر گزینه‌ها';
      if (!groups[g]) groups[g] = [];
      groups[g].push(opt);
    });
    return groups;
  }, [filteredOptions]);

  // Toggle option selection
  const handleToggle = (value: string) => {
    if (singleSelect) {
      onChange([value]);
      setIsOpen(false);
      return;
    }

    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  // Remove a single chip
  const handleRemove = (value: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange(selectedValues.filter(v => v !== value));
  };

  // Clear all
  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  // Add custom value
  const handleAddCustom = () => {
    const clean = search.trim();
    if (!clean) return;
    if (!selectedValues.includes(clean)) {
      if (singleSelect) {
        onChange([clean]);
        setIsOpen(false);
      } else {
        onChange([...selectedValues, clean]);
      }
    }
    setSearch('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions.length === 1) {
        handleToggle(filteredOptions[0].value);
      } else if (allowCustom && search.trim()) {
        handleAddCustom();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Check if current search is already an existing option
  const isExactMatch = allAvailableOptions.some(
    o => o.value.toLowerCase() === search.trim().toLowerCase() || o.label.toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}

      {/* Main Trigger Box */}
      <div
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`
          min-h-[42px] w-full rounded-lg border px-3 py-1.5 text-sm
          bg-white dark:bg-gray-900 cursor-pointer
          flex items-center justify-between gap-2
          transition-colors duration-150 select-none
          ${isOpen ? 'ring-2 ring-blue-500 border-transparent' : ''}
          ${error ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800' : ''}
        `}
      >
        {/* Selected Items or Placeholder */}
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {selectedValues.length === 0 ? (
            <span className="text-gray-400 dark:text-gray-500 text-sm">{placeholder}</span>
          ) : (
            selectedValues.map(val => {
              const matched = allAvailableOptions.find(o => o.value === val);
              const displayLabel = matched ? matched.label : val;
              return (
                <span
                  key={val}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 animate-in fade-in duration-100"
                >
                  <span className="truncate max-w-[160px]">{displayLabel}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => handleRemove(val, e)}
                      className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded p-0.5 text-blue-500 hover:text-blue-700 dark:hover:text-blue-200 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              );
            })
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0 text-gray-400">
          {selectedValues.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClearAll}
              title="پاک کردن همه"
              className="p-1 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''}`}
          />
        </div>
      </div>

      {/* Preset Pills (Quick 1-Click Toggles) */}
      {presets && presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-[11px] text-gray-500 dark:text-gray-400 select-none">پیش‌فرض‌ها:</span>
          {presets.map(preset => {
            const isSelected = selectedValues.includes(preset.value);
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => !disabled && handleToggle(preset.value)}
                className={`
                  text-xs px-2.5 py-0.5 rounded-full border transition-all duration-150 font-medium
                  ${isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }
                `}
              >
                {isSelected ? `✓ ${preset.label}` : `+ ${preset.label}`}
              </button>
            );
          })}
        </div>
      )}

      {/* Dropdown Popover */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Box */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="relative flex items-center">
              <Search className="absolute right-3 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={customPlaceholder}
                className="w-full pr-9 pl-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute left-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto p-1.5 divide-y divide-gray-100 dark:divide-gray-800/60">
            {/* Custom option prompt if user is typing and not matched */}
            {allowCustom && search.trim() && !isExactMatch && (
              <button
                type="button"
                onClick={handleAddCustom}
                className="w-full mb-1 flex items-center justify-between p-2 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن گزینه سفارشی: «{search.trim()}»</span>
                </div>
                <span className="text-[10px] bg-blue-200 dark:bg-blue-800 px-1.5 py-0.5 rounded">Enter ↵</span>
              </button>
            )}

            {Object.keys(groupedOptions).length === 0 && !search.trim() ? (
              <div className="py-6 text-center text-xs text-gray-400">
                هیچ گزینه‌ای موجود نیست
              </div>
            ) : null}

            {Object.entries(groupedOptions).map(([groupName, groupOpts]) => (
              <div key={groupName} className="py-1">
                {Object.keys(groupedOptions).length > 1 && (
                  <div className="px-2 py-1 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {groupName}
                  </div>
                )}
                <div className="space-y-0.5">
                  {groupOpts.map(opt => {
                    const isSelected = selectedValues.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleToggle(opt.value)}
                        className={`
                          w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors text-right
                          ${isSelected
                            ? 'bg-blue-50/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }
                        `}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {/* Checkbox Icon */}
                          <div
                            className={`
                              w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors
                              ${isSelected
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                              }
                            `}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>

                          {/* Label */}
                          <span className="truncate">{opt.label}</span>
                        </div>

                        {/* Optional Badge */}
                        {opt.badge && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-normal">
                            {opt.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer with status summary and quick selection */}
          <div className="p-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              {selectedValues.length === 0
                ? 'موردی انتخاب نشده'
                : `${selectedValues.length} مورد انتخاب شده`}
            </span>
            <div className="flex items-center gap-2">
              {selectedValues.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:underline"
                >
                  پاک کردن
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                تایید
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>}
    </div>
  );
}
