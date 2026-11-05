export interface MarbleColorDef {
  id: string;
  name: string;
  color: string;
  border?: string;
  isMikan?: boolean;
}

export interface Marble {
  id: string;
  name: string;
  color: string;
  border?: string;
  isMikan?: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
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
  liftSpeed: number; // usually negative to lift UP
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

export interface CourseData {
  walls: Wall[];
  bumpers: Bumper[];
  spinners: Spinner[];
  elevators: Elevator[];
  boosters: Booster[];
  escalators: EscalatorStep[];
  checkpoints: Checkpoint[];
  stages: StageAnnouncement[];
  startX: number;
  startY: number;
  finishX: number;
  finishY: number;
  totalCheckpoints: number;
}
