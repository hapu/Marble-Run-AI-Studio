import React from 'react';
import { Skull, ShieldCheck } from 'lucide-react';
import { Marble } from '../types';
import { WEAPON_SPECS } from '../constants';
import { HealthDisk } from './HealthDisk';

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
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
          <Skull size={14} className="text-emerald-400" />
          <span>Supervivencia ({livingHumans + extracted} vivos · {totalActiveZombies} zombis)</span>
        </span>
        <span className="text-[11px] text-slate-500">Clic para seguir</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
        {playerMarbles.map((m) => {
          const wSpec = WEAPON_SPECS[m.weaponType || 'blaster'] || WEAPON_SPECS.blaster;
          const isFollowed = followedMarbleId === m.id;
          return (
            <button
              type="button"
              key={m.id}
              onClick={() => onFollowMarble?.(m.id)}
              className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs transition-colors ${
                isFollowed
                  ? 'ring-1 ring-white/80 border-white/60 bg-slate-800/90 text-white'
                  : m.isExtracted
                    ? 'bg-amber-500/10 border-amber-500/35 text-amber-200 hover:bg-amber-500/15'
                    : m.isZombie
                      ? 'bg-lime-950/25 border-lime-800/40 text-lime-300 hover:bg-lime-950/45'
                      : 'bg-slate-900/60 border-slate-800 text-slate-200 hover:bg-slate-800/70'
              }`}
              title="Haz clic para seguir esta canica"
            >
              <span className="font-mono font-bold w-4 text-center text-slate-500 text-[11px] tabular-nums">
                {m.rank}
              </span>

              <HealthDisk
                hp={m.isZombie ? (m.zhp ?? 1) : m.hp}
                maxHp={m.isZombie ? (m.maxZhp ?? 4) : m.maxHp}
                shield={m.shield}
                isZombie={m.isZombie}
                isExtracted={m.isExtracted}
                color={m.color}
                size={24}
              />

              <div className="flex items-center justify-between gap-2 flex-1 min-w-0">
                <span className="font-semibold text-white truncate" title={m.name}>
                  {m.name}
                </span>
                <span className="shrink-0 text-[11px]">
                  {m.isExtracted ? (
                    <span className="text-amber-400 font-semibold flex items-center gap-1">
                      <ShieldCheck size={12} /> Salvado
                    </span>
                  ) : m.isZombie ? (
                    <span className="text-lime-400 font-medium flex items-center gap-1">
                      <Skull size={12} /> {m.kills || 0}
                    </span>
                  ) : (
                    <span className="text-slate-300" title={wSpec.name}>
                      {wSpec.icon}
                    </span>
                  )}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
