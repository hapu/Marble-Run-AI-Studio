import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CameraMode,
  CourseData,
  DebugTelemetryStats,
  FocusAnimState,
  MapPower,
  Marble,
  ReplayPlaybackState,
} from './types';
import { DEFAULT_MARBLE_COLORS, DEFAULT_SEED } from './constants';
import { sound } from './audio';
import { generateCourse } from './courseGenerator';
import { initPhysicsEngine, isPhysicsReady, SimulationEngine } from './simulation';
import { renderCourse, RenderFocusFx } from './renderer/index';
import {
  buildHighlightClips,
  createInitialMarbles,
  getDailySeedString,
  getInitialSeedFromHash,
  sampleReplayFrame,
  updateSmartCamera,
} from './utils/raceHelpers';
import { useViewportAspect } from './hooks/useViewportAspect';
import { TopHud } from './components/TopHud';
import { TacticalDock } from './components/TacticalDock';
import { DebugOverlay } from './components/DebugOverlay';
import { LabyrinthMapModal } from './components/LabyrinthMapModal';
import { ResultsModal } from './components/ResultsModal';
import { ControlSidebar } from './components/ControlSidebar';

export default function App() {
  const defaultNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    DEFAULT_MARBLE_COLORS.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, []);

  // Core Race & Config State
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_MARBLE_COLORS.map((c) => c.id));
  const [customNames, setCustomNames] = useState<Record<string, string>>(defaultNamesMap);
  const [seed, setSeed] = useState<string>(() => getInitialSeedFromHash());
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [cameraMode, setCameraMode] = useState<CameraMode>('half_pack');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [patientZeroCount, setPatientZeroCount] = useState<number>(1);
  const [physicsReady, setPhysicsReady] = useState<boolean>(() => isPhysicsReady());

  // Follow Target State
  const [followedMarbleId, setFollowedMarbleId] = useState<string | null>(null);
  const followedMarbleIdRef = useRef<string | null>(null);
  followedMarbleIdRef.current = followedMarbleId;

  // Survival HUD Telemetry (Throttled 2.5 Hz)
  const [hudTime, setHudTime] = useState<string>('00:00 / 05:00');
  const [hudLeader, setHudLeader] = useState<string>('-');
  const [hudLeaderColor, setHudLeaderColor] = useState<string>('#f0be38');
  const [hudProgress, setHudProgress] = useState<number>(0);
  const [livingHumansCount, setLivingHumansCount] = useState<number>(0);
  const [extractedHumansCount, setExtractedHumansCount] = useState<number>(0);
  const [activeZombiesCount, setActiveZombiesCount] = useState<number>(0);
  const [standings, setStandings] = useState<Marble[]>([]);
  const [stageBanner, setStageBanner] = useState<string>('SALA (1,1): SALA DE SALIDA');
  const [bannerVisible, setBannerVisible] = useState<boolean>(true);
  const [activeChunkCount, setActiveChunkCount] = useState<number>(1);

  // Dual Ability Cooldowns
  const [selectedPower, setSelectedPower] = useState<MapPower | null>(null);
  const [boostCooldown, setBoostCooldown] = useState<number>(0);
  const [shieldCooldown, setShieldCooldown] = useState<number>(0);
  const [healCooldown, setHealCooldown] = useState<number>(0);
  const [empCooldown, setEmpCooldown] = useState<number>(0);
  const [barricadeCooldown, setBarricadeCooldown] = useState<number>(0);
  const [airdropCooldown, setAirdropCooldown] = useState<number>(0);
  const [powerHint, setPowerHint] = useState<string | null>(null);

  // Modals & Overlays
  const [showLabyrinthMap, setShowLabyrinthMap] = useState<boolean>(false);
  const [showDebugHud, setShowDebugHud] = useState<boolean>(false);
  const [showSkyline, setShowSkyline] = useState<boolean>(true);
  const [showParticles, setShowParticles] = useState<boolean>(true);
  const [debugStats, setDebugStats] = useState<DebugTelemetryStats>({
    fps: 60,
    worstMs: 16.7,
    physMs: 0.8,
    drawMs: 1.4,
    entities: 0,
  });

  // Post-Race Summary & Highlight Replay
  const [winnerModal, setWinnerModal] = useState<Marble | null>(null);
  const [summaryDismissed, setSummaryDismissed] = useState<boolean>(false);
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replayHudText, setReplayHudText] = useState<string>('');

  // DOM & Simulation Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageWrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const simulationRef = useRef<SimulationEngine>(new SimulationEngine());
  const courseRef = useRef<CourseData | null>(null);

  const camRef = useRef<{ x: number; y: number; zoom: number }>({ x: 500, y: 210, zoom: 1.0 });
  const lastTimeRef = useRef<number>(performance.now());
  const lastHudUpdateRef = useRef<number>(0);
  const firstExtractTimeRef = useRef<number | null>(null);

  const isPausedRef = useRef<boolean>(false);
  const simSpeedRef = useRef<number>(1);
  const cameraModeRef = useRef<CameraMode>('half_pack');
  const showSkylineRef = useRef<boolean>(true);
  const showParticlesRef = useRef<boolean>(true);
  const selectedPowerRef = useRef<MapPower | null>(null);
  const winnerModalRef = useRef<Marble | null>(null);
  const summaryDismissedRef = useRef<boolean>(false);

  isPausedRef.current = isPaused;
  simSpeedRef.current = simSpeed;
  cameraModeRef.current = cameraMode;
  showSkylineRef.current = showSkyline;
  showParticlesRef.current = showParticles;
  selectedPowerRef.current = selectedPower;
  winnerModalRef.current = winnerModal;
  summaryDismissedRef.current = summaryDismissed;

  // Cooldown Refs
  const boostCooldownRef = useRef<number>(0);
  const shieldCooldownRef = useRef<number>(0);
  const healCooldownRef = useRef<number>(0);
  const empCooldownRef = useRef<number>(0);
  const barricadeCooldownRef = useRef<number>(0);
  const airdropCooldownRef = useRef<number>(0);

  // FX & Replay Refs
  const focusAnimRef = useRef<FocusAnimState | null>(null);
  const damageFlashAlphaRef = useRef<number>(0);
  const replayStateRef = useRef<ReplayPlaybackState | null>(null);
  const fpsSamplesRef = useRef({
    frames: 0,
    timer: 0,
    worstMs: 0,
    physMs: 0,
    drawMs: 0,
  });

  const { isFullscreen, toggleFullscreen, updateAspect } = useViewportAspect(
    stageWrapperRef,
    canvasContainerRef,
    canvasRef
  );

  const flashToast = useCallback((msg: string, ms = 2200) => {
    setPowerHint(msg);
    setTimeout(() => {
      setPowerHint((cur) => (cur === msg ? null : cur));
    }, ms);
  }, []);

  const handleToggleSound = useCallback(() => {
    sound.enabled = !soundEnabled;
    setSoundEnabled(!soundEnabled);
  }, [soundEnabled]);

  const handleNameChange = useCallback((id: string, newName: string) => {
    setCustomNames((prev) => ({ ...prev, [id]: newName }));
    const targetMarble = simulationRef.current.getMarbles().find((m) => m.id === id);
    if (targetMarble) targetMarble.name = newName;
  }, []);

  const handleResetNames = useCallback(() => {
    setCustomNames({ ...defaultNamesMap });
    simulationRef.current.getMarbles().forEach((m) => {
      if (defaultNamesMap[m.id]) m.name = defaultNamesMap[m.id];
    });
  }, [defaultNamesMap]);

  const selectFollowMarble = useCallback((id: string | null, switchCam = false) => {
    setFollowedMarbleId(id);
    followedMarbleIdRef.current = id;
    simulationRef.current.setFollowedMarbleId(id);
    if (switchCam && id) {
      setCameraMode('follow');
    }
  }, []);

  const cycleFollowMarble = useCallback(
    (delta: number) => {
      const players = simulationRef.current.getPlayerMarbles();
      if (players.length === 0) return;
      const living = players.filter((m) => !m.isZombie && !m.finished && !m.gone);
      const pool = living.length > 0 ? living : players;
      const curIdx = pool.findIndex((m) => m.id === followedMarbleIdRef.current);
      const nextIdx = curIdx === -1 ? 0 : (curIdx + delta + pool.length) % pool.length;
      selectFollowMarble(pool[nextIdx].id, true);
    },
    [selectFollowMarble]
  );

  const cycleCameraMode = useCallback(() => {
    setCameraMode((cur) =>
      cur === 'follow'
        ? 'half_pack'
        : cur === 'half_pack'
          ? 'leader'
          : cur === 'leader'
            ? 'overview'
            : 'follow'
    );
  }, []);

  const startRace = useCallback(
    (newSeed?: string, pzOverride?: number) => {
      if (!isPhysicsReady()) return;
      const targetSeed = (newSeed ?? seed).trim() || DEFAULT_SEED;
      const numPz = pzOverride ?? patientZeroCount;
      const newCourse = generateCourse(targetSeed);
      courseRef.current = newCourse;

      if (typeof window !== 'undefined') {
        const nextHash = `#seed=${encodeURIComponent(targetSeed)}`;
        if (window.location.hash !== nextHash) {
          window.history.replaceState(null, '', nextHash);
        }
      }

      setWinnerModal(null);
      setSummaryDismissed(false);
      summaryDismissedRef.current = false;
      firstExtractTimeRef.current = null;
      replayStateRef.current = null;
      setIsReplaying(false);
      focusAnimRef.current = null;
      damageFlashAlphaRef.current = 0;

      boostCooldownRef.current = 0;
      shieldCooldownRef.current = 0;
      healCooldownRef.current = 0;
      empCooldownRef.current = 0;
      barricadeCooldownRef.current = 0;
      airdropCooldownRef.current = 0;
      setBoostCooldown(0);
      setShieldCooldown(0);
      setHealCooldown(0);
      setEmpCooldown(0);
      setBarricadeCooldown(0);
      setAirdropCooldown(0);
      setSelectedPower(null);

      const spawned = createInitialMarbles(newCourse, selectedIds, customNames, numPz);
      simulationRef.current.init(newCourse, spawned);
      const firstHuman = spawned.find((m) => !m.isZombie) || spawned[0];
      selectFollowMarble(firstHuman ? firstHuman.id : null, false);

      camRef.current = { x: newCourse.startX, y: newCourse.startY, zoom: 1.0 };

      setStageBanner('SALA (1,1): LABERINTO BIOHAZARD 5×5');
      setBannerVisible(true);
      setTimeout(() => setBannerVisible(false), 2600);
    },
    [seed, selectedIds, customNames, patientZeroCount, selectFollowMarble]
  );

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 2) return prev;
        return prev.filter((c) => c !== id);
      }
      return [...prev, id];
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

  const handleDailySeed = useCallback(() => {
    const daily = getDailySeedString();
    setSeed(daily);
    startRace(daily);
    flashToast(`📅 SEMILLA DIARIA CARGADA: ${daily}`);
  }, [startRace, flashToast]);

  const handleCopySeedLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      flashToast('🔗 ENLACE DE SEMILLA COPIADO');
    } catch {
      flashToast(`🔗 URL ACTUALIZADA: #seed=${seed}`);
    }
  }, [seed, flashToast]);

  const activateTargetedPower = useCallback(
    (kind: 'boost' | 'shield' | 'heal') => {
      const sim = simulationRef.current;
      const targetId =
        followedMarbleIdRef.current ||
        sim.getPlayerMarbles().find((m) => !m.isZombie && !m.finished && !m.gone)?.id;
      if (!targetId) {
        flashToast('NO HAY SUPERVIVIENTE ACTIVO');
        return;
      }

      if (kind === 'boost') {
        if (boostCooldownRef.current > 0) return;
        if (sim.triggerBoost(targetId)) {
          boostCooldownRef.current = 8;
          setBoostCooldown(8);
          flashToast('⚡ TURBO BOOST ACTIVADO');
        } else {
          flashToast('ELIGE UN HUMANO VIVO PARA BOOST');
        }
      } else if (kind === 'shield') {
        if (shieldCooldownRef.current > 0) return;
        if (sim.triggerShield(targetId)) {
          shieldCooldownRef.current = 12;
          setShieldCooldown(12);
          flashToast('🛡️ ESCUDO ENERGÉTICO ACTIVO');
        } else {
          flashToast('ELIGE UN HUMANO VIVO PARA ESCUDO');
        }
      } else if (kind === 'heal') {
        if (healCooldownRef.current > 0) return;
        if (sim.triggerHeal(targetId)) {
          healCooldownRef.current = 14;
          setHealCooldown(14);
          flashToast('❤️ CURACIÓN +2 HP APLICADA');
        } else {
          flashToast('HP AL MÁXIMO O CANICA NO VÁLIDA');
        }
      }
    },
    [flashToast]
  );

  const activateMapPower = useCallback(
    (power: MapPower, targetX?: number, targetY?: number) => {
      const sim = simulationRef.current;
      let tx = targetX;
      let ty = targetY;
      if (tx === undefined || ty === undefined) {
        const leader = sim.getLeader();
        tx = leader ? (leader.renderX ?? leader.x) : camRef.current.x;
        ty = leader ? (leader.renderY ?? leader.y) : camRef.current.y;
      }

      if (power === 'emp') {
        if (empCooldownRef.current > 0) return;
        sim.triggerEmp(tx, ty);
        empCooldownRef.current = 12;
        setEmpCooldown(12);
        setSelectedPower(null);
        flashToast('💥 ¡ONDA EMP DESCARGADA!');
      } else if (power === 'barricade') {
        if (barricadeCooldownRef.current > 0) return;
        sim.deployBarricade(tx, ty);
        barricadeCooldownRef.current = 10;
        setBarricadeCooldown(10);
        setSelectedPower(null);
        flashToast('🛡️ ¡BARRICADA LÁSER DESPLEGADA!');
      } else if (power === 'airdrop') {
        if (airdropCooldownRef.current > 0) return;
        sim.deployAirdrop(tx, ty);
        airdropCooldownRef.current = 15;
        setAirdropCooldown(15);
        setSelectedPower(null);
        flashToast('📦 ¡SUMINISTRO AÉREO LANZADO!');
      }
    },
    [flashToast]
  );

  const handleSelectMapPower = useCallback((power: MapPower) => {
    setSelectedPower((cur) => (cur === power ? null : power));
  }, []);

  const startHighlightReplay = useCallback(() => {
    const sim = simulationRef.current;
    const frames = sim.getReplayFrames();
    const chosen = buildHighlightClips(sim.getHighlightEvents());
    if (frames.length < 4 || chosen.length === 0) {
      flashToast('SIN MOMENTOS DESTACADOS GRABADOS');
      return;
    }

    setWinnerModal(null);
    setSummaryDismissed(true);
    summaryDismissedRef.current = true;
    replayStateRef.current = {
      clips: chosen,
      clipIndex: 0,
      curT: chosen[0].startT,
    };
    setIsReplaying(true);
    setReplayHudText(`1/${chosen.length} · ${chosen[0].event.text}`);
  }, [flashToast]);

  const stopHighlightReplay = useCallback(() => {
    const sim = simulationRef.current;
    replayStateRef.current = null;
    setIsReplaying(false);
    const w = sim.getWinner() || sim.getLeader();
    if (w) {
      setSummaryDismissed(false);
      summaryDismissedRef.current = false;
      setWinnerModal(w);
    }
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (replayStateRef.current) {
        stopHighlightReplay();
        return;
      }
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const scaleX = canvasRef.current.width / rect.width;
      const scaleY = canvasRef.current.height / rect.height;
      const screenX = (e.clientX - rect.left) * scaleX;
      const screenY = (e.clientY - rect.top) * scaleY;
      const worldX = (screenX - canvasRef.current.width / 2) / camRef.current.zoom + camRef.current.x;
      const worldY = (screenY - canvasRef.current.height / 2) / camRef.current.zoom + camRef.current.y;

      if (selectedPowerRef.current) {
        activateMapPower(selectedPowerRef.current, worldX, worldY);
        return;
      }

      const marbles = simulationRef.current.getMarbles();
      let best: Marble | null = null;
      let bestD = 44;
      for (let i = 0; i < marbles.length; i++) {
        const m = marbles[i];
        if (m.gone) continue;
        const mx = m.renderX ?? m.x;
        const my = m.renderY ?? m.y;
        const d = Math.hypot(mx - worldX, my - worldY);
        if (d < bestD) {
          bestD = d;
          best = m;
        }
      }
      if (best) {
        selectFollowMarble(best.id, true);
        flashToast(`🎯 SIGUIENDO A ${best.name.toUpperCase()}`, 1600);
      }
    },
    [activateMapPower, selectFollowMarble, stopHighlightReplay, flashToast]
  );

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') activateTargetedPower('boost');
      else if (e.key === '2') activateTargetedPower('shield');
      else if (e.key === '3') activateTargetedPower('heal');
      else if (e.key === '4') {
        if (empCooldownRef.current <= 0) handleSelectMapPower('emp');
      } else if (e.key === '5') {
        if (barricadeCooldownRef.current <= 0) handleSelectMapPower('barricade');
      } else if (e.key === '6') {
        if (airdropCooldownRef.current <= 0) handleSelectMapPower('airdrop');
      } else if (e.key === '[') {
        cycleFollowMarble(-1);
      } else if (e.key === ']') {
        cycleFollowMarble(1);
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((p) => !p);
      } else if (e.key.toLowerCase() === 'm') {
        setShowLabyrinthMap((v) => !v);
      } else if (e.key.toLowerCase() === 'd') {
        setShowDebugHud((v) => !v);
      } else if (e.key === 'Escape') {
        setSelectedPower(null);
        setShowLabyrinthMap(false);
        if (replayStateRef.current) stopHighlightReplay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activateTargetedPower, handleSelectMapPower, cycleFollowMarble, stopHighlightReplay]);

  // Initial Race Boot (Async Rapier2D WASM Init)
  useEffect(() => {
    let cancelled = false;
    updateAspect();
    initPhysicsEngine().then(() => {
      if (cancelled) return;
      setPhysicsReady(true);
      startRace();
    });
    return () => {
      cancelled = true;
      simulationRef.current.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Main Simulation, Replay & Render Loop
  useEffect(() => {
    let animId: number;

    const gameLoop = (now: number) => {
      const rawDt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;

      const sim = simulationRef.current;
      const course = sim.getCourse();
      const marbles = sim.getMarbles();
      const canvas = canvasRef.current;

      if (course && marbles.length > 0 && canvas) {
        const virtualW = canvas.width;
        const virtualH = canvas.height;
        const rep = replayStateRef.current;

        if (rep) {
          rep.curT += rawDt * 0.35;
          const activeClip = rep.clips[rep.clipIndex];
          if (rep.curT >= activeClip.endT) {
            rep.clipIndex++;
            if (rep.clipIndex >= rep.clips.length) {
              stopHighlightReplay();
            } else {
              const nextClip = rep.clips[rep.clipIndex];
              rep.curT = nextClip.startT;
              setReplayHudText(`${rep.clipIndex + 1}/${rep.clips.length} · ${nextClip.event.text}`);
            }
          }

          if (replayStateRef.current) {
            const clipNow = replayStateRef.current.clips[replayStateRef.current.clipIndex];
            const snapMarbles = sampleReplayFrame(
              sim.getReplayFrames(),
              replayStateRef.current.curT,
              marbles
            );
            const hero = snapMarbles.find((m) => m.id === clipNow.event.marbleId) || snapMarbles[0];
            if (hero) {
              camRef.current.x += (hero.x - camRef.current.x) * 0.16;
              camRef.current.y += (hero.y - camRef.current.y) * 0.16;
              camRef.current.zoom += (1.18 - camRef.current.zoom) * 0.1;
            }
            const ctx = canvas.getContext('2d');
            if (ctx) {
              renderCourse(
                ctx,
                course,
                snapMarbles,
                virtualW,
                virtualH,
                camRef.current.x,
                camRef.current.y,
                camRef.current.zoom,
                replayStateRef.current.curT,
                [],
                [],
                [],
                [],
                [],
                {
                  followedMarbleId: hero?.id,
                  showSkyline: showSkylineRef.current,
                  showParticles: showParticlesRef.current,
                  focusFx: hero
                    ? {
                        x: hero.x,
                        y: hero.y,
                        color: clipNow.event.color,
                        text: clipNow.event.text,
                        progress: 0.35,
                      }
                    : null,
                }
              );
            }
          }
          animId = requestAnimationFrame(gameLoop);
          return;
        }

        const tPhysStart = performance.now();
        const trigFocus = sim.consumePendingFocus();
        if (trigFocus) {
          focusAnimRef.current = {
            x: trigFocus.x,
            y: trigFocus.y,
            color: trigFocus.color,
            text: trigFocus.text,
            elapsed: 0,
            duration: trigFocus.durationSec,
          };
        }
        if (sim.consumePendingDamageFlash()) {
          damageFlashAlphaRef.current = 0.65;
        }
        if (damageFlashAlphaRef.current > 0) {
          damageFlashAlphaRef.current = Math.max(0, damageFlashAlphaRef.current - rawDt * 2.2);
        }

        let effectiveSimSpeed = simSpeedRef.current;
        let renderFocusFx: RenderFocusFx | null = null;
        if (focusAnimRef.current) {
          focusAnimRef.current.elapsed += rawDt;
          if (focusAnimRef.current.elapsed >= focusAnimRef.current.duration) {
            focusAnimRef.current = null;
          } else {
            effectiveSimSpeed = Math.min(effectiveSimSpeed, 0.3);
            renderFocusFx = {
              x: focusAnimRef.current.x,
              y: focusAnimRef.current.y,
              color: focusAnimRef.current.color,
              text: focusAnimRef.current.text,
              progress: focusAnimRef.current.elapsed / focusAnimRef.current.duration,
            };
          }
        }

        sim.update(rawDt, effectiveSimSpeed, isPausedRef.current, {
          onWinner: (winner) => {
            if (firstExtractTimeRef.current === null) {
              firstExtractTimeRef.current = sim.getRaceTime();
            }
            if (!winnerModalRef.current && !summaryDismissedRef.current) {
              const living = marbles.filter((m) => !m.id.startsWith('npc_') && !m.isZombie && !m.finished);
              if (living.length === 0) {
                setWinnerModal(winner);
              }
            }
          },
          onStageChange: (stageName) => {
            setStageBanner(stageName);
            setBannerVisible(true);
            setTimeout(() => setBannerVisible(false), 2400);
          },
        });
        const physMs = performance.now() - tPhysStart;

        if (!isPausedRef.current) {
          const stepSec = rawDt * effectiveSimSpeed;
          if (boostCooldownRef.current > 0) boostCooldownRef.current = Math.max(0, boostCooldownRef.current - stepSec);
          if (shieldCooldownRef.current > 0) shieldCooldownRef.current = Math.max(0, shieldCooldownRef.current - stepSec);
          if (healCooldownRef.current > 0) healCooldownRef.current = Math.max(0, healCooldownRef.current - stepSec);
          if (empCooldownRef.current > 0) empCooldownRef.current = Math.max(0, empCooldownRef.current - stepSec);
          if (barricadeCooldownRef.current > 0) barricadeCooldownRef.current = Math.max(0, barricadeCooldownRef.current - stepSec);
          if (airdropCooldownRef.current > 0) airdropCooldownRef.current = Math.max(0, airdropCooldownRef.current - stepSec);
        }

        updateSmartCamera(
          camRef.current,
          cameraModeRef.current,
          marbles,
          followedMarbleIdRef.current,
          focusAnimRef.current,
          sim.getLeader(),
          virtualW,
          virtualH
        );

        const tDrawStart = performance.now();
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderCourse(
            ctx,
            course,
            marbles,
            virtualW,
            virtualH,
            camRef.current.x,
            camRef.current.y,
            camRef.current.zoom,
            sim.getRaceTime(),
            sim.getProjectiles(),
            sim.getParticles(),
            sim.getFloatingTexts(),
            sim.getBarricades(),
            sim.getCombatFeed(),
            {
              followedMarbleId: followedMarbleIdRef.current,
              showSkyline: showSkylineRef.current,
              showParticles: showParticlesRef.current,
              focusFx: renderFocusFx,
              damageFlashAlpha: damageFlashAlphaRef.current,
            }
          );
        }
        const drawMs = performance.now() - tDrawStart;

        const frameMs = rawDt * 1000;
        fpsSamplesRef.current.frames++;
        fpsSamplesRef.current.timer += rawDt;
        fpsSamplesRef.current.worstMs = Math.max(fpsSamplesRef.current.worstMs, frameMs);
        fpsSamplesRef.current.physMs = physMs;
        fpsSamplesRef.current.drawMs = drawMs;

        // Throttled HUD updates (2.5 Hz)
        if (now - lastHudUpdateRef.current > 400) {
          lastHudUpdateRef.current = now;

          const timeSec = sim.getRaceTime();
          const mins = Math.floor(timeSec / 60);
          const secs = Math.floor(timeSec % 60);
          setHudTime(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} / 05:00`);

          const leader = sim.getLeader();
          if (leader) {
            setHudLeader(leader.name);
            setHudLeaderColor(leader.isZombie ? '#22c55e' : leader.color);
            setHudProgress(sim.getLeaderProgressPercent());
          }

          const players = sim.getPlayerMarbles();
          const living = players.filter((m) => !m.isZombie && !m.finished).length;
          const extracted = players.filter((m) => m.isExtracted).length;
          const zombies = marbles.filter((m) => m.isZombie && !m.gone).length;

          setLivingHumansCount(living);
          setExtractedHumansCount(extracted);
          setActiveZombiesCount(zombies);

          setBoostCooldown(Math.ceil(boostCooldownRef.current));
          setShieldCooldown(Math.ceil(shieldCooldownRef.current));
          setHealCooldown(Math.ceil(healCooldownRef.current));
          setEmpCooldown(Math.ceil(empCooldownRef.current));
          setBarricadeCooldown(Math.ceil(barricadeCooldownRef.current));
          setAirdropCooldown(Math.ceil(airdropCooldownRef.current));
          setActiveChunkCount(sim.getActiveChunkCount());

          if (fpsSamplesRef.current.timer > 0) {
            setDebugStats({
              fps: Math.round(fpsSamplesRef.current.frames / fpsSamplesRef.current.timer),
              worstMs: Number(fpsSamplesRef.current.worstMs.toFixed(1)),
              physMs: Number(fpsSamplesRef.current.physMs.toFixed(2)),
              drawMs: Number(fpsSamplesRef.current.drawMs.toFixed(2)),
              entities:
                marbles.filter((m) => !m.gone).length +
                sim.getProjectiles().length +
                sim.getParticles().length,
            });
            fpsSamplesRef.current.frames = 0;
            fpsSamplesRef.current.timer = 0;
            fpsSamplesRef.current.worstMs = 0;
          }

          if (!winnerModalRef.current && !summaryDismissedRef.current) {
            if (living === 0) {
              const winCandidate =
                sim.getWinner() ||
                (extracted > 0
                  ? players.find((m) => m.isExtracted)
                  : [...players].sort((a, b) => (b.kills || 0) - (a.kills || 0))[0]);
              if (winCandidate) setWinnerModal(winCandidate);
            } else if (firstExtractTimeRef.current !== null && timeSec - firstExtractTimeRef.current >= 3.5) {
              const winCandidate = sim.getWinner();
              if (winCandidate) setWinnerModal(winCandidate);
            }
          }

          setStandings([...marbles]);
        }
      }

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, [stopHighlightReplay]);

  const followedMarble = useMemo(
    () => standings.find((m) => m.id === followedMarbleId) || null,
    [standings, followedMarbleId]
  );

  const deadliestRoomText = useMemo(() => {
    const counts = simulationRef.current.getRoomDamageCounts();
    const course = courseRef.current;
    let bestId = -1;
    let bestDmg = 0;
    for (const [k, v] of Object.entries(counts)) {
      if (v > bestDmg) {
        bestDmg = v;
        bestId = Number(k);
      }
    }
    if (bestId === -1 || !course?.chunks[bestId]) return 'Ninguna (sin bajas)';
    const r = course.chunks[bestId];
    return `Sala (${r.col + 1},${r.row + 1}) · ${r.name} (${bestDmg} impactos)`;
  }, [winnerModal]);

  const totalKillsCount = useMemo(
    () =>
      standings
        .filter((m) => !m.id.startsWith('npc_') && !m.isZombie)
        .reduce((acc, m) => acc + (m.kills || 0), 0),
    [standings]
  );

  return (
    <div className="flex w-screen h-screen bg-[#090b12] text-slate-100 font-sans overflow-hidden select-none">
      <main
        ref={stageWrapperRef}
        className="flex-1 h-full flex items-center justify-center bg-[#07090f] relative overflow-hidden"
      >
        <div
          ref={canvasContainerRef}
          className="relative bg-[#0d101b] rounded-xl shadow-[0_0_36px_rgba(0,0,0,0.85)] border border-slate-800/80 overflow-hidden"
        >
          <canvas
            ref={canvasRef}
            className="block w-full h-full"
            onClick={handleCanvasClick}
            style={{ cursor: selectedPower ? 'crosshair' : 'pointer' }}
          />

          {!physicsReady && (
            <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-slate-200">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
              <span className="text-xs font-mono tracking-wider text-emerald-300 uppercase">
                Inicializando motor físico Rapier2D...
              </span>
            </div>
          )}

          <TopHud
            hudTime={hudTime}
            livingHumansCount={livingHumansCount}
            extractedHumansCount={extractedHumansCount}
            activeZombiesCount={activeZombiesCount}
            hudLeader={hudLeader}
            hudLeaderColor={hudLeaderColor}
            hudProgress={hudProgress}
            followedMarble={followedMarble}
            onCycleFollow={cycleFollowMarble}
            soundEnabled={soundEnabled}
            onToggleSound={handleToggleSound}
            isPaused={isPaused}
            onTogglePause={() => setIsPaused((p) => !p)}
            simSpeed={simSpeed}
            onSelectSpeed={setSimSpeed}
            cameraMode={cameraMode}
            onCycleCameraMode={cycleCameraMode}
            showLabyrinthMap={showLabyrinthMap}
            onToggleLabyrinthMap={() => setShowLabyrinthMap((v) => !v)}
            showDebugHud={showDebugHud}
            onToggleDebugHud={() => setShowDebugHud((v) => !v)}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
          />

          {showDebugHud && (
            <DebugOverlay
              stats={debugStats}
              activeChunkCount={activeChunkCount}
              showSkyline={showSkyline}
              showParticles={showParticles}
              onToggleSkyline={() => setShowSkyline((v) => !v)}
              onToggleParticles={() => setShowParticles((v) => !v)}
              onClose={() => setShowDebugHud(false)}
            />
          )}

          <TacticalDock
            isReplaying={isReplaying}
            replayHudText={replayHudText}
            onStopReplay={stopHighlightReplay}
            powerHint={powerHint}
            selectedPower={selectedPower}
            onSelectMapPower={handleSelectMapPower}
            onActivateTargetedPower={activateTargetedPower}
            boostCooldown={boostCooldown}
            shieldCooldown={shieldCooldown}
            healCooldown={healCooldown}
            empCooldown={empCooldown}
            barricadeCooldown={barricadeCooldown}
            airdropCooldown={airdropCooldown}
            stageBanner={stageBanner}
            bannerVisible={bannerVisible}
          />

          {showLabyrinthMap && courseRef.current && (
            <LabyrinthMapModal
              course={courseRef.current}
              seed={seed}
              standings={standings}
              onClose={() => setShowLabyrinthMap(false)}
            />
          )}
        </div>
      </main>

      <ControlSidebar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={setSidebarOpen}
        onStartRace={startRace}
        patientZeroCount={patientZeroCount}
        onSelectPatientZero={(num) => {
          setPatientZeroCount(num);
          startRace(undefined, num);
        }}
        seed={seed}
        onSeedChange={setSeed}
        onRandomizeSeed={handleRandomizeSeed}
        onDailySeed={handleDailySeed}
        onCopySeedLink={handleCopySeedLink}
        selectedIds={selectedIds}
        customNames={customNames}
        onToggleSelect={handleToggleSelect}
        onNameChange={handleNameChange}
        onSelectAll={handleSelectAll}
        onResetNames={handleResetNames}
        standings={standings}
        followedMarbleId={followedMarbleId}
        onFollowMarble={(id) => selectFollowMarble(id, true)}
        activeChunkCount={activeChunkCount}
      />

      {winnerModal && (
        <ResultsModal
          winnerModal={winnerModal}
          extractedHumansCount={extractedHumansCount}
          seed={seed}
          totalKillsCount={totalKillsCount}
          hudTime={hudTime}
          deadliestRoomText={deadliestRoomText}
          onStartHighlightReplay={startHighlightReplay}
          onDismissSummary={() => {
            setSummaryDismissed(true);
            summaryDismissedRef.current = true;
            setWinnerModal(null);
          }}
          onNewRace={() => {
            setWinnerModal(null);
            startRace();
          }}
        />
      )}
    </div>
  );
}
