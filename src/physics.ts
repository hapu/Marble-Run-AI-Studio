import { Marble, CourseData, Wall } from './types';
import { sound } from './audio';

// Distance squared to line segment with projection fraction t
export function distToSegmentSquared(
  px: number,
  py: number,
  vx: number,
  vy: number,
  wx: number,
  wy: number
) {
  const segDx = wx - vx;
  const segDy = wy - vy;
  const l2 = segDx * segDx + segDy * segDy;
  if (l2 === 0) {
    const dx = px - vx;
    const dy = py - vy;
    return { distSq: dx * dx + dy * dy, projX: vx, projY: vy, nx: dx, ny: dy, t: 0, segDx: 0, segDy: 0 };
  }
  let t = ((px - vx) * segDx + (py - vy) * segDy) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = vx + t * segDx;
  const projY = vy + t * segDy;
  const dx = px - projX;
  const dy = py - projY;
  return { distSq: dx * dx + dy * dy, projX, projY, nx: dx, ny: dy, t, segDx, segDy };
}

export function checkWallCollision(m: Marble, w: Wall) {
  const res = distToSegmentSquared(m.x, m.y, w.x1, w.y1, w.x2, w.y2);
  const r = m.radius;
  if (res.distSq < r * r) {
    const dist = Math.sqrt(res.distSq) || 0.001;
    let nx = res.nx / dist;
    let ny = res.ny / dist;

    // Segment face normal (perpendicular to wall)
    const segLen = Math.hypot(res.segDx, res.segDy) || 1;
    let faceNx = -res.segDy / segLen;
    let faceNy = res.segDx / segLen;
    if (faceNx * nx + faceNy * ny < 0) {
      faceNx = -faceNx;
      faceNy = -faceNy;
    }

    // Smooth contact normal near segment endpoints to prevent vertex hooking on curves
    if (res.t <= 0.06 || res.t >= 0.94) {
      const blend = 0.7; // strongly favor surface face normal
      nx = nx * (1 - blend) + faceNx * blend;
      ny = ny * (1 - blend) + faceNy * blend;
      const nLen = Math.hypot(nx, ny) || 1;
      nx /= nLen;
      ny /= nLen;
    }

    // Push marble smoothly out of wall
    m.x = res.projX + nx * r;
    m.y = res.projY + ny * r;

    // Normal velocity component
    const dot = m.vx * nx + m.vy * ny;
    if (dot < 0) {
      const b = w.bounce ?? 0.45;
      const f = w.friction ?? 0.992;

      // Decompose into normal and tangential components
      const vnX = dot * nx;
      const vnY = dot * ny;
      const vtX = m.vx - vnX;
      const vtY = m.vy - vnY;

      // Tangential velocity glides with smooth friction; normal rebounds cleanly
      m.vx = vtX * f - (1 + b) * vnX;
      m.vy = vtY * f - (1 + b) * vnY;

      if (Math.abs(dot) > 1.8) {
        sound.playPop(300 + Math.random() * 120);
      }
    }
  }
}

export function updateSimulation(
  course: CourseData,
  marbles: Marble[],
  dt: number,
  simSpeed: number,
  raceTime: number,
  onFinishFirst: (winner: Marble) => void
) {
  const baseFrameDt = 1 / 60;
  const timeRatio = Math.max(0.1, Math.min(2.0, dt / baseFrameDt));
  const stepScale = timeRatio * simSpeed;
  const effectiveDt = dt * simSpeed;
  const gravity = 0.26;

  // Spinners rotation
  course.spinners.forEach((s) => {
    s.angle += s.speed * stepScale;
  });

  let finishedCount = marbles.filter((m) => m.finished).length;

  marbles.forEach((m) => {
    if (m.finished) {
      const finishDrag = Math.pow(0.92, timeRatio);
      m.vx *= finishDrag;
      m.vy *= finishDrag;
      m.x += m.vx * stepScale;
      m.y += m.vy * stepScale;
      return;
    }

    // Check Elevators (Anti-gravity upward tubes)
    let inElevator = false;
    for (let i = 0; i < course.elevators.length; i++) {
      const el = course.elevators[i];
      if (
        m.x >= el.x &&
        m.x <= el.x + el.w &&
        m.y >= el.y &&
        m.y <= el.y + el.h
      ) {
        inElevator = true;
        // Apply upward lift force and center horizontally
        m.vy = el.liftSpeed;
        const centerX = el.x + el.w / 2;
        m.vx += (centerX - m.x) * 0.25 * stepScale;
        m.vx *= Math.pow(0.9, timeRatio);
        sound.playBoosterZap();
        break;
      }
    }

    // Check Boosters (Horizontal / diagonal acceleration pads)
    for (let i = 0; i < course.boosters.length; i++) {
      const b = course.boosters[i];
      if (
        m.x >= b.x &&
        m.x <= b.x + b.w &&
        m.y >= b.y &&
        m.y <= b.y + b.h
      ) {
        m.vx += b.forceX * 1.5 * stepScale;
        m.vy += b.forceY * 1.5 * stepScale;
        sound.playBoosterZap();
        break;
      }
    }

    // Check Escalator / Electric Stairs jump pads
    for (let i = 0; i < course.escalators.length; i++) {
      const esc = course.escalators[i];
      if (
        m.x >= esc.x &&
        m.x <= esc.x + esc.w &&
        m.y >= esc.y &&
        m.y <= esc.y + esc.h
      ) {
        m.vx = esc.boostX;
        m.vy = esc.boostY;
        sound.playBoosterZap();
        break;
      }
    }

    // Apply Gravity if not in anti-gravity elevator
    if (!inElevator) {
      m.vy += gravity * stepScale;
      const airDrag = Math.pow(0.996, timeRatio);
      m.vx *= airDrag;
      m.vy *= airDrag;
    }

    // Clamp speed limits
    const maxSpeed = 18;
    const currentSpeed = Math.hypot(m.vx, m.vy);
    if (currentSpeed > maxSpeed) {
      m.vx = (m.vx / currentSpeed) * maxSpeed;
      m.vy = (m.vy / currentSpeed) * maxSpeed;
    }

    // Anti-stuck safeguard: gently nudge towards current target checkpoint if stalled
    if (!m.finished) {
      const moveDist = Math.hypot(m.x - (m.lastX ?? m.x), m.y - (m.lastY ?? m.y));
      if (moveDist < 0.4) {
        m.stuckFrames = (m.stuckFrames || 0) + 1;
      } else {
        m.stuckFrames = 0;
        m.lastX = m.x;
        m.lastY = m.y;
      }

      if (currentSpeed < 0.8 && m.currentCheckpointIdx < course.checkpoints.length) {
        const nextChk = course.checkpoints[m.currentCheckpointIdx];
        const dirX = nextChk.x - m.x;
        const dirY = nextChk.y - m.y;
        const d = Math.hypot(dirX, dirY) || 1;
        m.vx += (dirX / d) * 0.75 * simSpeed;
        m.vy += (dirY / d) * 0.75 * simSpeed;
      }

      // If marble is stalled for > 1.5 seconds (90 simulation frames)
      if (m.stuckFrames && m.stuckFrames > 90 && m.currentCheckpointIdx < course.checkpoints.length) {
        const nextChk = course.checkpoints[m.currentCheckpointIdx];
        const dirX = nextChk.x - m.x;
        const dirY = nextChk.y - m.y;
        const d = Math.hypot(dirX, dirY) || 1;
        m.vx = (dirX / d) * 3.5;
        m.vy = (dirY / d) * 3.5;

        // If trapped in a corner or wedge for > 3.5 seconds
        if (m.stuckFrames > 210) {
          m.x += (dirX / d) * 24;
          m.y += (dirY / d) * 24;
          m.stuckFrames = 0;
        }
      }

      // Track stall at the same checkpoint
      if (m.currentCheckpointIdx === m.lastCheckpointIdx) {
        m.checkpointStallFrames = (m.checkpointStallFrames || 0) + 1;
      } else {
        m.checkpointStallFrames = 0;
        m.lastCheckpointIdx = m.currentCheckpointIdx;
      }

      // If marble hasn't advanced checkpoint for > 2.5 seconds (150 frames)
      if (m.checkpointStallFrames && m.checkpointStallFrames > 150 && m.currentCheckpointIdx < course.checkpoints.length) {
        const nextChk = course.checkpoints[m.currentCheckpointIdx];
        const dirX = nextChk.x - m.x;
        const dirY = nextChk.y - m.y;
        const d = Math.hypot(dirX, dirY) || 1;
        m.vx += (dirX / d) * 1.5 * simSpeed;
        m.vy += (dirY / d) * 1.5 * simSpeed;

        // If stalled for > 5 seconds (300 frames)
        if (m.checkpointStallFrames > 300) {
          m.x += (dirX / d) * 20;
          m.y += (dirY / d) * 20;
          m.vx = (dirX / d) * 4.0;
          m.vy = (dirY / d) * 4.0;
          m.checkpointStallFrames = 0;
        }
      }
    }

    // Move
    m.x += m.vx * stepScale;
    m.y += m.vy * stepScale;

    // Position history for cute motion blur
    m.history.push({ x: m.x, y: m.y });
    if (m.history.length > 6) m.history.shift();

    // Checkpoint navigation
    if (m.currentCheckpointIdx < course.checkpoints.length) {
      const targetChk = course.checkpoints[m.currentCheckpointIdx];
      const distToChk = Math.hypot(m.x - targetChk.x, m.y - targetChk.y);
      let hasReached = distToChk < 240;

      // Forward projection check along track segment
      if (!hasReached && m.currentCheckpointIdx < course.checkpoints.length - 1) {
        const nextChk = course.checkpoints[m.currentCheckpointIdx + 1];
        const segDx = nextChk.x - targetChk.x;
        const segDy = nextChk.y - targetChk.y;
        const segLen = Math.hypot(segDx, segDy) || 1;
        const nx = segDx / segLen;
        const ny = segDy / segLen;
        const toMx = m.x - targetChk.x;
        const toMy = m.y - targetChk.y;
        const longProj = toMx * nx + toMy * ny;
        const latDist = Math.abs(toMx * ny - toMy * nx);

        if (longProj > 0 && latDist < 480) {
          hasReached = true;
        }
      }

      // Advance checkpoint or finish
      if (hasReached) {
        if (targetChk.isFinish && !m.finished) {
          m.finished = true;
          m.finishTime = raceTime + effectiveDt;
          finishedCount++;
          m.finishPosition = finishedCount;
          if (finishedCount === 1) {
            sound.playVictory();
            onFinishFirst(m);
          } else {
            sound.playCheckpoint();
          }
        } else {
          m.currentCheckpointIdx++;
        }
      }

      // Fail-safe recovery: if marble strayed too far from current checkpoint track corridor
      const distFromTarget = Math.hypot(m.x - targetChk.x, m.y - targetChk.y);
      if (!m.finished && distFromTarget > 1400) {
        m.x = targetChk.x;
        m.y = targetChk.y;
        m.vx = 1.5;
        m.vy = 1.5;
      }
    }

      // Compute progress score for live leaderboard
      if (!m.finished) {
        const nextChk = course.checkpoints[Math.min(m.currentCheckpointIdx, course.checkpoints.length - 1)];
        const prevChk = course.checkpoints[Math.max(0, m.currentCheckpointIdx - 1)];
        const segmentDist = Math.hypot(nextChk.x - prevChk.x, nextChk.y - prevChk.y) || 1;
        const distRemaining = Math.hypot(m.x - nextChk.x, m.y - nextChk.y);
        const segmentFraction = Math.max(0, Math.min(1, 1 - distRemaining / segmentDist));
        m.progressScore = m.currentCheckpointIdx + segmentFraction;
      } else {
        m.progressScore = course.checkpoints.length + 10 - (m.finishPosition || 10);
      }

    // Spatial culling window around marble
    const cullMargin = 260;
    const minX = m.x - cullMargin;
    const maxX = m.x + cullMargin;
    const minY = m.y - cullMargin;
    const maxY = m.y + cullMargin;

    // Wall collisions
    for (let i = 0; i < course.walls.length; i++) {
      const w = course.walls[i];
      if (
        Math.max(w.x1, w.x2) >= minX &&
        Math.min(w.x1, w.x2) <= maxX &&
        Math.max(w.y1, w.y2) >= minY &&
        Math.min(w.y1, w.y2) <= maxY
      ) {
        checkWallCollision(m, w);
      }
    }

    // Bumper collisions
    for (let i = 0; i < course.bumpers.length; i++) {
      const b = course.bumpers[i];
      if (b.x >= minX && b.x <= maxX && b.y >= minY && b.y <= maxY) {
        const dx = m.x - b.x;
        const dy = m.y - b.y;
        const distSq = dx * dx + dy * dy;
        const minDist = m.radius + b.r;
        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.001;
          const nx = dx / dist;
          const ny = dy / dist;
          m.x = b.x + nx * minDist;
          m.y = b.y + ny * minDist;

          const impulse = 8.5 * (b.bounce ?? 1.25);
          m.vx = nx * impulse;
          m.vy = ny * impulse;
          sound.playBumper(480 + Math.random() * 160);
        }
      }
    }

    // Spinner blade collisions
    for (let i = 0; i < course.spinners.length; i++) {
      const s = course.spinners[i];
      if (s.x >= minX - s.r && s.x <= maxX + s.r && s.y >= minY - s.r && s.y <= maxY + s.r) {
        for (let a = 0; a < s.arms; a++) {
          const ang = s.angle + (a * 2 * Math.PI) / s.arms;
          const ax = s.x + Math.cos(ang) * s.r;
          const ay = s.y + Math.sin(ang) * s.r;

          const res = distToSegmentSquared(m.x, m.y, s.x, s.y, ax, ay);
          if (res.distSq < m.radius * m.radius) {
            const dist = Math.sqrt(res.distSq) || 0.001;
            const nx = res.nx / dist;
            const ny = res.ny / dist;
            m.x += nx * (m.radius - dist);

            // Tangential blade velocity kick
            const tangX = -Math.sin(ang) * s.speed * s.r * 2.2;
            const tangY = Math.cos(ang) * s.speed * s.r * 2.2;
            m.vx += tangX + nx * 3;
            m.vy += tangY + ny * 3;
            sound.playPop(340);
          }
        }
      }
    }
  });

  // Marble-to-Marble lightweight elastic collisions
  for (let i = 0; i < marbles.length; i++) {
    for (let j = i + 1; j < marbles.length; j++) {
      const m1 = marbles[i];
      const m2 = marbles[j];
      const dx = m2.x - m1.x;
      const dy = m2.y - m1.y;
      const distSq = dx * dx + dy * dy;
      const minDist = m1.radius + m2.radius;

      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq) || 0.001;
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minDist - dist) * 0.5;

        m1.x -= nx * overlap;
        m1.y -= ny * overlap;
        m2.x += nx * overlap;
        m2.y += ny * overlap;

        const kx = m1.vx - m2.vx;
        const ky = m1.vy - m2.vy;
        const p = nx * kx + ny * ky;
        m1.vx -= p * nx * 0.95;
        m1.vy -= p * ny * 0.95;
        m2.vx += p * nx * 0.95;
        m2.vy += p * ny * 0.95;

        if (Math.abs(p) > 2) {
          sound.playPop(280 + Math.random() * 80);
        }
      }
    }
  }

  // Live order sorting by progress score
  marbles.sort((a, b) => {
    if (a.finished && b.finished) {
      return (a.finishPosition || 0) - (b.finishPosition || 0);
    }
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progressScore - a.progressScore;
  });

  marbles.forEach((m, idx) => {
    m.rank = idx + 1;
  });
}
