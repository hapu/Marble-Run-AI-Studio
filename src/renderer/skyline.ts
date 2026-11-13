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

export function renderSkylineBackdrop(
  ctx: CanvasRenderingContext2D,
  virtualW: number,
  virtualH: number,
  camCenterX: number,
  camCenterY: number,
  raceTime: number
): void {
  const sky = getSkylineCache();
  ctx.save();

  for (let i = 0; i < sky.stars.length; i++) {
    const st = sky.stars[i];
    const sx = (((st.x - camCenterX * 0.02) % virtualW) + virtualW) % virtualW;
    const sy =
      (((st.y - camCenterY * 0.015) % (virtualH * 0.65)) + virtualH * 0.65) % (virtualH * 0.65);
    const alpha = 0.25 + 0.35 * Math.sin(raceTime * 2.2 + st.phase);
    ctx.fillStyle = `rgba(226, 232, 240, ${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, st.r, 0, Math.PI * 2);
    ctx.fill();
  }

  const layerColors = ['#0c1222', '#0f172a', '#131d33'];
  const parallaxRates = [0.04, 0.08, 0.13];
  for (let l = 0; l < sky.layers.length; l++) {
    const buildings = sky.layers[l];
    const pShift = (camCenterX * parallaxRates[l]) % 2800;
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
