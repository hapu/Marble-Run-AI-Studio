import React from 'react';
import { DebugTelemetryStats } from '../types';

interface DebugOverlayProps {
  stats: DebugTelemetryStats;
  activeChunkCount: number;
  showSkyline: boolean;
  showParticles: boolean;
  onToggleSkyline: () => void;
  onToggleParticles: () => void;
  onClose: () => void;
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({
  stats,
  activeChunkCount,
  showSkyline,
  showParticles,
  onToggleSkyline,
  onToggleParticles,
  onClose,
}) => {
  return (
    <div className="absolute top-16 left-3 z-20 bg-slate-950/90 backdrop-blur-md border border-amber-500/40 rounded-xl p-2.5 text-[10.5px] font-mono text-slate-200 shadow-xl space-y-1.5 w-56">
      <div className="flex items-center justify-between text-amber-300 font-bold border-b border-slate-800 pb-1">
        <span>DEBUG TELEMETRÍA</span>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
          ✕
        </button>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-400">FPS / Peor ms:</span>
        <span>
          {stats.fps} fps · {stats.worstMs}ms
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-400">Física / Draw:</span>
        <span>
          {stats.physMs}ms / {stats.drawMs}ms
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-400">Salas Activas:</span>
        <span className="text-emerald-400">{activeChunkCount} / 25</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-400">Entidades:</span>
        <span>{stats.entities}</span>
      </div>
      <div className="pt-1 border-t border-slate-800 flex gap-1.5">
        <button
          type="button"
          onClick={onToggleSkyline}
          className={`flex-1 py-1 rounded text-[10px] font-bold border ${
            showSkyline
              ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}
        >
          Skyline
        </button>
        <button
          type="button"
          onClick={onToggleParticles}
          className={`flex-1 py-1 rounded text-[10px] font-bold border ${
            showParticles
              ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}
        >
          Partículas
        </button>
      </div>
    </div>
  );
};
