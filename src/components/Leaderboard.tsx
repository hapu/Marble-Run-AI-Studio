import React from 'react';
import { Skull, ShieldCheck, Heart, Zap } from 'lucide-react';
import { Marble } from '../types';
import { WEAPON_SPECS } from '../constants';

interface LeaderboardProps {
  standings: Marble[];
  followedMarbleId?: string | null;
  onFollowMarble?: (id: string) => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  standings,
  followedMarbleId,
  onFollowMarble,
}) => {
  const playerMarbles = standings.filter((m) => !m.id.startsWith('npc_'));
  const livingHumans = playerMarbles.filter((m) => !m.isZombie && !m.finished).length;
  const extracted = playerMarbles.filter((m) => m.isExtracted).length;
  const totalActiveZombies = standings.filter((m) => m.isZombie && !m.gone).length;

  return (
    <div className="space-y-2 pt-2 border-t border-slate-800/80">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
          <Skull size={12} className="text-lime-400" />
          <span>Supervivencia ({livingHumans + extracted} H · {totalActiveZombies} Z)</span>
        </span>
        <span className="text-[10px] text-slate-500 font-mono">Estado / Bajas</span>
      </div>

      <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
        {playerMarbles.map((m) => {
          const wSpec = WEAPON_SPECS[m.weaponType || 'blaster'] || WEAPON_SPECS.blaster;
          const isFollowed = followedMarbleId === m.id;
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => onFollowMarble?.(m.id)}
              className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors ${
                isFollowed
                  ? 'ring-1 ring-white/80 border-white/60 bg-slate-800/90 text-white'
                  : m.isExtracted
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200 hover:bg-amber-500/15'
                  : m.isZombie
                  ? 'bg-lime-950/30 border-lime-800/50 text-lime-300 hover:bg-lime-950/50'
                  : 'bg-slate-900/60 border-slate-700/60 text-slate-200 hover:bg-slate-800/70'
              }`}
              title="Haz clic para seguir esta canica"
            >
              <span className="font-mono font-bold w-4 text-center text-slate-400 text-[10px]">
                {m.rank}
              </span>

              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                style={{
                  backgroundColor: m.isZombie ? '#166534' : m.color,
                  border: m.isZombie
                    ? '1.5px solid #4ade80'
                    : m.border
                    ? `1px solid ${m.border}`
                    : '1px solid rgba(255,255,255,0.2)',
                }}
              />

              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-white truncate text-[11px]" title={m.name}>
                    {m.name}
                  </span>
                  <span className="font-mono text-[9.5px] tabular-nums shrink-0">
                    {m.isExtracted ? (
                      <span className="text-amber-400 font-bold flex items-center gap-0.5">
                        <ShieldCheck size={11} /> SALVADO
                      </span>
                    ) : m.isZombie ? (
                      <span className="text-lime-400 font-semibold flex items-center gap-0.5">
                        <Skull size={10} /> {m.kills || 0} bajas
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-amber-300 font-mono">
                          {wSpec.icon} {wSpec.name}
                        </span>
                        <span className="text-cyan-400 font-bold flex items-center gap-0.5">
                          <Heart size={10} className="text-red-400 fill-red-400" /> {m.hp}/5
                        </span>
                      </div>
                    )}
                  </span>
                </div>

                {!m.isZombie && !m.finished && (
                  <div className="flex items-center justify-between gap-1 mt-1">
                    <div className="flex items-center gap-1 flex-1">
                      {[0, 1, 2, 3, 4].map((pip) => (
                        <div
                          key={pip}
                          className={`h-1.5 flex-1 rounded-sm transition-all ${
                            pip < m.hp
                              ? m.hp > 2
                                ? 'bg-cyan-400 shadow-[0_0_4px_rgba(56,189,248,0.5)]'
                                : m.hp === 2
                                ? 'bg-amber-400'
                                : 'bg-red-500'
                              : 'bg-slate-800/80 border border-red-500/30'
                          }`}
                        />
                      ))}
                    </div>
                    {m.shield > 0 && (
                      <span className="text-[9px] text-cyan-300 font-mono font-semibold flex items-center gap-0.5 ml-1">
                        <Zap size={9} className="text-cyan-400" /> {m.shield}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
