import { RARITY } from './data.js';
import { HALF, MAP } from './world.js';
import { badgeSVG } from './badges.js';

const $ = (s, r = document) => r.querySelector(s);

export class HUD {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
    <div class="hud-tl">
      <div class="stat"><b id="h-alive">100</b><span>ÜBERLEBENDE</span></div>
      <div class="stat"><b id="h-kills">0</b><span>KILLS</span></div>
      <div class="stat cash">$<b id="h-cash">0</b><span>BARGELD</span></div>
    </div>
    <div id="killfeed"></div>
    <div class="hud-top"><div id="h-zone"></div><div id="h-compass"></div></div>
    <div class="hud-tr"><canvas id="minimap" width="240" height="240"></canvas><div id="h-loc">—</div></div>
    <div id="crosshair"><i></i><i></i><i></i><i></i></div>
    <div id="hitmarker"><i></i><i></i><i></i><i></i></div>
    <div id="prompt"></div>
    <div id="progress"><i></i></div>
    <div id="toasts"></div>
    <div id="chute"></div>
    <div class="hud-bl">
      <div class="bar hp"><i id="h-hp"></i><span id="h-hpt">100</span></div>
      <div class="bar ar"><i id="h-ar"></i><span id="h-art">0</span></div>
      <div id="h-med"></div>
    </div>
    <div class="hud-bc" id="h-slots"></div>
    <div class="hud-br"><div id="h-wname"></div><div class="ammo"><b id="h-mag">0</b><span id="h-res">/ 0</span></div><div id="h-reload"></div></div>
    <div id="dmgflash"></div><div id="dmgdir"><i></i></div>
    <div id="scope"><div class="ring"></div><div class="hair h"></div><div class="hair v"></div></div>
    <div id="bigmap"><canvas id="bigmapc" width="900" height="900"></canvas><div class="bm-hint">M zum Schließen</div></div>
    <div id="pause"><div class="box"><h2>PAUSIERT</h2><p>Klicke ins Spiel, um fortzufahren</p><button class="btn" id="p-resume">Fortsetzen</button><button class="btn ghost" id="p-leave">Match verlassen</button></div></div>
    <div id="banner"></div>
    <div id="results"></div>`;
    this.el = (id) => $('#' + id, root);
    this.mm = this.el('minimap').getContext('2d');
    this.bm = this.el('bigmapc').getContext('2d');
    this._c = {};
  }
  set(id, v) { if (this._c[id] !== v) { this._c[id] = v; this.el(id).textContent = v; } }
  setStats(alive, kills, cash) { this.set('h-alive', alive); this.set('h-kills', kills); this.set('h-cash', cash); }
  setHealth(hp, ar, med) {
    this.el('h-hp').style.width = Math.max(0, hp) + '%'; this.el('h-ar').style.width = ar + '%';
    this.set('h-hpt', Math.ceil(Math.max(0, hp))); this.set('h-art', Math.ceil(ar));
    const m = this.el('h-med'); const t = med ? `✚ ${med} Medkit${med > 1 ? 's' : ''} [H]` : ''; if (this._c.med !== t) { this._c.med = t; m.textContent = t; }
  }
  setSlots(slots, cur) {
    const key = slots.map((s) => (s ? s.def.id : '-')).join() + cur;
    if (this._c.slots === key) return; this._c.slots = key;
    this.el('h-slots').innerHTML = slots.map((s, i) => `<div class="slot ${i === cur ? 'on' : ''}" style="${s ? `--c:${RARITY[s.def.rarity].color}` : ''}"><em>${i + 1}</em><span>${s ? s.def.name : 'leer'}</span></div>`).join('');
  }
  setAmmo(w, mag, res, reloading) {
    this.set('h-wname', w ? w.def.name.toUpperCase() : '');
    this.set('h-mag', w ? mag : 0); this.set('h-res', w ? '/ ' + res : '');
    this.set('h-reload', reloading ? 'NACHLADEN…' : (w && mag === 0 && res === 0 ? 'KEINE MUNITION' : (w && mag === 0 ? '[R] NACHLADEN' : '')));
  }
  toast(text, color = '#fff') {
    const d = document.createElement('div'); d.className = 'toast'; d.style.borderColor = color; d.innerHTML = text;
    const t = this.el('toasts'); t.appendChild(d); while (t.children.length > 5) t.firstChild.remove();
    setTimeout(() => d.classList.add('out'), 2600); setTimeout(() => d.remove(), 3100);
  }
  feed(killer, victim, weapon, mine) {
    const d = document.createElement('div'); d.className = 'feed' + (mine ? ' mine' : '');
    d.innerHTML = `<b>${killer}</b> <i>${weapon || '✖'}</i> ${victim}`;
    const f = this.el('killfeed'); f.appendChild(d); while (f.children.length > 5) f.firstChild.remove();
    setTimeout(() => d.remove(), 5000);
  }
  banner(text, sub = '', ms = 2500) {
    const b = this.el('banner'); b.innerHTML = `<h1>${text}</h1><p>${sub}</p>`; b.classList.add('on');
    clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('on'), ms);
  }
  hitmarker(head, kill) {
    const h = this.el('hitmarker'); h.className = ''; void h.offsetWidth; h.className = 'on' + (head ? ' head' : '') + (kill ? ' kill' : '');
  }
  damage(angle) {
    const f = this.el('dmgflash'); f.style.opacity = 0.65; setTimeout(() => (f.style.opacity = 0), 120);
    if (angle !== null) { const d = this.el('dmgdir'); d.style.transform = `rotate(${angle}rad)`; d.style.opacity = 1; clearTimeout(this._dt); this._dt = setTimeout(() => (d.style.opacity = 0), 900); }
  }
  setPrompt(t) { const p = this.el('prompt'); if (this._c.prompt !== t) { this._c.prompt = t; p.textContent = t; p.style.display = t ? 'block' : 'none'; } }
  setProgress(f) { const p = this.el('progress'); p.style.display = f > 0 ? 'block' : 'none'; p.firstChild.style.width = f * 100 + '%'; }
  setChute(t) { const c = this.el('chute'); if (this._c.chute !== t) { this._c.chute = t; c.innerHTML = t || ''; c.style.display = t ? 'block' : 'none'; } }
  setZone(t, danger) { this.set('h-zone', t); this.el('h-zone').classList.toggle('danger', !!danger); }
  setCompass(yaw) {
    let deg = (360 - ((yaw * 180) / Math.PI) % 360) % 360; deg = (deg + 360) % 360;
    const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW']; this.set('h-compass', `${dirs[Math.round(deg / 45) % 8]}  ${Math.round(deg).toString().padStart(3, '0')}°`);
  }
  setLoc(t) { this.set('h-loc', t); }
  scope(on, crosshairHide) { this.el('scope').style.display = on ? 'block' : 'none'; this.el('crosshair').style.opacity = crosshairHide ? 0 : 1; }
  showPause(on) { this.el('pause').style.display = on ? 'flex' : 'none'; }
  bigMapOpen() { return this.el('bigmap').style.display === 'flex'; }
  toggleBigMap(on) { this.el('bigmap').style.display = on ? 'flex' : 'none'; }

  drawMinimap(s) {
    const ctx = this.mm, S = 240, scale = 0.6, c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b1a22'; ctx.fillRect(0, 0, S, S);
    ctx.save();
    const a = scale * c, b = scale * sn, cc = -scale * sn, d = scale * c;
    ctx.setTransform(a, b, cc, d, S / 2 - a * s.x - cc * s.z, S / 2 - b * s.x - d * s.z);
    ctx.drawImage(s.world.mapCanvas, -HALF, -HALF, MAP, MAP);
    // Zone
    ctx.lineWidth = 3 / scale; ctx.strokeStyle = '#3aa0ff'; ctx.beginPath(); ctx.arc(s.zone.cx, s.zone.cz, s.zone.r, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = 'rgba(40,120,255,.18)'; ctx.beginPath(); ctx.rect(-HALF * 3, -HALF * 3, MAP * 3, MAP * 3); ctx.arc(s.zone.cx, s.zone.cz, s.zone.r, 0, 6.2832, true); ctx.fill('evenodd');
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 / scale; ctx.beginPath(); ctx.arc(s.zone.tcx, s.zone.tcz, s.zone.tr, 0, 6.2832); ctx.stroke();
    ctx.fillStyle = '#ff3a3a';
    for (const e of s.pings) { ctx.beginPath(); ctx.arc(e.x, e.z, 5 / scale, 0, 6.2832); ctx.fill(); }
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffd400'; ctx.beginPath(); ctx.moveTo(S / 2, S / 2 - 9); ctx.lineTo(S / 2 + 6, S / 2 + 7); ctx.lineTo(S / 2, S / 2 + 3); ctx.lineTo(S / 2 - 6, S / 2 + 7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
  }
  drawBigMap(s) {
    const ctx = this.bm, S = 900, k = S / MAP;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(s.world.mapCanvas, 0, 0, S, S);
    const X = (x) => (x + HALF) * k, Z = (z) => (z + HALF) * k;
    ctx.fillStyle = 'rgba(40,120,255,.2)'; ctx.beginPath(); ctx.rect(0, 0, S, S); ctx.arc(X(s.zone.cx), Z(s.zone.cz), s.zone.r * k, 0, 6.2832, true); ctx.fill('evenodd');
    ctx.lineWidth = 3; ctx.strokeStyle = '#3aa0ff'; ctx.beginPath(); ctx.arc(X(s.zone.cx), Z(s.zone.cz), s.zone.r * k, 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(s.zone.tcx), Z(s.zone.tcz), s.zone.tr * k, 0, 6.2832); ctx.stroke();
    ctx.font = 'bold 15px Arial'; ctx.textAlign = 'center'; ctx.lineWidth = 3;
    for (const t of s.world.towns) { ctx.strokeStyle = '#000'; ctx.strokeText(t.name, X(t.x), Z(t.z) - 4); ctx.fillStyle = '#fff'; ctx.fillText(t.name, X(t.x), Z(t.z) - 4); }
    ctx.save(); ctx.translate(X(s.x), Z(s.z)); ctx.rotate(-s.yaw); ctx.fillStyle = '#ffd400'; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, 9); ctx.lineTo(0, 4); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  results(html) { const r = this.el('results'); r.innerHTML = html; r.style.display = 'flex'; return r; }
}
