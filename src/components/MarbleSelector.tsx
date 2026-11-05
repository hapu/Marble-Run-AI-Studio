import React from 'react';
import { RotateCcw } from 'lucide-react';
import { MarbleColorDef } from '../types';

interface MarbleSelectorProps {
  colors: MarbleColorDef[];
  selectedIds: string[];
  customNames: Record<string, string>;
  onToggleSelect: (id: string) => void;
  onNameChange: (id: string, newName: string) => void;
  onSelectAll: () => void;
  onResetNames: () => void;
}

export const MarbleSelector: React.FC<MarbleSelectorProps> = ({
  colors,
  selectedIds,
  customNames,
  onToggleSelect,
  onNameChange,
  onSelectAll,
  onResetNames,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
          Canicas ({selectedIds.length} / {colors.length})
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetNames}
            className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-0.5 transition-colors"
            title="Restablecer nombres originales en español"
          >
            <RotateCcw size={10} />
            <span>Nombres</span>
          </button>
          <span className="text-slate-600">·</span>
          <button
            type="button"
            onClick={onSelectAll}
            className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            {selectedIds.length === colors.length ? 'Mínimo 4' : 'Todas'}
          </button>
        </div>
      </div>

      <div className="space-y-1.5 max-h-[290px] overflow-y-auto pr-1">
        {colors.map((item) => {
          const isSelected = selectedIds.includes(item.id);
          const currentName = customNames[item.id] ?? item.name;

          return (
            <div
              key={item.id}
              className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all ${
                isSelected
                  ? 'bg-slate-800/80 border-slate-700/80 shadow-sm'
                  : 'bg-slate-950/40 border-slate-800/40 opacity-60'
              }`}
            >
              {/* Checkbox & Swatch toggle */}
              <button
                type="button"
                onClick={() => onToggleSelect(item.id)}
                className="flex items-center gap-1.5 shrink-0 group focus:outline-none"
                title={isSelected ? 'Desactivar canica' : 'Activar canica'}
              >
                <span
                  className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-bold border transition-colors ${
                    isSelected
                      ? 'bg-amber-500 border-amber-400 text-slate-950'
                      : 'bg-slate-900 border-slate-700 text-transparent'
                  }`}
                >
                  ✓
                </span>
                <span
                  className="w-4 h-4 rounded-full shrink-0 shadow-sm transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: item.color,
                    border: item.border ? `1.5px solid ${item.border}` : '1px solid rgba(255,255,255,0.25)',
                  }}
                />
              </button>

              {/* Editable Name Input */}
              <input
                type="text"
                value={currentName}
                onChange={(e) => onNameChange(item.id, e.target.value)}
                placeholder={item.name}
                maxLength={24}
                className="flex-1 bg-slate-900/90 border border-slate-700/70 focus:border-amber-500 rounded px-2 py-1 text-[11px] font-medium text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
                title="Editar nombre de la canica"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
