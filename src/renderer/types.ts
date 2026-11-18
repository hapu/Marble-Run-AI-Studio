import { MuzzleFlash, ShockwaveEffect } from '../types';

export interface RenderFocusFx {
  x: number;
  y: number;
  color: string;
  text: string;
  progress: number; // 0..1
  silent?: boolean;
}

export interface RenderOptions {
  followedMarbleId?: string | null;
  hoveredMarbleId?: string | null;
  nameplateRevealId?: string | null;
  nameplateRevealAlpha?: number;
  showSkyline?: boolean;
  showParticles?: boolean;
  focusFx?: RenderFocusFx | null;
  damageFlashAlpha?: number;
  shockwaves?: ShockwaveEffect[];
  muzzleFlashes?: MuzzleFlash[];
  shakeOffset?: { x: number; y: number };
  raceTimeNow?: number;
  isTvMode?: boolean;
}

export interface ViewBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}
