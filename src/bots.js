import * as THREE from 'three';
import { WEAPONS } from './data.js';
import { HALF } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return d; };

const SKINS_T = [0xe0b08c, 0xc99b7a, 0x9a6b4a, 0x6b4630];
const HAIR_T = [0x2a1a10, 0x4a2f1a, 0x7a5530, 0x111111, 0xb08040, 0x5a2a18];
const BLUE_T = [0x1d5fb0, 0x1a529a, 0x2468b8, 0x1b5aa6];
const PARTS = [
  { k: 'torso', g: [0.46, 0.56, 0.26], c: 0xffffff, tint: (b) => b.blue },
  { k: 'stripe', g: [0.1, 0.5, 0.02], c: 0xe6c25a },
  { k: 'belt', g: [0.48, 0.08, 0.28], c: 0xe6c25a },
  { k: 'head', g: [0.22, 0.24, 0.24], c: 0xffffff, tint: (b) => b.skinC },
  { k: 'hair', g: [0.25, 0.1, 0.27], c: 0xffffff, tint: (b) => b.hairC },
  { k: 'hairB', g: [0.24, 0.3, 0.1], c: 0xffffff, tint: (b) => b.hairC },
  { k: 'legL', g: [0.19, 0.8, 0.22], c: 0x1a529a },
  { k: 'legR', g: [0.19, 0.8, 0.22], c: 0x1a529a },
  { k: 'bootL', g: [0.2, 0.14, 0.28], c: 0x6b4528 },
  { k: 'bootR', g: [0.2, 0.14, 0.28], c: 0x6b4528 },
  { k: 'armL', g: [0.14, 0.55, 0.14], c: 0x1d5fb0 },
  { k: 'armR', g: [0.14, 0.55, 0.14], c: 0x1d5fb0 },
  { k: 'pip', g: [0.12, 0.14, 0.16], c: 0x7d8a82 },
  { k: 'gun', g: [0.07, 0.12, 0.7], c: 0x1b1d20 },
];

export function installBots(Match) {
  const P = Match.prototype;

  P.initBots = function () {
    const n = this.opts.players.length; this.bots = []; this.alive = n + 1;
    const used = [];
    this.opts.players.forEach((pl, i) => {
      const skill = clamp(0.18 + pl.rank * 0.085 + (this.rnd() - 0.5) * 0.1, 0.12, 0.95);
      let pt;
      for (let t = 0; t < 30; t++) { pt = this.world.randomLandPoint(this.rnd); if (!used.some((u) => Math.hypot(u[0] - pt[0], u[1] - pt[1]) < 30)) break; }
      used.push(pt);
      const pool = WEAPONS.filter((w) => w.rarity <= (skill > 0.6 ? 2 : 1) && w.rarity >= 0 && w.id !== 'boomstick');
      const w = pool[(this.rnd() * pool.length) | 0];
      this.bots.push({
        id: i, name: pl.name, rank: pl.rank, skill, x: pt[0], z: pt[1], y: this.world.heightAt(pt[0], pt[1]), yaw: this.rnd() * 6.28,
        hp: 100, armor: this.rnd() < 0.4 ? 25 : 0, w, mag: w.mag, alive: true, landed: false, landT: 3 + this.rnd() * 24, kills: 0,
        tx: pt[0], tz: pt[1], waitT: 0, enemy: null, scanT: this.rnd() * 0.4, react: 0, fireT: 0, burst: 4, strafe: 1, strafeT: 1, walk: this.rnd() * 6, accT: 0,
        fall: 0, ping: 0, stuckT: 0, sx: pt[0], sz: pt[1], lootT: this.rnd(), reloadT: 0, moving: false, skinC: SKINS_T[(this.rnd() * 4) | 0], hairC: HAIR_T[(this.rnd() * HAIR_T.length) | 0], blue: BLUE_T[(this.rnd() * 4) | 0], first: true,
      });
    });
    this.player.isPlayer = true;
    this.hash = new Map(); this.hashT = 0;
    this.initBotMeshes();
  };

  P.initBotMeshes = function () {
    const n = this.bots.length; this.botMeshes = {}; this.botGeos = []; this.botMats = [];
    const col = new THREE.Color();
    for (const pt of PARTS) {
      const geo = new THREE.BoxGeometry(...pt.g), mat = new THREE.MeshStandardMaterial({ color: pt.c, roughness: 0.85 });
      const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
      this.scene.add(im); this.botMeshes[pt.k] = im; this.botGeos.push(geo); this.botMats.push(mat);
      if (pt.tint) this.bots.forEach((b, i) => im.setColorAt(i, col.setHex(pt.tint(b))));
    }
    this._m4 = new THREE.Matrix4(); this._l = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1); this._ax = new THREE.Vector3(1, 0, 0);
    this._zero = new THREE.Matrix4().makeScale(0, 0, 0);
  };
  P.disposeBots = function () {
    for (const k in this.botMeshes) this.scene.remove(this.botMeshes[k]);
    this.botGeos.forEach((g) => g.dispose()); this.botMats.forEach((m) => m.dispose());
  };

  P.botEyePos = (b) => ({ x: b.x, y: b.y + 1.55, z: b.z });
  P.targetPos = function (e) { return e.isPlayer ? { x: e.pos.x, y: e.pos.y + 1.4, z: e.pos.z } : { x: e.x, y: e.y + 1.3, z: e.z }; };

  P.rebuildHash = function () {
    this.hash.clear();
    for (const b of this.bots) {
      if (!b.alive || !b.landed) continue;
      const k = ((b.x + HALF) / 50 | 0) * 100 + ((b.z + HALF) / 50 | 0);
      (this.hash.get(k) || this.hash.set(k, []).get(k)).push(b);
    }
  };

  P.botLoS = function (b, t) {
    const ex = b.x, ey = b.y + 1.55, ez = b.z, dx = t.x - ex, dy = t.y - ey, dz = t.z - ez, d = Math.hypot(dx, dy, dz);
    if (d < 1) return true;
    const h = this.world.ray(ex, ey, ez, dx / d, dy / d, dz / d, d - 0.5);
    return h < 0;
  };

  P.botFindEnemy = function (b) {
    const p = this.player, detect = 40 + b.skill * 60; let best = null, bd = 1e9;
    if (p.alive && p.state === 'ground') {
      const d = Math.hypot(p.pos.x - b.x, p.pos.z - b.z), hear = p.shotT > 0 ? 1.4 : 1;
      if (d < detect * hear && d < b.w.range * 1.5 && this.botLoS(b, this.targetPos(p))) { best = p; bd = d; }
    }
    const cx = ((b.x + HALF) / 50) | 0, cz = ((b.z + HALF) / 50) | 0;
    for (let ix = -1; ix <= 1; ix++) for (let iz = -1; iz <= 1; iz++) {
      const arr = this.hash.get((cx + ix) * 100 + (cz + iz)); if (!arr) continue;
      for (const o of arr) {
        if (o === b || !o.alive) continue;
        const d = Math.hypot(o.x - b.x, o.z - b.z); if (d >= bd || d > detect * 0.6) continue;
        if (this.botLoS(b, this.targetPos(o))) { best = o; bd = d; }
      }
    }
    return best;
  };

  P.botPickTarget = function (b) {
    const z = this.zone, r = this.rnd;
    const nextOut = Math.hypot(b.x - z.tcx, b.z - z.tcz) > z.tr * 0.9, curOut = Math.hypot(b.x - z.cx, b.z - z.cz) > z.r * 0.92;
    const urgent = curOut || (nextOut && (this.zoneState === 'shrink' || (ZONE_WAIT_LEFT(this) < 25)));
    let tx, tz;
    if (urgent) { const a = r() * 6.28, d = Math.sqrt(r()) * z.tr * 0.7; tx = z.tcx + Math.cos(a) * d; tz = z.tcz + Math.sin(a) * d; b.urgent = true; }
    else {
      b.urgent = false;
      if (r() < 0.6 && this.world.towns.length) {
        const ts = this.world.towns.filter((t) => Math.hypot(t.x - z.cx, t.z - z.cz) < z.r * 0.95);
        const t = ts.length ? ts[(r() * ts.length) | 0] : null;
        if (t) { const s = t.spots[(r() * t.spots.length) | 0]; tx = s[0]; tz = s[1]; }
      }
      if (tx === undefined) { const a = r() * 6.28, d = 40 + r() * 160; tx = b.x + Math.cos(a) * d; tz = b.z + Math.sin(a) * d; }
      const dz2 = Math.hypot(tx - z.cx, tz - z.cz); if (dz2 > z.r * 0.85) { tx = z.cx + (tx - z.cx) * (z.r * 0.85 / dz2); tz = z.cz + (tz - z.cz) * (z.r * 0.85 / dz2); }
    }
    b.tx = tx; b.tz = tz;
  };
  const ZONE_WAIT_LEFT = (m) => (m.zoneState === 'wait' ? 1e3 : 0) * 0 + (m.zoneState === 'wait' ? (ZONE_PH(m).wait - m.zoneT) : 0);
  const ZONE_PH = (m) => m.constructor.ZP[Math.min(m.zoneIdx, m.constructor.ZP.length - 1)];

  const tmpPos = { x: 0, z: 0 };
  P.botMove = function (b, dx, dz, speed, dt) {
    const nx = b.x + dx * speed * dt, nz = b.z + dz * speed * dt;
    if (this.world.heightAt(nx, nz) < -0.4) return false;
    tmpPos.x = nx; tmpPos.z = nz; this.world.collide(tmpPos, 0.4, b.y, 1.8);
    b.x = tmpPos.x; b.z = tmpPos.z; b.y = this.world.heightAt(b.x, b.z); b.walk += speed * dt * 1.3; b.moving = true;
    return true;
  };

  P.botShoot = function (b, e, dist, dp) {
    const w = b.w, p = this.player, interval = Math.max(60 / w.rpm, 0.1), mult = interval * w.rpm / 60;
    let pHit = clamp(0.18 + 0.62 * b.skill - (dist / w.range) * 0.6, 0.03, 0.85);
    if (e.isPlayer) { const sp = Math.hypot(p.vel.x, p.vel.z); pHit *= 1 - clamp(sp / 10, 0, 1) * 0.3; pHit *= 1 - p.crouch * 0.15; }
    const pellets = w.pellets > 1 ? w.pellets * clamp(1 - dist / w.range, 0.04, 1) * 0.5 : 1;
    const hit = Math.random() < pHit, tp = this.targetPos(e);
    b.mag--; if (b.mag <= 0) { b.reloadT = w.reload; b.mag = w.mag; }
    b.ping = 1.6;
    if (dp < 280) {
      const a = new THREE.Vector3(b.x, b.y + 1.4, b.z), t = new THREE.Vector3(tp.x + (hit ? 0 : (Math.random() - 0.5) * 3), tp.y + (hit ? 0 : (Math.random() - 0.5) * 2), tp.z + (hit ? 0 : (Math.random() - 0.5) * 3));
      if (w.rocket) { /* keine Raketen bei Bots */ } else this.tracer(a, t);
      const vol = clamp(1 - dp / 280, 0, 1), cam = this.camera, rel = new THREE.Vector3(b.x - cam.position.x, 0, b.z - cam.position.z).applyQuaternion(cam.quaternion.clone().invert());
      this.audio.shot(w.cls, vol * vol * 0.9, clamp(rel.x / (Math.hypot(rel.x, rel.z) || 1), -1, 1));
    }
    if (!hit) return;
    const dmg = w.dmg * pellets * mult * (w.rocket ? 0.6 : 1) * (e.isPlayer ? 0.55 : 0.1);
    if (e.isPlayer) this.damagePlayer(dmg, { x: b.x, z: b.z }, b.name, w.name);
    else this.damageBot(e, dmg, b, false, w.name);
  };

  P.damageBot = function (b, dmg, attacker, head, weaponName) {
    if (!b.alive || !b.landed) return;
    const ab = Math.min(b.armor, dmg * 0.5); b.armor -= ab; b.hp -= dmg - ab; b.lastHit = { attacker, weaponName };
    if (attacker === 'player' && b.enemy !== this.player) { b.enemy = this.player; b.react = 0.3 + (1 - b.skill) * 0.5; }
    else if (attacker && attacker.id !== undefined && !b.enemy) b.enemy = attacker;
    if (b.hp <= 0) this.killBot(b, attacker, weaponName);
  };

  P.killBot = function (b, attacker, weaponName) {
    b.alive = false; b.fall = 0; this.alive--;
    const p = this.player, byPlayer = attacker === 'player';
    const killer = byPlayer ? 'Du' : attacker && attacker.name ? attacker.name : 'Zone';
    this.hud.feed(killer, b.name, weaponName, byPlayer);
    if (byPlayer) { p.kills++; p.cash += 100; this.audio.kill(); this.hud.toast(`<b>${b.name}</b> eliminiert <small>+$100</small>`, '#ff5a5a'); }
    else if (attacker && attacker.name) attacker.kills++;
    this.world.addCrate(b.x, b.z, 3, this.rollLoot(3, b), b.y);
    if (this.alive <= 1 && p.alive && !this.over) this.win();
    else if (this.alive === 10 || this.alive === 5) this.hud.banner(`${this.alive} ÜBERLEBENDE`, '', 1800);
  };

  P.botThink = function (b, dt, dp) {
    const z = this.zone, p = this.player;
    // Zone
    if (Math.hypot(b.x - z.cx, b.z - z.cz) > z.r) this.damageBot(b, this.zoneDmg * dt, null, false, 'Zone');
    if (!b.alive) return;
    b.moving = false; b.reloadT = Math.max(0, b.reloadT - dt);
    b.scanT -= dt;
    if (b.scanT <= 0) {
      b.scanT = 0.35 + this.rnd() * 0.2;
      const prev = b.enemy; b.enemy = this.botFindEnemy(b) || (b.enemy && b.enemy.alive !== false && (b.enemy.isPlayer ? p.alive : true) && b.enemyHold > 0 ? b.enemy : null);
      if (b.enemy && b.enemy !== prev) b.react = 0.6 + (1 - b.skill) * 1.4;
      b.enemyHold = b.enemy ? 1.2 : 0;
    }
    b.enemyHold -= dt;
    let e = b.enemy; if (e && (e.isPlayer ? !p.alive : !e.alive)) e = b.enemy = null;
    if (e) {
      const tp = this.targetPos(e), dx = tp.x - b.x, dz = tp.z - b.z, dist = Math.hypot(dx, dz) || 1, want = Math.atan2(-dx, -dz);
      b.yaw += angDiff(b.yaw, want) * Math.min(1, dt * 8);
      const fx = dx / dist, fz = dz / dist;
      if (b.reloadT <= 0) {
        if (dist > b.w.range * 0.55) this.botMove(b, fx, fz, 5.2, dt);
        else if (dist < 9) this.botMove(b, -fx, -fz, 3.4, dt);
        else { b.strafeT -= dt; if (b.strafeT <= 0) { b.strafe *= -1; b.strafeT = 0.8 + this.rnd() * 1.6; } this.botMove(b, -fz * b.strafe, fx * b.strafe, 2.6, dt); }
      }
      b.react -= dt;
      if (b.react <= 0 && b.reloadT <= 0 && dist < b.w.range * 1.05) {
        b.fireT -= dt;
        while (b.fireT <= 0) {
          this.botShoot(b, e, dist, dp);
          b.fireT += Math.max(60 / b.w.rpm, 0.1) * (b.w.auto ? 1 : 1.3);
          if (--b.burst <= 0) { b.burst = 3 + ((this.rnd() * 6) | 0); b.fireT += 0.3 + this.rnd() * (0.7 - b.skill * 0.4); }
          if (b.reloadT > 0) break;
        }
      }
      return;
    }
    // Umherlaufen
    if (b.first) { b.first = false; let bt = null, bd = 1e9; for (const t of this.world.towns) { const d = Math.hypot(t.x - b.x, t.z - b.z); if (d < bd) { bd = d; bt = t; } } if (bt && bd < 420) { const s = bt.spots[(this.rnd() * bt.spots.length) | 0]; b.tx = s[0]; b.tz = s[1]; } else this.botPickTarget(b); }
    if (b.waitT > 0 && !b.urgent) { b.waitT -= dt; b.yaw += Math.sin(this.time + b.id) * dt * 0.5; }
    else {
      const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
      if (d < 3) { b.waitT = 1 + this.rnd() * 4; this.botPickTarget(b); }
      else {
        const ok = this.botMove(b, dx / d, dz / d, b.urgent ? 6.8 : 4.6, dt);
        b.yaw += angDiff(b.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 6);
        b.stuckT += dt;
        if (b.stuckT > 1.4) { if (Math.hypot(b.x - b.sx, b.z - b.sz) < 1.2 || !ok) { this.botPickTarget(b); } b.sx = b.x; b.sz = b.z; b.stuckT = 0; }
      }
    }
    // Kisten plündern
    b.lootT -= dt;
    if (b.lootT <= 0) {
      b.lootT = 0.6;
      const c = this.world.nearestCrate(b.x, b.y, b.z, 3.4);
      if (c) {
        this.world.openCrate(c); const loot = c.loot || (c.loot = this.rollLoot(c.tier));
        for (const it of loot) {
          if (it.type === 'weapon' && (it.def.rarity >= b.w.rarity || this.rnd() < 0.2) && it.def.id !== 'boomstick') { b.w = it.def; b.mag = it.def.mag; }
          else if (it.type === 'armor') b.armor = Math.min(100, b.armor + it.n);
          else if (it.type === 'medkit') b.hp = Math.min(100, b.hp + 40);
        }
        b.waitT = 1.2;
      }
    }
  };

  P.updateBots = function (dt) {
    const p = this.player;
    p.shotT = Math.max(0, (p.shotT || 0) - dt); if (this.mouse.l && p.fireCD > 0 && p.state === 'ground') p.shotT = 1.5;
    this.hashT -= dt; if (this.hashT <= 0) { this.hashT = 0.3; this.rebuildHash(); }
    for (const b of this.bots) {
      if (!b.landed) { if (this.time >= b.landT) { b.landed = true; b.y = this.world.heightAt(b.x, b.z); } else continue; }
      if (!b.alive) { b.fall = Math.min(1, b.fall + dt * 2.2); continue; }
      b.ping = Math.max(0, b.ping - dt);
      const dp = Math.hypot(b.x - p.pos.x, b.z - p.pos.z);
      b.accT += dt; const need = dp > 260 ? 0.4 : dp > 130 ? 0.1 : 0; if (b.accT < need) continue;
      const d = b.accT; b.accT = 0; this.botThink(b, d, dp);
    }
    this.renderBots();
  };

  P.renderBots = function () {
    const M = this.botMeshes, base = this._m4, local = this._l, q = this._q, pos = this._p, s = this._s, ax = this._ax, p = this.player;
    const cp = this.camera.position;
    const setPart = (k, i, px, py, pz, rx, cy) => {
      pos.set(px, py + cy * Math.cos(rx), pz + cy * Math.sin(rx)); q.setFromAxisAngle(ax, rx); local.compose(pos, q, s);
      M[k].setMatrixAt(i, local.premultiply(base));
    };
    this.bots.forEach((b, i) => {
      const dist = Math.hypot(b.x - cp.x, b.z - cp.z);
      if (!b.landed || (!b.alive && b.fall >= 1 && this.time - (b.deadAt || (b.deadAt = this.time)) > 4) || dist > 520) { for (const k in M) M[k].setMatrixAt(i, this._zero); return; }
      pos.set(b.x, b.y, b.z); q.setFromAxisAngle(this._yAx || (this._yAx = new THREE.Vector3(0, 1, 0)), b.yaw);
      const qb = new THREE.Quaternion().copy(q);
      if (!b.alive) { qb.multiply(new THREE.Quaternion().setFromAxisAngle(ax, b.fall * 1.5)); }
      base.compose(pos, qb, s);
      const sw = b.moving ? Math.sin(b.walk) * 0.65 : 0, armF = b.enemy ? 1.35 : (b.moving ? 1.1 : 1.0);
      setPart('torso', i, 0, 1.12, 0, 0, 0); setPart('stripe', i, 0, 1.12, -0.135, 0, 0); setPart('belt', i, 0, 0.83, 0, 0, 0);
      setPart('head', i, 0, 1.55, 0, 0, 0); setPart('hair', i, 0, 1.69, 0, 0, 0); setPart('hairB', i, 0, 1.55, 0.13, 0.1, 0);
      setPart('legL', i, -0.12, 0.82, 0, sw, -0.41); setPart('legR', i, 0.12, 0.82, 0, -sw, -0.41);
      setPart('bootL', i, -0.12, 0.82, 0, sw, -0.74); setPart('bootR', i, 0.12, 0.82, 0, -sw, -0.74);
      setPart('armL', i, -0.3, 1.38, 0, armF - 0.1, -0.27); setPart('armR', i, 0.3, 1.38, 0, armF, -0.27);
      setPart('pip', i, -0.37, 1.38, 0, armF - 0.1, -0.42);
      setPart('gun', i, 0.1, 1.12, -0.38, 0, 0);
    });
    for (const k in M) M[k].instanceMatrix.needsUpdate = true;
  };
}
