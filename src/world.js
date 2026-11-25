import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildCities, buildCityProps, NY_NAMES, LDN_NAMES } from './city.js';
import { spawnVehicles } from './vehicles.js';
import { ASSET, texOf } from './assets.js';

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

export function canvasTex(size, draw, repeat, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}
export function noiseFill(ctx, size, base, amp, n = 6000, rnd = Math.random) {
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    const v = ((rnd() - 0.5) * amp) | 0;
    ctx.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`;
    const s = 1 + rnd() * 3;
    ctx.fillRect(rnd() * size, rnd() * size, s, s);
  }
}

const TOWN_NAMES = ['Port Nova', 'Kaserne Nord', 'Flughafen Delta', 'Raffinerie', 'Birkental', 'Steinbruch', 'Funkturm Echo', 'Fischerdorf', 'Industriepark', 'Altstadt', 'Seeblick', 'Bunkeranlage', 'Basis Alpha', 'Klinik St. Marek', 'Hochland', 'Zollhafen'];
export const TIER_COLORS = [0x8a6a3a, 0x3a86e0, 0xf0b020, 0x6a7078, 0xb43cff];

export class World {
  constructor(renderer, scene, q, seed = 1337) {
    this.renderer = renderer; this.scene = scene; this.q = q; this.seed = seed;
    this.rnd = mulberry32(seed);
    this.noise = makePerlin(seed * 7 + 13); this.vehicles = [];
    this.towns = []; this.roads = []; this.boxes = []; this.circles = [];
    this.bGrid = Array.from({ length: GN * GN }, () => []);
    this.cGrid = Array.from({ length: GN * GN }, () => []);
    this.crates = []; this.baseCrates = 0; this._stamp = 0;
    this.cageZone = null;
  }
  static async create(renderer, scene, q, seed, progress) { const w = new World(renderer, scene, q, seed); await w.build(progress); return w; }
  // Aufbau in Etappen, damit der Browser dazwischen reagieren kann (kein Einfrieren, Ladebalken)
  async build(progress) {
    const stages = [['Gelände berechnen…', () => this.buildTerrainData()], ['Himmel & Licht…', () => this.buildSky()], ['Gelände modellieren…', () => this.buildTerrainMesh()], ['Wasser…', () => this.buildWater()],
      ['Städte bauen…', () => this.buildTowns()], ['Vegetation pflanzen…', () => this.buildNature()], ['Straßen einrichten…', () => this.buildProps()], ['Kisten verteilen…', () => { this.buildCrateMeshes(); this.placeCrates(); }],
      ['Fahrzeuge aufstellen…', () => spawnVehicles(this)], ['Karte zeichnen…', () => this.buildMapCanvas()]];
    for (let i = 0; i < stages.length; i++) { progress && progress(stages[i][0], i / stages.length); await new Promise((r) => setTimeout(r, 30)); stages[i][1](); }
    progress && progress('Fertig', 1);
  }

  // ---------- Höhenfeld ----------
  fbm(x, z, oct = 5) { let a = 0.5, f = 1, s = 0; for (let i = 0; i < oct; i++) { s += a * this.noise(x * f, z * f); f *= 2; a *= 0.5; } return s; }
  baseHeight(x, z) {
    const n = this.fbm(x * 0.0011, z * 0.0011), m = this.fbm(x * 0.0045 + 100, z * 0.0045 + 100, 4);
    const d = Math.hypot(x, z) / HALF;
    const island = 1 - smooth(0.7, 1.0, d);
    const h = 10 + n * 10 + m * 2;
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
    // Städte platzieren (New-York- und London-Viertel, zufällig gemischt)
    const shuf = (a2) => { a2 = a2.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
    const names = { ny: shuf(NY_NAMES), ldn: shuf(LDN_NAMES) };
    let tries = 0; const WANT = 10;
    while (this.towns.length < WANT && tries++ < 12000) {
      const large = this.towns.length < 4, rad = large ? 125 : 85;
      const ang = r() * Math.PI * 2, dist = Math.sqrt(r()) * (HALF * 0.68 - rad);
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist;
      const h = this.baseHeight(x, z);
      if (h < 4.5 || h > 17) continue;
      if (this.towns.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + rad + 25)) continue;
      const i = this.towns.length, type = i === 0 ? 'ny' : i === 1 ? 'ldn' : r() < 0.5 ? 'ny' : 'ldn';
      this.towns.push({ name: names[type].pop() || 'Viertel ' + i, type, x, z, r: rad, y: Math.max(5, h), large });
    }
    const nyC = this.towns.filter((t) => t.type === 'ny').length;
    this.mapName = nyC && nyC < this.towns.length ? 'New York × London' : nyC ? 'New York' : 'London';
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
    u.turbidity.value = 12; u.rayleigh.value = 0.25; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.85;
    const phi = THREE.MathUtils.degToRad(90 - 4), theta = THREE.MathUtils.degToRad(150);
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(this.sunDir);
    scene.add(sky); this.sky = sky;
    const envScene = new THREE.Scene(); const sky2 = sky.clone(); envScene.add(sky2);
    const pm = new THREE.PMREMGenerator(renderer);
    this.envRT = pm.fromScene(envScene, 0.02);
    scene.environment = this.envRT.texture; scene.environmentIntensity = 0.28;
    pm.dispose();
    scene.fog = new THREE.FogExp2(0x4a525e, q.fog * 1.1);
    scene.background = null;
    this.hemi = new THREE.HemisphereLight(0x7f90b0, 0x3a3a34, 0.28); scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xffb070, 1.6);
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
      c.setRGB(0.24 + nv * 0.06, 0.37 + nv * 0.08, 0.14 + nv * 0.04); // Gras
      const dg = this.noise(x * 0.006 + 50, z * 0.006 + 80) + nv * 0.3;
      if (dg > 0.1) { tmp.setRGB(0.4 + nv * 0.05, 0.39 + nv * 0.05, 0.2); c.lerp(tmp, smooth(0.1, 0.4, dg) * 0.6); }
      if (h > 14) { tmp.setRGB(0.42, 0.4, 0.34); c.lerp(tmp, smooth(14, 22, h) * 0.7); }
      if (slope > 0.1) { tmp.setRGB(0.42 + nv * 0.05, 0.38 + nv * 0.05, 0.3); c.lerp(tmp, smooth(0.1, 0.3, slope)); }
      if (h < 3.4) { tmp.setRGB(0.76, 0.7, 0.52); c.lerp(tmp, 1 - smooth(1.2, 3.4, h)); }
      if (h < 0.6) { tmp.setRGB(0.34, 0.31, 0.24); c.lerp(tmp, 1 - smooth(-1.5, 0.6, h)); }
      const rd = this.roadDist(x, z);
      if (rd < 5) { tmp.setRGB(0.2, 0.2, 0.21); c.lerp(tmp, (1 - smooth(2.5, 5, rd)) * 0.95); }
      for (const t of this.towns) {
        const d = Math.hypot(x - t.x, z - t.z);
        if (d < t.r * 1.25) { tmp.setRGB(0.4 + nv * 0.04, 0.4 + nv * 0.04, 0.38); c.lerp(tmp, 1 - smooth(t.r * 0.85, t.r * 1.25, d)); }
      }
      if (ASSET.img.leafy_grass_diff) c.multiplyScalar(1.85);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const detail = canvasTex(1024, (ctx, s) => { noiseFill(ctx, s, '#b8b8b8', 90, 40000, mulberry32(5)); const r = mulberry32(6); for (let i = 0; i < 1500; i++) { const lt = r() < 0.5 ? 255 : 0; ctx.fillStyle = `rgba(${lt},${lt},${lt},${0.1 + r() * 0.12})`; ctx.beginPath(); ctx.ellipse(r() * s, r() * s, 1 + r() * 4, 1 + r() * 3, r() * 3, 0, 6.3); ctx.fill(); } }, MAP / 9);
    const gm = texOf('leafy_grass_diff', MAP / 7), gn = texOf('leafy_grass_nor', MAP / 7, MAP / 7, false);
    const mat = gm ? new THREE.MeshStandardMaterial({ vertexColors: true, map: gm, normalMap: gn, normalScale: new THREE.Vector2(1.1, 1.1), roughness: 0.95, metalness: 0 }) : new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, bumpMap: detail, bumpScale: 1.2, roughness: 0.95, metalness: 0 });
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
  buildTowns() { buildCities(this); }

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
    for (const pt of this.parkTrees || []) { const g = 0.85 + r() * 0.3; trees.push({ x: pt.x, y: this.heightAt(pt.x, pt.z) - 0.2, z: pt.z, ry: r() * 6.28, sx: pt.s, sy: pt.s, c: [0.18 * g, 0.3 * g, 0.1 * g] }); this.addCircle(pt.x, pt.z, 0.4 * pt.s); }
    let attempts = 0;
    const want = trees.length + Math.round(this.q.trees * 0.3);
    while (trees.length < want && attempts++ < want * 14) {
      const ang = r() * Math.PI * 2, dist = Math.sqrt(r()) * HALF * 0.7;
      const x = Math.cos(ang) * dist, z = Math.sin(ang) * dist, h = this.heightAt(x, z);
      if (h < 3.2 || h > 44) continue;
      const dens = this.fbm(x * 0.007 + 300, z * 0.007 + 300, 3) + 0.05;
      if (r() > dens * 1.9) continue;
      const tw = this.townAt(x, z, 1.1);
      if (tw) continue;
      if (this.roadDist(x, z) < 6) continue;
      if (Math.abs(this.heightAt(x + 2, z) - h) > 1.3 || Math.abs(this.heightAt(x, z + 2) - h) > 1.3) continue;
      if (this.nearBox(x, z, 3)) continue;
      const s = 0.8 + r() * 0.8, g = 0.85 + r() * 0.3;
      trees.push({ x, y: h - 0.2, z, ry: r() * 6.28, sx: s * (0.85 + r() * 0.3), sy: s, c: [0.16 * g, 0.28 * g + r() * 0.05, 0.09 * g] });
      this.addCircle(x, z, 0.4 * s);
    }
    attempts = 0;
    while (bushes.length < this.q.trees * 0.3 && attempts++ < 40000) {
      const ang = r() * Math.PI * 2, dist = Math.sqrt(r()) * HALF * 0.72, x = Math.cos(ang) * dist, z = Math.sin(ang) * dist, h = this.heightAt(x, z);
      if (h < 2.8 || h > 40 || this.roadDist(x, z) < 4 || this.nearBox(x, z, 1.5)) continue;
      const s = 0.5 + r() * 0.8, g = 0.8 + r() * 0.4; bushes.push({ x, y: h + s * 0.2, z, ry: r() * 6.28, sx: s, sy: s * 0.7, c: [0.22 * g, 0.3 * g, 0.12 * g] });
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

  buildProps() { buildCityProps(this); }

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
    const cd = texOf('crate_diff'), cn = texOf('crate_nor', 1, 1, false);
    this.crateMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.9, 0.9), cd ? new THREE.MeshStandardMaterial({ map: cd, normalMap: cn, roughness: 0.8, metalness: 0.05 }) : new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.1 }), MAXC);
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
        const b = this.boxes[i]; let tmin = 0, tmax = 1e9, ok = true, ax = -1, sg = 1;
        const axes = [[ox, dx, b.x0, b.x1], [oy, dy, b.y0, b.y1], [oz, dz, b.z0, b.z1]];
        for (let k = 0; k < 3; k++) {
          const [o, d, lo, hi] = axes[k];
          if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { ok = false; break; } }
          else { let t1 = (lo - o) / d, t2 = (hi - o) / d; if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; } if (t1 > tmin) { tmin = t1; ax = k; sg = d > 0 ? -1 : 1; } if (t2 < tmax) tmax = t2; if (tmin > tmax) { ok = false; break; } }
        }
        if (ok && tmin < best) { best = tmin; kind = 1; this.lastN = ax === 0 ? [sg, 0, 0] : ax === 1 ? [0, sg, 0] : ax === 2 ? [0, 0, sg] : [0, 1, 0]; }
      }
    }
    let t = 0.5, prev = 0;
    while (t < best) {
      if (oy + dy * t < this.heightAt(ox + dx * t, oz + dz * t)) {
        let lo = prev, hi = t;
        for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (oy + dy * m < this.heightAt(ox + dx * m, oz + dz * m)) hi = m; else lo = m; }
        if (hi < best) { best = hi; kind = 0; const hx = ox + dx * hi, hz = oz + dz * hi, nx = this.heightAt(hx - 1, hz) - this.heightAt(hx + 1, hz), nz = this.heightAt(hx, hz - 1) - this.heightAt(hx, hz + 1), nl = Math.hypot(nx, 2, nz); this.lastN = [nx / nl, 2 / nl, nz / nl]; }
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
      else if (h < 2.6) { r = 200; g = 190; b = 150; }
      else if (h > 28) { r = 124; g = 118; b = 108; }
      else { r = 84 + h * 0.8; g = 120 + h * 0.5; b = 70; }
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

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }
    });
    this.envRT && this.envRT.dispose();
  }
}
