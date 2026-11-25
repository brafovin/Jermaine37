import * as THREE from 'three';
import { WEAPON_BY_ID, keyName, PRESET_CLASSES, unlockLevel } from './data.js';
import { mulberry32 } from './world.js';

const SITE_R = 7, PLANT_T = 4, DEFUSE_T = 6;
const TEAM_COL = ['#ff9a3a', '#4aa8ff'];

function labelSprite(text, color) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.arc(64, 64, 58, 0, 6.3); x.fill(); x.lineWidth = 6; x.strokeStyle = color; x.stroke();
  x.fillStyle = '#fff'; x.font = 'bold 78px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 70);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false })); s.scale.set(4, 4, 1); s.renderOrder = 10; return s;
}

export function installBomb(Match) {
  const P = Match.prototype;

  // Arena = größte Stadt der Karte; Spawns an den gegenüberliegenden Enden, zwei Bombenplätze dazwischen
  P.bombSetup = function () {
    const w = this.world, t = w.towns[0], R = t.r, rr = mulberry32(this.opts.online.seed ^ 0xb0b0), th = rr() * Math.PI * 2;
    const u = [Math.cos(th), Math.sin(th)], v = [-u[1], u[0]];
    const snap = (x, z) => { let best = t.spots[0], bd = 1e9; for (const s of t.spots) { const d = Math.hypot(s[0] - x, s[1] - z); if (d < bd) { bd = d; best = s; } } return best; };
    const sites = [0, 1].map((i) => { const sg = i ? 1 : -1, s = snap(t.x + u[0] * R * 0.12 + v[0] * R * 0.38 * sg, t.z + u[1] * R * 0.12 + v[1] * R * 0.38 * sg); return { x: s[0], z: s[1], name: i ? 'B' : 'A' }; });
    if (this.flagMode) { const c = snap(t.x, t.z); sites.splice(1, 0, { x: c[0], z: c[1], name: 'B' }); sites[0].name = 'A'; sites[2].name = 'C'; }
    this.arena = { t, R, u, v, sites, spawnR: R * 0.78 };
    this.zone = { cx: t.x, cz: t.z, r: R, tcx: t.x, tcz: t.z, tr: R };
  };
  P.bombSpawn = function (side, idx) {
    const a = this.arena, w = this.world, sg = side === 'att' ? -1 : 1;
    let x = a.t.x + a.u[0] * a.spawnR * sg + a.v[0] * (idx - 2.5) * 4, z = a.t.z + a.u[1] * a.spawnR * sg + a.v[1] * (idx - 2.5) * 4;
    for (let i = 0; i < 40 && w.nearBox(x, z, 1.6); i++) { x -= a.u[0] * sg * 3; z -= a.u[1] * sg * 3; }
    const dx = -a.u[0] * sg, dz = -a.u[1] * sg;
    return { x, z, y: w.heightAt(x, z), yaw: Math.atan2(-dx, -dz) };
  };
  P.sideOf = function (team) { return team === this.attTeam ? 'att' : 'def'; };
  P.bombClamp = function (pos) { const a = this.arena, dx = pos.x - a.t.x, dz = pos.z - a.t.z, d = Math.hypot(dx, dz); if (d > a.R) { pos.x = a.t.x + (dx / d) * a.R; pos.z = a.t.z + (dz / d) * a.R; } };

  P.initBomb = function () {
    if (!this.bomb) return;
    const on = this.opts.online, w = this.world;
    this.attTeam = 0; this.score = [0, 0]; this.round = 0; this.phase = 'wait'; this.frozen = true; this.planted = false; this.phaseEnd = performance.now() + 9000; this.bombObjs = []; this.teamIdx = {};
    if (this.flagMode) { this.phase = 'live'; this.freezeUntil = performance.now() + 8000; this.flagLeft = 600; this.flagLeftAt = performance.now(); }
    const cnt = [0, 0]; for (const pl of on.players) this.teamIdx[pl.id] = cnt[pl.team]++;
    w.crates.length = 0; w.baseCrates = 0; w.crateMesh.count = 0; w.beamMesh.count = 0;
    this.hud.el('h-zone').style.display = 'none';
    // Bombenplätze: Ring, Lichtsäule und Beschriftung
    this.arena.sites.forEach((s, i) => {
      const y = w.heightAt(s.x, s.z), col = i ? 0x4aa8ff : 0xffb020;
      const ring = new THREE.Mesh(new THREE.RingGeometry(SITE_R - 0.5, SITE_R, 56).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })); ring.position.set(s.x, y + 0.12, s.z);
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 45, 10, 1, true).translate(0, 22, 0), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); pil.position.set(s.x, y, s.z);
      const lab = labelSprite(s.name, i ? '#4aa8ff' : '#ffb020'); lab.position.set(s.x, y + 6, s.z);
      this.scene.add(ring, pil, lab); this.bombObjs.push(ring, pil, lab);
    });
    this.hud.el('bombhud').style.display = 'block';
    const n = this.net;
    if (this.flagMode) {
      this.flagObjs = this.arena.sites.map((s) => {
        const y = w.heightAt(s.x, s.z), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 7.5, 8), new THREE.MeshStandardMaterial({ color: 0xcfd2d6, metalness: 0.7, roughness: 0.3 }));
        pole.position.set(s.x, y + 3.75, s.z);
        const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshStandardMaterial({ color: 0xbbbbbb, side: THREE.DoubleSide, roughness: 0.7 })); cloth.position.set(s.x + 1.25, y + 1.6, s.z);
        this.scene.add(pole, cloth); this.bombObjs.push(pole, cloth); return { pole, cloth, y };
      });
      this.flagList = this.arena.sites.map((s) => ({ x: s.x, z: s.z, name: s.name, color: '#bbbbbb' }));
      this.flagState = this.arena.sites.map(() => [0, -1]);
      this.refreshLoadoutUI(); this.hud.el('loadout').style.display = 'block'; this.hud.banner('FLAGGEN EINNEHMEN', 'Stehe in den Ringen A, B, C – wer mehr Flaggen hält, sammelt Punkte', 5000);
      const p0 = this.player; p0.armor = 50; p0.ammo = { light: 120, medium: 0, heavy: 0, shells: 0, rocket: 0 }; this.loadoutPick(0, true);
      n.on('fstate', (m) => this.onFState(m)).on('respawn', (m) => this.onRespawn(m)).on('matchend', (m) => this.onMatchEnd(m));
      for (const r of this.remotes.values()) { const sp = this.bombSpawn(this.sideOf(r.team), this.teamIdx[r.id]); r.x = r.tx = sp.x; r.z = r.tz = sp.z; r.y = r.ty = sp.y; r.st = 'ground'; }
      this.alive = on.players.length; return;
    }
    n.on('round', (m) => this.onRound(m)).on('phase', (m) => this.onPhase(m)).on('planted', (m) => this.onPlanted(m)).on('defused', () => this.onDefused())
      .on('roundend', (m) => this.onRoundEnd(m)).on('matchend', (m) => this.onMatchEnd(m));
    for (const r of this.remotes.values()) { const sp = this.bombSpawn(this.sideOf(r.team), this.teamIdx[r.id]); r.x = r.tx = sp.x; r.z = r.tz = sp.z; r.y = r.ty = sp.y; }
    this.alive = on.players.length;
  };
  P.bombPlace = function (p) { // Spielerposition für die laufende Runde
    const sp = this.bombSpawn(this.sideOf(this.myTeam), (this.teamIdx && this.teamIdx[this.myId]) || 0);
    p.pos.set(sp.x, sp.y, sp.z); p.vel.set(0, 0, 0); p.yaw = sp.yaw; p.pitch = 0; p.state = 'ground'; p.onGround = true; p.chute = false;
  };
  P.onRound = function (m) {
    const p = this.player; this.round = m.n; this.attTeam = m.attTeam; this.score = m.score; this.phase = 'freeze'; this.frozen = true; this.planted = false; this.plantSent = false; this.phaseEnd = performance.now() + m.dur * 1000;
    if (this.bombModel) { this.scene.remove(this.bombModel); this.bombModel = null; }
    p.alive = true; p.hp = 100; p.armor = 50; p.reload = 0; p.interact = 0; p.healT = 0; p.medkits = 0; p.crouch = 0; this.over = false; this.bombPlace(p);
    p.ammo = { light: 120, medium: 0, heavy: 0, shells: 0, rocket: 0 }; this.loadoutPick(0, true);
    for (const r of this.remotes.values()) { const sp = this.bombSpawn(this.sideOf(r.team), this.teamIdx[r.id]); r.alive = true; r.group.visible = true; r.x = r.tx = sp.x; r.z = r.tz = sp.z; r.y = r.ty = sp.y; r.st = 'ground'; }
    this.countAlive(); this.hud.setHealth(p.hp, p.armor, 0); this.audio.match();
    const att = this.myTeam === this.attTeam;
    this.hud.banner(`RUNDE ${m.n}`, att ? 'Angreifer: lege die Bombe an Platz A oder B' : 'Verteidiger: verhindere das Legen oder entschärfe die Bombe', 4000);
    this.refreshLoadoutUI(); this.hud.el('loadout').style.display = 'block';
  };
  P.onPhase = function (m) { this.phase = m.phase; this.frozen = false; this.phaseEnd = performance.now() + m.dur * 1000; this.hud.el('loadout').style.display = 'none'; this.hud.banner('LOS!', '', 1200); this.audio.warn(); };
  P.onPlanted = function (m) {
    this.phase = 'planted'; this.planted = true; this.phaseEnd = performance.now() + m.dur * 1000; this.bombSite = this.arena.sites[m.site] || this.arena.sites[0];
    const s = this.bombSite, y = this.world.heightAt(s.x, s.z), g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.24, 0.4), new THREE.MeshStandardMaterial({ color: 0x2a2d2a, metalness: 0.6, roughness: 0.5 }));
    const disp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.14), new THREE.MeshStandardMaterial({ color: 0x113311, emissive: 0x33ff55, emissiveIntensity: 1.2 })); disp.position.set(-0.08, 0.13, 0);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2020 })); led.position.set(0.2, 0.15, 0.1);
    this.bombLight = new THREE.PointLight(0xff2020, 0, 9); this.bombLight.position.set(0.2, 0.4, 0.1); this.bombLed = led;
    g.add(body, disp, led, this.bombLight); body.position.y = 0.12; g.position.set(s.x + 0.6, y, s.z + 0.4); this.scene.add(g); this.bombModel = g; this.bombPos = g.position; this.beepT = 0;
    this.hud.banner('BOMBE GELEGT', `Platz ${s.name} – ${m.dur} Sekunden`, 3000); this.audio.warn();
  };
  P.onDefused = function () { if (this.bombModel) { this.scene.remove(this.bombModel); this.bombModel = null; } this.planted = false; this.hud.banner('BOMBE ENTSCHÄRFT', '', 2500); this.audio.heal(); };
  P.onRoundEnd = function (m) {
    this.score = m.score; this.phase = 'end'; this.frozen = true; this.phaseEnd = performance.now() + 5000; this.hud.el('loadout').style.display = 'none';
    const win = m.winner === this.myTeam, why = { elim: 'Gegner ausgeschaltet', time: 'Zeit abgelaufen', bomb: 'Bombe explodiert', defuse: 'Bombe entschärft' }[m.reason] || '';
    this.hud.banner(win ? 'RUNDE GEWONNEN' : 'RUNDE VERLOREN', why, 4200);
    if (m.reason === 'bomb' && this.bombSite && this.bombModel) { this.explode(new THREE.Vector3(this.bombSite.x, this.world.heightAt(this.bombSite.x, this.bombSite.z) + 0.5, this.bombSite.z), { splash: 18, dmg: 250, name: 'Bombe' }, null); this.scene.remove(this.bombModel); this.bombModel = null; }
  };
  // ---------- Flaggen-Modus ----------
  const FLAG_COL = [0xff9a3a, 0x4aa8ff], NEUTRAL = 0xbbbbbb;
  P.onFState = function (m) {
    this.score = m.score; this.flagState = m.f; this.flagLeft = m.left; this.flagLeftAt = performance.now();
    m.f.forEach(([p, owner], i) => {
      const o = this.flagObjs[i], col = new THREE.Color(NEUTRAL); if (p < 0) col.lerp(new THREE.Color(FLAG_COL[0]), -p); else if (p > 0) col.lerp(new THREE.Color(FLAG_COL[1]), p);
      o.cloth.material.color.copy(col); o.cloth.position.y = o.y + 1.6 + 4.6 * Math.abs(p);
      const ring = this.bombObjs[i * 3], pil = this.bombObjs[i * 3 + 1]; ring.material.color.copy(col); pil.material.color.copy(col);
      this.flagList[i].color = '#' + col.getHexString();
    });
  };
  P.onRespawn = function (m) {
    const r = this.remotes.get(m.id); if (!r || r.alive) return; const sp = this.bombSpawn(this.sideOf(r.team), this.teamIdx[r.id]);
    r.alive = true; r.group.visible = true; r.x = r.tx = sp.x; r.z = r.tz = sp.z; r.y = r.ty = sp.y; this.countAlive();
  };
  P.flagRespawn = function () {
    const p = this.player; this.respawnAt = 0; p.alive = true; p.hp = 100; p.armor = 50; p.state = 'ground'; p.reload = 0; p.healT = 0; p.crouch = 0; p.ads = 0; p.interact = 0; this.over = false;
    this.bombPlace(p); p.ammo = { light: 120, medium: 0, heavy: 0, shells: 0, rocket: 0 }; this.loadoutPick(this.pickedLoadout || 0, true);
    this.net.send({ t: 'alive' }); this.countAlive(); for (const r of this.remotes.values()) if (r.alive) r.group.visible = true;
    this.hud.setPrompt(''); this.hud.setHealth(p.hp, p.armor, 0); this.hud.banner('RESPAWN', 'Zurück ins Gefecht', 1500);
  };
  P.flagInteract = function (dt) {
    const p = this.player, hud = this.hud;
    if (!p.alive || p.state !== 'ground') { if (p.state === 'ground') hud.setPrompt(''); return; }
    const i = this.arena.sites.findIndex((s) => Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < SITE_R + 1);
    if (this.frozen || i < 0) { hud.setPrompt(''); return; }
    const [pr, ow] = this.flagState[i] || [0, -1], mine = this.myTeam === 0 ? -pr : pr;
    hud.setPrompt(ow === this.myTeam ? `Flagge ${this.arena.sites[i].name}: gehört deinem Team` : `Flagge ${this.arena.sites[i].name} wird eingenommen… ${Math.round(Math.max(0, mine) * 100)} %`);
    this.capT = (this.capT || 0) - dt; if (this.capT <= 0) { this.capT = 0.4; this.net.send({ t: 'cap', f: i }); }
  };
  P.flagTick = function () {
    const now = performance.now();
    if (this.frozen && now >= this.freezeUntil) { this.frozen = false; this.hud.el('loadout').style.display = 'none'; this.hud.banner('LOS!', 'Nimm die Flaggen ein', 1800); this.audio.warn(); }
    if (!this._bhT || now - this._bhT > 200) {
      this._bhT = now; const my = this.myTeam, left = Math.max(0, this.flagLeft - (now - this.flagLeftAt) / 1000), mm = Math.floor(left / 60), ss = String(Math.floor(left % 60)).padStart(2, '0');
      const css = (hex) => '#' + hex.toString(16).padStart(6, '0'), dots = this.flagState.map(([p], i) => { const c = new THREE.Color(NEUTRAL); if (p < 0) c.lerp(new THREE.Color(FLAG_COL[0]), -p); else if (p > 0) c.lerp(new THREE.Color(FLAG_COL[1]), p); return `<span class="fdot" style="background:#${c.getHexString()}">${this.arena.sites[i].name}</span>`; }).join('');
      let mine = this.player.alive ? 1 : 0, enemy = 0; for (const r of this.remotes.values()) if (r.alive) { if (r.team === my) mine++; else enemy++; }
      this.hud.setBombHud(`<div class="bh"><span style="color:${TEAM_COL[my]}">DEIN TEAM <b>${this.score[my]}</b></span><i>:</i><span style="color:${TEAM_COL[1 - my]}"><b>${this.score[1 - my]}</b> GEGNER</span></div><div class="bt">${mm}:${ss}</div><div class="bs">Ziel: 150 Punkte · ${mine} vs ${enemy}</div><div class="fl">${dots}</div>`);
    }
  };
  P.onMatchEnd = function (m) {
    if (this.matchDone) return; this.matchDone = true; this.over = true; if (document.pointerLockElement) document.exitPointerLock();
    const p = this.player, win = m.winner === this.myTeam, sc = m.score;
    const res = this.profile.applyMatch({ placement: win ? 1 : 20, kills: p.kills, surviveSec: Math.floor(this.time), cash: p.kills * 100 + (win ? 300 : 100), ranked: false });
    const el = this.hud.results(`<div class="res-box"><div class="res-title ${win ? 'win' : ''}">${win ? 'SIEG!' : 'NIEDERLAGE'}</div><div class="res-sub">${this.flagMode ? 'Flaggen' : 'Bombe'} 6 gegen 6${m.forfeit ? ' · Gegner hat aufgegeben' : ''}</div>
      <div class="res-rank"><b style="color:${TEAM_COL[this.myTeam]}">${sc[this.myTeam]}</b> : <b style="color:${TEAM_COL[1 - this.myTeam]}">${sc[1 - this.myTeam]}</b></div>
      <div class="res-grid"><div><b>${p.kills}</b><span>Kills</span></div><div><b>${win ? 'Sieg' : 'Niederl.'}</b><span>Ergebnis</span></div><div><b>+${res.xp}</b><span>XP</span></div><div><b>+$${res.coins}</b><span>Münzen</span></div></div>
      ${res.levelUp ? `<div class="res-lvl">LEVEL UP! Du bist jetzt Level ${res.level} · +${res.levelCoins} Münzen${res.newWeapons.length ? `<br><small>🔓 Neue Waffen: ${res.newWeapons.map((w) => w.name).join(', ')}</small>` : ''}</div>` : ''}<button class="btn big" id="res-back">ZURÜCK ZUR LOBBY</button></div>`);
    el.querySelector('#res-back').onclick = () => this.exit();
  };
  P.countAlive = function () { let n = this.player.alive ? 1 : 0; for (const r of this.remotes.values()) if (r.alive) n++; this.alive = n; };
  P.presets = function () { return PRESET_CLASSES.map(([label, ids]) => ({ label, def: WEAPON_BY_ID[ids.find((id) => this.profile.isUnlocked(id)) || ids[ids.length - 1]] })); };
  P.refreshLoadoutUI = function () {
    const next = Object.entries({}).length; const lv = this.profile.level.level;
    this.hud.el('loadout').innerHTML = `<h3>WAFFE WÄHLEN</h3>${this.presets().map((x, i) => `<div><b>${i + 1}</b> ${x.label} <i>${x.def.name}</i></div>`).join('')}<small>+ Pistole · Rüstung 50 · Level ${lv}: mehr Waffen schaltest du durch Level frei</small>`;
  };
  P.loadoutPick = function (i, silent) {
    const p = this.player, def = (this.presets()[i] || this.presets()[0]).def;
    if (!p.alive) { this.pickedLoadout = i; this.hud.toast(`Respawn mit: ${def.name}`, '#ffd24a'); return; }
    p.slots = [{ def, mag: def.mag }, { def: WEAPON_BY_ID.sidekick, mag: 12 }, null]; p.cur = 0; p.swap = 0.2; p.ammo[def.ammo] = Math.max(p.ammo[def.ammo], def.mag * 3); p.ammo.light = Math.max(p.ammo.light, 60);
    this.refreshWeaponUI(); if (!silent) this.audio.pickup(); this.pickedLoadout = i;
  };
  P.onBombDead = function (m) {
    const r = this.remotes.get(m.id), p = this.player; if (!r || !r.alive) return;
    r.alive = false; r.group.visible = false; this.countAlive();
    const killer = m.by === this.myId ? 'Du' : m.by ? (this.remotes.get(m.by) || {}).name || '?' : 'Unfall', mine = m.by === this.myId;
    if (m.left) this.hud.toast(`${r.name} hat das Match verlassen`, '#aab'); else this.hud.feed(killer, r.name, m.w, mine);
    if (mine) { p.kills++; p.cash += 100; this.audio.kill(); this.hud.toast(`<b>${r.name}</b> eliminiert`, '#ff5a5a'); }
  };
  P.bombDie = function (killer, weapon, quit) {
    const p = this.player; if (!p.alive) return;
    p.alive = false; p.hp = 0; this.hud.setHealth(0, 0, 0); this.netDead(weapon);
    if (quit) { this.exit(); return; }
    p.state = 'spectate'; this.specI = 0; this.countAlive(); this.hud.banner('ELIMINIERT', this.flagMode ? `von ${killer} · Respawn in 5 s` : `von ${killer}`, 2200);
    if (this.flagMode) this.respawnAt = performance.now() + 5000;
  };
  P.updateSpectate = function () {
    const p = this.player, cam = this.camera; this.viewGroup.visible = false; this.hud.scope(false, true); this.mouse.dx = this.mouse.dy = 0;
    let respawnLeft = 0; if (this.flagMode && this.respawnAt) { respawnLeft = Math.ceil((this.respawnAt - performance.now()) / 1000); if (respawnLeft <= 0) { this.flagRespawn(); return; } }
    let list = [...this.remotes.values()].filter((r) => r.alive && r.team === this.myTeam); if (!list.length) list = [...this.remotes.values()].filter((r) => r.alive);
    for (const r of this.remotes.values()) if (r.alive) r.group.visible = true;
    if (!list.length) { this.hud.setPrompt('Warte auf die nächste Runde…'); return; }
    if (this.mouse.lClick) { this.specI = (this.specI || 0) + 1; this.mouse.lClick = false; }
    const r = list[(this.specI || 0) % list.length]; r.group.visible = false;
    cam.position.set(r.x, r.y + 1.6, r.z); cam.rotation.order = 'YXZ'; cam.rotation.set(r.pitch || 0, r.yaw, 0); p.pos.set(r.x, r.y, r.z); p.yaw = r.yaw;
    this.hud.setPrompt(respawnLeft ? `Respawn in ${respawnLeft} s · Taste 1–4: Waffe für den Respawn wählen` : `Zuschauen: ${r.name} · Klick = nächster Spieler`);
  };
  P.bombInteract = function (dt) {
    const p = this.player, hud = this.hud, att = this.myTeam === this.attTeam;
    const reset = () => { p.interact = 0; hud.setProgress(0); };
    if (!p.alive || this.frozen || p.state !== 'ground') { reset(); if (p.state === 'ground') hud.setPrompt(''); return; }
    let prompt = '', need = 0, act = null;
    if (att && this.phase === 'live' && !this.planted && !this.plantSent) {
      const i = this.arena.sites.findIndex((s) => Math.hypot(p.pos.x - s.x, p.pos.z - s.z) < SITE_R);
      if (i >= 0) { prompt = `${keyName(this.bind.interact)} halten: Bombe legen (Platz ${this.arena.sites[i].name})`; need = PLANT_T; act = () => { this.plantSent = true; this.net.send({ t: 'plant', site: i }); }; }
    } else if (!att && this.planted && this.bombPos && Math.hypot(p.pos.x - this.bombPos.x, p.pos.z - this.bombPos.z) < 3.4) {
      prompt = `${keyName(this.bind.interact)} halten: Bombe entschärfen`; need = DEFUSE_T; act = () => { this.net.send({ t: 'defuse' }); this.planted = false; };
    }
    hud.setPrompt(prompt);
    if (!act) { reset(); return; }
    if (this.keys.has(this.bind.interact)) { p.interact += dt / need; hud.setProgress(Math.min(1, p.interact)); if (p.interact >= 1) { reset(); act(); } } else reset();
  };
  P.bombTick = function (dt) {
    if (this.flagMode) return this.flagTick(dt);
    const now = performance.now(), remain = Math.max(0, (this.phaseEnd - now) / 1000), mm = Math.floor(remain / 60), ss = String(Math.floor(remain % 60)).padStart(2, '0');
    if (this.planted && this.bombModel) {
      this.beepT -= dt; const f = 1 - Math.min(1, remain / 40);
      if (this.beepT <= 0) { this.beepT = 1.0 - f * 0.88; const d = Math.hypot(this.player.pos.x - this.bombPos.x, this.player.pos.z - this.bombPos.z); if (this.audio.beep) this.audio.beep(Math.max(0.15, 1 - d / 120)); this.bombLight.intensity = 6; }
      this.bombLight.intensity = Math.max(0, this.bombLight.intensity - dt * 20);
    }
    if (!this._bhT || now - this._bhT > 200) {
      this._bhT = now; const my = this.myTeam, p = this.player, att = my === this.attTeam;
      let mine = p.alive ? 1 : 0, enemy = 0; for (const r of this.remotes.values()) if (r.alive) { if (r.team === my) mine++; else enemy++; }
      const state = this.phase === 'freeze' ? 'Vorbereitung' : this.phase === 'planted' ? '<span class="bomb">BOMBE GELEGT</span>' : this.phase === 'end' ? 'Rundenende' : 'Runde läuft';
      const html = `<div class="bh"><span style="color:${TEAM_COL[my]}">DEIN TEAM <b>${this.score[my]}</b></span><i>:</i><span style="color:${TEAM_COL[1 - my]}"><b>${this.score[1 - my]}</b> GEGNER</span></div>
        <div class="bt ${this.planted ? 'red' : ''}">${mm}:${ss}</div><div class="bs">Runde ${this.round} · ${state} · ${mine} vs ${enemy}</div><div class="bs">${att ? 'ANGREIFER – Bombe legen' : 'VERTEIDIGER – Plätze sichern'}</div>`;
      this.hud.setBombHud(html);
    }
  };
}
