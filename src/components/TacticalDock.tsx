import React from 'react';
import {
  Crosshair,
  Film,
  Flame,
  Heart,
  Package,
  Shield,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { MapPower } from '../types';

interface TacticalDockProps {
  isReplaying: boolean;
  replayHudText: string;
  onStopReplay: () => void;
  powerHint: string | null;
  selectedPower: MapPower | null;
  onSelectMapPower: (power: MapPower) => void;
  onActivateTargetedPower: (kind: 'boost' | 'shield' | 'heal') => void;
  boostCooldown: number;
  shieldCooldown: number;
  healCooldown: number;
  empCooldown: number;
  barricadeCooldown: number;
  airdropCooldown: number;
  stageBanner: string;
  bannerVisible: boolean;
}

interface AbilityButtonProps {
  icon: React.ReactNode;
  cooldown: number;
  maxCooldown: number;
  active?: boolean;
  ringColor: string;
  title: string;
  onClick: () => void;
}

const TransparentAbilityButton: React.FC<AbilityButtonProps> = ({
  icon,
  cooldown,
  maxCooldown,
  active = false,
  ringColor,
  title,
  onClick,
}) => {
  const onCd = cooldown > 0;
  const ratio = onCd ? Math.max(0, Math.min(1, cooldown / maxCooldown)) : 0;
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - ratio);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={onCd}
      title={title}
      aria-label={title}
      className={`relative w-11 h-11 rounded-full bg-transparent flex items-center justify-center transition-all duration-150 shrink-0 ${
        onCd
          ? 'opacity-40 cursor-not-allowed'
          : active
            ? 'bg-white/12 scale-110 cursor-pointer'
            : 'hover:bg-white/10 hover:scale-105 active:scale-95 cursor-pointer'
      }`}
    >
      <svg
        width="44"
        height="44"
        viewBox="0 0 44 44"
        className="absolute inset-0 pointer-events-none"
      >
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={active ? ringColor : 'rgba(255,255,255,0.16)'}
          strokeWidth={active ? '2' : '1'}
        />
        {onCd && (
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth="2"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform="rotate(-90 22 22)"
          />
        )}
      </svg>
      <span className="relative z-10">{icon}</span>
    </button>
  );
};

export const TacticalDock: React.FC<TacticalDockProps> = ({
  isReplaying,
  replayHudText,
  onStopReplay,
  powerHint,
  selectedPower,
  onSelectMapPower,
  onActivateTargetedPower,
  boostCooldown,
  shieldCooldown,
  healCooldown,
  empCooldown,
  barricadeCooldown,
  airdropCooldown,
  stageBanner,
  bannerVisible,
}) => {
  return (
    <>
      {isReplaying ? (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
          <button
            type="button"
            onClick={onStopReplay}
            className="px-4 py-1.5 rounded-full bg-amber-500 text-slate-950 font-bold text-xs shadow-xl flex items-center gap-2 hover:bg-amber-400 whitespace-nowrap"
          >
            <Film size={14} />
            <span>{replayHudText} · Clic para saltar</span>
          </button>
        </div>
      ) : powerHint || selectedPower ? (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="px-3 py-1 rounded-full bg-slate-950/60 backdrop-blur-sm border border-white/15 text-[11px] font-medium text-slate-100 flex items-center gap-1.5 whitespace-nowrap">
            <Crosshair size={12} className="text-cyan-300" />
            <span>{powerHint || 'Clic en el mapa para desplegar · Esc cancelar'}</span>
          </div>
        </div>
      ) : bannerVisible ? (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-amber-200/90 font-semibold text-xs tracking-wide pointer-events-none transition-opacity duration-300 whitespace-nowrap drop-shadow-[0_1px_6px_rgba(0,0,0,0.95)]">
          {stageBanner}
        </div>
      ) : null}

      {/* Transparent Icon-Only Ability Cluster */}
      {!isReplaying && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          <TransparentAbilityButton
            icon={<Flame size={18} className="text-amber-300 drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]" />}
            cooldown={boostCooldown}
            maxCooldown={8}
            ringColor="#fbbf24"
            title="[1] Turbo Boost"
            onClick={() => onActivateTargetedPower('boost')}
          />
          <TransparentAbilityButton
            icon={<ShieldCheck size={18} className="text-cyan-300 drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]" />}
            cooldown={shieldCooldown}
            maxCooldown={12}
            ringColor="#38bdf8"
            title="[2] Escudo"
            onClick={() => onActivateTargetedPower('shield')}
          />
          <TransparentAbilityButton
            icon={<Heart size={18} className="text-emerald-300 drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]" />}
            cooldown={healCooldown}
            maxCooldown={14}
            ringColor="#4ade80"
            title="[3] Curar"
            onClick={() => onActivateTargetedPower('heal')}
          />

          <div className="w-[1px] h-5 bg-white/15 mx-0.5" aria-hidden="true" />

          <TransparentAbilityButton
            icon={<Zap size={18} className="text-cyan-300 drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]" />}
            cooldown={empCooldown}
            maxCooldown={12}
            active={selectedPower === 'emp'}
            ringColor="#22d3ee"
            title="[4] Onda EMP (clic en mapa)"
            onClick={() => empCooldown <= 0 && onSelectMapPower('emp')}
          />
          <TransparentAbilityButton
            icon={<Shield size={18} className="text-blue-300 drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]" />}
            cooldown={barricadeCooldown}
            maxCooldown={10}
            active={selectedPower === 'barricade'}
            ringColor="#60a5fa"
            title="[5] Barricada (clic en mapa)"
            onClick={() => barricadeCooldown <= 0 && onSelectMapPower('barricade')}
          />
          <TransparentAbilityButton
            icon={<Package size={18} className="text-amber-300 drop-shadow-[0_1px_4px_rgba(0,0,0,0.85)]" />}
            cooldown={airdropCooldown}
            maxCooldown={15}
            active={selectedPower === 'airdrop'}
            ringColor="#f59e0b"
            title="[6] Suministro (clic en mapa)"
            onClick={() => airdropCooldown <= 0 && onSelectMapPower('airdrop')}
          />
        </div>
      )}
    </>
  );
};
