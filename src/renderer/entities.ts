import {
  CombatEvent,
  CombatParticle,
  CourseData,
  FloatingText,
  Marble,
  Projectile,
  TemporaryBarricade,
  WeaponType,
} from '../types';
import { ROOM_SIZE, WEAPON_SPECS, ZOMBIE_SPECS } from '../constants';
import { RenderOptions, ViewBounds } from './types';

function drawMotionTrail(
  ctx: CanvasRenderingContext2D,
  m: Marble,
  drawX: number,
  drawY: number,
  raceTime: number
): void {
  if (!m.trail || m.trail.length < 2) return;
  const isBoosted = (m.turboTime && m.turboTime > raceTime) || (m.boostUntil && m.boostUntil > raceTime);
  const trailColor = m.isZombie
    ? m.aggroState === 'alert'
      ? '#f43f5e'
      : '#84cc16'
    : isBoosted
      ? '#fbbf24'
      : m.color;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const len = m.trail.length;
  for (let i = 1; i < len; i++) {
    const p0 = m.trail[i - 1];
    const p1 = i === len - 1 ? { x: drawX, y: drawY } : m.trail[i];
    const frac = i / len;
    ctx.globalAlpha = frac * (isBoosted ? 0.55 : 0.28);
    ctx.strokeStyle = trailColor;
    ctx.lineWidth = Math.max(1.2, m.radius * (isBoosted ? 0.9 : 0.6) * frac);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function renderMarbles(
  ctx: CanvasRenderingContext2D,
  marbles: Marble[],
  raceTime: number,
  view: ViewBounds,
  followedMarbleId?: string | null,
  hoveredMarbleId?: string | null,
  course?: CourseData,
  nameplateRevealId?: string | null,
  nameplateRevealAlpha = 0
): void {
  const marbleMap = new Map<string, Marble>();
  for (let i = 0; i < marbles.length; i++) {
    marbleMap.set(marbles[i].id, marbles[i]);
  }

  for (let i = 0; i < marbles.length; i++) {
    const m = marbles[i];
    if (m.gone) continue;

    const drawX = m.renderX ?? m.x;
    const drawY = m.renderY ?? m.y;
    if (
      drawX + 70 < view.minX ||
      drawX - 70 > view.maxX ||
      drawY + 70 < view.minY ||
      drawY - 70 > view.maxY
    ) {
      continue;
    }

    const isFollowed = followedMarbleId === m.id;
    const isHovered = hoveredMarbleId === m.id;

    // 1. Crisp Neon Motion Trail
    drawMotionTrail(ctx, m, drawX, drawY, raceTime);

    // 2. Zombie Aggro Tether & Pulsing Aggro Ring
    if (m.isZombie) {
      const isAlert = m.aggroState === 'alert';
      const zSpec = ZOMBIE_SPECS[m.zombieType || 'walker'];

      if (isAlert && m.aggroTargetId) {
        const tgt = marbleMap.get(m.aggroTargetId);
        if (tgt && !tgt.gone && !tgt.finished && !tgt.isZombie) {
          ctx.save();
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.24)';
          ctx.lineWidth = 1.4;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.moveTo(drawX, drawY);
          ctx.lineTo(tgt.renderX ?? tgt.x, tgt.renderY ?? tgt.y);
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.save();
      const pulse = Math.sin(raceTime * (isAlert ? 11 : 4.5) + drawX * 0.04) * (isAlert ? 3 : 1.5);
      if (isAlert) {
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.72)';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(drawX, drawY, m.radius + 6 + pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle =
        m.zombieType === 'boss'
          ? 'rgba(168, 85, 247, 0.28)'
          : isAlert
            ? 'rgba(244, 63, 94, 0.16)'
            : 'rgba(34, 197, 94, 0.18)';
      ctx.beginPath();
      ctx.arc(drawX, drawY, m.radius + 4 + pulse * 0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isAlert ? '#fb7185' : zSpec.border;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let a = 0; a < 6; a++) {
        const ang = (a * Math.PI) / 3 + raceTime * (isAlert ? 4.2 : 2.2);
        ctx.moveTo(drawX + Math.cos(ang) * (m.radius + 2), drawY + Math.sin(ang) * (m.radius + 2));
        ctx.lineTo(
          drawX + Math.cos(ang) * (m.radius + 7 + pulse * 0.6),
          drawY + Math.sin(ang) * (m.radius + 7 + pulse * 0.6)
        );
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

    // 3. Follow / Hover Target Ring + Exit Path Compass
    if (isFollowed || isHovered) {
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(raceTime * 1.8);
      ctx.strokeStyle = isFollowed ? '#ffffff' : '#38bdf8';
      ctx.lineWidth = isFollowed ? 2.2 : 1.6;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, m.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      if (isFollowed && !m.finished && !m.isZombie && course && m.currentRoomId !== undefined) {
        const rm = course.chunks[m.currentRoomId];
        if (rm && rm.nextDir) {
          const ex =
            rm.nextDir === 'e'
              ? rm.x + ROOM_SIZE - 16
              : rm.nextDir === 'w'
                ? rm.x + 16
                : rm.x + ROOM_SIZE / 2;
          const ey =
            rm.nextDir === 's'
              ? rm.y + ROOM_SIZE - 16
              : rm.nextDir === 'n'
                ? rm.y + 16
                : rm.y + ROOM_SIZE / 2;
          const navAng = Math.atan2(ey - drawY, ex - drawX);
          const orbitR = m.radius + 19;
          ctx.save();
          ctx.translate(drawX + Math.cos(navAng) * orbitR, drawY + Math.sin(navAng) * orbitR);
          ctx.rotate(navAng);
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.moveTo(6, 0);
          ctx.lineTo(-4, -4);
          ctx.lineTo(-2, 0);
          ctx.lineTo(-4, 4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // Drop Shadow
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#05070f';
    ctx.beginPath();
    ctx.arc(drawX + 2.5, drawY + 4, m.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Marble Body
    ctx.save();
    ctx.translate(drawX, drawY);

    const zSpec = m.isZombie ? ZOMBIE_SPECS[m.zombieType || 'walker'] : null;
    ctx.fillStyle = zSpec ? zSpec.color : m.color;
    ctx.beginPath();
    ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
    ctx.fill();

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

    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.beginPath();
    ctx.arc(-m.radius * 0.32, -m.radius * 0.32, m.radius * 0.36, 0, Math.PI * 2);
    ctx.fill();

    const lookAngle = Math.atan2(m.vy, m.vx);
    const pupilX = Math.cos(lookAngle) * 1.5;
    const pupilY = Math.sin(lookAngle) * 1.5;
    ctx.fillStyle = m.isZombie ? (m.aggroState === 'alert' ? '#fecdd3' : '#fef08a') : '#ffffff';
    ctx.beginPath();
    ctx.arc(-4, -1, 3, 0, Math.PI * 2);
    ctx.arc(4, -1, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle =
      m.zombieType === 'boss'
        ? '#a855f7'
        : m.isZombie
          ? m.aggroState === 'alert'
            ? '#e11d48'
            : '#dc2626'
          : '#0f172a';
    ctx.beginPath();
    ctx.arc(-4 + pupilX, -1 + pupilY, 1.5, 0, Math.PI * 2);
    ctx.arc(4 + pupilX, -1 + pupilY, 1.5, 0, Math.PI * 2);
    ctx.fill();

    if (!m.isZombie && !m.finished) {
      const wSpec = WEAPON_SPECS[(m.weaponType || 'blaster') as WeaponType] || WEAPON_SPECS.blaster;
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

    if (!m.isZombie && (m.shield > 0 || (m.shieldUntil || 0) > raceTime)) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.9)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, m.radius + 4.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.fill();
    }

    // Crisp Aggro "!" Alert Sigil on Newly Alerted Zombies
    if (m.isZombie && m.aggroState === 'alert' && m.aggroAlertAt !== undefined) {
      const age = raceTime - m.aggroAlertAt;
      if (age >= 0 && age < 0.95) {
        const popScale = age < 0.15 ? 0.7 + (age / 0.15) * 0.45 : 1.0;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age - 0.55) / 0.4);
        ctx.translate(0, -m.radius - 16 - age * 8);
        ctx.scale(popScale, popScale);
        ctx.font = '900 13px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#090b12';
        ctx.lineWidth = 3.5;
        ctx.strokeText('!', 0, 0);
        ctx.fillStyle = '#fb7185';
        ctx.fillText('!', 0, 0);
        ctx.restore();
      }
    }

    // Intuitive Radial Health Disk / Ring (Zero numeric bars)
    const showHealthDisk =
      !m.finished &&
      (isFollowed ||
        isHovered ||
        m.zombieType === 'boss' ||
        m.zombieType === 'tank' ||
        (!m.isZombie && m.hp < m.maxHp) ||
        (m.isZombie && (m.zhp ?? 4) < (m.maxZhp ?? 4)));

    if (showHealthDisk) {
      ctx.save();
      if (m.isZombie) {
        const maxZ = Math.max(1, m.maxZhp || 4);
        const curZ = Math.max(0, m.zhp ?? maxZ);
        const ratio = Math.min(1, curZ / maxZ);
        const diskR = m.radius + 4.5;
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.72)';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(0, 0, diskR, 0, Math.PI * 2);
        ctx.stroke();

        if (ratio > 0) {
          ctx.strokeStyle = m.zombieType === 'boss' ? '#c084fc' : '#84cc16';
          ctx.lineWidth = 2.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(0, 0, diskR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
          ctx.stroke();
        }
      } else {
        const maxHp = Math.max(1, m.maxHp || 5);
        const currentHp = Math.max(0, Math.min(maxHp, m.hp));
        const diskR = m.radius + 4.2;
        const gapRad = 0.14;
        const segRad = (Math.PI * 2) / maxHp;
        const activeTone =
          currentHp > 2 ? '#38bdf8' : currentHp === 2 ? '#f59e0b' : '#ef4444';

        // Translucent radial pie-wedge behind missing/active health
        ctx.fillStyle = currentHp <= 1 ? 'rgba(239, 68, 68, 0.18)' : 'rgba(15, 23, 42, 0.36)';
        ctx.beginPath();
        ctx.arc(0, 0, diskR + 1.2, 0, Math.PI * 2);
        ctx.fill();

        for (let p = 0; p < maxHp; p++) {
          const a0 = -Math.PI / 2 + p * segRad + gapRad / 2;
          const a1 = -Math.PI / 2 + (p + 1) * segRad - gapRad / 2;
          ctx.strokeStyle = p < currentHp ? activeTone : 'rgba(239, 68, 68, 0.24)';
          ctx.lineWidth = 2.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(0, 0, diskR, a0, a1);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Transient Selection Nameplate (appears when selected/hovered, then fades out cleanly)
    const isRevealed = nameplateRevealId === m.id && nameplateRevealAlpha > 0.02;
    if (isHovered || isRevealed) {
      const nameAlpha = isHovered ? 1 : Math.max(0, Math.min(1, nameplateRevealAlpha));
      ctx.save();
      ctx.globalAlpha = nameAlpha;
      ctx.font = '700 10.5px Plus Jakarta Sans, system-ui, sans-serif';
      ctx.textAlign = 'center';
      let tag = m.name;
      if (m.isExtracted) tag = `Salvado · ${m.name}`;
      else if (m.zombieType === 'boss') tag = 'Jefe Alfa';
      else if (m.isZombie) tag = `☣ ${m.name}`;

      if (isHovered && !m.isZombie && !m.finished) {
        const wSpec = WEAPON_SPECS[(m.weaponType || 'blaster') as WeaponType] || WEAPON_SPECS.blaster;
        tag = `${tag} ${wSpec.icon}`;
      }

      ctx.strokeStyle = '#090b12';
      ctx.lineWidth = 3.2;
      ctx.strokeText(tag, 0, -m.radius - 15);
      ctx.fillStyle =
        m.zombieType === 'boss'
          ? '#e9d5ff'
          : m.isZombie
            ? '#86efac'
            : m.isExtracted
              ? '#fef08a'
              : isHovered
                ? '#7dd3fc'
                : '#ffffff';
      ctx.fillText(tag, 0, -m.radius - 15);
      ctx.restore();
    }

    ctx.restore();
  }
}

export function renderCombatVfx(
  ctx: CanvasRenderingContext2D,
  projectiles: Projectile[],
  barricades: TemporaryBarricade[],
  particles: CombatParticle[],
  floatingTexts: FloatingText[],
  raceTime: number,
  view: ViewBounds,
  options: RenderOptions
): void {
  // Expanding Shockwave Rings
  if (options.shockwaves) {
    for (let i = 0; i < options.shockwaves.length; i++) {
      const sw = options.shockwaves[i];
      if (
        sw.x + sw.maxRadius < view.minX ||
        sw.x - sw.maxRadius > view.maxX ||
        sw.y + sw.maxRadius < view.minY ||
        sw.y - sw.maxRadius > view.maxY
      ) {
        continue;
      }
      const prog = 1 - Math.max(0, sw.lifetime / sw.maxLifetime);
      const eased = 1 - Math.pow(1 - prog, 2);
      const curR = Math.max(4, sw.maxRadius * eased);
      ctx.save();
      ctx.globalAlpha = Math.max(0, (1 - prog) * 0.85);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = Math.max(1, (sw.lineWidth ?? 2.8) * (1 - prog * 0.6));
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, curR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Muzzle Flashes
  if (options.muzzleFlashes) {
    for (let i = 0; i < options.muzzleFlashes.length; i++) {
      const mf = options.muzzleFlashes[i];
      if (mf.x < view.minX || mf.x > view.maxX || mf.y < view.minY || mf.y > view.maxY) continue;
      const frac = Math.max(0, mf.lifetime / mf.maxLifetime);
      ctx.save();
      ctx.translate(mf.x, mf.y);
      ctx.rotate(mf.angle);
      ctx.globalAlpha = frac;
      ctx.fillStyle = mf.color;
      ctx.beginPath();
      ctx.ellipse(4 * frac, 0, 7 * frac, 3.2 * frac, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 3 * frac, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Projectiles & Melee Slash Arcs
  for (let i = 0; i < projectiles.length; i++) {
    const p = projectiles[i];
    if (p.x < view.minX || p.x > view.maxX || p.y < view.minY || p.y > view.maxY) continue;
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
      const tailX = p.x - (p.vx / pSpeed) * 16;
      const tailY = p.y - (p.vy / pSpeed) * 16;
      ctx.strokeStyle = p.color || '#38bdf8';
      ctx.lineWidth = 3.2;
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

  // Holographic Barricades
  for (let i = 0; i < barricades.length; i++) {
    const bar = barricades[i];
    if (
      bar.x + bar.w < view.minX ||
      bar.x - bar.w > view.maxX ||
      bar.y + bar.h < view.minY ||
      bar.y - bar.h > view.maxY
    ) {
      continue;
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
    ctx.fillRect(-34, -bar.h / 2 - 17, 68, 14);
    ctx.font = '700 9.5px JetBrains Mono, monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText(`${bar.lifetime.toFixed(1)}s`, 0, -bar.h / 2 - 7);
    ctx.restore();
  }

  // Particles
  if (options.showParticles !== false) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (p.x < view.minX || p.x > view.maxX || p.y < view.minY || p.y > view.maxY) continue;
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

  // Floating Texts
  for (let i = 0; i < floatingTexts.length; i++) {
    const ft = floatingTexts[i];
    if (ft.x < view.minX || ft.x > view.maxX || ft.y < view.minY || ft.y > view.maxY) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, ft.alpha));
    ctx.font = `900 ${ft.size || 10.5}px Outfit, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#05070f';
    ctx.lineWidth = 3.2;
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
}

export function renderScreenOverlays(
  ctx: CanvasRenderingContext2D,
  virtualW: number,
  virtualH: number,
  camCenterX: number,
  camCenterY: number,
  camZoom: number,
  combatFeed: CombatEvent[],
  options: RenderOptions
): void {
  if (options.focusFx && !options.focusFx.silent) {
    const ffx = options.focusFx;
    const sx = (ffx.x - camCenterX) * camZoom + virtualW / 2;
    const sy = (ffx.y - camCenterY) * camZoom + virtualH / 2;
    ctx.save();
    const grad = ctx.createRadialGradient(sx, sy, 65, sx, sy, Math.max(virtualW, virtualH) * 0.55);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, virtualW, virtualH);

    ctx.font = '900 17px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 4.5;
    ctx.strokeText(ffx.text, virtualW / 2, 102);
    ctx.fillStyle = ffx.color;
    ctx.fillText(ffx.text, virtualW / 2, 102);
    ctx.restore();
  }

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

  // Single-Slot Unobtrusive Live Event Chip (replaces noisy 4-row stacked feed)
  if (combatFeed.length > 0 && !options.focusFx) {
    const ev = combatFeed[0];
    const nowT = options.raceTimeNow ?? ev.time;
    const age = nowT - ev.time;
    if (age >= 0 && age < 2.6) {
      const alpha = age > 2.0 ? Math.max(0, (2.6 - age) / 0.6) : 1;
      const text = (ev.text || '').slice(0, 40);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '700 11px Plus Jakarta Sans, sans-serif';
      const tw = Math.min(280, ctx.measureText(text).width + 24);
      const fx = virtualW / 2 - tw / 2;
      const fy = options.isTvMode ? 70 : 54;

      ctx.fillStyle = 'rgba(9, 13, 24, 0.84)';
      ctx.beginPath();
      ctx.roundRect(fx, fy, tw, 24, 8);
      ctx.fill();
      ctx.strokeStyle = `${ev.color || '#38bdf8'}66`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, virtualW / 2, fy + 12);
      ctx.restore();
    }
  }
}
