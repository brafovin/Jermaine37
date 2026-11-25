import * as THREE from 'three';

const geoCache = new Map();
function boxGeo(w, h, l) { const k = w + ',' + h + ',' + l; if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, l)); return geoCache.get(k); }
function cylGeo(r, l, seg = 12) { const k = 'c' + r + ',' + l; if (!geoCache.has(k)) { const g = new THREE.CylinderGeometry(r, r, l, seg); g.rotateX(Math.PI / 2); geoCache.set(k, g); } return geoCache.get(k); }

export function skinMaterials(skin) {
  const glow = skin.emissive > 0;
  return {
    body: new THREE.MeshStandardMaterial({ color: skin.color, metalness: 0.55, roughness: 0.38 }),
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
  let muzzleZ = -0.5, sightY = 0.1, handZ = -0.3, gripZ = 0.05;
  switch (def.model) {
    case 'pistol':
      B(0.05, 0.055, 0.24, m.body, 0, 0.03, -0.1); B(0.052, 0.012, 0.24, m.accent, 0, 0.062, -0.1);
      B(0.04, 0.11, 0.06, m.dark, 0, -0.05, 0.0, -0.2); B(0.03, 0.025, 0.05, m.dark, 0, -0.01, -0.03);
      B(0.012, 0.012, 0.012, m.accent, 0, 0.075, -0.2); muzzleZ = -0.23; sightY = 0.075; handZ = -0.02; gripZ = 0.0;
      break;
    case 'smg':
      B(0.06, 0.08, 0.34, m.body, 0, 0, -0.1); B(0.062, 0.012, 0.3, m.accent, 0, 0.046, -0.1);
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
      if (def.model === 'dmr') { C(0.026, 0.22, m.dark, 0, 0.1, -0.12); C(0.03, 0.03, m.glass, 0, 0.1, -0.235); sightY = 0.1; }
      else { redDot(0.115, -0.14); sightY = 0.115; }
      muzzleZ = -0.88 - L; handZ = -0.5; gripZ = 0.08;
      break;
    }
    case 'lmg':
      B(0.085, 0.11, 0.5, m.body, 0, 0, -0.1); B(0.087, 0.016, 0.5, m.accent, 0, 0.063, -0.1);
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
      B(0.062, 0.09, 0.42, m.body, 0, 0, -0.08); B(0.064, 0.012, 0.42, m.accent, 0, 0.052, -0.08);
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

// Soldat für die Lobby (schaut nach +Z, hält die Waffe aufrecht)
export function makeSoldier(skin, def) {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: 0x5b5540, roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2a22, roughness: 0.9 });
  const vest = new THREE.MeshStandardMaterial({ color: 0x4a4636, roughness: 0.85 });
  const pouch = new THREE.MeshStandardMaterial({ color: 0x6b6446, roughness: 0.9 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.8 });
  const add = (geo, mat, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  add(boxGeo(0.2, 0.85, 0.24), cloth, -0.13, 0.43, 0); add(boxGeo(0.2, 0.85, 0.24), cloth, 0.13, 0.43, 0);
  add(boxGeo(0.22, 0.2, 0.34), dark, -0.13, 0.05, 0.05); add(boxGeo(0.22, 0.2, 0.34), dark, 0.13, 0.05, 0.05);
  add(boxGeo(0.5, 0.28, 0.3), cloth, 0, 0.98, 0);
  add(boxGeo(0.56, 0.5, 0.34), vest, 0, 1.3, 0);
  for (let i = -1; i <= 1; i++) add(boxGeo(0.12, 0.14, 0.08), pouch, i * 0.15, 1.2, 0.2);
  add(boxGeo(0.14, 0.1, 0.14), cloth, 0, 1.6, 0);
  add(boxGeo(0.24, 0.26, 0.26), white, 0, 1.78, 0);
  add(boxGeo(0.28, 0.08, 0.28), dark, 0, 1.93, 0); add(boxGeo(0.3, 0.14, 0.3), dark, 0, 1.88, -0.02);
  add(boxGeo(0.26, 0.07, 0.04), glass, 0, 1.82, 0.14);
  add(boxGeo(0.07, 0.2, 0.06), dark, 0.16, 1.86, 0); // Headset
  add(boxGeo(0.16, 0.5, 0.18), cloth, -0.37, 1.25, 0.02).rotation.z = 0.12;
  const w = makeWeaponModel(def, skin, false); w.scale.setScalar(1.1);
  w.position.set(0.42, 1.2, 0.32); w.rotation.set(Math.PI / 2 + 0.05, 0, 0); g.add(w);
  const ra = add(boxGeo(0.16, 0.34, 0.16), cloth, 0.38, 1.28, 0.12); ra.rotation.x = -0.6;
  const fa = add(boxGeo(0.15, 0.4, 0.15), cloth, 0.34, 1.12, 0.3); fa.rotation.x = -1.2;
  add(boxGeo(0.12, 0.12, 0.12), dark, 0.3, 1.12, 0.34);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
