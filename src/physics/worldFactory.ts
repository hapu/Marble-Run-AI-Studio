import RAPIER from '@dimforge/rapier2d-compat';
import {
  CourseData,
  Marble,
  Projectile,
  TemporaryBarricade,
  TrackChunk,
  ZombieType,
} from '../types';
import { GRID_COLS, GRID_ROWS, ROOM_SIZE, WORLD_W, WORLD_H, ZOMBIE_SPECS } from '../constants';
import { INV_SCALE, PhysicsContext } from './types';

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
    if (room.doors.n && room.row > 0) activeSet.add((room.row - 1) * GRID_COLS + room.col);
    if (room.doors.s && room.row < GRID_ROWS - 1) activeSet.add((room.row + 1) * GRID_COLS + room.col);
    if (room.doors.w && room.col > 0) activeSet.add(room.row * GRID_COLS + (room.col - 1));
    if (room.doors.e && room.col < GRID_COLS - 1) activeSet.add(room.row * GRID_COLS + (room.col + 1));
  };

  for (let i = 0; i < marbles.length; i++) {
    const m = marbles[i];
    if (!m.finished && !m.gone) {
      addRoomWithNeighbors(getChunkIndexAt(course, m.x, m.y));
    }
  }

  for (let i = 0; i < projectiles.length; i++) {
    activeSet.add(getChunkIndexAt(course, projectiles[i].x, projectiles[i].y));
  }

  for (let i = 0; i < barricades.length; i++) {
    activeSet.add(getChunkIndexAt(course, barricades[i].x, barricades[i].y));
  }

  if (activeSet.size === 0) {
    activeSet.add(course.chunks.length - 1);
  }

  return Array.from(activeSet).sort((a, b) => a - b);
}

export function getRoomExitTarget(
  course: CourseData,
  room: Pick<TrackChunk, 'x' | 'y' | 'nextDir' | 'id'>
): { x: number; y: number } {
  if (room.id === 24 || !room.nextDir) {
    return { x: course.finishX, y: course.finishY };
  }
  const half = ROOM_SIZE / 2;
  if (room.nextDir === 'e') return { x: room.x + ROOM_SIZE - 16, y: room.y + half };
  if (room.nextDir === 'w') return { x: room.x + 16, y: room.y + half };
  if (room.nextDir === 'n') return { x: room.x + half, y: room.y + 16 };
  return { x: room.x + half, y: room.y + ROOM_SIZE - 16 };
}

export function buildArenaBounds(world: RAPIER.World): void {
  const addBound = (cx: number, cy: number, w: number, h: number) => {
    const rb = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(cx * INV_SCALE, cy * INV_SCALE)
    );
    world.createCollider(
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
}

export function buildRoomBodies(ctx: PhysicsContext, chunk: TrackChunk): void {
  if (!ctx.world) return;
  const bodiesForRoom: RAPIER.RigidBody[] = [];
  const spinnersForRoom: RAPIER.RigidBody[] = [];

  for (let i = 0; i < chunk.walls.length; i++) {
    const w = chunk.walls[i];
    const cx = (w.x1 + w.x2) / 2;
    const cy = (w.y1 + w.y2) / 2;
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const len = Math.hypot(dx, dy) || 1;
    const angle = Math.atan2(dy, dx);
    const capRadius = w.kind === 'guide' ? 7 : 11;

    const wallBody = ctx.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(cx * INV_SCALE, cy * INV_SCALE)
        .setRotation(angle - Math.PI / 2)
        .setEnabled(false)
    );
    const wallCol = ctx.world.createCollider(
      RAPIER.ColliderDesc.capsule((len / 2) * INV_SCALE, capRadius * INV_SCALE)
        .setRestitution(w.bounce ?? 0.38)
        .setFriction(w.kind === 'guide' ? 0.08 : 0.22)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      wallBody
    );
    ctx.colliderMeta.set(wallCol.handle, { kind: 'wall' });
    bodiesForRoom.push(wallBody);
  }

  for (let i = 0; i < chunk.bumpers.length; i++) {
    const b = chunk.bumpers[i];
    const bBody = ctx.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(b.x * INV_SCALE, b.y * INV_SCALE)
        .setEnabled(false)
    );
    const bCol = ctx.world.createCollider(
      RAPIER.ColliderDesc.ball(b.r * INV_SCALE)
        .setRestitution(Math.min(1.0, b.bounce ?? 0.95))
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
        .setFriction(0.05)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      bBody
    );
    ctx.colliderMeta.set(bCol.handle, {
      kind: 'bumper',
      x: b.x,
      y: b.y,
      bounce: b.bounce ?? 1.3,
    });
    bodiesForRoom.push(bBody);
  }

  for (let i = 0; i < chunk.spinners.length; i++) {
    const s = chunk.spinners[i];
    const sBody = ctx.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(s.x * INV_SCALE, s.y * INV_SCALE)
        .setRotation(s.angle)
        .setEnabled(false)
    );
    const hubCol = ctx.world.createCollider(
      RAPIER.ColliderDesc.ball(12 * INV_SCALE).setRestitution(0.55).setFriction(0.2),
      sBody
    );
    ctx.colliderMeta.set(hubCol.handle, { kind: 'spinner' });

    for (let a = 0; a < s.arms; a++) {
      const ang = (a * 2 * Math.PI) / s.arms;
      const ax = Math.cos(ang) * (s.r / 2) * INV_SCALE;
      const ay = Math.sin(ang) * (s.r / 2) * INV_SCALE;
      const armCol = ctx.world.createCollider(
        RAPIER.ColliderDesc.cuboid((s.r / 2) * INV_SCALE, 5 * INV_SCALE)
          .setTranslation(ax, ay)
          .setRotation(ang)
          .setRestitution(0.6)
          .setFriction(0.2)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        sBody
      );
      ctx.colliderMeta.set(armCol.handle, { kind: 'spinner' });
    }

    spinnersForRoom.push(sBody);
    bodiesForRoom.push(sBody);
  }

  for (let i = 0; i < chunk.pistons.length; i++) {
    const p = chunk.pistons[i];
    const pBody = ctx.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation((p.x + p.w / 2) * INV_SCALE, (p.y + p.h / 2) * INV_SCALE)
        .setEnabled(false)
    );
    const pCol = ctx.world.createCollider(
      RAPIER.ColliderDesc.cuboid((p.w / 2) * INV_SCALE, (p.h / 2) * INV_SCALE)
        .setRestitution(0.85)
        .setFriction(0.2)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      pBody
    );
    ctx.colliderMeta.set(pCol.handle, { kind: 'piston' });
    ctx.pistonBodies.set(p.id, pBody);
    bodiesForRoom.push(pBody);
  }

  for (let i = 0; i < chunk.pendulums.length; i++) {
    const pend = chunk.pendulums[i];
    const bobBody = ctx.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(pend.pivotX * INV_SCALE, (pend.pivotY + pend.length) * INV_SCALE)
        .setEnabled(false)
    );
    const bobCol = ctx.world.createCollider(
      RAPIER.ColliderDesc.ball(pend.bobRadius * INV_SCALE)
        .setRestitution(0.88)
        .setFriction(0.15)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      bobBody
    );
    ctx.colliderMeta.set(bobCol.handle, { kind: 'pendulum' });
    ctx.pendulumBodies.set(pend.id, bobBody);
    bodiesForRoom.push(bobBody);
  }

  ctx.spinnerBodies.set(chunk.id, spinnersForRoom);
  ctx.chunkBodies.push(bodiesForRoom);
}

export function createMarbleBody(ctx: PhysicsContext, m: Marble): RAPIER.RigidBody | null {
  if (!ctx.world) return null;

  const initVx = (m.vx || 0) * (60 * INV_SCALE);
  const initVy = (m.vy || 0) * (60 * INV_SCALE);

  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(m.x * INV_SCALE, m.y * INV_SCALE)
    .setLinvel(initVx, initVy)
    .setCcdEnabled(true)
    .setLinearDamping(0.24)
    .setAngularDamping(0.38)
    .setCanSleep(false);

  const body = ctx.world.createRigidBody(bodyDesc);
  const colliderDesc = RAPIER.ColliderDesc.ball((m.radius || 12.5) * INV_SCALE)
    .setMass(m.mass || 1.0)
    .setFriction(0.34)
    .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average)
    .setRestitution(Math.min(0.88, m.restitution ?? 0.48))
    .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

  const collider = ctx.world.createCollider(colliderDesc, body);
  ctx.marbleBodies.set(m.id, body);
  ctx.colliderMeta.set(collider.handle, { kind: 'marble', marbleId: m.id });
  return body;
}

export function removeMarbleBody(ctx: PhysicsContext, marbleId: string): void {
  const body = ctx.marbleBodies.get(marbleId);
  if (!body || !ctx.world) return;
  for (let ci = 0; ci < body.numColliders(); ci++) {
    ctx.colliderMeta.delete(body.collider(ci).handle);
  }
  ctx.world.removeRigidBody(body);
  ctx.marbleBodies.delete(marbleId);
}

export function spawnNpcZombie(
  ctx: PhysicsContext,
  x: number,
  y: number,
  zombieType: ZombieType,
  roomId: number
): void {
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
  ctx.lastMarbles.push(zm);
  createMarbleBody(ctx, zm);
}
