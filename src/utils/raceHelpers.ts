import {
  CameraMode,
  CourseData,
  FocusAnimState,
  HighlightEvent,
  Marble,
  ReplayClip,
  ReplayFrame,
} from '../types';
import { DEFAULT_MARBLE_COLORS, DEFAULT_SEED, ZOMBIE_SPECS } from '../constants';

export function getInitialSeedFromHash(): string {
  if (typeof window === 'undefined') return DEFAULT_SEED;
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return DEFAULT_SEED;
  if (raw.startsWith('seed=')) {
    const val = decodeURIComponent(raw.slice(5)).trim();
    return val || DEFAULT_SEED;
  }
  return decodeURIComponent(raw).trim() || DEFAULT_SEED;
}

export function getDailySeedString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `d${y}${m}${day}`;
}

export function createInitialMarbles(
  course: CourseData,
  selectedIds: string[],
  customNames: Record<string, string>,
  patientZeroCount: number
): Marble[] {
  const activeDefs = DEFAULT_MARBLE_COLORS.filter((c) => selectedIds.includes(c.id));
  const count = activeDefs.length;

  return activeDefs.map((def, idx) => {
    const offsetX = ((idx % 5) - 2) * 26;
    const offsetY = Math.floor(idx / 5) * 24;
    const assignedName = customNames[def.id]?.trim() || def.name;
    const startPosX = course.startX + offsetX;
    const startPosY = course.startY + offsetY;
    const isPatientZero = idx >= count - patientZeroCount;

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
}

export function buildHighlightClips(events: HighlightEvent[]): ReplayClip[] {
  const sorted = [...events].sort((a, b) => b.weight - a.weight);
  const chosen: ReplayClip[] = [];

  for (const ev of sorted) {
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

  return chosen.sort((a, b) => a.event.t - b.event.t);
}

export function sampleReplayFrame(
  frames: ReplayFrame[],
  t: number,
  baseMarbles: Marble[]
): Marble[] {
  if (frames.length === 0) return baseMarbles;
  let idx = 0;
  while (idx < frames.length - 1 && frames[idx + 1].t < t) idx++;
  const f0 = frames[idx];
  const f1 = frames[Math.min(frames.length - 1, idx + 1)];
  const span = Math.max(0.0001, f1.t - f0.t);
  const frac = Math.max(0, Math.min(1, (t - f0.t) / span));

  const map1 = new Map(f1.marbles.map((s) => [s.id, s]));
  return f0.marbles.map((s0): Marble => {
    const s1 = map1.get(s0.id) || s0;
    const meta = baseMarbles.find((b) => b.id === s0.id);
    const ix = s0.x + (s1.x - s0.x) * frac;
    const iy = s0.y + (s1.y - s0.y) * frac;
    const iAngle = s0.angle + (s1.angle - s0.angle) * frac;

    return {
      id: s0.id,
      name: meta?.name || (s0.zombieType ? ZOMBIE_SPECS[s0.zombieType].label : s0.id),
      color: meta?.color || '#4d9b36',
      border: meta?.border,
      mass: meta?.mass ?? 1,
      restitution: meta?.restitution ?? 0.5,
      materialType: meta?.materialType,
      x: ix,
      y: iy,
      renderX: ix,
      renderY: iy,
      vx: (s1.x - s0.x) * 20,
      vy: (s1.y - s0.y) * 20,
      angle: iAngle,
      renderAngle: iAngle,
      omega: 0,
      radius: s0.radius,
      rank: meta?.rank ?? 1,
      finished: s0.finished,
      finishTime: meta?.finishTime ?? null,
      finishPosition: meta?.finishPosition ?? null,
      currentCheckpointIdx: 0,
      progressScore: 0,
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
}

export function updateSmartCamera(
  cam: { x: number; y: number; zoom: number },
  mode: CameraMode,
  marbles: Marble[],
  followedMarbleId: string | null,
  focusAnim: FocusAnimState | null,
  leader: Marble | null,
  virtualW: number,
  virtualH: number
): void {
  const playerMarbles = marbles.filter((m) => !m.id.startsWith('npc_') && !m.gone);

  if (focusAnim) {
    cam.x += (focusAnim.x - cam.x) * 0.18;
    cam.y += (focusAnim.y - cam.y) * 0.18;
    cam.zoom += (1.22 - cam.zoom) * 0.12;
  } else if (mode === 'follow' && followedMarbleId) {
    const target = marbles.find((m) => m.id === followedMarbleId && !m.gone) || playerMarbles[0];
    if (target) {
      const tx = target.renderX ?? target.x;
      const ty = target.renderY ?? target.y;
      cam.x += (tx - cam.x) * 0.14;
      cam.y += (ty - cam.y) * 0.14;
      cam.zoom += (1.08 - cam.zoom) * 0.08;
    }
  } else if (mode === 'overview') {
    cam.x += (1250 - cam.x) * 0.08;
    cam.y += (1250 - cam.y) * 0.08;
    const targetZoom = Math.min(virtualW / 2680, virtualH / 2680);
    cam.zoom += (targetZoom - cam.zoom) * 0.08;
  } else if (mode === 'leader') {
    const targetLeader = leader || playerMarbles[0];
    if (targetLeader) {
      const lx = targetLeader.renderX ?? targetLeader.x;
      const ly = targetLeader.renderY ?? targetLeader.y;
      cam.x += (lx - cam.x) * 0.12;
      cam.y += (ly - cam.y) * 0.12;
      cam.zoom += (1.12 - cam.zoom) * 0.08;
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
      cam.x += ((minX + maxX) / 2 - cam.x) * 0.09;
      cam.y += ((minY + maxY) / 2 - cam.y) * 0.09;
      cam.zoom += (targetZoom - cam.zoom) * 0.06;
    }
  }
}
