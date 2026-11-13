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
      {/* Replay Banner or Power Deployment Toast */}
      {isReplaying ? (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30">
          <button
            type="button"
            onClick={onStopReplay}
            className="px-4 py-1.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-2xl flex items-center gap-2 hover:bg-amber-400"
          >
            <Film size={14} />
            <span>HIGHLIGHT {replayHudText} · Clic para saltar</span>
          </button>
        </div>
      ) : powerHint || selectedPower ? (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div
            className={`px-4 py-1.5 rounded-full border text-xs font-bold tracking-wide shadow-2xl backdrop-blur-md flex items-center gap-1.5 whitespace-nowrap ${
              powerHint
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60'
                : 'bg-cyan-950/90 text-cyan-300 border-cyan-400/80 animate-pulse'
            }`}
          >
            <Crosshair size={13} />
            <span>
              {powerHint ||
                `CLIC EN PISTA PARA DESPLEGAR [${selectedPower?.toUpperCase()}] · [Esc] cancelar`}
            </span>
          </div>
        </div>
      ) : null}

      {/* Animated Stage Announcement Banner */}
      {!isReplaying && (
        <div
          className={`absolute bottom-20 left-1/2 -translate-x-1/2 bg-slate-950/90 text-amber-300 font-bold px-5 py-1.5 rounded-full border border-amber-500/40 shadow-xl backdrop-blur-md text-xs tracking-wide pointer-events-none transition-all duration-300 whitespace-nowrap ${
            bannerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {stageBanner}
        </div>
      )}

      {/* Dual Tactical Dock (Bottom Center): Targeted Powers [1-3] + Commander Powers [4-6] */}
      {!isReplaying && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 max-w-[96%]">
          <div className="bg-slate-950/92 backdrop-blur-md px-2 py-1.5 rounded-2xl border border-slate-700/80 shadow-[0_8px_32px_rgba(0,0,0,0.65)] flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => onActivateTargetedPower('boost')}
              disabled={boostCooldown > 0}
              className={`relative px-2.5 py-1.5 rounded-xl border text-left transition-all flex items-center gap-1.5 whitespace-nowrap ${
                boostCooldown > 0
                  ? 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-70 cursor-not-allowed'
                  : 'bg-slate-900/90 border-amber-500/40 text-amber-200 hover:bg-amber-500/15'
              }`}
              title="[1] Turbo Boost en canica seguida (3s)"
            >
              <Flame size={14} className="text-amber-400 shrink-0" />
              <span className="text-[11px] font-bold">Boost</span>
              <span className="text-[9px] font-mono bg-slate-800 px-1 rounded text-amber-300">1</span>
              {boostCooldown > 0 && (
                <span className="absolute inset-0 bg-slate-950/80 rounded-xl flex items-center justify-center font-mono font-bold text-xs text-amber-400">
                  {boostCooldown}s
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onActivateTargetedPower('shield')}
              disabled={shieldCooldown > 0}
              className={`relative px-2.5 py-1.5 rounded-xl border text-left transition-all flex items-center gap-1.5 whitespace-nowrap ${
                shieldCooldown > 0
                  ? 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-70 cursor-not-allowed'
                  : 'bg-slate-900/90 border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/15'
              }`}
              title="[2] Escudo energético en canica seguida (5s)"
            >
              <ShieldCheck size={14} className="text-cyan-400 shrink-0" />
              <span className="text-[11px] font-bold">Escudo</span>
              <span className="text-[9px] font-mono bg-slate-800 px-1 rounded text-cyan-300">2</span>
              {shieldCooldown > 0 && (
                <span className="absolute inset-0 bg-slate-950/80 rounded-xl flex items-center justify-center font-mono font-bold text-xs text-cyan-400">
                  {shieldCooldown}s
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => onActivateTargetedPower('heal')}
              disabled={healCooldown > 0}
              className={`relative px-2.5 py-1.5 rounded-xl border text-left transition-all flex items-center gap-1.5 whitespace-nowrap ${
                healCooldown > 0
                  ? 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-70 cursor-not-allowed'
                  : 'bg-slate-900/90 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/15'
              }`}
              title="[3] Curar +2 HP a canica seguida"
            >
              <Heart size={14} className="text-emerald-400 shrink-0" />
              <span className="text-[11px] font-bold">Curar</span>
              <span className="text-[9px] font-mono bg-slate-800 px-1 rounded text-emerald-300">3</span>
              {healCooldown > 0 && (
                <span className="absolute inset-0 bg-slate-950/80 rounded-xl flex items-center justify-center font-mono font-bold text-xs text-emerald-400">
                  {healCooldown}s
                </span>
              )}
            </button>

            <div className="w-[1px] h-6 bg-slate-700/70 mx-0.5 shrink-0" />

            <button
              type="button"
              onClick={() => empCooldown <= 0 && onSelectMapPower('emp')}
              disabled={empCooldown > 0}
              className={`relative px-2.5 py-1.5 rounded-xl border text-left transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedPower === 'emp'
                  ? 'bg-cyan-500/25 border-cyan-400 text-cyan-100'
                  : empCooldown > 0
                    ? 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-70 cursor-not-allowed'
                    : 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:border-cyan-400/70'
              }`}
              title="[4] Clic en mapa: Onda EMP que repele zombis"
            >
              <Zap size={14} className="text-cyan-400 shrink-0" />
              <span className="text-[11px] font-bold">EMP</span>
              <span className="text-[9px] font-mono bg-slate-800 px-1 rounded text-cyan-300">4</span>
              {empCooldown > 0 && (
                <span className="absolute inset-0 bg-slate-950/80 rounded-xl flex items-center justify-center font-mono font-bold text-xs text-amber-400">
                  {empCooldown}s
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => barricadeCooldown <= 0 && onSelectMapPower('barricade')}
              disabled={barricadeCooldown > 0}
              className={`relative px-2.5 py-1.5 rounded-xl border text-left transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedPower === 'barricade'
                  ? 'bg-blue-500/25 border-blue-400 text-blue-100'
                  : barricadeCooldown > 0
                    ? 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-70 cursor-not-allowed'
                    : 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:border-blue-400/70'
              }`}
              title="[5] Clic en mapa: Barricada láser (8s)"
            >
              <Shield size={14} className="text-blue-400 shrink-0" />
              <span className="text-[11px] font-bold">Muro</span>
              <span className="text-[9px] font-mono bg-slate-800 px-1 rounded text-blue-300">5</span>
              {barricadeCooldown > 0 && (
                <span className="absolute inset-0 bg-slate-950/80 rounded-xl flex items-center justify-center font-mono font-bold text-xs text-amber-400">
                  {barricadeCooldown}s
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => airdropCooldown <= 0 && onSelectMapPower('airdrop')}
              disabled={airdropCooldown > 0}
              className={`relative px-2.5 py-1.5 rounded-xl border text-left transition-all flex items-center gap-1.5 whitespace-nowrap ${
                selectedPower === 'airdrop'
                  ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                  : airdropCooldown > 0
                    ? 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-70 cursor-not-allowed'
                    : 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:border-amber-400/70'
              }`}
              title="[6] Clic en mapa: Caja de arma aleatoria"
            >
              <Package size={14} className="text-amber-400 shrink-0" />
              <span className="text-[11px] font-bold">Caja</span>
              <span className="text-[9px] font-mono bg-slate-800 px-1 rounded text-amber-300">6</span>
              {airdropCooldown > 0 && (
                <span className="absolute inset-0 bg-slate-950/80 rounded-xl flex items-center justify-center font-mono font-bold text-xs text-amber-400">
                  {airdropCooldown}s
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
