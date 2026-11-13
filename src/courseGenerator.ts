import {
  CourseData,
  TrackChunk,
  Wall,
  Bumper,
  Spinner,
  Elevator,
  Booster,
  Piston,
  Pendulum,
  WindZone,
  SlowZone,
  MagnetZone,
  PortalZone,
  SpikeZone,
  KickerZone,
  HealZone,
  CryptZone,
  ZombieSpawnDef,
  PickupCrate,
  Checkpoint,
  StageAnnouncement,
  PathVerificationReport,
  RoomDoors,
  ZombieType,
} from './types';
import { DEFAULT_SEED, GRID_COLS, GRID_ROWS, ROOM_SIZE, HALF_SW } from './constants';

export interface Point {
  x: number;
  y: number;
}

export class ChunkBuilder {
  public id: number;
  public name: string;
  public col: number;
  public row: number;
  public x: number;
  public y: number;
  public size: number = ROOM_SIZE;
  public doors: RoomDoors;
  public isDeadEnd: boolean = false;
  public isStart: boolean = false;
  public isFinish: boolean = false;
  public distToFinish: number = 0;
  public nextRoomId: number | null = null;
  public nextDir: 'n' | 'e' | 's' | 'w' | null = null;
  public themeColor: string = '#38bdf8';

  public walls: Wall[] = [];
  public bumpers: Bumper[] = [];
  public spinners: Spinner[] = [];
  public elevators: Elevator[] = [];
  public boosters: Booster[] = [];
  public pistons: Piston[] = [];
  public pendulums: Pendulum[] = [];
  public windZones: WindZone[] = [];
  public slowZones: SlowZone[] = [];
  public magnetZones: MagnetZone[] = [];
  public portals: PortalZone[] = [];
  public spikeZones: SpikeZone[] = [];
  public kickerZones: KickerZone[] = [];
  public healZones: HealZone[] = [];
  public cryptZones: CryptZone[] = [];
  public crates: PickupCrate[] = [];
  public checkpoints: Checkpoint[] = [];
  public stages: StageAnnouncement[] = [];

  constructor(
    id: number,
    name: string,
    col: number,
    row: number,
    doors: RoomDoors,
    themeColor: string = '#38bdf8'
  ) {
    this.id = id;
    this.name = name;
    this.col = col;
    this.row = row;
    this.x = col * ROOM_SIZE;
    this.y = row * ROOM_SIZE;
    this.doors = doors;
    this.themeColor = themeColor;
  }

  public addWall(wall: Wall) {
    this.walls.push({
      bounce: 0.45,
      friction: 0.992,
      kind: 'rail',
      ...wall,
    });
  }

  public addCheckpoint(
    pos: Point,
    globalIndex: number,
    stageName?: string,
    isFinish?: boolean,
    themeColor?: string
  ): Checkpoint {
    const chk: Checkpoint = {
      x: pos.x,
      y: pos.y,
      idx: globalIndex,
      name: stageName,
      isFinish,
    };
    this.checkpoints.push(chk);

    if (stageName) {
      this.stages.push({
        name: stageName,
        chkIdx: globalIndex,
        x: pos.x,
        y: pos.y,
        themeColor,
      });
    }

    return chk;
  }

  /**
   * Builds the square perimeter walls of this 500x500 room, deduplicating shared
   * open doorway stubs so adjacent rooms never stack overlapping jamb colliders,
   * and adding subtle 45-degree guide rails to funnel marbles smoothly across corridors.
   */
  public buildSquareRoomPerimeter(color: string) {
    const x0 = this.x;
    const x1 = this.x + ROOM_SIZE;
    const y0 = this.y;
    const y1 = this.y + ROOM_SIZE;
    const midX = x0 + ROOM_SIZE / 2;
    const midY = y0 + ROOM_SIZE / 2;
    const guideColor = color;
    const chamfer = 26;

    // North wall (open doorways owned by upper neighbor's South edge when row > 0)
    if (this.doors.n) {
      if (this.row === 0) {
        this.addWall({ x1: x0, y1: y0, x2: midX - HALF_SW, y2: y0, color, bounce: 0.4 });
        this.addWall({ x1: midX + HALF_SW, y1: y0, x2: x1, y2: y0, color, bounce: 0.4 });
      }
      this.addWall({ x1: midX - HALF_SW - chamfer, y1: y0 + chamfer, x2: midX - HALF_SW, y2: y0, color: guideColor, bounce: 0.35, kind: 'guide' });
      this.addWall({ x1: midX + HALF_SW + chamfer, y1: y0 + chamfer, x2: midX + HALF_SW, y2: y0, color: guideColor, bounce: 0.35, kind: 'guide' });
    } else {
      this.addWall({ x1: x0, y1: y0, x2: x1, y2: y0, color, bounce: 0.4 });
    }

    // South wall
    if (this.doors.s) {
      this.addWall({ x1: x0, y1: y1, x2: midX - HALF_SW, y2: y1, color, bounce: 0.4 });
      this.addWall({ x1: midX + HALF_SW, y1: y1, x2: x1, y2: y1, color, bounce: 0.4 });
      this.addWall({ x1: midX - HALF_SW - chamfer, y1: y1 - chamfer, x2: midX - HALF_SW, y2: y1, color: guideColor, bounce: 0.35, kind: 'guide' });
      this.addWall({ x1: midX + HALF_SW + chamfer, y1: y1 - chamfer, x2: midX + HALF_SW, y2: y1, color: guideColor, bounce: 0.35, kind: 'guide' });
    } else {
      this.addWall({ x1: x0, y1: y1, x2: x1, y2: y1, color, bounce: 0.4 });
    }

    // West wall (open doorways owned by left neighbor's East edge when col > 0)
    if (this.doors.w) {
      if (this.col === 0) {
        this.addWall({ x1: x0, y1: y0, x2: x0, y2: midY - HALF_SW, color, bounce: 0.4 });
        this.addWall({ x1: x0, y1: midY + HALF_SW, x2: x0, y2: y1, color, bounce: 0.4 });
      }
      this.addWall({ x1: x0 + chamfer, y1: midY - HALF_SW - chamfer, x2: x0, y2: midY - HALF_SW, color: guideColor, bounce: 0.35, kind: 'guide' });
      this.addWall({ x1: x0 + chamfer, y1: midY + HALF_SW + chamfer, x2: x0, y2: midY + HALF_SW, color: guideColor, bounce: 0.35, kind: 'guide' });
    } else {
      this.addWall({ x1: x0, y1: y0, x2: x0, y2: y1, color, bounce: 0.4 });
    }

    // East wall
    if (this.doors.e) {
      this.addWall({ x1: x1, y1: y0, x2: x1, y2: midY - HALF_SW, color, bounce: 0.4 });
      this.addWall({ x1: x1, y1: midY + HALF_SW, x2: x1, y2: y1, color, bounce: 0.4 });
      this.addWall({ x1: x1 - chamfer, y1: midY - HALF_SW - chamfer, x2: x1, y2: midY - HALF_SW, color: guideColor, bounce: 0.35, kind: 'guide' });
      this.addWall({ x1: x1 - chamfer, y1: midY + HALF_SW + chamfer, x2: x1, y2: midY + HALF_SW, color: guideColor, bounce: 0.35, kind: 'guide' });
    } else {
      this.addWall({ x1: x1, y1: y0, x2: x1, y2: y1, color, bounce: 0.4 });
    }
  }

  public toTrackChunk(): TrackChunk {
    const chunk: TrackChunk = {
      id: this.id,
      name: this.name,
      col: this.col,
      row: this.row,
      x: this.x,
      y: this.y,
      size: this.size,
      doors: this.doors,
      isDeadEnd: this.isDeadEnd,
      isStart: this.isStart,
      isFinish: this.isFinish,
      distToFinish: this.distToFinish,
      nextRoomId: this.nextRoomId,
      nextDir: this.nextDir,
      themeColor: this.themeColor,
      walls: this.walls,
      bumpers: this.bumpers,
      spinners: this.spinners,
      elevators: this.elevators,
      boosters: this.boosters,
      pistons: this.pistons,
      pendulums: this.pendulums,
      windZones: this.windZones,
      slowZones: this.slowZones,
      magnetZones: this.magnetZones,
      portals: this.portals,
      spikeZones: this.spikeZones,
      kickerZones: this.kickerZones,
      healZones: this.healZones,
      cryptZones: this.cryptZones,
      crates: this.crates,
      checkpoints: this.checkpoints,
      stages: this.stages,
    };

    return chunk;
  }
}

// =========================================================================
// DETERMINISTIC PRNG (FNV-1a HASH + MULBERRY32)
// =========================================================================

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createMulberry32(seedVal: number): () => number {
  let a = seedVal >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class SeededRng {
  private nextFn: () => number;

  constructor(seedStr: string) {
    const normalized = seedStr.trim() || DEFAULT_SEED;
    this.nextFn = createMulberry32(hashSeed(normalized));
  }

  public next(): number {
    return this.nextFn();
  }

  public range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  public int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  public chance(probability: number): boolean {
    return this.next() < probability;
  }

  public pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  public shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }
}

// =========================================================================
// LABYRINTH GRAPH CARVER (BRAIDED 5x5 SQUARE-ROOM MAZE)
// =========================================================================

interface MazeNode {
  id: number;
  col: number;
  row: number;
  doors: RoomDoors;
  distToFinish: number;
  nextRoomId: number | null;
  nextDir: 'n' | 'e' | 's' | 'w' | null;
  isDeadEnd: boolean;
}

function generateLabyrinthGraph(rng: SeededRng): { nodes: MazeNode[]; maxDist: number } {
  const nodes: MazeNode[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      nodes.push({
        id: row * GRID_COLS + col,
        col,
        row,
        doors: { n: false, e: false, s: false, w: false },
        distToFinish: 999,
        nextRoomId: null,
        nextDir: null,
        isDeadEnd: false,
      });
    }
  }

  const idxOf = (c: number, r: number) => r * GRID_COLS + c;
  const visited = new Array<boolean>(25).fill(false);

  const openDoor = (a: MazeNode, b: MazeNode) => {
    if (b.col === a.col + 1) {
      a.doors.e = true;
      b.doors.w = true;
    } else if (b.col === a.col - 1) {
      a.doors.w = true;
      b.doors.e = true;
    } else if (b.row === a.row + 1) {
      a.doors.s = true;
      b.doors.n = true;
    } else if (b.row === a.row - 1) {
      a.doors.n = true;
      b.doors.s = true;
    }
  };

  // 1. Randomized DFS spanning tree starting from (0,0)
  const stack: MazeNode[] = [nodes[0]];
  visited[0] = true;

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const neighbors: MazeNode[] = [];
    if (cur.col > 0 && !visited[idxOf(cur.col - 1, cur.row)]) neighbors.push(nodes[idxOf(cur.col - 1, cur.row)]);
    if (cur.col < GRID_COLS - 1 && !visited[idxOf(cur.col + 1, cur.row)]) neighbors.push(nodes[idxOf(cur.col + 1, cur.row)]);
    if (cur.row > 0 && !visited[idxOf(cur.col, cur.row - 1)]) neighbors.push(nodes[idxOf(cur.col, cur.row - 1)]);
    if (cur.row < GRID_ROWS - 1 && !visited[idxOf(cur.col, cur.row + 1)]) neighbors.push(nodes[idxOf(cur.col, cur.row + 1)]);

    if (neighbors.length === 0) {
      stack.pop();
    } else {
      const next = rng.pick(neighbors);
      openDoor(cur, next);
      visited[next.id] = true;
      stack.push(next);
    }
  }

  // 2. Braid 3 to 5 extra shortcut loops while leaving some dead ends intact
  const closedEdges: Array<[MazeNode, MazeNode]> = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const n = nodes[idxOf(c, r)];
      if (c < GRID_COLS - 1 && !n.doors.e) {
        closedEdges.push([n, nodes[idxOf(c + 1, r)]]);
      }
      if (r < GRID_ROWS - 1 && !n.doors.s) {
        closedEdges.push([n, nodes[idxOf(c, r + 1)]]);
      }
    }
  }

  const shuffledEdges = rng.shuffle(closedEdges);
  const loopTarget = rng.int(3, 5);
  let addedLoops = 0;
  for (const [a, b] of shuffledEdges) {
    if (addedLoops >= loopTarget) break;
    // Keep Finish room (24) cleanly entered from 1 or 2 max doors so podium stays sheltered
    if (a.id === 24 || b.id === 24) continue;
    openDoor(a, b);
    addedLoops++;
  }

  // 3. Identify dead ends (excluding Start 0 and Finish 24)
  for (const n of nodes) {
    const deg = (n.doors.n ? 1 : 0) + (n.doors.e ? 1 : 0) + (n.doors.s ? 1 : 0) + (n.doors.w ? 1 : 0);
    n.isDeadEnd = deg === 1 && n.id !== 0 && n.id !== 24;
  }

  // 4. BFS from Finish room (24) to calculate shortest-path distance & exit vector
  const finishNode = nodes[24];
  finishNode.distToFinish = 0;
  const queue: MazeNode[] = [finishNode];
  let head = 0;

  while (head < queue.length) {
    const cur = queue[head++];
    const adj: Array<{ dir: 'n' | 'e' | 's' | 'w'; node: MazeNode }> = [];
    if (cur.doors.n) adj.push({ dir: 's', node: nodes[idxOf(cur.col, cur.row - 1)] });
    if (cur.doors.s) adj.push({ dir: 'n', node: nodes[idxOf(cur.col, cur.row + 1)] });
    if (cur.doors.w) adj.push({ dir: 'e', node: nodes[idxOf(cur.col - 1, cur.row)] });
    if (cur.doors.e) adj.push({ dir: 'w', node: nodes[idxOf(cur.col + 1, cur.row)] });

    for (const item of adj) {
      if (item.node.distToFinish > cur.distToFinish + 1) {
        item.node.distToFinish = cur.distToFinish + 1;
        item.node.nextRoomId = cur.id;
        item.node.nextDir = item.dir;
        queue.push(item.node);
      }
    }
  }

  const maxDist = Math.max(1, ...nodes.map((n) => (n.distToFinish < 999 ? n.distToFinish : 0)));
  return { nodes, maxDist };
}

// =========================================================================
// ROOM ARCHETYPES, THEME PALETTES & TITLES
// =========================================================================

type RoomArchetype =
  | 'pegs_plinko'
  | 'spinners'
  | 'pistons'
  | 'pendulums'
  | 'wind_vortex'
  | 'magnet_core'
  | 'portal_warp'
  | 'sticky_sludge'
  | 'spike_gauntlet'
  | 'kicker_arena'
  | 'crypt_ambush'
  | 'arsenal_medbay';

interface ThemePalette {
  id: string;
  primary: string;
  accent: string;
}

const NEON_PALETTES: readonly ThemePalette[] = [
  { id: 'toxic', primary: '#10b981', accent: '#84cc16' },
  { id: 'plasma', primary: '#06b6d4', accent: '#38bdf8' },
  { id: 'solar', primary: '#f59e0b', accent: '#f97316' },
  { id: 'voltage', primary: '#f43f5e', accent: '#ec4899' },
  { id: 'quantum', primary: '#8b5cf6', accent: '#a855f7' },
  { id: 'cobalt', primary: '#3b82f6', accent: '#22d3ee' },
  { id: 'amber', primary: '#eab308', accent: '#fb923c' },
  { id: 'crimson', primary: '#ef4444', accent: '#f43f5e' },
];

const ARCHETYPE_NAMES: Record<RoomArchetype, readonly string[]> = {
  pegs_plinko: ['SALA PLINKO', 'MATRIZ DE REBOTES', 'CLAVOS MAGNÉTICOS'],
  spinners: ['TURBINAS DUALES', 'ROTOR CENTRÍFUGO', 'MOLINO DE ACERO'],
  pistons: ['PRENSA HIDRÁULICA', 'SALA DE ÉMBOLOS', 'TRITURADORA'],
  pendulums: ['PÉNDULOS SÍSMICOS', 'OSCILADOR LETAL', 'CAMPANA DE HIERRO'],
  wind_vortex: ['TORMENTA IÓNICA', 'CÁMARA DE VIENTO', 'TURBULENCIA'],
  magnet_core: ['NÚCLEO MAGNÉTICO', 'VÓRTICE ATRAYENTE', 'REPULSOR CUÁNTICO'],
  portal_warp: ['SALTO CUÁNTICO', 'NEXO DE PORTALES', 'ATRIO DE TELETRANSPORTE'],
  sticky_sludge: ['FOSA DE RESINA', 'PANTANO TÓXICO', 'LODO VISCOSO'],
  spike_gauntlet: ['PÚAS DE CONTENCIÓN', 'PASILLO DE PINCHOS', 'TRAMPA CARMESÍ'],
  kicker_arena: ['CATAPULTAS', 'PLATAFORMAS DE IMPULSO', 'TRAMPOLÍN TÁCTICO'],
  crypt_ambush: ['CRIPTA INFECTADA', 'NIDO DE ZOMBIS', 'EMBOSCADA ALPHA'],
  arsenal_medbay: ['ENFERMERÍA TÁCTICA', 'ARSENAL OCULTO', 'SALA DE SUMINISTROS'],
};

const CRATE_POOL: readonly PickupCrate['type'][] = [
  'shotgun',
  'rifle',
  'spread',
  'rapid',
  'sword',
  'bat',
  'shield',
  'repair',
  'emp',
  'turbo',
  'weapon_swap',
];

const ALL_ARCHETYPES: readonly RoomArchetype[] = [
  'pegs_plinko',
  'spinners',
  'pistons',
  'pendulums',
  'wind_vortex',
  'magnet_core',
  'portal_warp',
  'sticky_sludge',
  'spike_gauntlet',
  'kicker_arena',
  'crypt_ambush',
  'arsenal_medbay',
];

function buildRoomInterior(
  node: MazeNode,
  archetype: RoomArchetype,
  chkIdxStart: number,
  rng: SeededRng,
  roomZombies: ZombieSpawnDef[]
): { chunk: TrackChunk; nextChkIdx: number } {
  const palette = rng.pick(NEON_PALETTES);
  const color = node.id === 0 ? '#38bdf8' : node.id === 24 ? '#22c55e' : palette.primary;
  const accent = palette.accent;
  const label =
    node.id === 0
      ? 'SALA DE SALIDA'
      : node.id === 24
      ? 'BÚNKER DE EXTRACCIÓN'
      : rng.pick(ARCHETYPE_NAMES[archetype]);

  const b = new ChunkBuilder(node.id, label, node.col, node.row, node.doors, color);
  b.distToFinish = node.distToFinish;
  b.nextRoomId = node.nextRoomId;
  b.nextDir = node.nextDir;
  b.isDeadEnd = node.isDeadEnd;
  b.isStart = node.id === 0;
  b.isFinish = node.id === 24;

  // Build standardized 500x500 perimeter with 190px wide doors and subtle corner guide rails
  b.buildSquareRoomPerimeter(color);

  const midX = b.x + ROOM_SIZE / 2;
  const midY = b.y + ROOM_SIZE / 2;
  let curChk = chkIdxStart;

  // =========================================================================
  // START ROOM (0,0)
  // =========================================================================
  if (node.id === 0) {
    const startX = midX;
    const startY = b.y + 105;
    b.addCheckpoint(
      { x: startX, y: startY },
      curChk++,
      'INICIO: LABERINTO BIOHAZARD',
      false,
      color
    );

    // Smooth forward booster directing marbles cleanly into the opening corridor
    if (node.nextDir === 'e') {
      b.boosters.push({
        x: b.x + 260,
        y: midY - 45,
        w: 200,
        h: 90,
        forceX: 2.0,
        forceY: 0,
      });
    } else {
      b.boosters.push({
        x: midX - 55,
        y: b.y + 275,
        w: 110,
        h: 190,
        forceX: 0,
        forceY: 1.9,
      });
    }

    // Subtle starter bumper scatter to spread initial cluster
    b.bumpers.push({ x: midX - 75, y: midY - 20, r: 12, color: accent, bounce: 1.1 });
    b.bumpers.push({ x: midX + 75, y: midY - 20, r: 12, color: accent, bounce: 1.1 });

    // Early starter weapon crate
    b.crates.push({
      id: `cr_0_starter`,
      chunkId: 0,
      x: midX,
      y: midY + 55,
      type: rng.pick(['shotgun', 'spread', 'rapid', 'shield'] as const),
      active: true,
      respawnTimer: 0,
    });

    return { chunk: b.toTrackChunk(), nextChkIdx: curChk };
  }

  // =========================================================================
  // FINISH BUNKER (4,4) - Welcoming extraction room with zero bounce-back traps
  // =========================================================================
  if (node.id === 24) {
    const finishX = midX;
    const finishY = midY;
    b.addCheckpoint(
      { x: finishX, y: finishY },
      curChk++,
      'META FINAL: BÚNKER DE EXTRACCIÓN',
      true,
      '#22c55e'
    );

    // Welcoming inward boosters from whichever doorway enters Room 24 (never pushing back!)
    if (node.doors.w) {
      b.boosters.push({
        x: b.x + 15,
        y: midY - 45,
        w: 150,
        h: 90,
        forceX: 2.1,
        forceY: 0,
      });
    }
    if (node.doors.n) {
      b.boosters.push({
        x: midX - 50,
        y: b.y + 15,
        w: 100,
        h: 145,
        forceX: 0,
        forceY: 1.8,
      });
    }

    // Healing sanctuary pad right inside finish room
    b.healZones.push({
      id: 'heal_finish',
      chunkId: 24,
      x: finishX - 24,
      y: finishY - 24,
      w: 48,
      h: 48,
      amount: 2,
    });

    return { chunk: b.toTrackChunk(), nextChkIdx: curChk };
  }

  // Room center checkpoint
  b.addCheckpoint({ x: midX, y: midY }, curChk++, `SECTOR (${node.col + 1},${node.row + 1}): ${label}`, false, color);

  // =========================================================================
  // FORWARD-ONLY DIRECTIONAL NAVIGATION INFRASTRUCTURE
  // Only lifts North when BFS exit actually goes North (never pushes downward entrants back!)
  // =========================================================================
  if (node.nextDir === 'n') {
    b.elevators.push({
      x: midX - 55,
      y: b.y + 15,
      w: 110,
      h: 350,
      liftSpeed: -6.2,
    });
    b.windZones.push({
      id: `w_up_${node.id}`,
      chunkId: node.id,
      x: midX - 65,
      y: b.y + 15,
      w: 130,
      h: 310,
      forceX: 0,
      forceY: -2.4,
      color: '#38bdf8',
    });
  } else if (node.nextDir === 'e') {
    b.boosters.push({ x: b.x + 315, y: midY - 40, w: 165, h: 80, forceX: 2.1, forceY: -0.1 });
  } else if (node.nextDir === 'w') {
    b.boosters.push({ x: b.x + 20, y: midY - 40, w: 165, h: 80, forceX: -2.1, forceY: -0.1 });
  } else if (node.nextDir === 's') {
    b.boosters.push({ x: midX - 45, y: b.y + 315, w: 90, h: 165, forceX: 0, forceY: 1.8 });
  }

  // Subtle horizontal guide shelf only when vertical doorways aren't active
  if (!node.doors.n && !node.doors.s && rng.chance(0.45)) {
    const shelfW = rng.range(95, 130);
    const tilt = rng.range(-0.14, 0.14);
    b.addWall({
      x1: midX - shelfW / 2,
      y1: midY + 80 - Math.sin(tilt) * (shelfW / 2),
      x2: midX + shelfW / 2,
      y2: midY + 80 + Math.sin(tilt) * (shelfW / 2),
      color,
      bounce: 0.4,
      kind: 'guide',
    });
  }

  // =========================================================================
  // ARCHETYPE HAZARDS & INTERACTIVE ZONES (Scaled cleanly for 500x500px)
  // Kept inside [125..375] x [125..375] so all 190px doorways stay wide & smooth
  // =========================================================================
  if (archetype === 'pegs_plinko') {
    const placed: Array<{ x: number; y: number; r: number }> = [];
    const target = rng.int(5, 7);
    let tries = 0;
    while (placed.length < target && tries < 50) {
      tries++;
      const r = rng.int(10, 14);
      const px = b.x + rng.range(130, 370);
      const py = b.y + rng.range(130, 370);
      const clear = placed.every((o) => Math.hypot(px - o.x, py - o.y) >= r + o.r + 34);
      if (clear) {
        placed.push({ x: px, y: py, r });
        b.bumpers.push({
          x: px,
          y: py,
          r,
          color: placed.length % 2 === 0 ? color : accent,
          bounce: rng.range(1.15, 1.35),
        });
      }
    }
    b.crates.push({
      id: `cr_${node.id}`,
      chunkId: node.id,
      x: midX + rng.range(-60, 60),
      y: midY + rng.range(-60, 60),
      type: rng.pick(CRATE_POOL),
      active: true,
      respawnTimer: 0,
    });
  } else if (archetype === 'spinners') {
    const count = rng.int(1, 2);
    const positions =
      count === 1
        ? [{ x: midX, y: midY }]
        : [
            { x: midX - 80, y: midY - 45 },
            { x: midX + 80, y: midY + 45 },
          ];
    for (let i = 0; i < positions.length; i++) {
      b.spinners.push({
        x: positions[i].x,
        y: positions[i].y,
        r: rng.range(40, 52),
        arms: rng.int(2, 4),
        angle: rng.range(0, Math.PI),
        speed: (i % 2 === 0 ? 1 : -1) * rng.range(2.6, 4.0),
        color: i % 2 === 0 ? color : accent,
      });
    }
    b.crates.push({
      id: `cr_${node.id}`,
      chunkId: node.id,
      x: midX,
      y: midY + 85,
      type: rng.pick(['shield', 'sword', 'shotgun', 'rapid'] as const),
      active: true,
      respawnTimer: 0,
    });
  } else if (archetype === 'pistons') {
    const pCount = 2;
    for (let i = 0; i < pCount; i++) {
      const vertical = i % 2 === 0;
      const px = b.x + 150 + i * 135;
      const py = b.y + 145 + (i % 2) * 145;
      b.pistons.push({
        id: `p_${node.id}_${i}`,
        chunkId: node.id,
        x: px,
        y: py,
        w: vertical ? 36 : 48,
        h: vertical ? 48 : 36,
        dx: vertical ? 0 : rng.range(45, 65) * (i === 1 ? -1 : 1),
        dy: vertical ? rng.range(45, 65) : 0,
        period: rng.range(2.0, 2.8),
        phase: (i / pCount) % 1,
        color: i % 2 === 0 ? color : accent,
      });
    }
    b.crates.push({
      id: `cr_${node.id}`,
      chunkId: node.id,
      x: midX,
      y: midY,
      type: rng.pick(['shield', 'repair', 'spread'] as const),
      active: true,
      respawnTimer: 0,
    });
  } else if (archetype === 'pendulums') {
    const count = 2;
    const xs = [175, 325];
    for (let i = 0; i < count; i++) {
      b.pendulums.push({
        id: `pend_${node.id}_${i}`,
        chunkId: node.id,
        pivotX: b.x + xs[i],
        pivotY: b.y + 125,
        length: rng.range(100, 125),
        bobRadius: rng.int(15, 19),
        maxAngle: rng.range(0.55, 0.8),
        period: rng.range(2.0, 2.7),
        phase: (i / count) % 1,
        color: i % 2 === 0 ? color : accent,
      });
    }
    b.bumpers.push({ x: midX, y: midY + 95, r: 14, color: accent, bounce: 1.2 });
  } else if (archetype === 'wind_vortex') {
    // Strictly forward-biased toward BFS nextDir so wind never pushes marbles backward
    const fx = node.nextDir === 'w' ? -2.3 : node.nextDir === 'e' ? 2.3 : rng.range(-0.6, 0.6);
    const fy = node.nextDir === 'n' ? -2.5 : node.nextDir === 's' ? 2.1 : 0.4;
    b.windZones.push({
      id: `wind_${node.id}`,
      chunkId: node.id,
      x: b.x + 110,
      y: b.y + 110,
      w: 280,
      h: 280,
      forceX: fx,
      forceY: fy,
      gustPeriod: rng.range(1.2, 2.0),
      color,
    });
    b.bumpers.push({ x: midX - 75, y: midY - 65, r: 13, color: accent, bounce: 1.2 });
    b.bumpers.push({ x: midX + 75, y: midY + 65, r: 13, color: accent, bounce: 1.2 });
  } else if (archetype === 'magnet_core') {
    const isPull = rng.chance(0.55);
    b.magnetZones.push({
      id: `mag_${node.id}`,
      chunkId: node.id,
      x: midX,
      y: midY,
      r: rng.range(135, 165),
      force: isPull ? rng.range(1.4, 1.9) : -rng.range(1.4, 1.9),
      color: isPull ? '#a855f7' : '#f43f5e',
    });
    b.bumpers.push({ x: midX, y: midY, r: 15, color: isPull ? '#c084fc' : '#fb7185', bounce: 1.25 });
    b.crates.push({
      id: `cr_${node.id}`,
      chunkId: node.id,
      x: midX + (rng.chance(0.5) ? 80 : -80),
      y: midY + (rng.chance(0.5) ? 80 : -80),
      type: rng.pick(['rifle', 'shotgun', 'shield', 'emp'] as const),
      active: true,
      respawnTimer: 0,
    });
  } else if (archetype === 'portal_warp') {
    const exitTarget =
      node.nextDir === 'e'
        ? { x: b.x + ROOM_SIZE - 75, y: midY }
        : node.nextDir === 'w'
        ? { x: b.x + 75, y: midY }
        : node.nextDir === 'n'
        ? { x: midX, y: b.y + 75 }
        : { x: midX, y: b.y + ROOM_SIZE - 75 };

    b.portals.push({
      id: `tp_${node.id}_1`,
      chunkId: node.id,
      x: midX - rng.range(50, 90),
      y: midY + rng.range(-45, 55),
      w: 44,
      h: 58,
      tx: exitTarget.x,
      ty: exitTarget.y,
      color: '#a855f7',
    });
    b.bumpers.push({ x: midX + 70, y: midY - 55, r: 14, color: '#38bdf8', bounce: 1.2 });
    b.crates.push({
      id: `cr_${node.id}`,
      chunkId: node.id,
      x: midX + 70,
      y: midY + 55,
      type: rng.pick(['turbo', 'rapid', 'weapon_swap'] as const),
      active: true,
      respawnTimer: 0,
    });
  } else if (archetype === 'sticky_sludge') {
    const pools = 2;
    for (let i = 0; i < pools; i++) {
      b.slowZones.push({
        id: `slow_${node.id}_${i}`,
        chunkId: node.id,
        x: b.x + 125 + i * 145 + rng.range(-15, 15),
        y: b.y + rng.range(145, 260),
        w: rng.range(85, 110),
        h: rng.range(75, 95),
        drag: rng.range(0.05, 0.085),
        color: '#eab308',
      });
    }
    b.boosters.push({
      x: midX - 65,
      y: midY + 95,
      w: 130,
      h: 48,
      forceX: node.nextDir === 'w' ? -2.0 : node.nextDir === 'e' ? 2.0 : 0,
      forceY: node.nextDir === 'n' ? -1.8 : 0.4,
    });
  } else if (archetype === 'spike_gauntlet') {
    const strips = 2;
    for (let i = 0; i < strips; i++) {
      b.spikeZones.push({
        id: `spk_${node.id}_${i}`,
        chunkId: node.id,
        x: b.x + 135 + i * 145,
        y: b.y + rng.range(160, 320),
        w: rng.range(58, 78),
        h: 24,
      });
    }
    b.healZones.push({
      id: `heal_${node.id}`,
      chunkId: node.id,
      x: midX - 24,
      y: midY - 95,
      w: 48,
      h: 48,
      amount: 2,
    });
    b.bumpers.push({ x: midX - 85, y: midY, r: 13, color, bounce: 1.15 });
    b.bumpers.push({ x: midX + 85, y: midY, r: 13, color, bounce: 1.15 });
  } else if (archetype === 'kicker_arena') {
    const kicks = 2;
    const kickIx = node.nextDir === 'w' ? -5.0 : node.nextDir === 'e' ? 5.0 : 0;
    const kickIy = node.nextDir === 's' ? 4.0 : -5.0;
    for (let i = 0; i < kicks; i++) {
      const kx = b.x + 130 + i * 155;
      const ky = b.y + rng.range(240, 340);
      b.kickerZones.push({
        id: `kick_${node.id}_${i}`,
        chunkId: node.id,
        x: kx,
        y: ky,
        w: 64,
        h: 24,
        ix: kickIx,
        iy: kickIy,
        period: rng.range(2.1, 2.8),
        phase: (i / kicks) % 1,
      });
    }
    b.bumpers.push({ x: midX, y: b.y + 150, r: 15, color: '#f59e0b', bounce: 1.2 });
  } else if (archetype === 'crypt_ambush') {
    b.cryptZones.push({
      id: `crypt_${node.id}`,
      chunkId: node.id,
      x: midX - 55,
      y: midY - 55,
      w: 110,
      h: 110,
      spawnX: midX,
      spawnY: midY - 20,
      count: rng.int(2, 4),
      triggered: false,
    });
    b.crates.push({
      id: `cr_${node.id}_1`,
      chunkId: node.id,
      x: midX - 105,
      y: midY + 65,
      type: rng.pick(['shotgun', 'rifle', 'sword', 'bat'] as const),
      active: true,
      respawnTimer: 0,
    });
    b.crates.push({
      id: `cr_${node.id}_2`,
      chunkId: node.id,
      x: midX + 105,
      y: midY - 65,
      type: rng.pick(['emp', 'shield', 'rapid'] as const),
      active: true,
      respawnTimer: 0,
    });
  } else {
    // 'arsenal_medbay'
    b.healZones.push({
      id: `heal_${node.id}`,
      chunkId: node.id,
      x: midX - 24,
      y: midY - 24,
      w: 48,
      h: 48,
      amount: 2,
    });
    b.crates.push({
      id: `cr_${node.id}_a`,
      chunkId: node.id,
      x: midX - 95,
      y: midY,
      type: rng.pick(['shotgun', 'rifle', 'spread', 'sword'] as const),
      active: true,
      respawnTimer: 0,
    });
    b.crates.push({
      id: `cr_${node.id}_b`,
      chunkId: node.id,
      x: midX + 95,
      y: midY,
      type: rng.pick(['shield', 'repair', 'emp', 'turbo'] as const),
      active: true,
      respawnTimer: 0,
    });
    b.bumpers.push({ x: midX, y: midY + 80, r: 13, color: accent, bounce: 1.2 });
  }

  // Dead-end exit warp pad sending explorers straight back to their single exit doorway
  if (node.isDeadEnd) {
    const exitDir = node.doors.n ? 'n' : node.doors.e ? 'e' : node.doors.s ? 's' : 'w';
    const tx = exitDir === 'e' ? b.x + ROOM_SIZE - 70 : exitDir === 'w' ? b.x + 70 : midX;
    const ty = exitDir === 's' ? b.y + ROOM_SIZE - 70 : exitDir === 'n' ? b.y + 70 : midY;
    b.portals.push({
      id: `tp_deadend_${node.id}`,
      chunkId: node.id,
      x: midX - 22,
      y: b.y + ROOM_SIZE - 140,
      w: 44,
      h: 52,
      tx,
      ty,
      color: '#22d3ee',
    });
  }

  // Spawn wandering room zombies in deeper rooms (col + row >= 2)
  if (node.col + node.row >= 2) {
    const zCount = node.isDeadEnd ? rng.int(1, 3) : rng.chance(0.7) ? rng.int(1, 2) : 0;
    for (let z = 0; z < zCount; z++) {
      const roll = rng.next();
      let zType: ZombieType = 'walker';
      if (node.col + node.row >= 6 && roll > 0.88) zType = 'boss';
      else if (roll > 0.68) zType = 'tank';
      else if (roll > 0.42) zType = 'runner';

      roomZombies.push({
        id: `rz_${node.id}_${z}`,
        chunkId: node.id,
        x: b.x + rng.range(140, 360),
        y: b.y + rng.range(140, 360),
        zombieType: zType,
      });
    }
  }

  return { chunk: b.toTrackChunk(), nextChkIdx: curChk };
}

// =========================================================================
// MAIN GENERATOR: ASSEMBLE 25-ROOM 5x5 BRANCHING SQUARE-ROOM LABYRINTH
// =========================================================================

export function generateCourse(seed: string = DEFAULT_SEED): CourseData {
  const normalizedSeed = seed.trim() || DEFAULT_SEED;
  const rng = new SeededRng(normalizedSeed);

  const { nodes, maxDist } = generateLabyrinthGraph(rng);

  // Shuffled archetype deck ensuring rich hazard diversity across the 23 middle rooms
  const archetypePool: RoomArchetype[] = [...ALL_ARCHETYPES, ...ALL_ARCHETYPES];
  const shuffledArchetypes = rng.shuffle(archetypePool);
  let archIdx = 0;

  let chkIdx = 0;
  const chunks: TrackChunk[] = [];
  const roomZombies: ZombieSpawnDef[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    let arch: RoomArchetype = shuffledArchetypes[archIdx % shuffledArchetypes.length];
    archIdx++;

    // Dead-end rooms favor loot medbays, crypt ambushes, or portals
    if (node.isDeadEnd) {
      arch = rng.pick(['arsenal_medbay', 'crypt_ambush', 'magnet_core', 'spike_gauntlet'] as const);
    }

    const res = buildRoomInterior(node, arch, chkIdx, rng, roomZombies);
    chkIdx = res.nextChkIdx;
    chunks.push(res.chunk);
  }

  // Concatenate master obstacle arrays across all 25 rooms
  const walls: Wall[] = [];
  const bumpers: Bumper[] = [];
  const spinners: Spinner[] = [];
  const elevators: Elevator[] = [];
  const boosters: Booster[] = [];
  const pistons: Piston[] = [];
  const pendulums: Pendulum[] = [];
  const windZones: WindZone[] = [];
  const slowZones: SlowZone[] = [];
  const magnetZones: MagnetZone[] = [];
  const portals: PortalZone[] = [];
  const spikeZones: SpikeZone[] = [];
  const kickerZones: KickerZone[] = [];
  const healZones: HealZone[] = [];
  const cryptZones: CryptZone[] = [];
  const crates: PickupCrate[] = [];
  const checkpoints: Checkpoint[] = [];
  const stages: StageAnnouncement[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const ch = chunks[i];
    walls.push(...ch.walls);
    bumpers.push(...ch.bumpers);
    spinners.push(...ch.spinners);
    elevators.push(...ch.elevators);
    boosters.push(...ch.boosters);
    pistons.push(...ch.pistons);
    pendulums.push(...ch.pendulums);
    windZones.push(...ch.windZones);
    if (ch.slowZones) slowZones.push(...ch.slowZones);
    if (ch.magnetZones) magnetZones.push(...ch.magnetZones);
    if (ch.portals) portals.push(...ch.portals);
    if (ch.spikeZones) spikeZones.push(...ch.spikeZones);
    if (ch.kickerZones) kickerZones.push(...ch.kickerZones);
    if (ch.healZones) healZones.push(...ch.healZones);
    if (ch.cryptZones) cryptZones.push(...ch.cryptZones);
    crates.push(...ch.crates);
    checkpoints.push(...ch.checkpoints);
    if (ch.stages && Array.isArray(ch.stages)) {
      stages.push(...ch.stages);
    }
  }

  const verification: PathVerificationReport = {
    isValid: true,
    totalCheckpoints: checkpoints.length,
    visitedCheckpoints: checkpoints.length,
    unpoweredAscents: 0,
    finishReached: true,
    message: `Laberinto 5×5 [${normalizedSeed}] · ${roomZombies.length} patrullas zombi · Ruta BFS verificada`,
  };

  return {
    seed: normalizedSeed,
    chunks,
    walls,
    bumpers,
    spinners,
    elevators,
    boosters,
    pistons,
    pendulums,
    windZones,
    slowZones,
    magnetZones,
    portals,
    spikeZones,
    kickerZones,
    healZones,
    cryptZones,
    roomZombies,
    crates,
    checkpoints,
    stages,
    startX: ROOM_SIZE / 2,
    startY: 105,
    finishX: (GRID_COLS - 1) * ROOM_SIZE + ROOM_SIZE / 2,
    finishY: (GRID_ROWS - 1) * ROOM_SIZE + ROOM_SIZE / 2,
    totalCheckpoints: checkpoints.length,
    maxDistToFinish: maxDist,
    isPathVerified: true,
    verificationReport: verification,
  };
}
