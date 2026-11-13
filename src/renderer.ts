import {
  CourseData,
  Marble,
  Projectile,
  CombatParticle,
  FloatingText,
  TemporaryBarricade,
  CombatEvent,
} from './types';
import { WEAPON_SPECS, ZOMBIE_SPECS } from './constants';

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

// =========================================================================
// CACHED PARALLAX NIGHT SKYLINE (Generated once for crisp 60fps backdrop)
// =========================================================================
interface SkylineBuilding {
  x: number;
  w: number;
  h: number;
  windows: Array<{ wx: number; wy: number; lit: boolean; warm: boolean }>;
}

interface SkylineCache {
  stars: Array<{ x: number; y: number; r: number; phase: number }>;
  layers: SkylineBuilding[][];
}

let skylineCache: SkylineCache | null = null;

function getSkylineCache(): SkylineCache {
  if (skylineCache) return skylineCache;

  let seed = 918273;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) % 10000) / 10000;
  };

  const stars = Array.from({ length: 75 }, () => ({
    x: rnd() * 2400,
    y: rnd() * 720,
    r: 0.7 + rnd() * 1.4,
    phase: rnd() * Math.PI * 2,
  }));

  const layers: SkylineBuilding[][] = [0, 1, 2].map((layerIdx) => {
    const buildings: SkylineBuilding[] = [];
    let curX = 0;
    const maxW = 2800;
    while (curX < maxW) {
      const w = 48 + rnd() * (65 + layerIdx * 24);
      const h = 95 + rnd() * (140 + layerIdx * 75);
      const windows: SkylineBuilding['windows'] = [];
      const cols = Math.floor((w - 14) / 14);
      const rows = Math.floor((h - 20) / 18);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (rnd() > 0.58) {
            windows.push({
              wx: 8 + c * 14,
              wy: 12 + r * 18,
              lit: rnd() > 0.3,
              warm: rnd() > 0.45,
            });
          }
        }
      }
      buildings.push({ x: curX, w, h, windows });
      curX += w + 4 + rnd() * 14;
    }
    return buildings;
  });

  skylineCache = { stars, layers };
  return skylineCache;
}

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
) {
  const showSkyline = options.showSkyline !== false;
  const showParticles = options.showParticles !== false;

  // Base deep night gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, virtualH);
  bgGrad.addColorStop(0, '#060913');
  bgGrad.addColorStop(1, '#0b101d');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, virtualW, virtualH);

  // =========================================================================
  // PARALLAX NIGHT SKYLINE BACKDROP (Optional via Debug Toggle)
  // =========================================================================
  if (showSkyline) {
    const sky = getSkylineCache();
    ctx.save();
    // Twinkling stars
    for (let i = 0; i < sky.stars.length; i++) {
      const st = sky.stars[i];
      const sx = ((st.x - camCenterX * 0.02) % virtualW + virtualW) % virtualW;
      const sy = ((st.y - camCenterY * 0.015) % (virtualH * 0.65) + virtualH * 0.65) % (virtualH * 0.65);
      const alpha = 0.25 + 0.35 * Math.sin(raceTime * 2.2 + st.phase);
      ctx.fillStyle = `rgba(226, 232, 240, ${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, st.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3 Parallax city silhouette layers
    const layerColors = ['#0c1222', '#0f172a', '#131d33'];
    const parallaxRates = [0.04, 0.08, 0.13];
    for (let l = 0; l < sky.layers.length; l++) {
      const buildings = sky.layers[l];
      const pShift = (camCenterX * parallaxRates[l]) % 2800;
      ctx.fillStyle = layerColors[l];
      for (let b = 0; b < buildings.length; b++) {
        const bld = buildings[b];
        let bx = bld.x - pShift;
        if (bx + bld.w < 0) bx += 2800;
        if (bx > virtualW) continue;
        const by = virtualH - bld.h + l * 18;
        ctx.fillStyle = layerColors[l];
        ctx.fillRect(bx, by, bld.w, bld.h);

        if (l >= 1) {
          for (let wIdx = 0; wIdx < bld.windows.length; wIdx++) {
            const win = bld.windows[wIdx];
            ctx.fillStyle = win.warm ? 'rgba(251, 191, 36, 0.14)' : 'rgba(56, 189, 248, 0.12)';
            ctx.fillRect(bx + win.wx, by + win.wy, 6, 8);
          }
        }
      }
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(virtualW / 2, virtualH / 2);
  ctx.scale(camZoom, camZoom);
  ctx.translate(-camCenterX, -camCenterY);

  // Camera view bounds for spatial culling
  const halfViewW = virtualW / 2 / camZoom;
  const halfViewH = virtualH / 2 / camZoom;
  const viewMinX = camCenterX - halfViewW - 180;
  const viewMaxX = camCenterX + halfViewW + 180;
  const viewMinY = camCenterY - halfViewH - 180;
  const viewMaxY = camCenterY + halfViewH + 180;

  // =========================================================================
  // 0. 5x5 SQUARE-ROOM LABYRINTH FLOORS, GRID & DOORWAY THRESHOLDS
  // =========================================================================
  if (course.chunks && course.chunks.length > 0) {
    ctx.save();
    for (let c = 0; c < course.chunks.length; c++) {
      const chunk = course.chunks[c];
      if (
        chunk.x + chunk.size < viewMinX ||
        chunk.x > viewMaxX ||
        chunk.y + chunk.size < viewMinY ||
        chunk.y > viewMaxY
      ) {
        continue;
      }

      // Room floor surface plate
      if (chunk.isStart) {
        ctx.fillStyle = 'rgba(14, 116, 144, 0.14)';
      } else if (chunk.isFinish) {
        ctx.fillStyle = 'rgba(21, 128, 61, 0.16)';
      } else if (chunk.isDeadEnd) {
        ctx.fillStyle = 'rgba(126, 34, 206, 0.11)';
      } else {
        ctx.fillStyle = 'rgba(13, 18, 34, 0.72)';
      }
      ctx.fillRect(chunk.x + 8, chunk.y + 8, chunk.size - 16, chunk.size - 16);

      // Subtle internal room grid (100px tiles for 500x500 rooms)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let gx = chunk.x + 100; gx < chunk.x + chunk.size; gx += 100) {
        ctx.moveTo(gx, chunk.y + 8);
        ctx.lineTo(gx, chunk.y + chunk.size - 8);
      }
      for (let gy = chunk.y + 100; gy < chunk.y + chunk.size; gy += 100) {
        ctx.moveTo(chunk.x + 8, gy);
        ctx.lineTo(chunk.x + chunk.size - 8, gy);
      }
      ctx.stroke();

      // Glowing doorway threshold markers for wide open N/E/S/W doors
      if (chunk.doors) {
        const midX = chunk.x + chunk.size / 2;
        const midY = chunk.y + chunk.size / 2;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 7]);
        if (chunk.doors.n) {
          ctx.beginPath();
          ctx.moveTo(midX - 78, chunk.y + 3);
          ctx.lineTo(midX + 78, chunk.y + 3);
          ctx.stroke();
        }
        if (chunk.doors.s) {
          ctx.beginPath();
          ctx.moveTo(midX - 78, chunk.y + chunk.size - 3);
          ctx.lineTo(midX + 78, chunk.y + chunk.size - 3);
          ctx.stroke();
        }
        if (chunk.doors.w) {
          ctx.beginPath();
          ctx.moveTo(chunk.x + 3, midY - 78);
          ctx.lineTo(chunk.x + 3, midY + 78);
          ctx.stroke();
        }
        if (chunk.doors.e) {
          ctx.beginPath();
          ctx.moveTo(chunk.x + chunk.size - 3, midY - 78);
          ctx.lineTo(chunk.x + chunk.size - 3, midY + 78);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // Optimal BFS exit guide chevron subtle indicator
      if (chunk.nextDir && !chunk.isFinish) {
        const arrowX =
          chunk.nextDir === 'e'
            ? chunk.x + chunk.size - 36
            : chunk.nextDir === 'w'
            ? chunk.x + 36
            : chunk.x + chunk.size / 2;
        const arrowY =
          chunk.nextDir === 's'
            ? chunk.y + chunk.size - 36
            : chunk.nextDir === 'n'
            ? chunk.y + 36
            : chunk.y + chunk.size / 2;
        const angle =
          chunk.nextDir === 'e' ? 0 : chunk.nextDir === 's' ? Math.PI / 2 : chunk.nextDir === 'w' ? Math.PI : -Math.PI / 2;

        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(angle);
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.38)';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-8, -11);
        ctx.lineTo(5, 0);
        ctx.lineTo(-8, 11);
        ctx.stroke();
        ctx.restore();
      }

      // Compact room header tag
      const labelText = `(${chunk.col + 1},${chunk.row + 1}) · ${chunk.name}${chunk.isDeadEnd ? ' · BOTÍN' : ''}`;
      ctx.font = '800 9.5px Outfit, monospace';
      const tw = ctx.measureText(labelText).width + 14;
      ctx.fillStyle = 'rgba(10, 15, 30, 0.78)';
      ctx.fillRect(chunk.x + 16, chunk.y + 16, tw, 20);
      ctx.strokeStyle = chunk.themeColor ? `${chunk.themeColor}55` : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.strokeRect(chunk.x + 16, chunk.y + 16, tw, 20);
      ctx.fillStyle = chunk.isFinish ? '#86efac' : chunk.isDeadEnd ? '#e9d5ff' : 'rgba(241, 245, 249, 0.75)';
      ctx.textAlign = 'left';
      ctx.fillText(labelText, chunk.x + 23, chunk.y + 30);
    }
    ctx.restore();
  }

  // =========================================================================
  // 1. Sticky Slow Zones (Toxic Amber Sludge)
  // =========================================================================
  if (course.slowZones) {
    for (let i = 0; i < course.slowZones.length; i++) {
      const sz = course.slowZones[i];
      if (sz.x + sz.w < viewMinX || sz.x > viewMaxX || sz.y + sz.h < viewMinY || sz.y > viewMaxY) continue;
      ctx.save();
      ctx.fillStyle = 'rgba(234, 179, 8, 0.14)';
      ctx.fillRect(sz.x, sz.y, sz.w, sz.h);
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(sz.x, sz.y, sz.w, sz.h);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.55)';
      ctx.font = '800 10px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('☣ LODO DENSO', sz.x + sz.w / 2, sz.y + sz.h / 2 + 4);
      ctx.restore();
    }
  }

  // =========================================================================
  // 2. Magnet Zones (Attract / Repel Pulsing Fields)
  // =========================================================================
  if (course.magnetZones) {
    for (let i = 0; i < course.magnetZones.length; i++) {
      const mag = course.magnetZones[i];
      if (mag.x + mag.r < viewMinX || mag.x - mag.r > viewMaxX || mag.y + mag.r < viewMinY || mag.y - mag.r > viewMaxY) continue;
      ctx.save();
      const isPull = mag.force > 0;
      const baseColor = isPull ? '#a855f7' : '#f43f5e';
      const pulse = ((raceTime * (isPull ? -1 : 1) * 0.9) % 1 + 1) % 1;

      ctx.fillStyle = isPull ? 'rgba(168, 85, 247, 0.07)' : 'rgba(244, 63, 94, 0.07)';
      ctx.beginPath();
      ctx.arc(mag.x, mag.y, mag.r, 0, Math.PI * 2);
      ctx.fill();

      for (let ring = 0; ring < 3; ring++) {
        const frac = (pulse + ring / 3) % 1;
        ctx.strokeStyle = isPull
          ? `rgba(192, 132, 252, ${(1 - frac) * 0.45})`
          : `rgba(251, 113, 133, ${(1 - frac) * 0.45})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(mag.x, mag.y, mag.r * (isPull ? 1 - frac : frac), 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = baseColor;
      ctx.font = '800 11px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isPull ? '🧲 IMÁN (+)' : '💥 REPULSOR (-)', mag.x, mag.y - 34);
      ctx.restore();
    }
  }

  // =========================================================================
  // 3. Heal Sanctuary Pads
  // =========================================================================
  if (course.healZones) {
    for (let i = 0; i < course.healZones.length; i++) {
      const hz = course.healZones[i];
      if (hz.x + hz.w < viewMinX || hz.x > viewMaxX || hz.y + hz.h < viewMinY || hz.y > viewMaxY) continue;
      ctx.save();
      const cx = hz.x + hz.w / 2;
      const cy = hz.y + hz.h / 2;
      ctx.fillStyle = 'rgba(34, 197, 94, 0.16)';
      ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      ctx.strokeRect(hz.x, hz.y, hz.w, hz.h);

      // Medical cross
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(cx - 4, cy - 14, 8, 28);
      ctx.fillRect(cx - 14, cy - 4, 28, 8);

      ctx.font = '800 9.5px Outfit, sans-serif';
      ctx.fillStyle = '#bbf7d0';
      ctx.textAlign = 'center';
      ctx.fillText(`+${hz.amount} HP`, cx, hz.y - 6);
      ctx.restore();
    }
  }

  // =========================================================================
  // 4. Crypt Ambush Spawners
  // =========================================================================
  if (course.cryptZones) {
    for (let i = 0; i < course.cryptZones.length; i++) {
      const cz = course.cryptZones[i];
      if (cz.x + cz.w < viewMinX || cz.x > viewMaxX || cz.y + cz.h < viewMinY || cz.y > viewMaxY) continue;
      ctx.save();
      const cx = cz.x + cz.w / 2;
      const cy = cz.y + cz.h / 2;
      ctx.fillStyle = cz.triggered ? 'rgba(30, 41, 59, 0.25)' : 'rgba(147, 51, 234, 0.14)';
      ctx.fillRect(cz.x, cz.y, cz.w, cz.h);
      ctx.strokeStyle = cz.triggered ? 'rgba(100, 116, 139, 0.35)' : 'rgba(192, 132, 252, 0.65)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(cz.x, cz.y, cz.w, cz.h);
      ctx.setLineDash([]);

      ctx.font = '800 11px Outfit, sans-serif';
      ctx.fillStyle = cz.triggered ? '#64748b' : '#e9d5ff';
      ctx.textAlign = 'center';
      ctx.fillText(cz.triggered ? '⚰️ CRIPTA ABIERTA' : `⚰️ CRIPTA (${cz.count} ZOMBIS)`, cx, cy + 4);
      ctx.restore();
    }
  }

  // =========================================================================
  // 5. Spike Strips
  // =========================================================================
  if (course.spikeZones) {
    for (let i = 0; i < course.spikeZones.length; i++) {
      const spk = course.spikeZones[i];
      if (spk.x + spk.w < viewMinX || spk.x > viewMaxX || spk.y + spk.h < viewMinY || spk.y > viewMaxY) continue;
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
      ctx.fillRect(spk.x, spk.y, spk.w, spk.h);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(spk.x, spk.y, spk.w, spk.h);

      const teeth = Math.max(4, Math.floor(spk.w / 16));
      const tw = spk.w / teeth;
      ctx.fillStyle = '#fca5a5';
      for (let t = 0; t < teeth; t++) {
        const tx = spk.x + t * tw;
        ctx.beginPath();
        ctx.moveTo(tx, spk.y + spk.h);
        ctx.lineTo(tx + tw / 2, spk.y + 4);
        ctx.lineTo(tx + tw, spk.y + spk.h);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // =========================================================================
  // 6. Timed Kicker Launch Pads
  // =========================================================================
  if (course.kickerZones) {
    for (let i = 0; i < course.kickerZones.length; i++) {
      const kz = course.kickerZones[i];
      if (kz.x + kz.w < viewMinX || kz.x > viewMaxX || kz.y + kz.h < viewMinY || kz.y > viewMaxY) continue;
      const flashing = (kz.flashUntil ?? 0) > raceTime;
      ctx.save();
      ctx.fillStyle = flashing ? 'rgba(250, 204, 21, 0.55)' : 'rgba(245, 158, 11, 0.2)';
      ctx.fillRect(kz.x, kz.y, kz.w, kz.h);
      ctx.strokeStyle = flashing ? '#fef08a' : '#f59e0b';
      ctx.lineWidth = flashing ? 3 : 2;
      ctx.strokeRect(kz.x, kz.y, kz.w, kz.h);
      ctx.font = '800 10px Outfit, sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText('▲ IMPULSOR', kz.x + kz.w / 2, kz.y + kz.h / 2 + 4);
      ctx.restore();
    }
  }

  // =========================================================================
  // 7. Teleporter Portals
  // =========================================================================
  if (course.portals) {
    for (let i = 0; i < course.portals.length; i++) {
      const tp = course.portals[i];
      const cx = tp.x + tp.w / 2;
      const cy = tp.y + tp.h / 2;
      if (
        Math.max(cx + tp.w, tp.tx + 32) < viewMinX ||
        Math.min(cx - tp.w, tp.tx - 32) > viewMaxX ||
        Math.max(cy + tp.h, tp.ty + 32) < viewMinY ||
        Math.min(cy - tp.h, tp.ty - 32) > viewMaxY
      ) {
        continue;
      }
      const pCol = tp.color || '#a855f7';
      ctx.save();
      // Subtle warp link tether
      ctx.strokeStyle = `${pCol}35`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tp.tx, tp.ty);
      ctx.stroke();
      ctx.setLineDash([]);

      // Entry portal vortex
      const pulse = 1 + 0.12 * Math.sin(raceTime * 6);
      ctx.fillStyle = `${pCol}33`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, (tp.w / 2) * pulse, (tp.h / 2) * pulse, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pCol;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.font = '800 10px Outfit, sans-serif';
      ctx.fillStyle = '#e9d5ff';
      ctx.textAlign = 'center';
      ctx.fillText('🌀 PORTAL', cx, cy + 4);

      // Exit beacon ring
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tp.tx, tp.ty, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // =========================================================================
  // 8. Speed Boosters
  // =========================================================================
  course.boosters.forEach((b) => {
    if (b.x + b.w < viewMinX || b.x > viewMaxX || b.y + b.h < viewMinY || b.y > viewMaxY) return;
    ctx.fillStyle = 'rgba(240, 190, 56, 0.09)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(240, 190, 56, 0.25)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    ctx.save();
    ctx.strokeStyle = 'rgba(240, 190, 56, 0.78)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const gap = 55;
    const offset = (raceTime * 320) % gap;

    if (Math.abs(b.forceX) >= Math.abs(b.forceY)) {
      const midY = b.y + b.h / 2;
      if (b.forceX >= 0) {
        for (let x = b.x + offset; x < b.x + b.w; x += gap) {
          ctx.beginPath();
          ctx.moveTo(x - 14, midY - 12);
          ctx.lineTo(x, midY);
          ctx.lineTo(x - 14, midY + 12);
          ctx.stroke();
        }
      } else {
        for (let x = b.x + b.w - offset; x > b.x; x -= gap) {
          ctx.beginPath();
          ctx.moveTo(x + 14, midY - 12);
          ctx.lineTo(x, midY);
          ctx.lineTo(x + 14, midY + 12);
          ctx.stroke();
        }
      }
    } else {
      const midX = b.x + b.w / 2;
      if (b.forceY < 0) {
        for (let y = b.y + b.h - offset; y > b.y; y -= gap) {
          ctx.beginPath();
          ctx.moveTo(midX - 16, y + 12);
          ctx.lineTo(midX, y);
          ctx.lineTo(midX + 16, y + 12);
          ctx.stroke();
        }
      } else {
        for (let y = b.y + offset; y < b.y + b.h; y += gap) {
          ctx.beginPath();
          ctx.moveTo(midX - 16, y - 12);
          ctx.lineTo(midX, y);
          ctx.lineTo(midX + 16, y - 12);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  });

  // =========================================================================
  // 9. Kinetic Escalators
  // =========================================================================
  course.escalators.forEach((esc) => {
    if (esc.x + esc.w < viewMinX || esc.x > viewMaxX || esc.y + esc.h < viewMinY || esc.y > viewMaxY) return;
    ctx.fillStyle = 'rgba(59, 212, 142, 0.14)';
    ctx.fillRect(esc.x, esc.y, esc.w, esc.h);
    ctx.strokeStyle = 'rgba(59, 212, 142, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(esc.x + 18, esc.y + esc.h - 12);
    ctx.lineTo(esc.x + esc.w - 18, esc.y + 12);
    ctx.stroke();
  });

  // =========================================================================
  // 10. Anti-Gravity Lift Cylinders (North Exit Shafts)
  // =========================================================================
  course.elevators.forEach((el) => {
    if (el.x + el.w < viewMinX || el.x > viewMaxX || el.y + el.h < viewMinY || el.y > viewMaxY) return;
    const cx = el.x + el.w / 2;
    const tubeGrad = ctx.createLinearGradient(el.x, el.y, el.x + el.w, el.y);
    tubeGrad.addColorStop(0, 'rgba(45, 191, 214, 0.14)');
    tubeGrad.addColorStop(0.5, 'rgba(45, 191, 214, 0.04)');
    tubeGrad.addColorStop(1, 'rgba(45, 191, 214, 0.14)');
    ctx.fillStyle = tubeGrad;
    ctx.fillRect(el.x, el.y, el.w, el.h);

    ctx.strokeStyle = 'rgba(45, 191, 214, 0.35)';
    ctx.lineWidth = 2.5;
    for (let ry = el.y + 40; ry <= el.y + el.h; ry += 140) {
      ctx.beginPath();
      ctx.ellipse(cx, ry, el.w / 2 - 6, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const chevronGap = 85;
    const offset = (raceTime * 380) % chevronGap;
    ctx.strokeStyle = 'rgba(45, 191, 214, 0.72)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    for (let y = el.y + el.h - offset; y >= el.y; y -= chevronGap) {
      ctx.beginPath();
      ctx.moveTo(cx - 24, y + 16);
      ctx.lineTo(cx, y);
      ctx.lineTo(cx + 24, y + 16);
      ctx.stroke();
    }
  });

  // =========================================================================
  // 11. Aerodynamic Wind Zones
  // =========================================================================
  if (course.windZones) {
    course.windZones.forEach((w) => {
      if (w.x + w.w < viewMinX || w.x > viewMaxX || w.y + w.h < viewMinY || w.y > viewMaxY) return;
      ctx.save();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.06)';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(w.x, w.y, w.w, w.h);
      ctx.setLineDash([]);

      const streamCount = Math.max(2, Math.floor(Math.min(w.w, w.h) / 48));
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i <= streamCount; i++) {
        const t = i / streamCount;
        let lx1 = w.x + 12;
        let ly1 = w.y + 12 + t * (w.h - 24);
        let lx2 = w.x + w.w - 12;
        let ly2 = ly1;
        if (Math.abs(w.forceY) > Math.abs(w.forceX)) {
          lx1 = w.x + 12 + t * (w.w - 24);
          ly1 = w.y + 12;
          lx2 = lx1;
          ly2 = w.y + w.h - 12;
        }
        ctx.beginPath();
        ctx.moveTo(lx1, ly1);
        ctx.lineTo(lx2, ly2);
        ctx.stroke();

        const pT = (raceTime * 2.2 + i * 0.23) % 1;
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.arc(lx1 + (lx2 - lx1) * pT, ly1 + (ly2 - ly1) * pT, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  // =========================================================================
  // 12. Hydraulic Pistons
  // =========================================================================
  if (course.pistons) {
    course.pistons.forEach((p) => {
      const cycleT = ((raceTime / p.period + p.phase) % 1 + 1) % 1;
      let tg = 0;
      if (p.dutyCycle && p.dutyCycle > 0 && p.dutyCycle < 1) {
        tg = cycleT < p.dutyCycle ? cycleT / p.dutyCycle : (1 - cycleT) / (1 - p.dutyCycle);
      } else {
        tg = 0.5 - 0.5 * Math.cos(2 * Math.PI * (raceTime / p.period + p.phase));
      }
      const curX = p.x + p.dx * tg;
      const curY = p.y + p.dy * tg;

      if (
        Math.max(p.x, curX) + p.w < viewMinX ||
        Math.min(p.x, curX) > viewMaxX ||
        Math.max(p.y, curY) + p.h < viewMinY ||
        Math.min(p.y, curY) > viewMaxY
      ) {
        return;
      }

      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.fillRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4);
      ctx.strokeRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = Math.min(p.w, p.h) * 0.42;
      ctx.beginPath();
      ctx.moveTo(p.x + p.w / 2, p.y + p.h / 2);
      ctx.lineTo(curX + p.w / 2, curY + p.h / 2);
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(curX, curY, p.w, p.h);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.strokeRect(curX, curY, p.w, p.h);
      ctx.restore();
    });
  }

  // =========================================================================
  // 13. Swinging Pendulums
  // =========================================================================
  if (course.pendulums) {
    course.pendulums.forEach((pend) => {
      const ang = pend.maxAngle * Math.sin(2 * Math.PI * (raceTime / pend.period + pend.phase));
      const bx = pend.pivotX + Math.sin(ang) * pend.length;
      const by = pend.pivotY + Math.cos(ang) * pend.length;
      if (
        Math.max(pend.pivotX, bx) + pend.bobRadius < viewMinX ||
        Math.min(pend.pivotX, bx) - pend.bobRadius > viewMaxX ||
        Math.max(pend.pivotY, by) + pend.bobRadius < viewMinY ||
        Math.min(pend.pivotY, by) - pend.bobRadius > viewMaxY
      ) {
        return;
      }

      ctx.save();
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pend.pivotX, pend.pivotY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pend.pivotX, pend.pivotY);
      ctx.lineTo(bx, by);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(bx, by, pend.bobRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = pend.color || '#ef4444';
      ctx.beginPath();
      ctx.arc(bx, by, pend.bobRadius * 0.72, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // =========================================================================
  // 14. Tactical Pickup Crates (All Weapons, Repairs, Shields, EMP)
  // =========================================================================
  if (course.crates) {
    course.crates.forEach((crate) => {
      if (crate.x + 30 < viewMinX || crate.x - 30 > viewMaxX || crate.y + 30 < viewMinY || crate.y - 30 > viewMaxY) {
        return;
      }
      ctx.save();
      const crateSize = 24;
      if (crate.active) {
        const hoverY = crate.y + Math.sin(raceTime * 4 + crate.x) * 3;
        const spin = raceTime * 2.2;

        let color = '#38bdf8';
        let icon = '⚡';
        if (crate.type === 'turbo') {
          color = '#f59e0b';
          icon = '⏩';
        } else if (crate.type === 'shield') {
          color = '#10b981';
          icon = '🛡️';
        } else if (crate.type === 'repair') {
          color = '#ef4444';
          icon = '❤️';
        } else if (crate.type === 'weapon_swap') {
          color = '#c084fc';
          icon = '🔄';
        } else if (crate.type in WEAPON_SPECS) {
          const spec = WEAPON_SPECS[crate.type as keyof typeof WEAPON_SPECS];
          color = spec.color;
          icon = spec.icon;
        }

        ctx.fillStyle = `${color}33`;
        ctx.beginPath();
        ctx.arc(crate.x, hoverY, crateSize * 1.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.translate(crate.x, hoverY);
        ctx.rotate(Math.sin(spin) * 0.14);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-crateSize / 2, -crateSize / 2, crateSize, crateSize);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(-crateSize / 2, -crateSize / 2, crateSize, crateSize);

        ctx.font = '12px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, 0, 1);
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(crate.x - crateSize / 2, crate.y - crateSize / 2, crateSize, crateSize);
        ctx.setLineDash([]);
      }
      ctx.restore();
    });
  }

  // =========================================================================
  // 15. Labyrinth Walls (Dual-Layer Neon Containment Rails)
  // =========================================================================
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < course.walls.length; i++) {
    const w = course.walls[i];
    if (
      Math.max(w.x1, w.x2) < viewMinX ||
      Math.min(w.x1, w.x2) > viewMaxX ||
      Math.max(w.y1, w.y2) < viewMinY ||
      Math.min(w.y1, w.y2) > viewMaxY
    ) {
      continue;
    }

    const isGuide = w.kind === 'guide';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = isGuide ? 12 : 20;
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();

    ctx.strokeStyle = isGuide ? '#334155' : '#1e293b';
    ctx.lineWidth = isGuide ? 7 : 13;
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();

    ctx.strokeStyle = w.color || '#38bdf8';
    ctx.lineWidth = isGuide ? 2.2 : 3.5;
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.stroke();
  }

  // =========================================================================
  // 16. Pinball Bumpers
  // =========================================================================
  course.bumpers.forEach((b) => {
    if (b.x + b.r < viewMinX || b.x - b.r > viewMaxX || b.y + b.r < viewMinY || b.y - b.r > viewMaxY) return;
    ctx.fillStyle = `${b.color}26`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.86, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  });

  // =========================================================================
  // 17. Spinners
  // =========================================================================
  course.spinners.forEach((s) => {
    if (s.x + s.r < viewMinX || s.x - s.r > viewMaxX || s.y + s.r < viewMinY || s.y - s.r > viewMaxY) return;
    const bladeColor = s.color || '#ed7e38';
    ctx.strokeStyle = `${bladeColor}22`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.stroke();

    for (let a = 0; a < s.arms; a++) {
      const ang = s.angle + (a * 2 * Math.PI) / s.arms;
      const tipX = s.x + Math.cos(ang) * s.r;
      const tipY = s.y + Math.sin(ang) * s.r;
      ctx.strokeStyle = bladeColor;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0be38';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
    ctx.fill();
  });

  // =========================================================================
  // 18. Extraction Bunker (Finish Room 25)
  // =========================================================================
  const fx = course.finishX;
  const fy = course.finishY;
  if (fx + 200 >= viewMinX && fx - 200 <= viewMaxX && fy + 200 >= viewMinY && fy - 200 <= viewMaxY) {
    ctx.save();
    const pulseR = 115 + Math.sin(raceTime * 3) * 6;
    ctx.fillStyle = 'rgba(34, 197, 94, 0.14)';
    ctx.beginPath();
    ctx.arc(fx, fy, pulseR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    ctx.arc(fx, fy, 115, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '900 13px Outfit, system-ui, sans-serif';
    ctx.fillStyle = '#86efac';
    ctx.textAlign = 'center';
    ctx.fillText('🏁 BÚNKER DE EXTRACCIÓN 🏁', fx, fy - 36);
    ctx.restore();
  }

  // =========================================================================
  // 19. Render Marbles (Living Survivors & Zombie Classes)
  // =========================================================================
  for (let i = 0; i < marbles.length; i++) {
    const m = marbles[i];
    if (m.gone) continue;

    const drawX = m.renderX ?? m.x;
    const drawY = m.renderY ?? m.y;
    if (drawX + 60 < viewMinX || drawX - 60 > viewMaxX || drawY + 60 < viewMinY || drawY - 60 > viewMaxY) {
      continue;
    }

    const isFollowed = options.followedMarbleId === m.id;

    // Followed Marble Target Halo
    if (isFollowed) {
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(raceTime * 1.8);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, m.radius + 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Zombie Aura / Boss Crown / Extracted Halo
    if (m.isZombie) {
      const zSpec = ZOMBIE_SPECS[m.zombieType || 'walker'];
      ctx.save();
      const pulse = Math.sin(raceTime * 8 + drawX * 0.05) * 2.5;
      ctx.fillStyle = m.zombieType === 'boss' ? 'rgba(168, 85, 247, 0.32)' : 'rgba(34, 197, 94, 0.25)';
      ctx.beginPath();
      ctx.arc(drawX, drawY, m.radius + 5 + pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = zSpec.border;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let a = 0; a < 6; a++) {
        const ang = (a * Math.PI) / 3 + raceTime * 3;
        ctx.moveTo(drawX + Math.cos(ang) * (m.radius + 3), drawY + Math.sin(ang) * (m.radius + 3));
        ctx.lineTo(drawX + Math.cos(ang) * (m.radius + 8 + pulse), drawY + Math.sin(ang) * (m.radius + 8 + pulse));
      }
      ctx.stroke();
      ctx.restore();
    } else if (m.isExtracted) {
      ctx.save();
      ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.beginPath();
      ctx.arc(drawX, drawY, m.radius + 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Turbo Flame
    if ((m.turboTime && m.turboTime > raceTime) || (m.boostUntil && m.boostUntil > raceTime)) {
      ctx.save();
      const spd = Math.hypot(m.vx, m.vy) || 1;
      const backX = drawX - (m.vx / spd) * (m.radius + 6);
      const backY = drawY - (m.vy / spd) * (m.radius + 6);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(backX, backY, 6 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Drop-shadow
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#05070f';
    ctx.beginPath();
    ctx.arc(drawX + 2.5, drawY + 4, m.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(drawX, drawY);

    const zSpec = m.isZombie ? ZOMBIE_SPECS[m.zombieType || 'walker'] : null;
    ctx.fillStyle = zSpec ? zSpec.color : m.color;
    ctx.beginPath();
    ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
    ctx.fill();

    // Rotating swirl ribbon
    const rollAngle = m.renderAngle ?? m.angle ?? 0;
    ctx.save();
    ctx.rotate(rollAngle);
    ctx.strokeStyle = m.isZombie ? 'rgba(217, 249, 157, 0.38)' : 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, m.radius * 0.56, 0.4, Math.PI - 0.4);
    ctx.stroke();
    ctx.restore();

    if (m.border || zSpec) {
      ctx.strokeStyle = zSpec ? zSpec.border : m.border!;
      ctx.lineWidth = m.zombieType === 'tank' || m.zombieType === 'boss' ? 2.5 : 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Specular highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.beginPath();
    ctx.arc(-m.radius * 0.32, -m.radius * 0.32, m.radius * 0.36, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const lookAngle = Math.atan2(m.vy, m.vx);
    const pupilX = Math.cos(lookAngle) * 1.5;
    const pupilY = Math.sin(lookAngle) * 1.5;
    ctx.fillStyle = m.isZombie ? '#fef08a' : '#ffffff';
    ctx.beginPath();
    ctx.arc(-4, -1, 3, 0, Math.PI * 2);
    ctx.arc(4, -1, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = m.zombieType === 'boss' ? '#a855f7' : m.isZombie ? '#dc2626' : '#0f172a';
    ctx.beginPath();
    ctx.arc(-4 + pupilX, -1 + pupilY, 1.5, 0, Math.PI * 2);
    ctx.arc(4 + pupilX, -1 + pupilY, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Mounted Weapon Barrel (or Sword/Bat) for Living Survivors
    if (!m.isZombie && !m.finished) {
      const wSpec = WEAPON_SPECS[m.weaponType || 'blaster'] || WEAPON_SPECS.blaster;
      const aim = m.aimAngle ?? lookAngle;
      const barrelLen = wSpec.isMelee ? 10 : 7.5;
      const bx = Math.cos(aim) * (m.radius - 2);
      const by = Math.sin(aim) * (m.radius - 2);
      const tx = Math.cos(aim) * (m.radius + barrelLen);
      const ty = Math.sin(aim) * (m.radius + barrelLen);

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      ctx.strokeStyle = wSpec.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }

    // Forcefield Shield
    if (!m.isZombie && (m.shield > 0 || (m.shieldUntil || 0) > raceTime)) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, m.radius + 4.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.fill();
    }

    // Overhead HP Bars
    if (!m.finished) {
      if (m.isZombie) {
        const maxZ = m.maxZhp || 4;
        const curZ = Math.max(0, m.zhp ?? maxZ);
        if (curZ < maxZ || m.zombieType === 'tank' || m.zombieType === 'boss') {
          const barW = Math.max(24, m.radius * 1.8);
          const barY = -m.radius - 11;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.fillRect(-barW / 2, barY, barW, 3.5);
          ctx.fillStyle = m.zombieType === 'boss' ? '#c084fc' : '#84cc16';
          ctx.fillRect(-barW / 2, barY, barW * Math.min(1, curZ / maxZ), 3.5);
        }
      } else {
        const pipW = 4.2;
        const pipH = 3.2;
        const pipGap = 1.2;
        const totalW = 5 * pipW + 4 * pipGap;
        const startX = -totalW / 2;
        const startY = -m.radius - 12;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(startX - 1.5, startY - 1.5, totalW + 3, pipH + 3);
        const currentHp = Math.max(0, Math.min(5, m.hp));
        for (let p = 0; p < 5; p++) {
          const px = startX + p * (pipW + pipGap);
          ctx.fillStyle = p < currentHp ? (currentHp > 2 ? '#38bdf8' : currentHp === 2 ? '#f59e0b' : '#ef4444') : 'rgba(239, 68, 68, 0.2)';
          ctx.fillRect(px, startY, pipW, pipH);
        }
      }
    }

    // Name Tag (Skip noisy labels for regular NPC walkers unless boss/tank or player marble)
    const isNpc = m.id.startsWith('npc_');
    if (!isNpc || m.zombieType === 'boss' || m.zombieType === 'tank' || isFollowed) {
      ctx.font = '700 10.5px Plus Jakarta Sans, system-ui, sans-serif';
      ctx.textAlign = 'center';
      let tag = m.name;
      if (m.isExtracted) tag = `🛡️ ${m.name}`;
      else if (m.zombieType === 'boss') tag = `👑 JEFE ALFA`;
      else if (m.isZombie) tag = `☣ ${m.name}`;
      else if (isFollowed) tag = `🎯 ${m.name}`;
      else if (m.rank === 1) tag = `👑 ${m.name}`;

      ctx.strokeStyle = '#090b12';
      ctx.lineWidth = 3;
      ctx.strokeText(tag, 0, -m.radius - 17);
      ctx.fillStyle = m.zombieType === 'boss' ? '#e9d5ff' : m.isZombie ? '#86efac' : m.isExtracted ? '#fef08a' : '#ffffff';
      ctx.fillText(tag, 0, -m.radius - 17);
    }

    ctx.restore();
  }

  // =========================================================================
  // 20. Projectiles & Melee Slash Arcs
  // =========================================================================
  for (let i = 0; i < projectiles.length; i++) {
    const p = projectiles[i];
    if (p.x < viewMinX || p.x > viewMaxX || p.y < viewMinY || p.y > viewMaxY) continue;
    ctx.save();
    if (p.isMelee && p.x1 !== undefined && p.y1 !== undefined) {
      ctx.strokeStyle = p.color || '#facc15';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    } else {
      const pSpeed = Math.hypot(p.vx, p.vy) || 1;
      const tailX = p.x - (p.vx / pSpeed) * 14;
      const tailY = p.y - (p.vy / pSpeed) * 14;
      ctx.strokeStyle = p.color || '#38bdf8';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // =========================================================================
  // 21. Temporary Holographic Barricades
  // =========================================================================
  barricades.forEach((bar) => {
    if (bar.x + bar.w < viewMinX || bar.x - bar.w > viewMaxX || bar.y + bar.h < viewMinY || bar.y - bar.h > viewMaxY) {
      return;
    }
    ctx.save();
    ctx.translate(bar.x, bar.y);
    const pulse = 0.7 + 0.3 * Math.sin(raceTime * 10);
    ctx.fillStyle = `rgba(6, 182, 212, ${0.2 * pulse})`;
    ctx.fillRect(-bar.w / 2, -bar.h / 2, bar.w, bar.h);
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.9 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-bar.w / 2, -bar.h / 2, bar.w, bar.h);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.fillRect(-45, -bar.h / 2 - 18, 90, 15);
    ctx.font = '800 9.5px Outfit, monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText(`🛡️ ${bar.lifetime.toFixed(1)}s`, 0, -bar.h / 2 - 7);
    ctx.restore();
  });

  // =========================================================================
  // 22. Combat Particles & Floating Text
  // =========================================================================
  if (showParticles) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.x < viewMinX || p.x > viewMaxX || p.y < viewMinY || p.y > viewMaxY) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha * (p.lifetime / p.maxLifetime)));
      const pRad = p.radius ?? p.size ?? 2.5;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1, pRad), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  for (let i = 0; i < floatingTexts.length; i++) {
    const ft = floatingTexts[i];
    if (ft.x < viewMinX || ft.x > viewMaxX || ft.y < viewMinY || ft.y > viewMaxY) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, ft.alpha));
    ctx.font = `900 ${ft.size || 11}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#05070f';
    ctx.lineWidth = 3.5;
    ctx.strokeText(ft.text, ft.x, ft.y);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }

  // Dramatic Focus Shockwave Ring in world space
  if (options.focusFx) {
    const ffx = options.focusFx;
    const rad = 28 + ffx.progress * 70;
    ctx.save();
    ctx.strokeStyle = ffx.color;
    ctx.globalAlpha = Math.max(0, 1 - ffx.progress);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(ffx.x, ffx.y, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore(); // Exit world space to screen space

  // =========================================================================
  // 23. Screen-Space Dramatic Focus Radial Vignette & Banner
  // =========================================================================
  if (options.focusFx) {
    const ffx = options.focusFx;
    const sx = (ffx.x - camCenterX) * camZoom + virtualW / 2;
    const sy = (ffx.y - camCenterY) * camZoom + virtualH / 2;
    ctx.save();
    const grad = ctx.createRadialGradient(sx, sy, 65, sx, sy, Math.max(virtualW, virtualH) * 0.55);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0.52)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, virtualW, virtualH);

    ctx.font = '900 18px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 5;
    ctx.strokeText(ffx.text, virtualW / 2, 108);
    ctx.fillStyle = ffx.color;
    ctx.fillText(ffx.text, virtualW / 2, 108);
    ctx.restore();
  }

  // =========================================================================
  // 24. Screen-Space Damage Vignette Flash (Followed Marble Hit)
  // =========================================================================
  if (options.damageFlashAlpha && options.damageFlashAlpha > 0.01) {
    ctx.save();
    const dGrad = ctx.createRadialGradient(
      virtualW / 2,
      virtualH / 2,
      virtualH * 0.25,
      virtualW / 2,
      virtualH / 2,
      Math.max(virtualW, virtualH) * 0.65
    );
    dGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
    dGrad.addColorStop(1, `rgba(220, 38, 38, ${Math.min(0.65, options.damageFlashAlpha)})`);
    ctx.fillStyle = dGrad;
    ctx.fillRect(0, 0, virtualW, virtualH);
    ctx.restore();
  }

  // =========================================================================
  // 25. Screen-Space Tactical Combat Event Feed
  // =========================================================================
  if (combatFeed && combatFeed.length > 0) {
    ctx.save();
    const feedW = 240;
    const feedX = virtualW - feedW - 14;
    let feedY = 64;

    const recentEvents = combatFeed.slice(0, 4);
    recentEvents.forEach((ev) => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      ctx.fillRect(feedX, feedY, feedW, 20);
      ctx.fillStyle = ev.color || '#38bdf8';
      ctx.fillRect(feedX, feedY, 3, 20);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(feedX, feedY, feedW, 20);

      ctx.font = '700 10px Outfit, sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText((ev.text || '').slice(0, 36), feedX + 9, feedY + 10);

      feedY += 23;
    });
    ctx.restore();
  }
}
