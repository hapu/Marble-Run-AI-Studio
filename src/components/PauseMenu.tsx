import React, { useState } from 'react';
import {
  Bug,
  Calendar,
  Camera,
  Cast,
  Link2,
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Play,
  RotateCcw,
  Shuffle,
  Skull,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CameraMode, CastStatus, Marble } from '../types';
import { CAMERA_MODES, DEFAULT_MARBLE_COLORS, SIMULATION_SPEEDS } from '../constants';
import { Leaderboard } from './Leaderboard';
import { MarbleSelector } from './MarbleSelector';

interface PauseMenuProps {
  hudTime: string;
  livingHumansCount: number;
  extractedHumansCount: number;
  activeZombiesCount: number;
  simSpeed: number;
  onSelectSpeed: (spd: number) => void;
  cameraMode: CameraMode;
  onSelectCameraMode: (mode: CameraMode) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  showLabyrinthMap: boolean;
  onToggleLabyrinthMap: () => void;
  showDebugHud: boolean;
  onToggleDebugHud: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  castStatus: CastStatus;
  onTriggerCast: () => void;
  onResume: () => void;
  onRestart: () => void;
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
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  hudTime,
  livingHumansCount,
  extractedHumansCount,
  activeZombiesCount,
  simSpeed,
  onSelectSpeed,
  cameraMode,
  onSelectCameraMode,
  soundEnabled,
  onToggleSound,
  showLabyrinthMap,
  onToggleLabyrinthMap,
  showDebugHud,
  onToggleDebugHud,
  isFullscreen,
  onToggleFullscreen,
  castStatus,
  onTriggerCast,
  onResume,
  onRestart,
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
}) => {
  const [activeTab, setActiveTab] = useState<'roster' | 'setup'>('roster');

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h1 className="text-lg font-extrabold tracking-tight text-white">Zombie Run · Pausa</h1>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
              <span>{hudTime.split(' / ')[0]}</span>
              <span aria-hidden="true">·</span>
              <span className="text-cyan-300">
                {livingHumansCount} vivos{extractedHumansCount > 0 ? ` (${extractedHumansCount} salv.)` : ''}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-400">{activeZombiesCount} zombis</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRestart}
              className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>Reiniciar</span>
            </button>
            <button
              type="button"
              onClick={onResume}
              className="py-2 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play size={14} className="fill-slate-950" />
              <span>Reanudar</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Speed & Camera Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <span className="block text-[11px] font-semibold text-slate-400">Velocidad de simulación</span>
              <div className="flex items-center gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
                {SIMULATION_SPEEDS.map((spd) => (
                  <button
                    type="button"
                    key={spd}
                    onClick={() => onSelectSpeed(spd)}
                    className={`flex-1 py-2 text-xs font-mono font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums cursor-pointer ${
                      simSpeed === spd
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    {spd}×
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-[11px] font-semibold text-slate-400">Enfoque de cámara</span>
              <div className="flex items-center gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800 overflow-x-auto">
                {CAMERA_MODES.map((mode) => (
                  <button
                    type="button"
                    key={mode.id}
                    onClick={() => onSelectCameraMode(mode.id as CameraMode)}
                    title={mode.description}
                    className={`flex-1 py-2 px-2 text-[11px] font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      cameraMode === mode.id
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Toolbar moved cleanly into Pause Menu */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleSound}
              className="py-2 px-3.5 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {soundEnabled ? <Volume2 size={14} className="text-emerald-400" /> : <VolumeX size={14} className="text-rose-400" />}
              <span>{soundEnabled ? 'Sonido activo' : 'Silenciado'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleLabyrinthMap}
              className={`py-2 px-3.5 rounded-xl border flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showLabyrinthMap
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                  : 'bg-slate-950/70 hover:bg-slate-800 border-slate-800 text-slate-200'
              }`}
            >
              <MapIcon size={14} className="text-cyan-400" />
              <span>Mapa 5×5</span>
            </button>

            <button
              type="button"
              onClick={onTriggerCast}
              className={`py-2 px-3.5 rounded-xl border flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                castStatus !== 'idle'
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                  : 'bg-slate-950/70 hover:bg-slate-800 border-slate-800 text-slate-200'
              }`}
            >
              <Cast size={14} className="text-cyan-400" />
              <span>Chromecast / TV</span>
            </button>

            <button
              type="button"
              onClick={onToggleFullscreen}
              className="py-2 px-3.5 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isFullscreen ? <Minimize2 size={14} className="text-amber-400" /> : <Maximize2 size={14} className="text-amber-400" />}
              <span>{isFullscreen ? 'Salir pantalla completa' : 'Pantalla completa'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleDebugHud}
              className={`py-2 px-3.5 rounded-xl border flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showDebugHud
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                  : 'bg-slate-950/70 hover:bg-slate-800 border-slate-800 text-slate-200'
              }`}
            >
              <Bug size={14} className="text-amber-400" />
              <span>Telemetría</span>
            </button>
          </div>

          {/* Section Switcher Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'roster'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users size={14} />
              <span>Supervivientes</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('setup')}
              className={`py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'setup'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera size={14} />
              <span>Partida y Canicas</span>
            </button>
          </div>

          {activeTab === 'roster' ? (
            <Leaderboard
              standings={standings}
              followedMarbleId={followedMarbleId}
              onFollowMarble={(id) => {
                onFollowMarble(id);
                onResume();
              }}
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Patient Zero Count */}
                <div className="space-y-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                    <Skull size={13} className="text-emerald-400" />
                    <span>Pacientes Cero</span>
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[1, 2, 3].map((num) => (
                      <button
                        type="button"
                        key={num}
                        onClick={() => onSelectPatientZero(num)}
                        className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          patientZeroCount === num
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Seed Controls */}
                <div className="space-y-2">
                  <span className="block text-[11px] font-semibold text-slate-300">Semilla del laberinto</span>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={seed}
                      onChange={(e) => onSeedChange(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onRestart()}
                      placeholder="Semilla..."
                      maxLength={20}
                      className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={onRandomizeSeed}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                      title="Semilla aleatoria"
                    >
                      <Shuffle size={13} className="text-amber-400" />
                    </button>
                    <button
                      type="button"
                      onClick={onDailySeed}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                      title="Semilla diaria"
                    >
                      <Calendar size={13} className="text-cyan-400" />
                    </button>
                    <button
                      type="button"
                      onClick={onCopySeedLink}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                      title="Copiar enlace"
                    >
                      <Link2 size={13} className="text-emerald-400" />
                    </button>
                  </div>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
