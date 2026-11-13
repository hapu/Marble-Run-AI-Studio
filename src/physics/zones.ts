import RAPIER from '@dimforge/rapier2d-compat';
import { CourseData, Marble, PickupCrate, WeaponType, ZombieType } from '../types';
import { WEAPON_SPECS } from '../constants';
import { sound } from '../audio';
import { INV_SCALE, PhysicsContext } from './types';
import { getChunkIndexAt, spawnNpcZombie } from './worldFactory';
import { applyHumanDamage } from './combat';

export function triggerEmpShockwave(ctx: PhysicsContext, targetX: number, targetY: number): void {
  sound.playEmpPower();
  ctx.addParticles(targetX, targetY, '#38bdf8', 24, 8);
  ctx.addFloatingText(targetX, targetY - 20, '💥 ONDA EMP!', '#38bdf8');
  ctx.addCombatEvent('⚡ COMANDANTE detonó ONDA EMP', '#38bdf8');

  for (let i = 0; i < ctx.lastMarbles.length; i++) {
    const m = ctx.lastMarbles[i];
    if (!m.isZombie || m.finished || m.gone) continue;
    const dist = Math.hypot(m.x - targetX, m.y - targetY);
    if (dist < 400) {
      const body = ctx.marbleBodies.get(m.id);
      if (body) {
        const pushX = (m.x - targetX) / (dist || 1);
        const pushY = (m.y - targetY) / (dist || 1);
        body.setLinvel({ x: pushX * 15.0, y: pushY * 15.0 - 3.5 }, true);
        ctx.addParticles(m.x, m.y, '#67e8f9', 6, 3);
      }
    }
  }
}

export function deployBarricade(ctx: PhysicsContext, targetX: number, targetY: number): void {
  if (!ctx.world) return;
  sound.playBarricade();
  const id = `barr_${Math.random().toString(36).substring(2, 7)}`;
  const bW = 120;
  const bH = 26;

  const bBody = ctx.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(targetX * INV_SCALE, targetY * INV_SCALE)
  );
  const bCol = ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid((bW / 2) * INV_SCALE, (bH / 2) * INV_SCALE)
      .setRestitution(0.75)
      .setFriction(0.15)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    bBody
  );

  ctx.colliderMeta.set(bCol.handle, { kind: 'barricade' });
  ctx.barricadeBodies.set(id, bBody);
  ctx.barricades.push({
    id,
    x: targetX,
    y: targetY,
    w: bW,
    h: bH,
    lifetime: 8.0,
    maxLifetime: 8.0,
  });

  ctx.addParticles(targetX, targetY, '#06b6d4', 16, 5);
  ctx.addFloatingText(targetX, targetY - 20, '🛡️ BARRICADA (8s)', '#06b6d4');
  ctx.addCombatEvent('🛡️ BARRICADA HOLOGRÁFICA desplegada', '#06b6d4');
}

export function deployAirdrop(
  ctx: PhysicsContext,
  targetX: number,
  targetY: number,
  course: CourseData
): void {
  sound.playAirdrop();
  const id = `crate_air_${Math.random().toString(36).substring(2, 7)}`;
  const types: PickupCrate['type'][] = ['shotgun', 'rifle', 'spread', 'rapid', 'sword', 'shield', 'repair'];
  const chosenType = types[Math.floor(Math.random() * types.length)];

  const newCrate: PickupCrate = {
    id,
    chunkId: getChunkIndexAt(course, targetX, targetY),
    x: targetX,
    y: targetY,
    type: chosenType,
    active: true,
    respawnTimer: 0,
  };

  if (course.chunks[newCrate.chunkId]) {
    course.chunks[newCrate.chunkId].crates.push(newCrate);
  }
  course.crates.push(newCrate);

  ctx.addParticles(targetX, targetY, '#f59e0b', 20, 6);
  ctx.addFloatingText(targetX, targetY - 20, `📦 SUMINISTRO: ${chosenType.toUpperCase()}`, '#f59e0b');
  ctx.addCombatEvent(`📦 SUMINISTRO AÉREO [${chosenType.toUpperCase()}]`, '#f59e0b');
}

export function triggerMarbleBoost(ctx: PhysicsContext, marbleId: string): boolean {
  const m = ctx.lastMarbles.find((x) => x.id === marbleId && !x.isZombie && !x.finished && !x.gone);
  if (!m) return false;
  const body = ctx.marbleBodies.get(m.id);
  if (!body) return false;

  sound.playBoosterZap();
  m.boostUntil = ctx.lastRaceTime + 3.0;
  m.turboTime = Math.max(m.turboTime || 0, ctx.lastRaceTime + 3.0);
  const v = body.linvel();
  const spd = Math.hypot(v.x, v.y) || 1;
  body.setLinvel({ x: (v.x / spd) * 13.5, y: (v.y / spd) * 13.5 - 2.2 }, true);
  ctx.addParticles(m.x, m.y, '#fde047', 16, 5.5);
  ctx.addFloatingText(m.x, m.y - 16, '⚡ TURBO BOOST!', '#fde047');
  ctx.addCombatEvent(`⚡ BOOST activado en ${m.name}`, '#fde047');
  return true;
}

export function triggerMarbleShield(ctx: PhysicsContext, marbleId: string): boolean {
  const m = ctx.lastMarbles.find((x) => x.id === marbleId && !x.isZombie && !x.finished && !x.gone);
  if (!m) return false;

  sound.playCratePickup();
  m.shield = 100;
  m.shieldUntil = ctx.lastRaceTime + 5.0;
  ctx.addParticles(m.x, m.y, '#38bdf8', 16, 4.5);
  ctx.addFloatingText(m.x, m.y - 16, '🛡️ ESCUDO 5s!', '#38bdf8');
  ctx.addCombatEvent(`🛡️ ESCUDO activo en ${m.name}`, '#38bdf8');
  return true;
}

export function triggerMarbleHeal(ctx: PhysicsContext, marbleId: string): boolean {
  const m = ctx.lastMarbles.find((x) => x.id === marbleId && !x.isZombie && !x.finished && !x.gone);
  if (!m || m.hp >= m.maxHp) return false;

  sound.playCratePickup();
  m.hp = Math.min(m.maxHp, m.hp + 2);
  ctx.addParticles(m.x, m.y, '#4ade80', 16, 4.5);
  ctx.addFloatingText(m.x, m.y - 16, '❤️ +2 HP!', '#4ade80');
  ctx.addCombatEvent(`❤️ ${m.name} recuperó +2 HP`, '#4ade80');
  return true;
}

export function updateActiveChunkZones(
  ctx: PhysicsContext,
  course: CourseData,
  marbles: Marble[],
  effectiveDt: number,
  stepScale: number,
  raceTime: number
): void {
  for (const cIdx of ctx.activeChunkIndices) {
    const chunk = course.chunks[cIdx];
    if (!chunk) continue;

    // Spinners
    const spinBodies = ctx.spinnerBodies.get(cIdx);
    if (spinBodies) {
      for (let i = 0; i < chunk.spinners.length; i++) {
        const s = chunk.spinners[i];
        const sBody = spinBodies[i];
        s.angle += s.speed * effectiveDt * 60;
        if (sBody) sBody.setNextKinematicRotation(s.angle);
      }
    }

    // Pistons
    for (let i = 0; i < chunk.pistons.length; i++) {
      const p = chunk.pistons[i];
      const pBody = ctx.pistonBodies.get(p.id);
      if (!pBody) continue;
      const cycleT = (((raceTime / p.period + p.phase) % 1) + 1) % 1;
      const tg =
        p.dutyCycle && p.dutyCycle > 0 && p.dutyCycle < 1
          ? cycleT < p.dutyCycle
            ? cycleT / p.dutyCycle
            : (1 - cycleT) / (1 - p.dutyCycle)
          : 0.5 - 0.5 * Math.cos(2 * Math.PI * (raceTime / p.period + p.phase));
      pBody.setNextKinematicTranslation({
        x: (p.x + p.w / 2 + p.dx * tg) * INV_SCALE,
        y: (p.y + p.h / 2 + p.dy * tg) * INV_SCALE,
      });
    }

    // Pendulums
    for (let i = 0; i < chunk.pendulums.length; i++) {
      const pend = chunk.pendulums[i];
      const bobBody = ctx.pendulumBodies.get(pend.id);
      if (!bobBody) continue;
      const ang = pend.maxAngle * Math.sin(2 * Math.PI * (raceTime / pend.period + pend.phase));
      bobBody.setNextKinematicTranslation({
        x: (pend.pivotX + Math.sin(ang) * pend.length) * INV_SCALE,
        y: (pend.pivotY + Math.cos(ang) * pend.length) * INV_SCALE,
      });
      bobBody.setNextKinematicRotation(ang);
    }

    // Wind Zones
    for (let i = 0; i < chunk.windZones.length; i++) {
      const w = chunk.windZones[i];
      const gust = w.gustPeriod ? 1 + 0.35 * Math.sin(raceTime * ((2 * Math.PI) / w.gustPeriod)) : 1;
      for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
        const m = marbles[mIdx];
        if (m.finished || m.gone) continue;
        const rb = ctx.marbleBodies.get(m.id);
        if (!rb) continue;
        if (m.x >= w.x && m.x <= w.x + w.w && m.y >= w.y && m.y <= w.y + w.h) {
          const mass = rb.mass();
          rb.addForce({ x: w.forceX * 15.0 * gust * mass, y: w.forceY * 15.0 * gust * mass }, true);
        }
      }
    }

    // Magnet Zones
    if (chunk.magnetZones) {
      for (let i = 0; i < chunk.magnetZones.length; i++) {
        const mag = chunk.magnetZones[i];
        for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
          const m = marbles[mIdx];
          if (m.finished || m.gone) continue;
          const rb = ctx.marbleBodies.get(m.id);
          if (!rb) continue;
          const dx = mag.x - m.x;
          const dy = mag.y - m.y;
          const d = Math.hypot(dx, dy);
          if (d < mag.r && d > 12) {
            const mass = rb.mass();
            rb.addForce(
              { x: (dx / d) * mag.force * 12.5 * mass, y: (dy / d) * mag.force * 12.5 * mass },
              true
            );
          }
        }
      }
    }

    // Sticky Slow Zones
    if (chunk.slowZones) {
      for (let i = 0; i < chunk.slowZones.length; i++) {
        const sz = chunk.slowZones[i];
        for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
          const m = marbles[mIdx];
          if (m.finished || m.gone) continue;
          const rb = ctx.marbleBodies.get(m.id);
          if (!rb) continue;
          if (m.x >= sz.x && m.x <= sz.x + sz.w && m.y >= sz.y && m.y <= sz.y + sz.h) {
            const v = rb.linvel();
            const keep = Math.max(0.75, 1 - sz.drag * stepScale);
            rb.setLinvel({ x: v.x * keep, y: v.y * keep }, true);
          }
        }
      }
    }

    // Teleporter Portals
    if (chunk.portals) {
      for (let i = 0; i < chunk.portals.length; i++) {
        const tp = chunk.portals[i];
        for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
          const m = marbles[mIdx];
          if (m.finished || m.gone) continue;
          if ((m.tpCooldownUntil || 0) > raceTime) continue;
          const rb = ctx.marbleBodies.get(m.id);
          if (!rb) continue;
          if (m.x >= tp.x && m.x <= tp.x + tp.w && m.y >= tp.y && m.y <= tp.y + tp.h) {
            m.tpCooldownUntil = raceTime + 1.6;
            ctx.addParticles(m.x, m.y, tp.color || '#a855f7', 12, 4.5);
            rb.setTranslation({ x: tp.tx * INV_SCALE, y: tp.ty * INV_SCALE }, true);
            const v = rb.linvel();
            rb.setLinvel({ x: v.x * 0.4, y: v.y * 0.4 }, true);
            ctx.addParticles(tp.tx, tp.ty, '#38bdf8', 12, 4.5);
            sound.playBoosterZap();
            ctx.addFloatingText(tp.tx, tp.ty - 16, '🌀 WARP!', '#c084fc');
          }
        }
      }
    }

    // Spike Strips
    if (chunk.spikeZones) {
      for (let i = 0; i < chunk.spikeZones.length; i++) {
        const spk = chunk.spikeZones[i];
        for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
          const m = marbles[mIdx];
          if (m.isZombie || m.finished || m.gone) continue;
          if (m.x >= spk.x && m.x <= spk.x + spk.w && m.y >= spk.y && m.y <= spk.y + spk.h) {
            applyHumanDamage(ctx, m);
          }
        }
      }
    }

    // Timed Kicker Launch Pads
    if (chunk.kickerZones) {
      for (let i = 0; i < chunk.kickerZones.length; i++) {
        const kz = chunk.kickerZones[i];
        const stepNum = Math.floor((raceTime + kz.phase * kz.period) / kz.period);
        if (stepNum !== kz.lastStep) {
          kz.lastStep = stepNum;
          kz.flashUntil = raceTime + 0.3;
          for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
            const m = marbles[mIdx];
            if (m.finished || m.gone) continue;
            const rb = ctx.marbleBodies.get(m.id);
            if (!rb) continue;
            if (
              m.x >= kz.x - 10 &&
              m.x <= kz.x + kz.w + 10 &&
              m.y >= kz.y - 24 &&
              m.y <= kz.y + kz.h + 10
            ) {
              const v = rb.linvel();
              rb.setLinvel({ x: v.x + kz.ix * 1.15, y: kz.iy * 1.25 }, true);
              sound.playBumper(620);
              ctx.addParticles(m.x, m.y, '#fde047', 8, 4);
            }
          }
        }
      }
    }

    // Healing Pads
    if (chunk.healZones) {
      for (let i = 0; i < chunk.healZones.length; i++) {
        const hz = chunk.healZones[i];
        for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
          const m = marbles[mIdx];
          if (m.isZombie || m.finished || m.gone) continue;
          if (m.hp >= m.maxHp) continue;
          if (m.healedZones && m.healedZones[hz.id]) continue;
          if (m.x >= hz.x && m.x <= hz.x + hz.w && m.y >= hz.y && m.y <= hz.y + hz.h) {
            m.healedZones = m.healedZones || {};
            m.healedZones[hz.id] = true;
            m.hp = Math.min(m.maxHp, m.hp + hz.amount);
            sound.playCratePickup();
            ctx.addParticles(m.x, m.y, '#4ade80', 12, 4);
            ctx.addFloatingText(m.x, m.y - 16, `❤️ +${hz.amount} HP!`, '#4ade80');
          }
        }
      }
    }

    // Crypt Zombie Ambush Spawners
    if (chunk.cryptZones) {
      for (let i = 0; i < chunk.cryptZones.length; i++) {
        const cz = chunk.cryptZones[i];
        if (cz.triggered) continue;
        for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
          const m = marbles[mIdx];
          if (m.isZombie || m.finished || m.gone) continue;
          if (m.x >= cz.x && m.x <= cz.x + cz.w && m.y >= cz.y && m.y <= cz.y + cz.h) {
            cz.triggered = true;
            sound.playEmpPower();
            ctx.addParticles(cz.spawnX, cz.spawnY, '#a855f7', 22, 6, 'slime');
            ctx.addFloatingText(cz.spawnX, cz.spawnY - 22, `⚰️ ¡CRIPTA ABIERTA (+${cz.count})!`, '#c084fc');
            ctx.addCombatEvent(`⚰️ ¡CRIPTA ABIERTA en ${chunk.name}!`, '#c084fc');
            for (let j = 0; j < cz.count; j++) {
              const zt: ZombieType =
                j === 0 && cz.count >= 4 ? 'boss' : Math.random() < 0.25 ? 'runner' : Math.random() < 0.2 ? 'tank' : 'walker';
              ctx.pendingZombieSpawns.push({
                x: cz.spawnX + (j - cz.count / 2) * 26,
                y: cz.spawnY + (Math.random() - 0.5) * 24,
                zombieType: zt,
                roomId: chunk.id,
              });
            }
            break;
          }
        }
      }
    }

    // Pickup Crates
    for (let c = 0; c < chunk.crates.length; c++) {
      const crate = chunk.crates[c];
      if (!crate.active) {
        crate.respawnTimer -= effectiveDt;
        if (crate.respawnTimer <= 0) crate.active = true;
        continue;
      }

      for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
        const m = marbles[mIdx];
        if (m.finished || m.gone || m.isZombie) continue;
        if (Math.hypot(m.x - crate.x, m.y - crate.y) < 30) {
          crate.active = false;
          crate.respawnTimer = 14;

          if (crate.type === 'emp') {
            sound.playEmpBlast();
            ctx.addParticles(crate.x, crate.y, '#38bdf8', 16, 6);
            ctx.addFloatingText(crate.x, crate.y - 16, '⚡ EMP EXPANSIVO!', '#38bdf8');
            for (let j = 0; j < marbles.length; j++) {
              const other = marbles[j];
              if (!other.isZombie || other.gone) continue;
              const distToOther = Math.hypot(other.x - crate.x, other.y - crate.y);
              if (distToOther < 340) {
                const oBody = ctx.marbleBodies.get(other.id);
                if (oBody) {
                  const pushX = (other.x - crate.x) / (distToOther || 1);
                  const pushY = (other.y - crate.y) / (distToOther || 1);
                  oBody.setLinvel({ x: pushX * 13.5, y: pushY * 13.5 - 2.5 }, true);
                }
              }
            }
          } else if (crate.type === 'turbo') {
            sound.playBoosterZap();
            m.turboTime = raceTime + 3.0;
            ctx.addParticles(crate.x, crate.y, '#f59e0b', 12, 5);
            ctx.addFloatingText(m.x, m.y - 16, '⏩ TURBO!', '#f59e0b');
          } else if (crate.type === 'shield') {
            sound.playCratePickup();
            m.shield = 100;
            ctx.addParticles(crate.x, crate.y, '#10b981', 12, 4);
            ctx.addFloatingText(m.x, m.y - 16, '🛡️ ESCUDO!', '#10b981');
          } else if (crate.type === 'repair') {
            sound.playCratePickup();
            m.hp = Math.min(m.maxHp, m.hp + 2);
            ctx.addParticles(crate.x, crate.y, '#ef4444', 12, 4);
            ctx.addFloatingText(m.x, m.y - 16, '❤️ +2 HP!', '#ef4444');
          } else {
            const weaponPool: WeaponType[] = ['shotgun', 'rifle', 'spread', 'rapid', 'sword', 'bat'];
            const chosenW: WeaponType =
              crate.type === 'weapon_swap'
                ? weaponPool.filter((w) => w !== m.weaponType)[Math.floor(Math.random() * (weaponPool.length - 1))] ||
                  'shotgun'
                : (crate.type as WeaponType);
            const wSpec = WEAPON_SPECS[chosenW] || WEAPON_SPECS.blaster;
            sound.playCratePickup();
            m.weaponType = chosenW;
            m.weaponUpgradeTimer = 12.0;
            ctx.addParticles(crate.x, crate.y, wSpec.color, 14, 5);
            ctx.addFloatingText(m.x, m.y - 16, `${wSpec.icon} ${wSpec.name.toUpperCase()}!`, wSpec.color);
            ctx.addCombatEvent(`${wSpec.icon} ${m.name} equipó ${wSpec.name}`, wSpec.color);
          }
          break;
        }
      }
    }
  }

  if (ctx.pendingZombieSpawns.length > 0) {
    for (const sp of ctx.pendingZombieSpawns) {
      spawnNpcZombie(ctx, sp.x, sp.y, sp.zombieType, sp.roomId);
    }
    ctx.pendingZombieSpawns.length = 0;
  }
}
