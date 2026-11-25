import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTex, noiseFill, mulberry32 } from './world.js';
import { ASSET, texOf, instanceModel } from './assets.js';

// ---------------- Texturen (4 m x 3,4 m pro Geschoss-Kachel) ----------------
function brickBase(ctx, s, tone, R, photo) {
  const im = photo && ASSET.img[photo];
  if (im) { for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) ctx.drawImage(im, x * s / 2, y * s / 2, s / 2, s / 2); return; }
  ctx.fillStyle = tone; ctx.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += 10) { const off = ((y / 10) & 1) * 14; for (let x = -28; x < s; x += 28) { const v = (R() - 0.5) * 40; ctx.fillStyle = v > 0 ? `rgba(255,245,230,${v / 160})` : `rgba(60,40,30,${-v / 160})`; ctx.fillRect(x + off + 1, y + 1, 26, 8); } }
  ctx.strokeStyle = 'rgba(70,60,55,.28)'; ctx.lineWidth = 1;
  for (let y = 0; y <= s; y += 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
}
function grime(ctx, s, R) {
  for (let i = 0; i < 30; i++) { const x = R() * s, g = ctx.createLinearGradient(0, 0, 0, s * 0.7); g.addColorStop(0, 'rgba(40,35,30,.16)'); g.addColorStop(1, 'rgba(40,35,30,0)'); ctx.fillStyle = g; ctx.fillRect(x, 0, 2 + R() * 7, s * 0.7); }
  for (let i = 0; i < 4000; i++) { ctx.fillStyle = R() < 0.5 ? `rgba(255,255,255,${R() * 0.08})` : `rgba(0,0,0,${R() * 0.08})`; ctx.fillRect(R() * s, R() * s, 1 + R() * 2, 1 + R() * 2); }
}
function rectWindow(ctx, cx, y0, w, h, frame = '#e9e7e1') {
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(cx - w / 2 - 8, y0 - 8, w + 16, h + 22);
  ctx.fillStyle = frame; ctx.fillRect(cx - w / 2 - 7, y0 - 7, w + 14, h + 14);
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#6b8799'); g.addColorStop(0.5, '#34495a'); g.addColorStop(1, '#161f27'); ctx.fillStyle = g; ctx.fillRect(cx - w / 2, y0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.beginPath(); ctx.moveTo(cx - w / 2, y0); ctx.lineTo(cx - w / 2 + w * 0.5, y0); ctx.lineTo(cx - w / 2, y0 + h * 0.55); ctx.fill();
  ctx.fillStyle = frame; ctx.fillRect(cx - 2, y0, 4, h); ctx.fillRect(cx - w / 2, y0 + h * 0.4, w, 4);
  ctx.fillStyle = '#bdb8ac'; ctx.fillRect(cx - w / 2 - 12, y0 + h + 7, w + 24, 8);
}
export function makeCityTextures() {
  const R = mulberry32(77);
  const CT = (draw) => canvasTex(1024, (c, sz) => { c.scale(sz / 512, sz / 512); draw(c, 512); }, 0);
  const nyBrick = CT((ctx, s) => { brickBase(ctx, s, '#cfc8bd', R, 'brick_wall_005_diff'); grime(ctx, s, R); for (const cx of [128, 384]) rectWindow(ctx, cx, 90, 150, 250); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(0, 500, s, 12); ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(0, 76, s, 10); });
  const glass = canvasTex(512, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s, s); g.addColorStop(0, '#7e9fb5'); g.addColorStop(0.5, '#3b5568'); g.addColorStop(1, '#22323e'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(255,255,255,${0.05 + R() * 0.08})`; ctx.beginPath(); const x = R() * s; ctx.moveTo(x, 0); ctx.lineTo(x + 60, 0); ctx.lineTo(x - 80, 440); ctx.lineTo(x - 140, 440); ctx.fill(); }
    ctx.fillStyle = '#2b3137'; ctx.fillRect(0, 440, s, 72); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, 438, s, 3);
    ctx.fillStyle = '#aab4bb'; for (let x = 0; x < s; x += 128) ctx.fillRect(x - 3, 0, 6, 440);
    ctx.fillRect(0, 0, s, 4);
  }, 0);
  const stone = CT((ctx, s) => {
    brickBase(ctx, s, '#d9d2c2', R, 'large_sandstone_blocks_01_diff');
    if (!ASSET.img.large_sandstone_blocks_01_diff) for (let y = 0; y < s; y += 75) { ctx.strokeStyle = 'rgba(80,70,55,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); const off = ((y / 75) & 1) * 80; for (let x = -160; x < s; x += 160) { ctx.beginPath(); ctx.moveTo(x + off, y); ctx.lineTo(x + off, y + 75); ctx.stroke(); } }
    grime(ctx, s, R);
    for (const cx of [85, 256, 427]) { ctx.fillStyle = '#bfb7a4'; ctx.fillRect(cx - 52, 62, 104, 22); rectWindow(ctx, cx, 92, 80, 270, '#cfc8b8'); }
    ctx.fillStyle = '#efe8d6'; ctx.fillRect(0, 482, s, 30); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(0, 482, s, 3);
  });
  const ldn = CT((ctx, s) => {
    brickBase(ctx, s, '#cdb9a8', R, 'brick_wall_001_diff'); grime(ctx, s, R);
    for (const cx of [128, 384]) {
      const w = 141, h = 255, y0 = 95;
      ctx.fillStyle = '#e4dccb'; ctx.fillRect(cx - w / 2 - 12, 76, w + 24, 16);
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(cx - w / 2 - 6, y0 - 6, w + 12, h + 16);
      ctx.fillStyle = '#f3f1ea'; ctx.fillRect(cx - w / 2 - 5, y0 - 5, w + 10, h + 10);
      const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#59707f'); g.addColorStop(1, '#1b252d'); ctx.fillStyle = g; ctx.fillRect(cx - w / 2, y0, w, h);
      ctx.fillStyle = '#f3f1ea'; ctx.fillRect(cx - 2, y0, 4, h); for (const f of [0.33, 0.5, 0.67]) ctx.fillRect(cx - w / 2, y0 + h * f - 2, w, 4);
      ctx.fillStyle = '#d8d0be'; ctx.fillRect(cx - w / 2 - 10, y0 + h + 6, w + 20, 8);
    }
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 502, s, 10);
  });
  return { nyBrick, glass, stone, ldn };
}

const PAL0 = {
  nyBrick: [[0.72, 0.4, 0.3], [0.62, 0.42, 0.34], [0.64, 0.58, 0.48], [0.78, 0.7, 0.55], [0.55, 0.36, 0.3]],
  stone: [[0.88, 0.84, 0.74], [0.74, 0.74, 0.72], [0.82, 0.76, 0.62]],
  glass: [[0.55, 0.78, 0.95], [0.5, 0.6, 0.68], [0.65, 0.82, 0.86], [0.4, 0.5, 0.6]],
  ldn: [[0.78, 0.38, 0.28], [0.86, 0.7, 0.46], [0.95, 0.9, 0.8], [0.6, 0.33, 0.27], [0.8, 0.62, 0.5]],
};

export const NY_NAMES = ['Midtown', 'Brooklyn', 'Harlem', 'Queens', 'Times Square', 'Wall Street', 'Chinatown', 'Bronx', 'SoHo', "Hell's Kitchen", 'Tribeca', 'Chelsea'];
export const LDN_NAMES = ['Westminster', 'Camden', 'Kensington', 'Soho London', 'Canary Wharf', 'Greenwich', 'Shoreditch', 'Notting Hill', 'Southwark', 'Mayfair', 'Chelsea UK', 'Islington'];

export function buildCities(w) {
  const r = w.rnd, T = makeCityTextures();
  const photo = !!ASSET.img.brick_wall_005_diff;
  const PAL = Object.fromEntries(Object.entries(PAL0).map(([k, v]) => [k, v.map((c) => (photo && k !== 'glass' ? c.map((x) => 0.62 + 0.38 * x) : c))]));
  const mats = {
    nyBrick: new THREE.MeshStandardMaterial({ map: T.nyBrick, vertexColors: true, roughness: 0.92, bumpMap: T.nyBrick, bumpScale: 1.2 }),
    stone: new THREE.MeshStandardMaterial({ map: T.stone, vertexColors: true, roughness: 0.9, bumpMap: T.stone, bumpScale: 1.2 }),
    glass: new THREE.MeshStandardMaterial({ map: T.glass, vertexColors: true, roughness: 0.18, metalness: 0.55, envMapIntensity: 1.4 }),
    ldn: new THREE.MeshStandardMaterial({ map: T.ldn, vertexColors: true, roughness: 0.92, bumpMap: T.ldn, bumpScale: 1.2 }),
  };
  const roofMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, map: canvasTex(256, (c, s) => noiseFill(c, s, '#b0aca4', 70, 5000, mulberry32(12)), 0) });
  const B = {}; for (const k in mats) B[k] = { P: [], N: [], U: [], C: [], I: [] };
  const roofGeos = [];
  const addWalls = (kind, x0, z0, x1, z1, y0, y1, col) => {
    const b = B[kind], faces = [[x0, z1, x1, z1, 0, 1], [x1, z0, x0, z0, 0, -1], [x1, z1, x1, z0, 1, 0], [x0, z0, x0, z1, -1, 0]];
    for (const [ax, az, bx, bz, nx, nz] of faces) {
      const len = Math.hypot(bx - ax, bz - az), base = b.P.length / 3;
      b.P.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az);
      for (let k = 0; k < 4; k++) { b.N.push(nx, 0, nz); b.C.push(col[0], col[1], col[2]); }
      const v0 = y0 / 3.4, v1 = y1 / 3.4; b.U.push(0, v0, len / 4, v0, len / 4, v1, 0, v1);
      b.I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  };
  const addGeo = (g, col) => {
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const cc = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < cc.length; i += 3) { cc[i] = col[0]; cc[i + 1] = col[1]; cc[i + 2] = col[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); roofGeos.push(g.index ? g.toNonIndexed() : g);
  };
  const box = (x0, y0, z0, x1, y1, z1, col) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); addGeo(g, col); };
  const cyl = (x, y, z, rt, rb, h, col, seg = 12) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(x, y + h / 2, z); addGeo(g, col); };
  const prism = (x0, x1, z0, z1, y, h, col) => {
    const zm = (z0 + z1) / 2, p = [], tri = (a, b, c) => p.push(...a, ...b, ...c);
    const A = [x0, y, z0], Bq = [x1, y, z0], Cq = [x1, y, z1], D = [x0, y, z1], Ar = [x0, y + h, zm], Br = [x1, y + h, zm];
    tri(D, Cq, Br); tri(D, Br, Ar); tri(Bq, A, Ar); tri(Bq, Ar, Br); tri(A, D, Ar); tri(Cq, Bq, Br);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); addGeo(g, col);
  };
  const pick = (a) => a[(r() * a.length) | 0];
  const dim = (c, f) => c.map((v) => Math.min(1, v * f));
  const slate = [0.2, 0.21, 0.24];

  // Dachaufbauten
  const roofStuff = (cx, cz, w2, d2, y, ny) => {
    const n = 1 + ((r() * 3) | 0);
    for (let i = 0; i < n; i++) { const ax = cx + (r() - 0.5) * (w2 - 4), az = cz + (r() - 0.5) * (d2 - 4); box(ax - 1.2, y, az - 0.9, ax + 1.2, y + 1.1 + r() * 0.8, az + 0.9, [0.6, 0.6, 0.62]); }
    if (ny && r() < 0.35) { const ax = cx + (r() - 0.5) * (w2 - 5), az = cz + (r() - 0.5) * (d2 - 5); for (const [dx, dz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) cyl(ax + dx, y, az + dz, 0.06, 0.06, 1.6, [0.15, 0.15, 0.15], 5); cyl(ax, y + 1.6, az, 1.3, 1.3, 2.4, [0.45, 0.32, 0.2], 14); cyl(ax, y + 4.0, az, 0.05, 1.5, 1.0, [0.3, 0.22, 0.14], 14); }
  };

  // Hochhaus (NY) mit Stufen
  const tower = (cx, cz, wd, dp, floors, kind, col, big) => {
    const y = w.curY, FH = 3.4;
    let h0 = Math.round(floors * (floors >= 12 ? 0.62 : 1)) * FH;
    addWalls(kind, cx - wd / 2, cz - dp / 2, cx + wd / 2, cz + dp / 2, y - 1.5, y + h0, col);
    box(cx - wd / 2 - 0.3, y + h0, cz - dp / 2 - 0.3, cx + wd / 2 + 0.3, y + h0 + 0.5, cz + dp / 2 + 0.3, dim(col, 0.6));
    let top = y + h0 + 0.5, tw = wd, td = dp;
    if (floors >= 12) {
      tw *= 0.72; td *= 0.72; const h1 = Math.max(2, Math.round(floors * 0.26)) * FH;
      addWalls(kind, cx - tw / 2, cz - td / 2, cx + tw / 2, cz + td / 2, top, top + h1, col); top += h1;
      box(cx - tw / 2 - 0.2, top, cz - td / 2 - 0.2, cx + tw / 2 + 0.2, top + 0.4, cz + td / 2 + 0.2, dim(col, 0.6)); top += 0.4;
      if (floors >= 22) {
        tw *= 0.55; td *= 0.55; const h2 = Math.max(2, Math.round(floors * 0.1)) * FH;
        addWalls(kind, cx - tw / 2, cz - td / 2, cx + tw / 2, cz + td / 2, top, top + h2, col); top += h2;
        box(cx - tw / 2 - 0.15, top, cz - td / 2 - 0.15, cx + tw / 2 + 0.15, top + 0.4, cz + td / 2 + 0.15, dim(col, 0.6)); top += 0.4;
        cyl(cx, top, cz, 0.1, 0.5, big ? 22 : 12, [0.7, 0.7, 0.72], 8);
      }
    } else roofStuff(cx, cz, wd, dp, top, true);
    w.addBox({ x0: cx - wd / 2, x1: cx + wd / 2, z0: cz - dp / 2, z1: cz + dp / 2, y0: y - 1.5, y1: y + h0 + 0.5 });
  };
  // Londoner Reihenhaus-Zeile
  const terrace = (x0, x1, zc, depth, floors, y, baseCol) => {
    const h = floors * 3.4, z0 = zc - depth / 2, z1 = zc + depth / 2, n = Math.max(2, Math.round((x1 - x0) / 6));
    for (let i = 0; i < n; i++) {
      const a = x0 + ((x1 - x0) * i) / n, b = x0 + ((x1 - x0) * (i + 1)) / n, col = r() < 0.35 ? pick(PAL.ldn) : baseCol;
      addWalls('ldn', a, z0, b, z1, y - 1.5, y + h, col.map((v) => v * (0.94 + r() * 0.1)));
      box(a - 0.02, y + h, z0 - 0.25, b + 0.02, y + h + 0.35, z1 + 0.25, [0.78, 0.76, 0.7]);
      const cx = (a + b) / 2; box(cx - 0.4, y + h + 2.2, zc - 0.4, cx + 0.4, y + h + 3.7, zc + 0.4, [0.5, 0.25, 0.2]); box(cx - 0.45, y + h + 3.7, zc - 0.45, cx + 0.45, y + h + 3.85, zc + 0.45, [0.3, 0.3, 0.3]);
    }
    prism(x0 - 0.3, x1 + 0.3, z0 - 0.5, z1 + 0.5, y + h + 0.35, 2.7, slate);
    w.addBox({ x0, x1, z0, z1, y0: y - 1.5, y1: y + h + 0.4 });
  };
  const clockTower = (cx, cz, y) => {
    const col = [0.82, 0.76, 0.6], s = 4.8;
    addWalls('stone', cx - s, cz - s, cx + s, cz + s, y - 1.5, y + 34, col);
    box(cx - s - 0.5, y + 34, cz - s - 0.5, cx + s + 0.5, y + 35, cz + s + 0.5, dim(col, 0.7));
    addWalls('stone', cx - s + 0.8, cz - s + 0.8, cx + s - 0.8, cz + s - 0.8, y + 35, y + 44, dim(col, 0.95));
    for (const [dx, dz, ry] of [[0, s - 0.75, 0], [0, -s + 0.75, Math.PI], [s - 0.75, 0, Math.PI / 2], [-s + 0.75, 0, -Math.PI / 2]]) {
      const g = new THREE.CylinderGeometry(3.0, 3.0, 0.3, 24); g.rotateX(Math.PI / 2); g.rotateY(ry); g.translate(cx + dx * 1.015, y + 39.5, cz + dz * 1.015); addGeo(g, [0.96, 0.95, 0.88]);
      const g2 = new THREE.CylinderGeometry(3.3, 3.3, 0.25, 24); g2.rotateX(Math.PI / 2); g2.rotateY(ry); g2.translate(cx + dx * 1.01, y + 39.5, cz + dz * 1.01); addGeo(g2, [0.55, 0.45, 0.2]);
    }
    const cone = new THREE.ConeGeometry(s * 1.1, 14, 4); cone.rotateY(Math.PI / 4); cone.translate(cx, y + 44 + 7, cz); addGeo(cone, [0.25, 0.35, 0.3]);
    cyl(cx, y + 58, cz, 0.05, 0.25, 6, [0.8, 0.7, 0.2], 6);
    w.addBox({ x0: cx - s, x1: cx + s, z0: cz - s, z1: cz + s, y0: y - 1.5, y1: y + 46 });
  };

  w.parkTrees = []; w.landmarks = [];
  const bigNY = w.towns.filter((t) => t.type === 'ny').sort((a, b) => b.r - a.r)[0], bigLD = w.towns.filter((t) => t.type === 'ldn').sort((a, b) => b.r - a.r)[0];
  for (const t of w.towns) {
    const ny = t.type === 'ny', cell = ny ? 46 : 38, sw = ny ? 14 : 9, blk = cell - sw, n = Math.ceil(t.r / cell);
    Object.assign(t, { cell, sw, blk, n, spots: [], parks: [] }); w.curY = t.y;
    for (let gz = -n; gz <= n; gz++) for (let gx = -n; gx <= n; gx++) {
      const cx = t.x + gx * cell, cz = t.z + gz * cell, dist = Math.hypot(gx * cell, gz * cell);
      if (dist + blk * 0.35 > t.r * 0.9) continue;
      t.spots.push([cx + cell / 2, cz + cell / 2]);
      t.parks.push({ gx, gz, kind: 'bld' });
      const rec = t.parks[t.parks.length - 1];
      const center = gx === 0 && gz === 0;
      if (center && t === bigNY) { tower(cx, cz, blk - 8, blk - 8, 38, 'stone', [0.85, 0.8, 0.68], true); continue; }
      if (center && t === bigLD) { rec.kind = 'plaza'; clockTower(cx, cz, t.y); continue; }
      if (r() < (ny ? 0.1 : 0.16)) { rec.kind = 'park'; const k = 8 + ((r() * 8) | 0); for (let i = 0; i < k; i++) w.parkTrees.push({ x: cx + (r() - 0.5) * (blk - 6), z: cz + (r() - 0.5) * (blk - 6), s: 0.9 + r() * 0.7 }); continue; }
      if (ny) {
        const df = Math.max(0, 1 - dist / t.r), lots = r() < 0.3 ? 2 : 1;
        for (let l = 0; l < lots; l++) {
          const wd = (blk - 4) / lots - (lots > 1 ? 0.5 : 0), dp = blk - 4 - r() * 4, px = lots === 1 ? cx : cx + (l ? 1 : -1) * (wd / 2 + 0.25);
          const floors = t.large ? Math.min(34, 4 + ((r() * 5) | 0) + Math.floor(df * df * 28 * (0.35 + 0.65 * r()))) : 3 + ((r() * 6) | 0);
          const kind = floors >= 11 ? (r() < 0.55 ? 'glass' : 'stone') : (r() < 0.8 ? 'nyBrick' : 'stone');
          w.curY = t.y; tower(px, cz + (r() - 0.5) * 2, wd, dp, floors, kind, pick(PAL[kind]), false);
        }
      } else if (r() < 0.14) {
        const wd = blk - 5, dp = blk - 5; addWalls('stone', cx - wd / 2, cz - dp / 2, cx + wd / 2, cz + dp / 2, t.y - 1.5, t.y + 5 * 3.4, pick(PAL.stone)); box(cx - wd / 2 - 0.3, t.y + 17, cz - dp / 2 - 0.3, cx + wd / 2 + 0.3, t.y + 17.6, cz + dp / 2 + 0.3, [0.6, 0.58, 0.54]); roofStuff(cx, cz, wd, dp, t.y + 17.6, false);
        w.addBox({ x0: cx - wd / 2, x1: cx + wd / 2, z0: cz - dp / 2, z1: cz + dp / 2, y0: t.y - 1.5, y1: t.y + 17.6 });
      } else {
        const floors = 3 + (r() < 0.5 ? 1 : 0), depth = (blk - 3) / 2 - 0.5, base = pick(PAL.ldn);
        terrace(cx - blk / 2 + 1, cx + blk / 2 - 1, cz - depth / 2 - 0.5, depth, floors, t.y, base);
        terrace(cx - blk / 2 + 1, cx + blk / 2 - 1, cz + depth / 2 + 0.5, depth, floors, t.y, pick(PAL.ldn));
      }
    }
  }
  // Einzelhäuser außerhalb (Londoner Cottages)
  w.cabins = []; let k = 0, tries = 0;
  while (k < 24 && tries++ < 3000) {
    const ang = r() * Math.PI * 2, dist = Math.sqrt(r()) * 600, x = Math.cos(ang) * dist, z = Math.sin(ang) * dist, h = w.heightAt(x, z);
    if (h < 4 || h > 20 || w.townAt(x, z, 1.5)) continue;
    if (Math.abs(w.heightAt(x + 8, z) - h) > 1.2 || Math.abs(w.heightAt(x, z + 8) - h) > 1.2) continue;
    const wd = 8 + r() * 3, dp = 7 + r() * 2, y = h + 0.4;
    addWalls('ldn', x - wd / 2, z - dp / 2, x + wd / 2, z + dp / 2, y - 1.5, y + 6.8, pick(PAL.ldn)); prism(x - wd / 2 - 0.3, x + wd / 2 + 0.3, z - dp / 2 - 0.5, z + dp / 2 + 0.5, y + 6.8, 2.6, slate);
    box(x - 0.4, y + 8.6, z - 0.4, x + 0.4, y + 10.2, z + 0.4, [0.5, 0.25, 0.2]);
    w.addBox({ x0: x - wd / 2, x1: x + wd / 2, z0: z - dp / 2, z1: z + dp / 2, y0: y - 1.5, y1: y + 7 }); w.cabins.push([x, z]); k++;
  }
  // Meshes
  for (const kd in B) {
    const b = B[kd]; if (!b.P.length) continue;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.C, 3)); g.setIndex(b.I);
    const m = new THREE.Mesh(g, mats[kd]); m.castShadow = m.receiveShadow = true; w.scene.add(m);
  }
  const rm = new THREE.Mesh(mergeGeometries(roofGeos), roofMat); rm.castShadow = rm.receiveShadow = true; w.scene.add(rm);

  // Bodentexturen (Straßen, Gehwege, Parks) pro Stadt
  for (const t of w.towns) {
    const SZ = 1024, Rr = t.r * 0.95, k2 = SZ / (2 * Rr), ny = t.type === 'ny', Rn = mulberry32((t.x * 13 + t.z) | 0);
    const tex = canvasTex(SZ, (ctx, s) => {
      ctx.save(); ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2 - 1, 0, 6.2832); ctx.clip();
      if (!ASSET.img.asphalt_02_diff) noiseFill(ctx, s, '#3d3d40', 50, 18000, Rn);
      const px = (x) => s / 2 + (x - t.x) * k2, pz = (z) => s / 2 + (z - t.z) * k2;
      for (const b of t.parks) {
        const cx = t.x + b.gx * t.cell, cz = t.z + b.gz * t.cell, hb = t.blk / 2;
        ctx.fillStyle = '#8f8d87'; ctx.fillRect(px(cx - hb - 0.6), pz(cz - hb - 0.6), (t.blk + 1.2) * k2, (t.blk + 1.2) * k2);
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.strokeStyle = '#a9a7a0'; ctx.lineWidth = 2; ctx.strokeRect(px(cx - hb), pz(cz - hb), t.blk * k2, t.blk * k2);
        if (b.kind === 'park') { ctx.fillStyle = '#4c6c34'; ctx.fillRect(px(cx - hb + 2), pz(cz - hb + 2), (t.blk - 4) * k2, (t.blk - 4) * k2); ctx.strokeStyle = '#b8a888'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px(cx - hb + 2), pz(cz)); ctx.lineTo(px(cx + hb - 2), pz(cz)); ctx.moveTo(px(cx), pz(cz - hb + 2)); ctx.lineTo(px(cx), pz(cz + hb - 2)); ctx.stroke(); }
        else if (b.kind === 'plaza') { ctx.fillStyle = '#a8a59b'; ctx.fillRect(px(cx - hb + 2), pz(cz - hb + 2), (t.blk - 4) * k2, (t.blk - 4) * k2); }
        else { ctx.fillStyle = '#76736d'; ctx.fillRect(px(cx - hb + 2.5), pz(cz - hb + 2.5), (t.blk - 5) * k2, (t.blk - 5) * k2); }
      }
      // Mittellinien + Zebrastreifen
      const line = ny ? '#e7b92a' : '#e8e8e2'; ctx.strokeStyle = line; ctx.lineWidth = 2.2; ctx.setLineDash(ny ? [] : [10, 10]);
      for (let g = -t.n - 1; g <= t.n; g++) {
        const pos = (g + 0.5) * t.cell;
        ctx.beginPath(); ctx.moveTo(px(t.x + pos), 0); ctx.lineTo(px(t.x + pos), s); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, pz(t.z + pos)); ctx.lineTo(s, pz(t.z + pos)); ctx.stroke();
        if (ny) { ctx.beginPath(); ctx.moveTo(px(t.x + pos) + 4, 0); ctx.lineTo(px(t.x + pos) + 4, s); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, pz(t.z + pos) + 4); ctx.lineTo(s, pz(t.z + pos) + 4); ctx.stroke(); }
      }
      ctx.setLineDash([]); ctx.fillStyle = 'rgba(235,235,230,.85)';
      for (const [sx, sz] of t.spots) {
        const hs = t.sw / 2 + 1.2;
        for (let i = -3; i <= 3; i++) {
          ctx.fillRect(px(sx + i * 1.3) - 1.5, pz(sz - hs - 2.4), 3, 2.4 * k2 * 0.9); ctx.fillRect(px(sx + i * 1.3) - 1.5, pz(sz + hs), 3, 2.4 * k2 * 0.9);
          ctx.fillRect(px(sx - hs - 2.4), pz(sz + i * 1.3) - 1.5, 2.4 * k2 * 0.9, 3); ctx.fillRect(px(sx + hs), pz(sz + i * 1.3) - 1.5, 2.4 * k2 * 0.9, 3);
        }
      }
      ctx.restore();
    }, 0);
    const at = texOf('asphalt_02_diff', (Rr * 2) / 3.2), an = texOf('asphalt_02_nor', (Rr * 2) / 3.2, (Rr * 2) / 3.2, false);
    if (at) { const bg = new THREE.CircleGeometry(Rr, 64); bg.rotateX(-Math.PI / 2); const bm = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ map: at, normalMap: an, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); bm.position.set(t.x, t.y + 0.05, t.z); bm.receiveShadow = true; w.scene.add(bm); }
    const geo = new THREE.CircleGeometry(Rr, 64); geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, bumpMap: tex, bumpScale: 0.6 }));
    m.position.set(t.x, t.y + 0.07, t.z); m.receiveShadow = true; w.scene.add(m);
  }
}

// ---------------- Straßenmöbel ----------------
export function buildCityProps(w) {
  const r = w.rnd, G = [], M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
  let gm = new THREE.Matrix4();
  const group = (x, y, z, ry) => { gm = new THREE.Matrix4().compose(V.set(x, y, z), Q.setFromEuler(E.set(0, ry, 0)), S1); };
  const part = (geo, col, lx, ly, lz, rx = 0, ry = 0, rz = 0) => {
    const g = geo.clone(); M.compose(V.set(lx, ly, lz), Q.setFromEuler(E.set(rx, ry, rz)), S1); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(gm, M));
    const cc = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < cc.length; i += 3) { cc[i] = col[0]; cc[i + 1] = col[1]; cc[i + 2] = col[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); G.push(g);
  };
  const box = (a, b, c) => new THREE.BoxGeometry(a, b, c), cyl = (rt, rb, h, sg = 8) => new THREE.CylinderGeometry(rt, rb, h, sg);
  const real = { lamp: [], hydrant: [], trash: [], barrier: [], payphone: [] };
  const lamp = (x, z, ry) => { const y = w.heightAt(x, z); if (ASSET.models.street_lamp_01 && real.lamp.length < 44) { real.lamp.push({ x, y, z, ry: ry + Math.PI / 2, s: 1.6 }); w.addCircle(x, z, 0.25); return; } group(x, y, z, ry); part(cyl(0.07, 0.1, 6.5), [0.2, 0.22, 0.24], 0, 3.25, 0); part(box(0.08, 0.08, 1.5), [0.2, 0.22, 0.24], 0, 6.4, -0.7); part(box(0.3, 0.12, 0.6), [0.95, 0.92, 0.75], 0, 6.32, -1.35); w.addCircle(x, z, 0.2); };
  const hydrant = (x, z) => { const y = w.heightAt(x, z); if (ASSET.models.fire_hydrant && real.hydrant.length < 14) { real.hydrant.push({ x, y, z, ry: r() * 6, s: 1.0 }); w.addCircle(x, z, 0.3); return; } group(x, y, z, 0); part(cyl(0.12, 0.14, 0.6), [0.75, 0.1, 0.08], 0, 0.3, 0); part(cyl(0.14, 0.14, 0.06), [0.6, 0.08, 0.06], 0, 0.62, 0); part(cyl(0.05, 0.05, 0.4), [0.7, 0.1, 0.08], 0, 0.4, 0, 0, 0, Math.PI / 2); w.addCircle(x, z, 0.2); };
  const traffic = (x, z, ry) => { const y = w.heightAt(x, z); group(x, y, z, ry); part(cyl(0.06, 0.08, 5), [0.18, 0.2, 0.2], 0, 2.5, 0); part(box(0.3, 0.9, 0.3), [0.05, 0.05, 0.05], 0, 5.2, 0); part(box(0.2, 0.2, 0.05), [0.1, 0.9, 0.2], 0, 4.95, -0.16); part(box(0.2, 0.2, 0.05), [0.9, 0.2, 0.1], 0, 5.45, -0.16); w.addCircle(x, z, 0.2); };
  const phone = (x, z, ry) => { const y = w.heightAt(x, z); group(x, y, z, ry); part(box(0.95, 2.4, 0.95), [0.75, 0.08, 0.07], 0, 1.2, 0); for (const s of [-1, 1]) part(box(0.7, 1.6, 0.03), [0.12, 0.15, 0.18], 0, 1.35, s * 0.485); part(box(1.0, 0.1, 1.0), [0.6, 0.06, 0.05], 0, 2.42, 0); w.addCircle(x, z, 0.6); };
  const bin = (x, z) => { const y = w.heightAt(x, z); if (ASSET.models.metal_trash_can && real.trash.length < 16) { real.trash.push({ x, y, z, ry: r() * 6, s: 0.8 }); w.addCircle(x, z, 0.45); return; } group(x, y, z, 0); part(cyl(0.28, 0.25, 0.9, 10), [0.15, 0.3, 0.2], 0, 0.45, 0); w.addCircle(x, z, 0.3); };
  const barrier = (x, z, q) => { const y = w.heightAt(x, z), hx = q ? 1.5 : 0.3, hz = q ? 0.3 : 1.5;
    if (ASSET.models.concrete_road_barrier && real.barrier.length < 14) { real.barrier.push({ x, y, z, ry: q ? 0 : Math.PI / 2, s: 1.95 }); w.addBox({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, y0: y - 0.2, y1: y + 1.1 }); return; } group(x, y, z, q ? 0 : Math.PI / 2); part(box(3, 1.0, 0.55), [0.62, 0.6, 0.55], 0, 0.5, 0); part(box(3.02, 0.25, 0.8), [0.6, 0.58, 0.53], 0, 0.12, 0); w.addBox({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, y0: y - 0.2, y1: y + 1.05 }); };
  const sandbags = (x, z, q) => { const y = w.heightAt(x, z), hx = q ? 1.25 : 0.35, hz = q ? 0.35 : 1.25; group(x, y, z, q ? 0 : Math.PI / 2); for (let i = 0; i < 3; i++) part(box(2.4, 0.3, 0.6), [0.62 - i * 0.03, 0.54, 0.38], (r() - 0.5) * 0.2, 0.15 + i * 0.3, 0); w.addBox({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, y0: y - 0.2, y1: y + 0.95 }); };
  for (const t of w.towns) {
    const ny = t.type === 'ny', o = t.sw / 2 + 0.7;
    for (const [sx, sz] of t.spots) {
      const corners = [[-o, -o, 0], [o, -o, Math.PI / 2], [o, o, Math.PI], [-o, o, -Math.PI / 2]];
      corners.forEach(([dx, dz, ry], i) => {
        const x = sx + dx, z = sz + dz; if (w.nearBox(x, z, 0.5)) return;
        if (i % 2 === 0) lamp(x, z, ry); else if (ny && r() < 0.5) traffic(x, z, ry); else if (!ny && r() < 0.6) phone(x, z, ry); else if (r() < 0.5) bin(x, z);
        if (ny && r() < 0.15) hydrant(x + 0.8, z);
      });
      if (r() < 0.07) { const bx = sx + (r() - 0.5) * 6, bz = sz + (r() - 0.5) * 6; (r() < 0.5 ? barrier : sandbags)(bx, bz, r() < 0.5); }
    }
  }
  const sc = w.scene; instanceModel(sc, 'street_lamp_01', real.lamp); instanceModel(sc, 'fire_hydrant', real.hydrant); instanceModel(sc, 'metal_trash_can', real.trash); instanceModel(sc, 'concrete_road_barrier', real.barrier);
  if (!G.length) return;
  const mesh = new THREE.Mesh(mergeGeometries(G), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.35 }));
  mesh.castShadow = mesh.receiveShadow = true; w.scene.add(mesh);
}
