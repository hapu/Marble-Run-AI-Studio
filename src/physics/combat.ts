import { CourseData, Marble, WeaponType } from '../types';
import { ROOM_SIZE, WEAPON_SPECS, ZOMBIE_SPECS } from '../constants';
import { sound } from '../audio';
import { INV_SCALE, PhysicsContext } from './types';
import { getChunkIndexAt, getRoomExitTarget, removeMarbleBody } from './worldFactory';

export function applyHumanDamage(ctx: PhysicsContext, human: Marble, attackerZombie?: Marble): void {
  if (human.finished || human.isZombie || human.gone) return;
  if ((human.hitCooldownUntil || 0) > ctx.lastRaceTime) return;

  const hBody = ctx.marbleBodies.get(human.id);

  if (human.shield > 0 || (human.shieldUntil || 0) > ctx.lastRaceTime) {
    human.shield = Math.max(0, human.shield - 50);
    human.hitCooldownUntil = ctx.lastRaceTime + 0.55;
    if (attackerZombie) {
      const zBody = ctx.marbleBodies.get(attackerZombie.id);
      if (zBody && hBody) {
        const hp = hBody.translation();
        const zp = zBody.translation();
        const dx = zp.x - hp.x;
        const dy = zp.y - hp.y;
        const d = Math.hypot(dx, dy) || 1;
        zBody.setLinvel({ x: (dx / d) * 11.5, y: (dy / d) * 11.5 }, true);
      }
    }
    sound.playBumper(360);
    ctx.addParticles(human.x, human.y, '#38bdf8', 10, 4.5);
    ctx.addFloatingText(human.x, human.y - 14, '🛡️ BLOQUEADO!', '#38bdf8');
    return;
  }

  human.hitCooldownUntil = ctx.lastRaceTime + 0.7;
  human.hp = Math.max(0, human.hp - 1);

  const rIdx =
    human.currentRoomId ?? (ctx.currentCourse ? getChunkIndexAt(ctx.currentCourse, human.x, human.y) : 0);
  ctx.roomDamageCounts[rIdx] = (ctx.roomDamageCounts[rIdx] || 0) + 1;

  if (ctx.followedMarbleId === human.id) {
    ctx.pendingDamageFlash = true;
  }

  if (human.hp <= 0) {
    human.isZombie = true;
    human.zombieType = 'walker';
    const wSpec = ZOMBIE_SPECS.walker;
    human.zhp = wSpec.hp;
    human.maxZhp = wSpec.hp;
    human.zSpeedMult = wSpec.speedMult;
    human.zForceMult = wSpec.forceMult;
    human.infectionTime = ctx.lastRaceTime;
    human.turnCooldownUntil = ctx.lastRaceTime + 1.5;
    if (ctx.currentCourse?.chunks[rIdx]) {
      human.infectedRoomName = ctx.currentCourse.chunks[rIdx].name;
    }
    if (attackerZombie) {
      attackerZombie.kills = (attackerZombie.kills || 0) + 1;
    }
    sound.playInfection();
    ctx.addParticles(human.x, human.y, '#22c55e', 20, 5.5, 'slime');
    ctx.addFloatingText(human.x, human.y - 16, '☣ ¡INFECTADO!', '#4ade80');
    ctx.addCombatEvent(`☣ ¡CONTAGIO! ${human.name} se volvió zombi`, '#4ade80');

    const isFollowed = ctx.followedMarbleId === human.id;
    const firstInf = !ctx.highlightEvents.some((e) => e.kind === 'inf');
    ctx.highlightEvents.push({
      t: ctx.lastRaceTime,
      marbleId: human.id,
      text: `☣ ${human.name} infectado!`,
      color: '#22c55e',
      weight: (isFollowed ? 9 : 4) + (firstInf ? 3 : 0),
      kind: 'inf',
    });
    ctx.pendingFocus = {
      x: human.x,
      y: human.y,
      color: '#22c55e',
      text: `☣ ¡${human.name} INFECTADO!`,
      durationSec: isFollowed ? 1.5 : 1.0,
    };
  } else {
    sound.playHeartLost();
    ctx.addParticles(human.x, human.y, '#ef4444', 8, 3.5);
    ctx.addFloatingText(human.x, human.y - 14, '-1 HP!', '#ef4444');
    if (attackerZombie && hBody) {
      const zBody = ctx.marbleBodies.get(attackerZombie.id);
      if (zBody) {
        const hp = hBody.translation();
        const zp = zBody.translation();
        const dx = hp.x - zp.x;
        const dy = hp.y - zp.y;
        const d = Math.hypot(dx, dy) || 1;
        hBody.setLinvel({ x: (dx / d) * 7.8, y: (dy / d) * 7.8 }, true);
        zBody.setLinvel({ x: -(dx / d) * 5.6, y: -(dy / d) * 5.6 }, true);
      }
    }
  }
}

export function damageZombie(
  ctx: PhysicsContext,
  z: Marble,
  dmg: number,
  pushVxPx: number,
  pushVyPx: number,
  attacker: Marble
): void {
  if (z.gone || z.finished || !z.isZombie) return;

  z.zhp = (z.zhp ?? 4) - dmg;
  const zBody = ctx.marbleBodies.get(z.id);
  if (zBody) {
    const curV = zBody.linvel();
    zBody.setLinvel(
      {
        x: curV.x * 0.25 + pushVxPx * 1.15,
        y: curV.y * 0.25 + pushVyPx * 1.15,
      },
      true
    );
  }

  if (z.zhp <= 0) {
    z.gone = true;
    removeMarbleBody(ctx, z.id);
    attacker.kills = (attacker.kills || 0) + 1;
    sound.playInfection();
    ctx.addParticles(z.x, z.y, '#84cc16', 14, 5.5, 'slime');

    const zt = z.zombieType || 'walker';
    if (zt === 'tank' || zt === 'boss') {
      const title = zt === 'boss' ? '👑 ¡JEFE ELIMINADO!' : '💀 ¡TANQUE ABATIDO!';
      ctx.addParticles(z.x, z.y, '#fde047', 18, 6.5, 'spark');
      ctx.addFloatingText(z.x, z.y - 18, title, '#fde047');
      ctx.addCombatEvent(`${title} por ${attacker.name}`, '#fde047');
      ctx.highlightEvents.push({
        t: ctx.lastRaceTime,
        marbleId: attacker.id,
        text: `${title} (${attacker.name})`,
        color: '#fde047',
        weight: zt === 'boss' ? 9 : 6,
        kind: 'kill',
      });
      ctx.pendingFocus = {
        x: z.x,
        y: z.y,
        color: '#fde047',
        text: title,
        durationSec: 1.1,
      };
    } else {
      ctx.addFloatingText(z.x, z.y - 14, '💀 +1 BAJA', '#a3e635');
    }
  }
}

export function processCollisions(ctx: PhysicsContext, marbles: Marble[]): void {
  if (!ctx.eventQueue) return;

  ctx.eventQueue.drainCollisionEvents((h1, h2, started) => {
    if (!started) return;
    const metaA = ctx.colliderMeta.get(h1);
    const metaB = ctx.colliderMeta.get(h2);
    if (!metaA || !metaB) return;

    // 1. Marble vs Bumper
    if (
      (metaA.kind === 'marble' && metaB.kind === 'bumper') ||
      (metaB.kind === 'marble' && metaA.kind === 'bumper')
    ) {
      const mMeta = metaA.kind === 'marble' ? metaA : (metaB as { kind: 'marble'; marbleId: string });
      const bMeta = metaA.kind === 'bumper' ? metaA : (metaB as { kind: 'bumper'; x: number; y: number; bounce: number });
      const mBody = ctx.marbleBodies.get(mMeta.marbleId);
      if (mBody) {
        const p = mBody.translation();
        const dx = p.x - bMeta.x * INV_SCALE;
        const dy = p.y - bMeta.y * INV_SCALE;
        const d = Math.hypot(dx, dy) || 1;
        const kick = 8.2 * Math.max(0.85, bMeta.bounce);
        mBody.setLinvel({ x: (dx / d) * kick, y: (dy / d) * kick }, true);
        sound.playBumper(480 + Math.random() * 160);
      }
      return;
    }

    // 2. Marble vs Marble
    if (metaA.kind === 'marble' && metaB.kind === 'marble') {
      const mA = marbles.find((m) => m.id === metaA.marbleId);
      const mB = marbles.find((m) => m.id === metaB.marbleId);
      if (mA && mB) {
        if (mA.isZombie !== mB.isZombie) {
          const zombie = mA.isZombie ? mA : mB;
          const human = mA.isZombie ? mB : mA;
          if ((zombie.turnCooldownUntil || 0) <= ctx.lastRaceTime) {
            applyHumanDamage(ctx, human, zombie);
          }
        } else {
          const bA = ctx.marbleBodies.get(mA.id);
          const bB = ctx.marbleBodies.get(mB.id);
          if (bA && bB) {
            const va = bA.linvel();
            const vb = bB.linvel();
            const rel = Math.hypot(va.x - vb.x, va.y - vb.y);
            if (rel > 2.4) {
              sound.playImpact(rel * 0.45, 1.0, 380);
            }
          }
        }
      }
      return;
    }

    // 3. Marble vs Walls / Hazards / Barricades
    const mMeta = metaA.kind === 'marble' ? metaA : metaB.kind === 'marble' ? metaB : null;
    if (mMeta) {
      const mBody = ctx.marbleBodies.get(mMeta.marbleId);
      if (mBody) {
        const v = mBody.linvel();
        const spd = Math.hypot(v.x, v.y);
        if (spd > 2.6) {
          sound.playImpact(spd * 0.38, 1.0, 360);
        }
      }
    }
  });
}

export function updateMarblesBehavior(
  ctx: PhysicsContext,
  course: CourseData,
  marbles: Marble[],
  effectiveDt: number,
  raceTime: number
): void {
  for (let idx = 0; idx < marbles.length; idx++) {
    const m = marbles[idx];
    if (m.gone) continue;
    const body = ctx.marbleBodies.get(m.id);
    if (!body) continue;

    const vel = body.linvel();
    const mass = body.mass();

    if (m.finished) {
      body.setLinvel({ x: vel.x * 0.94, y: vel.y * 0.94 }, true);
      continue;
    }

    const roomIdx = getChunkIndexAt(course, m.x, m.y);
    m.currentRoomId = roomIdx;
    const room = course.chunks[roomIdx];

    if ((m.turboTime && m.turboTime > raceTime) || (m.boostUntil && m.boostUntil > raceTime)) {
      const curSpd = Math.hypot(vel.x, vel.y) || 1;
      body.addForce({ x: (vel.x / curSpd) * 18.0 * mass, y: (vel.y / curSpd) * 18.0 * mass }, true);
    }

    if (m.isZombie) {
      let nearestHuman: Marble | null = null;
      let minHDist = 360;
      for (let j = 0; j < marbles.length; j++) {
        const other = marbles[j];
        if (!other.isZombie && !other.finished && !other.gone) {
          const d = Math.hypot(other.x - m.x, other.y - m.y);
          if (d < minHDist) {
            minHDist = d;
            nearestHuman = other;
          }
        }
      }
      const fMult = m.zForceMult ?? 1.0;
      if (nearestHuman) {
        const dirX = (nearestHuman.x - m.x) / (minHDist || 1);
        const dirY = (nearestHuman.y - m.y) / (minHDist || 1);
        body.addForce({ x: dirX * 14.5 * fMult * mass, y: dirY * 14.5 * fMult * mass }, true);
      } else if (room && !m.id.startsWith('npc_')) {
        const targetPt = getRoomExitTarget(course, room);
        const dx = targetPt.x - m.x;
        const dy = targetPt.y - m.y;
        const d = Math.hypot(dx, dy) || 1;
        body.addForce({ x: (dx / d) * 10.5 * fMult * mass, y: (dy / d) * 10.5 * fMult * mass }, true);
      }
    } else {
      if (room) {
        const targetPt = getRoomExitTarget(course, room);
        const dx = targetPt.x - m.x;
        const dy = targetPt.y - m.y;
        const d = Math.hypot(dx, dy) || 1;
        const spd = Math.hypot(vel.x, vel.y);
        const steerMag = room.nextDir === 'n' ? 20.5 : spd < 2.6 ? 15.5 : 11.8;

        let alignFx = 0;
        let alignFy = 0;
        if (room.nextDir === 'e' || room.nextDir === 'w') {
          alignFy = (room.y + ROOM_SIZE / 2 - m.y) * 0.045;
        } else if (room.nextDir === 'n' || room.nextDir === 's') {
          alignFx = (room.x + ROOM_SIZE / 2 - m.x) * 0.045;
        }

        body.addForce(
          {
            x: ((dx / d) * steerMag + alignFx) * mass,
            y: ((dy / d) * steerMag + alignFy) * mass,
          },
          true
        );
      }

      // Survivor Weapons
      m.weaponCooldown = Math.max(0, (m.weaponCooldown || 0) - effectiveDt);
      if (m.weaponUpgradeTimer && m.weaponUpgradeTimer > 0) {
        m.weaponUpgradeTimer -= effectiveDt;
        if (m.weaponUpgradeTimer <= 0) m.weaponType = 'blaster';
      }

      const wSpec = WEAPON_SPECS[(m.weaponType || 'blaster') as WeaponType] || WEAPON_SPECS.blaster;
      let nearestZombie: Marble | null = null;
      let minZDist = wSpec.range;

      for (let j = 0; j < marbles.length; j++) {
        const other = marbles[j];
        if (other.isZombie && !other.finished && !other.gone) {
          const d = Math.hypot(other.x - m.x, other.y - m.y);
          if (d < minZDist) {
            minZDist = d;
            nearestZombie = other;
          }
        }
      }

      if (nearestZombie) {
        const aim = Math.atan2(nearestZombie.y - m.y, nearestZombie.x - m.x);
        m.aimAngle = aim;

        if ((m.weaponCooldown || 0) <= 0) {
          m.weaponCooldown = wSpec.cooldown;

          if (wSpec.isMelee) {
            sound.playImpact(7, 1.0, 220);
            const nx = Math.cos(aim);
            const ny = Math.sin(aim);
            ctx.projectiles.push({
              id: `melee_${Math.random().toString(36).substring(2, 7)}`,
              x1: m.x,
              y1: m.y,
              x: nearestZombie.x,
              y: nearestZombie.y,
              vx: nx * 0.01,
              vy: ny * 0.01,
              ownerId: m.id,
              lifetime: 0.14,
              maxLifetime: 0.14,
              color: wSpec.color,
              isMelee: true,
            });
            damageZombie(ctx, nearestZombie, wSpec.damage, nx * wSpec.knockback, ny * wSpec.knockback, m);
          } else {
            sound.playLaserShot();
            const pellets = wSpec.pellets || 1;
            const pSpeed = wSpec.id === 'rifle' ? 25 : 19;
            const spreadArc = wSpec.id === 'shotgun' ? 0.34 : 0.22;

            for (let p = 0; p < pellets; p++) {
              const angleOffset = pellets === 1 ? 0 : (p / (pellets - 1) - 0.5) * spreadArc;
              const sa = aim + angleOffset;
              ctx.projectiles.push({
                id: `p_${Math.random().toString(36).substring(2, 7)}`,
                x: m.x + Math.cos(sa) * (m.radius + 3),
                y: m.y + Math.sin(sa) * (m.radius + 3),
                vx: Math.cos(sa) * pSpeed,
                vy: Math.sin(sa) * pSpeed,
                ownerId: m.id,
                lifetime: wSpec.id === 'rifle' ? 0.6 : 0.45,
                maxLifetime: wSpec.id === 'rifle' ? 0.6 : 0.45,
                color: wSpec.color || m.color,
                damage: wSpec.damage,
                knockback: wSpec.knockback,
              });
            }
          }
        }
      } else {
        m.aimAngle = Math.atan2(m.vy || 1, m.vx || 0);
      }
    }

    // Elevators / Air-Lift shafts in active rooms
    let inElevator = false;
    for (const cIdx of ctx.activeChunkIndices) {
      const ch = course.chunks[cIdx];
      if (!ch) continue;
      for (let i = 0; i < ch.elevators.length; i++) {
        const el = ch.elevators[i];
        if (m.x >= el.x && m.x <= el.x + el.w && m.y >= el.y && m.y <= el.y + el.h) {
          inElevator = true;
          const centerPullX = (el.x + el.w / 2 - m.x) * 0.09;
          const targetVy = (el.liftSpeed || -6.5) * 1.25;
          body.setLinvel(
            {
              x: Math.max(-4.5, Math.min(4.5, vel.x * 0.85 + centerPullX)),
              y: targetVy,
            },
            true
          );
          sound.playBoosterZap();
          break;
        }
      }
      if (inElevator) break;
    }

    // Boosters in active rooms
    for (const cIdx of ctx.activeChunkIndices) {
      const ch = course.chunks[cIdx];
      if (!ch) continue;
      let boosted = false;
      for (let i = 0; i < ch.boosters.length; i++) {
        const b = ch.boosters[i];
        if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) {
          body.addForce({ x: b.forceX * 16.0 * mass, y: b.forceY * 16.0 * mass }, true);
          sound.playBoosterZap();
          boosted = true;
          break;
        }
      }
      if (boosted) break;
    }

    // Anti-stuck safeguard
    if (!inElevator) {
      const moveDist = Math.hypot(m.x - (m.lastX ?? m.x), m.y - (m.lastY ?? m.y));
      if (moveDist < 0.08) {
        m.stuckFrames = (m.stuckFrames || 0) + 1;
      } else {
        m.stuckFrames = 0;
        m.lastX = m.x;
        m.lastY = m.y;
      }

      if ((m.stuckFrames || 0) > 220 && room && !m.isZombie) {
        m.stuckFrames = 0;
        const exitPt = getRoomExitTarget(course, room);
        const dirX = exitPt.x - m.x;
        const dirY = exitPt.y - m.y;
        const d = Math.hypot(dirX, dirY) || 1;
        body.setLinvel({ x: (dirX / d) * 8.0, y: (dirY / d) * 8.0 - 2.0 }, true);
        ctx.addParticles(m.x, m.y, '#38bdf8', 8, 3);
      }
    }
  }
}

export function updateProjectilesAndFx(
  ctx: PhysicsContext,
  marbles: Marble[],
  effectiveDt: number,
  stepScale: number
): void {
  for (let pIdx = ctx.projectiles.length - 1; pIdx >= 0; pIdx--) {
    const p = ctx.projectiles[pIdx];
    p.lifetime -= effectiveDt;
    if (p.lifetime <= 0) {
      ctx.projectiles.splice(pIdx, 1);
      continue;
    }
    if (p.isMelee) continue;

    p.x += p.vx * stepScale;
    p.y += p.vy * stepScale;

    let hit = false;
    for (let mIdx = 0; mIdx < marbles.length; mIdx++) {
      const z = marbles[mIdx];
      if (!z.isZombie || z.finished || z.gone) continue;
      const dist = Math.hypot(z.x - p.x, z.y - p.y);
      if (dist < (z.radius || 12.5) + 6) {
        hit = true;
        sound.playPlasmaHit();
        ctx.addParticles(p.x, p.y, p.color || '#38bdf8', 7, 4.5);
        const pSpd = Math.hypot(p.vx, p.vy) || 1;
        const kb = p.knockback ?? 7.5;
        const owner = marbles.find((o) => o.id === p.ownerId) || marbles[0];
        damageZombie(ctx, z, p.damage ?? 1.2, (p.vx / pSpd) * kb, (p.vy / pSpd) * kb, owner);
        break;
      }
    }

    if (hit) {
      ctx.projectiles.splice(pIdx, 1);
    }
  }

  for (let bIdx = ctx.barricades.length - 1; bIdx >= 0; bIdx--) {
    const b = ctx.barricades[bIdx];
    b.lifetime -= effectiveDt;
    if (b.lifetime <= 0) {
      const body = ctx.barricadeBodies.get(b.id);
      if (body && ctx.world) {
        for (let ci = 0; ci < body.numColliders(); ci++) {
          ctx.colliderMeta.delete(body.collider(ci).handle);
        }
        ctx.world.removeRigidBody(body);
        ctx.barricadeBodies.delete(b.id);
      }
      ctx.barricades.splice(bIdx, 1);
    }
  }

  for (let i = ctx.particles.length - 1; i >= 0; i--) {
    const pt = ctx.particles[i];
    pt.x += pt.vx * stepScale;
    pt.y += pt.vy * stepScale;
    pt.vx *= 0.94;
    pt.vy *= 0.94;
    pt.lifetime -= effectiveDt;
    pt.alpha = Math.max(0, pt.lifetime / pt.maxLifetime);
    if (pt.lifetime <= 0) ctx.particles.splice(i, 1);
  }

  for (let i = ctx.floatingTexts.length - 1; i >= 0; i--) {
    const ft = ctx.floatingTexts[i];
    ft.y -= 0.65 * stepScale;
    ft.lifetime -= effectiveDt;
    ft.alpha = Math.max(0, ft.lifetime / ft.maxLifetime);
    if (ft.lifetime <= 0) ctx.floatingTexts.splice(i, 1);
  }
}
