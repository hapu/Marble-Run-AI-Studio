import RAPIER from '@dimforge/rapier2d-compat';
import {
  Marble,
  CourseData,
  Wall,
  Bumper,
  Projectile,
  CombatParticle,
  FloatingText,
  TemporaryBarricade,
  CombatEvent,
  HighlightEvent,
  ReplayFrame,
  PickupCrate,
  WeaponType,
  ZombieType,
} from './types';
import { WEAPON_SPECS, ZOMBIE_SPECS, ROOM_SIZE, GRID_COLS, GRID_ROWS } from './constants';
import { sound } from './audio';

const WORLD_W = ROOM_SIZE * GRID_COLS; // 2500px
const WORLD_H = ROOM_SIZE * GRID_ROWS; // 2500px

// Rapier2D world unit scale: 50 pixels = 1 meter for optimal solver stability & realistic rolling inertia
const SCALE = 50;
const INV_SCALE = 1 / SCALE;

let rapierInitPromise: Promise<void> | null = null;
let rapierInitialized = false;

export async function initPhysicsEngine(): Promise<void> {
  if (rapierInitialized) return;
  if (!rapierInitPromise) {
    rapierInitPromise = RAPIER.init().then(() => {
      rapierInitialized = true;
    });
  }
  await rapierInitPromise;
}

export function isPhysicsReady(): boolean {
  return rapierInitialized;
}

export function distToSegmentSquared(
  px: number,
  py: number,
  vx: number,
  vy: number,
  wx: number,
  wy: number
) {
  const segDx = wx - vx;
  const segDy = wy - vy;
  const l2 = segDx * segDx + segDy * segDy;
  if (l2 === 0) {
    const dx = px - vx;
    const dy = py - vy;
    return { distSq: dx * dx + dy * dy, projX: vx, projY: vy, nx: dx, ny: dy, t: 0, segDx: 0, segDy: 0 };
  }
  let t = ((px - vx) * segDx + (py - vy) * segDy) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = vx + t * segDx;
  const projY = vy + t * segDy;
  const dx = px - projX;
  const dy = py - projY;

  return {
    distSq: dx * dx + dy * dy,
    projX,
    projY,
    nx: dx,
    ny: dy,
    t,
    segDx,
    segDy,
  };
}

export class SpatialHashGrid {
  public cellSize: number;
  constructor(cellSize: number = 200) {
    this.cellSize = cellSize;
  }
  public insertWall(_w: Wall) {}
  public insertBumper(_b: Bumper) {}
  public queryWallsInto(_x: number, _y: number, _r: number, outList: Wall[], seenSet: Set<Wall>): void {
    outList.length = 0;
    seenSet.clear();
  }
  public queryBumpersInto(_x: number, _y: number, _r: number, outList: Bumper[], seenSet: Set<Bumper>): void {
    outList.length = 0;
    seenSet.clear();
  }
}

// Returns the room chunk index (0..24) in the 5x5 grid
export function getChunkIndexAt(course: CourseData, x: number, y: number): number {
  if (!course.chunks || course.chunks.length === 0) return 0;
  const col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(x / ROOM_SIZE)));
  const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(y / ROOM_SIZE)));
  const idx = row * GRID_COLS + col;
  if (course.chunks[idx]) return idx;

  let bestIdx = 0;
  let minDistSq = Infinity;
  for (let i = 0; i < course.chunks.length; i++) {
    const c = course.chunks[i];
    const cx = c.x + c.size / 2;
    const cy = c.y + c.size / 2;
    const dSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    if (dSq < minDistSq) {
      minDistSq = dSq;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// Entity-Based Dynamic Spatial Activation for the 5x5 branching labyrinth:
// Activates rooms occupied by active marbles/zombies/projectiles/barricades PLUS doorway-connected neighbors
export function getActiveChunkIndices(
  course: CourseData,
  marbles: Marble[],
  projectiles: Projectile[] = [],
  barricades: TemporaryBarricade[] = []
): number[] {
  if (!course.chunks || course.chunks.length === 0) return [];
  const activeSet = new Set<number>();

  const addRoomWithNeighbors = (cIdx: number) => {
    activeSet.add(cIdx);
    const room = course.chunks[cIdx];
    if (!room || !room.doors) return;
    if (room.doors.n && room.row > 0) activeSet.add((room.row - 1) * 5 + room.col);
    if (room.doors.s && room.row < 4) activeSet.add((room.row + 1) * 5 + room.col);
    if (room.doors.w && room.col > 0) activeSet.add(room.row * 5 + (room.col - 1));
    if (room.doors.e && room.col < 4) activeSet.add(room.row * 5 + (room.col + 1));
  };

  for (let i = 0; i < marbles.length; i++) {
    const m = marbles[i];
    if (!m.finished && !m.gone) {
      const cIdx = getChunkIndexAt(course, m.x, m.y);
      addRoomWithNeighbors(cIdx);
    }
  }

  for (let i = 0; i < projectiles.length; i++) {
    const p = projectiles[i];
    activeSet.add(getChunkIndexAt(course, p.x, p.y));
  }

  for (let i = 0; i < barricades.length; i++) {
    const b = barricades[i];
    activeSet.add(getChunkIndexAt(course, b.x, b.y));
  }

  if (activeSet.size === 0) {
    activeSet.add(course.chunks.length - 1);
  }

  return Array.from(activeSet).sort((a, b) => a - b);
}

export interface FocusTrigger {
  x: number;
  y: number;
  color: string;
  text: string;
  durationSec: number;
}

type ColliderMeta =
  | { kind: 'marble'; marbleId: string }
  | { kind: 'bumper'; x: number; y: number; bounce: number }
  | { kind: 'wall' }
  | { kind: 'spinner' }
  | { kind: 'piston' }
  | { kind: 'pendulum' }
  | { kind: 'barricade' };

// =========================================================================
// RAPIER2D RIGID-BODY LABYRINTH SURVIVAL ENGINE
// =========================================================================

export class RapierRaceEngine {
  public world: RAPIER.World | null = null;
  public eventQueue: RAPIER.EventQueue | null = null;
  public chunkBodies: RAPIER.RigidBody[][] = [];
  public spinnerBodies: Map<number, RAPIER.RigidBody[]> = new Map();
  public pistonBodies: Map<string, RAPIER.RigidBody> = new Map();
  public pendulumBodies: Map<string, RAPIER.RigidBody> = new Map();
  public marbleBodies: Map<string, RAPIER.RigidBody> = new Map();
  public colliderMeta: Map<number, ColliderMeta> = new Map();

  public activeChunkIndices: number[] = [];
  public projectiles: Projectile[] = [];
  public particles: CombatParticle[] = [];
  public floatingTexts: FloatingText[] = [];
  public barricades: TemporaryBarricade[] = [];
  public barricadeBodies: Map<string, RAPIER.RigidBody> = new Map();
  public combatFeed: CombatEvent[] = [];
  public highlightEvents: HighlightEvent[] = [];
  public replayFrames: ReplayFrame[] = [];
  public pendingFocus: FocusTrigger | null = null;
  public pendingDamageFlash: boolean = false;
  public followedMarbleId: string | null = null;
  public roomDamageCounts: Record<number, number> = {};

  private currentCourse: CourseData | null = null;
  private lastMarbles: Marble[] = [];
  private lastRaceTime: number = 0;
  private simTickCounter: number = 0;
  private firstFinisherRecorded: boolean = false;
  private pendingZombieSpawns: Array<{ x: number; y: number; zombieType: ZombieType; roomId: number }> = [];

  public dispose() {
    if (this.eventQueue) {
      this.eventQueue.free();
      this.eventQueue = null;
    }
    if (this.world) {
      this.world.free();
      this.world = null;
    }
    this.chunkBodies = [];
    this.spinnerBodies.clear();
    this.pistonBodies.clear();
    this.pendulumBodies.clear();
    this.marbleBodies.clear();
    this.barricadeBodies.clear();
    this.colliderMeta.clear();
  }

  public addParticles(x: number, y: number, color: string, count = 6, speed = 4, type: CombatParticle['type'] = 'spark') {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.5 + Math.random()) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color,
        size: 2 + Math.random() * 2.5,
        alpha: 1.0,
        lifetime: 0.35 + Math.random() * 0.25,
        maxLifetime: 0.6,
        type,
      });
    }
  }

  public addFloatingText(x: number, y: number, text: string, color: string) {
    this.floatingTexts.push({
      id: Math.random().toString(36).substring(2, 7),
      x,
      y,
      text,
      color,
      alpha: 1.0,
      lifetime: 0.9,
      maxLifetime: 0.9,
    });
  }

  public addCombatEvent(text: string, color: string) {
    this.combatFeed.unshift({
      id: Math.random().toString(36).substring(2, 7),
      text,
      color,
      time: this.lastRaceTime,
    });
    if (this.combatFeed.length > 6) {
      this.combatFeed.pop();
    }
  }

  private createMarbleBody(m: Marble): RAPIER.RigidBody | null {
    if (!this.world) return null;

    // Convert initial px/tick-style velocity into m/s (approx 60/50 factor)
    const initVx = (m.vx || 0) * (60 / SCALE);
    const initVy = (m.vy || 0) * (60 / SCALE);

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(m.x * INV_SCALE, m.y * INV_SCALE)
      .setLinvel(initVx, initVy)
      .setCcdEnabled(true)
      .setLinearDamping(0.24)
      .setAngularDamping(0.38)
      .setCanSleep(false);

    const body = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.ball((m.radius || 12.5) * INV_SCALE)
      .setMass(m.mass || 1.0)
      .setFriction(0.34)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average)
      .setRestitution(Math.min(0.88, m.restitution ?? 0.48))
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    const collider = this.world.createCollider(colliderDesc, body);
    this.marbleBodies.set(m.id, body);
    this.colliderMeta.set(collider.handle, { kind: 'marble', marbleId: m.id });
    return body;
  }

  private spawnNpcZombie(x: number, y: number, zombieType: ZombieType, roomId: number) {
    const spec = ZOMBIE_SPECS[zombieType];
    const id = `npc_${zombieType}_${Math.random().toString(36).substring(2, 8)}`;
    const zm: Marble = {
      id,
      name: spec.label,
      color: spec.color,
      border: spec.border,
      mass: spec.mass,
      restitution: 0.44,
      materialType: 'dense',
      x,
      y,
      vx: (Math.random() - 0.5) * 1.4,
      vy: (Math.random() - 0.5) * 1.4,
      angle: 0,
      omega: 0,
      prevX: x,
      prevY: y,
      prevAngle: 0,
      renderX: x,
      renderY: y,
      renderAngle: 0,
      radius: spec.radius,
      rank: 99,
      finished: false,
      finishTime: null,
      finishPosition: null,
      currentCheckpointIdx: 0,
      progressScore: 0,
      history: [],
      isZombie: true,
      zombieType,
      zhp: spec.hp,
      maxZhp: spec.hp,
      zSpeedMult: spec.speedMult,
      zForceMult: spec.forceMult,
      hp: 0,
      maxHp: 5,
      shield: 0,
      infectionTime: 0,
      kills: 0,
      currentRoomId: roomId,
    };
    this.lastMarbles.push(zm);
    this.createMarbleBody(zm);
  }

  // =========================================================================
  // PLAYER COMMANDER POWERS (EMP, BARRICADE, AIRDROP)
  // =========================================================================

  public triggerEmpShockwave(targetX: number, targetY: number) {
    sound.playEmpPower();
    this.addParticles(targetX, targetY, '#38bdf8', 24, 8);
    this.addFloatingText(targetX, targetY - 20, '💥 ONDA EMP!', '#38bdf8');
    this.addCombatEvent('⚡ COMANDANTE detonó ONDA EMP', '#38bdf8');

    for (let i = 0; i < this.lastMarbles.length; i++) {
      const m = this.lastMarbles[i];
      if (!m.isZombie || m.finished || m.gone) continue;
      const dist = Math.hypot(m.x - targetX, m.y - targetY);
      if (dist < 400) {
        const body = this.marbleBodies.get(m.id);
        if (body) {
          const pushX = (m.x - targetX) / (dist || 1);
          const pushY = (m.y - targetY) / (dist || 1);
          body.setLinvel({ x: pushX * 15.0, y: pushY * 15.0 - 3.5 }, true);
          this.addParticles(m.x, m.y, '#67e8f9', 6, 3);
        }
      }
    }
  }

  public deployBarricade(targetX: number, targetY: number) {
    if (!this.world) return;
    sound.playBarricade();
    const id = `barr_${Math.random().toString(36).substring(2, 7)}`;
    const bW = 120;
    const bH = 26;

    const bBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(targetX * INV_SCALE, targetY * INV_SCALE)
    );
    const bCol = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid((bW / 2) * INV_SCALE, (bH / 2) * INV_SCALE)
        .setRestitution(0.75)
        .setFriction(0.15)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      bBody
    );

    this.colliderMeta.set(bCol.handle, { kind: 'barricade' });
    this.barricadeBodies.set(id, bBody);
    this.barricades.push({
      id,
      x: targetX,
      y: targetY,
      w: bW,
      h: bH,
      lifetime: 8.0,
      maxLifetime: 8.0,
    });

    this.addParticles(targetX, targetY, '#06b6d4', 16, 5);
    this.addFloatingText(targetX, targetY - 20, '🛡️ BARRICADA (8s)', '#06b6d4');
    this.addCombatEvent('🛡️ BARRICADA HOLOGRÁFICA desplegada', '#06b6d4');
  }

  public deployAirdrop(targetX: number, targetY: number, course: CourseData) {
    sound.playAirdrop();
    const id = `crate_air_${Math.random().toString(36).substring(2, 7)}`;
    const types: PickupCrate['type'][] = ['shotgun', 'rifle', 'spread', 'rapid', 'sword', 'shield', 'repair'];
    const chosenType = types[Math.floor(Math.random() * types.length)];

    const newCrate: PickupCrate = {
      id,
      chunkId: getChunkIndexAt(course, targetX, targetY),
      x: targetX,
      y: targetY,
      type: chosenType,
      active: true,
      respawnTimer: 0,
    };

    if (course.chunks[newCrate.chunkId]) {
      course.chunks[newCrate.chunkId].crates.push(newCrate);
    }
    course.crates.push(newCrate);

    this.addParticles(targetX, targetY, '#f59e0b', 20, 6);
    this.addFloatingText(targetX, targetY - 20, `📦 SUMINISTRO: ${chosenType.toUpperCase()}`, '#f59e0b');
    this.addCombatEvent(`📦 SUMINISTRO AÉREO [${chosenType.toUpperCase()}]`, '#f59e0b');
  }

  // =========================================================================
  // TARGETED MARBLE ABILITIES (BOOST, SHIELD, HEAL)
  // =========================================================================

  public triggerMarbleBoost(marbleId: string): boolean {
    const m = this.lastMarbles.find((x) => x.id === marbleId && !x.isZombie && !x.finished && !x.gone);
    if (!m) return false;
    const body = this.marbleBodies.get(m.id);
    if (!body) return false;

    sound.playBoosterZap();
    m.boostUntil = this.lastRaceTime + 3.0;
    m.turboTime = Math.max(m.turboTime || 0, this.lastRaceTime + 3.0);
    const v = body.linvel();
    const spd = Math.hypot(v.x, v.y) || 1;
    const nx = v.x / spd;
    const ny = v.y / spd;
    body.setLinvel({ x: nx * 13.5, y: ny * 13.5 - 2.2 }, true);
    this.addParticles(m.x, m.y, '#fde047', 16, 5.5);
    this.addFloatingText(m.x, m.y - 16, '⚡ TURBO BOOST!', '#fde047');
    this.addCombatEvent(`⚡ BOOST activado en ${m.name}`, '#fde047');
    return true;
  }

  public triggerMarbleShield(marbleId: string): boolean {
    const m = this.lastMarbles.find((x) => x.id === marbleId && !x.isZombie && !x.finished && !x.gone);
    if (!m) return false;

    sound.playCratePickup();
    m.shield = 100;
    m.shieldUntil = this.lastRaceTime + 5.0;
    this.addParticles(m.x, m.y, '#38bdf8', 16, 4.5);
    this.addFloatingText(m.x, m.y - 16, '🛡️ ESCUDO 5s!', '#38bdf8');
    this.addCombatEvent(`🛡️ ESCUDO activo en ${m.name}`, '#38bdf8');
    return true;
  }

  public triggerMarbleHeal(marbleId: string): boolean {
    const m = this.lastMarbles.find((x) => x.id === marbleId && !x.isZombie && !x.finished && !x.gone);
    if (!m || m.hp >= m.maxHp) return false;

    sound.playCratePickup();
    m.hp = Math.min(m.maxHp, m.hp + 2);
    this.addParticles(m.x, m.y, '#4ade80', 16, 4.5);
    this.addFloatingText(m.x, m.y - 16, '❤️ +2 HP!', '#4ade80');
    this.addCombatEvent(`❤️ ${m.name} recuperó +2 HP`, '#4ade80');
    return true;
  }

  // =========================================================================
  // DAMAGE & INFECTION HELPER
  // =========================================================================

  private applyHumanDamage(human: Marble, attackerZombie?: Marble) {
    if (human.finished || human.isZombie || human.gone) return;
    if ((human.hitCooldownUntil || 0) > this.lastRaceTime) return;

    const hBody = this.marbleBodies.get(human.id);

    if (human.shield > 0 || (human.shieldUntil || 0) > this.lastRaceTime) {
      human.shield = Math.max(0, human.shield - 50);
      human.hitCooldownUntil = this.lastRaceTime + 0.55;
      if (attackerZombie) {
        const zBody = this.marbleBodies.get(attackerZombie.id);
        if (zBody && hBody) {
          const hp = hBody.translation();
          const zp = zBody.translation();
          const dx = zp.x - hp.x;
          const dy = zp.y - hp.y;
          const d = Math.hypot(dx, dy) || 1;
          zBody.setLinvel({ x: (dx / d) * 11.5, y: (dy / d) * 11.5 }, true);
        }
      }
      sound.playBumper(360);
      this.addParticles(human.x, human.y, '#38bdf8', 10, 4.5);
      this.addFloatingText(human.x, human.y - 14, '🛡️ BLOQUEADO!', '#38bdf8');
      return;
    }

    human.hitCooldownUntil = this.lastRaceTime + 0.7;
    human.hp = Math.max(0, human.hp - 1);

    const rIdx = human.currentRoomId ?? (this.currentCourse ? getChunkIndexAt(this.currentCourse, human.x, human.y) : 0);
    this.roomDamageCounts[rIdx] = (this.roomDamageCounts[rIdx] || 0) + 1;

    if (this.followedMarbleId === human.id) {
      this.pendingDamageFlash = true;
    }

    if (human.hp <= 0) {
      human.isZombie = true;
      human.zombieType = 'walker';
      const wSpec = ZOMBIE_SPECS.walker;
      human.zhp = wSpec.hp;
      human.maxZhp = wSpec.hp;
      human.zSpeedMult = wSpec.speedMult;
      human.zForceMult = wSpec.forceMult;
      human.infectionTime = this.lastRaceTime;
      human.turnCooldownUntil = this.lastRaceTime + 1.5;
      if (this.currentCourse?.chunks[rIdx]) {
        human.infectedRoomName = this.currentCourse.chunks[rIdx].name;
      }
      if (attackerZombie) {
        attackerZombie.kills = (attackerZombie.kills || 0) + 1;
      }
      sound.playInfection();
      this.addParticles(human.x, human.y, '#22c55e', 20, 5.5, 'slime');
      this.addFloatingText(human.x, human.y - 16, '☣ ¡INFECTADO!', '#4ade80');
      this.addCombatEvent(`☣ ¡CONTAGIO! ${human.name} se volvió zombi`, '#4ade80');

      const isFollowed = this.followedMarbleId === human.id;
      const firstInf = !this.highlightEvents.some((e) => e.kind === 'inf');
      this.highlightEvents.push({
        t: this.lastRaceTime,
        marbleId: human.id,
        text: `☣ ${human.name} infectado!`,
        color: '#22c55e',
        weight: (isFollowed ? 9 : 4) + (firstInf ? 3 : 0),
        kind: 'inf',
      });
      this.pendingFocus = {
        x: human.x,
        y: human.y,
        color: '#22c55e',
        text: `☣ ¡${human.name} INFECTADO!`,
        durationSec: isFollowed ? 1.5 : 1.0,
      };
    } else {
      sound.playHeartLost();
      this.addParticles(human.x, human.y, '#ef4444', 8, 3.5);
      this.addFloatingText(human.x, human.y - 14, '-1 HP!', '#ef4444');
      if (attackerZombie && hBody) {
        const zBody = this.marbleBodies.get(attackerZombie.id);
        if (zBody) {
          const hp = hBody.translation();
          const zp = zBody.translation();
          const dx = hp.x - zp.x;
          const dy = hp.y - zp.y;
          const d = Math.hypot(dx, dy) || 1;
          hBody.setLinvel({ x: (dx / d) * 7.8, y: (dy / d) * 7.8 }, true);
          zBody.setLinvel({ x: -(dx / d) * 5.6, y: -(dy / d) * 5.6 }, true);
        }
      }
    }
  }

  private processCollisions(marbles: Marble[]) {
    if (!this.eventQueue) return;

    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const metaA = this.colliderMeta.get(h1);
      const metaB = this.colliderMeta.get(h2);
      if (!metaA || !metaB) return;

      // 1. Marble vs Bumper
      if (
        (metaA.kind === 'marble' && metaB.kind === 'bumper') ||
        (metaB.kind === 'marble' && metaA.kind === 'bumper')
      ) {
        const mMeta = metaA.kind === 'marble' ? metaA : (metaB as { kind: 'marble'; marbleId: string });
        const bMeta = metaA.kind === 'bumper' ? metaA : (metaB as { kind: 'bumper'; x: number; y: number; bounce: number });
        const mBody = this.marbleBodies.get(mMeta.marbleId);
        if (mBody) {
          const p = mBody.translation();
          const dx = p.x - bMeta.x * INV_SCALE;
          const dy = p.y - bMeta.y * INV_SCALE;
          const d = Math.hypot(dx, dy) || 1;
          const kick = 8.2 * Math.max(0.85, bMeta.bounce);
          mBody.setLinvel({ x: (dx / d) * kick, y: (dy / d) * kick }, true);
          sound.playBumper(480 + Math.random() * 160);
        }
        return;
      }

      // 2. Marble vs Marble
      if (metaA.kind === 'marble' && metaB.kind === 'marble') {
        const mA = marbles.find((m) => m.id === metaA.marbleId);
        const mB = marbles.find((m) => m.id === metaB.marbleId);
        if (mA && mB) {
          if (mA.isZombie !== mB.isZombie) {
            const zombie = mA.isZombie ? mA : mB;
            const human = mA.isZombie ? mB : mA;
            if ((zombie.turnCooldownUntil || 0) <= this.lastRaceTime) {
              this.applyHumanDamage(human, zombie);
            }
          } else {
            const bA = this.marbleBodies.get(mA.id);
            const bB = this.marbleBodies.get(mB.id);
            if (bA && bB) {
              const va = bA.linvel();
              const vb = bB.linvel();
              const rel = Math.hypot(va.x - vb.x, va.y - vb.y);
              if (rel > 2.4) {
                sound.playImpact(rel * 0.45, 1.0, 380);
              }
            }
          }
        }
        return;
      }

      // 3. Marble vs Walls / Hazards / Barricades
      const mMeta = metaA.kind === 'marble' ? metaA : metaB.kind === 'marble' ? metaB : null;
      if (mMeta) {
        const mBody = this.marbleBodies.get(mMeta.marbleId);
        if (mBody) {
          const v = mBody.linvel();
          const spd = Math.hypot(v.x, v.y);
          if (spd > 2.6) {
            sound.playImpact(spd * 0.38, 1.0, 360);
          }
        }
      }
    });
  }

  public init(course: CourseData, marbles: Marble[]) {
    if (!rapierInitialized) {
      throw new Error('Rapier2D WASM engine has not finished initializing.');
    }

    this.dispose();
    this.currentCourse = course;
    this.lastMarbles = marbles;

    // Heavier, grounded gravity in m/s² for weighty rolling momentum
    this.world = new RAPIER.World({ x: 0, y: 18.0 });
    this.world.timestep = 1 / 120;
    this.world.numSolverIterations = 6;
    this.world.maxCcdSubsteps = 4;
    this.eventQueue = new RAPIER.EventQueue(true);

    this.activeChunkIndices = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.barricades = [];
    this.combatFeed = [];
    this.highlightEvents = [];
    this.replayFrames = [];
    this.pendingFocus = null;
    this.pendingDamageFlash = false;
    this.roomDamageCounts = {};
    this.simTickCounter = 0;
    this.firstFinisherRecorded = false;
    this.pendingZombieSpawns = [];

    // Outer containment arena walls enclosing 0..2500 x 0..2500px (0..50m x 0..50m)
    const addBound = (cx: number, cy: number, w: number, h: number) => {
      if (!this.world) return;
      const rb = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(cx * INV_SCALE, cy * INV_SCALE)
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid((w / 2) * INV_SCALE, (h / 2) * INV_SCALE)
          .setRestitution(0.35)
          .setFriction(0.22),
        rb
      );
    };
    addBound(WORLD_W / 2, -60, WORLD_W + 400, 120);
    addBound(WORLD_W / 2, WORLD_H + 60, WORLD_W + 400, 120);
    addBound(-60, WORLD_H / 2, 120, WORLD_H + 400);
    addBound(WORLD_W + 60, WORLD_H / 2, 120, WORLD_H + 400);

    // Pre-build Rapier bodies per room (disabled when inactive for zero-allocation O(1) room toggling)
    for (let c = 0; c < course.chunks.length; c++) {
      const chunk = course.chunks[c];
      const bodiesForRoom: RAPIER.RigidBody[] = [];
      const spinnersForRoom: RAPIER.RigidBody[] = [];

      // Walls: single seamless capsule per segment matching visual thickness (11px outer wall, 7px guide rail)
      for (let i = 0; i < chunk.walls.length; i++) {
        const w = chunk.walls[i];
        const cx = (w.x1 + w.x2) / 2;
        const cy = (w.y1 + w.y2) / 2;
        const dx = w.x2 - w.x1;
        const dy = w.y2 - w.y1;
        const len = Math.hypot(dx, dy) || 1;
        const angle = Math.atan2(dy, dx);
        const capRadius = w.kind === 'guide' ? 7 : 11;

        const wallBody = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed()
            .setTranslation(cx * INV_SCALE, cy * INV_SCALE)
            .setRotation(angle - Math.PI / 2)
            .setEnabled(false)
        );
        const wallCol = this.world.createCollider(
          RAPIER.ColliderDesc.capsule((len / 2) * INV_SCALE, capRadius * INV_SCALE)
            .setRestitution(w.bounce ?? 0.38)
            .setFriction(w.kind === 'guide' ? 0.08 : 0.22)
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
          wallBody
        );
        this.colliderMeta.set(wallCol.handle, { kind: 'wall' });
        bodiesForRoom.push(wallBody);
      }

      // Bumpers
      for (let i = 0; i < chunk.bumpers.length; i++) {
        const b = chunk.bumpers[i];
        const bBody = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed()
            .setTranslation(b.x * INV_SCALE, b.y * INV_SCALE)
            .setEnabled(false)
        );
        const bCol = this.world.createCollider(
          RAPIER.ColliderDesc.ball(b.r * INV_SCALE)
            .setRestitution(Math.min(1.0, b.bounce ?? 0.95))
            .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
            .setFriction(0.05)
            .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
          bBody
        );
        this.colliderMeta.set(bCol.handle, {
          kind: 'bumper',
          x: b.x,
          y: b.y,
          bounce: b.bounce ?? 1.3,
        });
        bodiesForRoom.push(bBody);
      }

      // Spinners (Kinematic Position-Based Rotating Compound Colliders)
      for (let i = 0; i < chunk.spinners.length; i++) {
        const s = chunk.spinners[i];
        const sBody = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.kinematicPositionBased()
            .setTranslation(s.x * INV_SCALE, s.y * INV_SCALE)
            .setRotation(s.angle)
            .setEnabled(false)
        );
        const hubCol = this.world.createCollider(
          RAPIER.ColliderDesc.ball(12 * INV_SCALE).setRestitution(0.55).setFriction(0.2),
          sBody
        );
        this.colliderMeta.set(hubCol.handle, { kind: 'spinner' });

        for (let a = 0; a < s.arms; a++) {
          const ang = (a * 2 * Math.PI) / s.arms;
          const ax = Math.cos(ang) * (s.r / 2) * INV_SCALE;
          const ay = Math.sin(ang) * (s.r / 2) * INV_SCALE;
          const armCol = this.world.createCollider(
            RAPIER.ColliderDesc.cuboid((s.r / 2) * INV_SCALE, 5 * INV_SCALE)
              .setTranslation(ax, ay)
              .setRotation(ang)
              .setRestitution(0.6)
              .setFriction(0.2)
              .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
            sBody
          );
          this.colliderMeta.set(armCol.handle, { kind: 'spinner' });
        }

        spinnersForRoom.push(sBody);
        bodiesForRoom.push(sBody);
      }

      // Pistons (Kinematic Position-Based Cuboids aligned with top-left renderer box)
      if (chunk.pistons) {
        for (let i = 0; i < chunk.pistons.length; i++) {
          const p = chunk.pistons[i];
          const pBody = this.world.createRigidBody(
            RAPIER.RigidBodyDesc.kinematicPositionBased()
              .setTranslation((p.x + p.w / 2) * INV_SCALE, (p.y + p.h / 2) * INV_SCALE)
              .setEnabled(false)
          );
          const pCol = this.world.createCollider(
            RAPIER.ColliderDesc.cuboid((p.w / 2) * INV_SCALE, (p.h / 2) * INV_SCALE)
              .setRestitution(0.85)
              .setFriction(0.2)
              .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
            pBody
          );
          this.colliderMeta.set(pCol.handle, { kind: 'piston' });
          this.pistonBodies.set(p.id, pBody);
          bodiesForRoom.push(pBody);
        }
      }

      // Pendulums (Kinematic Position-Based Metallic Bobs)
      if (chunk.pendulums) {
        for (let i = 0; i < chunk.pendulums.length; i++) {
          const pend = chunk.pendulums[i];
          const bobBody = this.world.createRigidBody(
            RAPIER.RigidBodyDesc.kinematicPositionBased()
              .setTranslation(pend.pivotX * INV_SCALE, (pend.pivotY + pend.length) * INV_SCALE)
              .setEnabled(false)
          );
          const bobCol = this.world.createCollider(
            RAPIER.ColliderDesc.ball(pend.bobRadius * INV_SCALE)
              .setRestitution(0.88)
              .setFriction(0.15)
              .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
            bobBody
          );
          this.colliderMeta.set(bobCol.handle, { kind: 'pendulum' });
          this.pendulumBodies.set(pend.id, bobBody);
          bodiesForRoom.push(bobBody);
        }
      }

      this.spinnerBodies.set(chunk.id, spinnersForRoom);
      this.chunkBodies.push(bodiesForRoom);
    }

    // Create dynamic CCD-enabled bodies for player marbles
    for (let i = 0; i < marbles.length; i++) {
      const m = marbles[i];
      if (m.isZombie && !m.zombieType) {
        m.zombieType = 'walker';
        const spec = ZOMBIE_SPECS.walker;
        m.zhp = spec.hp;
        m.maxZhp = spec.hp;
        m.zSpeedMult = spec.speedMult;
        m.zForceMult = spec.forceMult;
      }
      this.createMarbleBody(m);
    }

    // Spawn wandering patrol zombies across deeper rooms
    if (course.roomZombies && course.roomZombies.length > 0) {
      for (const rz of course.roomZombies) {
        this.spawnNpcZombie(rz.x, rz.y, rz.zombieType, rz.chunkId);
      }
    }

    // Initial dynamic room activation
    this.activeChunkIndices = getActiveChunkIndices(course, this.lastMarbles, [], []);
    for (const idx of this.activeChunkIndices) {
      const bodies = this.chunkBodies[idx];
      if (bodies) {
        for (let i = 0; i < bodies.length; i++) {
          bodies[i].setEnabled(true);
        }
      }
    }
  }

  private damageZombie(z: Marble, dmg: number, pushVxPx: number, pushVyPx: number, attacker: Marble) {
    if (z.gone || z.finished || !z.isZombie) return;

    z.zhp = (z.zhp ?? 4) - dmg;
    const zBody = this.marbleBodies.get(z.id);
    if (zBody) {
      const curV = zBody.linvel();
      zBody.setLinvel(
        {
          x: curV.x * 0.25 + pushVxPx * 1.15,
          y: curV.y * 0.25 + pushVyPx * 1.15,
        },
        true
      );
    }

    if (z.zhp <= 0) {
      z.gone = true;
      if (zBody && this.world) {
        for (let ci = 0; ci < zBody.numColliders(); ci++) {
          this.colliderMeta.delete(zBody.collider(ci).handle);
        }
        this.world.removeRigidBody(zBody);
        this.marbleBodies.delete(z.id);
      }
      attacker.kills = (attacker.kills || 0) + 1;
      sound.playInfection();
      this.addParticles(z.x, z.y, '#84cc16', 14, 5.5, 'slime');

      const zt = z.zombieType || 'walker';
      if (zt === 'tank' || zt === 'boss') {
        const title = zt === 'boss' ? '👑 ¡JEFE ELIMINADO!' : '💀 ¡TANQUE ABATIDO!';
        this.addParticles(z.x, z.y, '#fde047', 18, 6.5, 'spark');
        this.addFloatingText(z.x, z.y - 18, title, '#fde047');
        this.addCombatEvent(`${title} por ${attacker.name}`, '#fde047');
        this.highlightEvents.push({
          t: this.lastRaceTime,
          marbleId: attacker.id,
          text: `${title} (${attacker.name})`,
          color: '#fde047',
          weight: zt === 'boss' ? 9 : 6,
          kind: 'kill',
        });
        this.pendingFocus = {
          x: z.x,
          y: z.y,
          color: '#fde047',
          text: title,
          durationSec: 1.1,
        };
      } else {
        this.addFloatingText(z.x, z.y - 14, '💀 +1 BAJA', '#a3e635');
      }
    }
  }

  public update(
    course: CourseData,
    marbles: Marble[],
    dt: number,
    simSpeed: number,
    raceTime: number,
    onFinishFirst: (winner: Marble) => void
  ) {
    if (!this.world || !this.eventQueue) return;
    if (this.currentCourse !== course) {
      this.init(course, marbles);
    }

    this.lastMarbles = marbles;
    this.lastRaceTime = raceTime;
    this.simTickCounter++;

    const effectiveDt = dt * simSpeed;
    const stepScale = effectiveDt * 60; // Normalized to 60Hz feel for non-Rapier scalar particles/projectiles

    // 1. Update Active Rooms via zero-allocation setEnabled() toggling
    const newActive = getActiveChunkIndices(course, marbles, this.projectiles, this.barricades);
    if (newActive.join(',') !== this.activeChunkIndices.join(',')) {
      const toRemove = this.activeChunkIndices.filter((i) => !newActive.includes(i));
      const toAdd = newActive.filter((i) => !this.activeChunkIndices.includes(i));

      for (const idx of toRemove) {
        const bodies = this.chunkBodies[idx];
        if (bodies) {
          for (let b = 0; b < bodies.length; b++) bodies[b].setEnabled(false);
        }
      }
      for (const idx of toAdd) {
        const bodies = this.chunkBodies[idx];
        if (bodies) {
          for (let b = 0; b < bodies.length; b++) bodies[b].setEnabled(true);
        }
      }
      this.activeChunkIndices = newActive;
    }

    // Reset continuous user forces on all dynamic marble bodies before this tick
    for (let i = 0; i < marbles.length; i++) {
      const m = marbles[i];
      if (m.gone) continue;
      const rb = this.marbleBodies.get(m.id);
      if (rb) rb.resetForces(true);
    }

    // 2. Animate Kinematic Hazards & Interactive Zones in Active Rooms
    for (const cIdx of this.activeChunkIndices) {
      const chunk = course.chunks[cIdx];
      if (!chunk) continue;

      // Spinners
      const spinBodies = this.spinnerBodies.get(cIdx);
      if (spinBodies) {
        for (let i = 0; i < chunk.spinners.length; i++) {
          const s = chunk.spinners[i];
          const sBody = spinBodies[i];
          s.angle += s.speed * effectiveDt * 60;
          if (sBody) sBody.setNextKinematicRotation(s.angle);
        }
      }

      // Pistons
      if (chunk.pistons) {
        for (let i = 0; i < chunk.pistons.length; i++) {
          const p = chunk.pistons[i];
          const pBody = this.pistonBodies.get(p.id);
          if (!pBody) continue;
          const cycleT = ((raceTime / p.period + p.phase) % 1 + 1) % 1;
          let tg = 0;
          if (p.dutyCycle && p.dutyCycle > 0 && p.dutyCycle < 1) {
            tg = cycleT < p.dutyCycle ? cycleT / p.dutyCycle : (1 - cycleT) / (1 - p.dutyCycle);
          } else {
            tg = 0.5 - 0.5 * Math.cos(2 * Math.PI * (raceTime / p.period + p.phase));
          }
          pBody.setNextKinematicTranslation({
            x: (p.x + p.w / 2 + p.dx * tg) * INV_SCALE,
            y: (p.y + p.h / 2 + p.dy * tg) * INV_SCALE,
          });
        }
      }

      // Pendulums
      if (chunk.pendulums) {
        for (let i = 0; i < chunk.pendulums.length; i++) {
          const pend = chunk.pendulums[i];
          const bobBody = this.pendulumBodies.get(pend.id);
          if (!bobBody) continue;
          const ang = pend.maxAngle * Math.sin(2 * Math.PI * (raceTime / pend.period + pend.phase));
          bobBody.setNextKinematicTranslation({
            x: (pend.pivotX + Math.sin(ang) * pend.length) * INV_SCALE,
            y: (pend.pivotY + Math.cos(ang) * pend.length) * INV_SCALE,
          });
          bobBody.setNextKinematicRotation(ang);
        }
      }

      // Wind Zones
      if (chunk.windZones) {
        for (let i = 0; i < chunk.windZones.length; i++) {
          const w = chunk.windZones[i];
          const gust = w.gustPeriod ? 1 + 0.35 * Math.sin(raceTime * (2 * Math.PI / w.gustPeriod)) : 1;
          for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
            const m = marbles[mIdx];
            if (m.finished || m.gone) continue;
            const rb = this.marbleBodies.get(m.id);
            if (!rb) continue;
            if (m.x >= w.x && m.x <= w.x + w.w && m.y >= w.y && m.y <= w.y + w.h) {
              const mass = rb.mass();
              rb.addForce({ x: w.forceX * 15.0 * gust * mass, y: w.forceY * 15.0 * gust * mass }, true);
            }
          }
        }
      }

      // Magnet Zones
      if (chunk.magnetZones) {
        for (let i = 0; i < chunk.magnetZones.length; i++) {
          const mag = chunk.magnetZones[i];
          for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
            const m = marbles[mIdx];
            if (m.finished || m.gone) continue;
            const rb = this.marbleBodies.get(m.id);
            if (!rb) continue;
            const dx = mag.x - m.x;
            const dy = mag.y - m.y;
            const d = Math.hypot(dx, dy);
            if (d < mag.r && d > 12) {
              const mass = rb.mass();
              rb.addForce(
                { x: (dx / d) * mag.force * 12.5 * mass, y: (dy / d) * mag.force * 12.5 * mass },
                true
              );
            }
          }
        }
      }

      // Sticky Slow Zones
      if (chunk.slowZones) {
        for (let i = 0; i < chunk.slowZones.length; i++) {
          const sz = chunk.slowZones[i];
          for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
            const m = marbles[mIdx];
            if (m.finished || m.gone) continue;
            const rb = this.marbleBodies.get(m.id);
            if (!rb) continue;
            if (m.x >= sz.x && m.x <= sz.x + sz.w && m.y >= sz.y && m.y <= sz.y + sz.h) {
              const v = rb.linvel();
              const keep = Math.max(0.75, 1 - sz.drag * stepScale);
              rb.setLinvel({ x: v.x * keep, y: v.y * keep }, true);
            }
          }
        }
      }

      // Teleporter Portals
      if (chunk.portals) {
        for (let i = 0; i < chunk.portals.length; i++) {
          const tp = chunk.portals[i];
          for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
            const m = marbles[mIdx];
            if (m.finished || m.gone) continue;
            if ((m.tpCooldownUntil || 0) > raceTime) continue;
            const rb = this.marbleBodies.get(m.id);
            if (!rb) continue;
            if (m.x >= tp.x && m.x <= tp.x + tp.w && m.y >= tp.y && m.y <= tp.y + tp.h) {
              m.tpCooldownUntil = raceTime + 1.6;
              this.addParticles(m.x, m.y, tp.color || '#a855f7', 12, 4.5);
              rb.setTranslation({ x: tp.tx * INV_SCALE, y: tp.ty * INV_SCALE }, true);
              const v = rb.linvel();
              rb.setLinvel({ x: v.x * 0.4, y: v.y * 0.4 }, true);
              this.addParticles(tp.tx, tp.ty, '#38bdf8', 12, 4.5);
              sound.playBoosterZap();
              this.addFloatingText(tp.tx, tp.ty - 16, '🌀 WARP!', '#c084fc');
            }
          }
        }
      }

      // Spike Strips
      if (chunk.spikeZones) {
        for (let i = 0; i < chunk.spikeZones.length; i++) {
          const spk = chunk.spikeZones[i];
          for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
            const m = marbles[mIdx];
            if (m.isZombie || m.finished || m.gone) continue;
            if (m.x >= spk.x && m.x <= spk.x + spk.w && m.y >= spk.y && m.y <= spk.y + spk.h) {
              this.applyHumanDamage(m);
            }
          }
        }
      }

      // Timed Kicker Launch Pads
      if (chunk.kickerZones) {
        for (let i = 0; i < chunk.kickerZones.length; i++) {
          const kz = chunk.kickerZones[i];
          const stepNum = Math.floor((raceTime + kz.phase * kz.period) / kz.period);
          if (stepNum !== kz.lastStep) {
            kz.lastStep = stepNum;
            kz.flashUntil = raceTime + 0.3;
            for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
              const m = marbles[mIdx];
              if (m.finished || m.gone) continue;
              const rb = this.marbleBodies.get(m.id);
              if (!rb) continue;
              if (
                m.x >= kz.x - 10 &&
                m.x <= kz.x + kz.w + 10 &&
                m.y >= kz.y - 24 &&
                m.y <= kz.y + kz.h + 10
              ) {
                const v = rb.linvel();
                rb.setLinvel({ x: v.x + kz.ix * 1.15, y: kz.iy * 1.25 }, true);
                sound.playBumper(620);
                this.addParticles(m.x, m.y, '#fde047', 8, 4);
              }
            }
          }
        }
      }

      // Healing Pads
      if (chunk.healZones) {
        for (let i = 0; i < chunk.healZones.length; i++) {
          const hz = chunk.healZones[i];
          for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
            const m = marbles[mIdx];
            if (m.isZombie || m.finished || m.gone) continue;
            if (m.hp >= m.maxHp) continue;
            if (m.healedZones && m.healedZones[hz.id]) continue;
            if (m.x >= hz.x && m.x <= hz.x + hz.w && m.y >= hz.y && m.y <= hz.y + hz.h) {
              m.healedZones = m.healedZones || {};
              m.healedZones[hz.id] = true;
              m.hp = Math.min(m.maxHp, m.hp + hz.amount);
              sound.playCratePickup();
              this.addParticles(m.x, m.y, '#4ade80', 12, 4);
              this.addFloatingText(m.x, m.y - 16, `❤️ +${hz.amount} HP!`, '#4ade80');
            }
          }
        }
      }

      // Crypt Zombie Ambush Spawners
      if (chunk.cryptZones) {
        for (let i = 0; i < chunk.cryptZones.length; i++) {
          const cz = chunk.cryptZones[i];
          if (cz.triggered) continue;
          for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
            const m = marbles[mIdx];
            if (m.isZombie || m.finished || m.gone) continue;
            if (m.x >= cz.x && m.x <= cz.x + cz.w && m.y >= cz.y && m.y <= cz.y + cz.h) {
              cz.triggered = true;
              sound.playEmpPower();
              this.addParticles(cz.spawnX, cz.spawnY, '#a855f7', 22, 6, 'slime');
              this.addFloatingText(cz.spawnX, cz.spawnY - 22, `⚰️ ¡CRIPTA ABIERTA (+${cz.count})!`, '#c084fc');
              this.addCombatEvent(`⚰️ ¡CRIPTA ABIERTA en ${chunk.name}!`, '#c084fc');
              for (let j = 0; j < cz.count; j++) {
                const zt: ZombieType =
                  j === 0 && cz.count >= 4 ? 'boss' : Math.random() < 0.25 ? 'runner' : Math.random() < 0.2 ? 'tank' : 'walker';
                this.pendingZombieSpawns.push({
                  x: cz.spawnX + (j - cz.count / 2) * 26,
                  y: cz.spawnY + (Math.random() - 0.5) * 24,
                  zombieType: zt,
                  roomId: chunk.id,
                });
              }
              break;
            }
          }
        }
      }

      // Pickup Crates
      if (chunk.crates) {
        for (let c = 0; c < chunk.crates.length; c++) {
          const crate = chunk.crates[c];
          if (!crate.active) {
            crate.respawnTimer -= effectiveDt;
            if (crate.respawnTimer <= 0) crate.active = true;
            continue;
          }

          for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
            const m = marbles[mIdx];
            if (m.finished || m.gone || m.isZombie) continue;
            const distToCrate = Math.hypot(m.x - crate.x, m.y - crate.y);
            if (distToCrate < 30) {
              crate.active = false;
              crate.respawnTimer = 14;

              if (crate.type === 'emp') {
                sound.playEmpBlast();
                this.addParticles(crate.x, crate.y, '#38bdf8', 16, 6);
                this.addFloatingText(crate.x, crate.y - 16, '⚡ EMP EXPANSIVO!', '#38bdf8');
                for (let j = 0; j < marbles.length; j++) {
                  const other = marbles[j];
                  if (!other.isZombie || other.gone) continue;
                  const distToOther = Math.hypot(other.x - crate.x, other.y - crate.y);
                  if (distToOther < 340) {
                    const oBody = this.marbleBodies.get(other.id);
                    if (oBody) {
                      const pushX = (other.x - crate.x) / (distToOther || 1);
                      const pushY = (other.y - crate.y) / (distToOther || 1);
                      oBody.setLinvel({ x: pushX * 13.5, y: pushY * 13.5 - 2.5 }, true);
                    }
                  }
                }
              } else if (crate.type === 'turbo') {
                sound.playBoosterZap();
                m.turboTime = raceTime + 3.0;
                this.addParticles(crate.x, crate.y, '#f59e0b', 12, 5);
                this.addFloatingText(m.x, m.y - 16, '⏩ TURBO!', '#f59e0b');
              } else if (crate.type === 'shield') {
                sound.playCratePickup();
                m.shield = 100;
                this.addParticles(crate.x, crate.y, '#10b981', 12, 4);
                this.addFloatingText(m.x, m.y - 16, '🛡️ ESCUDO!', '#10b981');
              } else if (crate.type === 'repair') {
                sound.playCratePickup();
                m.hp = Math.min(m.maxHp, m.hp + 2);
                this.addParticles(crate.x, crate.y, '#ef4444', 12, 4);
                this.addFloatingText(m.x, m.y - 16, '❤️ +2 HP!', '#ef4444');
              } else {
                const weaponPool: WeaponType[] = ['shotgun', 'rifle', 'spread', 'rapid', 'sword', 'bat'];
                const chosenW: WeaponType =
                  crate.type === 'weapon_swap'
                    ? weaponPool.filter((w) => w !== m.weaponType)[Math.floor(Math.random() * (weaponPool.length - 1))] || 'shotgun'
                    : (crate.type as WeaponType);
                const wSpec = WEAPON_SPECS[chosenW] || WEAPON_SPECS.blaster;
                sound.playCratePickup();
                m.weaponType = chosenW;
                m.weaponUpgradeTimer = 12.0;
                this.addParticles(crate.x, crate.y, wSpec.color, 14, 5);
                this.addFloatingText(m.x, m.y - 16, `${wSpec.icon} ${wSpec.name.toUpperCase()}!`, wSpec.color);
                this.addCombatEvent(`${wSpec.icon} ${m.name} equipó ${wSpec.name}`, wSpec.color);
              }
              break;
            }
          }
        }
      }
    }

    // Flush queued Crypt zombies
    if (this.pendingZombieSpawns.length > 0) {
      for (const sp of this.pendingZombieSpawns) {
        this.spawnNpcZombie(sp.x, sp.y, sp.zombieType, sp.roomId);
      }
      this.pendingZombieSpawns.length = 0;
    }

    let finishedCount = 0;
    for (let i = 0; i < marbles.length; i++) {
      if (marbles[i].finished) finishedCount++;
    }

    // 3. Apply Steering Forces, Elevators, Boosters, Weapons & Zombie AI
    for (let idx = 0; idx < marbles.length; idx++) {
      const m = marbles[idx];
      if (m.gone) continue;
      const body = this.marbleBodies.get(m.id);
      if (!body) continue;

      const vel = body.linvel();
      const mass = body.mass();

      if (m.finished) {
        body.setLinvel({ x: vel.x * 0.94, y: vel.y * 0.94 }, true);
        continue;
      }

      const roomIdx = getChunkIndexAt(course, m.x, m.y);
      m.currentRoomId = roomIdx;
      const room = course.chunks[roomIdx];

      // Active Turbo / Boost surge
      if ((m.turboTime && m.turboTime > raceTime) || (m.boostUntil && m.boostUntil > raceTime)) {
        const curSpd = Math.hypot(vel.x, vel.y) || 1;
        body.addForce({ x: (vel.x / curSpd) * 18.0 * mass, y: (vel.y / curSpd) * 18.0 * mass }, true);
      }

      if (m.isZombie) {
        let nearestHuman: Marble | null = null;
        let minHDist = 360;
        for (let j = 0; j < marbles.length; j++) {
          const other = marbles[j];
          if (!other.isZombie && !other.finished && !other.gone) {
            const d = Math.hypot(other.x - m.x, other.y - m.y);
            if (d < minHDist) {
              minHDist = d;
              nearestHuman = other;
            }
          }
        }
        const fMult = m.zForceMult ?? 1.0;
        if (nearestHuman) {
          const dirX = (nearestHuman.x - m.x) / (minHDist || 1);
          const dirY = (nearestHuman.y - m.y) / (minHDist || 1);
          body.addForce({ x: dirX * 14.5 * fMult * mass, y: dirY * 14.5 * fMult * mass }, true);
        } else if (room && !m.id.startsWith('npc_')) {
          const targetPt = this.getRoomExitTarget(course, room);
          const dx = targetPt.x - m.x;
          const dy = targetPt.y - m.y;
          const d = Math.hypot(dx, dy) || 1;
          body.addForce({ x: (dx / d) * 10.5 * fMult * mass, y: (dy / d) * 10.5 * fMult * mass }, true);
        }
      } else {
        // Living Survivor: Smooth BFS Maze Exit Steering + Corridor Centering + Auto-Target Weapons
        if (room) {
          const targetPt = this.getRoomExitTarget(course, room);
          const dx = targetPt.x - m.x;
          const dy = targetPt.y - m.y;
          const d = Math.hypot(dx, dy) || 1;
          const spd = Math.hypot(vel.x, vel.y);
          const steerMag = room.nextDir === 'n' ? 20.5 : spd < 2.6 ? 15.5 : 11.8;

          // Gentle corridor-centering bias so marbles glide cleanly through doorway openings
          let alignFx = 0;
          let alignFy = 0;
          if (room.nextDir === 'e' || room.nextDir === 'w') {
            alignFy = ((room.y + ROOM_SIZE / 2) - m.y) * 0.045;
          } else if (room.nextDir === 'n' || room.nextDir === 's') {
            alignFx = ((room.x + ROOM_SIZE / 2) - m.x) * 0.045;
          }

          body.addForce(
            {
              x: ((dx / d) * steerMag + alignFx) * mass,
              y: ((dy / d) * steerMag + alignFy) * mass,
            },
            true
          );
        }

        // Weapons update
        m.weaponCooldown = Math.max(0, (m.weaponCooldown || 0) - effectiveDt);
        if (m.weaponUpgradeTimer && m.weaponUpgradeTimer > 0) {
          m.weaponUpgradeTimer -= effectiveDt;
          if (m.weaponUpgradeTimer <= 0) m.weaponType = 'blaster';
        }

        const wSpec = WEAPON_SPECS[m.weaponType || 'blaster'] || WEAPON_SPECS.blaster;
        let nearestZombie: Marble | null = null;
        let minZDist = wSpec.range;

        for (let j = 0; j < marbles.length; j++) {
          const other = marbles[j];
          if (other.isZombie && !other.finished && !other.gone) {
            const d = Math.hypot(other.x - m.x, other.y - m.y);
            if (d < minZDist) {
              minZDist = d;
              nearestZombie = other;
            }
          }
        }

        if (nearestZombie) {
          const aim = Math.atan2(nearestZombie.y - m.y, nearestZombie.x - m.x);
          m.aimAngle = aim;

          if ((m.weaponCooldown || 0) <= 0) {
            m.weaponCooldown = wSpec.cooldown;

            if (wSpec.isMelee) {
              sound.playImpact(7, 1.0, 220);
              const nx = Math.cos(aim);
              const ny = Math.sin(aim);
              this.projectiles.push({
                id: `melee_${Math.random().toString(36).substring(2, 7)}`,
                x1: m.x,
                y1: m.y,
                x: nearestZombie.x,
                y: nearestZombie.y,
                vx: nx * 0.01,
                vy: ny * 0.01,
                ownerId: m.id,
                lifetime: 0.14,
                maxLifetime: 0.14,
                color: wSpec.color,
                isMelee: true,
              });
              this.damageZombie(nearestZombie, wSpec.damage, nx * wSpec.knockback, ny * wSpec.knockback, m);
            } else {
              sound.playLaserShot();
              const pellets = wSpec.pellets || 1;
              const pSpeed = wSpec.id === 'rifle' ? 25 : 19;
              const spreadArc = wSpec.id === 'shotgun' ? 0.34 : 0.22;

              for (let p = 0; p < pellets; p++) {
                const angleOffset = pellets === 1 ? 0 : ((p / (pellets - 1)) - 0.5) * spreadArc;
                const sa = aim + angleOffset;
                this.projectiles.push({
                  id: `p_${Math.random().toString(36).substring(2, 7)}`,
                  x: m.x + Math.cos(sa) * (m.radius + 3),
                  y: m.y + Math.sin(sa) * (m.radius + 3),
                  vx: Math.cos(sa) * pSpeed,
                  vy: Math.sin(sa) * pSpeed,
                  ownerId: m.id,
                  lifetime: wSpec.id === 'rifle' ? 0.6 : 0.45,
                  maxLifetime: wSpec.id === 'rifle' ? 0.6 : 0.45,
                  color: wSpec.color || m.color,
                  damage: wSpec.damage,
                  knockback: wSpec.knockback,
                });
              }
            }
          }
        } else {
          m.aimAngle = Math.atan2(m.vy || 1, m.vx || 0);
        }
      }

      // Elevators / Air-Lift shafts in active rooms
      let inElevator = false;
      for (const cIdx of this.activeChunkIndices) {
        const ch = course.chunks[cIdx];
        if (!ch) continue;
        for (let i = 0; i < ch.elevators.length; i++) {
          const el = ch.elevators[i];
          if (m.x >= el.x && m.x <= el.x + el.w && m.y >= el.y && m.y <= el.y + el.h) {
            inElevator = true;
            const centerPullX = ((el.x + el.w / 2) - m.x) * 0.09;
            const targetVy = (el.liftSpeed || -6.5) * 1.25;
            body.setLinvel(
              {
                x: Math.max(-4.5, Math.min(4.5, vel.x * 0.85 + centerPullX)),
                y: targetVy,
              },
              true
            );
            sound.playBoosterZap();
            break;
          }
        }
        if (inElevator) break;
      }

      // Boosters in active rooms
      for (const cIdx of this.activeChunkIndices) {
        const ch = course.chunks[cIdx];
        if (!ch) continue;
        let boosted = false;
        for (let i = 0; i < ch.boosters.length; i++) {
          const b = ch.boosters[i];
          if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) {
            body.addForce({ x: b.forceX * 16.0 * mass, y: b.forceY * 16.0 * mass }, true);
            sound.playBoosterZap();
            boosted = true;
            break;
          }
        }
        if (boosted) break;
      }

      // Anti-stuck safeguard
      if (!inElevator) {
        const moveDist = Math.hypot(m.x - (m.lastX ?? m.x), m.y - (m.lastY ?? m.y));
        if (moveDist < 0.08) {
          m.stuckFrames = (m.stuckFrames || 0) + 1;
        } else {
          m.stuckFrames = 0;
          m.lastX = m.x;
          m.lastY = m.y;
        }

        if ((m.stuckFrames || 0) > 220 && room && !m.isZombie) {
          m.stuckFrames = 0;
          const exitPt = this.getRoomExitTarget(course, room);
          const dirX = exitPt.x - m.x;
          const dirY = exitPt.y - m.y;
          const d = Math.hypot(dirX, dirY) || 1;
          body.setLinvel({ x: (dirX / d) * 8.0, y: (dirY / d) * 8.0 - 2.0 }, true);
          this.addParticles(m.x, m.y, '#38bdf8', 8, 3);
        }
      }
    }

    // 4. Update Projectiles & Zombie Hits
    for (let pIdx = this.projectiles.length - 1; pIdx >= 0; pIdx--) {
      const p = this.projectiles[pIdx];
      p.lifetime -= effectiveDt;
      if (p.lifetime <= 0) {
        this.projectiles.splice(pIdx, 1);
        continue;
      }
      if (p.isMelee) continue;

      p.x += p.vx * stepScale;
      p.y += p.vy * stepScale;

      let hit = false;
      for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
        const z = marbles[mIdx];
        if (!z.isZombie || z.finished || z.gone) continue;
        const dist = Math.hypot(z.x - p.x, z.y - p.y);
        if (dist < (z.radius || 12.5) + 6) {
          hit = true;
          sound.playPlasmaHit();
          this.addParticles(p.x, p.y, p.color || '#38bdf8', 7, 4.5);
          const pSpd = Math.hypot(p.vx, p.vy) || 1;
          const kb = p.knockback ?? 7.5;
          const owner = marbles.find((o) => o.id === p.ownerId) || marbles[0];
          this.damageZombie(z, p.damage ?? 1.2, (p.vx / pSpd) * kb, (p.vy / pSpd) * kb, owner);
          break;
        }
      }

      if (hit) {
        this.projectiles.splice(pIdx, 1);
      }
    }

    // Update Barricades, Particles, Floating Texts
    for (let bIdx = this.barricades.length - 1; bIdx >= 0; bIdx--) {
      const b = this.barricades[bIdx];
      b.lifetime -= effectiveDt;
      if (b.lifetime <= 0) {
        const body = this.barricadeBodies.get(b.id);
        if (body && this.world) {
          for (let ci = 0; ci < body.numColliders(); ci++) {
            this.colliderMeta.delete(body.collider(ci).handle);
          }
          this.world.removeRigidBody(body);
          this.barricadeBodies.delete(b.id);
        }
        this.barricades.splice(bIdx, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * stepScale;
      pt.y += pt.vy * stepScale;
      pt.vx *= 0.94;
      pt.vy *= 0.94;
      pt.lifetime -= effectiveDt;
      pt.alpha = Math.max(0, pt.lifetime / pt.maxLifetime);
      if (pt.lifetime <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 0.65 * stepScale;
      ft.lifetime -= effectiveDt;
      ft.alpha = Math.max(0, ft.lifetime / ft.maxLifetime);
      if (ft.lifetime <= 0) this.floatingTexts.splice(i, 1);
    }

    // 5. Step Rapier2D WASM World & Drain Collision Events
    this.world.timestep = effectiveDt;
    this.world.step(this.eventQueue);
    this.processCollisions(marbles);

    // 6. Synchronize Positions, Speed Clamp, Safety Recovery & Labyrinth Progress
    const maxDist = course.maxDistToFinish || 12;

    for (let idx = 0; idx < marbles.length; idx++) {
      const m = marbles[idx];
      if (m.gone) continue;
      const body = this.marbleBodies.get(m.id);
      if (!body) continue;

      const vel = body.linvel();
      const maxSpd = m.isZombie ? 12.6 * (m.zSpeedMult ?? 1.0) : m.boostUntil && m.boostUntil > raceTime ? 15.6 : 14.4;
      const spd = Math.hypot(vel.x, vel.y);
      if (spd > maxSpd) {
        body.setLinvel({ x: (vel.x / spd) * maxSpd, y: (vel.y / spd) * maxSpd }, true);
      }

      const pos = body.translation();
      let px = pos.x * SCALE;
      let py = pos.y * SCALE;

      const isOutOfBounds = isNaN(px) || isNaN(py) || px < 15 || px > WORLD_W - 15 || py < 15 || py > WORLD_H - 15;
      if (isOutOfBounds) {
        const fallbackRoom = course.chunks[m.currentRoomId ?? 0] || course.chunks[0];
        px = fallbackRoom.x + ROOM_SIZE / 2;
        py = fallbackRoom.y + ROOM_SIZE / 2;
        body.setTranslation({ x: px * INV_SCALE, y: py * INV_SCALE }, true);
        body.setLinvel({ x: 0, y: 1.5 }, true);
      }

      const clampedVel = body.linvel();
      m.x = px;
      m.y = py;
      m.vx = clampedVel.x * (SCALE / 60);
      m.vy = clampedVel.y * (SCALE / 60);
      m.angle = body.rotation();
      m.omega = body.angvel();

      const rIdx = getChunkIndexAt(course, m.x, m.y);
      m.currentRoomId = rIdx;
      const room = course.chunks[rIdx];

      // Finish Bunker Extraction in Room 24
      if (!m.finished && rIdx === 24) {
        const distToFinish = Math.hypot(m.x - course.finishX, m.y - course.finishY);
        if (distToFinish < 115) {
          if (m.isZombie && m.id.startsWith('npc_')) {
            m.gone = true;
            for (let ci = 0; ci < body.numColliders(); ci++) {
              this.colliderMeta.delete(body.collider(ci).handle);
            }
            this.world.removeRigidBody(body);
            this.marbleBodies.delete(m.id);
          } else {
            m.finished = true;
            m.isExtracted = !m.isZombie;
            m.finishTime = raceTime + effectiveDt;
            finishedCount++;
            m.finishPosition = finishedCount;
            if (!this.firstFinisherRecorded && m.isExtracted) {
              this.firstFinisherRecorded = true;
              sound.playVictory();
              this.highlightEvents.push({
                t: raceTime,
                marbleId: m.id,
                text: `🏁 ¡${m.name} escapó primero!`,
                color: m.color,
                weight: 10,
                kind: 'win',
              });
              this.pendingFocus = {
                x: m.x,
                y: m.y,
                color: m.color,
                text: `🏁 ¡${m.name} ESCAPÓ PRIMERO!`,
                durationSec: 1.4,
              };
              onFinishFirst(m);
            } else {
              sound.playCheckpoint();
            }
          }
        }
      }

      // BFS Labyrinth Progress Score
      if (!m.finished && room) {
        const distRem = room.distToFinish ?? maxDist;
        const exitPt = this.getRoomExitTarget(course, room);
        const dToExit = Math.hypot(exitPt.x - m.x, exitPt.y - m.y);
        const subProgress = Math.max(0, Math.min(0.98, 1 - dToExit / ROOM_SIZE));
        m.progressScore = Math.max(0, maxDist - distRem) + subProgress;
      } else if (m.finished) {
        m.progressScore = maxDist + 10 - (m.finishPosition || 10);
      }
    }

    // 7. Record 20Hz Compact Replay Snapshots
    if (this.simTickCounter % 6 === 0 && this.replayFrames.length < 4000) {
      this.replayFrames.push({
        t: raceTime,
        marbles: marbles.map((m) => ({
          id: m.id,
          x: m.x,
          y: m.y,
          angle: m.angle,
          isZombie: m.isZombie,
          zombieType: m.zombieType,
          hp: m.hp,
          zhp: m.zhp,
          maxZhp: m.maxZhp,
          finished: m.finished,
          isExtracted: m.isExtracted,
          gone: m.gone,
          shield: m.shield,
          weaponType: m.weaponType,
          radius: m.radius,
        })),
      });
    }

    // Sort standings
    marbles.sort((a, b) => {
      if (a.isExtracted && !b.isExtracted) return -1;
      if (!a.isExtracted && b.isExtracted) return 1;
      if (a.isExtracted && b.isExtracted) return (a.finishPosition || 0) - (b.finishPosition || 0);

      if (!a.isZombie && b.isZombie) return -1;
      if (a.isZombie && !b.isZombie) return 1;

      if (!a.isZombie && !b.isZombie) return b.progressScore - a.progressScore;

      const aIsNpc = a.id.startsWith('npc_');
      const bIsNpc = b.id.startsWith('npc_');
      if (!aIsNpc && bIsNpc) return -1;
      if (aIsNpc && !bIsNpc) return 1;

      if ((b.kills || 0) !== (a.kills || 0)) return (b.kills || 0) - (a.kills || 0);
      return b.progressScore - a.progressScore;
    });

    let rankCounter = 1;
    for (let i = 0; i < marbles.length; i++) {
      if (!marbles[i].id.startsWith('npc_')) {
        marbles[i].rank = rankCounter++;
      } else {
        marbles[i].rank = 99;
      }
    }
  }

  private getRoomExitTarget(course: CourseData, room: { x: number; y: number; nextDir?: 'n' | 'e' | 's' | 'w' | null; id: number }) {
    if (room.id === 24 || !room.nextDir) {
      return { x: course.finishX, y: course.finishY };
    }
    const half = ROOM_SIZE / 2;
    if (room.nextDir === 'e') return { x: room.x + ROOM_SIZE - 16, y: room.y + half };
    if (room.nextDir === 'w') return { x: room.x + 16, y: room.y + half };
    if (room.nextDir === 'n') return { x: room.x + half, y: room.y + 16 };
    return { x: room.x + half, y: room.y + ROOM_SIZE - 16 };
  }
}

export const matterRaceEngine = new RapierRaceEngine();

export function updateSimulation(
  course: CourseData,
  marbles: Marble[],
  dt: number,
  simSpeed: number,
  raceTime: number,
  onFinishFirst: (winner: Marble) => void
) {
  matterRaceEngine.update(course, marbles, dt, simSpeed, raceTime, onFinishFirst);
}
