import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Menschliche Figur (Ursprung = Füße, Blick = -Z) mit Gesicht, Händen mit Fingern, Stiefeln, Ausrüstung und Stofftexturen.
const sph = (r, ws = 18, hs = 14, a = 0, b = Math.PI * 2, c = 0, d = Math.PI) => new THREE.SphereGeometry(r, ws, hs, a, b, c, d);
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const S = (g, x, y, z) => { g.scale(x, y, z); return g; };
const T = (g, x, y, z, rx = 0, ry = 0, rz = 0) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; };
const M = (...g) => mergeGeometries(g);

function headGeo() { return M(S(sph(0.105, 24, 18), 0.9, 1.15, 1.02), T(S(sph(0.058, 14, 10), 1.1, 0.85, 0.95), 0, -0.088, -0.03)); }
function handGeo(s) {
  const parts = [T(box(0.078, 0.085, 0.036), 0, -0.04, 0), T(cap(0.011, 0.045), 0, -0.1, 0.0, 0.5)];
  for (let i = 0; i < 4; i++) parts.push(T(cap(0.0105, 0.04), -0.027 + i * 0.018, -0.1, -0.02, -0.9));
  parts.push(T(cap(0.012, 0.04), s * 0.045, -0.055, -0.025, -0.6, 0, s * 0.6));
  return M(...parts);
}
function shoeGeo() { return M(T(box(0.105, 0.07, 0.25), 0, 0.0, -0.045), T(box(0.1, 0.15, 0.115), 0, 0.09, 0.03), T(box(0.108, 0.022, 0.27), 0, -0.045, -0.045), T(S(sph(0.05, 10, 8), 1.0, 0.7, 1), 0, 0.0, -0.15)); }

export const HUMAN_PARTS = [
  { k: 'pelvis', role: 'pants', geo: () => S(sph(0.16), 1.3, 0.85, 0.9) },
  { k: 'belt', role: 'belt', geo: () => M(box(0.36, 0.05, 0.23), box(0.05, 0.04, 0.012)) },
  { k: 'torso', role: 'jacket', geo: () => S(cap(0.14, 0.28), 1.3, 1, 0.82) },
  { k: 'vest', role: 'vest', geo: () => M(box(0.37, 0.27, 0.25), T(box(0.1, 0.1, 0.05), -0.08, -0.04, -0.14), T(box(0.1, 0.1, 0.05), 0.08, -0.04, -0.14)) },
  { k: 'pack', role: 'pack', geo: () => M(box(0.3, 0.38, 0.14), T(box(0.26, 0.12, 0.1), 0, -0.1, 0.1)) },
  { k: 'collar', role: 'collar', geo: () => new THREE.CylinderGeometry(0.075, 0.095, 0.05, 14) },
  { k: 'neck', role: 'skin', geo: () => new THREE.CylinderGeometry(0.048, 0.056, 0.12, 12) },
  { k: 'head', role: 'skin', geo: headGeo },
  { k: 'hair', role: 'hair', geo: () => S(sph(0.112, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), 0.92, 1.16, 1.06) },
  { k: 'pony', role: 'hair', geo: () => S(sph(0.05, 10, 8), 0.8, 2.2, 0.9) },
  { k: 'cap', role: 'cap', geo: () => S(sph(0.118, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 0.92, 1.05, 1.08) },
  { k: 'brim', role: 'cap', geo: () => box(0.15, 0.012, 0.1) },
  { k: 'helmet', role: 'helmet', geo: () => M(S(sph(0.128, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), 0.98, 1.08, 1.12), T(box(0.02, 0.04, 0.1), 0, 0.12, -0.02)) },
  { k: 'browL', role: 'hair', geo: () => box(0.052, 0.009, 0.014) },
  { k: 'browR', role: 'hair', geo: () => box(0.052, 0.009, 0.014) },
  { k: 'eyeWL', role: 'white', geo: () => S(sph(0.0165, 10, 8), 1.2, 0.8, 0.5) },
  { k: 'eyeWR', role: 'white', geo: () => S(sph(0.0165, 10, 8), 1.2, 0.8, 0.5) },
  { k: 'eyeL', role: 'iris', geo: () => S(sph(0.0095, 8, 6), 1, 1, 0.5) },
  { k: 'eyeR', role: 'iris', geo: () => S(sph(0.0095, 8, 6), 1, 1, 0.5) },
  { k: 'nose', role: 'skin', geo: () => M(box(0.02, 0.04, 0.03), T(S(sph(0.016, 8, 6), 1.3, 0.9, 1), 0, -0.02, -0.012)) },
  { k: 'lips', role: 'lips', geo: () => S(sph(0.026, 10, 6), 1.5, 0.4, 0.5) },
  { k: 'earL', role: 'skin', geo: () => S(sph(0.026, 10, 8), 0.4, 1, 0.7) },
  { k: 'earR', role: 'skin', geo: () => S(sph(0.026, 10, 8), 0.4, 1, 0.7) },
  { k: 'deltL', role: 'jacket', geo: () => sph(0.055, 14, 10) },
  { k: 'deltR', role: 'jacket', geo: () => sph(0.055, 14, 10) },
  { k: 'uarmL', role: 'jacket', geo: () => cap(0.043, 0.2) },
  { k: 'uarmR', role: 'jacket', geo: () => cap(0.043, 0.2) },
  { k: 'farmL', role: 'jacket', geo: () => cap(0.037, 0.19) },
  { k: 'farmR', role: 'jacket', geo: () => cap(0.037, 0.19) },
  { k: 'handL', role: 'glove', geo: () => handGeo(1) },
  { k: 'handR', role: 'glove', geo: () => handGeo(-1) },
  { k: 'thighL', role: 'pants', geo: () => cap(0.085, 0.28) },
  { k: 'thighR', role: 'pants', geo: () => cap(0.085, 0.28) },
  { k: 'shinL', role: 'pants', geo: () => cap(0.066, 0.32) },
  { k: 'shinR', role: 'pants', geo: () => cap(0.066, 0.32) },
  { k: 'kneeL', role: 'vest', geo: () => box(0.11, 0.12, 0.05) },
  { k: 'kneeR', role: 'vest', geo: () => box(0.11, 0.12, 0.05) },
  { k: 'shoeL', role: 'shoe', geo: shoeGeo },
  { k: 'shoeR', role: 'shoe', geo: shoeGeo },
  { k: 'gun', role: 'dark', geo: () => box(0.06, 0.1, 0.8) },
];

// ---- Stofftexturen ----
const texCache = {};
export function roleTex(role) {
  if (!['jacket', 'pants', 'vest', 'pack', 'collar', 'helmet'].includes(role)) return null;
  if (texCache[role]) return texCache[role];
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); let seed = role.length * 91 + 5; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, 128, 128);
  if (role === 'jacket') { for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(${R() < 0.5 ? 255 : 0},${R() < 0.5 ? 255 : 0},${R() < 0.5 ? 255 : 0},0.16)`; x.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(R() * 128, R() * 128, 8 + R() * 22, 5 + R() * 12, R() * 3, 0, 6.3); x.fill(); } }
  for (let i = 0; i < 128; i += 2) { x.fillStyle = `rgba(0,0,0,${role === 'pants' ? 0.14 : 0.07})`; x.fillRect(0, i, 128, 1); x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(i, 0, 1, 128); }
  if (role === 'pants') for (let i = -128; i < 128; i += 3) { x.strokeStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 128, 128); x.stroke(); }
  for (let i = 0; i < 1500; i++) { x.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)'; x.fillRect(R() * 128, R() * 128, 1, 1); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return (texCache[role] = t);
}
export const roleRough = (role) => (role === 'skin' || role === 'lips' ? 0.5 : role === 'white' || role === 'iris' ? 0.2 : role === 'shoe' || role === 'belt' || role === 'helmet' ? 0.6 : 0.9);

const SKIN = [0xf0c8a8, 0xe3b08c, 0xc68a62, 0x8d5a3b, 0x5c3a26];
const HAIR = [0x1a110c, 0x3a2416, 0x6a4a28, 0xb08848, 0x2a2a2a, 0x7a2a18, 0xbfbfbf];
const JACKET = [0x4a5236, 0x2a2e33, 0x6a5a40, 0x3a4a5c, 0x5a2e2a, 0x7a7568, 0x2c3a2c, 0x1e2c4a, 0x555a60];
const PANTS = [0x2a2f38, 0x3a3a34, 0x4a4030, 0x1e222a, 0x3e4a5e, 0x2e3a2a];
const VEST = [0x1b1d20, 0x5a5238, 0x3a3f3a];
const CAPC = [0x1b1d20, 0x4a5236, 0x7a2a20, 0x2a3a5c, 0x6a6a60];
const IRIS = [0x3a2a1a, 0x2a4a6a, 0x3a5a3a, 0x5a3a1a];
const shade = (c, f) => { const r = ((c >> 16) & 255) * f, g = ((c >> 8) & 255) * f, b = (c & 255) * f; return (Math.min(255, r) << 16) | (Math.min(255, g) << 8) | Math.min(255, b); };

export function randomOutfit(r = Math.random) {
  const pick = (a) => a[(r() * a.length) | 0], skin = pick(SKIN), jacket = pick(JACKET), helm = r() < 0.22;
  return { skin, hair: pick(HAIR), jacket, collar: shade(jacket, 0.78), pants: pick(PANTS), vest: r() < 0.6 ? pick(VEST) : null, shoe: 0x1c1a18, belt: 0x2a2218, cap: !helm && r() < 0.35 ? pick(CAPC) : null, helmet: helm ? 0x3a4030 : null, pack: r() < 0.3 ? pick(VEST) : null, pony: r() < 0.3, glove: r() < 0.5 ? 0x1a1a1a : 0, dark: 0x0a0806, white: 0xf2efe8, iris: pick(IRIS), lips: (((skin >> 16) & 255) * 0.82 << 16 | ((skin >> 8) & 255) * 0.6 << 8 | ((skin & 255) * 0.58)) };
}
export const roleColor = (o, role) => (role === 'glove' ? o.glove || o.skin : o[role] ?? 0x888888);

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const MM = Array.from({ length: 24 }, () => new THREE.Matrix4());
const tmp = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), P = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
function L(out, parent, x, y, z, rx = 0, ry = 0, rz = 0) { tmp.compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), ONE); return out.multiplyMatrices(parent, tmp); }

export function poseHuman(base, emit, o, outfit) {
  const walk = o.walk || 0, mv = o.moving ? 1 : 0, aim = o.aim ?? 0.6, br = Math.sin((o.t || 0) * 1.8) * 0.004;
  const [A, B, C, D, F, G, H, K] = MM;
  for (const s of [-1, 1]) {
    const ph = walk + (s > 0 ? Math.PI : 0), hipA = Math.sin(ph) * 0.62 * mv, knee = -Math.max(0, Math.sin(ph + 0.9)) * 1.0 * mv - 0.04, sd = s < 0 ? 'L' : 'R';
    L(A, base, 0.09 * s, 0.92 + br, 0, hipA);
    L(B, A, 0, -0.22, 0); emit('thigh' + sd, B);
    L(C, A, 0, -0.44, 0, knee); L(D, C, 0, -0.225, 0); emit('shin' + sd, D);
    if (outfit.vest) { L(K, C, 0, -0.02, -0.07); emit('knee' + sd, K); } else emit('knee' + sd, ZERO);
    L(F, C, 0, -0.455, -0.055, -(hipA + knee)); emit('shoe' + sd, F);
  }
  L(A, base, 0, 0.95 + br, 0); emit('pelvis', A);
  const lean = (o.lean ?? 0) - 0.05 * mv - aim * 0.04, twist = aim * 0.18;
  L(A, base, 0, 0.98 + br, 0, lean, twist, 0);
  L(B, A, 0, 0.0, 0); emit('belt', B);
  L(B, A, 0, 0.22, 0); emit('torso', B);
  if (outfit.vest) { L(B, A, 0, 0.3, -0.012); emit('vest', B); } else emit('vest', ZERO);
  if (outfit.pack) { L(B, A, 0, 0.3, 0.19); emit('pack', B); } else emit('pack', ZERO);
  L(B, A, 0, 0.56, 0); emit('neck', B);
  L(B, A, 0, 0.54, 0); emit('collar', B);
  L(C, A, 0, 0.7, 0, -lean * 0.8 - 0.03, -twist * 0.9, 0);
  emit('head', C);
  L(B, C, 0, 0.03, 0.012); emit('hair', B);
  if (outfit.pony && !outfit.helmet) { L(B, C, 0, -0.02, 0.12, 0.3); emit('pony', B); } else emit('pony', ZERO);
  if (outfit.cap) { L(B, C, 0, 0.045, 0.005); emit('cap', B); L(B, C, 0, 0.055, -0.115, 0.05); emit('brim', B); } else { emit('cap', ZERO); emit('brim', ZERO); }
  if (outfit.helmet) { L(B, C, 0, 0.035, 0.005); emit('helmet', B); } else emit('helmet', ZERO);
  L(B, C, -0.04, 0.056, -0.1, 0, 0, 0.12); emit('browL', B); L(B, C, 0.04, 0.056, -0.1, 0, 0, -0.12); emit('browR', B);
  L(B, C, -0.04, 0.025, -0.098); emit('eyeWL', B); L(B, C, 0.04, 0.025, -0.098); emit('eyeWR', B);
  L(B, C, -0.04, 0.025, -0.107); emit('eyeL', B); L(B, C, 0.04, 0.025, -0.107); emit('eyeR', B);
  L(B, C, 0, -0.01, -0.108); emit('nose', B);
  L(B, C, 0, -0.058, -0.095); emit('lips', B);
  L(B, C, -0.095, -0.005, 0.005); emit('earL', B); L(B, C, 0.095, -0.005, 0.005); emit('earR', B);
  const swing = Math.sin(walk) * 0.45 * mv;
  for (const s of [-1, 1]) {
    const right = s > 0, sd = right ? 'R' : 'L';
    const rx = aim * (right ? 0.95 : 1.2) + (1 - aim) * (right ? swing : -swing), ry = s * (right ? 0.22 : 0.5) * aim, eb = aim * (right ? 0.75 : 0.45) + (1 - aim) * 0.25;
    L(B, A, 0.215 * s, 0.44, 0); emit('delt' + sd, B);
    L(C, A, 0.215 * s, 0.44, 0, rx, ry, 0.07 * s);
    L(D, C, 0, -0.14, 0); emit('uarm' + sd, D);
    L(F, C, 0, -0.28, 0, eb); L(G, F, 0, -0.13, 0); emit('farm' + sd, G);
    L(H, F, 0, -0.275, 0); emit('hand' + sd, H);
  }
  L(B, A, 0.06, 0.38, -0.46, -0.04 * aim, 0, 0); emit('gun', B);
}

export function makeHumanGroup(outfit, extra) {
  const g = new THREE.Group(), meshes = {}, base = new THREE.Matrix4(), mats = {};
  for (const p of HUMAN_PARTS) {
    const col = roleColor(outfit, p.role), key = col + p.role;
    const m = (mats[key] ||= new THREE.MeshStandardMaterial({ color: col, map: roleTex(p.role), roughness: roleRough(p.role), metalness: p.role === 'vest' || p.role === 'helmet' ? 0.15 : 0 }));
    const mesh = new THREE.Mesh(p.geo(), m); mesh.castShadow = true; mesh.matrixAutoUpdate = false; g.add(mesh); meshes[p.k] = mesh;
  }
  const emit = (k, mat) => { meshes[k].matrix.copy(mat); meshes[k].visible = mat !== ZERO && (k !== 'gun' || !extra); };
  g.userData.pose = (o) => { base.identity(); poseHuman(base, emit, o, outfit); };
  return g;
}
export { ZERO };
