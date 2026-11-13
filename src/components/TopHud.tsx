import React from 'react';
import {
  Bug,
  Camera,
  ChevronLeft,
  ChevronRight,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  ShieldCheck,
  Skull,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CameraMode, Marble, WeaponType } from '../types';
import { CAMERA_MODES, SIMULATION_SPEEDS, WEAPON_SPECS } from '../constants';

interface TopHudProps {
  hudTime: string;
  livingHumansCount: number;
  extractedHumansCount: number;
  activeZombiesCount: number;
  hudLeader: string;
  hudLeaderColor: string;
  hudProgress: number;
  followedMarble: Marble | null;
  onCycleFollow: (delta: number) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
  simSpeed: number;
  onSelectSpeed: (spd: number) => void;
  cameraMode: CameraMode;
  onCycleCameraMode: () => void;
  showLabyrinthMap: boolean;
  onToggleLabyrinthMap: () => void;
  showDebugHud: boolean;
  onToggleDebugHud: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export const TopHud: React.FC<TopHudProps> = ({
  hudTime,
  livingHumansCount,
  extractedHumansCount,
  activeZombiesCount,
  hudLeader,
  hudLeaderColor,
  hudProgress,
  followedMarble,
  onCycleFollow,
  soundEnabled,
  onToggleSound,
  isPaused,
  onTogglePause,
  simSpeed,
  onSelectSpeed,
  cameraMode,
  onCycleCameraMode,
  showLabyrinthMap,
  onToggleLabyrinthMap,
  showDebugHud,
  onToggleDebugHud,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const activeCameraSpec = CAMERA_MODES.find((m) => m.id === cameraMode) ?? CAMERA_MODES[1];

  return (
    <>
      {/* Top-Left HUD: Telemetry + Followed Marble Indicator */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 max-w-[calc(100%-360px)]">
        <div className="flex items-center gap-2.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 shadow-lg text-xs whitespace-nowrap">
          <div className="flex flex-col">
            <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">Tiempo</span>
            <span className="font-mono text-xs font-bold text-white tabular-nums">{hudTime}</span>
          </div>

          <div className="w-[1px] h-6 bg-slate-700/60" />

          <div className="flex flex-col">
            <span className="text-[9px] font-semibold tracking-wider text-cyan-400 uppercase flex items-center gap-1">
              <ShieldCheck size={10} />
              <span>Humanos</span>
            </span>
            <span className="font-mono text-xs font-bold text-cyan-300 tabular-nums">
              {livingHumansCount} vivos{extractedHumansCount > 0 ? ` · ${extractedHumansCount} salv.` : ''}
            </span>
          </div>

          <div className="w-[1px] h-6 bg-slate-700/60" />

          <div className="flex flex-col">
            <span className="text-[9px] font-semibold tracking-wider text-emerald-400 uppercase flex items-center gap-1">
              <Skull size={10} />
              <span>Horda</span>
            </span>
            <span className="font-mono text-xs font-bold text-emerald-300 tabular-nums">{activeZombiesCount}</span>
          </div>

          <div className="hidden sm:block w-[1px] h-6 bg-slate-700/60" />

          <div className="hidden sm:flex flex-col">
            <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">Líder</span>
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hudLeaderColor }} />
              <span className="text-white max-w-[90px] truncate">{hudLeader}</span>
              <span className="font-mono text-amber-400">{hudProgress}%</span>
            </div>
          </div>
        </div>

        {/* Tap-to-Follow / Cycle Marble Indicator */}
        {followedMarble && (
          <div className="inline-flex self-start items-center gap-1.5 bg-slate-950/90 backdrop-blur-md px-2 py-1 rounded-xl border border-slate-700/80 shadow-md text-[11px] whitespace-nowrap">
            <button
              type="button"
              onClick={() => onCycleFollow(-1)}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
              title="Canica anterior [Tecla []"
            >
              <ChevronLeft size={14} />
            </button>
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: followedMarble.isZombie ? '#22c55e' : followedMarble.color }}
            />
            <span className="font-bold text-white max-w-[110px] truncate">{followedMarble.name}</span>
            {followedMarble.isZombie ? (
              <span className="font-mono text-[10px] text-lime-400">☣ Zombi</span>
            ) : followedMarble.isExtracted ? (
              <span className="font-mono text-[10px] text-amber-400">🛡️ Salvado</span>
            ) : (
              <>
                <span className="font-mono text-[10px] text-cyan-300">{followedMarble.hp}/5 HP</span>
                <span className="font-mono text-[10px] text-amber-300">
                  {(WEAPON_SPECS[(followedMarble.weaponType || 'blaster') as WeaponType] || WEAPON_SPECS.blaster).icon}
                </span>
              </>
            )}
            <button
              type="button"
              onClick={() => onCycleFollow(1)}
              className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
              title="Siguiente canica [Tecla ]]"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Top-Right Utility Toolbar */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-lg z-10">
        <button
          type="button"
          onClick={onToggleSound}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title={soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
        >
          {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} className="text-red-400" />}
        </button>

        <button
          type="button"
          onClick={onTogglePause}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title="Pausar / Reanudar [Espacio]"
        >
          {isPaused ? <Play size={15} className="text-emerald-400" /> : <Pause size={15} />}
        </button>

        <div className="w-[1px] h-5 bg-slate-700/60" />

        {SIMULATION_SPEEDS.map((spd) => (
          <button
            type="button"
            key={spd}
            onClick={() => onSelectSpeed(spd)}
            className={`px-1.5 py-1 text-[11px] font-bold rounded-lg transition-colors whitespace-nowrap ${
              simSpeed === spd
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {spd}x
          </button>
        ))}

        <div className="w-[1px] h-5 bg-slate-700/60" />

        <button
          type="button"
          onClick={onCycleCameraMode}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap"
          title={`Cámara: ${activeCameraSpec.description}`}
        >
          <Camera size={13} className="text-amber-400" />
          <span className="hidden lg:inline">{activeCameraSpec.label}</span>
        </button>

        <button
          type="button"
          onClick={onToggleLabyrinthMap}
          className={`p-1.5 rounded-lg transition-colors ${
            showLabyrinthMap ? 'bg-cyan-500/25 text-cyan-300' : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Mapa del Laberinto 5×5 [M]"
        >
          <MapIcon size={15} />
        </button>

        <button
          type="button"
          onClick={onToggleDebugHud}
          className={`p-1.5 rounded-lg transition-colors ${
            showDebugHud ? 'bg-amber-500/25 text-amber-300' : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Telemetría de rendimiento [D]"
        >
          <Bug size={15} />
        </button>

        <button
          type="button"
          onClick={onToggleFullscreen}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          title="Pantalla completa"
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>
    </>
  );
};
