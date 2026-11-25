import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const GLASS = [0.04, 0.05, 0.07], DARK = [0.06, 0.06, 0.07], CHROME = [0.72, 0.73, 0.75];
let vehMat = null, charMat = null;
const mats = () => vehMat || ((vehMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.55, roughness: 0.28, envMapIntensity: 1.4 })), (charMat = new THREE.MeshStandardMaterial({ color: 0x151412, metalness: 0.2, roughness: 0.95 })), vehMat);

function build(kind, c, city) {
  const G = [];
  const add = (geo, col, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const g = geo; g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z);
    const cc = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < cc.length; i += 3) { cc[i] = col[0]; cc[i + 1] = col[1]; cc[i + 2] = col[2]; }
    g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); G.push(g.index ? g : g);
  };
  const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d), f = (col, m) => col.map((v) => Math.min(1, v * m));
  const wheel = (x, z, r = 0.34, w = 0.26) => { add(new THREE.CylinderGeometry(r, r, w, 16), DARK, x, r, z, 0, 0, Math.PI / 2); add(new THREE.CylinderGeometry(r * 0.58, r * 0.58, w + 0.03, 12), CHROME, x, r, z, 0, 0, Math.PI / 2); };
  const lights = (hw, yF, zF, zB, yB = yF) => { for (const s of [-1, 1]) { add(bx(0.32, 0.13, 0.06), [1, 0.95, 0.78], s * hw, yF, zF); add(bx(0.32, 0.12, 0.06), [0.85, 0.05, 0.05], s * hw, yB, zB); } };
  let circles, max, hp, cam, wb, rad, name;
  if (kind === 'bus') {
    const dbl = city === 'ldn', H = dbl ? 4.4 : 2.9, col = dbl ? [0.78, 0.05, 0.05] : [0.16, 0.36, 0.72];
    add(bx(2.5, H, 11), col, 0, H / 2 + 0.45, 0); add(bx(2.52, 0.3, 11.02), city === 'ny' ? [0.92, 0.92, 0.92] : f(col, 0.7), 0, 1.0, 0);
    for (const y of dbl ? [2.2, 3.9] : [2.3]) add(bx(2.53, 0.75, 9.7), GLASS, 0, y, 0.2);
    add(bx(2.3, 1.3, 0.06), GLASS, 0, 2.3, -5.52); add(bx(1.4, 0.3, 0.06), [1, 0.6, 0.1], 0, H + 0.1, -5.52); add(bx(2.4, 0.1, 10.8), f(col, 0.85), 0, H + 0.9, 0);
    add(bx(2.5, 0.35, 0.2), DARK, 0, 0.6, -5.5); lights(0.9, 0.9, -5.52, 5.52);
    for (const z of [-3.6, 3.4]) for (const s of [-1, 1]) wheel(s * 1.1, z, 0.5, 0.3);
    circles = [[-4, 1.4], [-1.4, 1.4], [1.4, 1.4], [4, 1.4]]; max = 21; hp = 650; cam = 14; wb = 5.5; rad = 6; name = dbl ? 'Doppeldecker' : 'Stadtbus';
  } else if (kind === 'van') {
    add(bx(1.95, 1.7, 3.1), c, 0, 1.3, 1.0); add(bx(1.9, 1.15, 1.6), f(c, 0.97), 0, 0.98, -1.55); add(bx(1.92, 0.5, 1.4), GLASS, 0, 1.3, -1.55); add(bx(1.7, 0.6, 0.06), GLASS, 0, 1.3, -2.36, 0.4);
    add(bx(2.0, 0.22, 0.15), DARK, 0, 0.45, -2.38); add(bx(2.0, 0.22, 0.15), DARK, 0, 0.45, 2.55); lights(0.7, 0.7, -2.4, 2.55);
    for (const z of [-1.5, 1.7]) for (const s of [-1, 1]) wheel(s * 0.95, z, 0.36, 0.26);
    circles = [[-1.4, 1.15], [1.4, 1.15]]; max = 25; hp = 380; cam = 8.5; wb = 3.2; rad = 3; name = 'Transporter';
  } else if (kind === 'suv') {
    add(bx(1.9, 0.7, 4.7), c, 0, 0.78, 0); add(bx(1.8, 0.75, 2.9), f(c, 0.97), 0, 1.45, 0.4); add(bx(1.82, 0.45, 2.7), GLASS, 0, 1.5, 0.4); add(bx(1.6, 0.6, 0.06), GLASS, 0, 1.5, -1.05, 0.55); add(bx(1.75, 0.08, 2.8), f(c, 0.9), 0, 1.9, 0.4);
    add(bx(1.92, 0.25, 0.15), DARK, 0, 0.5, -2.4); add(bx(1.92, 0.25, 0.15), DARK, 0, 0.5, 2.4); add(bx(0.9, 0.2, 0.05), DARK, 0, 0.8, -2.37); lights(0.68, 0.9, -2.36, 2.36, 1.0);
    for (const s of [-1, 1]) { add(bx(0.06, 0.06, 2.5), CHROME, s * 0.8, 1.97, 0.4); wheel(s * 0.98, -1.5, 0.4, 0.3); wheel(s * 0.98, 1.5, 0.4, 0.3); add(bx(0.12, 0.1, 0.18), c, s * 1.0, 1.25, -0.8); }
    circles = [[-1.3, 1.1], [1.3, 1.1]]; max = 29; hp = 420; cam = 8; wb = 2.9; rad = 3; name = 'SUV';
  } else {
    const taxi = kind === 'taxi';
    add(bx(1.82, 0.55, 4.5), c, 0, 0.58, 0); add(bx(1.74, 0.12, 1.35), f(c, 1.05), 0, 0.9, -1.55); add(bx(1.74, 0.14, 1.0), c, 0, 0.9, 1.6);
    add(bx(1.62, 0.5, 2.0), f(c, 0.97), 0, 1.2, 0.15); add(bx(1.64, 0.36, 1.8), GLASS, 0, 1.22, 0.15);
    add(bx(1.5, 0.5, 0.05), GLASS, 0, 1.18, -0.92, 0.7); add(bx(1.5, 0.45, 0.05), GLASS, 0, 1.18, 1.2, -0.7); add(bx(1.5, 0.07, 1.4), f(c, 0.95), 0, 1.46, 0.15);
    add(bx(1.84, 0.22, 0.14), DARK, 0, 0.42, -2.28); add(bx(1.84, 0.22, 0.14), DARK, 0, 0.42, 2.28); add(bx(0.8, 0.14, 0.04), DARK, 0, 0.62, -2.27); lights(0.62, 0.72, -2.26, 2.26);
    for (const s of [-1, 1]) { add(bx(0.12, 0.1, 0.18), c, s * 0.95, 1.1, -0.7); wheel(s * 0.93, -1.4); wheel(s * 0.93, 1.4); }
    if (taxi) { add(bx(0.55, 0.16, 0.22), [1, 0.95, 0.7], 0, 1.58, 0.1); if (city === 'ny') add(bx(1.84, 0.06, 3.4), [0.05, 0.05, 0.05], 0, 0.8, 0); }
    circles = [[-1.2, 1.0], [1.2, 1.0]]; max = taxi ? 31 : 33; hp = 350; cam = 7.5; wb = 2.7; rad = 2.8; name = taxi ? (city === 'ny' ? 'Taxi' : 'Black Cab') : 'Limousine';
  }
  return { geo: mergeGeometries(G.map((g) => (g.index ? g.toNonIndexed() : g))), circles, max, hp, cam, wb, rad, name };
}

const COLORS = [[0.75, 0.75, 0.78], [0.12, 0.12, 0.14], [0.55, 0.08, 0.08], [0.1, 0.2, 0.45], [0.8, 0.8, 0.82], [0.25, 0.3, 0.28], [0.5, 0.5, 0.52], [0.7, 0.55, 0.2]];

export function spawnVehicles(w) {
  const r = w.rnd, taken = [];
  const place = (t, kind) => {
    for (let a = 0; a < 40; a++) {
      const horiz = r() < 0.5, g = ((r() * (2 * t.n + 1)) | 0) - t.n - 1, lane = (r() < 0.5 ? -1 : 1) * t.sw * 0.22, along = (r() - 0.5) * t.r * 1.5;
      const x = horiz ? t.x + along : t.x + (g + 0.5) * t.cell + lane, z = horiz ? t.z + (g + 0.5) * t.cell + lane : t.z + along;
      if (Math.hypot(x - t.x, z - t.z) > t.r * 0.82 || w.nearBox(x, z, 2.2) || taken.some((q) => Math.hypot(q[0] - x, q[1] - z) < 8)) continue;
      taken.push([x, z]);
      const yaw = (horiz ? Math.PI / 2 * (lane > 0 ? 1 : -1) : lane > 0 ? 0 : Math.PI) + (r() - 0.5) * 0.1;
      add(kind, x, z, yaw, t); return;
    }
  };
  const add = (kind, x, z, yaw, t) => {
    const ny = t.type === 'ny';
    const col = kind === 'taxi' ? (ny ? [0.98, 0.78, 0.08] : [0.05, 0.05, 0.06]) : COLORS[(r() * COLORS.length) | 0];
    const b = build(kind, col, t.type);
    const mesh = new THREE.Mesh(b.geo, mats()); mesh.castShadow = mesh.receiveShadow = true; mesh.rotation.order = 'YXZ'; w.scene.add(mesh);
    const v = { kind, name: b.name, x, z, y: w.heightAt(x, z), yaw, pitch: 0, roll: 0, speed: 0, steer: 0, hp: b.hp, maxhp: b.hp, max: b.max, mesh, circles: b.circles, occupied: false, wreck: false, cam: b.cam, wb: b.wb, rad: b.rad, crash: 0 };
    w.vehicles.push(v); syncMesh(v);
  };
  for (const t of w.towns) {
    const n = t.large ? 10 : 6;
    for (let i = 0; i < n; i++) { const v = r(); place(t, i === 0 && t.large ? 'bus' : v < 0.28 ? 'taxi' : v < 0.6 ? 'sedan' : v < 0.82 ? 'suv' : 'van'); }
  }
}
function syncMesh(v) { v.mesh.position.set(v.x, v.y, v.z); v.mesh.rotation.set(v.pitch, v.yaw, v.roll); }

export function installVehicles(Match) {
  const P = Match.prototype;
  P.nearestVehicle = function (x, z, maxD) {
    let best = null, bd = 1e9;
    for (const v of this.world.vehicles) { if (v.wreck || v.occupied) continue; const d = Math.hypot(v.x - x, v.z - z) - v.rad * 0.5; if (d < maxD && d < bd) { bd = d; best = v; } }
    return best;
  };
  P.toggleVehicle = function () {
    const p = this.player;
    if (p.state === 'drive') return this.exitVehicle();
    if (p.state !== 'ground') return;
    const v = this.nearestVehicle(p.pos.x, p.pos.z, 3.6); if (v) this.enterVehicle(v);
  };
  P.enterVehicle = function (v) {
    const p = this.player; v.occupied = true; p.vehicle = v; p.state = 'drive'; p.camYaw = 0; p.camPitch = 0.2; p.ads = 0; p.reload = 0; p.interact = 0;
    this.hud.setPrompt(''); this.hud.setProgress(0); this.hud.toast(`<b>${v.name}</b> <small>W/S Gas · A/D Lenken · Leertaste Handbremse · E aussteigen</small>`, '#ffd24a'); this.audio.click();
  };
  P.exitVehicle = function () {
    const p = this.player, v = p.vehicle; if (!v) return;
    v.occupied = false; p.vehicle = null; this.audio.engineStop?.(); this.hud.setSpeedo(null);
    const rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
    for (const s of [-1, 1]) { const x = v.x + rx * s * (v.rad * 0.5 + 1.1), z = v.z + rz * s * (v.rad * 0.5 + 1.1); if (!this.world.nearBox(x, z, 0.5)) { p.pos.set(x, this.world.heightAt(x, z), z); break; } }
    p.pos.y = this.world.groundAt(p.pos.x, p.pos.z, p.pos.y + 1); p.state = 'ground'; p.vel.set(0, 0, 0); p.yaw = v.yaw; p.pitch = 0; p.onGround = true; this.camera.fov = this.profile.data.settings.fov; this.camera.updateProjectionMatrix();
  };
  P.damageVehicle = function (v, dmg, attacker) {
    if (v.wreck) return; v.hp -= dmg; if (v.hp > 0) return;
    v.wreck = true; if (v.occupied) { this.player.vehicle === v && this.exitVehicle(); }
    v.mesh.material = charMat; v.speed = 0;
    this.explode(new THREE.Vector3(v.x, v.y + 1, v.z), { splash: 7, dmg: 90, name: 'Fahrzeug-Explosion' }, attacker);
  };
  P.collideVehicles = function (pos, rad) {
    for (const v of this.world.vehicles) {
      if (v.occupied || Math.abs(v.x - pos.x) > 8 || Math.abs(v.z - pos.z) > 8) continue;
      const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
      for (const [zo, cr] of v.circles) { const cx = v.x + s * zo, cz = v.z + c * zo, dx = pos.x - cx, dz = pos.z - cz, d = Math.hypot(dx, dz), rr = rad + cr; if (d < rr && d > 1e-5) { pos.x += (dx / d) * (rr - d); pos.z += (dz / d) * (rr - d); } }
    }
  };
  const tmp = { x: 0, z: 0 };
  P.stepVehicle = function (v, dt, thr, steerIn, hand, driven) {
    const w = this.world;
    let acc = 0;
    if (thr > 0) acc = v.speed < 0 ? 18 : 10.5 * (1 - Math.max(0, v.speed) / v.max);
    else if (thr < 0) acc = v.speed > 0.5 ? -24 : -6 * (1 - Math.max(0, -v.speed) / (v.max * 0.35));
    else acc = -Math.sign(v.speed) * Math.min(Math.abs(v.speed) / dt, driven ? 2.2 : 3.5);
    if (hand) acc -= Math.sign(v.speed) * Math.min(22, Math.abs(v.speed) / dt);
    v.speed = clamp(v.speed + acc * dt, -v.max * 0.35, v.max);
    v.steer = lerp(v.steer, steerIn * 0.6 / (1 + Math.abs(v.speed) * 0.07), 1 - Math.exp(-6 * dt));
    v.yaw += (v.speed / v.wb) * Math.tan(v.steer) * dt;
    const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
    v.x += fx * v.speed * dt; v.z += fz * v.speed * dt;
    // Kollision (Kreise entlang der Karosserie)
    v.crash = Math.max(0, v.crash - dt); let hit = false, px = 0, pz = 0;
    for (const [zo, cr] of v.circles) {
      const cx = v.x + Math.sin(v.yaw) * zo, cz = v.z + Math.cos(v.yaw) * zo; tmp.x = cx; tmp.z = cz;
      if (w.collide(tmp, cr, v.y, 1.4)) { px += tmp.x - cx; pz += tmp.z - cz; hit = true; }
    }
    if (hit) {
      v.x += px; v.z += pz; const imp = Math.abs(v.speed);
      if (imp > 5 && v.crash <= 0) {
        v.crash = 0.35; const dmg = (imp - 3) * 7;
        this.audio.hurt?.(); this.damageVehicle(v, dmg, null);
        if (driven && imp > 13) this.damagePlayer((imp - 12) * 2.5, null, 'Unfall', '');
      }
      v.speed *= 0.4;
    }
    const r2 = Math.hypot(v.x, v.z); if (r2 > 985) { v.x *= 985 / r2; v.z *= 985 / r2; v.speed *= 0.8; }
    const g = w.heightAt(v.x, v.z); if (g < -0.3) { v.speed *= 1 - 3 * dt; v.hp -= 20 * dt; if (v.hp <= 0) this.damageVehicle(v, 1, null); }
    v.y = Math.max(g, -0.3);
    const hF = w.heightAt(v.x + fx * 2, v.z + fz * 2), hB = w.heightAt(v.x - fx * 2, v.z - fz * 2), rx = Math.cos(v.yaw), rz = -Math.sin(v.yaw);
    const hR = w.heightAt(v.x + rx, v.z + rz), hL = w.heightAt(v.x - rx, v.z - rz);
    v.pitch = lerp(v.pitch, Math.atan2(hF - hB, 4), 1 - Math.exp(-8 * dt)); v.roll = lerp(v.roll, Math.atan2(hR - hL, 2) + (driven ? -v.steer * v.speed * 0.012 : 0), 1 - Math.exp(-8 * dt));
  };
  P.updateDriving = function (dt) {
    const p = this.player, v = p.vehicle, k = this.keys, cam = this.camera;
    this.viewGroup.visible = false; this.hud.scope(false, true);
    const thr = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0), st = (k.has('KeyA') ? 1 : 0) - (k.has('KeyD') ? 1 : 0);
    p.camYaw -= this.mouse.dx * 0.0025; p.camPitch = clamp(p.camPitch + this.mouse.dy * 0.0025, -0.1, 1.0); this.mouse.dx = this.mouse.dy = 0;
    p.camYaw *= Math.exp(-0.8 * dt);
    this.stepVehicle(v, dt, thr, st, k.has('Space'), true);
    // Überfahren
    if (Math.abs(v.speed) > 5) for (const b of this.bots) {
      if (!b.alive || !b.landed) continue;
      const dx = b.x - v.x, dz = b.z - v.z; if (Math.abs(dx) > 4 || Math.abs(dz) > 4) continue;
      if (Math.hypot(dx, dz) < v.rad * 0.5 + 0.7) { this.damageBot(b, Math.abs(v.speed) * 9, 'player', false, v.name); this.hud.hitmarker(false, !b.alive); this.audio.hit(false); v.speed *= 0.93; }
    }
    p.pos.set(v.x, v.y, v.z); p.vel.set(-Math.sin(v.yaw) * v.speed, 0, -Math.cos(v.yaw) * v.speed); p.onGround = true; p.crouch = 0; p.ads = 0; p.sprint = false;
    p.yaw = v.yaw + p.camYaw; p.pitch = -p.camPitch;
    const dist = v.cam, tx = v.x, ty = v.y + (v.kind === 'bus' ? 3.2 : 1.3), tz = v.z, cy = v.yaw + p.camYaw;
    const cx = tx + Math.sin(cy) * dist * Math.cos(p.camPitch), cz = tz + Math.cos(cy) * dist * Math.cos(p.camPitch), cyy = ty + Math.sin(p.camPitch) * dist + 0.8;
    const gh = this.world.heightAt(cx, cz) + 1.0;
    cam.position.set(cx, Math.max(cyy, gh), cz); cam.rotation.order = 'YXZ'; cam.lookAt(tx, ty, tz);
    const fov = 80 + Math.abs(v.speed) * 0.5; if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = fov; cam.updateProjectionMatrix(); }
    this.audio.engine?.(Math.abs(v.speed) / v.max, thr);
    this.hud.setSpeedo(`${Math.round(Math.abs(v.speed) * 3.6)}`, v.hp / v.maxhp);
    this.hud.setPrompt('');
  };
  P.updateVehicles = function (dt) {
    for (const v of this.world.vehicles) {
      if (!v.occupied && !v.wreck && Math.abs(v.speed) > 0.05) this.stepVehicle(v, dt, 0, 0, false, false);
      if (!v.wreck || v.mesh.position.x !== v.x) syncMesh(v);
      if (v.wreck && Math.random() < dt * 4 && Math.hypot(v.x - this.camera.position.x, v.z - this.camera.position.z) < 120) this.spark(v.x + (Math.random() - 0.5) * 2, v.y + 1.4, v.z + (Math.random() - 0.5) * 2, 1, 0.3, 0.3, 0.3, 2, 1.2);
    }
  };
}
