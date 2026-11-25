import * as THREE from 'three';

// Einschusslöcher, Blutflecken, Hülsen, Mündungsrauch
function ctex(size, draw) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const rng = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

function holeTexture() {
  return ctex(128, (x, s) => {
    const g = x.createRadialGradient(s / 2, s / 2, 1, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(0,0,0,.95)'); g.addColorStop(0.18, 'rgba(8,6,5,.92)'); g.addColorStop(0.32, 'rgba(70,62,55,.55)'); g.addColorStop(0.6, 'rgba(120,110,100,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s); const R = rng(11);
    x.strokeStyle = 'rgba(40,35,30,.5)'; x.lineWidth = 1.2; for (let i = 0; i < 9; i++) { const a = R() * 6.28, l = s * (0.14 + R() * 0.3); x.beginPath(); x.moveTo(s / 2 + Math.cos(a) * s * 0.08, s / 2 + Math.sin(a) * s * 0.08); x.lineTo(s / 2 + Math.cos(a) * l, s / 2 + Math.sin(a) * l); x.stroke(); }
  });
}
function bloodTexture(seed) {
  return ctex(256, (x, s) => {
    const R = rng(seed * 977 + 13), cx = s / 2, cy = s / 2;
    const drop = (px, py, r, a) => { const g = x.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r); g.addColorStop(0, `rgba(150,16,16,${a})`); g.addColorStop(0.6, `rgba(100,6,6,${a})`); g.addColorStop(1, `rgba(60,2,2,${a * 0.9})`); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 6.3); x.fill(); };
    drop(cx, cy, s * (0.1 + R() * 0.06), 0.95);
    for (let i = 0; i < 34; i++) {
      const a = R() * 6.28, len = s * (0.1 + R() * 0.38), r = 1.5 + R() * 6 * (1 - len / s), px = cx + Math.cos(a) * len, py = cy + Math.sin(a) * len;
      x.strokeStyle = `rgba(95,6,6,${0.55 + R() * 0.3})`; x.lineWidth = Math.max(1, r * 0.7); x.lineCap = 'round'; x.beginPath(); x.moveTo(cx + Math.cos(a) * s * 0.07, cy + Math.sin(a) * s * 0.07); x.lineTo(px, py); x.stroke();
      drop(px, py, r, 0.9);
    }
    for (let i = 0; i < 40; i++) drop(cx + (R() - 0.5) * s * 0.9, cy + (R() - 0.5) * s * 0.9, 0.8 + R() * 2.2, 0.8);
  });
}
function smokeTexture() {
  return ctex(64, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgba(210,210,205,.55)'); g.addColorStop(0.5, 'rgba(170,170,165,.25)'); g.addColorStop(1, 'rgba(140,140,140,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); });
}

export class Effects {
  constructor(scene, world, audio) {
    this.scene = scene; this.world = world; this.audio = audio;
    this.plane = new THREE.PlaneGeometry(1, 1);
    this.holeTex = holeTexture(); this.bloodTex = [1, 2, 3, 4, 5].map(bloodTexture);
    this.holes = []; this.blood = []; this.hi = 0; this.bi = 0;
    this.casings = []; this.ci = 0; this.smokes = []; this.si = 0;
    this.brass = new THREE.MeshStandardMaterial({ color: 0xc89b3c, metalness: 0.9, roughness: 0.3 });
    this.casGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.019, 6);
    this.smokeTex = smokeTexture();
    this.mats = [];
  }
  _decal(list, idxKey, max, tex, size, p, n, life, rough = 0.6) {
    const i = this[idxKey]++ % max; let d = list[i];
    if (!d) {
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: rough, metalness: 0 }); this.mats.push(mat);
      const m = new THREE.Mesh(this.plane, mat); m.receiveShadow = true; this.scene.add(m); d = list[i] = { m, life: 0, max: 0 };
    }
    d.m.material.map = tex; d.m.material.opacity = 1; d.m.visible = true; d.life = d.max = life;
    d.m.position.set(p.x + n[0] * 0.02, p.y + n[1] * 0.02, p.z + n[2] * 0.02);
    d.m.lookAt(p.x + n[0], p.y + n[1], p.z + n[2]); d.m.rotateZ(Math.random() * 6.28); d.m.scale.setScalar(size);
  }
  hole(p, n) { this._decal(this.holes, 'hi', 70, this.holeTex, 0.1 + Math.random() * 0.06, p, n, 45); }
  splat(p, n, size = 1) { this._decal(this.blood, 'bi', 120, this.bloodTex[(Math.random() * 5) | 0], size, p, n, 70, 0.28); }
  casing(pos, vel) {
    const i = this.ci++ % 36; let c = this.casings[i];
    if (!c) { c = this.casings[i] = { m: new THREE.Mesh(this.casGeo, this.brass), v: new THREE.Vector3(), life: 0, spin: new THREE.Vector3(), bounced: 0 }; c.m.castShadow = false; this.scene.add(c.m); }
    c.m.visible = true; c.m.position.copy(pos); c.v.copy(vel); c.life = 4; c.bounced = 0; c.spin.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
  }
  smoke(pos, dir) {
    const i = this.si++ % 20; let s = this.smokes[i];
    if (!s) { s = this.smokes[i] = { sp: new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, transparent: true, depthWrite: false })), life: 0, v: new THREE.Vector3() }; this.scene.add(s.sp); }
    s.sp.visible = true; s.sp.position.copy(pos); s.life = 1.1; s.v.copy(dir).multiplyScalar(0.9).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.5 + Math.random() * 0.3, (Math.random() - 0.5) * 0.3)); s.sp.scale.setScalar(0.12);
  }
  update(dt) {
    for (const list of [this.holes, this.blood]) for (const d of list) {
      if (!d || d.life <= 0) continue; d.life -= dt;
      if (d.life <= 0) d.m.visible = false; else if (d.life < 6) d.m.material.opacity = d.life / 6;
    }
    for (const c of this.casings) {
      if (!c || c.life <= 0) continue; c.life -= dt; if (c.life <= 0) { c.m.visible = false; continue; }
      c.v.y -= 9.8 * dt; c.m.position.addScaledVector(c.v, dt); c.m.rotation.x += c.spin.x * dt; c.m.rotation.z += c.spin.z * dt;
      const g = this.world.heightAt(c.m.position.x, c.m.position.z) + 0.01;
      if (c.m.position.y < g) { c.m.position.y = g; if (c.bounced < 2 && Math.abs(c.v.y) > 0.8) { c.v.y *= -0.35; c.v.x *= 0.5; c.v.z *= 0.5; c.bounced++; this.audio.casing(); } else { c.v.set(0, 0, 0); c.spin.multiplyScalar(0.1); } }
    }
    for (const s of this.smokes) {
      if (!s || s.life <= 0) continue; s.life -= dt; if (s.life <= 0) { s.sp.visible = false; continue; }
      s.sp.position.addScaledVector(s.v, dt); s.v.multiplyScalar(1 - dt * 1.5); const f = 1 - s.life / 1.1; s.sp.scale.setScalar(0.1 + f * 0.45); s.sp.material.opacity = (1 - f) * 0.3;
    }
  }
  dispose() {
    for (const list of [this.holes, this.blood]) for (const d of list) d && this.scene.remove(d.m);
    for (const c of this.casings) c && this.scene.remove(c.m); for (const s of this.smokes) s && this.scene.remove(s.sp);
    this.mats.forEach((m) => m.dispose()); this.holeTex.dispose(); this.bloodTex.forEach((t) => t.dispose()); this.smokeTex.dispose(); this.plane.dispose(); this.casGeo.dispose();
  }
}
