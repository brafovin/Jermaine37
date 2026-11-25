import * as THREE from 'three';

const geoCache = new Map();
function boxGeo(w, h, l) { const k = w + ',' + h + ',' + l; if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, l)); return geoCache.get(k); }
function cylGeo(r, l, seg = 12) { const k = 'c' + r + ',' + l; if (!geoCache.has(k)) { const g = new THREE.CylinderGeometry(r, r, l, seg); g.rotateX(Math.PI / 2); geoCache.set(k, g); } return geoCache.get(k); }

const camoCache = new Map();
function camoTexture(skin) {
  if (camoCache.has(skin.id)) return camoCache.get(skin.id);
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'); let seed = 7; const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  x.fillStyle = skin.camo[0]; x.fillRect(0, 0, 512, 512);
  for (const [col, n] of [[skin.camo[1], 40], [skin.camo[2], 26]]) { x.fillStyle = col; for (let i = 0; i < n; i++) { x.beginPath(); const px = R() * 512, py = R() * 512, rx = 20 + R() * 60, ry = 10 + R() * 30, rot = R() * 3; x.ellipse(px, py, rx, ry, rot, 0, 6.3); x.fill(); } }
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${R() < 0.5 ? 255 : 0},${R() < 0.5 ? 220 : 0},${R() < 0.5 ? 160 : 0},${R() * 0.18})`; x.fillRect(R() * 512, R() * 512, 1 + R() * 2, 1 + R() * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16; t.wrapS = t.wrapT = THREE.RepeatWrapping; camoCache.set(skin.id, t); return t;
}
export function skinMaterials(skin) {
  const glow = skin.emissive > 0;
  return {
    body: skin.camo ? new THREE.MeshStandardMaterial({ map: camoTexture(skin), color: 0xffffff, metalness: 0.45, roughness: 0.4 }) : new THREE.MeshStandardMaterial({ color: skin.color, metalness: 0.55, roughness: 0.38 }),
    accent: new THREE.MeshStandardMaterial({ color: skin.accent, metalness: 0.4, roughness: 0.35, emissive: skin.emissive, emissiveIntensity: glow ? 1.4 : 0 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x17191d, metalness: 0.7, roughness: 0.45 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x66d0ff, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.35, emissive: 0x2a8acc, emissiveIntensity: 0.6 }),
    sleeve: new THREE.MeshStandardMaterial({ color: 0x3d4a36, roughness: 0.9 }),
    glove: new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.8 }),
  };
}

// Waffe: Lauf zeigt nach -Z, Ursprung ≈ Mitte der Verschlussgruppe
export function makeWeaponModel(def, skin, withArms = true) {
  const m = skinMaterials(skin), g = new THREE.Group();
  const add = (geo, mat, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); return o; };
  const B = (w, h, l, mat, x, y, z, rx) => add(boxGeo(w, h, l), mat, x, y, z, rx);
  const C = (r, l, mat, x, y, z) => add(cylGeo(r, l), mat, x, y, z);
  const redDot = (y, z, w = 0.05) => {
    B(w, 0.006, 0.014, m.dark, 0, y + w / 2, z); B(w, 0.006, 0.014, m.dark, 0, y - w / 2, z);
    B(0.006, w, 0.014, m.dark, -w / 2, y, z); B(0.006, w, 0.014, m.dark, w / 2, y, z); B(w, w, 0.003, m.glass, 0, y, z);
    B(0.03, Math.max(0.01, y - w / 2 - 0.045), 0.03, m.dark, 0, (y - w / 2 + 0.045) / 2, z + 0.005);
    B(0.004, 0.004, 0.004, m.accent, 0, y, z - 0.01);
  };
  const railZ = (zFront, zBack, y, w = 0.03) => { for (let z = zFront; z <= zBack; z += 0.026) B(w, 0.012, 0.013, m.dark, 0, y, z); B(w * 0.6, 0.008, zBack - zFront, m.dark, 0, y - 0.004, (zFront + zBack) / 2); };
  const brake = (z) => { C(0.024, 0.07, m.dark, 0, 0.008, z); C(0.027, 0.012, m.accent, 0, 0.008, z + 0.03); C(0.027, 0.012, m.accent, 0, 0.008, z - 0.03); B(0.06, 0.012, 0.02, m.dark, 0, 0.008, z); };
  const vgrip = (z, y = -0.07) => { B(0.032, 0.09, 0.034, m.dark, 0, y - 0.04, z, 0.1); B(0.036, 0.012, 0.04, m.accent, 0, y - 0.088, z, 0.1); };
  const magAng = (z, h = 0.16) => { B(0.04, h, 0.07, m.dark, 0, -0.09 - h / 2 + 0.03, z, 0.18); B(0.045, 0.02, 0.078, m.accent, 0, -0.09 - h + 0.03, z + 0.03, 0.18); };
  let muzzleZ = -0.5, sightY = 0.1, handZ = -0.3, gripZ = 0.05;
  switch (def.model) {
    case 'pistol':
      B(0.05, 0.055, 0.24, m.body, 0, 0.03, -0.1); B(0.052, 0.012, 0.24, m.accent, 0, 0.062, -0.1);
      B(0.04, 0.11, 0.06, m.dark, 0, -0.05, 0.0, -0.2); B(0.03, 0.025, 0.05, m.dark, 0, -0.01, -0.03);
      B(0.012, 0.012, 0.012, m.accent, 0, 0.075, -0.2); muzzleZ = -0.23; sightY = 0.075; handZ = -0.02; gripZ = 0.0;
      break;
    case 'smg':
      B(0.06, 0.08, 0.34, m.body, 0, 0, -0.1); B(0.062, 0.012, 0.3, m.accent, 0, 0.046, -0.1); railZ(-0.24, 0.0, 0.053, 0.025); brake(-0.48); vgrip(-0.28);
      C(0.014, 0.2, m.dark, 0, 0.01, -0.36); B(0.036, 0.15, 0.05, m.dark, 0, -0.11, -0.08, 0.1);
      B(0.04, 0.1, 0.05, m.dark, 0, -0.09, 0.05, -0.25); B(0.04, 0.06, 0.2, m.body, 0, -0.01, 0.26);
      redDot(0.1, -0.1, 0.04);
      muzzleZ = -0.47; sightY = 0.1; handZ = -0.22; gripZ = 0.05;
      break;
    case 'ar': case 'dmr': {
      const L = def.model === 'dmr' ? 0.18 : 0;
      B(0.066, 0.09, 0.4, m.body, 0, 0, -0.1); B(0.068, 0.014, 0.4, m.accent, 0, 0.052, -0.1);
      B(0.075, 0.075, 0.3, m.body, 0, -0.004, -0.45); B(0.077, 0.014, 0.3, m.accent, 0, 0.04, -0.45);
      C(0.014, 0.28 + L, m.dark, 0, 0.005, -0.74 - L / 2); B(0.04, 0.16, 0.07, m.dark, 0, -0.12, -0.1, 0.15);
      B(0.04, 0.1, 0.05, m.dark, 0, -0.1, 0.08, -0.25); B(0.055, 0.09, 0.28, m.body, 0, -0.015, 0.3);
      railZ(-0.58, -0.04, 0.056); railZ(-0.62, -0.3, 0.042, 0.02); brake(-0.88 - L); if (def.model === 'ar') vgrip(-0.52); B(0.03, 0.03, 0.05, m.accent, 0.04, 0.0, -0.3); B(0.07, 0.02, 0.12, m.dark, 0, 0.03, 0.14); C(0.02, 0.2, m.dark, 0, 0.0, 0.2);
      if (def.model === 'dmr') { C(0.026, 0.22, m.dark, 0, 0.1, -0.12); C(0.03, 0.03, m.glass, 0, 0.1, -0.235); sightY = 0.1; }
      else { redDot(0.115, -0.14); sightY = 0.115; }
      muzzleZ = -0.88 - L; handZ = -0.5; gripZ = 0.08;
      break;
    }
    case 'lmg':
      B(0.085, 0.11, 0.5, m.body, 0, 0, -0.1); B(0.087, 0.016, 0.5, m.accent, 0, 0.063, -0.1); railZ(-0.34, 0.1, 0.075, 0.035); brake(-1.0); vgrip(-0.62);
      B(0.09, 0.09, 0.34, m.body, 0, -0.01, -0.54); C(0.017, 0.3, m.dark, 0, 0.01, -0.86);
      B(0.12, 0.13, 0.12, m.dark, 0, -0.13, -0.05); B(0.09, 0.07, 0.1, m.accent, 0, -0.12, -0.05);
      B(0.04, 0.1, 0.05, m.dark, 0, -0.1, 0.12, -0.25); B(0.06, 0.1, 0.3, m.body, 0, -0.02, 0.36);
      B(0.012, 0.1, 0.012, m.dark, -0.04, -0.09, -0.7, 0.3); B(0.012, 0.1, 0.012, m.dark, 0.04, -0.09, -0.7, 0.3);
      redDot(0.135, -0.14, 0.055);
      muzzleZ = -1.0; sightY = 0.135; handZ = -0.55; gripZ = 0.12;
      break;
    case 'shotgun':
      B(0.062, 0.085, 0.34, m.body, 0, 0, -0.08); B(0.064, 0.012, 0.34, m.accent, 0, 0.048, -0.08);
      C(0.022, 0.62, m.dark, 0, 0.02, -0.56); C(0.026, 0.4, m.body, 0, -0.025, -0.48); B(0.062, 0.05, 0.2, m.accent, 0, -0.03, -0.45);
      B(0.04, 0.1, 0.05, m.dark, 0, -0.09, 0.07, -0.25); B(0.05, 0.1, 0.3, m.body, 0, -0.02, 0.3);
      B(0.012, 0.02, 0.012, m.accent, 0, 0.055, -0.85); muzzleZ = -0.88; sightY = 0.065; handZ = -0.45; gripZ = 0.07;
      break;
    case 'sniper':
      B(0.062, 0.09, 0.42, m.body, 0, 0, -0.08); B(0.064, 0.012, 0.42, m.accent, 0, 0.052, -0.08); railZ(-0.28, 0.1, 0.056, 0.026);
      C(0.018, 0.78, m.dark, 0, 0.012, -0.7); C(0.028, 0.08, m.dark, 0, 0.012, -1.12);
      C(0.034, 0.32, m.dark, 0, 0.115, -0.1); C(0.044, 0.07, m.dark, 0, 0.115, -0.28); C(0.044, 0.07, m.dark, 0, 0.115, 0.06); C(0.032, 0.01, m.glass, 0, 0.115, -0.3);
      B(0.045, 0.1, 0.04, m.dark, 0, -0.1, 0.06, -0.25); B(0.058, 0.12, 0.34, m.body, 0, -0.025, 0.32);
      B(0.012, 0.012, 0.05, m.dark, 0.05, 0.03, 0.04); B(0.014, 0.1, 0.014, m.dark, -0.03, -0.09, -0.8, 0.35); B(0.014, 0.1, 0.014, m.dark, 0.03, -0.09, -0.8, 0.35);
      muzzleZ = -1.16; sightY = 0.115; handZ = -0.38; gripZ = 0.06;
      break;
    case 'launcher':
      C(0.075, 0.95, m.body, 0, 0.0, -0.3); C(0.095, 0.1, m.accent, 0, 0, -0.78); C(0.085, 0.14, m.dark, 0, 0, 0.2);
      B(0.04, 0.1, 0.05, m.dark, 0, -0.12, -0.1, -0.2); B(0.04, 0.1, 0.05, m.dark, 0, -0.12, -0.42);
      B(0.03, 0.06, 0.1, m.dark, 0, 0.1, -0.2); B(0.025, 0.03, 0.01, m.glass, 0, 0.14, -0.25);
      muzzleZ = -0.86; sightY = 0.14; handZ = -0.42; gripZ = -0.1;
      break;
  }
  if (withArms) {
    const hand = (x, y, z) => B(0.06, 0.06, 0.09, m.glove, x, y, z);
    hand(0.0, -0.095, gripZ + 0.0);
    B(0.07, 0.075, 0.5, m.sleeve, 0.06, -0.17, gripZ + 0.28).rotation.set(-0.35, -0.12, 0);
    hand(0.0, -0.07, handZ);
    const l = B(0.07, 0.075, 0.55, m.sleeve, -0.08, -0.17, handZ + 0.3); l.rotation.set(-0.3, 0.2, 0);
  }
  g.userData = { muzzle: new THREE.Vector3(0, 0.01, muzzleZ), sightY, mats: m };
  return g;
}

export function flashTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d');
  const gr = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.25, 'rgba(255,200,90,.9)'); gr.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128);
  ctx.translate(64, 64); ctx.fillStyle = 'rgba(255,230,160,.9)';
  for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(60, 0); ctx.lineTo(0, 4); ctx.fill(); }
  return new THREE.CanvasTexture(c);
}

// Soldat für die Lobby: menschliche Figur mit Waffe in der Hand
import { makeHumanGroup, randomOutfit } from './human.js';
export function makeSoldier(skin, def) {
  const outfit = { skin: 0xd9a47e, hair: 0x3a2416, jacket: 0x4a5236, pants: 0x2a2f38, vest: 0x1b1d20, shoe: 0x1c1a18, cap: null, pony: false, glove: 0x1a1a1a, dark: 0x0a0806 };
  const h = makeHumanGroup(outfit, true);
  h.userData.pose({ walk: 0, moving: false, aim: 0.85, t: 0 });
  const w = makeWeaponModel(def, skin, false); w.scale.setScalar(1.0); w.position.set(0.13, 1.3, -0.36); w.rotation.x = 0.04; h.add(w);
  const root = new THREE.Group(); h.rotation.y = Math.PI; root.add(h);
  root.userData.update = (t) => h.userData.pose({ walk: 0, moving: false, aim: 0.85, t });
  return root;
}
