import { CourseData, Marble } from './types';

export function renderCourse(
  ctx: CanvasRenderingContext2D,
  course: CourseData,
  marbles: Marble[],
  virtualW: number,
  virtualH: number,
  camCenterX: number,
  camCenterY: number,
  camZoom: number,
  raceTime: number
) {
  // Clear canvas with sleek dark sci-fi background
  ctx.fillStyle = '#0a0d16';
  ctx.fillRect(0, 0, virtualW, virtualH);

  ctx.save();
  // Center camera and apply dynamic zoom & pan
  ctx.translate(virtualW / 2, virtualH / 2);
  ctx.scale(camZoom, camZoom);
  ctx.translate(-camCenterX, -camCenterY);

  // Compute camera view bounds for spatial culling
  const halfViewW = virtualW / 2 / camZoom;
  const halfViewH = virtualH / 2 / camZoom;
  const viewMinX = camCenterX - halfViewW - 140;
  const viewMaxX = camCenterX + halfViewW + 140;
  const viewMinY = camCenterY - halfViewH - 140;
  const viewMaxY = camCenterY + halfViewH + 140;

  // Background Subtle Isometric / Architectural Guide Grid
  const gridSpacing = 160;
  const startX = Math.floor(viewMinX / gridSpacing) * gridSpacing;
  const endX = Math.ceil(viewMaxX / gridSpacing) * gridSpacing;
  const startY = Math.floor(viewMinY / gridSpacing) * gridSpacing;
  const endY = Math.ceil(viewMaxY / gridSpacing) * gridSpacing;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = startX; x <= endX; x += gridSpacing) {
    ctx.moveTo(x, viewMinY);
    ctx.lineTo(x, viewMaxY);
  }
  for (let y = startY; y <= endY; y += gridSpacing) {
    ctx.moveTo(viewMinX, y);
    ctx.lineTo(viewMaxX, y);
  }
  ctx.stroke();

  // =========================================================================
  // 1. Render Speed Boosters (Luminous Conveyor Pads with Sliding Chevrons)
  // =========================================================================
  course.boosters.forEach((b) => {
    if (
      b.x + b.w >= viewMinX &&
      b.x <= viewMaxX &&
      b.y + b.h >= viewMinY &&
      b.y <= viewMaxY
    ) {
      // Base glowing pad
      ctx.fillStyle = 'rgba(240, 190, 56, 0.09)';
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Subtle border
      ctx.strokeStyle = 'rgba(240, 190, 56, 0.25)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);

      // Sliding animated speed chevrons
      ctx.save();
      ctx.strokeStyle = 'rgba(240, 190, 56, 0.75)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const isRight = b.forceX > 0;
      const isLeft = b.forceX < 0;
      const isUp = b.forceY < -2;
      const isDown = b.forceY > 2;

      const gap = 55;
      const offset = (raceTime * 320) % gap;

      if (isRight) {
        const midY = b.y + b.h / 2;
        for (let x = b.x + offset; x < b.x + b.w; x += gap) {
          ctx.beginPath();
          ctx.moveTo(x - 14, midY - 12);
          ctx.lineTo(x, midY);
          ctx.lineTo(x - 14, midY + 12);
          ctx.stroke();
        }
      } else if (isLeft) {
        const midY = b.y + b.h / 2;
        for (let x = b.x + b.w - offset; x > b.x; x -= gap) {
          ctx.beginPath();
          ctx.moveTo(x + 14, midY - 12);
          ctx.lineTo(x, midY);
          ctx.lineTo(x + 14, midY + 12);
          ctx.stroke();
        }
      } else if (isUp) {
        const midX = b.x + b.w / 2;
        for (let y = b.y + b.h - offset; y > b.y; y -= gap) {
          ctx.beginPath();
          ctx.moveTo(midX - 16, y + 12);
          ctx.lineTo(midX, y);
          ctx.lineTo(midX + 16, y + 12);
          ctx.stroke();
        }
      } else if (isDown) {
        const midX = b.x + b.w / 2;
        for (let y = b.y + offset; y < b.y + b.h; y += gap) {
          ctx.beginPath();
          ctx.moveTo(midX - 16, y - 12);
          ctx.lineTo(midX, y);
          ctx.lineTo(midX + 16, y - 12);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  });

  // =========================================================================
  // 2. Render Kinetic Escalators / Jump Catapults
  // =========================================================================
  course.escalators.forEach((esc) => {
    if (
      esc.x + esc.w >= viewMinX &&
      esc.x <= viewMaxX &&
      esc.y + esc.h >= viewMinY &&
      esc.y <= viewMaxY
    ) {
      ctx.fillStyle = 'rgba(59, 212, 142, 0.14)';
      ctx.fillRect(esc.x, esc.y, esc.w, esc.h);

      // Kinetic diagonal boost energy lines
      ctx.strokeStyle = 'rgba(59, 212, 142, 0.6)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(esc.x + 18, esc.y + esc.h - 12);
      ctx.lineTo(esc.x + esc.w - 18, esc.y + 12);
      ctx.stroke();

      // Energy pulse dot
      const pulseT = (raceTime * 3.5) % 1;
      const dotX = esc.x + 18 + pulseT * (esc.w - 36);
      const dotY = esc.y + esc.h - 12 + pulseT * (24 - esc.h);
      ctx.fillStyle = '#6ee7b7';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // =========================================================================
  // 3. Render Vacuum Anti-Gravity Lift Cylinders (Glass Tubes & Coils)
  // =========================================================================
  course.elevators.forEach((el) => {
    if (
      el.x + el.w >= viewMinX &&
      el.x <= viewMaxX &&
      el.y + el.h >= viewMinY &&
      el.y <= viewMaxY
    ) {
      const cx = el.x + el.w / 2;

      // Acrylic glass shaft interior glow
      const tubeGrad = ctx.createLinearGradient(el.x, el.y, el.x + el.w, el.y);
      tubeGrad.addColorStop(0, 'rgba(45, 191, 214, 0.14)');
      tubeGrad.addColorStop(0.2, 'rgba(45, 191, 214, 0.05)');
      tubeGrad.addColorStop(0.8, 'rgba(45, 191, 214, 0.05)');
      tubeGrad.addColorStop(1, 'rgba(45, 191, 214, 0.14)');
      ctx.fillStyle = tubeGrad;
      ctx.fillRect(el.x, el.y, el.w, el.h);

      // Specular highlight line along left edge of glass tube
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(el.x + 6, el.y);
      ctx.lineTo(el.x + 6, el.y + el.h);
      ctx.stroke();

      // Magnetic induction rings every 140px
      const ringSpacing = 140;
      ctx.strokeStyle = 'rgba(45, 191, 214, 0.4)';
      ctx.lineWidth = 3;
      for (let ry = el.y; ry <= el.y + el.h; ry += ringSpacing) {
        ctx.beginPath();
        ctx.ellipse(cx, ry, el.w / 2 - 4, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Animated rising energy chevrons
      const chevronGap = 85;
      const offset = (raceTime * 380) % chevronGap;

      ctx.strokeStyle = 'rgba(45, 191, 214, 0.75)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let y = el.y + el.h - offset; y >= el.y; y -= chevronGap) {
        ctx.beginPath();
        ctx.moveTo(cx - 28, y + 18);
        ctx.lineTo(cx, y);
        ctx.lineTo(cx + 28, y + 18);
        ctx.stroke();
      }

      // Rising plasma sparks
      ctx.fillStyle = '#67e8f9';
      for (let p = 0; p < 9; p++) {
        const px = el.x + 18 + ((p * 37) % (el.w - 36));
        const py = el.y + (el.h - ((raceTime * 460 + p * 190) % el.h));
        ctx.beginPath();
        ctx.arc(px, py, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Holographic vertical label
      ctx.save();
      ctx.fillStyle = 'rgba(45, 191, 214, 0.45)';
      ctx.font = '800 12px Plus Jakarta Sans, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▲ TUBO DE VACÍO ANTI-GRAVEDAD ▲', cx, el.y + el.h / 2);
      ctx.restore();
    }
  });

  // =========================================================================
  // 4. Render Track Walls (Multi-Pass Neon Tubular Rails)
  // =========================================================================
  // Pass 1: Soft Ambient Neon Glow
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  course.walls.forEach((w) => {
    if (
      Math.max(w.x1, w.x2) >= viewMinX &&
      Math.min(w.x1, w.x2) <= viewMaxX &&
      Math.max(w.y1, w.y2) >= viewMinY &&
      Math.min(w.y1, w.y2) <= viewMaxY
    ) {
      const railColor = w.color || '#2dbfd6';
      ctx.strokeStyle = railColor + '28';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
    }
  });

  // Pass 2: High-Contrast Dark Metallic Conduit Base
  course.walls.forEach((w) => {
    if (
      Math.max(w.x1, w.x2) >= viewMinX &&
      Math.min(w.x1, w.x2) <= viewMaxX &&
      Math.max(w.y1, w.y2) >= viewMinY &&
      Math.min(w.y1, w.y2) <= viewMaxY
    ) {
      ctx.strokeStyle = '#121826';
      ctx.lineWidth = 7.5;
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
    }
  });

  // Pass 3: Crisp Illuminated Neon Core Line
  course.walls.forEach((w) => {
    if (
      Math.max(w.x1, w.x2) >= viewMinX &&
      Math.min(w.x1, w.x2) <= viewMaxX &&
      Math.max(w.y1, w.y2) >= viewMinY &&
      Math.min(w.y1, w.y2) <= viewMaxY
    ) {
      ctx.strokeStyle = w.color || '#38bdf8';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
    }
  });

  // Pass 4: Metallic Modular Joint Rivets at segment junctions
  ctx.fillStyle = '#f8fafc';
  course.walls.forEach((w, idx) => {
    if (idx % 3 === 0) {
      if (w.x1 >= viewMinX && w.x1 <= viewMaxX && w.y1 >= viewMinY && w.y1 <= viewMaxY) {
        ctx.beginPath();
        ctx.arc(w.x1, w.y1, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  // =========================================================================
  // 5. Render Pinball Bumpers (Glossy Cushioned Discs with Specular Highlights)
  // =========================================================================
  course.bumpers.forEach((b) => {
    if (
      b.x + b.r >= viewMinX &&
      b.x - b.r <= viewMaxX &&
      b.y + b.r >= viewMinY &&
      b.y - b.r <= viewMaxY
    ) {
      // Outer subtle colored glow
      ctx.fillStyle = b.color + '26';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 5, 0, Math.PI * 2);
      ctx.fill();

      // Dark outer bumper bezel
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();

      // Colored bumper cushion
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.88, 0, Math.PI * 2);
      ctx.fill();

      // Inner white rebound ring
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.48, 0, Math.PI * 2);
      ctx.stroke();

      // Center bright core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.22, 0, Math.PI * 2);
      ctx.fill();

      // 3D Glass Specular Shine
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // =========================================================================
  // 6. Render Spinners (Aerodynamic Turbine Blades & Chrome Hub)
  // =========================================================================
  course.spinners.forEach((s) => {
    if (
      s.x + s.r >= viewMinX &&
      s.x - s.r <= viewMaxX &&
      s.y + s.r >= viewMinY &&
      s.y - s.r <= viewMaxY
    ) {
      const bladeColor = s.color || '#ed7e38';

      // Outer rotation blur track
      ctx.strokeStyle = bladeColor + '18';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();

      // Aerodynamic curved turbine blades
      for (let a = 0; a < s.arms; a++) {
        const ang = s.angle + (a * 2 * Math.PI) / s.arms;
        const tipX = s.x + Math.cos(ang) * s.r;
        const tipY = s.y + Math.sin(ang) * s.r;

        // Blade back curve
        const midAng = ang - 0.22;
        const midR = s.r * 0.55;
        const midX = s.x + Math.cos(midAng) * midR;
        const midY = s.y + Math.sin(midAng) * midR;

        ctx.fillStyle = bladeColor;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.quadraticCurveTo(midX, midY, tipX, tipY);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();

        // Tip glowing sphere
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(tipX, tipY, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Brushed-metal central hub
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f0be38';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x - 2, s.y - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // =========================================================================
  // 7. Render Futuristic Stage Portal Arches
  // =========================================================================
  course.stages.forEach((stg, idx) => {
    if (
      stg.x + 280 >= viewMinX &&
      stg.x - 280 <= viewMaxX &&
      stg.y + 160 >= viewMinY &&
      stg.y - 160 <= viewMaxY
    ) {
      const theme = stg.themeColor || '#2dbfd6';

      ctx.save();
      // Laser checkpoint tripwire line
      ctx.strokeStyle = theme + '66';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.moveTo(stg.x - 140, stg.y);
      ctx.lineTo(stg.x + 140, stg.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Holographic Arch Badge
      const badgeW = 240;
      const badgeH = 26;
      ctx.fillStyle = 'rgba(10, 14, 26, 0.9)';
      ctx.fillRect(stg.x - badgeW / 2, stg.y - 36, badgeW, badgeH);

      ctx.strokeStyle = theme;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(stg.x - badgeW / 2, stg.y - 36, badgeW, badgeH);

      // Milestone Number Tag
      const numTag = `0${idx + 1}`.slice(-2);
      ctx.fillStyle = theme;
      ctx.fillRect(stg.x - badgeW / 2, stg.y - 36, 28, badgeH);

      ctx.font = '900 11px Outfit, monospace';
      ctx.fillStyle = '#0a0d16';
      ctx.textAlign = 'center';
      ctx.fillText(numTag, stg.x - badgeW / 2 + 14, stg.y - 19);

      // Stage Name
      ctx.font = '700 11.5px Outfit, system-ui, sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(stg.name, stg.x + 14, stg.y - 19);

      ctx.restore();
    }
  });

  // =========================================================================
  // 8. Render Finish Line Arch & Podium
  // =========================================================================
  const fx = course.finishX;
  const fy = course.finishY;
  if (
    fx + 300 >= viewMinX &&
    fx - 300 <= viewMaxX &&
    fy + 300 >= viewMinY &&
    fy - 300 <= viewMaxY
  ) {
    ctx.save();

    // Checkered banner
    const bW = 280;
    const bH = 28;
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(fx - bW / 2, fy - bH / 2, bW, bH);

    ctx.fillStyle = '#0f172a';
    const squares = 16;
    const sqW = bW / squares;
    for (let i = 0; i < squares; i++) {
      if (i % 2 === 0) {
        ctx.fillRect(fx - bW / 2 + i * sqW, fy - bH / 2, sqW, bH / 2);
      } else {
        ctx.fillRect(fx - bW / 2 + i * sqW, fy, sqW, bH / 2);
      }
    }

    // Victory Title Banner
    ctx.font = '900 16px Outfit, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('🏁 META FINAL · PODIO DE CAMPEONES 🏁', fx, fy - 28);

    // Podium Pedestals inside Victory Box (1st in center, 2nd left, 3rd right)
    const pCenterY = fy + 65;
    // 2nd Place
    ctx.fillStyle = '#334155';
    ctx.fillRect(fx - 100, pCenterY + 15, 60, 45);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '800 13px Outfit, sans-serif';
    ctx.fillText('2º', fx - 70, pCenterY + 42);

    // 1st Place (Tallest, Gold)
    ctx.fillStyle = '#d97706';
    ctx.fillRect(fx - 35, pCenterY, 70, 60);
    ctx.fillStyle = '#fef08a';
    ctx.font = '900 16px Outfit, sans-serif';
    ctx.fillText('1º 👑', fx, pCenterY + 36);

    // 3rd Place
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(fx + 40, pCenterY + 28, 60, 32);
    ctx.fillStyle = '#fcd34d';
    ctx.font = '800 12px Outfit, sans-serif';
    ctx.fillText('3º', fx + 70, pCenterY + 50);

    ctx.restore();
  }

  // =========================================================================
  // 9. Render Marbles (Vibrant MIKAN Signature Style)
  // =========================================================================
  marbles.forEach((m) => {
    // Dynamic motion trail with fading alpha
    if (m.history.length > 1) {
      for (let i = 0; i < m.history.length - 1; i++) {
        const alpha = (i / m.history.length) * 0.38;
        ctx.strokeStyle = m.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = m.radius * (i / m.history.length) * 1.5;
        ctx.beginPath();
        ctx.moveTo(m.history[i].x, m.history[i].y);
        ctx.lineTo(m.history[i + 1].x, m.history[i + 1].y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.translate(m.x, m.y);

    // Marble Sphere Body
    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
    ctx.fill();

    // High-visibility border contour (essential for White and Black marbles)
    if (m.border) {
      ctx.strokeStyle = m.border;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, m.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3D Spherical Specular Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(-m.radius * 0.32, -m.radius * 0.32, m.radius * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // Signature MIKAN Citrus Leaf (for Orange marble)
    if (m.isMikan) {
      ctx.fillStyle = '#3eb874';
      ctx.beginPath();
      ctx.ellipse(0, -m.radius + 1, 6, 3, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // Little brown stem
      ctx.strokeStyle = '#854d0e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -m.radius + 2);
      ctx.lineTo(1, -m.radius - 2);
      ctx.stroke();
    }

    // Algodoo / MIKAN Anime Cartoon Eyes
    const lookAngle = Math.atan2(m.vy, m.vx);
    const pupilDist = 1.6;
    const pupilX = Math.cos(lookAngle) * pupilDist;
    const pupilY = Math.sin(lookAngle) * pupilDist;

    // Eye whites
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-4, -1, 3.2, 0, Math.PI * 2);
    ctx.arc(4, -1, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Dark pupils looking in movement direction
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-4 + pupilX, -1 + pupilY, 1.6, 0, Math.PI * 2);
    ctx.arc(4 + pupilX, -1 + pupilY, 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Overhead Name Tag & Rank Indicator with high contrast outline
    ctx.font = '700 10.5px Plus Jakarta Sans, system-ui, sans-serif';
    ctx.textAlign = 'center';

    const rankText = m.rank === 1 ? `👑 ${m.name}` : m.name;
    // Dark outline for legibility over bright boosters
    ctx.strokeStyle = '#090b12';
    ctx.lineWidth = 3;
    ctx.strokeText(rankText, 0, -m.radius - 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(rankText, 0, -m.radius - 6);

    ctx.restore();
  });

  ctx.restore();
}
