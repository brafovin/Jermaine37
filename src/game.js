import * as THREE from 'three';
import { WEAPONS, WEAPON_BY_ID, AMMO, RARITY, SKIN_BY_ID, RANKS, resolveSkin, keyName } from './data.js';
import { HALF, mulberry32 } from './world.js';
import { makeWeaponModel, flashTexture } from './weaponmodel.js';
import { HUD } from './hud.js';
import { badgeSVG } from './badges.js';
import { installBots } from './bots.js';
import { installVehicles } from './vehicles.js';
import { installOnline } from './online.js';
import { Effects } from './effects.js';
import { installBomb } from './bomb.js';
import { controlsUI } from './controls.js';

const V3 = THREE.Vector3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

export const ZONE_PHASES = [
  { wait: 70, shrink: 60, r: 640, dmg: 1.5 }, { wait: 55, shrink: 50, r: 420, dmg: 3 }, { wait: 45, shrink: 40, r: 260, dmg: 5 },
  { wait: 35, shrink: 35, r: 140, dmg: 8 }, { wait: 25, shrink: 30, r: 60, dmg: 12 }, { wait: 15, shrink: 25, r: 6, dmg: 18 },
];

export class Match {
  constructor({ renderer, scene, world, profile, audio, opts, hudRoot, onExit }) {
    Object.assign(this, { renderer, scene, world, profile, audio, opts, onExit });
    this.rnd = mulberry32((Math.random() * 1e9) | 0);
    this.flagMode = !!(opts.online && opts.online.mode === 'flag'); this.bomb = !!(opts.online && (opts.online.mode === 'bomb' || this.flagMode)); this.myTeam = this.bomb ? opts.online.team : 0;
    this.needLock = !new URLSearchParams(location.search).has('nolock');
    this.timeScale = Number(new URLSearchParams(location.search).get('speed')) || 1;
    this.camera = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.1, 3500);
    this.viewScene = new THREE.Scene(); this.viewCam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.02, 10);
    this.viewScene.add(new THREE.HemisphereLight(0xdfeaff, 0x555044, 1.2));
    const vl = new THREE.DirectionalLight(0xfff0d8, 2.2); vl.position.set(0.5, 1, 0.6); this.viewScene.add(vl);
    this.viewScene.environment = scene.environment; this.viewScene.environmentIntensity = 0.7;
    this.flashLight = new THREE.PointLight(0xffb060, 0, 3); this.viewScene.add(this.flashLight);
    this.viewGroup = new THREE.Group(); this.viewScene.add(this.viewGroup);
    this.flashSprite = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: flashTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.flashSprite.visible = false;
    this.hud = new HUD(hudRoot);
    this.keys = new Set(); this.mouse = { l: false, r: false, dx: 0, dy: 0 }; this.bind = profile.keys;
    this.weaponModels = new Map(); this.curModel = null;
    this._pr0 = renderer.getPixelRatio(); this._ft = 16; this._adapt = 0;
    this.initEffects();
    this.initState();
    this.initBots();
    this.initOnline();
    this.initBomb();
    if (!opts.online) this.initToken();
    this.bindInput();
    this.setupZoneMesh(); if (this.bomb) this.zoneMesh.visible = false;
    this.hud.setStats(this.alive, 0, 0);
    this.refreshWeaponUI();
    if (!this.bomb) this.hud.banner('SPRUNG!', `Karte: ${world.mapName} · WASD steuern · Leertaste = Fallschirm`, 4500);
    this.last = performance.now(); this.running = true;
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }

  // ---------- Zustand ----------
  initState() {
    if (this.bomb) { this.attTeam = 0; this.bombSetup(); }
    this.time = 0; this.over = false; this.paused = false; this.locked = false;
    this.zoneIdx = 0; this.zoneState = 'wait'; this.zoneT = 0;
    this.zone = { cx: 0, cz: 0, r: 1000, tcx: 0, tcz: 0, tr: ZONE_PHASES[0].r };
    this.zoneRnd = this.opts.online ? mulberry32(this.opts.online.seed ^ 0x9e3779b9) : null;
    this.planNextZone();
    const ang = this.rnd() * 6.28;
    const p = this.player = {
      pos: this.opts.online ? new V3(this.spawnPos(this.opts.online.index, this.opts.online.count)[0], 300, this.spawnPos(this.opts.online.index, this.opts.online.count)[1]) : new V3(Math.cos(ang) * 650, 300, Math.sin(ang) * 650), vel: new V3(), yaw: ang + Math.PI * 0.5 + Math.PI, pitch: -0.5, recoilP: 0, recoilY: 0,
      hp: 100, armor: 0, state: 'fall', chute: false, crouch: 0, sprint: false, onGround: false, kills: 0, cash: 0, medkits: 0,
      slots: [{ def: WEAPON_BY_ID.sidekick, mag: 12 }, null, null], cur: 0,
      ammo: { light: 48, medium: 0, heavy: 0, shells: 0, rocket: 0 },
      vehicle: null, camYaw: 0, camPitch: 0.2, fireCD: 0, reload: 0, ads: 0, swap: 0, healT: 0, stepT: 0, bob: 0, interact: 0, alive: true, shotsFired: 0, dist: 0,
    };
    p.yaw = Math.atan2(p.pos.x, p.pos.z); // forward = (-sin, -cos) -> Blick zur Inselmitte
    if (this.bomb) this.bombPlace(p);
    this.camera.position.copy(p.pos);
    this.tmpV = new V3(); this.tmpV2 = new V3();
    this.sway = { x: 0, y: 0 }; this.kick = 0; this.flashT = 0; this.reloadAnim = 0;
  }
  weapon() { return this.player.slots[this.player.cur]; }
  planNextZone() {
    const ph = ZONE_PHASES[Math.min(this.zoneIdx, ZONE_PHASES.length - 1)], z = this.zone;
    const zr = this.zoneRnd || this.rnd, maxOff = Math.max(0, z.r - ph.r) * 0.8, a = zr() * 6.28, d = Math.sqrt(zr()) * maxOff;
    z.tcx = z.cx + Math.cos(a) * d; z.tcz = z.cz + Math.sin(a) * d; z.tr = ph.r;
    z.fromX = z.cx; z.fromZ = z.cz; z.fromR = z.r;
  }
  setupZoneMesh() {
    const g = new THREE.CylinderGeometry(1, 1, 600, 96, 1, true);
    const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(60,140,255,0)'); gr.addColorStop(0.5, 'rgba(60,140,255,.45)'); gr.addColorStop(1, 'rgba(100,200,255,.9)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 256);
    const t = new THREE.CanvasTexture(c);
    this.zoneMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false, opacity: 0.55 }));
    this.zoneMesh.position.y = 250; this.zoneMesh.frustumCulled = false; this.scene.add(this.zoneMesh);
  }

  // ---------- Effekte ----------
  initEffects() {
    this.tracers = []; const tg = new THREE.BoxGeometry(0.025, 0.025, 1); tg.translate(0, 0, -0.5);
    for (let i = 0; i < 48; i++) {
      const m = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, fog: false, depthWrite: false })); m.visible = false; m.frustumCulled = false;
      this.scene.add(m); this.tracers.push({ m, t: 0 });
    }
    this.tracerI = 0;
    const N = 400; this.pN = N; this.pPos = new Float32Array(N * 3); this.pCol = new Float32Array(N * 3); this.pVel = new Float32Array(N * 3); this.pLife = new Float32Array(N); this.pI = 0;
    this.pPos.fill(0, 0).forEach((_, i) => (this.pPos[i] = -9999));
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
    this.points.frustumCulled = false; this.scene.add(this.points);
    this.fx = new Effects(this.scene, this.world, this.audio);
    this.projectiles = []; this.booms = [];
    this.rocketGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8); this.rocketGeo.rotateX(Math.PI / 2);
    this.rocketMat = new THREE.MeshStandardMaterial({ color: 0x555a50, emissive: 0xff6a1a, emissiveIntensity: 0.8 });
  }
  tracer(a, b, color = 0xffe6a0) {
    const tr = this.tracers[this.tracerI++ % this.tracers.length];
    tr.m.position.copy(a); tr.m.lookAt(b); tr.m.scale.z = a.distanceTo(b); tr.m.material.color.setHex(color); tr.m.material.opacity = 0.85; tr.m.visible = true; tr.t = 0.07;
  }
  spark(x, y, z, n, r, g, b, speed = 4, life = 0.5) {
    for (let k = 0; k < n; k++) {
      const i = this.pI++ % this.pN;
      this.pPos[i * 3] = x; this.pPos[i * 3 + 1] = y; this.pPos[i * 3 + 2] = z;
      this.pVel[i * 3] = (Math.random() - 0.5) * speed; this.pVel[i * 3 + 1] = Math.random() * speed * 0.8; this.pVel[i * 3 + 2] = (Math.random() - 0.5) * speed;
      this.pCol[i * 3] = r; this.pCol[i * 3 + 1] = g; this.pCol[i * 3 + 2] = b; this.pLife[i] = life * (0.5 + Math.random() * 0.5);
    }
  }
  updateEffects(dt) {
    this.fx.update(dt);
    for (const t of this.tracers) if (t.t > 0) { t.t -= dt; if (t.t <= 0) t.m.visible = false; else t.m.material.opacity = t.t / 0.07; }
    for (let i = 0; i < this.pN; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      if (this.pLife[i] <= 0) { this.pPos[i * 3 + 1] = -9999; continue; }
      this.pVel[i * 3 + 1] -= 9 * dt;
      this.pPos[i * 3] += this.pVel[i * 3] * dt; this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt; this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true;
    for (let i = this.booms.length - 1; i >= 0; i--) {
      const b = this.booms[i]; b.t += dt; const f = b.t / 0.5;
      b.m.scale.setScalar(b.r * (0.3 + f * 0.9)); b.m.material.opacity = Math.max(0, 0.9 - f);
      if (f >= 1) { this.scene.remove(b.m); this.booms.splice(i, 1); }
    }
  }
  explode(pos, def, owner) {
    const R = def.splash;
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9, fog: false, depthWrite: false }));
    m.position.copy(pos); this.scene.add(m); this.booms.push({ m, t: 0, r: R * 0.7 });
    this.spark(pos.x, pos.y, pos.z, 50, 1, 0.55, 0.15, 14, 1.0); this.spark(pos.x, pos.y, pos.z, 30, 0.35, 0.35, 0.35, 8, 1.4);
    const dp = pos.distanceTo(this.player.pos);
    this.audio.explosion(clamp(1 - dp / 400, 0, 1), 0);
    for (const b of this.bots) {
      if (!b.alive || !b.landed) continue;
      const d = Math.hypot(b.x - pos.x, b.y + 0.9 - pos.y, b.z - pos.z);
      if (d < R) this.damageBot(b, def.dmg * (1 - d / R), owner, false, def.name);
    }
    if (this.remotes && owner === 'player') for (const r of this.remotes.values()) { if (!r.alive || (this.bomb && r.team === this.myTeam)) continue; const d = Math.hypot(r.x - pos.x, r.y + 0.9 - pos.y, r.z - pos.z); if (d < R) this.netHit(r, def.dmg * (1 - d / R), false, def.name); }
    for (const v of this.world.vehicles) { if (v.wreck) continue; const d = Math.hypot(v.x - pos.x, v.y + 1 - pos.y, v.z - pos.z); if (d < R + 2) this.damageVehicle(v, def.dmg * 1.5 * (1 - d / (R + 2)), owner); }
    if (this.player.alive && dp < R) this.damagePlayer(def.dmg * 0.6 * (1 - dp / R), pos, owner === 'player' ? 'Eigenbeschuss' : owner && owner.name ? owner.name : 'Explosion', def.name);
  }

  // ---------- Eingabe ----------
  bindInput() {
    const canvas = this.renderer.domElement;
    this.h = {
      kd: (e) => {
        if (this.over) return;
        if (e.code === 'Escape') return;
        this.keys.add(e.code);
        const B = this.bind, c = e.code, slot = [B.slot1, B.slot2, B.slot3, B.slot4].indexOf(c);
        if (c === B.reload) this.startReload();
        if (slot >= 0) { if (this.bomb && (this.frozen || this.player.state === 'spectate')) this.loadoutPick(slot); else if (slot < 3) this.switchTo(slot); }
        if (c === B.medkit) this.useMedkit();
        if (c === B.vehicle) this.toggleVehicle();
        if (c === B.map) this.hud.toggleBigMap(!this.hud.bigMapOpen());
        if (c === B.jump && this.player.state === 'fall') { this.player.chute = !this.player.chute; if (this.player.chute) this.audio.heal(); }
        if (c === B.nextWeapon) this.cycleWeapon(1);
        e.preventDefault && [B.jump, 'Tab'].includes(c) && e.preventDefault();
      },
      ku: (e) => this.keys.delete(e.code),
      md: (e) => {
        if (!this.locked && this.needLock) return; const st = this.profile.data.settings, fire = st.swapMouse ? 2 : 0, aim = st.swapMouse ? 0 : 2;
        if (e.button === fire) { this.mouse.l = true; this.mouse.lClick = true; }
        if (e.button === aim) { if (st.aimToggle) this.mouse.r = !this.mouse.r; else this.mouse.r = true; }
      },
      mu: (e) => { const st = this.profile.data.settings, fire = st.swapMouse ? 2 : 0, aim = st.swapMouse ? 0 : 2; if (e.button === fire) this.mouse.l = false; if (e.button === aim && !st.aimToggle) this.mouse.r = false; },
      mm: (e) => { if (this.locked || !this.needLock) { this.mouse.dx += e.movementX || 0; this.mouse.dy += e.movementY || 0; } },
      wh: (e) => { if (this.locked) this.cycleWeapon(e.deltaY > 0 ? 1 : -1); },
      lock: () => {
        const was = this.locked; this.locked = document.pointerLockElement === canvas;
        if (was && !this.locked && !this.over) this.setPaused(true);
        if (!was && this.locked) this.setPaused(false);
      },
      click: () => { this.audio.init(); if (this.needLock && !this.locked && !this.over) this.lockPointer(); },
      ctx: (e) => e.preventDefault(),
      resize: () => { this.camera.aspect = this.viewCam.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.viewCam.updateProjectionMatrix(); },
      blur: () => this.keys.clear(),
    };
    const h = this.h;
    addEventListener('keydown', h.kd); addEventListener('keyup', h.ku); addEventListener('mousedown', h.md); addEventListener('mouseup', h.mu);
    addEventListener('mousemove', h.mm); addEventListener('wheel', h.wh); document.addEventListener('pointerlockchange', h.lock);
    canvas.addEventListener('click', h.click); this.hud.root.addEventListener('click', h.click); addEventListener('contextmenu', h.ctx); addEventListener('resize', h.resize); addEventListener('blur', h.blur);
    this.hud.el('p-resume').onclick = () => this.lockPointer();
    this.hud.el('p-leave').onclick = () => { this.setPaused(false); this.die('Aufgegeben', 'Rückzug', true); };
    this.hud.el('p-controls').onclick = () => { const box = this.hud.el('p-ctl'); if (box.style.display === 'block') { box.style.display = 'none'; this.ctl && this.ctl.destroy(); this.ctl = null; } else { box.style.display = 'block'; this.ctl = controlsUI(box, this.profile, () => { this.bind = this.profile.keys; }); } };
    if (this.needLock) { this.paused = true; this.hud.showPause(true); this.hud.el('pause').querySelector('h2').textContent = 'BEREIT?'; }
    this.lockPointer();
  }
  lockPointer() { try { const r = this.renderer.domElement.requestPointerLock?.(); r && r.catch && r.catch(() => {}); } catch (e) { /* ignore */ } }
  setPaused(p) {
    if (this.over) return; this.paused = p; this.hud.showPause(p);
    this.hud.el('pause').querySelector('h2').textContent = 'PAUSIERT'; if (p) { this.mouse.l = this.mouse.r = false; this.keys.clear(); }
  }
  unbindInput() {
    const h = this.h;
    removeEventListener('keydown', h.kd); removeEventListener('keyup', h.ku); removeEventListener('mousedown', h.md); removeEventListener('mouseup', h.mu);
    removeEventListener('mousemove', h.mm); removeEventListener('wheel', h.wh); document.removeEventListener('pointerlockchange', h.lock);
    this.renderer.domElement.removeEventListener('click', h.click); removeEventListener('contextmenu', h.ctx); removeEventListener('resize', h.resize); removeEventListener('blur', h.blur);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // ---------- Waffen ----------
  refreshWeaponUI() {
    const p = this.player, w = this.weapon();
    this.hud.setSlots(p.slots, p.cur);
    this.hud.setAmmo(w, w ? w.mag : 0, w ? p.ammo[w.def.ammo] : 0, p.reload > 0);
    this.buildViewModel();
  }
  buildViewModel() {
    const w = this.weapon(); if (this.curModel) this.viewGroup.remove(this.curModel); this.curModel = null; this.flashSprite.parent?.remove(this.flashSprite);
    if (!w) return;
    const skin = resolveSkin(this.profile.data.skin, this.profile.data.skinColor), key = w.def.id + skin.id;
    if (!this.weaponModels.has(key)) this.weaponModels.set(key, makeWeaponModel(w.def, skin, true));
    const m = this.weaponModels.get(key); this.curModel = m; this.viewGroup.add(m);
    m.add(this.flashSprite); this.flashSprite.position.copy(m.userData.muzzle);
  }
  switchTo(i) {
    const p = this.player; if (p.state !== 'ground' || i === p.cur || !p.slots[i]) return;
    p.cur = i; p.reload = 0; p.swap = 0.35; p.fireCD = 0.3; this.refreshWeaponUI(); this.audio.click();
  }
  cycleWeapon(dir) {
    const p = this.player; if (p.state !== 'ground') return;
    for (let k = 1; k <= 3; k++) { const i = (p.cur + dir * k + 6) % 3; if (p.slots[i]) { this.switchTo(i); return; } }
  }
  startReload() {
    const p = this.player, w = this.weapon();
    if (!w || p.reload > 0 || p.state !== 'ground' || w.mag >= w.def.mag || p.ammo[w.def.ammo] <= 0) return;
    p.reload = w.def.reload; p.ads = Math.min(p.ads, 0.3); this.audio.reload(); this.hud.setAmmo(w, w.mag, p.ammo[w.def.ammo], true);
  }
  finishReload() {
    const p = this.player, w = this.weapon(); if (!w) return;
    const need = w.def.mag - w.mag, take = Math.min(need, p.ammo[w.def.ammo]);
    w.mag += take; p.ammo[w.def.ammo] -= take; this.refreshWeaponUI();
  }
  useMedkit() {
    const p = this.player; if (p.medkits <= 0 || p.healT > 0 || p.hp >= 100 || p.state !== 'ground') return;
    p.healT = 1.6; p.medkits--; this.audio.heal();
  }
  spreadNow() {
    const p = this.player, w = this.weapon(); if (!w) return 0;
    let s = w.def.spread * lerp(1, 0.22, p.ads);
    const speed = Math.hypot(p.vel.x, p.vel.z); s *= 1 + clamp(speed / 8, 0, 1) * 0.9; if (!p.onGround) s *= 2.2; s *= lerp(1, 0.65, p.crouch);
    return s + p.recoilP * 25;
  }
  fire() {
    const p = this.player, w = this.weapon(), def = w.def;
    w.mag--; p.fireCD = 60 / def.rpm; p.shotsFired++;
    const spread = THREE.MathUtils.degToRad(this.spreadNow());
    const origin = this.camera.position, fwd = this.tmpV.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const muzzleW = this.muzzleWorld();
    if (!def.rocket) {
      const right = new V3(1, 0, 0).applyQuaternion(this.camera.quaternion), up = new V3(0, 1, 0).applyQuaternion(this.camera.quaternion), fw = fwd.clone();
      this.fx.casing(origin.clone().addScaledVector(fw, 0.4).addScaledVector(right, 0.17).addScaledVector(up, -0.1), right.multiplyScalar(1.6 + Math.random() * 1.4).addScaledVector(up, 1.2 + Math.random()).addScaledVector(fw, -0.2 + Math.random() * 0.5));
      this.fx.smoke(muzzleW, fw);
    }
    if (def.rocket) { this.launchRocket(origin, fwd, def); }
    else {
      for (let k = 0; k < def.pellets; k++) {
        const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * spread * (def.pellets > 1 ? 1 : 0.8) * (k === 0 && def.pellets === 1 ? 1 : 1);
        const d = this.tmpV2.copy(fwd);
        const right = new V3(1, 0, 0).applyQuaternion(this.camera.quaternion), up = new V3(0, 1, 0).applyQuaternion(this.camera.quaternion);
        d.addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
        this.bullet(origin, d, def, muzzleW);
      }
    }
    // Rückstoß
    const rec = def.recoil * lerp(1, 0.7, p.ads) * lerp(1, 0.75, p.crouch);
    p.recoilP += THREE.MathUtils.degToRad(rec * 0.55); p.recoilY += THREE.MathUtils.degToRad((Math.random() - 0.5) * rec * 0.5);
    this.kick = Math.min(1, this.kick + 0.35 * Math.min(2, rec * 0.6)); this.flashT = 0.05;
    this.audio.shot(def.cls, 1, 0);
    this.refreshAmmo();
    if (w.mag === 0 && p.ammo[def.ammo] > 0) setTimeout(() => this.startReload(), 250);
  }
  refreshAmmo() { const w = this.weapon(), p = this.player; this.hud.setAmmo(w, w ? w.mag : 0, w ? p.ammo[w.def.ammo] : 0, p.reload > 0); }
  muzzleWorld() {
    const m = new V3(0.16, -0.14, -0.9).applyQuaternion(this.camera.quaternion).add(this.camera.position); return m;
  }
  falloff(dist, range) { return 1 - 0.4 * clamp((dist - range * 0.35) / (range * 0.65), 0, 1); }
  bullet(origin, dir, def, muzzle) {
    const hit = this.traceBullet(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, def.range * 1.4);
    if (!hit.bot) for (const v of this.world.vehicles) {
      if (v.wreck) continue; const ox = origin.x - v.x, oy = origin.y - (v.y + 1), oz = origin.z - v.z, rr = v.rad * 0.55, b2 = ox * dir.x + oy * dir.y + oz * dir.z, c2 = ox * ox + oy * oy + oz * oz - rr * rr, dsc = b2 * b2 - c2;
      if (dsc < 0) continue; const tt = -b2 - Math.sqrt(dsc); if (tt > 0 && tt < hit.t) { hit.t = tt; hit.veh = v; }
    }
    const end = new V3(origin.x + dir.x * hit.t, origin.y + dir.y * hit.t, origin.z + dir.z * hit.t);
    if (hit.veh) { this.damageVehicle(hit.veh, def.dmg * 0.8, 'player'); this.hud.hitmarker(false, false); this.spark(end.x, end.y, end.z, 5, 1, 0.8, 0.3, 3, 0.3); }
    if (hit.t > 3) { this.tracer(muzzle, end); this.netShot(muzzle, end, def); }
    if (hit.remote) {
      const dmg = def.dmg * this.falloff(hit.t, def.range) * (hit.head ? 1.9 : 1);
      this.netHit(hit.remote, dmg, hit.head, def.name); this.hud.hitmarker(hit.head, false); this.audio.hit(hit.head); this.audio.flesh(); this.bloodHit(end, dir, hit.head, hit.remote.x, hit.remote.z);
    } else if (hit.bot) {
      const dmg = def.dmg * this.falloff(hit.t, def.range) * (hit.head ? 1.9 : 1) * (hit.t > def.range * 1.0 ? 0.6 : 1);
      const was = hit.bot.hp; this.damageBot(hit.bot, dmg, 'player', hit.head, def.name);
      this.hud.hitmarker(hit.head, hit.bot.hp <= 0 && was > 0); this.audio.hit(hit.head); this.audio.flesh();
      this.bloodHit(end, dir, hit.head, hit.bot.x, hit.bot.z);
    } else if (hit.kind >= 0 && !hit.veh) this.impact(end, hit);
  }
  impact(end, hit) {
    const n = hit.normal || [0, 1, 0], bld = hit.kind === 1; this.fx.hole(end, n);
    this.spark(end.x, end.y, end.z, bld ? 7 : 5, bld ? 0.78 : 0.5, bld ? 0.75 : 0.4, bld ? 0.7 : 0.28, 3, 0.5);
    if (bld) this.spark(end.x, end.y, end.z, 3, 1, 0.85, 0.4, 5, 0.25);
    if (Math.random() < 0.08) this.audio.ping();
  }
  bloodHit(end, dir, head, vx, vz) {
    const n = head ? 26 : 14, R = Math.random;
    for (let k = 0; k < n; k++) {
      const i = this.pI++ % this.pN, sp = 2 + R() * (head ? 7 : 5);
      this.pPos[i * 3] = end.x; this.pPos[i * 3 + 1] = end.y; this.pPos[i * 3 + 2] = end.z;
      this.pVel[i * 3] = dir.x * sp + (R() - 0.5) * 2.5; this.pVel[i * 3 + 1] = dir.y * sp + R() * 2.2; this.pVel[i * 3 + 2] = dir.z * sp + (R() - 0.5) * 2.5;
      this.pCol[i * 3] = 0.5 + R() * 0.35; this.pCol[i * 3 + 1] = 0.02; this.pCol[i * 3 + 2] = 0.02; this.pLife[i] = 0.6 + R() * 0.5;
    }
    const w = this.world;
    if (R() < 0.8) this.fx.splat({ x: vx + (R() - 0.5) * 0.8, y: w.heightAt(vx, vz), z: vz + (R() - 0.5) * 0.8 }, [0, 1, 0], 0.5 + R() * 0.9);
    const t = w.ray(end.x, end.y, end.z, dir.x, dir.y, dir.z, 5);
    if (t > 0 && w.lastKind >= 0 && w.lastN) this.fx.splat({ x: end.x + dir.x * t, y: end.y + dir.y * t, z: end.z + dir.z * t }, w.lastN, 0.6 + R() * 1.0);
  }
  // Treffer auf Bots, Gebäude oder Gelände
  traceBullet(ox, oy, oz, dx, dy, dz, maxT, ignore = null) {
    let tw = this.world.ray(ox, oy, oz, dx, dy, dz, maxT); const kind = this.world.lastKind, wn = tw >= 0 && this.world.lastN ? this.world.lastN.slice() : null;
    let tmax = tw < 0 ? maxT : tw, best = tmax, bot = null, head = false;
    for (const b of this.bots) {
      if (!b.alive || !b.landed || b === ignore) continue;
      const px = ox - b.x, pz = oz - b.z, a = dx * dx + dz * dz; if (a < 1e-8) continue;
      const bb = px * dx + pz * dz, c = px * px + pz * pz - 0.16, disc = bb * bb - a * c; if (disc < 0) continue;
      const sq = Math.sqrt(disc); let t = (-bb - sq) / a; if (t < 0) t = (-bb + sq) / a; if (t < 0 || t >= best) continue;
      const y = oy + dy * t; if (y < b.y || y > b.y + 1.78) continue;
      best = t; bot = b; head = y > b.y + 1.5;
    }
    let remote = null;
    if (this.remotes) for (const b of this.remotes.values()) {
      if (!b.alive || (this.bomb && b.team === this.myTeam)) continue;
      const px = ox - b.x, pz = oz - b.z, a = dx * dx + dz * dz; if (a < 1e-8) continue;
      const bb = px * dx + pz * dz, c = px * px + pz * pz - 0.16, disc = bb * bb - a * c; if (disc < 0) continue;
      const sq = Math.sqrt(disc); let t = (-bb - sq) / a; if (t < 0) t = (-bb + sq) / a; if (t < 0 || t >= best) continue;
      const y = oy + dy * t; if (y < b.y || y > b.y + 1.78) continue;
      best = t; remote = b; bot = null; head = y > b.y + 1.5;
    }
    return { t: best, bot, remote, head, normal: wn, kind: bot || remote ? -2 : tw < 0 ? -1 : kind };
  }
  launchRocket(origin, dir, def) {
    const m = new THREE.Mesh(this.rocketGeo, this.rocketMat); m.position.copy(origin).addScaledVector(dir, 1.2); m.lookAt(m.position.clone().add(dir)); this.scene.add(m);
    this.projectiles.push({ m, vel: dir.clone().multiplyScalar(75), life: 6, def, owner: 'player' });
  }
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i], step = pr.vel.length() * dt, d = pr.vel.clone().normalize();
      const hit = this.traceBullet(pr.m.position.x, pr.m.position.y, pr.m.position.z, d.x, d.y, d.z, step + 0.3);
      pr.life -= dt; pr.vel.y -= 2.5 * dt;
      this.spark(pr.m.position.x, pr.m.position.y, pr.m.position.z, 1, 0.9, 0.9, 0.9, 0.8, 0.8);
      if (hit.t < step + 0.3 && (hit.bot || hit.kind >= 0) || pr.life <= 0) {
        const at = pr.m.position.clone().addScaledVector(d, Math.max(0, hit.t - 0.1)); this.explode(at, pr.def, pr.owner); this.scene.remove(pr.m); this.projectiles.splice(i, 1);
      } else { pr.m.position.addScaledVector(pr.vel, dt); pr.m.lookAt(pr.m.position.clone().add(pr.vel)); }
    }
  }

  // Token-Truhe: in jeder 100. Runde liegt eine Truhe auf der Karte, die den Battle Pass gratis freischaltet
  initToken() {
    this.token = null; const force = new URLSearchParams(location.search).has('token');
    if (!(this.profile.tokenRound || force)) return;
    const w = this.world, t = w.towns[(this.rnd() * w.towns.length) | 0], s = t.spots[(this.rnd() * t.spots.length) | 0];
    this.token = w.addCrate(s[0], s[1], 4, [{ type: 'token' }]);
    setTimeout(() => this.hud.banner('TOKEN-TRUHE!', `Verstecktes Geschenk in ${t.name}: Battle Pass gratis. Siehe Karte (★).`, 6500), 5000);
  }
  // ---------- Kisten & Beute ----------
  rollLoot(tier, bot, rnd = Math.random) {
    const items = [], r = rnd;
    let def;
    if (tier === 3 && bot) def = bot.w;
    else {
      const W = [[55, 30, 12, 3, 0], [10, 30, 35, 20, 5], [0, 5, 25, 40, 30]][tier]; let v = r() * 100, rar = 0;
      for (let i = 0; i < 5; i++) { if (v < W[i]) { rar = i; break; } v -= W[i]; rar = i; }
      const pool = WEAPONS.filter((w) => w.rarity === rar); def = pool[(r() * pool.length) | 0] || WEAPONS[0];
    }
    items.push({ type: 'weapon', def });
    const n = def.ammo === 'rocket' ? 3 : Math.ceil(def.mag * (def.ammo === 'heavy' ? 1.3 : def.ammo === 'shells' ? 2 : 2.2));
    items.push({ type: 'ammo', ammo: def.ammo, n });
    if (r() < 0.3) { const k = ['light', 'medium', 'heavy', 'shells'][(r() * 4) | 0]; items.push({ type: 'ammo', ammo: k, n: 20 + ((r() * 30) | 0) }); }
    const cash = tier === 0 ? 30 + r() * 90 : tier === 1 ? 120 + r() * 200 : tier === 2 ? 300 + r() * 500 : 40 + r() * 120;
    items.push({ type: 'cash', n: Math.round(cash / 5) * 5 });
    if (r() < (tier === 2 ? 0.8 : 0.4)) items.push({ type: 'armor', n: tier === 2 ? 50 : 25 });
    if (r() < 0.4) items.push({ type: 'medkit', n: 1 });
    return items;
  }
  applyLoot(items) {
    const p = this.player;
    for (const it of items) {
      if (it.type === 'weapon') {
        if (p.slots.some((s) => s && s.def === it.def)) { p.ammo[it.def.ammo] += Math.round(it.def.mag * 0.6); this.hud.toast(`${it.def.name} <small>(Duplikat → Munition)</small>`, RARITY[it.def.rarity].color); continue; }
        let slot = p.slots.findIndex((s) => !s); const swapped = slot < 0; if (swapped) slot = p.cur;
        p.slots[slot] = { def: it.def, mag: it.def.mag };
        this.hud.toast(`<b>${it.def.name}</b> <small>${RARITY[it.def.rarity].name} · ${it.def.cls}</small>`, RARITY[it.def.rarity].color);
        if (!this.weapon() || swapped || slot !== p.cur) { p.cur = slot; p.reload = 0; p.swap = 0.35; }
      } else if (it.type === 'ammo') { p.ammo[it.ammo] = Math.min(400, p.ammo[it.ammo] + it.n); this.hud.toast(`+${it.n} ${AMMO[it.ammo].name}`, AMMO[it.ammo].color); }
      else if (it.type === 'cash') { p.cash += it.n; this.hud.toast(`+$${it.n} Bargeld`, '#7dff7d'); this.audio.cash(); }
      else if (it.type === 'armor') { p.armor = Math.min(100, p.armor + it.n); this.hud.toast(`+${it.n} Rüstung`, '#6ab0ff'); }
      else if (it.type === 'medkit') { p.medkits++; this.hud.toast('+1 Medkit', '#ff7a7a'); }
      else if (it.type === 'token') { const r = this.profile.claimToken(); this.audio.match(); this.hud.banner('TOKEN GEFUNDEN!', r === 'premium' ? 'Battle Pass Premium freigeschaltet!' : 'Du hattest Premium schon: +1500 Münzen', 6000); this.hud.toast('★ Battle-Pass-Token', '#ffd24a'); }
    }
    this.refreshWeaponUI();
  }
  updateInteract(dt) {
    if (this.bomb) { if (this.flagMode) this.flagInteract(dt); else this.bombInteract(dt); return; }
    const p = this.player; let crate = null;
    if (p.state === 'ground') crate = this.world.nearestCrate(p.pos.x, p.pos.y, p.pos.z, 2.6);
    if (!crate) { p.interact = 0; this.hud.setProgress(0); const nv = p.state === 'ground' ? this.nearestVehicle(p.pos.x, p.pos.z, 3.6) : null; this.hud.setPrompt(nv ? `${keyName(this.bind.vehicle)}: ${nv.name} fahren` : ''); return; }
    this.hud.setPrompt(`${keyName(this.bind.interact)} halten: ${crate.tier === 3 ? 'Beutekiste plündern' : crate.tier === 4 ? 'Token-Truhe öffnen' : 'Kiste öffnen'}`);
    if (this.keys.has(this.bind.interact)) {
      p.interact += dt / 0.7; this.hud.setProgress(p.interact);
      if (p.interact >= 1) {
        p.interact = 0; this.world.openCrate(crate); this.audio.crate();
        this.applyLoot(crate.loot || (crate.loot = this.crateLoot(crate))); this.netCrate(crate);
        this.hud.setProgress(0);
      }
    } else { p.interact = 0; this.hud.setProgress(0); }
  }

  // ---------- Schaden ----------
  damagePlayer(amount, srcPos, srcName, weaponName) {
    const p = this.player; if (!p.alive || this.over) return;
    const ab = Math.min(p.armor, amount * 0.6); p.armor -= ab; p.hp -= amount - ab;
    if (p.healT > 0 && amount > 3) { p.healT = 0; p.medkits++; this.hud.toast('Heilung unterbrochen', '#ff7a7a'); }
    let ang = null;
    if (srcPos) {
      const dx = srcPos.x - p.pos.x, dz = srcPos.z - p.pos.z, sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
      ang = Math.atan2(dx * cy - dz * sy, -dx * sy - dz * cy); // 0 = vorne, + = rechts
    }
    this.hud.damage(ang); if (amount > 5) this.hud.bloodScreen(Math.min(3, amount / 14) * (Math.random() < 0.8 ? 1 : 0)); if (!this.hurtT) { this.audio.hurt(); this.hurtT = 0.25; }
    if (p.hp <= 0) this.die(srcName || 'Zone', weaponName || '', false);
  }
  die(killer, weapon, quit) {
    if (this.bomb) return this.bombDie(killer, weapon, quit);
    const p = this.player; if (!p.alive) return;
    if (p.vehicle) { p.vehicle.occupied = false; p.vehicle = null; this.audio.engineStop?.(); this.hud.setSpeedo(null); }
    p.alive = false; p.hp = 0; p.state = 'dead'; this.over = true;
    this.placement = this.alive; this.alive--; this.netDead(weapon); this.hud.setHealth(0, 0, 0);
    this.hud.banner(quit ? 'MATCH VERLASSEN' : 'ELIMINIERT', quit ? '' : `von ${killer}${weapon ? ' · ' + weapon : ''}`, 2400);
    setTimeout(() => this.showResults(), quit ? 200 : 2400);
  }
  win() {
    if (this.over) return; this.over = true; this.placement = 1; if (this.player.vehicle) { this.player.vehicle.occupied = false; this.player.vehicle = null; this.audio.engineStop?.(); this.hud.setSpeedo(null); } this.player.state = 'dead';
    this.hud.banner('SIEG!', 'Du bist der letzte Überlebende', 3500); this.audio.match();
    setTimeout(() => this.showResults(), 3400);
  }
  showResults() {
    if (document.pointerLockElement) document.exitPointerLock();
    const p = this.player, place = this.placement || 1, ranked = this.opts.mode === 'ranked';
    const res = this.profile.applyMatch({ placement: place, kills: p.kills, surviveSec: Math.floor(this.time), cash: Math.floor(p.cash), ranked });
    const rk = res.after, mm = Math.floor(this.time / 60), ss = String(Math.floor(this.time % 60)).padStart(2, '0');
    let rankHtml = '';
    if (ranked) {
      const up = rk.idx > res.before.idx, down = rk.idx < res.before.idx;
      rankHtml = `<div class="res-rank">${badgeSVG(rk.idx, 84)}<div><b style="color:${rk.rank.color}">${rk.label}</b><br><span class="${res.rpDelta >= 0 ? 'pos' : 'neg'}">${res.rpDelta >= 0 ? '+' : ''}${res.rpDelta} RP</span>${rk.placing ? `<br><small>Platzierungsmatch ${this.profile.data.rankedPlayed}/3</small>` : `<br><small>${this.profile.data.rp} RP</small>`}${up ? '<br><em class="pos">RANG AUFGESTIEGEN!</em>' : down ? '<br><em class="neg">Rang abgestiegen</em>' : ''}</div></div>`;
    }
    const el = this.hud.results(`<div class="res-box">
      <div class="res-title ${place === 1 ? 'win' : ''}">${place === 1 ? 'WINNER WINNER!' : 'PLATZ #' + place}</div>
      <div class="res-sub">${ranked ? 'Ranked' : 'Battle Royale'} · ${mm}:${ss} überlebt</div>
      <div class="res-grid"><div><b>${p.kills}</b><span>Kills</span></div><div><b>#${place}</b><span>Platzierung</span></div><div><b>+${res.xp}</b><span>XP</span></div><div><b>+$${res.coins}</b><span>Bargeld → Münzen</span></div></div>
      ${rankHtml}${res.levelUp ? `<div class="res-lvl">LEVEL UP! Du bist jetzt Level ${res.level}</div>` : ''}
      <button class="btn big" id="res-back">ZURÜCK ZUR LOBBY</button></div>`);
    el.querySelector('#res-back').onclick = () => this.exit();
  }
  exit() {
    this.running = false; this.unbindInput(); this.scene.remove(this.zoneMesh);
    for (const t of this.tracers) this.scene.remove(t.m);
    this.scene.remove(this.points); for (const b of this.booms) this.scene.remove(b.m); for (const pr of this.projectiles) this.scene.remove(pr.m);
    this.disposeBots(); this.disposeOnline(); this.fx.dispose(); this.renderer.setPixelRatio(this._pr0); this.renderer.setSize(innerWidth, innerHeight); this.hud.root.innerHTML = ''; this.onExit();
  }

  // ---------- Zone ----------
  updateZone(dt) {
    const z = this.zone, ph = ZONE_PHASES[Math.min(this.zoneIdx, ZONE_PHASES.length - 1)];
    this.zoneT += dt;
    if (this.zoneState === 'wait') {
      if (this.zoneT >= ph.wait) { this.zoneState = 'shrink'; this.zoneT = 0; this.audio.warn(); this.hud.banner('DIE ZONE SCHRUMPFT', 'Begib dich in den sicheren Bereich', 3000); }
    } else {
      const f = clamp(this.zoneT / ph.shrink, 0, 1);
      z.cx = lerp(z.fromX, z.tcx, f); z.cz = lerp(z.fromZ, z.tcz, f); z.r = lerp(z.fromR, z.tr, f);
      if (f >= 1) { this.zoneIdx = Math.min(this.zoneIdx + 1, ZONE_PHASES.length - 1); if (this.zoneIdx < ZONE_PHASES.length && z.r > 7) { this.zoneState = 'wait'; this.zoneT = 0; this.planNextZone(); } else { this.zoneT = 0; } }
    }
    this.zoneMesh.scale.set(z.r, 1, z.r); this.zoneMesh.position.x = z.cx; this.zoneMesh.position.z = z.cz;
    const left = this.zoneState === 'wait' ? ph.wait - this.zoneT : ph.shrink - this.zoneT;
    const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
    this.zoneDmg = ph.dmg;
    const p = this.player, out = Math.hypot(p.pos.x - z.cx, p.pos.z - z.cz) > z.r;
    this.hud.setZone(out ? `⚠ AUSSERHALB DER ZONE  −${ph.dmg}/s` : `${this.zoneState === 'wait' ? 'Zone schrumpft in' : 'Zone schrumpft'} ${mmss(left)}`, out);
    if (out && p.alive && p.state !== 'fall') { this.zoneTick = (this.zoneTick || 0) + dt; if (this.zoneTick >= 1) { this.zoneTick = 0; this.damagePlayer(ph.dmg, null, 'der Zone', ''); } }
  }

  // ---------- Spieler-Update ----------
  updatePlayer(dt) {
    const p = this.player, w = this.weapon(), cam = this.camera;
    if (p.state === 'drive') { this.updateDriving(dt); return; }
    if (p.state === 'spectate') { this.updateSpectate(dt); return; }
    const sens = 0.0022 * this.profile.data.settings.sens * (p.ads > 0.5 && w ? 1 / Math.sqrt(w.def.zoom) : 1);
    p.yaw -= this.mouse.dx * sens; p.pitch = clamp(p.pitch - this.mouse.dy * sens, -1.5, 1.5); this.mouse.dx = this.mouse.dy = 0;
    p.recoilP = Math.max(0, p.recoilP - (0.05 + p.recoilP * 6) * dt); p.recoilY *= Math.max(0, 1 - 5 * dt);
    const k = this.keys, B = this.bind, fz = this.frozen ? 0 : 1, fwd = ((k.has(B.forward) ? 1 : 0) - (k.has(B.back) ? 1 : 0)) * fz, strafe = ((k.has(B.right) ? 1 : 0) - (k.has(B.left) ? 1 : 0)) * fz;
    const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    const wx = -sy * fwd + cy * strafe, wz = -cy * fwd - sy * strafe, wl = Math.hypot(wx, wz) || 1;
    if (p.state === 'fall') {
      const g0 = this.world.groundAt(p.pos.x, p.pos.z, p.pos.y), agl = p.pos.y - g0;
      if (agl < 60 && !p.chute) { p.chute = true; this.audio.heal(); }
      const vy = p.chute ? -9 : -48, sp = p.chute ? 15 : 24;
      p.vel.x = lerp(p.vel.x, fwd || strafe ? (wx / wl) * sp : 0, 1 - Math.exp(-2 * dt)); p.vel.z = lerp(p.vel.z, fwd || strafe ? (wz / wl) * sp : 0, 1 - Math.exp(-2 * dt));
      p.vel.y = lerp(p.vel.y, vy, 1 - Math.exp(-(p.chute ? 3 : 1.5) * dt));
      p.pos.addScaledVector(p.vel, dt); this.world.collide(p.pos, 0.4, p.pos.y, 1.8);
      const gnd = this.world.groundAt(p.pos.x, p.pos.z, p.pos.y);
      if (p.pos.y <= gnd) { p.pos.y = gnd; p.state = 'ground'; p.vel.set(0, 0, 0); p.onGround = true; p.chute = false; this.audio.step(0.5); this.hud.banner('GELANDET', 'Finde Kisten, Waffen und Bargeld', 2500); this.hud.setChute(null); }
      else this.hud.setChute(`<b>${Math.round(agl)} m</b><span>${p.chute ? 'Fallschirm offen' : 'Freier Fall — <u>Leertaste</u> öffnet den Fallschirm'}</span>`);
      p.ads = 0;
    } else if (p.state === 'ground') {
      const crouch = k.has(B.crouch) || k.has('ControlLeft'); p.crouch = lerp(p.crouch, crouch ? 1 : 0, 1 - Math.exp(-12 * dt));
      p.sprint = k.has(B.sprint) && fwd > 0 && !crouch && p.ads < 0.2 && p.reload <= 0;
      let sp = p.sprint ? 8.4 : 5.4; sp *= lerp(1, 0.5, p.crouch) * lerp(1, 0.6, p.ads) * (w ? w.def.speed : 1);
      const gH = this.world.groundAt(p.pos.x, p.pos.z, p.pos.y);
      if (gH < -0.3) sp *= 0.55; if (p.healT > 0) sp *= 0.6;
      const tx = (fwd || strafe ? wx / wl : 0) * sp, tz = (fwd || strafe ? wz / wl : 0) * sp, a = 1 - Math.exp(-(p.onGround ? 12 : 1.5) * dt);
      p.vel.x = lerp(p.vel.x, tx, a); p.vel.z = lerp(p.vel.z, tz, a);
      if (p.onGround && k.has(B.jump) && p.crouch < 0.5 && !this.frozen) { p.vel.y = 5.6; p.onGround = false; }
      p.vel.y -= 17 * dt;
      const ox = p.pos.x, oz = p.pos.z;
      p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt; p.pos.y += p.vel.y * dt;
      this.world.collide(p.pos, 0.38, p.pos.y, 1.8 - p.crouch * 0.6); this.collideVehicles(p.pos, 0.38); if (this.bomb) this.bombClamp(p.pos);
      const r = Math.hypot(p.pos.x, p.pos.z); if (r > 985) { p.pos.x *= 985 / r; p.pos.z *= 985 / r; }
      const g = this.world.groundAt(p.pos.x, p.pos.z, p.pos.y);
      if (p.pos.y <= g) { if (!p.onGround && p.vel.y < -9) { this.damagePlayer(Math.max(0, (-p.vel.y - 9) * 6), null, 'Sturz', ''); } p.pos.y = g; p.vel.y = 0; p.onGround = true; } else if (p.pos.y > g + 0.08) p.onGround = false;
      const moved = Math.hypot(p.pos.x - ox, p.pos.z - oz); p.dist += moved;
      p.bob += moved * 1.7; p.stepT += moved;
      if (p.stepT > (p.sprint ? 2.6 : 2.0) && p.onGround) { p.stepT = 0; this.audio.step(p.crouch > 0.5 ? 0.04 : 0.12); }
      // Zielen
      const wantAds = this.mouse.r && p.reload <= 0 && !p.sprint && w; p.ads = clamp(p.ads + (wantAds ? 1 : -1) * dt * 7, 0, 1);
      // Schießen
      p.fireCD = Math.max(0, p.fireCD - dt); p.swap = Math.max(0, p.swap - dt);
      if (p.healT > 0) { p.healT -= dt; if (p.healT <= 0) { p.hp = Math.min(100, p.hp + 60); this.audio.pickup(); } }
      if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) { p.reload = 0; this.finishReload(); } }
      const trigger = w && !this.frozen && (w.def.auto ? this.mouse.l : this.mouse.lClick && this.mouse.l);
      if (w && trigger && p.fireCD <= 0 && p.reload <= 0 && !p.sprint && p.swap <= 0 && p.healT <= 0) {
        if (w.mag > 0) { this.fire(); if (!w.def.auto) this.mouse.lClick = false; }
        else { p.fireCD = 0.25; this.audio.empty(); this.startReload(); this.mouse.lClick = false; }
      }
      if (!this.mouse.l) this.mouse.lClick = false;
    }
    const eye = p.pos.y + lerp(1.65, 1.05, p.crouch);
    cam.position.set(p.pos.x, eye + Math.sin(p.bob) * 0.025 * (p.onGround ? 1 : 0) * (1 - p.ads), p.pos.z);
    cam.rotation.order = 'YXZ'; cam.rotation.set(p.pitch + p.recoilP, p.yaw + p.recoilY, Math.sin(p.bob * 0.5) * 0.004 * (1 - p.ads));
    const zoom = w ? lerp(1, w.def.zoom, p.ads) : 1, baseFov = this.profile.data.settings.fov + (p.sprint ? 6 : 0) + (p.state === 'fall' && !p.chute ? 10 : 0);
    const fov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) / zoom) * 180 / Math.PI;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const scoped = w && w.def.zoom >= 2.5 && p.ads > 0.9;
    this.hud.scope(scoped, p.ads > 0.4);
    this.updateViewModel(dt, scoped);
  }
  updateViewModel(dt, scoped) {
    const p = this.player, w = this.weapon(), g = this.viewGroup;
    g.visible = !!w && p.state === 'ground' && !scoped && !this.hud.bigMapOpen();
    if (!w || !this.curModel) return;
    this.kick = Math.max(0, this.kick - dt * 9); this.flashT = Math.max(0, this.flashT - dt);
    const sx = -this.mouse.dx * 0.0003, sy = this.mouse.dy * 0.0003;
    this.sway.x = lerp(this.sway.x, 0, 1 - Math.exp(-8 * dt)) + clamp(sx, -0.02, 0.02); this.sway.y = lerp(this.sway.y, 0, 1 - Math.exp(-8 * dt)) + clamp(sy, -0.02, 0.02);
    const sightY = this.curModel.userData.sightY, a = p.ads;
    const S = 0.6, hip = new V3(0.13, -0.135, -0.3), ads = new V3(0, -sightY * S - 0.001, -0.2); g.scale.setScalar(S);
    const moving = Math.hypot(p.vel.x, p.vel.z) > 1 && p.onGround ? 1 : 0, bobA = (1 - a * 0.85) * moving * (p.sprint ? 1.8 : 1);
    g.position.lerpVectors(hip, ads, a);
    g.position.x += this.sway.x + Math.cos(p.bob * 0.5) * 0.008 * bobA; g.position.y += this.sway.y + Math.abs(Math.sin(p.bob * 0.5)) * 0.01 * bobA;
    g.position.z += this.kick * 0.045;
    let rx = this.kick * 0.06, ry = 0, rz = 0;
    if (p.sprint) { rx += -0.25; ry += 0.55; g.position.y -= 0.04; g.position.x += 0.05; }
    if (p.reload > 0) { const f = 1 - p.reload / w.def.reload, s = Math.sin(f * Math.PI); rx += -s * 0.7; g.position.y -= s * 0.18; rz += s * 0.4; }
    if (p.swap > 0) { const s = p.swap / 0.35; g.position.y -= s * 0.3; rx += -s * 0.5; }
    if (p.healT > 0) { g.position.y -= 0.25; }
    g.rotation.set(rx, ry, rz);
    this.flashSprite.visible = this.flashT > 0; if (this.flashT > 0) { const s = 0.28 + Math.random() * 0.2; this.flashSprite.scale.set(s, s, 1); this.flashSprite.rotation.z = Math.random() * 6; }
    this.flashLight.position.copy(this.curModel.userData.muzzle).applyMatrix4(g.matrixWorld);
    this.flashLight.intensity = this.flashT > 0 ? 6 : 0;
  }

  // ---------- Haupt-Schleife ----------
  loop(now) {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const raw = (now - this.last) / 1000; let dt = Math.min(0.05, raw); this.last = now;
    // Dynamische Auflösung: bei Rucklern automatisch etwas weniger Pixel, bei Reserve wieder mehr
    if (raw < 0.5) {
      this._ft = this._ft * 0.94 + raw * 1000 * 0.06; this._adapt += raw;
      if (this._adapt > 1.5) {
        this._adapt = 0; const pr = this.renderer.getPixelRatio();
        const set = (v) => { this.renderer.setPixelRatio(v); this.renderer.setSize(innerWidth, innerHeight); };
        if (this._ft > 26 && pr > 0.55) set(Math.max(0.55, pr * 0.85)); else if (this._ft < 14.5 && pr < this._pr0 - 0.01) set(Math.min(this._pr0, pr * 1.08));
      }
    }
    try {
      this.audio.frame();
      if (!this.paused) { dt *= this.timeScale; const sub = Math.ceil(dt / 0.05); for (let i = 0; i < sub; i++) this.step(dt / sub); }
      this.renderFrame();
    } catch (e) { if (!this._errT || now - this._errT > 3000) { console.error(e); this._errT = now; } this.renderer.autoClear = true; }
  }
  step(dt) {
    this.time += dt; this.hurtT = Math.max(0, (this.hurtT || 0) - dt);
    if (!this.over) {
      this.updatePlayer(dt); this.updateInteract(dt); if (!this.bomb) this.updateZone(dt); else this.bombTick(dt);
    } else if (this.player.state === 'dead') { this.camera.rotation.z = lerp(this.camera.rotation.z, 0.5, dt * 2); }
    if (this.net && !this.over) this.netTick(dt);
    this.updateRemotes(dt); this.updateBots(dt); this.updateVehicles(dt); this.updateProjectiles(dt); this.updateEffects(dt);
    this.world.update(dt, this.camera.position);
    this.updateHud();
  }
  updateHud() {
    const p = this.player;
    this.hud.setStats(this.alive, p.kills, Math.floor(p.cash)); this.hud.setHealth(p.hp, p.armor, p.medkits);
    this.hud.setCompass(p.yaw); this.refreshAmmo();
    const t = this.world.townAt(p.pos.x, p.pos.z, 1.3); this.hud.setLoc(t ? t.name.toUpperCase() : 'OFFENES GELÄNDE');
    if (!this._mmT || performance.now() - this._mmT > 66) {
      const pings = this.bots.filter((b) => b.alive && b.landed && b.ping > 0 && Math.hypot(b.x - p.pos.x, b.z - p.pos.z) < 220).concat(this.remotes ? [...this.remotes.values()].filter((r) => r.alive && r.ping > 0) : []);
      const s = { x: p.pos.x, z: p.pos.z, yaw: p.yaw, zone: this.zone, world: this.world, pings, token: this.token && !this.token.opened ? this.token : null, flags: this.flagList };
      this._mmT = performance.now(); this.hud.drawMinimap(s); if (this.hud.bigMapOpen()) this.hud.drawBigMap(s); }
  }
  renderFrame() {
    const r = this.renderer;
    r.autoClear = true; r.render(this.scene, this.camera);
    if (this.viewGroup.visible) { r.autoClear = false; r.clearDepth(); r.render(this.viewScene, this.viewCam); r.autoClear = true; }
  }
}
Match.ZP = ZONE_PHASES;
installBots(Match);
installVehicles(Match);
installOnline(Match);
installBomb(Match);
