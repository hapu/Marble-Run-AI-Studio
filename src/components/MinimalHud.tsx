import React from 'react';
import { Pause } from 'lucide-react';
import { Marble, WeaponType } from '../types';
import { WEAPON_SPECS } from '../constants';
import { HealthDisk } from './HealthDisk';

interface MinimalHudProps {
  hudTime: string;
  followedMarble: Marble | null;
  onCycleFollow: (delta: number) => void;
  onOpenPauseMenu: () => void;
}

export const MinimalHud: React.FC<MinimalHudProps> = ({
  hudTime,
  followedMarble,
  onCycleFollow,
  onOpenPauseMenu,
}) => {
  const wSpec = followedMarble
    ? WEAPON_SPECS[(followedMarble.weaponType || 'blaster') as WeaponType] || WEAPON_SPECS.blaster
    : null;

  return (
    <>
      {/* Top-Left Minimal Visual Status: Health Disk + Time */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2.5 pointer-events-none">
        {followedMarble && (
          <button
            type="button"
            onClick={() => onCycleFollow(1)}
            className="pointer-events-auto flex items-center gap-2 px-2 py-1.5 rounded-full bg-slate-950/35 hover:bg-slate-900/70 backdrop-blur-sm border border-white/10 transition-colors cursor-pointer"
            title="Cambiar canica enfocada []]"
          >
            <HealthDisk
              hp={followedMarble.isZombie ? (followedMarble.zhp ?? 1) : followedMarble.hp}
              maxHp={followedMarble.isZombie ? (followedMarble.maxZhp ?? 4) : followedMarble.maxHp}
              shield={followedMarble.shield}
              isZombie={followedMarble.isZombie}
              isExtracted={followedMarble.isExtracted}
              color={followedMarble.color}
              size={26}
            />
            {wSpec && !followedMarble.isZombie && !followedMarble.finished && (
              <span className="text-xs leading-none pr-0.5" aria-hidden="true">
                {wSpec.icon}
              </span>
            )}
          </button>
        )}

        <span className="font-mono text-xs font-semibold text-slate-200/80 tabular-nums drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
          {hudTime.split(' / ')[0]}
        </span>
      </div>

      {/* Top-Right Single Comfortable Pause Button */}
      <button
        type="button"
        onClick={onOpenPauseMenu}
        className="absolute top-3 right-3 z-10 w-11 h-11 rounded-full bg-slate-950/35 hover:bg-slate-900/75 backdrop-blur-sm border border-white/10 text-slate-100 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
        title="Menú de Pausa [Espacio / Esc]"
        aria-label="Menú de Pausa"
      >
        <Pause size={18} />
      </button>
    </>
  );
};
