export interface RenderFocusFx {
  x: number;
  y: number;
  color: string;
  text: string;
  progress: number; // 0..1
}

export interface RenderOptions {
  followedMarbleId?: string | null;
  showSkyline?: boolean;
  showParticles?: boolean;
  focusFx?: RenderFocusFx | null;
  damageFlashAlpha?: number;
}

export interface ViewBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
