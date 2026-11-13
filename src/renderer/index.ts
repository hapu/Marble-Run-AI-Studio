import {
  CourseData,
  Marble,
  Projectile,
  CombatParticle,
  FloatingText,
  TemporaryBarricade,
  CombatEvent,
} from '../types';
import { RenderOptions, ViewBounds } from './types';
import { renderSkylineBackdrop } from './skyline';
import { renderLabyrinthGrid, renderWallsBumpersSpinners, renderZonesAndHazards } from './arena';
import { renderCombatVfx, renderMarbles, renderScreenOverlays } from './entities';

export type { RenderFocusFx, RenderOptions } from './types';

export function renderCourse(
  ctx: CanvasRenderingContext2D,
  course: CourseData,
  marbles: Marble[],
  virtualW: number,
  virtualH: number,
  camCenterX: number,
  camCenterY: number,
  camZoom: number,
  raceTime: number,
  projectiles: Projectile[] = [],
  particles: CombatParticle[] = [],
  floatingTexts: FloatingText[] = [],
  barricades: TemporaryBarricade[] = [],
  combatFeed: CombatEvent[] = [],
  options: RenderOptions = {}
): void {
  const bgGrad = ctx.createLinearGradient(0, 0, 0, virtualH);
  bgGrad.addColorStop(0, '#060913');
  bgGrad.addColorStop(1, '#0b101d');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, virtualW, virtualH);

  if (options.showSkyline !== false) {
    renderSkylineBackdrop(ctx, virtualW, virtualH, camCenterX, camCenterY, raceTime);
  }

  ctx.save();
  ctx.translate(virtualW / 2, virtualH / 2);
  ctx.scale(camZoom, camZoom);
  ctx.translate(-camCenterX, -camCenterY);

  const halfViewW = virtualW / 2 / camZoom;
  const halfViewH = virtualH / 2 / camZoom;
  const view: ViewBounds = {
    minX: camCenterX - halfViewW - 180,
    maxX: camCenterX + halfViewW + 180,
    minY: camCenterY - halfViewH - 180,
    maxY: camCenterY + halfViewH + 180,
  };

  renderLabyrinthGrid(ctx, course, view);
  renderZonesAndHazards(ctx, course, raceTime, view);
  renderWallsBumpersSpinners(ctx, course, raceTime, view);
  renderMarbles(ctx, marbles, raceTime, view, options.followedMarbleId);
  renderCombatVfx(ctx, projectiles, barricades, particles, floatingTexts, raceTime, view, options);

  ctx.restore();

  renderScreenOverlays(
    ctx,
    virtualW,
    virtualH,
    camCenterX,
    camCenterY,
    camZoom,
    combatFeed,
    options
  );
}
