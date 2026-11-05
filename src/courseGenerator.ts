import {
  CourseData,
  Wall,
  Bumper,
  Spinner,
  Elevator,
  Booster,
  EscalatorStep,
  Checkpoint,
  StageAnnouncement
} from './types';

// Deterministic Mulberry32 Pseudo-Random Number Generator
export function createRNG(seedStr: string) {
  let hash = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    hash = Math.imul(hash ^ seedStr.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  let s = hash >>> 0;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Point {
  x: number;
  y: number;
}

/**
 * TrackSocket represents the exact boundary interface of a modular track piece.
 * Any piece can seamlessly dock with any other piece via Bezier transitions.
 */
export interface TrackSocket {
  pos: Point;    // Centerline anchor point (x, y)
  dir: Point;    // Unit forward direction vector (dx, dy)
  width: number; // Track width between left and right walls
  color: string; // Theme rail color for this connection
}

/**
 * CourseBuilder accumulates all physical and visual course components.
 */
export class CourseBuilder {
  walls: Wall[] = [];
  bumpers: Bumper[] = [];
  spinners: Spinner[] = [];
  elevators: Elevator[] = [];
  boosters: Booster[] = [];
  escalators: EscalatorStep[] = [];
  checkpoints: Checkpoint[] = [];
  stages: StageAnnouncement[] = [];
  chkIdx = 0;

  addCheckpoint(
    pos: Point,
    name?: string,
    isFinish = false,
    themeColor = '#2dbfd6',
    subtitle?: string
  ) {
    this.checkpoints.push({
      x: pos.x,
      y: pos.y,
      idx: this.chkIdx++,
      name,
      isFinish,
    });
    if (name) {
      this.stages.push({
        name,
        chkIdx: this.chkIdx - 1,
        x: pos.x,
        y: pos.y,
        themeColor,
        subtitle,
      });
    }
  }

  addWall(w: Wall) {
    this.walls.push(w);
  }

  // Generates a smooth cubic Bezier curve of connected wall segments
  addBezierWall(
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    segments = 10,
    options: Partial<Wall> = {}
  ) {
    let prevX = p0.x;
    let prevY = p0.y;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const omt = 1 - t;
      const x =
        omt * omt * omt * p0.x +
        3 * omt * omt * t * p1.x +
        3 * omt * t * t * p2.x +
        t * t * t * p3.x;
      const y =
        omt * omt * omt * p0.y +
        3 * omt * omt * t * p1.y +
        3 * omt * t * t * p2.y +
        t * t * t * p3.y;
      this.walls.push({
        x1: prevX,
        y1: prevY,
        x2: x,
        y2: y,
        bounce: options.bounce ?? 0.4,
        friction: options.friction ?? 0.992,
        color: options.color,
        glow: options.glow,
        kind: options.kind ?? 'rail',
      });
      prevX = x;
      prevY = y;
    }
  }

  // Generates a channel with parallel left & right walls and variable width along a Bezier spline
  addCurvedChannel(
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    startWidth: number,
    endWidth: number,
    segments = 10,
    options: Partial<Wall> = {}
  ) {
    const leftPts: Point[] = [];
    const rightPts: Point[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const omt = 1 - t;
      const cx =
        omt * omt * omt * p0.x +
        3 * omt * omt * t * p1.x +
        3 * omt * t * t * p2.x +
        t * t * t * p3.x;
      const cy =
        omt * omt * omt * p0.y +
        3 * omt * omt * t * p1.y +
        3 * omt * t * t * p2.y +
        t * t * t * p3.y;

      const dx =
        3 * omt * omt * (p1.x - p0.x) +
        6 * omt * t * (p2.x - p1.x) +
        3 * t * t * (p3.x - p2.x);
      const dy =
        3 * omt * omt * (p1.y - p0.y) +
        6 * omt * t * (p2.y - p1.y) +
        3 * t * t * (p3.y - p2.y);
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      const currentW = startWidth + t * (endWidth - startWidth);
      const halfW = currentW / 2;

      leftPts.push({ x: cx - nx * halfW, y: cy - ny * halfW });
      rightPts.push({ x: cx + nx * halfW, y: cy + ny * halfW });
    }

    for (let i = 0; i < segments; i++) {
      this.walls.push({
        x1: leftPts[i].x,
        y1: leftPts[i].y,
        x2: leftPts[i + 1].x,
        y2: leftPts[i + 1].y,
        bounce: options.bounce ?? 0.4,
        friction: options.friction ?? 0.992,
        color: options.color,
        glow: options.glow,
        kind: options.kind ?? 'rail',
      });
      this.walls.push({
        x1: rightPts[i].x,
        y1: rightPts[i].y,
        x2: rightPts[i + 1].x,
        y2: rightPts[i + 1].y,
        bounce: options.bounce ?? 0.4,
        friction: options.friction ?? 0.992,
        color: options.color,
        glow: options.glow,
        kind: options.kind ?? 'rail',
      });
    }
  }

  /**
   * Universal Modular Bezier Transition:
   * Connects any exit socket to any entry socket using a smooth C1-continuous cubic Bezier curve.
   * Eliminates abrupt straight line segments between sectors, guarantees watertight wall connectivity,
   * and places checkpoints and forward boosters along the curve.
   */
  connectSocketsWithBezier(
    from: TrackSocket,
    to: TrackSocket,
    options: {
      segments?: number;
      addBooster?: boolean;
      boosterForce?: { x: number; y: number };
      color?: string;
    } = {}
  ) {
    const dist = Math.hypot(to.pos.x - from.pos.x, to.pos.y - from.pos.y);
    const handleL = Math.max(60, Math.min(dist * 0.45, 420));

    // C1-continuous Hermite-to-Bezier control points
    const p0: Point = { x: from.pos.x, y: from.pos.y };
    const p1: Point = {
      x: from.pos.x + from.dir.x * handleL,
      y: from.pos.y + from.dir.y * handleL,
    };
    const p2: Point = {
      x: to.pos.x - to.dir.x * handleL,
      y: to.pos.y - to.dir.y * handleL,
    };
    const p3: Point = { x: to.pos.x, y: to.pos.y };

    const segments = options.segments ?? 12;
    const transitionColor = options.color || from.color || to.color || '#2dbfd6';

    // Build the curved channel
    this.addCurvedChannel(p0, p1, p2, p3, from.width, to.width, segments, {
      color: transitionColor,
      bounce: 0.38,
      friction: 0.994,
    });

    // Place an intermediate navigation checkpoint along the curve center
    const midT = 0.5;
    const omt = 0.5;
    const midX =
      omt * omt * omt * p0.x +
      3 * omt * omt * midT * p1.x +
      3 * omt * midT * midT * p2.x +
      midT * midT * midT * p3.x;
    const midY =
      omt * omt * omt * p0.y +
      3 * omt * omt * midT * p1.y +
      3 * omt * midT * midT * p2.y +
      midT * midT * midT * p3.y;

    this.addCheckpoint({ x: midX, y: midY });

    // Optional forward acceleration booster localized along the transition curve
    if (options.addBooster) {
      const fx = options.boosterForce?.x ?? (to.pos.x > from.pos.x ? 0.8 : -0.8);
      const fy = options.boosterForce?.y ?? (to.pos.y > from.pos.y ? 0.4 : -0.4);

      this.boosters.push({
        x: midX - 45,
        y: midY - 45,
        w: 90,
        h: 90,
        forceX: fx,
        forceY: fy,
      });
    }
  }
}

// =========================================================================
// MODULAR SECTOR PIECES
// =========================================================================

/**
 * Sector 1: La Gran Compuerta & Cascada Pachinko (Moves DOWN)
 */
function buildSector1Pachinko(builder: CourseBuilder, rng: () => number): TrackSocket {
  const startX = 600;
  const startY = 100;
  const s1W = 520;
  const s1H = 2000;
  const color = '#2dbfd6';

  builder.addCheckpoint(
    { x: startX, y: startY },
    'ETAPA 1: COMPUERTA DE SALIDA',
    false,
    color,
    'CASCADA DE PACHINKO'
  );

  // Flared trumpet inlet with Bezier curves
  builder.addBezierWall(
    { x: startX - 280, y: startY - 20 },
    { x: startX - 250, y: startY + 80 },
    { x: startX - s1W / 2 - 20, y: startY + 140 },
    { x: startX - s1W / 2, y: startY + 220 },
    8,
    { color, bounce: 0.5 }
  );

  builder.addBezierWall(
    { x: startX + 280, y: startY - 20 },
    { x: startX + 250, y: startY + 80 },
    { x: startX + s1W / 2 + 20, y: startY + 140 },
    { x: startX + s1W / 2, y: startY + 220 },
    8,
    { color, bounce: 0.5 }
  );

  // Plinko chamber side rails
  builder.addWall({
    x1: startX - s1W / 2,
    y1: startY + 220,
    x2: startX - s1W / 2,
    y2: startY + s1H,
    color,
    bounce: 0.45,
  });
  builder.addWall({
    x1: startX + s1W / 2,
    y1: startY + 220,
    x2: startX + s1W / 2,
    y2: startY + s1H - 120,
    color,
    bounce: 0.45,
  });

  builder.addCheckpoint({ x: startX, y: startY + 700 });

  // Diamond Pachinko bumper grid
  const pRows = 11;
  for (let r = 0; r < pRows; r++) {
    const py = startY + 320 + r * 150;
    const cols = r % 2 === 0 ? 6 : 7;
    const step = (s1W - 80) / cols;
    const pinColor = r % 2 === 0 ? '#2dbfd6' : '#f0be38';

    for (let c = 0; c < cols; c++) {
      const jitter = (rng() - 0.5) * 12;
      const px = startX - s1W / 2 + 40 + c * step + (r % 2 === 0 ? step / 2 : 0) + jitter;
      builder.bumpers.push({
        x: px,
        y: py,
        r: 12 + Math.floor(rng() * 3),
        color: pinColor,
        bounce: 1.28,
      });
    }
  }

  const exitY = startY + s1H;
  builder.addCheckpoint({ x: startX, y: exitY });

  return {
    pos: { x: startX, y: exitY },
    dir: { x: 0, y: 1 },
    width: s1W,
    color,
  };
}

/**
 * Sector 2: Autopista de Propulsión Hyper-Speed (Moves RIGHT)
 */
function buildSector2Highway(
  builder: CourseBuilder,
  entryPos: Point,
  rng: () => number
): TrackSocket {
  const color = '#f0be38';
  const len = 2100;
  const width = 150;

  builder.addCheckpoint(
    entryPos,
    'ETAPA 2: AUTOPISTA DE PROPULSIÓN',
    false,
    color,
    'ACELERADOR MAGNÉTICO'
  );

  const halfW = width / 2;
  const floorY = entryPos.y + halfW;
  const ceilY = entryPos.y - halfW;

  // Straight rails
  builder.addWall({
    x1: entryPos.x,
    y1: floorY,
    x2: entryPos.x + len,
    y2: floorY,
    color,
    bounce: 0.35,
  });
  builder.addWall({
    x1: entryPos.x,
    y1: ceilY,
    x2: entryPos.x + len,
    y2: ceilY,
    color,
    bounce: 0.35,
  });

  // Continuous speed boosters along track
  const bCount = 5;
  const segW = len / bCount;
  for (let b = 0; b < bCount; b++) {
    const bx = entryPos.x + b * segW;
    builder.boosters.push({
      x: bx,
      y: floorY - 55,
      w: segW + 20,
      h: 55,
      forceX: 1.75 + rng() * 0.25,
      forceY: 0,
    });

    // Floating speed gates
    builder.bumpers.push({
      x: bx + segW * 0.5,
      y: ceilY + 30,
      r: 14,
      color,
      bounce: 1.3,
    });
  }

  const midX = entryPos.x + len * 0.5;
  builder.addCheckpoint({ x: midX, y: entryPos.y });

  const exitPos: Point = { x: entryPos.x + len, y: entryPos.y };
  builder.addCheckpoint(exitPos);

  return {
    pos: exitPos,
    dir: { x: 1, y: 0 },
    width,
    color,
  };
}

/**
 * Sector 3: Torre Elevador Anti-Gravedad #1 (Moves UP ~2750px)
 */
function buildSector3Elevator(
  builder: CourseBuilder,
  entryPos: Point,
  _rng: () => number
): TrackSocket {
  const color = '#2dbfd6';
  const elevH = 2750;
  const elevW = 160;
  const shaftX = entryPos.x + 30;
  const topY = entryPos.y - elevH;

  builder.addCheckpoint(
    entryPos,
    'ETAPA 3: ELEVADOR ANTI-GRAVEDAD',
    false,
    color,
    'TUBO DE VACÍO SUPERSÓNICO'
  );

  // Left solid wall all the way to summit
  builder.addWall({
    x1: shaftX,
    y1: entryPos.y + 75,
    x2: shaftX,
    y2: topY,
    color,
    bounce: 0.4,
  });

  // Right shaft wall leaving top exit opening
  builder.addWall({
    x1: shaftX + elevW,
    y1: entryPos.y + 75,
    x2: shaftX + elevW,
    y2: topY + 160,
    color,
    bounce: 0.4,
  });

  // Floor scoop cradle
  builder.addWall({
    x1: shaftX - 20,
    y1: entryPos.y + 75,
    x2: shaftX + elevW + 20,
    y2: entryPos.y + 75,
    color,
    bounce: 0.35,
  });

  // Anti-gravity upward lift conduit
  builder.elevators.push({
    x: shaftX,
    y: topY,
    w: elevW,
    h: elevH,
    liftSpeed: -16.0,
  });

  // Bottom launch booster
  builder.boosters.push({
    x: shaftX,
    y: entryPos.y + 10,
    w: elevW,
    h: 65,
    forceX: 0,
    forceY: -6.5,
  });

  builder.addCheckpoint({ x: shaftX + elevW / 2, y: entryPos.y - elevH * 0.5 });

  // Parabolic ceiling hood curve over elevator exit
  const hoodLen = 340;
  const hoodDrop = 80;
  builder.addBezierWall(
    { x: shaftX, y: topY },
    { x: shaftX + elevW * 0.5, y: topY - 40 },
    { x: shaftX + elevW + 50, y: topY + 20 },
    { x: shaftX + elevW + hoodLen, y: topY + hoodDrop },
    8,
    { color, bounce: 0.5 }
  );

  // Floor ramp below exit opening
  builder.addWall({
    x1: shaftX + elevW,
    y1: topY + 160,
    x2: shaftX + elevW + hoodLen,
    y2: topY + 160 + hoodDrop,
    color,
    bounce: 0.35,
  });

  // Exit ramp forward propulsion booster
  builder.boosters.push({
    x: shaftX + elevW + 10,
    y: topY + 150,
    w: hoodLen - 20,
    h: 65,
    forceX: 1.9,
    forceY: 0.3,
  });

  const exitPos: Point = {
    x: shaftX + elevW + hoodLen,
    y: topY + 160 + hoodDrop / 2,
  };
  builder.addCheckpoint(exitPos);

  return {
    pos: exitPos,
    dir: { x: 1, y: 0.2 },
    width: 160,
    color,
  };
}

/**
 * Sector 4: Gauntlet de Molinos & Ondulaciones (Moves RIGHT & DOWN)
 */
function buildSector4WaveGauntlet(
  builder: CourseBuilder,
  entryPos: Point,
  rng: () => number
): TrackSocket {
  const color = '#ed7e38';
  const spinCount = 5;

  builder.addCheckpoint(
    entryPos,
    'ETAPA 4: GAUNTLET DE MOLINOS',
    false,
    color,
    'MOLINOS Y ONDAS SINUOSAS'
  );

  let curX = entryPos.x + 100;
  let curY = entryPos.y + 40;

  for (let i = 0; i < spinCount; i++) {
    const sx = curX + i * 340;
    const sy = curY + i * 210;
    const arms = 3 + (i % 2);
    const spd = (0.045 + rng() * 0.015) * (i % 2 === 0 ? 1 : -1);

    builder.spinners.push({
      x: sx,
      y: sy,
      r: 80,
      arms,
      angle: rng() * Math.PI,
      speed: spd,
      color,
    });

    const isEven = i % 2 === 0;
    const slant = 140 + rng() * 25;

    // Smooth sinusoidal wave ramp below spinner
    if (isEven) {
      builder.addBezierWall(
        { x: sx - 160, y: sy + 70 },
        { x: sx - 60, y: sy + 90 },
        { x: sx + 80, y: sy + slant - 20 },
        { x: sx + 190, y: sy + slant },
        8,
        { color, bounce: 0.4 }
      );
      builder.bumpers.push({
        x: sx + 90,
        y: sy + slant - 25,
        r: 18,
        color: '#f0be38',
        bounce: 1.32,
      });
    } else {
      builder.addBezierWall(
        { x: sx + 190, y: sy + 70 },
        { x: sx + 90, y: sy + 90 },
        { x: sx - 50, y: sy + slant - 20 },
        { x: sx - 160, y: sy + slant },
        8,
        { color, bounce: 0.4 }
      );
      builder.bumpers.push({
        x: sx - 90,
        y: sy + slant - 25,
        r: 18,
        color: '#f0be38',
        bounce: 1.32,
      });
    }
  }

  const exitPos: Point = {
    x: curX + (spinCount - 1) * 340 + 200,
    y: curY + (spinCount - 1) * 210 + 200,
  };
  builder.addCheckpoint(exitPos);

  return {
    pos: exitPos,
    dir: { x: 1, y: 0.2 },
    width: 200,
    color,
  };
}

/**
 * Sector 5: Rampa Lanzadora Cinética (Moves UP & RIGHT)
 */
function buildSector5KineticRunway(
  builder: CourseBuilder,
  entryPos: Point,
  rng: () => number
): TrackSocket {
  const color = '#3eb874';
  const len = 1150;
  const rise = 960;
  const width = 230;

  builder.addCheckpoint(
    entryPos,
    'ETAPA 5: ESCALERA CINÉTICA',
    false,
    color,
    'PISTA DE DESPEGUE HIPERSÓNICA'
  );

  const startY = entryPos.y;
  const endY = entryPos.y - rise;

  // Smooth concave launch runway
  builder.addCurvedChannel(
    { x: entryPos.x, y: startY },
    { x: entryPos.x + len * 0.35, y: startY + 40 },
    { x: entryPos.x + len * 0.7, y: startY - rise * 0.6 },
    { x: entryPos.x + len, y: endY },
    width,
    width,
    12,
    { color, bounce: 0.35 }
  );

  // Kinetic catapult accelerators along the ramp
  const segs = 5;
  const segW = len / segs;
  for (let s = 0; s < segs; s++) {
    const fraction = s / segs;
    const bx = entryPos.x + fraction * len;
    const by = startY - fraction * rise;

    builder.boosters.push({
      x: bx,
      y: by - 65,
      w: segW + 20,
      h: 65,
      forceX: 2.3,
      forceY: -2.1,
    });

    builder.escalators.push({
      x: bx,
      y: by - 60,
      w: segW + 15,
      h: 60,
      boostX: 4.8 + rng() * 0.5,
      boostY: -5.4 - rng() * 0.6,
    });

    if (s % 2 === 1) {
      builder.bumpers.push({
        x: bx + segW * 0.5,
        y: by - 130,
        r: 16,
        color: '#2dbfd6',
        bounce: 1.25,
      });
    }
  }

  const exitPos: Point = { x: entryPos.x + len, y: endY };
  builder.addCheckpoint(exitPos);

  return {
    pos: exitPos,
    dir: { x: 1, y: -0.3 },
    width,
    color,
  };
}

/**
 * Sector 6: Vórtice Centrífugo Espiral (Moves DOWN)
 */
function buildSector6CycloneVortex(
  builder: CourseBuilder,
  entryPos: Point,
  _rng: () => number
): TrackSocket {
  const color = '#d64998';
  const bowlW = 660;
  const bowlCenterY = entryPos.y + 260;
  const holeR = 120;

  builder.addCheckpoint(
    entryPos,
    'ETAPA 6: VÓRTICE CENTRÍFUGO',
    false,
    color,
    'CICLÓN GRAVITATORIO'
  );

  // Smooth circular curved funnel bowl
  builder.addBezierWall(
    { x: entryPos.x - bowlW * 0.4, y: entryPos.y },
    { x: entryPos.x - bowlW * 0.35, y: bowlCenterY - 120 },
    { x: entryPos.x - bowlW * 0.25, y: bowlCenterY + 40 },
    { x: entryPos.x - holeR, y: bowlCenterY + 240 },
    10,
    { color, bounce: 0.4 }
  );

  builder.addBezierWall(
    { x: entryPos.x + bowlW * 0.4, y: entryPos.y },
    { x: entryPos.x + bowlW * 0.35, y: bowlCenterY - 120 },
    { x: entryPos.x + bowlW * 0.25, y: bowlCenterY + 40 },
    { x: entryPos.x + holeR, y: bowlCenterY + 240 },
    10,
    { color, bounce: 0.4 }
  );

  // 4-blade rotating cyclone turbine
  builder.spinners.push({
    x: entryPos.x,
    y: bowlCenterY + 80,
    r: 85,
    arms: 4,
    angle: 0,
    speed: 0.05,
    color,
  });

  // Downward vortex suction booster into drain
  builder.boosters.push({
    x: entryPos.x - holeR,
    y: bowlCenterY + 90,
    w: holeR * 2,
    h: 150,
    forceX: 0,
    forceY: 2.4,
  });

  const exitPos: Point = { x: entryPos.x, y: bowlCenterY + 240 };
  builder.addCheckpoint(exitPos);

  return {
    pos: exitPos,
    dir: { x: 0, y: 1 },
    width: holeR * 2,
    color,
  };
}

/**
 * Sector 7: Tobogán Subterráneo Supersónico (Moves LEFT & DOWN)
 */
function buildSector7UndergroundSlide(
  builder: CourseBuilder,
  entryPos: Point,
  _rng: () => number
): TrackSocket {
  const color = '#8958e0';
  const len = 2000;
  const drop = 750;
  const width = 160;

  builder.addCheckpoint(
    entryPos,
    'ETAPA 7: TÚNEL SUBTERRÁNEO',
    false,
    color,
    'SLIDE DE ACELERACIÓN RADIAL'
  );

  const endX = entryPos.x - len;
  const endY = entryPos.y + drop;

  // Smooth S-curved channel sliding down-left
  builder.addCurvedChannel(
    entryPos,
    { x: entryPos.x - len * 0.35, y: entryPos.y + drop * 0.2 },
    { x: entryPos.x - len * 0.7, y: entryPos.y + drop * 0.7 },
    { x: endX, y: endY },
    width,
    width,
    14,
    { color, bounce: 0.35 }
  );

  // Continuous speed boosters along chute floor
  const segs = 5;
  const segW = len / segs;
  for (let b = 0; b < segs; b++) {
    const bx = entryPos.x - b * segW;
    const by = entryPos.y + (b / segs) * drop;
    builder.boosters.push({
      x: bx - segW - 25,
      y: by + width / 2 - 70,
      w: segW + 35,
      h: 75,
      forceX: -1.8,
      forceY: 0.65,
    });

    if (b % 2 === 1) {
      builder.bumpers.push({
        x: bx - segW * 0.5,
        y: by,
        r: 16,
        color: '#2dbfd6',
        bounce: 1.25,
      });
    }
  }

  const exitPos: Point = { x: endX, y: endY };
  builder.addCheckpoint(exitPos);

  return {
    pos: exitPos,
    dir: { x: -1, y: 0.25 },
    width,
    color,
  };
}

/**
 * Sector 8: Elevador Neumático de Plasma #2 (Moves UP 1650px)
 */
function buildSector8PlasmaElevator(
  builder: CourseBuilder,
  entryPos: Point,
  _rng: () => number
): TrackSocket {
  const color = '#3b9ee6';
  const elevH = 1650;
  const elevW = 160;
  const shaftX = entryPos.x - 40 - elevW;
  const topY = entryPos.y - elevH;

  builder.addCheckpoint(
    entryPos,
    'ETAPA 8: ELEVADOR NEUMÁTICO',
    false,
    color,
    'CILINDRO DE PLASMA NEUMÁTICO'
  );

  // Left solid wall up to exit
  builder.addWall({
    x1: shaftX,
    y1: entryPos.y + 75,
    x2: shaftX,
    y2: topY + 160,
    color,
    bounce: 0.4,
  });

  // Right solid wall from top down
  builder.addWall({
    x1: shaftX + elevW,
    y1: topY,
    x2: shaftX + elevW,
    y2: entryPos.y - 75,
    color,
    bounce: 0.4,
  });

  // Sealed floor cup
  builder.addWall({
    x1: shaftX - 20,
    y1: entryPos.y + 75,
    x2: shaftX + elevW + 40,
    y2: entryPos.y + 75,
    color,
    bounce: 0.35,
  });

  // Anti-gravity plasma elevator
  builder.elevators.push({
    x: shaftX,
    y: topY,
    w: elevW,
    h: elevH,
    liftSpeed: -16.0,
  });

  // Bottom launch booster
  builder.boosters.push({
    x: shaftX,
    y: entryPos.y + 10,
    w: elevW,
    h: 65,
    forceX: 0,
    forceY: -6.5,
  });

  builder.addCheckpoint({ x: shaftX + elevW / 2, y: entryPos.y - elevH * 0.5 });

  // Parabolic ceiling hood curve arching left into Sector 9
  const hoodLen = 340;
  const hoodDrop = 80;
  builder.addBezierWall(
    { x: shaftX + elevW, y: topY },
    { x: shaftX + elevW * 0.5, y: topY - 40 },
    { x: shaftX - 50, y: topY + 20 },
    { x: shaftX - hoodLen, y: topY + hoodDrop },
    8,
    { color, bounce: 0.5 }
  );

  // Floor ramp below exit opening
  builder.addWall({
    x1: shaftX,
    y1: topY + 160,
    x2: shaftX - hoodLen,
    y2: topY + 160 + hoodDrop,
    color,
    bounce: 0.35,
  });

  // Booster shooting left
  builder.boosters.push({
    x: shaftX - hoodLen + 10,
    y: topY + 150,
    w: hoodLen - 20,
    h: 65,
    forceX: -1.9,
    forceY: 0.3,
  });

  const exitPos: Point = {
    x: shaftX - hoodLen,
    y: topY + 160 + hoodDrop / 2,
  };
  builder.addCheckpoint(exitPos);

  return {
    pos: exitPos,
    dir: { x: -1, y: 0.2 },
    width: 160,
    color,
  };
}

/**
 * Sector 9: Laberinto de Slalom y Amortiguadores (Moves DOWN)
 */
function buildSector9SlalomMaze(
  builder: CourseBuilder,
  entryPos: Point,
  _rng: () => number
): TrackSocket {
  const color = '#99cc33';
  const s9Count = 6;
  const s9TrackW = 540;
  const s9H = s9Count * 260 + 140;

  builder.addCheckpoint(
    entryPos,
    'ETAPA 9: LABERINTO DE PISTONES',
    false,
    color,
    'SLALOM DE DEFLECTORES CURVOS'
  );

  const leftX = entryPos.x - s9TrackW / 2;
  const rightX = entryPos.x + s9TrackW / 2;

  // Boundary side rails
  builder.addWall({
    x1: leftX,
    y1: entryPos.y,
    x2: leftX,
    y2: entryPos.y + s9H,
    color,
    bounce: 0.45,
  });
  builder.addWall({
    x1: rightX,
    y1: entryPos.y,
    x2: rightX,
    y2: entryPos.y + s9H - 100,
    color,
    bounce: 0.45,
  });

  // Alternating curved slalom baffles
  for (let p = 0; p < s9Count; p++) {
    const py = entryPos.y + 120 + p * 260;
    const isLeft = p % 2 === 0;
    const baffleW = s9TrackW * 0.62;

    if (isLeft) {
      builder.addBezierWall(
        { x: leftX, y: py },
        { x: leftX + baffleW * 0.5, y: py + 15 },
        { x: leftX + baffleW * 0.85, y: py + 35 },
        { x: leftX + baffleW, y: py + 70 },
        8,
        { color, bounce: 0.45 }
      );
      builder.bumpers.push({
        x: rightX - 100,
        y: py + 70,
        r: 20,
        color: '#f0be38',
        bounce: 1.35,
      });
    } else {
      builder.addBezierWall(
        { x: rightX, y: py },
        { x: rightX - baffleW * 0.5, y: py + 15 },
        { x: rightX - baffleW * 0.85, y: py + 35 },
        { x: rightX - baffleW, y: py + 70 },
        8,
        { color, bounce: 0.45 }
      );
      builder.bumpers.push({
        x: leftX + 100,
        y: py + 70,
        r: 20,
        color: '#f0be38',
        bounce: 1.35,
      });
    }
  }

  const exitPos: Point = { x: entryPos.x, y: entryPos.y + s9H };
  builder.addCheckpoint(exitPos);

  return {
    pos: exitPos,
    dir: { x: 0, y: 1 },
    width: s9TrackW,
    color,
  };
}

/**
 * Sector 10: Gran Bifurcación Aerodinámica (Moves RIGHT)
 */
function buildSector10DualExpressway(
  builder: CourseBuilder,
  entryPos: Point,
  _rng: () => number
): TrackSocket {
  const color = '#e85678';
  const len = 1900;
  const width = 180;

  builder.addCheckpoint(
    entryPos,
    'ETAPA 10: BIFURCACIÓN DUAL',
    false,
    color,
    'DOBLE VÍA DE ALTA VELOCIDAD'
  );

  const halfW = width / 2;
  const floorY = entryPos.y + halfW;
  const ceilY = entryPos.y - halfW;
  const midY = entryPos.y;

  // Outer straight walls
  builder.addWall({
    x1: entryPos.x,
    y1: floorY,
    x2: entryPos.x + len,
    y2: floorY,
    color,
    bounce: 0.35,
  });
  builder.addWall({
    x1: entryPos.x,
    y1: ceilY,
    x2: entryPos.x + len,
    y2: ceilY,
    color,
    bounce: 0.35,
  });

  // Aerodynamic teardrop central divider
  builder.addBezierWall(
    { x: entryPos.x + 120, y: midY },
    { x: entryPos.x + 200, y: midY - 12 },
    { x: entryPos.x + 350, y: midY - 8 },
    { x: entryPos.x + len - 160, y: midY },
    8,
    { color, bounce: 0.4 }
  );

  // Upper turbo boost expressway
  builder.boosters.push({
    x: entryPos.x + 150,
    y: midY - 65,
    w: len - 320,
    h: 65,
    forceX: 1.85,
    forceY: 0,
  });

  // Lower scenic bumper chicane
  for (let b = 0; b < 6; b++) {
    builder.bumpers.push({
      x: entryPos.x + 240 + b * 220,
      y: (midY + floorY) / 2,
      r: 15,
      color: '#f0be38',
      bounce: 1.35,
    });
  }

  const exitPos: Point = { x: entryPos.x + len, y: midY };
  builder.addCheckpoint(exitPos);

  return {
    pos: exitPos,
    dir: { x: 1, y: 0 },
    width,
    color,
  };
}

/**
 * Sector 11: Gran Plinko Dorado & Anfiteatro de la Victoria (Finish)
 */
function buildSector11GoldenAmphitheater(
  builder: CourseBuilder,
  entryPos: Point,
  _rng: () => number
): Point {
  const color = '#f59e0b';
  const len = 2000;
  const drop = 1100;

  builder.addCheckpoint(
    entryPos,
    'ETAPA FINAL: PLINKO DE ORO Y PODIO',
    false,
    color,
    'ANFITEATRO DE LA VICTORIA'
  );

  const startY = entryPos.y;
  const endY = startY + drop;
  const endX = entryPos.x + len;

  // Flared trumpet grandstand walls opening towards podium
  builder.addBezierWall(
    { x: entryPos.x, y: startY - 90 },
    { x: entryPos.x + len * 0.35, y: startY + drop * 0.2 - 120 },
    { x: entryPos.x + len * 0.7, y: startY + drop * 0.65 - 160 },
    { x: endX, y: endY - 160 },
    12,
    { color, bounce: 0.4 }
  );

  builder.addBezierWall(
    { x: entryPos.x, y: startY + 90 },
    { x: entryPos.x + len * 0.35, y: startY + drop * 0.2 + 120 },
    { x: entryPos.x + len * 0.7, y: startY + drop * 0.65 + 160 },
    { x: endX, y: endY + 160 },
    12,
    { color, bounce: 0.4 }
  );

  // Golden plinko pins
  const fRows = 11;
  for (let r = 0; r < fRows; r++) {
    const rx = entryPos.x + 160 + r * 155;
    const ry = startY + (r / fRows) * drop;
    for (let c = -2; c <= 2; c++) {
      builder.bumpers.push({
        x: rx + c * 34,
        y: ry + c * 40,
        r: 12,
        color: r % 2 === 0 ? '#f0be38' : '#ed7e38',
        bounce: 1.25,
      });
    }
  }

  const finishX = endX + 160;
  const finishY = endY;

  // Grand Victory Podium Enclosure
  builder.addBezierWall(
    { x: finishX - 60, y: finishY - 160 },
    { x: finishX + 140, y: finishY - 160 },
    { x: finishX + 260, y: finishY - 80 },
    { x: finishX + 260, y: finishY + 80 },
    8,
    { color, bounce: 0.6 }
  );

  builder.addBezierWall(
    { x: finishX + 260, y: finishY + 80 },
    { x: finishX + 260, y: finishY + 160 },
    { x: finishX + 140, y: finishY + 160 },
    { x: finishX - 60, y: finishY + 160 },
    8,
    { color, bounce: 0.6 }
  );

  builder.addCheckpoint(
    { x: finishX, y: finishY },
    'META FINAL',
    true,
    color,
    'PODIO DE CAMPEONES'
  );

  return { x: finishX, y: finishY };
}

// =========================================================================
// MAIN GENERATOR: ASSEMBLE MODULAR PIECES WITH BEZIER TRANSITIONS
// =========================================================================

export function generateCourse(seed: string): CourseData {
  const rng = createRNG(seed || 'mikan808');
  const builder = new CourseBuilder();

  // Sector 1: Pachinko Drop
  const s1Exit = buildSector1Pachinko(builder, rng);

  // Sector 2: Hyper-Speedway (Entry at (950, 2300))
  const s2Entry: TrackSocket = {
    pos: { x: 950, y: 2300 },
    dir: { x: 1, y: 0 },
    width: 150,
    color: '#f0be38',
  };
  // Bezier Transition 1 -> 2: Smooth sweeping 90° curve from Down to Right
  builder.connectSocketsWithBezier(s1Exit, s2Entry, {
    segments: 12,
    addBooster: true,
    boosterForce: { x: 1.6, y: 1.2 },
    color: '#2dbfd6',
  });
  const s2Exit = buildSector2Highway(builder, s2Entry.pos, rng);

  // Sector 3: Anti-Gravity Elevator #1 (Entry at (3160, 2300))
  const s3Entry: TrackSocket = {
    pos: { x: 3160, y: 2300 },
    dir: { x: 1, y: 0 },
    width: 150,
    color: '#2dbfd6',
  };
  // Bezier Transition 2 -> 3: Scoop curve into bottom of Elevator 1
  builder.connectSocketsWithBezier(s2Exit, s3Entry, {
    segments: 10,
    addBooster: true,
    boosterForce: { x: 1.5, y: 0 },
    color: '#f0be38',
  });
  const s3Exit = buildSector3Elevator(builder, s3Entry.pos, rng);

  // Sector 4: Wave Serpentine Gauntlet (Entry at (3700, -220))
  const s4Entry: TrackSocket = {
    pos: { x: 3700, y: -220 },
    dir: { x: 1, y: 0.3 },
    width: 200,
    color: '#ed7e38',
  };
  // Bezier Transition 3 -> 4: Smooth downhill curve from summit of Elevator 1
  builder.connectSocketsWithBezier(s3Exit, s4Entry, {
    segments: 10,
    addBooster: true,
    boosterForce: { x: 1.8, y: 0.6 },
    color: '#2dbfd6',
  });
  const s4Exit = buildSector4WaveGauntlet(builder, s4Entry.pos, rng);

  // Sector 5: Kinetic Launch Runway (Entry at (5300, 850))
  const s5Entry: TrackSocket = {
    pos: { x: 5300, y: 850 },
    dir: { x: 1, y: -0.2 },
    width: 220,
    color: '#3eb874',
  };
  // Bezier Transition 4 -> 5: Smooth banked transition into uphill launch runway
  builder.connectSocketsWithBezier(s4Exit, s5Entry, {
    segments: 10,
    addBooster: true,
    boosterForce: { x: 1.8, y: 0.2 },
    color: '#ed7e38',
  });
  const s5Exit = buildSector5KineticRunway(builder, s5Entry.pos, rng);

  // Sector 6: Centrifugal Cyclone Vortex (Entry at (6650, -50))
  const s6Entry: TrackSocket = {
    pos: { x: 6650, y: -50 },
    dir: { x: 0.4, y: 0.9 },
    width: 320,
    color: '#d64998',
  };
  // Bezier Transition 5 -> 6: Sweeping arc over the top of the cyclone bowl
  builder.connectSocketsWithBezier(s5Exit, s6Entry, {
    segments: 10,
    addBooster: true,
    boosterForce: { x: 1.5, y: 0.8 },
    color: '#3eb874',
  });
  const s6Exit = buildSector6CycloneVortex(builder, s6Entry.pos, rng);

  // Sector 7: Underground Speed Slide (Entry at (6600, 680))
  const s7Entry: TrackSocket = {
    pos: { x: 6600, y: 680 },
    dir: { x: -1, y: 0.35 },
    width: 160,
    color: '#8958e0',
  };
  // Bezier Transition 6 -> 7: 90° curve from Down to Left
  builder.connectSocketsWithBezier(s6Exit, s7Entry, {
    segments: 12,
    addBooster: true,
    boosterForce: { x: -1.2, y: 1.0 },
    color: '#d64998',
  });
  const s7Exit = buildSector7UndergroundSlide(builder, s7Entry.pos, rng);

  // Sector 8: Plasma Elevator #2 (Entry at (4520, 1420))
  const s8Entry: TrackSocket = {
    pos: { x: 4520, y: 1420 },
    dir: { x: -1, y: 0 },
    width: 160,
    color: '#3b9ee6',
  };
  // Bezier Transition 7 -> 8: Smooth scoop into the bottom of Elevator 2
  builder.connectSocketsWithBezier(s7Exit, s8Entry, {
    segments: 10,
    addBooster: true,
    boosterForce: { x: -1.6, y: 0.2 },
    color: '#8958e0',
  });
  const s8Exit = buildSector8PlasmaElevator(builder, s8Entry.pos, rng);

  // Sector 9: Slalom Maze (Entry at (3950, 100))
  const s9Entry: TrackSocket = {
    pos: { x: 3950, y: 100 },
    dir: { x: 0, y: 1 },
    width: 360,
    color: '#99cc33',
  };
  // Bezier Transition 8 -> 9: Sweeping curve from Left to Down into Slalom Maze
  builder.connectSocketsWithBezier(s8Exit, s9Entry, {
    segments: 12,
    addBooster: true,
    boosterForce: { x: -1.0, y: 1.4 },
    color: '#3b9ee6',
  });
  const s9Exit = buildSector9SlalomMaze(builder, s9Entry.pos, rng);

  // Sector 10: Dual Expressway (Entry at (4260, 1800))
  const s10Entry: TrackSocket = {
    pos: { x: 4260, y: 1800 },
    dir: { x: 1, y: 0 },
    width: 180,
    color: '#e85678',
  };
  // Bezier Transition 9 -> 10: Sweeping 90° banked curve from Down to Right
  builder.connectSocketsWithBezier(s9Exit, s10Entry, {
    segments: 12,
    addBooster: true,
    boosterForce: { x: 1.5, y: 1.0 },
    color: '#99cc33',
  });
  const s10Exit = buildSector10DualExpressway(builder, s10Entry.pos, rng);

  // Sector 11: Golden Amphitheater & Victory Podium (Entry at (6350, 1860))
  const s11Entry: TrackSocket = {
    pos: { x: 6350, y: 1860 },
    dir: { x: 1, y: 0.4 },
    width: 220,
    color: '#f59e0b',
  };
  // Bezier Transition 10 -> 11: Sweeping trumpet curve into Golden Plinko
  builder.connectSocketsWithBezier(s10Exit, s11Entry, {
    segments: 10,
    addBooster: true,
    boosterForce: { x: 1.8, y: 0.4 },
    color: '#e85678',
  });
  const finishPoint = buildSector11GoldenAmphitheater(builder, s11Entry.pos, rng);

  return {
    walls: builder.walls,
    bumpers: builder.bumpers,
    spinners: builder.spinners,
    elevators: builder.elevators,
    boosters: builder.boosters,
    escalators: builder.escalators,
    checkpoints: builder.checkpoints,
    stages: builder.stages,
    startX: 600,
    startY: 100,
    finishX: finishPoint.x,
    finishY: finishPoint.y,
    totalCheckpoints: builder.checkpoints.length,
  };
}
