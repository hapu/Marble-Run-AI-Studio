import RAPIER from '@dimforge/rapier2d-compat';
import {
  Marble,
  CourseData,
  Projectile,
  CombatParticle,
  FloatingText,
  TemporaryBarricade,
  CombatEvent,
  HighlightEvent,
  ReplayFrame,
  FocusTrigger,
} from '../types';
import { ROOM_SIZE, WORLD_W, WORLD_H, ZOMBIE_SPECS } from '../constants';
import { sound } from '../audio';
import { ColliderMeta, INV_SCALE, PendingZombieSpawn, PhysicsContext, SCALE } from './types';
import {
  buildArenaBounds,
  buildRoomBodies,
  createMarbleBody,
  getActiveChunkIndices,
  getChunkIndexAt,
  getRoomExitTarget,
  isPhysicsReady,
  removeMarbleBody,
  spawnNpcZombie,
} from './worldFactory';
import {
  deployAirdrop as deployAirdropAction,
  deployBarricade as deployBarricadeAction,
  triggerEmpShockwave as triggerEmpAction,
  triggerMarbleBoost as triggerBoostAction,
  triggerMarbleHeal as triggerHealAction,
  triggerMarbleShield as triggerShieldAction,
  updateActiveChunkZones,
} from './zones';
import {
  processCollisions,
  updateMarblesBehavior,
  updateProjectilesAndFx,
} from './combat';

export class RapierRaceEngine implements PhysicsContext {
  public world: RAPIER.World | null = null;
  public eventQueue: RAPIER.EventQueue | null = null;
  public chunkBodies: RAPIER.RigidBody[][] = [];
  public spinnerBodies: Map<number, RAPIER.RigidBody[]> = new Map();
  public pistonBodies: Map<string, RAPIER.RigidBody> = new Map();
  public pendulumBodies: Map<string, RAPIER.RigidBody> = new Map();
  public marbleBodies: Map<string, RAPIER.RigidBody> = new Map();
  public barricadeBodies: Map<string, RAPIER.RigidBody> = new Map();
  public colliderMeta: Map<number, ColliderMeta> = new Map();

  public activeChunkIndices: number[] = [];
  public projectiles: Projectile[] = [];
  public particles: CombatParticle[] = [];
  public floatingTexts: FloatingText[] = [];
  public barricades: TemporaryBarricade[] = [];
  public combatFeed: CombatEvent[] = [];
  public highlightEvents: HighlightEvent[] = [];
  public replayFrames: ReplayFrame[] = [];
  public pendingFocus: FocusTrigger | null = null;
  public pendingDamageFlash: boolean = false;
  public followedMarbleId: string | null = null;
  public roomDamageCounts: Record<number, number> = {};

  public currentCourse: CourseData | null = null;
  public lastMarbles: Marble[] = [];
  public lastRaceTime: number = 0;
  public simTickCounter: number = 0;
  public firstFinisherRecorded: boolean = false;
  public pendingZombieSpawns: PendingZombieSpawn[] = [];

  public dispose(): void {
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

  public addParticles(
    x: number,
    y: number,
    color: string,
    count = 6,
    speed = 4,
    type: CombatParticle['type'] = 'spark'
  ): void {
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

  public addFloatingText(x: number, y: number, text: string, color: string): void {
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

  public addCombatEvent(text: string, color: string): void {
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

  public triggerEmpShockwave(targetX: number, targetY: number): void {
    triggerEmpAction(this, targetX, targetY);
  }

  public deployBarricade(targetX: number, targetY: number): void {
    deployBarricadeAction(this, targetX, targetY);
  }

  public deployAirdrop(targetX: number, targetY: number, course: CourseData): void {
    deployAirdropAction(this, targetX, targetY, course);
  }

  public triggerMarbleBoost(marbleId: string): boolean {
    return triggerBoostAction(this, marbleId);
  }

  public triggerMarbleShield(marbleId: string): boolean {
    return triggerShieldAction(this, marbleId);
  }

  public triggerMarbleHeal(marbleId: string): boolean {
    return triggerHealAction(this, marbleId);
  }

  public init(course: CourseData, marbles: Marble[]): void {
    if (!isPhysicsReady()) {
      throw new Error('Rapier2D WASM engine has not finished initializing.');
    }

    this.dispose();
    this.currentCourse = course;
    this.lastMarbles = marbles;

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

    buildArenaBounds(this.world);

    for (let c = 0; c < course.chunks.length; c++) {
      buildRoomBodies(this, course.chunks[c]);
    }

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
      createMarbleBody(this, m);
    }

    if (course.roomZombies && course.roomZombies.length > 0) {
      for (const rz of course.roomZombies) {
        spawnNpcZombie(this, rz.x, rz.y, rz.zombieType, rz.chunkId);
      }
    }

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

  public update(
    course: CourseData,
    marbles: Marble[],
    dt: number,
    simSpeed: number,
    raceTime: number,
    onFinishFirst: (winner: Marble) => void
  ): void {
    if (!this.world || !this.eventQueue) return;
    if (this.currentCourse !== course) {
      this.init(course, marbles);
    }

    this.lastMarbles = marbles;
    this.lastRaceTime = raceTime;
    this.simTickCounter++;

    const effectiveDt = dt * simSpeed;
    const stepScale = effectiveDt * 60;

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

    // Reset continuous user forces on all dynamic marble bodies
    for (let i = 0; i < marbles.length; i++) {
      const m = marbles[i];
      if (m.gone) continue;
      const rb = this.marbleBodies.get(m.id);
      if (rb) rb.resetForces(true);
    }

    // 2. Animate Kinematic Hazards & Interactive Zones in Active Rooms
    updateActiveChunkZones(this, course, marbles, effectiveDt, stepScale, raceTime);

    let finishedCount = 0;
    for (let i = 0; i < marbles.length; i++) {
      if (marbles[i].finished) finishedCount++;
    }

    // 3. Apply Steering Forces, Elevators, Boosters, Weapons & Zombie AI
    updateMarblesBehavior(this, course, marbles, effectiveDt, raceTime);

    // 4. Update Projectiles, Barricades, Particles & Floating Texts
    updateProjectilesAndFx(this, marbles, effectiveDt, stepScale);

    // 5. Step Rapier2D WASM World & Drain Collision Events
    this.world.timestep = effectiveDt;
    this.world.step(this.eventQueue);
    processCollisions(this, marbles);

    // 6. Synchronize Positions, Speed Clamp, Safety Recovery & Labyrinth Progress
    const maxDist = course.maxDistToFinish || 12;

    for (let idx = 0; idx < marbles.length; idx++) {
      const m = marbles[idx];
      if (m.gone) continue;
      const body = this.marbleBodies.get(m.id);
      if (!body) continue;

      const vel = body.linvel();
      const maxSpd = m.isZombie
        ? 12.6 * (m.zSpeedMult ?? 1.0)
        : m.boostUntil && m.boostUntil > raceTime
          ? 15.6
          : 14.4;
      const spd = Math.hypot(vel.x, vel.y);
      if (spd > maxSpd) {
        body.setLinvel({ x: (vel.x / spd) * maxSpd, y: (vel.y / spd) * maxSpd }, true);
      }

      const pos = body.translation();
      let px = pos.x * SCALE;
      let py = pos.y * SCALE;

      const isOutOfBounds =
        Number.isNaN(px) || Number.isNaN(py) || px < 15 || px > WORLD_W - 15 || py < 15 || py > WORLD_H - 15;
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
            removeMarbleBody(this, m.id);
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
        const exitPt = getRoomExitTarget(course, room);
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

    // 8. Sort Standings & Assign Ranks
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
}

export const rapierRaceEngine = new RapierRaceEngine();

export function updateSimulation(
  course: CourseData,
  marbles: Marble[],
  dt: number,
  simSpeed: number,
  raceTime: number,
  onFinishFirst: (winner: Marble) => void
): void {
  rapierRaceEngine.update(course, marbles, dt, simSpeed, raceTime, onFinishFirst);
}
