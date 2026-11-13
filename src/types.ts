export type WeaponType = 'blaster' | 'shotgun' | 'rifle' | 'spread' | 'rapid' | 'bat' | 'sword';
export type ZombieType = 'walker' | 'runner' | 'tank' | 'boss';

export interface MarbleColorDef {
  id: string;
  name: string;
  color: string;
  border?: string;
  mass?: number;
  restitution?: number;
  materialType?: 'glass' | 'dense' | 'bouncy' | 'crystal' | 'polymer';
}

export interface Marble {
  id: string;
  name: string;
  color: string;
  border?: string;
  mass: number;
  restitution: number;
  materialType?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  omega: number;
  prevX?: number;
  prevY?: number;
  prevAngle?: number;
  renderX?: number;
  renderY?: number;
  renderAngle?: number;
  radius: number;
  rank: number;
  finished: boolean;
  finishTime: number | null;
  finishPosition: number | null;
  currentCheckpointIdx: number;
  progressScore: number;
  history: Array<{ x: number; y: number }>;
  stuckFrames?: number;
  lastX?: number;
  lastY?: number;
  checkpointStallFrames?: number;
  lastCheckpointIdx?: number;
  isZombie?: boolean;
  isAlphaZombie?: boolean;
  zombieType?: ZombieType;
  zhp?: number;
  maxZhp?: number;
  zSpeedMult?: number;
  zForceMult?: number;
  hp: number;
  maxHp: number;
  shield: number;
  infectionTime?: number | null;
  infectedRoomName?: string;
  kills?: number;
  turboTime?: number;
  boostUntil?: number;
  shieldUntil?: number;
  hitCooldownUntil?: number;
  tpCooldownUntil?: number;
  turnCooldownUntil?: number;
  healedZones?: Record<string, boolean>;
  gone?: boolean;
  isExtracted?: boolean;
  weaponCooldown?: number;
  weaponType?: WeaponType;
  weaponUpgradeTimer?: number;
  aimAngle?: number;
  currentRoomId?: number;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  x1?: number;
  y1?: number;
  vx: number;
  vy: number;
  ownerId: string;
  lifetime: number;
  maxLifetime: number;
  color: string;
  damage?: number;
  knockback?: number;
  isMelee?: boolean;
}

export interface CombatParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  lifetime: number;
  maxLifetime: number;
  radius?: number;
  type?: 'spark' | 'slime' | 'plasma' | 'shockwave';
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  lifetime: number;
  maxLifetime: number;
  size?: number;
}

export interface TemporaryBarricade {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lifetime: number;
  maxLifetime: number;
}

export interface CombatEvent {
  id: string;
  text: string;
  color: string;
  time: number;
  icon?: string;
  message?: string;
}

export interface HighlightEvent {
  t: number;
  marbleId: string;
  text: string;
  color: string;
  weight: number;
  kind: 'win' | 'kill' | 'inf';
}

export interface ReplayMarbleSnap {
  id: string;
  x: number;
  y: number;
  angle: number;
  isZombie?: boolean;
  zombieType?: ZombieType;
  hp: number;
  zhp?: number;
  maxZhp?: number;
  finished: boolean;
  isExtracted?: boolean;
  gone?: boolean;
  shield: number;
  weaponType?: WeaponType;
  radius: number;
}

export interface ReplayFrame {
  t: number;
  marbles: ReplayMarbleSnap[];
}

export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  bounce?: number;
  friction?: number;
  color?: string;
  glow?: string;
  thickness?: number;
  kind?: 'rail' | 'neon' | 'guide' | 'barrier';
}

export interface Bumper {
  x: number;
  y: number;
  r: number;
  color: string;
  bounce?: number;
}

export interface Spinner {
  x: number;
  y: number;
  r: number;
  arms: number;
  angle: number;
  speed: number;
  color?: string;
}

export interface Elevator {
  x: number;
  y: number;
  w: number;
  h: number;
  liftSpeed: number;
}

export interface Booster {
  x: number;
  y: number;
  w: number;
  h: number;
  forceX: number;
  forceY: number;
}

export interface EscalatorStep {
  x: number;
  y: number;
  w: number;
  h: number;
  boostX: number;
  boostY: number;
}

export interface Piston {
  id: string;
  chunkId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
  period: number;
  dutyCycle?: number;
  phase: number;
  color?: string;
}

export interface Pendulum {
  id: string;
  chunkId: number;
  pivotX: number;
  pivotY: number;
  length: number;
  bobRadius: number;
  maxAngle: number;
  period: number;
  phase: number;
  color?: string;
}

export interface WindZone {
  id: string;
  chunkId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  forceX: number;
  forceY: number;
  gustPeriod?: number;
  color?: string;
}

export interface SlowZone {
  id: string;
  chunkId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  drag: number; // e.g., 0.08 removes 8% velocity per tick
  color?: string;
}

export interface MagnetZone {
  id: string;
  chunkId: number;
  x: number;
  y: number;
  r: number;
  force: number; // >0 pulls in, <0 repels out
  color?: string;
}

export interface PortalZone {
  id: string;
  chunkId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  tx: number;
  ty: number;
  color?: string;
}

export interface SpikeZone {
  id: string;
  chunkId: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface KickerZone {
  id: string;
  chunkId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  ix: number;
  iy: number;
  period: number;
  phase: number;
  lastStep?: number;
  flashUntil?: number;
}

export interface HealZone {
  id: string;
  chunkId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  amount: number;
}

export interface CryptZone {
  id: string;
  chunkId: number;
  x: number;
  y: number;
  w: number;
  h: number;
  spawnX: number;
  spawnY: number;
  count: number;
  triggered: boolean;
}

export interface ZombieSpawnDef {
  id: string;
  x: number;
  y: number;
  chunkId: number;
  zombieType: ZombieType;
}

export interface PickupCrate {
  id: string;
  chunkId: number;
  x: number;
  y: number;
  type: 'emp' | 'turbo' | 'shield' | 'spread' | 'rapid' | 'repair' | 'shotgun' | 'rifle' | 'sword' | 'bat' | 'weapon_swap';
  active: boolean;
  respawnTimer: number;
}

export interface Checkpoint {
  x: number;
  y: number;
  idx: number;
  name?: string;
  isFinish?: boolean;
}

export interface StageAnnouncement {
  name: string;
  chkIdx: number;
  x: number;
  y: number;
  themeColor?: string;
  subtitle?: string;
}

export interface PathVerificationReport {
  isValid: boolean;
  totalCheckpoints: number;
  visitedCheckpoints: number;
  unpoweredAscents: number;
  finishReached: boolean;
  message: string;
}

export interface RoomDoors {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}

export interface TrackChunk {
  id: number;
  name: string;
  col: number;
  row: number;
  x: number;
  y: number;
  size: number;
  doors?: RoomDoors;
  isDeadEnd?: boolean;
  isStart?: boolean;
  isFinish?: boolean;
  distToFinish?: number;
  nextRoomId?: number | null;
  nextDir?: 'n' | 'e' | 's' | 'w' | null;
  themeColor?: string;
  walls: Wall[];
  bumpers: Bumper[];
  spinners: Spinner[];
  elevators: Elevator[];
  boosters: Booster[];
  escalators: EscalatorStep[];
  pistons: Piston[];
  pendulums: Pendulum[];
  windZones: WindZone[];
  slowZones?: SlowZone[];
  magnetZones?: MagnetZone[];
  portals?: PortalZone[];
  spikeZones?: SpikeZone[];
  kickerZones?: KickerZone[];
  healZones?: HealZone[];
  cryptZones?: CryptZone[];
  crates: PickupCrate[];
  checkpoints: Checkpoint[];
  stages?: StageAnnouncement[];
  spatialGrid?: unknown;
}

export interface CourseData {
  seed?: string;
  chunks: TrackChunk[];
  walls: Wall[];
  bumpers: Bumper[];
  spinners: Spinner[];
  elevators: Elevator[];
  boosters: Booster[];
  escalators: EscalatorStep[];
  pistons: Piston[];
  pendulums: Pendulum[];
  windZones: WindZone[];
  slowZones: SlowZone[];
  magnetZones: MagnetZone[];
  portals: PortalZone[];
  spikeZones: SpikeZone[];
  kickerZones: KickerZone[];
  healZones: HealZone[];
  cryptZones: CryptZone[];
  roomZombies: ZombieSpawnDef[];
  crates: PickupCrate[];
  checkpoints: Checkpoint[];
  stages: StageAnnouncement[];
  startX: number;
  startY: number;
  finishX: number;
  finishY: number;
  totalCheckpoints: number;
  maxDistToFinish?: number;
  isPathVerified?: boolean;
  verificationReport?: PathVerificationReport;
  spatialGrid?: unknown;
}
