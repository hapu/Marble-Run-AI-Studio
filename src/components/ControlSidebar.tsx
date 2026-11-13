import React from 'react';
import {
  Calendar,
  CheckCircle2,
  Link2,
  RotateCcw,
  Shuffle,
  Skull,
  SlidersHorizontal,
} from 'lucide-react';
import { Marble } from '../types';
import { DEFAULT_MARBLE_COLORS } from '../constants';
import { MarbleSelector } from './MarbleSelector';
import { Leaderboard } from './Leaderboard';

interface ControlSidebarProps {
  sidebarOpen: boolean;
  onToggleSidebar: (open: boolean) => void;
  onStartRace: (newSeed?: string, pzOverride?: number) => void;
  patientZeroCount: number;
  onSelectPatientZero: (num: number) => void;
  seed: string;
  onSeedChange: (val: string) => void;
  onRandomizeSeed: () => void;
  onDailySeed: () => void;
  onCopySeedLink: () => void;
  selectedIds: string[];
  customNames: Record<string, string>;
  onToggleSelect: (id: string) => void;
  onNameChange: (id: string, newName: string) => void;
  onSelectAll: () => void;
  onResetNames: () => void;
  standings: Marble[];
  followedMarbleId: string | null;
  onFollowMarble: (id: string) => void;
  activeChunkCount: number;
}

export const ControlSidebar: React.FC<ControlSidebarProps> = ({
  sidebarOpen,
  onToggleSidebar,
  onStartRace,
  patientZeroCount,
  onSelectPatientZero,
  seed,
  onSeedChange,
  onRandomizeSeed,
  onDailySeed,
  onCopySeedLink,
  selectedIds,
  customNames,
  onToggleSelect,
  onNameChange,
  onSelectAll,
  onResetNames,
  standings,
  followedMarbleId,
  onFollowMarble,
  activeChunkCount,
}) => {
  return (
    <>
      <button
        type="button"
        onClick={() => onToggleSidebar(!sidebarOpen)}
        className="md:hidden fixed bottom-4 right-4 z-40 bg-amber-500 text-slate-950 p-3 rounded-full shadow-2xl active:scale-95 transition-transform"
        aria-label="Abrir panel de control"
      >
        <SlidersHorizontal size={22} />
      </button>

      <aside
        className={`fixed md:static right-0 top-0 h-full w-84 bg-slate-900/95 md:bg-slate-900 border-l border-slate-800 flex flex-col z-30 transition-transform duration-300 backdrop-blur-md ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
              <span>ZOMBIE RUN</span>
              <span className="text-emerald-400 text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                LABYRINTH
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Laberinto 5×5 de Salas Cuadradas</p>
          </div>
          <button
            type="button"
            onClick={() => onToggleSidebar(false)}
            className="md:hidden text-slate-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          <button
            type="button"
            onClick={() => onStartRace()}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-amber-500 hover:from-emerald-400 hover:to-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
          >
            <RotateCcw size={16} />
            <span>Iniciar Supervivencia</span>
          </button>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1 text-emerald-400">
                <Skull size={12} />
                <span>Pacientes Cero</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">
                {patientZeroCount} {patientZeroCount === 1 ? 'Zombi' : 'Zombis'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3].map((num) => (
                <button
                  type="button"
                  key={num}
                  onClick={() => onSelectPatientZero(num)}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all ${
                    patientZeroCount === num
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {num} {num === 1 ? 'Zombi' : 'Zombis'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-semibold text-[10px] uppercase tracking-wider">Semilla Determinista</span>
              <span className="text-[10px] text-slate-500 font-mono">#URL Sync</span>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={seed}
                onChange={(e) => onSeedChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onStartRace()}
                placeholder="Semilla..."
                maxLength={20}
                className="flex-1 min-w-0 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={onRandomizeSeed}
                className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold flex items-center gap-1 transition-colors shrink-0"
                title="Semilla aleatoria"
              >
                <Shuffle size={13} className="text-amber-400" />
                <span>Azar</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={onDailySeed}
                className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors"
                title="Cargar el laberinto oficial de hoy"
              >
                <Calendar size={12} className="text-cyan-400" />
                <span>Hoy</span>
              </button>
              <button
                type="button"
                onClick={onCopySeedLink}
                className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors"
                title="Copiar enlace compartible con esta semilla"
              >
                <Link2 size={12} className="text-emerald-400" />
                <span>Copiar</span>
              </button>
            </div>
          </div>

          <MarbleSelector
            colors={DEFAULT_MARBLE_COLORS}
            selectedIds={selectedIds}
            customNames={customNames}
            onToggleSelect={onToggleSelect}
            onNameChange={onNameChange}
            onSelectAll={onSelectAll}
            onResetNames={onResetNames}
          />

          <Leaderboard
            standings={standings}
            followedMarbleId={followedMarbleId}
            onFollowMarble={onFollowMarble}
          />
        </div>

        <div className="p-3 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-400" />
            <span>Rapier2D CCD · {activeChunkCount}/25</span>
          </span>
          <span className="font-mono text-emerald-400">5×5 Laberinto</span>
        </div>
      </aside>
    </>
  );
};
