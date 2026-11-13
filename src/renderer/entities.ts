import {
  CombatEvent,
  CombatParticle,
  FloatingText,
  Marble,
  Projectile,
  TemporaryBarricade,
  WeaponType,
} from '../types';
import { WEAPON_SPECS, ZOMBIE_SPECS } from '../constants';
import { RenderOptions, ViewBounds } from './types';

export function renderMarbles(
  ctx: CanvasRenderingContext2D,
  marbles: Marble[],
  raceTime: number,
  view: ViewBounds,
  followedMarbleId?: string | null
): void {
  for (let i = 0; i < marbles.length; i++) {
    const m = marbles[i];
    if (m.gone) continue;

    const drawX = m.renderX ?? m.x;
    const drawY = m.renderY ?? m.y;
    if (
      drawX + 60 < view.minX ||
      drawX - 60 > view.maxX ||
      drawY + 60 < view.minY ||
      drawY - 60 > view.maxY
    ) {
      continue;
    }

    const isFollowed = followedMarbleId === m.id;

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
        ctx.lineTo(
          drawX + Math.cos(ang) * (m.radius + 8 + pulse),
          drawY + Math.sin(ang) * (m.radius + 8 + pulse)
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
          ctx.fillStyle =
            p < currentHp
              ? currentHp > 2
                ? '#38bdf8'
                : currentHp === 2
                  ? '#f59e0b'
                  : '#ef4444'
              : 'rgba(239, 68, 68, 0.2)';
          ctx.fillRect(px, startY, pipW, pipH);
        }
      }
    }

    const isNpc = m.id.startsWith('npc_');
    if (!isNpc || m.zombieType === 'boss' || m.zombieType === 'tank' || isFollowed) {
      ctx.font = '700 10.5px Plus Jakarta Sans, system-ui, sans-serif';
      ctx.textAlign = 'center';
      let tag = m.name;
      if (m.isExtracted) tag = `🛡️ ${m.name}`;
      else if (m.zombieType === 'boss') tag = '👑 JEFE ALFA';
      else if (m.isZombie) tag = `☣ ${m.name}`;
      else if (isFollowed) tag = `🎯 ${m.name}`;
      else if (m.rank === 1) tag = `👑 ${m.name}`;

      ctx.strokeStyle = '#090b12';
      ctx.lineWidth = 3;
      ctx.strokeText(tag, 0, -m.radius - 17);
      ctx.fillStyle =
        m.zombieType === 'boss'
          ? '#e9d5ff'
          : m.isZombie
            ? '#86efac'
            : m.isExtracted
              ? '#fef08a'
              : '#ffffff';
      ctx.fillText(tag, 0, -m.radius - 17);
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
    ctx.fillRect(-45, -bar.h / 2 - 18, 90, 15);
    ctx.font = '800 9.5px Outfit, monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText(`🛡️ ${bar.lifetime.toFixed(1)}s`, 0, -bar.h / 2 - 7);
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

  if (combatFeed.length > 0) {
    ctx.save();
    const feedW = 240;
    const feedX = virtualW - feedW - 14;
    let feedY = 64;

    const recentEvents = combatFeed.slice(0, 4);
    for (let i = 0; i < recentEvents.length; i++) {
      const ev = recentEvents[i];
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
    }
    ctx.restore();
  }
}
