import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Shuffle,
  Camera,
  Trophy,
  SlidersHorizontal,
} from 'lucide-react';
import { Marble, CourseData } from './types';
import { DEFAULT_MARBLE_COLORS, SIMULATION_SPEEDS } from './constants';
import { sound } from './audio';
import { generateCourse } from './courseGenerator';
import { updateSimulation } from './physics';
import { renderCourse } from './renderer';
import { MarbleSelector } from './components/MarbleSelector';
import { Leaderboard } from './components/Leaderboard';

export default function App() {
  // Initialize default Spanish names dictionary
  const defaultNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    DEFAULT_MARBLE_COLORS.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, []);

  // State
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_MARBLE_COLORS.map((c) => c.id));
  const [customNames, setCustomNames] = useState<Record<string, string>>(defaultNamesMap);
  const [seed, setSeed] = useState<string>('mikan808');
  const [simSpeed, setSimSpeed] = useState<number>(1.0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [cameraMode, setCameraMode] = useState<'half_pack' | 'leader' | 'overview'>('half_pack');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // HUD stats throttled
  const [hudTime, setHudTime] = useState<string>('00:00 / 05:00');
  const [hudLeader, setHudLeader] = useState<string>('-');
  const [hudLeaderColor, setHudLeaderColor] = useState<string>('#f0be38');
  const [hudProgress, setHudProgress] = useState<number>(0);
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [standings, setStandings] = useState<Marble[]>([]);
  const [stageBanner, setStageBanner] = useState<string>('STAGE 1: THE DROP GATE');
  const [bannerVisible, setBannerVisible] = useState<boolean>(true);
  const [winnerModal, setWinnerModal] = useState<Marble | null>(null);

  // Canvas & Simulation references
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageWrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  // Simulation persistent values
  const courseRef = useRef<CourseData | null>(null);
  const marblesRef = useRef<Marble[]>([]);
  const raceTimeRef = useRef<number>(0);
  const camXRef = useRef<number>(640);
  const camYRef = useRef<number>(120);
  const camZoomRef = useRef<number>(1.0);
  const currentStageIndexRef = useRef<number>(-1);
  const lastTimeRef = useRef<number>(performance.now());
  const lastHudUpdateRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);
  const simSpeedRef = useRef<number>(1.0);
  const cameraModeRef = useRef<'half_pack' | 'leader' | 'overview'>('half_pack');

  // Keep refs in sync for the animation loop
  isPausedRef.current = isPaused;
  simSpeedRef.current = simSpeed;
  cameraModeRef.current = cameraMode;

  // Toggle sound
  const handleToggleSound = useCallback(() => {
    sound.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
  }, [soundEnabled]);

  // Rename a marble and sync in real-time to active simulation marbles
  const handleNameChange = useCallback((id: string, newName: string) => {
    setCustomNames((prev) => ({
      ...prev,
      [id]: newName,
    }));

    // Update active simulation marble immediately
    const targetMarble = marblesRef.current.find((m) => m.id === id);
    if (targetMarble) {
      targetMarble.name = newName;
    }
  }, []);

  // Reset names to original Spanish defaults
  const handleResetNames = useCallback(() => {
    setCustomNames({ ...defaultNamesMap });
    marblesRef.current.forEach((m) => {
      if (defaultNamesMap[m.id]) {
        m.name = defaultNamesMap[m.id];
      }
    });
  }, [defaultNamesMap]);

  // Restart / Re-seed Race
  const startRace = useCallback((newSeed?: string) => {
    const targetSeed = (newSeed ?? seed).trim() || 'mikan808';
    const newCourse = generateCourse(targetSeed);
    courseRef.current = newCourse;
    raceTimeRef.current = 0;
    currentStageIndexRef.current = -1;
    setWinnerModal(null);

    // Spawn selected marbles with their custom or default Spanish names
    const activeDefs = DEFAULT_MARBLE_COLORS.filter((c) => selectedIds.includes(c.id));
    const count = activeDefs.length;

    const spawned: Marble[] = activeDefs.map((def, idx) => {
      const offset = (idx - (count - 1) / 2) * 26;
      const assignedName = customNames[def.id]?.trim() || def.name;

      return {
        id: def.id,
        name: assignedName,
        color: def.color,
        border: def.border,
        isMikan: def.isMikan,
        x: newCourse.startX + offset,
        y: newCourse.startY + (idx % 3) * 18,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 1.2 + Math.random(),
        radius: 12.5,
        rank: idx + 1,
        finished: false,
        finishTime: null,
        finishPosition: null,
        currentCheckpointIdx: 0,
        progressScore: 0,
        history: [],
      };
    });

    marblesRef.current = spawned;
    camXRef.current = newCourse.startX;
    camYRef.current = newCourse.startY;
    camZoomRef.current = 1.0;

    setStageBanner('STAGE 1: THE DROP GATE');
    setBannerVisible(true);
    setTimeout(() => setBannerVisible(false), 2800);
  }, [seed, selectedIds, customNames]);

  // Toggle marble selection
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev; // Minimum 2 marbles required
        return prev.filter((c) => c !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === DEFAULT_MARBLE_COLORS.length) {
      setSelectedIds(['orange', 'red', 'cyan', 'yellow']);
    } else {
      setSelectedIds(DEFAULT_MARBLE_COLORS.map((c) => c.id));
    }
  }, [selectedIds.length]);

  const handleRandomizeSeed = useCallback(() => {
    const randomSeed = Math.floor(Math.random() * 899999 + 100000).toString();
    setSeed(randomSeed);
    startRace(randomSeed);
  }, [startRace]);

  // Adjust Viewport & Aspect ratio (16:9 or 9:16)
  const updateAspect = useCallback(() => {
    if (!stageWrapperRef.current || !canvasContainerRef.current || !canvasRef.current) return;

    const containerW = stageWrapperRef.current.clientWidth;
    const containerH = stageWrapperRef.current.clientHeight;

    const portrait = containerW < containerH;
    setIsPortrait(portrait);

    const targetRatio = portrait ? 9 / 16 : 16 / 9;
    const virtualW = portrait ? 720 : 1280;
    const virtualH = portrait ? 1280 : 720;

    let finalW: number;
    let finalH: number;

    if (containerW / containerH > targetRatio) {
      finalH = containerH;
      finalW = finalH * targetRatio;
    } else {
      finalW = containerW;
      finalH = finalW / targetRatio;
    }

    canvasContainerRef.current.style.width = `${Math.floor(finalW)}px`;
    canvasContainerRef.current.style.height = `${Math.floor(finalH)}px`;

    canvasRef.current.width = virtualW;
    canvasRef.current.height = virtualH;
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateAspect);
    updateAspect();
    return () => window.removeEventListener('resize', updateAspect);
  }, [updateAspect]);

  // Initial race boot
  useEffect(() => {
    updateAspect();
    startRace();
  }, [startRace, updateAspect]);

  // Main Simulation & Render Loop
  useEffect(() => {
    let animId: number;

    const gameLoop = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.04);
      lastTimeRef.current = now;

      const course = courseRef.current;
      const marbles = marblesRef.current;
      const canvas = canvasRef.current;

      if (course && marbles.length > 0 && canvas) {
        const virtualW = canvas.width;
        const virtualH = canvas.height;

        // Adaptive substeps for physics stability and precision
        if (!isPausedRef.current) {
          const speed = simSpeedRef.current;
          raceTimeRef.current += dt * speed;

          const numSubsteps = speed > 2.0 ? 4 : 3;
          const subDt = dt / numSubsteps;

          for (let s = 0; s < numSubsteps; s++) {
            updateSimulation(
              course,
              marbles,
              subDt,
              speed,
              raceTimeRef.current,
              s === 0 ? (winner) => setWinnerModal(winner) : () => {}
            );
          }

          // Check stage announcements
          for (let i = course.stages.length - 1; i >= 0; i--) {
            const stg = course.stages[i];
            const leader = marbles[0];
            if (leader && leader.currentCheckpointIdx >= stg.chkIdx) {
              if (currentStageIndexRef.current !== i) {
                currentStageIndexRef.current = i;
                setStageBanner(stg.name);
                setBannerVisible(true);
                setTimeout(() => setBannerVisible(false), 2800);
              }
              break;
            }
          }
        }

        // ==========================================
        // SMART CAMERA: Frame at least HALF the marbles!
        // ==========================================
        if (marbles.length > 0) {
          const mode = cameraModeRef.current;

          if (mode === 'overview') {
            let minX = marbles[0].x;
            let maxX = marbles[0].x;
            let minY = marbles[0].y;
            let maxY = marbles[0].y;
            for (let i = 1; i < marbles.length; i++) {
              if (marbles[i].x < minX) minX = marbles[i].x;
              if (marbles[i].x > maxX) maxX = marbles[i].x;
              if (marbles[i].y < minY) minY = marbles[i].y;
              if (marbles[i].y > maxY) maxY = marbles[i].y;
            }
            const targetX = (minX + maxX) / 2;
            const targetY = (minY + maxY) / 2;
            const spanX = maxX - minX + 360;
            const spanY = maxY - minY + 360;
            const targetZoom = Math.max(0.28, Math.min(1.0, Math.min(virtualW / spanX, virtualH / spanY)));
            camXRef.current += (targetX - camXRef.current) * 0.08;
            camYRef.current += (targetY - camYRef.current) * 0.08;
            camZoomRef.current += (targetZoom - camZoomRef.current) * 0.06;
          } else if (mode === 'leader') {
            const leader = marbles[0];
            camXRef.current += (leader.x - camXRef.current) * 0.12;
            camYRef.current += (leader.y - camYRef.current) * 0.12;
            camZoomRef.current += (0.95 - camZoomRef.current) * 0.08;
          } else {
            // Frame AT LEAST HALF OF THE RACERS
            const halfCount = Math.max(2, Math.ceil(marbles.length / 2));
            const tracked = marbles.slice(0, halfCount);

            let minX = tracked[0].x;
            let maxX = tracked[0].x;
            let minY = tracked[0].y;
            let maxY = tracked[0].y;

            for (let i = 1; i < tracked.length; i++) {
              const m = tracked[i];
              if (m.x < minX) minX = m.x;
              if (m.x > maxX) maxX = m.x;
              if (m.y < minY) minY = m.y;
              if (m.y > maxY) maxY = m.y;
            }

            const marginX = 260;
            const marginY = 240;
            const spanX = maxX - minX + marginX;
            const spanY = maxY - minY + marginY;

            const zoomX = virtualW / spanX;
            const zoomY = virtualH / spanY;
            const targetZoom = Math.max(0.36, Math.min(1.15, Math.min(zoomX, zoomY)));

            const targetX = (minX + maxX) / 2;
            const targetY = (minY + maxY) / 2;

            camXRef.current += (targetX - camXRef.current) * 0.09;
            camYRef.current += (targetY - camYRef.current) * 0.09;
            camZoomRef.current += (targetZoom - camZoomRef.current) * 0.06;
          }
        }

        // Render Canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderCourse(
            ctx,
            course,
            marbles,
            virtualW,
            virtualH,
            camXRef.current,
            camYRef.current,
            camZoomRef.current,
            raceTimeRef.current
          );
        }

        // Throttled HUD & Leaderboard update (5 Hz)
        if (now - lastHudUpdateRef.current > 200) {
          lastHudUpdateRef.current = now;

          const timeSec = raceTimeRef.current;
          const mins = Math.floor(timeSec / 60);
          const secs = Math.floor(timeSec % 60);
          setHudTime(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} / 05:00`);

          if (marbles.length > 0) {
            const leader = marbles[0];
            setHudLeader(leader.name);
            setHudLeaderColor(leader.color);
            const pct = Math.min(
              100,
              Math.max(0, Math.floor((leader.progressScore / course.totalCheckpoints) * 100))
            );
            setHudProgress(pct);
          }

          setStandings([...marbles]);
        }
      }

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="flex w-screen h-screen bg-[#090b12] text-slate-100 font-sans overflow-hidden select-none">
      {/* Center Stage & Adaptive 16:9 / 9:16 Viewport */}
      <main
        ref={stageWrapperRef}
        className="flex-1 h-full flex items-center justify-center bg-[#07090f] relative overflow-hidden"
      >
        <div
          ref={canvasContainerRef}
          className="relative bg-[#0d101b] rounded-xl shadow-[0_0_36px_rgba(0,0,0,0.85)] border border-slate-800/80 overflow-hidden"
        >
          <canvas ref={canvasRef} className="block w-full h-full" />

          {/* Top HUD */}
          <div className="absolute top-3 left-3 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-700/60 shadow-lg z-10 text-xs">
            <div className="flex flex-col">
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">Tiempo / Meta</span>
              <span className="font-mono text-sm font-bold text-white tabular-nums">{hudTime}</span>
            </div>

            <div className="w-[1px] h-7 bg-slate-700/60" />

            <div className="flex flex-col">
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">Líder</span>
              <div className="flex items-center gap-1.5 font-bold text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hudLeaderColor }} />
                <span className="text-white max-w-[120px] truncate" title={hudLeader}>
                  {hudLeader}
                </span>
              </div>
            </div>

            <div className="w-[1px] h-7 bg-slate-700/60" />

            <div className="flex flex-col">
              <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">Progreso</span>
              <span className="font-mono text-sm font-bold text-cyan-400 tabular-nums">{hudProgress}%</span>
            </div>

            <div className="hidden sm:flex items-center gap-2 pl-1 border-l border-slate-700/60 text-slate-400">
              <span className="text-[9px] font-semibold uppercase text-slate-500">Pantalla</span>
              <span className="font-mono font-bold text-xs text-amber-400">{isPortrait ? '9:16' : '16:9'}</span>
            </div>
          </div>

          {/* HUD Speed & Quick Playback Controls */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-lg z-10">
            <button
              onClick={handleToggleSound}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title={soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} className="text-red-400" />}
            </button>

            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title={isPaused ? 'Reanudar carrera' : 'Pausar carrera'}
            >
              {isPaused ? <Play size={16} className="text-emerald-400" /> : <Pause size={16} />}
            </button>

            <div className="w-[1px] h-5 bg-slate-700/60" />

            {SIMULATION_SPEEDS.map((spd) => (
              <button
                key={spd}
                onClick={() => setSimSpeed(spd)}
                className={`px-2 py-1 text-xs font-bold rounded-lg transition-colors ${
                  simSpeed === spd
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {spd}x
              </button>
            ))}

            <div className="w-[1px] h-5 bg-slate-700/60" />

            {/* Camera View Mode Selector */}
            <button
              onClick={() => {
                if (cameraMode === 'half_pack') setCameraMode('leader');
                else if (cameraMode === 'leader') setCameraMode('overview');
                else setCameraMode('half_pack');
              }}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
              title="Cambiar enfoque de cámara"
            >
              <Camera size={13} className="text-amber-400" />
              <span className="hidden md:inline">
                {cameraMode === 'half_pack' ? 'Mitad (50%)' : cameraMode === 'leader' ? 'Líder' : 'Completa'}
              </span>
            </button>
          </div>

          {/* Animated Stage Announcement Banner */}
          <div
            className={`absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-950/90 text-amber-300 font-bold px-5 py-2 rounded-full border border-amber-500/40 shadow-xl backdrop-blur-md text-xs sm:text-sm tracking-wide pointer-events-none transition-all duration-300 ${
              bannerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {stageBanner}
          </div>
        </div>
      </main>

      {/* Mobile Drawer Trigger Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed bottom-4 right-4 z-40 bg-amber-500 text-slate-950 p-3 rounded-full shadow-2xl active:scale-95 transition-transform"
        aria-label="Abrir panel de control"
      >
        <SlidersHorizontal size={22} />
      </button>

      {/* Right Sidebar: Seed, Marble Selector with rename inputs, and Live Standings */}
      <aside
        className={`fixed md:static right-0 top-0 h-full w-84 bg-slate-900/95 md:bg-slate-900 border-l border-slate-800 flex flex-col z-30 transition-transform duration-300 backdrop-blur-md ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
              <span>MIKAN RACE</span>
              <span className="text-amber-500 text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                5 MIN
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Circuito Procedural Multidireccional</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        {/* Scrollable controls */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Action Button: Start / Restart */}
          <button
            onClick={() => startRace()}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
          >
            <RotateCcw size={16} />
            <span>Generar y Correr</span>
          </button>

          {/* Seed Input & Randomizer */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-semibold text-[10px] uppercase tracking-wider">Semilla del Circuito</span>
              <span className="text-[10px] text-slate-500 font-mono">Mulberry32</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startRace()}
                placeholder="Escribe semilla..."
                maxLength={16}
                className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleRandomizeSeed}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold flex items-center gap-1 transition-colors"
                title="Generar semilla aleatoria"
              >
                <Shuffle size={13} className="text-amber-400" />
                <span>Azar</span>
              </button>
            </div>
          </div>

          {/* Marble Selector with editable names */}
          <MarbleSelector
            colors={DEFAULT_MARBLE_COLORS}
            selectedIds={selectedIds}
            customNames={customNames}
            onToggleSelect={handleToggleSelect}
            onNameChange={handleNameChange}
            onSelectAll={handleSelectAll}
            onResetNames={handleResetNames}
          />

          {/* Live Standings Leaderboard */}
          <Leaderboard standings={standings} />
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
          <span>Cámara: Mitad de canicas (50%)</span>
          <span className="font-mono text-amber-400">MIKAN Run</span>
        </div>
      </aside>

      {/* Winner Podium Modal when 1st marble crosses finish line */}
      {winnerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl space-y-4">
            <div className="inline-flex p-3 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <Trophy size={36} />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-black text-white">¡CAMPEÓN DE LA CARRERA!</h2>
              <div className="flex items-center justify-center gap-2 pt-1">
                <span
                  className="w-5 h-5 rounded-full shadow-md"
                  style={{
                    backgroundColor: winnerModal.color,
                    border: winnerModal.border ? `1.5px solid ${winnerModal.border}` : '1px solid #fff',
                  }}
                />
                <span className="text-lg font-bold text-amber-300">{winnerModal.name}</span>
              </div>
              <p className="text-xs text-slate-400 pt-1">
                Completó todo el circuito multidireccional en{' '}
                <span className="font-mono text-white font-bold">
                  {Math.floor((winnerModal.finishTime ?? 0) / 60)}m{' '}
                  {Math.floor((winnerModal.finishTime ?? 0) % 60)}s
                </span>
                !
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setWinnerModal(null)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Seguir Viendo
              </button>
              <button
                onClick={() => {
                  setWinnerModal(null);
                  startRace();
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors"
              >
                Nueva Carrera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
