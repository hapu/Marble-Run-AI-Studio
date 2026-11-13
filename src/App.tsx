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
  CheckCircle2,
  Skull,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Package,
  Crosshair,
  Shield,
  Heart,
  Flame,
  Map as MapIcon,
  Bug,
  Maximize2,
  Minimize2,
  Calendar,
  Link2,
  ChevronLeft,
  ChevronRight,
  Film,
  X,
} from 'lucide-react';
import {
  Marble,
  CourseData,
  HighlightEvent,
  ReplayFrame,
} from './types';
import {
  DEFAULT_MARBLE_COLORS,
  SIMULATION_SPEEDS,
  WEAPON_SPECS,
  ZOMBIE_SPECS,
} from './constants';
import { sound } from './audio';
import { generateCourse } from './courseGenerator';
import { SimulationEngine, initPhysicsEngine, isPhysicsReady } from './simulation';
import { renderCourse, RenderFocusFx } from './renderer';
import { MarbleSelector } from './components/MarbleSelector';
import { Leaderboard } from './components/Leaderboard';

type CameraMode = 'follow' | 'half_pack' | 'leader' | 'overview';
type MapPower = 'emp' | 'barricade' | 'airdrop';

interface FocusAnimState {
  x: number;
  y: number;
  color: string;
  text: string;
  elapsed: number;
  duration: number;
}

interface ReplayPlaybackState {
  clips: Array<{ event: HighlightEvent; startT: number; endT: number }>;
  clipIndex: number;
  curT: number;
}

function getInitialSeedFromHash(): string {
  if (typeof window === 'undefined') return 'zombierun808';
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return 'zombierun808';
  if (raw.startsWith('seed=')) {
    const val = decodeURIComponent(raw.slice(5)).trim();
    return val || 'zombierun808';
  }
  return decodeURIComponent(raw).trim() || 'zombierun808';
}

function getDailySeedString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `d${y}${m}${day}`;
}

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
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [physicsReady, setPhysicsReady] = useState<boolean>(() => isPhysicsReady());

  // Follow Target State
  const [followedMarbleId, setFollowedMarbleId] = useState<string | null>(null);
  const followedMarbleIdRef = useRef<string | null>(null);
  followedMarbleIdRef.current = followedMarbleId;

  // Survival HUD Telemetry (Throttled)
  const [hudTime, setHudTime] = useState<string>('00:00 / 05:00');
  const [hudLeader, setHudLeader] = useState<string>('-');
  const [hudLeaderColor, setHudLeaderColor] = useState<string>('#f0be38');
  const [hudProgress, setHudProgress] = useState<number>(0);
  const [livingHumansCount, setLivingHumansCount] = useState<number>(0);
  const [extractedHumansCount, setExtractedHumansCount] = useState<number>(0);
  const [activeZombiesCount, setActiveZombiesCount] = useState<number>(0);
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [standings, setStandings] = useState<Marble[]>([]);
  const [stageBanner, setStageBanner] = useState<string>('SALA (1,1): SALA DE SALIDA');
  const [bannerVisible, setBannerVisible] = useState<boolean>(true);
  const [activeChunkCount, setActiveChunkCount] = useState<number>(1);

  // Dual Ability Cooldowns: Targeted (Boost/Shield/Heal) + Map Commander (EMP/Barricade/Airdrop)
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
  const [debugStats, setDebugStats] = useState({
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

  const camXRef = useRef<number>(500);
  const camYRef = useRef<number>(210);
  const camZoomRef = useRef<number>(1.0);
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
  const fpsSamplesRef = useRef<{ frames: number; timer: number; worstMs: number; physMs: number; drawMs: number }>({
    frames: 0,
    timer: 0,
    worstMs: 0,
    physMs: 0,
    drawMs: 0,
  });

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

  const cycleFollowMarble = useCallback((delta: number) => {
    const players = simulationRef.current.getPlayerMarbles();
    if (players.length === 0) return;
    const living = players.filter((m) => !m.isZombie && !m.finished && !m.gone);
    const pool = living.length > 0 ? living : players;
    const curIdx = pool.findIndex((m) => m.id === followedMarbleIdRef.current);
    const nextIdx = curIdx === -1 ? 0 : (curIdx + delta + pool.length) % pool.length;
    selectFollowMarble(pool[nextIdx].id, true);
  }, [selectFollowMarble]);

  // Start / Re-seed 5x5 Labyrinth Survival Race
  const startRace = useCallback((newSeed?: string, pzOverride?: number) => {
    if (!isPhysicsReady()) return;
    const targetSeed = (newSeed ?? seed).trim() || 'zombierun808';
    const numPz = pzOverride ?? patientZeroCount;
    const newCourse = generateCourse(targetSeed);
    courseRef.current = newCourse;

    // Sync URL hash cleanly for deterministic sharing
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

    // Reset ability cooldowns
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

    const activeDefs = DEFAULT_MARBLE_COLORS.filter((c) => selectedIds.includes(c.id));
    const count = activeDefs.length;

    const spawned: Marble[] = activeDefs.map((def, idx) => {
      const offsetX = ((idx % 5) - 2) * 26;
      const offsetY = Math.floor(idx / 5) * 24;
      const assignedName = customNames[def.id]?.trim() || def.name;
      const startPosX = newCourse.startX + offsetX;
      const startPosY = newCourse.startY + offsetY;
      // Put Patient Zero(s) at the back of the spawn cluster (end of array)
      const isPatientZero = idx >= count - numPz;

      return {
        id: def.id,
        name: assignedName,
        color: def.color,
        border: def.border,
        mass: def.mass ?? 1.0,
        restitution: def.restitution ?? 0.5,
        materialType: def.materialType ?? 'glass',
        x: startPosX,
        y: startPosY,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 1.0 + Math.random(),
        angle: 0,
        omega: 0,
        prevX: startPosX,
        prevY: startPosY,
        prevAngle: 0,
        renderX: startPosX,
        renderY: startPosY,
        renderAngle: 0,
        radius: 12.5,
        rank: idx + 1,
        finished: false,
        finishTime: null,
        finishPosition: null,
        currentCheckpointIdx: 0,
        progressScore: 0,
        history: [],
        isZombie: isPatientZero,
        zombieType: isPatientZero ? 'runner' : undefined,
        zhp: isPatientZero ? ZOMBIE_SPECS.runner.hp : undefined,
        maxZhp: isPatientZero ? ZOMBIE_SPECS.runner.hp : undefined,
        zSpeedMult: isPatientZero ? ZOMBIE_SPECS.runner.speedMult : undefined,
        zForceMult: isPatientZero ? ZOMBIE_SPECS.runner.forceMult : undefined,
        hp: 5,
        maxHp: 5,
        shield: 0,
        infectionTime: isPatientZero ? 0 : null,
        kills: 0,
        isExtracted: false,
        weaponCooldown: 0,
        weaponType: 'blaster',
        weaponUpgradeTimer: 0,
        aimAngle: 0,
        currentRoomId: 0,
      };
    });

    simulationRef.current.init(newCourse, spawned);
    const firstHuman = spawned.find((m) => !m.isZombie) || spawned[0];
    selectFollowMarble(firstHuman ? firstHuman.id : null, false);

    camXRef.current = newCourse.startX;
    camYRef.current = newCourse.startY;
    camZoomRef.current = 1.0;

    setStageBanner('SALA (1,1): LABERINTO BIOHAZARD 5×5');
    setBannerVisible(true);
    setTimeout(() => setBannerVisible(false), 2600);
  }, [seed, selectedIds, customNames, patientZeroCount, selectFollowMarble]);

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

  // Targeted Marble Powers (Boost, Shield, Heal) on followed marble
  const activateTargetedPower = useCallback((kind: 'boost' | 'shield' | 'heal') => {
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
  }, [flashToast]);

  // Map-Click Commander Powers (EMP, Barricade, Airdrop)
  const activateMapPower = useCallback((power: MapPower, targetX?: number, targetY?: number) => {
    const sim = simulationRef.current;
    let tx = targetX;
    let ty = targetY;
    if (tx === undefined || ty === undefined) {
      const leader = sim.getLeader();
      tx = leader ? (leader.renderX ?? leader.x) : camXRef.current;
      ty = leader ? (leader.renderY ?? leader.y) : camYRef.current;
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
  }, [flashToast]);

  // Launch Post-Race Highlight Reel
  const startHighlightReplay = useCallback(() => {
    const sim = simulationRef.current;
    const frames = sim.getReplayFrames();
    const events = [...sim.getHighlightEvents()].sort((a, b) => b.weight - a.weight);
    if (frames.length < 4 || events.length === 0) {
      flashToast('SIN MOMENTOS DESTACADOS GRABADOS');
      return;
    }

    const chosen: Array<{ event: HighlightEvent; startT: number; endT: number }> = [];
    for (const ev of events) {
      if (chosen.length >= 5) break;
      const overlaps = chosen.some((c) => Math.abs(c.event.t - ev.t) < 2.2);
      if (!overlaps) {
        chosen.push({
          event: ev,
          startT: Math.max(0, ev.t - 1.4),
          endT: ev.t + 1.0,
        });
      }
    }
    chosen.sort((a, b) => a.event.t - b.event.t);

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

  // Canvas Click: Exit replay OR place commander power OR Tap-to-Follow marble
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
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
    const worldX = (screenX - canvasRef.current.width / 2) / camZoomRef.current + camXRef.current;
    const worldY = (screenY - canvasRef.current.height / 2) / camZoomRef.current + camYRef.current;

    if (selectedPowerRef.current) {
      activateMapPower(selectedPowerRef.current, worldX, worldY);
      return;
    }

    // Tap-to-Follow nearest marble within 44px
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
  }, [activateMapPower, selectFollowMarble, stopHighlightReplay, flashToast]);

  // Keyboard Shortcuts: 1..3 Targeted, 4..6 Map Powers, [ / ] Follow Cycle, Space Pause, M Map, D Debug, Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '1') activateTargetedPower('boost');
      else if (e.key === '2') activateTargetedPower('shield');
      else if (e.key === '3') activateTargetedPower('heal');
      else if (e.key === '4') {
        if (empCooldownRef.current <= 0) setSelectedPower((p) => (p === 'emp' ? null : 'emp'));
      } else if (e.key === '5') {
        if (barricadeCooldownRef.current <= 0) setSelectedPower((p) => (p === 'barricade' ? null : 'barricade'));
      } else if (e.key === '6') {
        if (airdropCooldownRef.current <= 0) setSelectedPower((p) => (p === 'airdrop' ? null : 'airdrop'));
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
  }, [activateTargetedPower, cycleFollowMarble, stopHighlightReplay]);

  // Fullscreen sync
  const handleToggleFullscreen = useCallback(() => {
    if (!stageWrapperRef.current) return;
    if (!document.fullscreenElement) {
      stageWrapperRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // Viewport Aspect Ratio (16:9 or 9:16)
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

    const sampleReplayFrame = (frames: ReplayFrame[], t: number, baseMarbles: Marble[]): Marble[] => {
      if (frames.length === 0) return baseMarbles;
      let idx = 0;
      while (idx < frames.length - 1 && frames[idx + 1].t < t) idx++;
      const f0 = frames[idx];
      const f1 = frames[Math.min(frames.length - 1, idx + 1)];
      const span = Math.max(0.0001, f1.t - f0.t);
      const frac = Math.max(0, Math.min(1, (t - f0.t) / span));

      const map1 = new Map(f1.marbles.map((s) => [s.id, s]));
      return f0.marbles.map((s0) => {
        const s1 = map1.get(s0.id) || s0;
        const meta = baseMarbles.find((b) => b.id === s0.id);
        return {
          ...(meta || ({} as Marble)),
          id: s0.id,
          name: meta?.name || (s0.zombieType ? ZOMBIE_SPECS[s0.zombieType].label : s0.id),
          color: meta?.color || '#4d9b36',
          border: meta?.border,
          mass: meta?.mass ?? 1,
          restitution: meta?.restitution ?? 0.5,
          x: s0.x + (s1.x - s0.x) * frac,
          y: s0.y + (s1.y - s0.y) * frac,
          renderX: s0.x + (s1.x - s0.x) * frac,
          renderY: s0.y + (s1.y - s0.y) * frac,
          vx: (s1.x - s0.x) * 20,
          vy: (s1.y - s0.y) * 20,
          angle: s0.angle + (s1.angle - s0.angle) * frac,
          renderAngle: s0.angle + (s1.angle - s0.angle) * frac,
          omega: 0,
          radius: s0.radius,
          rank: meta?.rank ?? 1,
          finished: s0.finished,
          finishTime: meta?.finishTime ?? null,
          finishPosition: meta?.finishPosition ?? null,
          currentCheckpointIdx: 0,
          progressScore: 0,
          history: [],
          isZombie: s0.isZombie,
          zombieType: s0.zombieType,
          hp: s0.hp,
          maxHp: 5,
          zhp: s0.zhp,
          maxZhp: s0.maxZhp,
          isExtracted: s0.isExtracted,
          gone: s0.gone,
          shield: s0.shield,
          weaponType: s0.weaponType,
        };
      });
    };

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
          // ==========================================
          // HIGHLIGHT REPLAY MODE (0.35x Slow-Motion)
          // ==========================================
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
            const snapMarbles = sampleReplayFrame(sim.getReplayFrames(), replayStateRef.current.curT, marbles);
            const hero = snapMarbles.find((m) => m.id === clipNow.event.marbleId) || snapMarbles[0];
            if (hero) {
              camXRef.current += (hero.x - camXRef.current) * 0.16;
              camYRef.current += (hero.y - camYRef.current) * 0.16;
              camZoomRef.current += (1.18 - camZoomRef.current) * 0.1;
            }
            const ctx = canvas.getContext('2d');
            if (ctx) {
              renderCourse(
                ctx,
                course,
                snapMarbles,
                virtualW,
                virtualH,
                camXRef.current,
                camYRef.current,
                camZoomRef.current,
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

        // ==========================================
        // 1. ADVANCE PHYSICS (With Slow-Mo Focus Dilation)
        // ==========================================
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
              // Wait briefly if other living humans are still running so they can finish/turn, else show immediately
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

        // Decay Ability Cooldowns
        if (!isPausedRef.current) {
          const stepSec = rawDt * effectiveSimSpeed;
          if (boostCooldownRef.current > 0) boostCooldownRef.current = Math.max(0, boostCooldownRef.current - stepSec);
          if (shieldCooldownRef.current > 0) shieldCooldownRef.current = Math.max(0, shieldCooldownRef.current - stepSec);
          if (healCooldownRef.current > 0) healCooldownRef.current = Math.max(0, healCooldownRef.current - stepSec);
          if (empCooldownRef.current > 0) empCooldownRef.current = Math.max(0, empCooldownRef.current - stepSec);
          if (barricadeCooldownRef.current > 0) barricadeCooldownRef.current = Math.max(0, barricadeCooldownRef.current - stepSec);
          if (airdropCooldownRef.current > 0) airdropCooldownRef.current = Math.max(0, airdropCooldownRef.current - stepSec);
        }

        // ==========================================
        // 2. SMART CAMERA (Focus -> Follow -> Leader -> Half-Pack -> Overview)
        // ==========================================
        const playerMarbles = marbles.filter((m) => !m.id.startsWith('npc_') && !m.gone);
        const mode = cameraModeRef.current;

        if (focusAnimRef.current) {
          camXRef.current += (focusAnimRef.current.x - camXRef.current) * 0.18;
          camYRef.current += (focusAnimRef.current.y - camYRef.current) * 0.18;
          camZoomRef.current += (1.22 - camZoomRef.current) * 0.12;
        } else if (mode === 'follow' && followedMarbleIdRef.current) {
          const target = marbles.find((m) => m.id === followedMarbleIdRef.current && !m.gone) || playerMarbles[0];
          if (target) {
            const tx = target.renderX ?? target.x;
            const ty = target.renderY ?? target.y;
            camXRef.current += (tx - camXRef.current) * 0.14;
            camYRef.current += (ty - camYRef.current) * 0.14;
            camZoomRef.current += (1.08 - camZoomRef.current) * 0.08;
          }
        } else if (mode === 'overview') {
          camXRef.current += (1250 - camXRef.current) * 0.08;
          camYRef.current += (1250 - camYRef.current) * 0.08;
          const targetZoom = Math.min(virtualW / 2680, virtualH / 2680);
          camZoomRef.current += (targetZoom - camZoomRef.current) * 0.08;
        } else if (mode === 'leader') {
          const leader = sim.getLeader() || playerMarbles[0];
          if (leader) {
            const lx = leader.renderX ?? leader.x;
            const ly = leader.renderY ?? leader.y;
            camXRef.current += (lx - camXRef.current) * 0.12;
            camYRef.current += (ly - camYRef.current) * 0.12;
            camZoomRef.current += (1.12 - camZoomRef.current) * 0.08;
          }
        } else {
          const pool = playerMarbles.filter((m) => !m.finished);
          const activeSet = pool.length > 0 ? pool : playerMarbles;
          const halfCount = Math.max(1, Math.ceil(activeSet.length / 2));
          const tracked = activeSet.slice(0, halfCount);
          if (tracked.length > 0) {
            let minX = tracked[0].renderX ?? tracked[0].x;
            let maxX = minX;
            let minY = tracked[0].renderY ?? tracked[0].y;
            let maxY = minY;
            for (let i = 1; i < tracked.length; i++) {
              const mx = tracked[i].renderX ?? tracked[i].x;
              const my = tracked[i].renderY ?? tracked[i].y;
              if (mx < minX) minX = mx;
              if (mx > maxX) maxX = mx;
              if (my < minY) minY = my;
              if (my > maxY) maxY = my;
            }
            const spanX = maxX - minX + 260;
            const spanY = maxY - minY + 240;
            const targetZoom = Math.max(0.55, Math.min(1.22, Math.min(virtualW / spanX, virtualH / spanY)));
            camXRef.current += ((minX + maxX) / 2 - camXRef.current) * 0.09;
            camYRef.current += ((minY + maxY) / 2 - camYRef.current) * 0.09;
            camZoomRef.current += (targetZoom - camZoomRef.current) * 0.06;
          }
        }

        // ==========================================
        // 3. RENDER COURSE
        // ==========================================
        const tDrawStart = performance.now();
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

        // Track telemetry
        const frameMs = rawDt * 1000;
        fpsSamplesRef.current.frames++;
        fpsSamplesRef.current.timer += rawDt;
        fpsSamplesRef.current.worstMs = Math.max(fpsSamplesRef.current.worstMs, frameMs);
        fpsSamplesRef.current.physMs = physMs;
        fpsSamplesRef.current.drawMs = drawMs;

        // ==========================================
        // 4. THROTTLED HUD UPDATES (2.5 Hz)
        // ==========================================
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

          // Debug telemetry snapshot
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

          // Auto-open summary when all human marbles finish/turn OR 3.5s after 1st survivor escapes
          if (!winnerModalRef.current && !summaryDismissedRef.current) {
            if (living === 0) {
              const winCandidate =
                sim.getWinner() ||
                (extracted > 0
                  ? players.find((m) => m.isExtracted)
                  : [...players].sort((a, b) => (b.kills || 0) - (a.kills || 0))[0]);
              if (winCandidate) setWinnerModal(winCandidate);
            } else if (
              firstExtractTimeRef.current !== null &&
              timeSec - firstExtractTimeRef.current >= 3.5
            ) {
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

  // Derived Followed Marble Info
  const followedMarble = useMemo(
    () => standings.find((m) => m.id === followedMarbleId) || null,
    [standings, followedMarbleId]
  );

  // Deadliest Room Calculation for Summary Modal
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

  const playerStandings = useMemo(
    () => standings.filter((m) => !m.id.startsWith('npc_')),
    [standings]
  );

  const totalKillsCount = useMemo(
    () => playerStandings.reduce((acc, m) => acc + (m.isZombie ? 0 : m.kills || 0), 0),
    [playerStandings]
  );

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

            {/* Tap-to-Follow / Cycle Marble Indicator Pill */}
            {followedMarble && (
              <div className="inline-flex self-start items-center gap-1.5 bg-slate-950/90 backdrop-blur-md px-2 py-1 rounded-xl border border-slate-700/80 shadow-md text-[11px] whitespace-nowrap">
                <button
                  onClick={() => cycleFollowMarble(-1)}
                  className="p-0.5 rounded hover:bg-slate-800 text-slate-300"
                  title="Canica anterior [Tecla ]"
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
                      {(WEAPON_SPECS[followedMarble.weaponType || 'blaster'] || WEAPON_SPECS.blaster).icon}
                    </span>
                  </>
                )}
                <button
                  onClick={() => cycleFollowMarble(1)}
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
              onClick={handleToggleSound}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title={soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} className="text-red-400" />}
            </button>

            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Pausar / Reanudar [Espacio]"
            >
              {isPaused ? <Play size={15} className="text-emerald-400" /> : <Pause size={15} />}
            </button>

            <div className="w-[1px] h-5 bg-slate-700/60" />

            {SIMULATION_SPEEDS.map((spd) => (
              <button
                key={spd}
                onClick={() => setSimSpeed(spd)}
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
              onClick={() => {
                if (cameraMode === 'follow') setCameraMode('half_pack');
                else if (cameraMode === 'half_pack') setCameraMode('leader');
                else if (cameraMode === 'leader') setCameraMode('overview');
                else setCameraMode('follow');
              }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap"
              title="Cambiar enfoque de cámara"
            >
              <Camera size={13} className="text-amber-400" />
              <span className="hidden lg:inline">
                {cameraMode === 'follow'
                  ? 'Seguir'
                  : cameraMode === 'half_pack'
                  ? 'Grupo'
                  : cameraMode === 'leader'
                  ? 'Líder'
                  : '5×5'}
              </span>
            </button>

            <button
              onClick={() => setShowLabyrinthMap((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${
                showLabyrinthMap ? 'bg-cyan-500/25 text-cyan-300' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Mapa del Laberinto 5×5 [M]"
            >
              <MapIcon size={15} />
            </button>

            <button
              onClick={() => setShowDebugHud((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${
                showDebugHud ? 'bg-amber-500/25 text-amber-300' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Telemetría de rendimiento [D]"
            >
              <Bug size={15} />
            </button>

            <button
              onClick={handleToggleFullscreen}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Pantalla completa"
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
          </div>

          {/* Debug Telemetry Overlay */}
          {showDebugHud && (
            <div className="absolute top-16 left-3 z-20 bg-slate-950/90 backdrop-blur-md border border-amber-500/40 rounded-xl p-2.5 text-[10.5px] font-mono text-slate-200 shadow-xl space-y-1.5 w-56">
              <div className="flex items-center justify-between text-amber-300 font-bold border-b border-slate-800 pb-1">
                <span>DEBUG TELEMETRÍA</span>
                <button onClick={() => setShowDebugHud(false)} className="text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">FPS / Peor ms:</span>
                <span>{debugStats.fps} fps · {debugStats.worstMs}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Física / Draw:</span>
                <span>{debugStats.physMs}ms / {debugStats.drawMs}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Salas Activas:</span>
                <span className="text-emerald-400">{activeChunkCount} / 25</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Entidades:</span>
                <span>{debugStats.entities}</span>
              </div>
              <div className="pt-1 border-t border-slate-800 flex gap-1.5">
                <button
                  onClick={() => setShowSkyline((v) => !v)}
                  className={`flex-1 py-1 rounded text-[10px] font-bold border ${
                    showSkyline ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200' : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  Skyline
                </button>
                <button
                  onClick={() => setShowParticles((v) => !v)}
                  className={`flex-1 py-1 rounded text-[10px] font-bold border ${
                    showParticles ? 'bg-amber-500/20 border-amber-400/50 text-amber-200' : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  Partículas
                </button>
              </div>
            </div>
          )}

          {/* Replay Banner or Power Deployment Toast */}
          {isReplaying ? (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30">
              <button
                onClick={stopHighlightReplay}
                className="px-4 py-1.5 rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-2xl flex items-center gap-2 hover:bg-amber-400"
              >
                <Film size={14} />
                <span>HIGHLIGHT {replayHudText} · Clic para saltar</span>
              </button>
            </div>
          ) : (powerHint || selectedPower) ? (
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

          {/* Dual Tactical Dock (Bottom Center): Targeted Marble Powers [1-3] + Commander Powers [4-6] */}
          {!isReplaying && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 max-w-[96%]">
              <div className="bg-slate-950/92 backdrop-blur-md px-2 py-1.5 rounded-2xl border border-slate-700/80 shadow-[0_8px_32px_rgba(0,0,0,0.65)] flex items-center gap-1.5 overflow-x-auto">
                {/* Targeted Single-Marble Powers */}
                <button
                  onClick={() => activateTargetedPower('boost')}
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
                  onClick={() => activateTargetedPower('shield')}
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
                  onClick={() => activateTargetedPower('heal')}
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

                {/* Commander Map-Click Powers */}
                <button
                  onClick={() => empCooldown <= 0 && setSelectedPower((p) => (p === 'emp' ? null : 'emp'))}
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
                  onClick={() => barricadeCooldown <= 0 && setSelectedPower((p) => (p === 'barricade' ? null : 'barricade'))}
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
                  onClick={() => airdropCooldown <= 0 && setSelectedPower((p) => (p === 'airdrop' ? null : 'airdrop'))}
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

          {/* Interactive 5x5 Labyrinth Preview Modal */}
          {showLabyrinthMap && courseRef.current && (
            <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-4 max-w-lg w-full shadow-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <MapIcon size={16} className="text-cyan-400" />
                      <span>Plano del Laberinto 5×5 ({seed})</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Inicio (1,1) arriba-izq → Búnker (5,5) abajo-der · Puertas abiertas conectadas
                    </p>
                  </div>
                  <button
                    onClick={() => setShowLabyrinthMap(false)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-5 gap-1 aspect-square bg-slate-950 p-2 rounded-xl border border-slate-800">
                  {courseRef.current.chunks.map((room) => {
                    const doors = room.doors || { n: false, e: false, s: false, w: false };
                    const occupants = standings.filter((m) => !m.gone && m.currentRoomId === room.id);
                    const playerOcc = occupants.filter((m) => !m.id.startsWith('npc_'));
                    const npcOcc = occupants.filter((m) => m.id.startsWith('npc_'));

                    return (
                      <div
                        key={room.id}
                        className={`relative p-1 flex flex-col justify-between text-[9px] rounded ${
                          room.isStart
                            ? 'bg-cyan-950/60'
                            : room.isFinish
                            ? 'bg-emerald-950/70'
                            : room.isDeadEnd
                            ? 'bg-purple-950/40'
                            : 'bg-slate-900/90'
                        }`}
                        style={{
                          borderTop: doors.n ? '2px dashed rgba(56,189,248,0.45)' : '3px solid #475569',
                          borderRight: doors.e ? '2px dashed rgba(56,189,248,0.45)' : '3px solid #475569',
                          borderBottom: doors.s ? '2px dashed rgba(56,189,248,0.45)' : '3px solid #475569',
                          borderLeft: doors.w ? '2px dashed rgba(56,189,248,0.45)' : '3px solid #475569',
                        }}
                        title={`Sala (${room.col + 1},${room.row + 1}): ${room.name}`}
                      >
                        <div className="flex items-center justify-between font-mono text-[8px] text-slate-400">
                          <span>{room.col + 1},{room.row + 1}</span>
                          {room.isStart && <span className="text-cyan-300 font-bold">IN</span>}
                          {room.isFinish && <span className="text-emerald-300 font-bold">EX</span>}
                          {room.isDeadEnd && !room.isStart && !room.isFinish && (
                            <span className="text-purple-300 font-bold">★</span>
                          )}
                        </div>
                        <div className="text-[8px] font-bold text-slate-200 leading-tight truncate">
                          {room.name}
                        </div>
                        <div className="flex flex-wrap gap-0.5 items-center min-h-[10px]">
                          {playerOcc.slice(0, 6).map((m) => (
                            <span
                              key={m.id}
                              className="w-2 h-2 rounded-full inline-block border border-white/50"
                              style={{ backgroundColor: m.isZombie ? '#22c55e' : m.color }}
                            />
                          ))}
                          {npcOcc.length > 0 && (
                            <span className="text-[8px] font-mono text-lime-400 ml-auto">☣{npcOcc.length}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Drawer Trigger */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed bottom-4 right-4 z-40 bg-amber-500 text-slate-950 p-3 rounded-full shadow-2xl active:scale-95 transition-transform"
        aria-label="Abrir panel de control"
      >
        <SlidersHorizontal size={22} />
      </button>

      {/* Right Control Sidebar */}
      <aside
        className={`fixed md:static right-0 top-0 h-full w-84 bg-slate-900/95 md:bg-slate-900 border-l border-slate-800 flex flex-col z-30 transition-transform duration-300 backdrop-blur-md ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
              <span>ZOMBIE RUN</span>
              <span className="text-emerald-400 text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                LABYRINTH
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Laberinto 5×5 de Salas Cuadradas</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white p-1">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Start / Restart */}
          <button
            onClick={() => startRace()}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-amber-500 hover:from-emerald-400 hover:to-amber-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
          >
            <RotateCcw size={16} />
            <span>Iniciar Supervivencia</span>
          </button>

          {/* Patient Zero selector */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1 text-emerald-400">
                <Skull size={12} />
                <span>Pacientes Cero</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">
                {patientZeroCount} {patientZeroCount === 1 ? 'Zombi' : 'Zombis'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  onClick={() => {
                    setPatientZeroCount(num);
                    startRace(undefined, num);
                  }}
                  className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all ${
                    patientZeroCount === num
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {num} {num === 1 ? 'Zombi' : 'Zombis'}
                </button>
              ))}
            </div>
          </div>

          {/* Seed Input + Random + Daily + Copy Link */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-semibold text-[10px] uppercase tracking-wider">Semilla Determinista</span>
              <span className="text-[10px] text-slate-500 font-mono">#URL Sync</span>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && startRace()}
                placeholder="Semilla..."
                maxLength={20}
                className="flex-1 min-w-0 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleRandomizeSeed}
                className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold flex items-center gap-1 transition-colors shrink-0"
                title="Semilla aleatoria"
              >
                <Shuffle size={13} className="text-amber-400" />
                <span>Azar</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={handleDailySeed}
                className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors"
                title="Cargar el laberinto oficial de hoy"
              >
                <Calendar size={12} className="text-cyan-400" />
                <span>Hoy</span>
              </button>
              <button
                onClick={handleCopySeedLink}
                className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors"
                title="Copiar enlace compartible con esta semilla"
              >
                <Link2 size={12} className="text-emerald-400" />
                <span>Copiar</span>
              </button>
            </div>
          </div>

          <MarbleSelector
            colors={DEFAULT_MARBLE_COLORS}
            selectedIds={selectedIds}
            customNames={customNames}
            onToggleSelect={handleToggleSelect}
            onNameChange={handleNameChange}
            onSelectAll={handleSelectAll}
            onResetNames={handleResetNames}
          />

          <Leaderboard
            standings={standings}
            followedMarbleId={followedMarbleId}
            onFollowMarble={(id) => selectFollowMarble(id, true)}
          />
        </div>

        <div className="p-3 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-400" />
            <span>Rapier2D CCD · {activeChunkCount}/25</span>
          </span>
          <span className="font-mono text-emerald-400">5×5 Laberinto</span>
        </div>
      </aside>

      {/* Post-Race Results & Highlight Reel Modal */}
      {winnerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            className={`border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 ${
              extractedHumansCount === 0 && winnerModal.isZombie
                ? 'bg-slate-950 border-emerald-500/60 shadow-[0_0_40px_rgba(34,197,94,0.3)]'
                : 'bg-slate-900 border-amber-500/60 shadow-[0_0_40px_rgba(245,158,11,0.3)]'
            }`}
          >
            <div className="text-center space-y-2">
              <div
                className={`inline-flex p-3 rounded-full border ${
                  extractedHumansCount === 0 && winnerModal.isZombie
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                }`}
              >
                {extractedHumansCount === 0 && winnerModal.isZombie ? <Skull size={34} /> : <Trophy size={34} />}
              </div>
              <h2 className="text-xl font-black text-white">
                {extractedHumansCount === 0 && winnerModal.isZombie
                  ? '¡CONTAGIO TOTAL: VICTORIA ZOMBI!'
                  : `¡SUPERVIVENCIA COMPLETADA (${extractedHumansCount} SALVADOS)!`}
              </h2>
              <p className="text-xs text-slate-300">
                Líder: <strong className="text-amber-300">{winnerModal.name}</strong> · Semilla{' '}
                <span className="font-mono text-cyan-300">{seed}</span>
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Rescatados</div>
                <div className="font-mono font-bold text-amber-400 text-sm">{extractedHumansCount}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Zombis Abatidos</div>
                <div className="font-mono font-bold text-cyan-400 text-sm">{totalKillsCount}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase">Tiempo</div>
                <div className="font-mono font-bold text-white text-sm">{hudTime.split(' / ')[0]}</div>
              </div>
            </div>

            <div className="bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-800 text-[11px] flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <ShieldAlert size={12} className="text-rose-400" />
                <span>Sala más letal:</span>
              </span>
              <span className="font-semibold text-rose-300 truncate max-w-[220px]">{deadliestRoomText}</span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={startHighlightReplay}
                className="flex-1 min-w-[130px] py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Film size={14} />
                <span>Ver Highlights</span>
              </button>
              <button
                onClick={() => {
                  setSummaryDismissed(true);
                  summaryDismissedRef.current = true;
                  setWinnerModal(null);
                }}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Seguir Viendo
              </button>
              <button
                onClick={() => {
                  setWinnerModal(null);
                  startRace();
                }}
                className="flex-1 min-w-[120px] py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition-colors"
              >
                Nueva Partida
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
