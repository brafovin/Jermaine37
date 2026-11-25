import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const MAP = 2000;
export const HALF = MAP / 2;
const RES = 1000; // Höhenraster: 2 m Zellen
const CELL = 32; // Kollisions-Raster
const GN = Math.ceil(MAP / CELL) + 1;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makePerlin(seed) {
  const r = mulberry32(seed), perm = new Uint8Array(512), base = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [base[i], base[j]] = [base[j], base[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  const grad = (h, x, y) => { switch (h & 7) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y; case 4: return x; case 5: return -x; case 6: return y; default: return -y; } };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const fx = Math.floor(x), fy = Math.floor(y), X = fx & 255, Y = fy & 255;
    x -= fx; y -= fy;
    const u = fade(x), v = fade(y), a = perm[X] + Y, b = perm[X + 1] + Y;
    const g00 = grad(perm[a], x, y), g10 = grad(perm[b], x - 1, y), g01 = grad(perm[a + 1], x, y - 1), g11 = grad(perm[b + 1], x - 1, y - 1);
    const l1 = g00 + u * (g10 - g00), l2 = g01 + u * (g11 - g01);
    return l1 + v * (l2 - l1);
  };
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function canvasTex(size, draw, repeat, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}
function noiseFill(ctx, size, base, amp, n = 6000, rnd = Math.random) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    const v = ((rnd() - 0.5) * amp) | 0;
    ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`;
    const s = 1 + rnd() * 3;
    ctx.fillRect(rnd() * size, rnd() * size, s, s);
  }
}

const TOWN_NAMES = ['Port Nova', 'Kaserne Nord', 'Flughafen Delta', 'Raffinerie', 'Birkental', 'Steinbruch', 'Funkturm Echo', 'Fischerdorf', 'Industriepark', 'Altstadt', 'Seeblick', 'Bunkeranlage', 'Basis Alpha', 'Klinik St. Marek', 'Hochland', 'Zollhafen'];
export const TIER_COLORS = [0x8a6a3a, 0x3a86e0, 0xf0b020, 0x6a7078];

export class World {
  constructor(renderer, scene, q) {
    this.renderer = renderer; this.scene = scene; this.q = q;
    this.rnd = mulberry32(1337);
    this.noise = makePerlin(4242);
    this.towns = []; this.roads = []; this.boxes = []; this.circles = [];
    this.bGrid = Array.from({ length: GN * GN }, () => []);
    this.cGrid = Array.from({ length: GN * GN }, () => []);
    this.crates = []; this.baseCrates = 0; this._stamp = 0;
    this.cageZone = null;
    this.buildTerrainData();
    this.buildSky();
    this.buildTerrainMesh();
    this.buildWater();
    this.buildTowns();
    this.buildNature();
    this.buildProps();
    this.buildCrateMeshes();
    this.placeCrates();
    this.buildMapCanvas();
  }

  // ---------- Höhenfeld ----------
  fbm(x, z, oct = 5) { let a = 0.5, f = 1, s = 0; for (let i = 0; i < oct; i++) { s += a * this.noise(x * f, z * f); f *= 2; a *= 0.5; } return s; }
  baseHeight(x, z) {
    const n = this.fbm(x * 0.0011, z * 0.0011), m = this.fbm(x * 0.0045 + 100, z * 0.0045 + 100, 4);
    const d = Math.hypot(x, z) / HALF;
    const island = 1 - smooth(0.6, 0.98, d);
    const h = 17 + n * 32 + m * 6;
    return h * island + (1 - island) * -16;
  }
  finalHeight(x, z) {
    let h = this.baseHeight(x, z);
    for (const t of this.towns) {
      const w = 1 - smooth(t.r * 0.85, t.r * 1.5, Math.hypot(x - t.x, z - t.z));
      if (w > 0) h = lerp(h, t.y, w);
    }
    return h;
  }
  buildTerrainData() {
    const r = this.rnd;
    // Städte platzieren
    let tries = 0;
    while (this.towns.length < TOWN_NAMES.length && tries++ < 6000) {
      const large = this.towns.length < 5;
      const rad = large ? 125 : 85;
      const ang = r() * Math.PI * 2, dist = Math.sqrt(r()) * HALF * 0.6;
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      const h = this.baseHeight(x, z);
      if (h < 5 || h > 30) continue;
      if (this.towns.some((t) => Math.hypot(t.x - x, t.z - z) < 270)) continue;
      this.towns.push({ name: TOWN_NAMES[this.towns.length], x, z, r: rad, y: Math.max(5, h), large });
    }
    // Straßen: jede Stadt mit den 2 nächsten verbinden
    const seen = new Set();
    for (const a of this.towns) {
      const sorted = this.towns.filter((t) => t !== a).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z)).slice(0, 2);
      for (const b of sorted) {
        const k = [this.towns.indexOf(a), this.towns.indexOf(b)].sort().join('-');
        if (!seen.has(k)) { seen.add(k); this.roads.push([a.x, a.z, b.x, b.z]); }
      }
    }
    // Höhenraster
    const N = RES + 1; this.hm = new Float32Array(N * N);
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) this.hm[iz * N + ix] = this.finalHeight(-HALF + ix * 2, -HALF + iz * 2);
  }
  heightAt(x, z) {
    const N = RES + 1;
    let fx = (x + HALF) / 2, fz = (z + HALF) / 2;
    if (fx < 0) fx = 0; else if (fx > RES - 0.001) fx = RES - 0.001;
    if (fz < 0) fz = 0; else if (fz > RES - 0.001) fz = RES - 0.001;
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * N + ix, hm = this.hm;
    return (hm[i] * (1 - tx) + hm[i + 1] * tx) * (1 - tz) + (hm[i + N] * (1 - tx) + hm[i + N + 1] * tx) * tz;
  }
  roadDist(x, z) {
    let best = 1e9;
    for (const [ax, az, bx, bz] of this.roads) {
      const dx = bx - ax, dz = bz - az;
      let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz); t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t)); if (d < best) best = d;
    }
    return best;
  }
  townAt(x, z, f = 1.0) {
    for (const t of this.towns) if (Math.hypot(x - t.x, z - t.z) < t.r * f) return t;
    return null;
  }

  // ---------- Himmel / Licht ----------
  buildSky() {
    const { scene, renderer, q } = this;
    const sky = new Sky(); sky.scale.setScalar(10000);
    const u = sky.material.uniforms;
    u.turbidity.value = 6; u.rayleigh.value = 1.0; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.85;
    const phi = THREE.MathUtils.degToRad(90 - 31), theta = THREE.MathUtils.degToRad(150);
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(this.sunDir);
    scene.add(sky); this.sky = sky;
    const envScene = new THREE.Scene(); const sky2 = sky.clone(); envScene.add(sky2);
    const pm = new THREE.PMREMGenerator(renderer);
    this.envRT = pm.fromScene(envScene, 0.02);
    scene.environment = this.envRT.texture; scene.environmentIntensity = 0.45;
    pm.dispose();
    scene.fog = new THREE.FogExp2(0xd3c7b0, q.fog);
    scene.background = null;
    this.hemi = new THREE.HemisphereLight(0xcfd8e8, 0x8a7550, 0.4); scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xffe2b8, 3.2);
    sun.castShadow = q.shadows;
    sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    const sc = sun.shadow.camera; const R = q.shadowRange; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 1; sc.far = 600;
    sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.35;
    scene.add(sun, sun.target);
  }

  // ---------- Gelände ----------
  buildTerrainMesh() {
    const SEG = this.q.terrainSeg;
    const g = new THREE.PlaneGeometry(MAP, MAP, SEG, SEG); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position; const n = pos.count;
    for (let i = 0; i < n; i++) pos.setY(i, this.heightAt(pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals();
    const nor = g.attributes.normal; const col = new Float32Array(n * 3);
    const c = new THREE.Color(), tmp = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i), slope = 1 - nor.getY(i);
      const nv = this.noise(x * 0.02, z * 0.02) * 0.5 + this.noise(x * 0.08 + 7, z * 0.08) * 0.25;
      c.setRGB(0.6 + nv * 0.07, 0.48 + nv * 0.06, 0.32 + nv * 0.04); // Wüstensand
      const dg = this.noise(x * 0.006 + 50, z * 0.006 + 80) + nv * 0.3;
      if (dg > 0.05) { tmp.setRGB(0.42 + nv * 0.05, 0.39 + nv * 0.05, 0.2); c.lerp(tmp, smooth(0.05, 0.35, dg) * 0.8); } // trockenes Gras
      if (h > 22) { tmp.setRGB(0.5, 0.43, 0.35); c.lerp(tmp, smooth(22, 42, h) * 0.8); }
      if (slope > 0.12) { tmp.setRGB(0.5 + nv * 0.05, 0.42 + nv * 0.05, 0.33); c.lerp(tmp, smooth(0.12, 0.34, slope)); }
      if (h < 3.6) { tmp.setRGB(0.8, 0.72, 0.54); c.lerp(tmp, 1 - smooth(1.2, 3.6, h)); }
      if (h < 0.6) { tmp.setRGB(0.36, 0.31, 0.22); c.lerp(tmp, 1 - smooth(-1.5, 0.6, h)); }
      const rd = this.roadDist(x, z);
      if (rd < 5) { tmp.setRGB(0.42, 0.34, 0.25); c.lerp(tmp, (1 - smooth(2.5, 5, rd)) * 0.9); }
      for (const t of this.towns) {
        const d = Math.hypot(x - t.x, z - t.z);
        if (d < t.r * 1.25) { tmp.setRGB(0.56 + nv * 0.05, 0.47 + nv * 0.04, 0.36); c.lerp(tmp, 1 - smooth(t.r * 0.8, t.r * 1.25, d)); }
      }
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const detail = canvasTex(1024, (ctx, s) => { noiseFill(ctx, s, '#b8b8b8', 90, 40000, mulberry32(5)); const r = mulberry32(6); for (let i = 0; i < 1500; i++) { const lt = r() < 0.5 ? 255 : 0; ctx.fillStyle = `rgba(${lt},${lt},${lt},${0.1 + r() * 0.12})`; ctx.beginPath(); ctx.ellipse(r() * s, r() * s, 1 + r() * 4, 1 + r() * 3, r() * 3, 0, 6.3); ctx.fill(); } }, MAP / 9);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, bumpMap: detail, bumpScale: 1.2, roughness: 0.95, metalness: 0 });
    const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true;
    this.scene.add(mesh); this.terrain = mesh;
  }
  buildWater() {
    const nm = canvasTex(256, (ctx, s) => {
      const hgt = new Float32Array(s * s);
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const a = x / s * Math.PI * 2, b = y / s * Math.PI * 2;
        hgt[y * s + x] = Math.sin(a * 3 + Math.sin(b * 2) * 1.5) * 0.5 + Math.sin(b * 5 + a) * 0.3 + Math.sin((a + b) * 7) * 0.2;
      }
      const img = ctx.createImageData(s, s);
      for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
        const dx = hgt[y * s + (x + 1) % s] - hgt[y * s + (x + s - 1) % s], dy = hgt[((y + 1) % s) * s + x] - hgt[((y + s - 1) % s) * s + x];
        const i = (y * s + x) * 4; img.data[i] = 128 + dx * 90; img.data[i + 1] = 128 + dy * 90; img.data[i + 2] = 255; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }, 260, false);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2b86a6, roughness: 0.06, metalness: 0.15, transparent: true, opacity: 0.86, normalMap: nm, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 1.4 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), mat); m.rotation.x = -Math.PI / 2; m.position.y = 0;
    this.scene.add(m); this.water = m; this.waterNM = nm;
  }

  // ---------- Gebäude ----------
  addBox(b) {
    const idx = this.boxes.length; this.boxes.push(b);
    const x0 = Math.floor((b.x0 + HALF) / CELL), x1 = Math.floor((b.x1 + HALF) / CELL), z0 = Math.floor((b.z0 + HALF) / CELL), z1 = Math.floor((b.z1 + HALF) / CELL);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (x >= 0 && z >= 0 && x < GN && z < GN) this.bGrid[z * GN + x].push(idx);
  }
  addCircle(x, z, r) {
    const idx = this.circles.length; this.circles.push({ x, z, r });
    const cx = Math.floor((x + HALF) / CELL), cz = Math.floor((z + HALF) / CELL);
    if (cx >= 0 && cz >= 0 && cx < GN && cz < GN) this.cGrid[cz * GN + cx].push(idx);
  }
  buildTowns() {
    const r = this.rnd;
    const wallTex = canvasTex(512, (ctx, s) => {
      const R = mulberry32(9);
      ctx.fillStyle = '#dcc59d'; ctx.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 26) { const off = ((y / 26) & 1) * 32; for (let x = -32; x < s; x += 64) { const v = (R() - 0.5) * 30; ctx.fillStyle = v > 0 ? `rgba(255,238,200,${v / 140})` : `rgba(70,50,30,${-v / 140})`; ctx.fillRect(x + off + 2, y + 2, 60, 22); } }
      ctx.strokeStyle = 'rgba(90,70,45,.3)'; ctx.lineWidth = 2;
      for (let y = 0; y <= s; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke(); }
      for (let y = 0; y < s; y += 26) { const off = ((y / 26) & 1) * 32; for (let x = -32; x < s; x += 64) { ctx.beginPath(); ctx.moveTo(x + off, y); ctx.lineTo(x + off, y + 26); ctx.stroke(); } }
      for (let i = 0; i < 7000; i++) { const lt = R() < 0.5; ctx.fillStyle = lt ? `rgba(255,235,200,${R() * 0.12})` : `rgba(40,30,20,${R() * 0.12})`; ctx.fillRect(R() * s, R() * s, 1 + R() * 3, 1 + R() * 3); }
      for (let i = 0; i < 40; i++) { const x = R() * s, g = ctx.createLinearGradient(0, 0, 0, s * 0.8); g.addColorStop(0, 'rgba(60,40,20,.14)'); g.addColorStop(1, 'rgba(60,40,20,0)'); ctx.fillStyle = g; ctx.fillRect(x, 0, 2 + R() * 6, s * 0.8); }
      ctx.fillStyle = '#ece0c6'; ctx.fillRect(0, 484, s, 28); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 484, s, 3);
      // Bogenfenster mit Läden
      const cx = 256, hw = 62, archY = 190, bot = 400;
      const arch = (w, y0) => { ctx.beginPath(); ctx.moveTo(cx - w, bot); ctx.lineTo(cx - w, archY); ctx.arc(cx, archY, w, Math.PI, 0); ctx.lineTo(cx + w, bot); ctx.closePath(); };
      ctx.strokeStyle = '#b79c70'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, archY, hw + 26, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = '#efe6d2'; arch(hw + 12); ctx.fill();
      const g = ctx.createLinearGradient(0, 120, 0, bot); g.addColorStop(0, '#5f7f92'); g.addColorStop(1, '#1d2a33'); ctx.fillStyle = g; arch(hw); ctx.fill();
      ctx.fillStyle = '#d8cdb4'; ctx.fillRect(cx - 3, 120, 6, bot - 120); ctx.fillRect(cx - hw, 270, hw * 2, 6);
      ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.moveTo(cx - hw + 8, 210); ctx.lineTo(cx - 10, 210); ctx.lineTo(cx - hw + 8, 330); ctx.fill();
      for (const sx of [-1, 1]) { const x0 = cx + sx * (hw + 14) - (sx < 0 ? 52 : 0); ctx.fillStyle = '#6e5538'; ctx.fillRect(x0, 160, 52, bot - 160); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; for (let y = 170; y < bot; y += 12) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + 52, y); ctx.stroke(); } }
      ctx.fillStyle = '#c9bb9a'; ctx.fillRect(cx - hw - 20, bot, hw * 2 + 40, 14); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(cx - hw - 20, bot + 14, hw * 2 + 40, 10);
    }, 0);
    const roofTex = canvasTex(256, (ctx, s) => noiseFill(ctx, s, '#a9a49a', 80, 6000, mulberry32(11)), 0);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, vertexColors: true, roughness: 0.95, bumpMap: wallTex, bumpScale: 1.5 });
    const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, vertexColors: true, roughness: 0.95 });
    const P = [], N = [], U = [], C = [], I = []; const roofGeos = [];
    const palette = [[0.95, 0.9, 0.8], [0.9, 0.82, 0.68], [0.85, 0.78, 0.66], [0.92, 0.85, 0.72], [0.78, 0.7, 0.6], [0.98, 0.95, 0.88], [0.8, 0.72, 0.55], [0.66, 0.8, 0.74], [0.6, 0.72, 0.78], [0.86, 0.66, 0.5]];
    const addWalls = (x0, z0, x1, z1, y0, y1, col) => {
      const faces = [[x0, z1, x1, z1, 0, 1], [x1, z0, x0, z0, 0, -1], [x1, z1, x1, z0, 1, 0], [x0, z0, x0, z1, -1, 0]];
      for (const [ax, az, bx, bz, nx, nz] of faces) {
        const len = Math.hypot(bx - ax, bz - az), base = P.length / 3;
        P.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az);
        for (let k = 0; k < 4; k++) { N.push(nx, 0, nz); C.push(col[0], col[1], col[2]); }
        const vv = (y1 - y0) / 3.4; U.push(0, 0, len / 4, 0, len / 4, vv, 0, vv);
        I.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    };
    const addGeo = (g, col) => {
      const cc = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < cc.length; i += 3) { cc[i] = col[0]; cc[i + 1] = col[1]; cc[i + 2] = col[2]; }
      g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); roofGeos.push(g);
    };
    const addRoofBox = (x0, y0, z0, x1, y1, z1, col) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); addGeo(g, col); };
    const addCyl = (x, y, z, rad, h, col) => { const g = new THREE.CylinderGeometry(rad, rad, h, 12); g.translate(x, y + h / 2, z); addGeo(g, col); };
    const build = (cx, cz, w, d, floors, y) => {
      const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, h = floors * 3.4;
      const col = palette[(r() * palette.length) | 0];
      addWalls(x0, z0, x1, z1, y - 1.5, y + h, col);
      const dark = col.map((v) => v * 0.7);
      addRoofBox(x0 - 0.2, y + h, z0 - 0.2, x1 + 0.2, y + h + 0.3, z1 + 0.2, dark);
      // Brüstung
      addRoofBox(x0 - 0.1, y + h + 0.3, z0 - 0.1, x1 + 0.1, y + h + 0.9, z0 + 0.15, col); addRoofBox(x0 - 0.1, y + h + 0.3, z1 - 0.15, x1 + 0.1, y + h + 0.9, z1 + 0.1, col);
      addRoofBox(x0 - 0.1, y + h + 0.3, z0, x0 + 0.15, y + h + 0.9, z1, col); addRoofBox(x1 - 0.15, y + h + 0.3, z0, x1 + 0.1, y + h + 0.9, z1, col);
      const k = r();
      if (k < 0.4) { const ax = cx + (r() - 0.5) * w * 0.4, az = cz + (r() - 0.5) * d * 0.4; for (let i = 0; i < 4; i++) addCyl(ax + (i % 2) * 0.8, y + h + 0.3 + (i > 1 ? 0.9 : 0), az + (i >> 1) * 0.8 * 0, 0.36, 0.9, i % 2 ? [0.16, 0.45, 0.5] : [0.5, 0.3, 0.18]); }
      else if (k < 0.7) { const ax = cx + (r() - 0.5) * w * 0.4, az = cz + (r() - 0.5) * d * 0.4; addRoofBox(ax - 1.2, y + h + 0.3, az - 1, ax + 1.2, y + h + 1.7, az + 1, [0.55, 0.52, 0.48]); }
      else if (k < 0.85) { const ax = cx + (r() - 0.5) * w * 0.4, az = cz + (r() - 0.5) * d * 0.4; addCyl(ax, y + h + 0.3, az, 1.0, 1.6, [0.3, 0.5, 0.6]); }
      // Vordächer / Balkon
      if (r() < 0.6) { const aw = Math.min(w - 2, 6 + r() * 4), ac = [[0.2, 0.45, 0.3], [0.5, 0.25, 0.2], [0.7, 0.6, 0.4], [0.25, 0.4, 0.55]][(r() * 4) | 0]; addRoofBox(cx - aw / 2, y + 2.7, z1, cx + aw / 2, y + 2.8, z1 + 1.2, ac); }
      if (floors > 1 && r() < 0.6) { const bw = Math.min(w - 3, 5); addRoofBox(cx - bw / 2, y + 3.4, z1, cx + bw / 2, y + 3.55, z1 + 1.1, dark); addRoofBox(cx - bw / 2, y + 3.55, z1 + 1.0, cx + bw / 2, y + 4.4, z1 + 1.1, [0.25, 0.25, 0.25]); }
      this.addBox({ x0, x1, z0, z1, y0: y - 1.5, y1: y + h + 0.9 });
    };
    const wall = (ax, az, bx, bz, y) => {
      const t = 0.35, x0 = Math.min(ax, bx) - (ax === bx ? t : 0), x1 = Math.max(ax, bx) + (ax === bx ? t : 0), z0 = Math.min(az, bz) - (az === bz ? t : 0), z1 = Math.max(az, bz) + (az === bz ? t : 0);
      const col = [0.9, 0.82, 0.68];
      addWalls(x0, z0, x1, z1, y - 1, y + 2.3, col); addRoofBox(x0 - 0.1, y + 2.3, z0 - 0.1, x1 + 0.1, y + 2.5, z1 + 0.1, [0.8, 0.72, 0.6]);
      this.addBox({ x0, x1, z0, z1, y0: y - 1, y1: y + 2.5 });
    };
    this.yards = [];
    for (const t of this.towns) {
      const cell = 36, n = Math.ceil(t.r / cell);
      t.spots = [];
      for (let gz = -n; gz <= n; gz++) for (let gx = -n; gx <= n; gx++) {
        const cx = t.x + gx * cell, cz = t.z + gz * cell;
        if (Math.hypot(gx * cell, gz * cell) > t.r * 0.9) continue;
        t.spots.push([cx + cell / 2, cz + cell / 2]);
        if (gx === 0 && gz === 0 && t.large) continue;
        if (r() < 0.28) {
          // Hof mit Mauer
          if (r() < 0.65) {
            const a = 4, e = cell / 2 - 3, open = (r() * 4) | 0, gap = (r() * 4) | 0;
            const sides = [[cx - e, cz - e, cx + e, cz - e], [cx - e, cz + e, cx + e, cz + e], [cx - e, cz - e, cx - e, cz + e], [cx + e, cz - e, cx + e, cz + e]];
            sides.forEach((sd, i) => {
              if (i === open) return;
              if (i === gap) { const mx = (sd[0] + sd[2]) / 2, mz = (sd[1] + sd[3]) / 2; if (sd[0] === sd[2]) { wall(sd[0], sd[1], sd[2], mz - 3, t.y); wall(sd[0], mz + 3, sd[2], sd[3], t.y); } else { wall(sd[0], sd[1], mx - 3, sd[3], t.y); wall(mx + 3, sd[1], sd[2], sd[3], t.y); } }
              else wall(sd[0], sd[1], sd[2], sd[3], t.y);
            });
            this.yards.push([cx, cz]);
          }
          continue;
        }
        const w = 12 + r() * 14, d = 12 + r() * 14, floors = t.large ? 1 + ((r() * 3) | 0) : 1 + ((r() * 2) | 0);
        build(cx + (r() - 0.5) * 3, cz + (r() - 0.5) * 3, w, d, floors, t.y);
      }
    }
    this.cabins = [];
    let k = 0, tries = 0;
    while (k < 26 && tries++ < 3000) {
      const ang = r() * Math.PI * 2, dist = Math.sqrt(r()) * HALF * 0.66;
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist, h = this.heightAt(x, z);
      if (h < 4 || h > 40 || this.townAt(x, z, 1.6)) continue;
      if (Math.abs(this.heightAt(x + 8, z) - h) > 1.5 || Math.abs(this.heightAt(x, z + 8) - h) > 1.5) continue;
      build(x, z, 8 + r() * 4, 8 + r() * 4, 1, h + 0.5); this.cabins.push([x, z]); k++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
    const walls = new THREE.Mesh(g, wallMat); walls.castShadow = walls.receiveShadow = true;
    const roofs = new THREE.Mesh(mergeGeometries(roofGeos), roofMat); roofs.castShadow = roofs.receiveShadow = true;
    this.scene.add(walls, roofs);
  }

  // ---------- Bäume & Felsen ----------
  chunked(geo, mat, items, { cast = true, color = false } = {}) {
    const CH = 250, groups = new Map();
    for (const it of items) { const k = Math.floor((it.x + HALF) / CH) + ',' + Math.floor((it.z + HALF) / CH); (groups.get(k) || groups.set(k, []).get(k)).push(it); }
    const dummy = new THREE.Object3D(), col = new THREE.Color(), grp = new THREE.Group();
    for (const arr of groups.values()) {
      const im = new THREE.InstancedMesh(geo, mat, arr.length);
      arr.forEach((it, i) => {
        dummy.position.set(it.x, it.y, it.z); dummy.rotation.set(0, it.ry, 0); dummy.scale.set(it.sx, it.sy, it.sx); dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
        if (color) { col.setRGB(it.c[0], it.c[1], it.c[2]); im.setColorAt(i, col); }
      });
      im.castShadow = cast; im.receiveShadow = true; im.computeBoundingSphere(); grp.add(im);
    }
    this.scene.add(grp); return grp;
  }
  buildNature() {
    const r = this.rnd, trees = [], rocks = [], bushes = [];
    let attempts = 0;
    const want = Math.round(this.q.trees * 0.45);
    while (trees.length < want && attempts++ < want * 14) {
      const ang = r() * Math.PI * 2, dist = Math.sqrt(r()) * HALF * 0.7;
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist, h = this.heightAt(x, z);
      if (h < 3.2 || h > 44) continue;
      const dens = this.fbm(x * 0.007 + 300, z * 0.007 + 300, 3) + 0.05;
      if (r() > dens * 1.9) continue;
      const tw = this.townAt(x, z, 1.1);
      if (tw && r() < 0.8) continue;
      if (this.roadDist(x, z) < 6) continue;
      if (Math.abs(this.heightAt(x + 2, z) - h) > 1.3 || Math.abs(this.heightAt(x, z + 2) - h) > 1.3) continue;
      if (this.nearBox(x, z, 3)) continue;
      const s = 0.8 + r() * 0.8, g = 0.85 + r() * 0.3;
      trees.push({ x, y: h - 0.2, z, ry: r() * 6.28, sx: s * (0.85 + r() * 0.3), sy: s, c: [0.22 * g, 0.27 * g + r() * 0.04, 0.09 * g] });
      this.addCircle(x, z, 0.4 * s);
    }
    attempts = 0;
    while (bushes.length < this.q.trees * 0.5 && attempts++ < 40000) {
      const ang = r() * Math.PI * 2, dist = Math.sqrt(r()) * HALF * 0.72, x = Math.cos(ang) * dist, z = Math.sin(ang) * dist, h = this.heightAt(x, z);
      if (h < 2.8 || h > 40 || this.roadDist(x, z) < 4 || this.nearBox(x, z, 1.5)) continue;
      const s = 0.5 + r() * 0.8, g = 0.8 + r() * 0.4; bushes.push({ x, y: h + s * 0.2, z, ry: r() * 6.28, sx: s, sy: s * 0.7, c: [0.4 * g, 0.36 * g, 0.17 * g] });
    }
    const trunk = new THREE.CylinderGeometry(0.2, 0.34, 4.2, 7); trunk.translate(0, 2.1, 0);
    const blobs = [[1.9, 0, 5.0, 0], [1.4, 1.2, 4.4, 0.5], [1.5, -1.0, 4.2, -0.6], [1.2, 0.2, 6.0, -0.3]].map(([rad, x, y, z]) => { const c = new THREE.IcosahedronGeometry(rad, 1); c.translate(x, y, z); return c; });
    const foliage = mergeGeometries(blobs);
    this.chunked(trunk, new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 }), trees);
    this.chunked(foliage, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), trees, { color: true });
    this.chunked(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), bushes, { color: true, cast: false });
    this.treeCount = trees.length;
    attempts = 0;
    while (rocks.length < 380 && attempts++ < 6000) {
      const ang = r() * Math.PI * 2, dist = Math.sqrt(r()) * HALF * 0.72;
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist, h = this.heightAt(x, z);
      if (h < 1 || this.townAt(x, z, 1.0) || this.roadDist(x, z) < 6 || this.nearBox(x, z, 4)) continue;
      const s = 0.8 + r() * 2.6, gv = 0.5 + r() * 0.2;
      rocks.push({ x, y: h + s * 0.15, z, ry: r() * 6.28, sx: s, sy: s * 0.75, c: [gv, gv * 0.86, gv * 0.68] });
      this.addCircle(x, z, s * 0.85);
    }
    const rg = new THREE.IcosahedronGeometry(1, 1); const rp = rg.attributes.position;
    for (let i = 0; i < rp.count; i++) { const f = 0.78 + this.noise(rp.getX(i) * 2.1 + 5, rp.getZ(i) * 2.1 + rp.getY(i)) * 0.45; rp.setXYZ(i, rp.getX(i) * f, rp.getY(i) * f, rp.getZ(i) * f); }
    rg.computeVertexNormals();
    this.chunked(rg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), rocks, { color: true });
  }

  // ---------- Requisiten: Autowracks, Fässer, Reifen, Sandsäcke, Masten ----------
  buildProps() {
    const r = this.rnd, G = [], M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
    let gm = new THREE.Matrix4();
    const group = (x, y, z, ry) => { gm = new THREE.Matrix4().compose(V.set(x, y, z), Q.setFromEuler(E.set(0, ry, 0)), S1); };
    const part = (geo, col, lx, ly, lz, rx = 0, ry = 0, rz = 0) => {
      const g = geo.clone(); M.compose(V.set(lx, ly, lz), Q.setFromEuler(E.set(rx, ry, rz)), S1); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(gm, M));
      const cc = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < cc.length; i += 3) { cc[i] = col[0]; cc[i + 1] = col[1]; cc[i + 2] = col[2]; }
      g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); G.push(g);
    };
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (rt, rb, h, sg = 10) => new THREE.CylinderGeometry(rt, rb, h, sg), sph = (rr) => new THREE.SphereGeometry(rr, 8, 6);
    const car = (x, z) => {
      const y = this.heightAt(x, z), ry = r() * 6.28, pick = r();
      const c = pick < 0.35 ? [0.42, 0.22, 0.1] : pick < 0.6 ? [0.12, 0.11, 0.1] : pick < 0.8 ? [0.38, 0.42, 0.46] : [0.5, 0.45, 0.38];
      group(x, y, z, ry); const lift = r() < 0.3 ? -0.12 : 0;
      part(box(4.3, 0.65, 1.8), c, 0, 0.55 + lift, 0); part(box(1.5, 0.12, 1.7), c.map((v) => v * 0.9), 1.4, 0.92 + lift, 0, 0, 0, 0.05);
      part(box(2.1, 0.7, 1.55), c.map((v) => v * 0.95), -0.3, 1.2 + lift, 0); part(box(2.0, 0.42, 1.62), [0.05, 0.06, 0.07], -0.3, 1.25 + lift, 0); part(box(1.9, 0.1, 1.5), c.map((v) => v * 0.85), -0.3, 1.6 + lift, 0);
      for (const [wx, wz] of [[1.4, 0.9], [1.4, -0.9], [-1.4, 0.9], [-1.4, -0.9]]) if (r() < 0.85) part(cyl(0.33, 0.33, 0.22, 12), [0.04, 0.04, 0.04], wx, 0.33 + lift * 0.5, wz, Math.PI / 2, 0, 0);
      const ca = Math.cos(ry), sa = -Math.sin(ry); this.addCircle(x + ca * 1.3, z + sa * 1.3, 1.0); this.addCircle(x - ca * 1.3, z - sa * 1.3, 1.0);
    };
    const barrels = (x, z) => {
      const n = 3 + ((r() * 4) | 0), cols = [[0.14, 0.42, 0.48], [0.45, 0.27, 0.15], [0.12, 0.2, 0.4], [0.5, 0.12, 0.1]], c = cols[(r() * cols.length) | 0];
      for (let i = 0; i < n; i++) { const bx = x + (r() - 0.5) * 2.4, bz = z + (r() - 0.5) * 2.4, by = this.heightAt(bx, bz); group(bx, by, bz, 0); part(cyl(0.3, 0.3, 0.9), c, 0, 0.45, 0); part(cyl(0.31, 0.31, 0.06), c.map((v) => v * 0.6), 0, 0.9, 0); part(cyl(0.31, 0.31, 0.04), c.map((v) => v * 0.6), 0, 0.5, 0); this.addCircle(bx, bz, 0.36); }
      const y = this.heightAt(x, z); if (r() < 0.6) { group(x, y, z, r() * 6); part(box(1.4, 0.2, 1.2), [0.35, 0.28, 0.18], 0, 1.0, 0, 0.1, 0, 0.05); }
    };
    const tires = (x, z) => { const y = this.heightAt(x, z), n = 3 + ((r() * 4) | 0); group(x, y, z, 0); for (let i = 0; i < n; i++) part(new THREE.TorusGeometry(0.34, 0.14, 8, 14).rotateX(Math.PI / 2), [0.05, 0.05, 0.05], (r() - 0.5) * 0.08, 0.14 + i * 0.28, (r() - 0.5) * 0.08); this.addCircle(x, z, 0.5); };
    const sandbags = (x, z) => { const y = this.heightAt(x, z), q = r() < 0.5, hx = q ? 1.25 : 0.35, hz = q ? 0.35 : 1.25; group(x, y, z, q ? 0 : Math.PI / 2); for (let i = 0; i < 3; i++) part(box(2.4, 0.3, 0.6), [0.62 - i * 0.03, 0.54, 0.38], (r() - 0.5) * 0.2, 0.15 + i * 0.3, 0); this.addBox({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, y0: y - 0.2, y1: y + 0.95 }); };
    const barrier = (x, z) => { const y = this.heightAt(x, z), q = r() < 0.5, hx = q ? 1.5 : 0.3, hz = q ? 0.3 : 1.5; group(x, y, z, q ? 0 : Math.PI / 2); part(box(3, 1.0, 0.55), [0.62, 0.6, 0.55], 0, 0.5, 0); part(box(3.02, 0.25, 0.8), [0.6, 0.58, 0.53], 0, 0.12, 0); this.addBox({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, y0: y - 0.2, y1: y + 1.05 }); };
    const dumpster = (x, z) => { const y = this.heightAt(x, z), ry = r() * 6.28; group(x, y, z, ry); part(box(2, 1.1, 1.1), [0.16, 0.3, 0.22], 0, 0.65, 0); for (let i = 0; i < 4; i++) part(sph(0.35), [0.04, 0.04, 0.04], -0.7 + i * 0.5, 1.3, (r() - 0.5) * 0.4); this.addCircle(x, z, 0.8); };
    const fns = [[car, 0.3], [barrels, 0.25], [tires, 0.15], [sandbags, 0.1], [barrier, 0.1], [dumpster, 0.1]];
    const pickFn = () => { let v = r(); for (const [f, w] of fns) { if (v < w) return f; v -= w; } return car; };
    for (const t of this.towns) {
      const n = t.large ? 46 : 26; let k = 0, g = 0;
      while (k < n && g++ < n * 12) {
        const a = r() * 6.28, d = Math.sqrt(r()) * t.r * 0.95, x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
        if (this.nearBox(x, z, 3.5)) continue;
        pickFn()(x, z); k++;
      }
    }
    for (const [x, z] of this.yards) for (let i = 0; i < 2; i++) { const px = x + (r() - 0.5) * 18, pz = z + (r() - 0.5) * 18; if (!this.nearBox(px, pz, 2.5)) pickFn()(px, pz); }
    for (const [ax, az, bx, bz] of this.roads) { const L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / 120); for (let i = 1; i < n; i++) if (r() < 0.5) { const f = i / n, x = ax + (bx - ax) * f + (r() - 0.5) * 6, z = az + (bz - az) * f + (r() - 0.5) * 6; if (!this.townAt(x, z, 1.2) && this.heightAt(x, z) > 2) car(x, z); } }
    // Strommasten + Leitungen
    const wires = []; const poleMat = [0.2, 0.15, 0.1];
    for (const [ax, az, bx, bz] of this.roads) {
      const L = Math.hypot(bx - ax, bz - az), n = Math.floor(L / 42), dx = (bx - ax) / L, dz = (bz - az) / L; let prev = null;
      for (let i = 1; i < n; i++) {
        const x = ax + dx * 42 * i - dz * 5, z = az + dz * 42 * i + dx * 5, y = this.heightAt(x, z); if (y < 1.5 || this.nearBox(x, z, 1)) { prev = null; continue; }
        group(x, y, z, Math.atan2(dx, dz)); part(cyl(0.11, 0.15, 8.2, 6), poleMat, 0, 4.1, 0); part(box(1.9, 0.12, 0.12), poleMat, 0, 7.5, 0); this.addCircle(x, z, 0.25);
        const cur = [[-0.8, 0.8].map((o) => [x + dz * o, y + 7.55, z - dx * o]), [0].map(() => [x, y + 7.55, z])].flat();
        const pts = [[x - dz * 0.8, y + 7.6, z + dx * 0.8], [x, y + 7.6, z], [x + dz * 0.8, y + 7.6, z - dx * 0.8]];
        if (prev) for (let w = 0; w < 3; w++) { const p0 = prev[w], p1 = pts[w], m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 - 0.9, (p0[2] + p1[2]) / 2]; wires.push(...p0, ...m, ...m, ...p1); }
        prev = pts;
      }
    }
    const rustTex = canvasTex(256, (ctx, sz) => { noiseFill(ctx, sz, '#cfcfcf', 110, 9000, mulberry32(31)); const R = mulberry32(32); for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(80,40,10,${R() * 0.12})`; ctx.fillRect(R() * sz, R() * sz, 2 + R() * 6, 20 + R() * 80); } }, 0);
    const mesh = new THREE.Mesh(mergeGeometries(G), new THREE.MeshStandardMaterial({ vertexColors: true, map: rustTex, roughness: 0.8, metalness: 0.3 }));
    mesh.castShadow = mesh.receiveShadow = true; this.scene.add(mesh);
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3));
    this.scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x141414 })));
  }
  nearBox(x, z, m) {
    const cx = Math.floor((x + HALF) / CELL), cz = Math.floor((z + HALF) / CELL);
    if (cx < 0 || cz < 0 || cx >= GN || cz >= GN) return false;
    for (const i of this.bGrid[cz * GN + cx]) { const b = this.boxes[i]; if (x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m) return true; }
    return false;
  }

  // ---------- Kisten ----------
  buildCrateMeshes() {
    const MAXC = 700; this.maxCrates = MAXC;
    const tex = canvasTex(128, (ctx, s) => {
      noiseFill(ctx, s, '#d8d8d8', 60, 1500, mulberry32(21));
      ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, s - 6, s - 6);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s, s); ctx.moveTo(s, 0); ctx.lineTo(0, s); ctx.stroke();
    }, 0);
    this.crateMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.9, 0.9), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.1 }), MAXC);
    this.crateMesh.frustumCulled = false; this.crateMesh.castShadow = true; this.crateMesh.receiveShadow = true; this.crateMesh.count = 0;
    const bg = new THREE.CylinderGeometry(0.16, 0.16, 36, 8, 1, true); bg.translate(0, 18, 0);
    this.beamMesh = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), MAXC);
    this.beamMesh.frustumCulled = false; this.beamMesh.count = 0;
    this.scene.add(this.crateMesh, this.beamMesh);
  }
  refreshCrate(i) {
    const c = this.crates[i], d = this._d || (this._d = new THREE.Object3D()), col = new THREE.Color(TIER_COLORS[c.tier]);
    d.position.set(c.x, c.y + (c.opened ? 0.25 : 0.45), c.z); d.rotation.set(0, c.rot, 0); d.scale.set(1, c.opened ? 0.45 : 1, 1); d.updateMatrix();
    this.crateMesh.setMatrixAt(i, d.matrix);
    if (c.opened) col.multiplyScalar(0.35);
    this.crateMesh.setColorAt(i, col);
    d.position.set(c.x, c.y, c.z); d.rotation.set(0, 0, 0); d.scale.setScalar(c.opened || c.tier === 0 ? 0.0001 : 1); d.updateMatrix();
    this.beamMesh.setMatrixAt(i, d.matrix);
    this.beamMesh.setColorAt(i, new THREE.Color(TIER_COLORS[c.tier]));
    this.crateMesh.count = this.beamMesh.count = this.crates.length;
    this.crateMesh.instanceMatrix.needsUpdate = this.beamMesh.instanceMatrix.needsUpdate = true;
    this.crateMesh.instanceColor.needsUpdate = this.beamMesh.instanceColor.needsUpdate = true;
  }
  addCrate(x, z, tier, loot = null, y) {
    if (this.crates.length >= this.maxCrates) return null;
    const c = { x, z, y: y ?? this.heightAt(x, z), tier, opened: false, loot, rot: Math.random() * 6.28 };
    this.crates.push(c); this.refreshCrate(this.crates.length - 1); return c;
  }
  openCrate(c) { c.opened = true; this.refreshCrate(this.crates.indexOf(c)); }
  resetCrates() {
    this.crates.length = this.baseCrates;
    this.crates.forEach((c, i) => { c.opened = false; this.refreshCrate(i); });
    this.crateMesh.count = this.beamMesh.count = this.crates.length;
  }
  placeCrates() {
    const r = this.rnd;
    const tier = () => { const v = r(); return v < 0.7 ? 0 : v < 0.93 ? 1 : 2; };
    const tryPlace = (x, z) => { if (this.nearBox(x, z, 1.5)) return false; this.addCrate(x, z, tier()); return true; };
    for (const t of this.towns) {
      let want = t.large ? 14 : 8, n = 0, guard = 0;
      while (n < want && guard++ < 200) {
        const s = t.spots[(r() * t.spots.length) | 0]; if (!s) break;
        if (tryPlace(s[0] + (r() - 0.5) * 8, s[1] + (r() - 0.5) * 8)) n++;
      }
    }
    for (const [x, z] of this.cabins) { for (let a = 0; a < 20; a++) if (tryPlace(x + (r() - 0.5) * 22, z + (r() - 0.5) * 22)) break; }
    let k = 0, tries = 0;
    while (k < 50 && tries++ < 2000) {
      const ang = r() * 6.28, dist = Math.sqrt(r()) * HALF * 0.66, x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      if (this.heightAt(x, z) < 3.5) continue;
      if (tryPlace(x, z)) k++;
    }
    this.baseCrates = this.crates.length;
  }
  nearestCrate(x, y, z, maxD) {
    let best = null, bd = maxD * maxD;
    for (const c of this.crates) {
      if (c.opened) continue;
      const dx = c.x - x, dz = c.z - z; if (dx * dx + dz * dz > bd) continue;
      if (Math.abs(c.y - y) > 3) continue;
      bd = dx * dx + dz * dz; best = c;
    }
    return best;
  }

  // ---------- Kollision & Strahlen ----------
  gridIdx(x, z) { const cx = Math.floor((x + HALF) / CELL), cz = Math.floor((z + HALF) / CELL); return cx < 0 || cz < 0 || cx >= GN || cz >= GN ? -1 : cz * GN + cx; }
  groundAt(x, z, feetY) {
    let g = this.heightAt(x, z); const gi = this.gridIdx(x, z);
    if (gi >= 0) for (const i of this.bGrid[gi]) { const b = this.boxes[i]; if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && feetY >= b.y1 - 0.35 && b.y1 > g) g = b.y1; }
    return g;
  }
  collide(p, r, feetY, h) {
    let hit = false;
    const cx0 = Math.floor((p.x - r + HALF) / CELL), cx1 = Math.floor((p.x + r + HALF) / CELL), cz0 = Math.floor((p.z - r + HALF) / CELL), cz1 = Math.floor((p.z + r + HALF) / CELL);
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
      if (cx < 0 || cz < 0 || cx >= GN || cz >= GN) continue;
      const gi = cz * GN + cx;
      for (const i of this.bGrid[gi]) {
        const b = this.boxes[i];
        if (feetY >= b.y1 - 0.35 || feetY + h <= b.y0) continue;
        const qx = Math.max(b.x0, Math.min(b.x1, p.x)), qz = Math.max(b.z0, Math.min(b.z1, p.z));
        let dx = p.x - qx, dz = p.z - qz; const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hit = true;
        if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
        else { const l = p.x - b.x0, rr = b.x1 - p.x, t = p.z - b.z0, bt = b.z1 - p.z, m = Math.min(l, rr, t, bt); if (m === l) p.x = b.x0 - r; else if (m === rr) p.x = b.x1 + r; else if (m === t) p.z = b.z0 - r; else p.z = b.z1 + r; }
      }
      for (const i of this.cGrid[gi]) {
        const c = this.circles[i], dx = p.x - c.x, dz = p.z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2), k = (rr - d) / d; p.x += dx * k; p.z += dz * k; hit = true; }
      }
    }
    return hit;
  }
  // erster Treffer eines Strahls mit Gebäuden/Gelände. Rückgabe: Distanz t oder -1.
  ray(ox, oy, oz, dx, dy, dz, maxT) {
    let best = maxT, kind = -1;
    const seen = (this._seen || (this._seen = new Set())); seen.clear();
    for (let s = 0; s <= best; s += 8) {
      const gi = this.gridIdx(ox + dx * s, oz + dz * s); if (gi < 0) continue;
      for (const i of this.bGrid[gi]) {
        if (seen.has(i)) continue; seen.add(i);
        const b = this.boxes[i]; let tmin = 0, tmax = 1e9, ok = true;
        const axes = [[ox, dx, b.x0, b.x1], [oy, dy, b.y0, b.y1], [oz, dz, b.z0, b.z1]];
        for (const [o, d, lo, hi] of axes) {
          if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } }
          else { let t1 = (lo - o) / d, t2 = (hi - o) / d; if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) { ok = false; break; } }
        }
        if (ok && tmin < best) { best = tmin; kind = 1; }
      }
    }
    let t = 0.5, prev = 0;
    while (t < best) {
      if (oy + dy * t < this.heightAt(ox + dx * t, oz + dz * t)) {
        let lo = prev, hi = t;
        for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (oy + dy * m < this.heightAt(ox + dx * m, oz + dz * m)) hi = m; else lo = m; }
        if (hi < best) { best = hi; kind = 0; }
        break;
      }
      prev = t; t += 1 + t * 0.012;
    }
    this.lastKind = kind;
    return kind < 0 ? -1 : best;
  }
  randomLandPoint(rnd, maxR = 0.62) {
    for (let i = 0; i < 200; i++) {
      const ang = rnd() * 6.28, dist = Math.sqrt(rnd()) * HALF * maxR, x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      if (this.heightAt(x, z) > 2.5 && !this.nearBox(x, z, 3)) return [x, z];
    }
    return [0, 0];
  }

  // ---------- Karte (2D) ----------
  buildMapCanvas() {
    const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
    const ctx = c.getContext('2d'), img = ctx.createImageData(S, S);
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const x = (px / S - 0.5) * MAP, z = (py / S - 0.5) * MAP, h = this.heightAt(x, z);
      const sh = (this.heightAt(x + 6, z + 6) - this.heightAt(x - 6, z - 6)) * 0.025;
      let r, g, b;
      if (h < 0) { const d = Math.min(1, -h / 12); r = 34 - d * 14; g = 92 - d * 30; b = 128 - d * 30; }
      else if (h < 2.6) { r = 208; g = 192; b = 150; }
      else if (h > 28) { r = 124; g = 118; b = 108; }
      else { r = 176 + h * 0.4; g = 150 + h * 0.3; b = 106; }
      if (h >= 0) { r += sh * 80; g += sh * 80; b += sh * 80; }
      const i = (py * S + px) * 4; img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const k = S / MAP;
    ctx.strokeStyle = 'rgba(150,115,80,.9)'; ctx.lineWidth = 2;
    for (const [ax, az, bx, bz] of this.roads) { ctx.beginPath(); ctx.moveTo((ax + HALF) * k, (az + HALF) * k); ctx.lineTo((bx + HALF) * k, (bz + HALF) * k); ctx.stroke(); }
    for (const t of this.towns) { ctx.fillStyle = 'rgba(210,210,205,.85)'; ctx.beginPath(); ctx.arc((t.x + HALF) * k, (t.z + HALF) * k, t.r * 0.8 * k, 0, 6.28); ctx.fill(); }
    this.mapCanvas = c;
  }

  update(dt, camPos) {
    const sun = this.sun;
    sun.position.copy(camPos).addScaledVector(this.sunDir, 250);
    sun.target.position.copy(camPos);
    this.waterNM.offset.x += dt * 0.004; this.waterNM.offset.y += dt * 0.0025;
  }
}
