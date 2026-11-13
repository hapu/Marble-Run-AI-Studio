import { CourseData } from '../types';
import { WEAPON_SPECS } from '../constants';
import { ViewBounds } from './types';

function inBox(x: number, y: number, w: number, h: number, view: ViewBounds): boolean {
  return x + w >= view.minX && x <= view.maxX && y + h >= view.minY && y <= view.maxY;
}

export function renderLabyrinthGrid(
  ctx: CanvasRenderingContext2D,
  course: CourseData,
  view: ViewBounds
): void {
  if (!course.chunks || course.chunks.length === 0) return;

  ctx.save();
  for (let c = 0; c < course.chunks.length; c++) {
    const chunk = course.chunks[c];
    if (!inBox(chunk.x, chunk.y, chunk.size, chunk.size, view)) continue;

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
        chunk.nextDir === 'e'
          ? 0
          : chunk.nextDir === 's'
            ? Math.PI / 2
            : chunk.nextDir === 'w'
              ? Math.PI
              : -Math.PI / 2;

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

export function renderZonesAndHazards(
  ctx: CanvasRenderingContext2D,
  course: CourseData,
  raceTime: number,
  view: ViewBounds
): void {
  // 1. Sticky Slow Zones
  for (let i = 0; i < course.slowZones.length; i++) {
    const sz = course.slowZones[i];
    if (!inBox(sz.x, sz.y, sz.w, sz.h, view)) continue;
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

  // 2. Magnet Zones
  for (let i = 0; i < course.magnetZones.length; i++) {
    const mag = course.magnetZones[i];
    if (
      mag.x + mag.r < view.minX ||
      mag.x - mag.r > view.maxX ||
      mag.y + mag.r < view.minY ||
      mag.y - mag.r > view.maxY
    ) {
      continue;
    }
    ctx.save();
    const isPull = mag.force > 0;
    const baseColor = isPull ? '#a855f7' : '#f43f5e';
    const pulse = (((raceTime * (isPull ? -1 : 1) * 0.9) % 1) + 1) % 1;

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

  // 3. Heal Sanctuary Pads
  for (let i = 0; i < course.healZones.length; i++) {
    const hz = course.healZones[i];
    if (!inBox(hz.x, hz.y, hz.w, hz.h, view)) continue;
    ctx.save();
    const cx = hz.x + hz.w / 2;
    const cy = hz.y + hz.h / 2;
    ctx.fillStyle = 'rgba(34, 197, 94, 0.16)';
    ctx.fillRect(hz.x, hz.y, hz.w, hz.h);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.strokeRect(hz.x, hz.y, hz.w, hz.h);

    ctx.fillStyle = '#4ade80';
    ctx.fillRect(cx - 4, cy - 14, 8, 28);
    ctx.fillRect(cx - 14, cy - 4, 28, 8);

    ctx.font = '800 9.5px Outfit, sans-serif';
    ctx.fillStyle = '#bbf7d0';
    ctx.textAlign = 'center';
    ctx.fillText(`+${hz.amount} HP`, cx, hz.y - 6);
    ctx.restore();
  }

  // 4. Crypt Ambush Spawners
  for (let i = 0; i < course.cryptZones.length; i++) {
    const cz = course.cryptZones[i];
    if (!inBox(cz.x, cz.y, cz.w, cz.h, view)) continue;
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

  // 5. Spike Strips
  for (let i = 0; i < course.spikeZones.length; i++) {
    const spk = course.spikeZones[i];
    if (!inBox(spk.x, spk.y, spk.w, spk.h, view)) continue;
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

  // 6. Timed Kicker Launch Pads
  for (let i = 0; i < course.kickerZones.length; i++) {
    const kz = course.kickerZones[i];
    if (!inBox(kz.x, kz.y, kz.w, kz.h, view)) continue;
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

  // 7. Teleporter Portals
  for (let i = 0; i < course.portals.length; i++) {
    const tp = course.portals[i];
    const cx = tp.x + tp.w / 2;
    const cy = tp.y + tp.h / 2;
    if (
      Math.max(cx + tp.w, tp.tx + 32) < view.minX ||
      Math.min(cx - tp.w, tp.tx - 32) > view.maxX ||
      Math.max(cy + tp.h, tp.ty + 32) < view.minY ||
      Math.min(cy - tp.h, tp.ty - 32) > view.maxY
    ) {
      continue;
    }
    const pCol = tp.color || '#a855f7';
    ctx.save();
    ctx.strokeStyle = `${pCol}35`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tp.tx, tp.ty);
    ctx.stroke();
    ctx.setLineDash([]);

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

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tp.tx, tp.ty, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 8. Speed Boosters
  for (let i = 0; i < course.boosters.length; i++) {
    const b = course.boosters[i];
    if (!inBox(b.x, b.y, b.w, b.h, view)) continue;
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
  }

  // 9. Anti-Gravity Lift Cylinders
  for (let i = 0; i < course.elevators.length; i++) {
    const el = course.elevators[i];
    if (!inBox(el.x, el.y, el.w, el.h, view)) continue;
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
  }

  // 10. Aerodynamic Wind Zones
  for (let i = 0; i < course.windZones.length; i++) {
    const w = course.windZones[i];
    if (!inBox(w.x, w.y, w.w, w.h, view)) continue;
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
    for (let s = 0; s <= streamCount; s++) {
      const t = s / streamCount;
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

      const pT = (raceTime * 2.2 + s * 0.23) % 1;
      ctx.fillStyle = '#bae6fd';
      ctx.beginPath();
      ctx.arc(lx1 + (lx2 - lx1) * pT, ly1 + (ly2 - ly1) * pT, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 11. Hydraulic Pistons
  for (let i = 0; i < course.pistons.length; i++) {
    const p = course.pistons[i];
    const cycleT = (((raceTime / p.period + p.phase) % 1) + 1) % 1;
    const tg =
      p.dutyCycle && p.dutyCycle > 0 && p.dutyCycle < 1
        ? cycleT < p.dutyCycle
          ? cycleT / p.dutyCycle
          : (1 - cycleT) / (1 - p.dutyCycle)
        : 0.5 - 0.5 * Math.cos(2 * Math.PI * (raceTime / p.period + p.phase));
    const curX = p.x + p.dx * tg;
    const curY = p.y + p.dy * tg;

    if (
      Math.max(p.x, curX) + p.w < view.minX ||
      Math.min(p.x, curX) > view.maxX ||
      Math.max(p.y, curY) + p.h < view.minY ||
      Math.min(p.y, curY) > view.maxY
    ) {
      continue;
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
  }

  // 12. Swinging Pendulums
  for (let i = 0; i < course.pendulums.length; i++) {
    const pend = course.pendulums[i];
    const ang = pend.maxAngle * Math.sin(2 * Math.PI * (raceTime / pend.period + pend.phase));
    const bx = pend.pivotX + Math.sin(ang) * pend.length;
    const by = pend.pivotY + Math.cos(ang) * pend.length;
    if (
      Math.max(pend.pivotX, bx) + pend.bobRadius < view.minX ||
      Math.min(pend.pivotX, bx) - pend.bobRadius > view.maxX ||
      Math.max(pend.pivotY, by) + pend.bobRadius < view.minY ||
      Math.min(pend.pivotY, by) - pend.bobRadius > view.maxY
    ) {
      continue;
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
  }

  // 13. Tactical Pickup Crates
  for (let i = 0; i < course.crates.length; i++) {
    const crate = course.crates[i];
    if (
      crate.x + 30 < view.minX ||
      crate.x - 30 > view.maxX ||
      crate.y + 30 < view.minY ||
      crate.y - 30 > view.maxY
    ) {
      continue;
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
  }
}

export function renderWallsBumpersSpinners(
  ctx: CanvasRenderingContext2D,
  course: CourseData,
  raceTime: number,
  view: ViewBounds
): void {
  // Walls
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < course.walls.length; i++) {
    const w = course.walls[i];
    if (
      Math.max(w.x1, w.x2) < view.minX ||
      Math.min(w.x1, w.x2) > view.maxX ||
      Math.max(w.y1, w.y2) < view.minY ||
      Math.min(w.y1, w.y2) > view.maxY
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

  // Pinball Bumpers
  for (let i = 0; i < course.bumpers.length; i++) {
    const b = course.bumpers[i];
    if (b.x + b.r < view.minX || b.x - b.r > view.maxX || b.y + b.r < view.minY || b.y - b.r > view.maxY) {
      continue;
    }
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
  }

  // Spinners
  for (let i = 0; i < course.spinners.length; i++) {
    const s = course.spinners[i];
    if (s.x + s.r < view.minX || s.x - s.r > view.maxX || s.y + s.r < view.minY || s.y - s.r > view.maxY) {
      continue;
    }
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
  }

  // Extraction Bunker
  const fx = course.finishX;
  const fy = course.finishY;
  if (fx + 200 >= view.minX && fx - 200 <= view.maxX && fy + 200 >= view.minY && fy - 200 <= view.maxY) {
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
}
