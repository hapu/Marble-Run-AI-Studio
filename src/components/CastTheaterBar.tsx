import React from 'react';
import { Cast, Monitor, X } from 'lucide-react';

interface CastTheaterBarProps {
  hudTime: string;
  livingHumansCount: number;
  activeZombiesCount: number;
  hudLeader: string;
  hudLeaderColor: string;
  hudProgress: number;
  hudVisible: boolean;
  castHelperOpen: boolean;
  onDismissHelper: () => void;
  onExitTvMode: () => void;
}

export const CastTheaterBar: React.FC<CastTheaterBarProps> = ({
  hudTime,
  livingHumansCount,
  activeZombiesCount,
  hudLeader,
  hudLeaderColor,
  hudProgress,
  hudVisible,
  castHelperOpen,
  onDismissHelper,
  onExitTvMode,
}) => {
  return (
    <>
      {/* 10-foot Broadcast Score Strip */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3 bg-slate-950/85 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700/60 shadow-xl text-sm whitespace-nowrap">
          <span className="font-black tracking-tight text-white">ZOMBIE RUN</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="font-mono font-bold text-slate-100 tabular-nums">{hudTime}</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="font-mono font-bold text-cyan-300 tabular-nums">{livingHumansCount} vivos</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="font-mono font-bold text-emerald-400 tabular-nums">{activeZombiesCount} zombis</span>
          <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
          <div className="hidden sm:flex items-center gap-2 font-bold">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hudLeaderColor }} />
            <span className="text-white max-w-[140px] truncate">{hudLeader}</span>
            <span className="font-mono text-amber-400 tabular-nums">{hudProgress}%</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onExitTvMode}
          className={`pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950/90 hover:bg-slate-800 border border-slate-700/70 text-xs font-bold text-slate-200 transition-all duration-200 whitespace-nowrap shrink-0 ${
            hudVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
          }`}
          title="Salir del modo TV / Cast [Esc]"
        >
          <Monitor size={14} className="text-cyan-400" />
          <span>Salir TV</span>
        </button>
      </div>

      {/* Dismissible Chrome Tab-Cast Helper Banner */}
      {castHelperOpen && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 max-w-xl w-[92%]">
          <div className="flex items-center justify-between gap-3 bg-slate-950/92 backdrop-blur-md border border-cyan-500/40 rounded-xl px-4 py-2.5 shadow-2xl text-xs text-slate-200">
            <div className="flex items-center gap-2.5 min-w-0">
              <Cast size={16} className="text-cyan-400 shrink-0" />
              <p className="leading-snug">
                <span className="font-bold text-white">Modo TV activado.</span> Para enviar a tu Chromecast desde Chrome, abre el menú{' '}
                <span className="font-mono text-cyan-300">⋮ → Guardar y compartir → Enviar</span> y selecciona tu televisor.
              </p>
            </div>
            <button
              type="button"
              onClick={onDismissHelper}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
              aria-label="Cerrar aviso de Chromecast"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
