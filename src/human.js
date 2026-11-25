import * as THREE from 'three';

// Menschliche Figur: gerundete Gliedmaßen, Gelenke (Knie/Ellbogen), Kleidung. Ursprung = Füße, Blick = -Z.
const sph = (r, ws = 16, hs = 12, a = 0, b = Math.PI * 2, c = 0, d = Math.PI) => new THREE.SphereGeometry(r, ws, hs, a, b, c, d);
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 5, 12);
const S = (g, x, y, z) => { g.scale(x, y, z); return g; };

export const HUMAN_PARTS = [
  { k: 'pelvis', role: 'pants', geo: () => S(sph(0.16), 1.3, 0.85, 0.9) },
  { k: 'torso', role: 'jacket', geo: () => S(cap(0.14, 0.28), 1.3, 1, 0.82) },
  { k: 'vest', role: 'vest', geo: () => new THREE.BoxGeometry(0.37, 0.27, 0.25) },
  { k: 'neck', role: 'skin', geo: () => new THREE.CylinderGeometry(0.05, 0.055, 0.12, 10) },
  { k: 'head', role: 'skin', geo: () => S(sph(0.11, 22, 16), 0.88, 1.12, 1.0) },
  { k: 'hair', role: 'hair', geo: () => S(sph(0.118, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), 0.9, 1.1, 1.06) },
  { k: 'pony', role: 'hair', geo: () => S(sph(0.05, 10, 8), 0.8, 2.2, 0.9) },
  { k: 'cap', role: 'cap', geo: () => S(sph(0.124, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), 0.9, 1, 1.06) },
  { k: 'brim', role: 'cap', geo: () => new THREE.BoxGeometry(0.15, 0.012, 0.1) },
  { k: 'eyeL', role: 'dark', geo: () => sph(0.013, 8, 6) },
  { k: 'eyeR', role: 'dark', geo: () => sph(0.013, 8, 6) },
  { k: 'nose', role: 'skin', geo: () => new THREE.BoxGeometry(0.02, 0.035, 0.03) },
  { k: 'uarmL', role: 'jacket', geo: () => cap(0.042, 0.2) },
  { k: 'uarmR', role: 'jacket', geo: () => cap(0.042, 0.2) },
  { k: 'farmL', role: 'jacket', geo: () => cap(0.036, 0.19) },
  { k: 'farmR', role: 'jacket', geo: () => cap(0.036, 0.19) },
  { k: 'handL', role: 'glove', geo: () => S(sph(0.042), 0.9, 1, 1.2) },
  { k: 'handR', role: 'glove', geo: () => S(sph(0.042), 0.9, 1, 1.2) },
  { k: 'thighL', role: 'pants', geo: () => cap(0.085, 0.28) },
  { k: 'thighR', role: 'pants', geo: () => cap(0.085, 0.28) },
  { k: 'shinL', role: 'pants', geo: () => cap(0.066, 0.32) },
  { k: 'shinR', role: 'pants', geo: () => cap(0.066, 0.32) },
  { k: 'shoeL', role: 'shoe', geo: () => new THREE.BoxGeometry(0.1, 0.08, 0.27) },
  { k: 'shoeR', role: 'shoe', geo: () => new THREE.BoxGeometry(0.1, 0.08, 0.27) },
  { k: 'gun', role: 'dark', geo: () => new THREE.BoxGeometry(0.06, 0.1, 0.8) },
];

const SKIN = [0xf0c8a8, 0xe0ad88, 0xc68a62, 0x8d5a3b, 0x5c3a26];
const HAIR = [0x1a110c, 0x3a2416, 0x6a4a28, 0xb08848, 0x2a2a2a, 0x7a2a18, 0xbfbfbf];
const JACKET = [0x4a5236, 0x2a2e33, 0x6a5a40, 0x3a4a5c, 0x5a2e2a, 0x7a7568, 0x2c3a2c, 0x1e2c4a, 0x555a60];
const PANTS = [0x2a2f38, 0x3a3a34, 0x4a4030, 0x1e222a, 0x3e4a5e, 0x2e3a2a];
const VEST = [0x1b1d20, 0x5a5238, 0x3a3f3a];
const CAPC = [0x1b1d20, 0x4a5236, 0x7a2a20, 0x2a3a5c, 0x6a6a60];

export function randomOutfit(r = Math.random) {
  const pick = (a) => a[(r() * a.length) | 0];
  return { skin: pick(SKIN), hair: pick(HAIR), jacket: pick(JACKET), pants: pick(PANTS), vest: r() < 0.6 ? pick(VEST) : null, shoe: 0x1c1a18, cap: r() < 0.35 ? pick(CAPC) : null, pony: r() < 0.3, glove: r() < 0.5 ? 0x1a1a1a : 0, dark: 0x0a0806 };
}
export const roleColor = (o, role) => (role === 'glove' ? o.glove || o.skin : o[role] ?? 0x888888);

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const M = Array.from({ length: 24 }, () => new THREE.Matrix4());
const tmp = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ'), P = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
// out = parent * T(x,y,z) * R(rx,ry,rz)
function L(out, parent, x, y, z, rx = 0, ry = 0, rz = 0) { tmp.compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), ONE); return out.multiplyMatrices(parent, tmp); }

// o: { walk, moving, aim (0..1), t, lean }, outfit: Outfit. emit(k, matrixInModelSpace)
export function poseHuman(base, emit, o, outfit) {
  const walk = o.walk || 0, mv = o.moving ? 1 : 0, aim = o.aim ?? 0.6, br = Math.sin((o.t || 0) * 1.8) * 0.004;
  const [A, B, C, D, F, G, H] = M;
  // Beine
  for (const s of [-1, 1]) {
    const ph = walk + (s > 0 ? Math.PI : 0), hipA = Math.sin(ph) * 0.62 * mv, knee = -Math.max(0, Math.sin(ph + 0.9)) * 1.0 * mv - 0.04;
    L(A, base, 0.09 * s, 0.92 + br, 0, hipA);
    L(B, A, 0, -0.22, 0); emit(s < 0 ? 'thighL' : 'thighR', B);
    L(C, A, 0, -0.44, 0, knee); L(D, C, 0, -0.225, 0); emit(s < 0 ? 'shinL' : 'shinR', D);
    L(F, C, 0, -0.455, -0.055, -(hipA + knee)); emit(s < 0 ? 'shoeL' : 'shoeR', F);
  }
  L(A, base, 0, 0.95 + br, 0); emit('pelvis', A);
  // Oberkörper
  const lean = (o.lean ?? 0) - 0.05 * mv - aim * 0.04, twist = aim * 0.18;
  L(A, base, 0, 0.98 + br, 0, lean, twist, 0); // Taille
  L(B, A, 0, 0.22, 0); emit('torso', B);
  if (outfit.vest) { L(B, A, 0, 0.3, -0.012); emit('vest', B); } else emit('vest', ZERO);
  L(B, A, 0, 0.56, 0); emit('neck', B);
  L(C, A, 0, 0.69, 0, -lean * 0.8 - 0.03, -twist * 0.9, 0); // Kopf
  emit('head', C);
  L(B, C, 0, 0.03, 0.012); emit('hair', B);
  if (outfit.pony) { L(B, C, 0, -0.02, 0.12, 0.3); emit('pony', B); } else emit('pony', ZERO);
  if (outfit.cap) { L(B, C, 0, 0.045, 0.005); emit('cap', B); L(B, C, 0, 0.055, -0.115, 0.05); emit('brim', B); } else { emit('cap', ZERO); emit('brim', ZERO); }
  L(B, C, -0.04, 0.025, -0.1); emit('eyeL', B); L(B, C, 0.04, 0.025, -0.1); emit('eyeR', B);
  L(B, C, 0, -0.012, -0.112); emit('nose', B);
  // Arme: Rechts hält Waffengriff, Links stützt vorne
  const swing = Math.sin(walk) * 0.45 * mv;
  for (const s of [-1, 1]) {
    const right = s > 0;
    const rx = aim * (right ? 0.95 : 1.2) + (1 - aim) * (right ? swing : -swing), ry = s * (right ? 0.22 : 0.5) * aim, eb = aim * (right ? 0.75 : 0.45) + (1 - aim) * 0.25;
    L(C, A, 0.205 * s, 0.44, 0, rx, ry, 0.07 * s);
    L(D, C, 0, -0.14, 0); emit(right ? 'uarmR' : 'uarmL', D);
    L(F, C, 0, -0.28, 0, eb); L(G, F, 0, -0.13, 0); emit(right ? 'farmR' : 'farmL', G);
    L(H, F, 0, -0.275, 0); emit(right ? 'handR' : 'handL', H);
  }
  L(B, A, 0.06, 0.38, -0.46, -0.04 * aim, 0, 0); emit('gun', B);
}

export function makeHumanGroup(outfit, extra) {
  const g = new THREE.Group(), meshes = {}, base = new THREE.Matrix4();
  const mats = {};
  for (const p of HUMAN_PARTS) {
    const col = roleColor(outfit, p.role);
    const m = (mats[col + p.role] ||= new THREE.MeshStandardMaterial({ color: col, roughness: p.role === 'skin' ? 0.55 : 0.85, metalness: p.role === 'vest' ? 0.1 : 0 }));
    const mesh = new THREE.Mesh(p.geo(), m); mesh.castShadow = true; mesh.matrixAutoUpdate = false; mesh.visible = p.k !== 'gun' || !extra; g.add(mesh); meshes[p.k] = mesh;
  }
  const emit = (k, mat) => { meshes[k].matrix.copy(mat); meshes[k].visible = mat !== ZERO && (k !== 'gun' || !extra); };
  g.userData.pose = (o) => { base.identity(); poseHuman(base, emit, o, outfit); if (extra) { const gm = meshes.gun; } };
  return g;
}
export { ZERO };
