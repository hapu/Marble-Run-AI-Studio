import React from 'react';
import { Trophy, CheckCircle2 } from 'lucide-react';
import { Marble } from '../types';

interface LeaderboardProps {
  standings: Marble[];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ standings }) => {
  return (
    <div className="space-y-2 pt-2 border-t border-slate-800/80">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
          <Trophy size={12} className="text-amber-400" />
          <span>Clasificación en Vivo</span>
        </span>
        <span className="text-[10px] text-slate-500">Puntos de control</span>
      </div>

      <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
        {standings.map((m) => {
          const isFirst = m.rank === 1;
          const isSecond = m.rank === 2;
          const isThird = m.rank === 3;

          return (
            <div
              key={m.id}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors ${
                isFirst
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                  : isSecond
                  ? 'bg-slate-800/60 border-slate-700/60 text-slate-200'
                  : isThird
                  ? 'bg-amber-950/20 border-amber-900/40 text-amber-300/90'
                  : 'bg-slate-950/40 border-slate-800/60 text-slate-400'
              }`}
            >
              <span
                className={`font-mono font-extrabold w-4 text-center ${
                  isFirst ? 'text-amber-400 font-black' : 'text-slate-400'
                }`}
              >
                {m.rank}
              </span>

              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                style={{
                  backgroundColor: m.color,
                  border: m.border ? `1px solid ${m.border}` : '1px solid rgba(255,255,255,0.2)',
                }}
              />

              <span className="font-semibold text-white truncate flex-1" title={m.name}>
                {m.name}
              </span>

              <span className="font-mono text-[10px] text-slate-400 shrink-0">
                {m.finished ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                    <CheckCircle2 size={11} /> FIN
                  </span>
                ) : (
                  `Etapa ${Math.min(11, Math.floor(m.currentCheckpointIdx / 3) + 1)}`
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
