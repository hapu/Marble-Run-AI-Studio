import React from 'react';
import { Film, ShieldAlert, Skull, Trophy } from 'lucide-react';
import { Marble } from '../types';

interface ResultsModalProps {
  winnerModal: Marble;
  extractedHumansCount: number;
  seed: string;
  totalKillsCount: number;
  hudTime: string;
  deadliestRoomText: string;
  onStartHighlightReplay: () => void;
  onDismissSummary: () => void;
  onNewRace: () => void;
}

export const ResultsModal: React.FC<ResultsModalProps> = ({
  winnerModal,
  extractedHumansCount,
  seed,
  totalKillsCount,
  hudTime,
  deadliestRoomText,
  onStartHighlightReplay,
  onDismissSummary,
  onNewRace,
}) => {
  const isZombieVictory = extractedHumansCount === 0 && Boolean(winnerModal.isZombie);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className={`border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 ${
          isZombieVictory
            ? 'bg-slate-950 border-emerald-500/60 shadow-[0_0_40px_rgba(34,197,94,0.3)]'
            : 'bg-slate-900 border-amber-500/60 shadow-[0_0_40px_rgba(245,158,11,0.3)]'
        }`}
      >
        <div className="text-center space-y-2">
          <div
            className={`inline-flex p-3 rounded-full border ${
              isZombieVictory
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
            }`}
          >
            {isZombieVictory ? <Skull size={34} /> : <Trophy size={34} />}
          </div>
          <h2 className="text-xl font-black text-white">
            {isZombieVictory
              ? '¡CONTAGIO TOTAL: VICTORIA ZOMBI!'
              : `¡SUPERVIVENCIA COMPLETADA (${extractedHumansCount} SALVADOS)!`}
          </h2>
          <p className="text-xs text-slate-300">
            Líder: <strong className="text-amber-300">{winnerModal.name}</strong> · Semilla{' '}
            <span className="font-mono text-cyan-300">{seed}</span>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs">
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Rescatados</div>
            <div className="font-mono font-bold text-amber-400 text-sm">{extractedHumansCount}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Zombis Abatidos</div>
            <div className="font-mono font-bold text-cyan-400 text-sm">{totalKillsCount}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Tiempo</div>
            <div className="font-mono font-bold text-white text-sm">{hudTime.split(' / ')[0]}</div>
          </div>
        </div>

        <div className="bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-800 text-[11px] flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1">
            <ShieldAlert size={12} className="text-rose-400" />
            <span>Sala más letal:</span>
          </span>
          <span className="font-semibold text-rose-300 truncate max-w-[220px]">{deadliestRoomText}</span>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={onStartHighlightReplay}
            className="flex-1 min-w-[130px] py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Film size={14} />
            <span>Ver Highlights</span>
          </button>
          <button
            type="button"
            onClick={onDismissSummary}
            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Seguir Viendo
          </button>
          <button
            type="button"
            onClick={onNewRace}
            className="flex-1 min-w-[120px] py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition-colors"
          >
            Nueva Partida
          </button>
        </div>
      </div>
    </div>
  );
};
