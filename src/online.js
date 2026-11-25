import * as THREE from 'three';
import { WEAPON_BY_ID, CHAR_BY_ID } from './data.js';
import { makeHumanGroup, randomOutfit } from './human.js';
import { characterReady, Actor } from './character.js';
import { flatWeapon } from './weaponmodel.js';
import { mulberry32 } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerpAng = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return a + d * t; };
const r2 = (v) => Math.round(v * 100) / 100;

function nameSprite(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.font = 'bold 34px Arial'; x.textAlign = 'center'; x.lineWidth = 6; x.strokeStyle = '#000'; x.strokeText(text, 128, 42); x.fillStyle = '#fff'; x.fillText(text, 128, 42);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); s.scale.set(1.8, 0.45, 1); s.position.y = 2.2; return s;
}

export function installOnline(Match) {
  const P = Match.prototype;

  P.spawnPos = function (index, count) { const ang = (index / Math.max(1, count)) * Math.PI * 2; return [Math.cos(ang) * 650, Math.sin(ang) * 650]; };

  P.initOnline = function () {
    this.remotes = new Map(); const on = this.opts.online; if (!on) return;
    this.net = on.net; this.myId = on.you; this.netT = 0; this.lastHitBy = null; this.alive = on.players.length;
    for (const pl of on.players) {
      if (pl.id === on.you) continue;
      let actor = null, group, outfit = null;
      if (characterReady()) { actor = new Actor(pl.id, this.bomb ? (pl.team === 0 ? 0xffc080 : 0x9ec0ff) : (CHAR_BY_ID[pl.cskin] ? CHAR_BY_ID[pl.cskin].tint : null)); group = new THREE.Group(); group.add(actor.root); actor.attachWeapon(flatWeapon(WEAPON_BY_ID.sidekick)); }
      else { outfit = randomOutfit(mulberry32(on.seed + pl.id * 131)); group = makeHumanGroup(outfit, false); }
      if (!this.bomb || pl.team === this.myTeam) group.add(nameSprite(pl.name));
      const [sx, sz] = this.spawnPos(pl.index, on.count);
      group.position.set(sx, 300, sz); this.scene.add(group);
      this.remotes.set(pl.id, { id: pl.id, team: pl.team, name: pl.name, rank: pl.rank, group, outfit, actor, wid: 'sidekick', x: sx, y: 300, z: sz, tx: sx, ty: 300, tz: sz, yaw: 0, tyaw: 0, pitch: 0, walk: 0, moving: false, aim: 0.7, w: 'sidekick', alive: true, ping: 0, st: 'fall', t: 0 });
    }
    const n = this.net;
    n.on('s', (m) => { const r = this.remotes.get(m.id); if (!r) return; r.tx = m.x; r.ty = m.y; r.tz = m.z; r.tyaw = m.yaw; r.pitch = m.p; r.st = m.st; r.aim = 0.6 + (m.a || 0) * 0.4; r.w = m.w; r.crouch = m.c; })
      .on('shot', (m) => {
        const r = this.remotes.get(m.id); if (!r) return; r.ping = 1.5;
        const a = new THREE.Vector3(...m.o), b = new THREE.Vector3(...m.e); this.tracer(a, b);
        const cp = this.camera.position, d = Math.hypot(a.x - cp.x, a.z - cp.z), rel = new THREE.Vector3(a.x - cp.x, 0, a.z - cp.z).applyQuaternion(this.camera.quaternion.clone().invert());
        const vol = clamp(1 - d / 300, 0, 1); this.audio.shot(m.cls, vol * vol, clamp(rel.x / (Math.hypot(rel.x, rel.z) || 1), -1, 1), d);
      })
      .on('hit', (m) => {
        const r = this.remotes.get(m.from); this.lastHitBy = { id: m.from, name: r ? r.name : 'Gegner', w: m.w, t: this.time };
        this.damagePlayer(m.dmg, { x: m.x ?? (r ? r.x : this.player.pos.x), z: m.z ?? (r ? r.z : this.player.pos.z) }, r ? r.name : 'Gegner', m.w);
      })
      .on('crate', (m) => { const c = this.findCrate(m.cid); if (c && !c.opened) this.world.openCrate(c); })
      .on('dead', (m) => this.onRemoteDead(m))
      .on('end', () => { if (this.player.alive && !this.over) this.win(); })
      .on('close', () => { if (!this.over) { this.hud.toast('Verbindung zum Server verloren', '#ff6a6a'); this.die('Verbindung getrennt', '', true); } });
  };
  P.findCrate = function (id) { return typeof id === 'number' ? this.world.crates[id] : this.world.crates.find((c) => c.id === id); };
  P.crateLoot = function (c) {
    const idx = this.world.crates.indexOf(c);
    if (this.opts.online && idx >= 0 && idx < this.world.baseCrates) return this.rollLoot(c.tier, null, mulberry32(this.opts.online.seed * 31 + idx * 7919));
    return this.rollLoot(c.tier);
  };
  P.netCrate = function (c) { if (!this.net) return; const idx = this.world.crates.indexOf(c); this.net.send({ t: 'crate', cid: c.id ?? idx }); };
  P.netShot = function (from, to, def) {
    if (!this.net || this._ns >= 3) return; this._ns = (this._ns || 0) + 1;
    this.net.send({ t: 'shot', o: [r2(from.x), r2(from.y), r2(from.z)], e: [r2(to.x), r2(to.y), r2(to.z)], cls: def.cls });
  };
  P.netHit = function (r, dmg, head, wname) { this.net.send({ t: 'hit', to: r.id, dmg: Math.round(dmg), head, w: wname, x: r2(this.player.pos.x), z: r2(this.player.pos.z) }); };
  P.netDead = function (weapon) {
    if (!this.net) return; const p = this.player, w = this.weapon(), by = this.lastHitBy && this.time - this.lastHitBy.t < 12 ? this.lastHitBy.id : null;
    this.net.send({ t: 'dead', by, w: weapon || (this.lastHitBy ? this.lastHitBy.w : ''), x: r2(p.pos.x), y: r2(p.pos.y), z: r2(p.pos.z), loot: this.bomb ? null : { w: w ? w.def.id : null, cash: Math.floor(p.cash * 0.5) } });
    if (!this.bomb) setTimeout(() => this.net && this.net.close(), 400);
  };
  P.onRemoteDead = function (m) {
    if (m.id === this.myId) return;
    if (this.bomb) return this.onBombDead(m);
    const r = this.remotes.get(m.id), p = this.player; if (!r || !r.alive) return;
    r.alive = false; r.group.visible = false; this.alive--;
    const killer = m.by === this.myId ? 'Du' : m.by ? (this.remotes.get(m.by) || {}).name || '?' : 'Zone', mine = m.by === this.myId;
    if (m.left) this.hud.toast(`${r.name} hat das Match verlassen`, '#aab');
    else this.hud.feed(killer, r.name, m.w, mine);
    if (mine) { p.kills++; p.cash += 100; this.audio.kill(); this.hud.toast(`<b>${r.name}</b> eliminiert <small>+$100</small>`, '#ff5a5a'); }
    if (m.x !== undefined && m.loot && m.loot.w) {
      const def = WEAPON_BY_ID[m.loot.w], items = [{ type: 'weapon', def }, { type: 'ammo', ammo: def.ammo, n: def.mag }];
      if (m.loot.cash > 0) items.push({ type: 'cash', n: m.loot.cash });
      const c = this.world.addCrate(m.x, m.z, 3, items, m.y); if (c) c.id = 'd' + m.id;
    }
    if (this.alive <= 1 && p.alive && !this.over) this.win();
    else if (this.alive === 5 || this.alive === 3) this.hud.banner(`${this.alive} ÜBERLEBENDE`, '', 1800);
  };
  P.netTick = function (dt) {
    this._ns = 0; this.netT += dt; if (this.netT < 1 / 12 || !this.player.alive) return; this.netT = 0;
    const p = this.player, w = this.weapon();
    this.net.send({ t: 's', x: r2(p.pos.x), y: r2(p.pos.y), z: r2(p.pos.z), yaw: r2(p.yaw), p: r2(p.pitch), st: p.state === 'fall' ? 'fall' : 'ground', a: r2(p.ads), w: w ? w.def.id : 'sidekick', c: r2(p.crouch) });
  };
  P.updateRemotes = function (dt) {
    if (!this.remotes) return;
    for (const r of this.remotes.values()) {
      if (!r.alive) continue;
      r.ping = Math.max(0, r.ping - dt); r.t += dt;
      const k = Math.min(1, dt * 12), ox = r.x, oz = r.z;
      r.x += (r.tx - r.x) * k; r.y += (r.ty - r.y) * k; r.z += (r.tz - r.z) * k; r.yaw = lerpAng(r.yaw, r.tyaw, k);
      const sp = Math.hypot(r.x - ox, r.z - oz) / Math.max(dt, 1e-4); r.moving = sp > 0.6 && r.st !== 'fall'; if (r.moving) r.walk += sp * dt * 1.3;
      r.group.position.set(r.x, r.y, r.z); r.group.rotation.y = r.yaw;
      if (r.actor) {
        r.group.rotation.y = r.yaw; r.actor.update(dt, r.moving ? Math.min(sp, 9) : 0);
        if (r.wid !== r.w && WEAPON_BY_ID[r.w] && r.actor.weapon) { r.wid = r.w; r.actor.weapon.clear(); r.actor.weapon.add(flatWeapon(WEAPON_BY_ID[r.w])); }
      } else r.group.userData.pose({ walk: r.walk, moving: r.moving, aim: r.st === 'fall' ? 0.2 : r.aim, t: r.t });
      r.x = Number.isFinite(r.x) ? r.x : 0;
    }
  };
  P.disposeOnline = function () {
    if (!this.remotes) return;
    for (const r of this.remotes.values()) { this.scene.remove(r.group); r.group.traverse((o) => { o.geometry && o.geometry.dispose(); }); }
    this.remotes.clear(); if (this.net) this.net.close();
  };
}
