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
  ZombieType,
  FocusTrigger,
} from '../types';

// Rapier2D world unit scale: 50 pixels = 1 meter for optimal solver stability & realistic rolling inertia
export const SCALE = 50;
export const INV_SCALE = 1 / SCALE;

export type ColliderMeta =
  | { kind: 'marble'; marbleId: string }
  | { kind: 'bumper'; x: number; y: number; bounce: number }
  | { kind: 'wall' }
  | { kind: 'spinner' }
  | { kind: 'piston' }
  | { kind: 'pendulum' }
  | { kind: 'barricade' };

export interface PendingZombieSpawn {
  x: number;
  y: number;
  zombieType: ZombieType;
  roomId: number;
}

export interface PhysicsContext {
  world: RAPIER.World | null;
  eventQueue: RAPIER.EventQueue | null;
  chunkBodies: RAPIER.RigidBody[][];
  spinnerBodies: Map<number, RAPIER.RigidBody[]>;
  pistonBodies: Map<string, RAPIER.RigidBody>;
  pendulumBodies: Map<string, RAPIER.RigidBody>;
  marbleBodies: Map<string, RAPIER.RigidBody>;
  barricadeBodies: Map<string, RAPIER.RigidBody>;
  colliderMeta: Map<number, ColliderMeta>;

  activeChunkIndices: number[];
  projectiles: Projectile[];
  particles: CombatParticle[];
  floatingTexts: FloatingText[];
  barricades: TemporaryBarricade[];
  combatFeed: CombatEvent[];
  highlightEvents: HighlightEvent[];
  replayFrames: ReplayFrame[];
  pendingFocus: FocusTrigger | null;
  pendingDamageFlash: boolean;
  followedMarbleId: string | null;
  roomDamageCounts: Record<number, number>;

  currentCourse: CourseData | null;
  lastMarbles: Marble[];
  lastRaceTime: number;
  simTickCounter: number;
  firstFinisherRecorded: boolean;
  pendingZombieSpawns: PendingZombieSpawn[];

  addParticles(x: number, y: number, color: string, count?: number, speed?: number, type?: CombatParticle['type']): void;
  addFloatingText(x: number, y: number, text: string, color: string): void;
  addCombatEvent(text: string, color: string): void;
}
