import * as THREE from 'three';
import { RANKS, WEAPONS, WEAPON_BY_ID, SKINS, SKIN_BY_ID, RARITY, AMMO, BP_TIERS, BP_XP, BP_PREMIUM_PRICE, bpReward, hex, PLACEMENT_MATCHES } from './data.js';
import { badgeSVG } from './badges.js';
import { makeSoldier } from './weaponmodel.js';
import { xpForLevel } from './profile.js';

export class Lobby {
  constructor({ renderer, profile, audio, root, onPlay, onQuality }) {
    Object.assign(this, { renderer, profile, audio, root, onPlay, onQuality });
    this.mode = 'br'; this.previewWeapon = 'falcon'; this.active = false; this.rotY = -0.35; this.drag = null;
    this.buildScene(); this.buildUI(); this.rebuildSoldier();
    profile.onChange(() => { if (this.active) this.refreshTop(); });
    addEventListener('resize', () => this.resize());
  }

  // ---------- 3D-Bühne ----------
  buildScene() {
    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color(0x07141a); s.fog = new THREE.Fog(0x07141a, 8, 22);
    this.cam = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 60); this.cam.position.set(0, 1.35, 4.6); this.cam.lookAt(0, 1.0, 0);
    s.add(new THREE.HemisphereLight(0x6fb8c8, 0x111a1c, 0.7));
    const key = new THREE.SpotLight(0xfff0dc, 90, 20, 0.5, 0.6, 1.5); key.position.set(2.6, 4.2, 4); key.target.position.set(0, 1.1, 0); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004;
    const rim = new THREE.PointLight(0x2fd0c0, 30, 14); rim.position.set(-3, 2.4, -2.5);
    const rim2 = new THREE.PointLight(0xffa040, 18, 12); rim2.position.set(3.5, 1.5, -2);
    s.add(key, key.target, rim, rim2);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 64), new THREE.MeshStandardMaterial({ color: 0x1c2a2e, roughness: 0.55, metalness: 0.5 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.18, 64), new THREE.MeshBasicMaterial({ color: 0x3fe0d0 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; s.add(ring);
    // Bunker-Kulisse
    const wallM = new THREE.MeshStandardMaterial({ color: 0x23343a, roughness: 0.8, metalness: 0.2 });
    for (let i = -4; i <= 4; i++) {
      const h = 3 + (i % 2 ? 1.2 : 0), p = new THREE.Mesh(new THREE.BoxGeometry(1.6, h, 0.4), wallM); p.position.set(i * 1.9, h / 2, -6 - Math.abs(i) * 0.25); p.rotation.y = i * 0.07; p.castShadow = p.receiveShadow = true; s.add(p);
      if (i % 2 === 0) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, h * 0.8, 0.06), new THREE.MeshBasicMaterial({ color: i % 4 === 0 ? 0x3fe0d0 : 0xffa040 })); l.position.set(i * 1.9 + 0.5, h / 2, -5.75 - Math.abs(i) * 0.25); s.add(l); }
    }
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(1, 0.7, 0.7), new THREE.MeshStandardMaterial({ color: 0x3e4a38, roughness: 0.9 })); c.position.set(-4.5 + i * 0.2, 0.35 + (i % 2) * 0.7, -2.2 - i * 0.5); c.rotation.y = 0.4 + i; c.castShadow = c.receiveShadow = true; s.add(c); }
    this.soldierHolder = new THREE.Group(); s.add(this.soldierHolder);
  }
  rebuildSoldier() {
    this.soldierHolder.clear();
    const skin = SKIN_BY_ID[this.profile.data.skin] || SKINS[0];
    this.soldier = makeSoldier(skin, WEAPON_BY_ID[this.previewWeapon]); this.soldierHolder.add(this.soldier);
  }
  resize() { this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); }
  start() {
    this.active = true; this.root.style.display = 'block'; this.resize(); this.refreshTop(); this.last = performance.now();
    const loop = (t) => {
      if (!this.active) return; requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
      const time = t / 1000;
      this.soldierHolder.rotation.y = this.rotY + Math.sin(time * 0.4) * 0.08; this.soldier.userData.update(time);
      this.renderer.autoClear = true; this.renderer.render(this.scene, this.cam);
    };
    requestAnimationFrame(loop);
  }
  stop() { this.active = false; this.root.style.display = 'none'; this.closePanel(); }

  // ---------- UI ----------
  buildUI() {
    const r = this.root;
    r.innerHTML = `
    <div class="lb-tl">
      <button class="acc" id="lb-acc"><div class="avatar" id="lb-avatar"></div><div class="acc-info"><b id="lb-name"></b><div class="lvl"><span id="lb-lvl"></span><div class="xpbar"><i id="lb-xp"></i></div></div></div><div id="lb-rank"></div></button>
      <button class="bp-banner" id="lb-bp"><small id="lb-season">SAISON 01</small><b>BATTLE PASS</b><span id="lb-bpinfo"></span></button>
    </div>
    <div class="lb-tr"><div class="coins"><i></i><b id="lb-coins">0</b></div><button class="ico" id="lb-set" title="Einstellungen">⚙</button></div>
    <div class="lb-left">
      <button class="nav" data-p="shop"><i>🛒</i><span>SHOP</span></button>
      <button class="nav" data-p="bp"><i>★</i><span>BATTLE PASS</span></button>
      <button class="nav" data-p="arsenal"><i>🔫</i><span>WAFFEN</span></button>
      <button class="nav" data-p="rank"><i>🏆</i><span>RANG</span></button>
    </div>
    <div class="lb-title"><b>JERMAINE37</b><span>BATTLE ROYALE</span></div>
    <div class="lb-br">
      <div class="modes">
        <button class="mode on" data-m="br"><b>BATTLE ROYALE</b><small>100 Spieler · Verdansk Island</small></button>
        <button class="mode" data-m="ranked"><b>RANKED</b><small id="lb-rk-sub"></small><div class="mode-badge" id="lb-mbadge"></div></button>
      </div>
      <button class="play" id="lb-play"><span>▶ SPIEL STARTEN</span><small>MATCH FINDEN</small></button>
    </div>
    <div class="panel" id="panel"><div class="panel-box"><button class="close" id="panel-x">✕</button><div id="panel-body"></div></div></div>`;
    const q = (s) => r.querySelector(s);
    r.querySelectorAll('.nav').forEach((b) => (b.onclick = () => { this.audio.click(); this.openPanel(b.dataset.p); }));
    q('#lb-bp').onclick = () => this.openPanel('bp'); q('#lb-acc').onclick = () => this.openPanel('account'); q('#lb-set').onclick = () => this.openPanel('settings');
    q('#panel-x').onclick = () => this.closePanel(); q('#panel').onclick = (e) => { if (e.target.id === 'panel') this.closePanel(); };
    r.querySelectorAll('.mode').forEach((b) => (b.onclick = () => { this.audio.click(); this.mode = b.dataset.m; r.querySelectorAll('.mode').forEach((x) => x.classList.toggle('on', x === b)); }));
    q('#lb-play').onclick = () => { this.audio.init(); this.audio.click(); this.onPlay(this.mode); };
    // Charakter drehen
    const cv = this.renderer.domElement;
    r.addEventListener('mousedown', (e) => { if (e.target === r || e.target.classList.contains('lb-title')) this.drag = e.clientX; });
    addEventListener('mouseup', () => (this.drag = null));
    addEventListener('mousemove', (e) => { if (this.drag !== null && this.active) { this.rotY += (e.clientX - this.drag) * 0.01; this.drag = e.clientX; } });
  }
  refreshTop() {
    const p = this.profile, d = p.data, lv = p.level, rk = p.rank, q = (s) => this.root.querySelector(s);
    q('#lb-name').textContent = d.name; q('#lb-lvl').textContent = 'LV ' + lv.level; q('#lb-xp').style.width = (lv.cur / lv.need) * 100 + '%';
    q('#lb-coins').textContent = d.coins.toLocaleString('de-DE');
    q('#lb-rank').innerHTML = `${badgeSVG(rk.idx, 48)}<span style="color:${rk.rank.color}">${rk.label}</span>`;
    q('#lb-avatar').textContent = d.name.slice(0, 2).toUpperCase();
    q('#lb-bpinfo').textContent = `Stufe ${p.bpTier}/${BP_TIERS} · noch ${p.daysLeft} Tage`;
    q('#lb-rk-sub').textContent = rk.placing ? `Platzierung ${d.rankedPlayed}/${PLACEMENT_MATCHES}` : `${rk.label} · ${d.rp} RP`;
    q('#lb-mbadge').innerHTML = badgeSVG(rk.idx, 38);
    q('#lb-season').textContent = 'SAISON 01';
  }
  openPanel(name) {
    this.panelName = name; const b = this.root.querySelector('#panel-body'), pan = this.root.querySelector('#panel');
    pan.style.display = 'flex';
    ({ shop: () => this.pShop(b), bp: () => this.pBP(b), arsenal: () => this.pArsenal(b), rank: () => this.pRank(b), settings: () => this.pSettings(b), account: () => this.pAccount(b) })[name]();
  }
  closePanel() { this.panelName = null; const p = this.root.querySelector('#panel'); if (p) p.style.display = 'none'; }
  rerender() { if (this.panelName) this.openPanel(this.panelName); this.refreshTop(); }

  skinCard(s, mode) {
    const own = this.profile.data.owned.includes(s.id), eq = this.profile.data.skin === s.id, rar = RARITY[s.rarity];
    return `<div class="card skin ${eq ? 'eq' : ''}" style="--rc:${rar.color}">
      <div class="swatch" style="background:linear-gradient(135deg,${hex(s.color)} 0%,${hex(s.color)} 45%,${hex(s.accent)} 46%,${hex(s.accent)} 56%,${hex(s.color)} 57%);box-shadow:inset 0 0 40px ${s.emissive ? hex(s.emissive) + 'aa' : '#0006'}"></div>
      <div class="cn">${s.name}</div><div class="cr">${rar.name}</div>
      ${own ? `<button class="btn sm ${eq ? 'ghost' : ''}" data-eq="${s.id}">${eq ? 'AUSGERÜSTET' : 'AUSRÜSTEN'}</button>` : `<button class="btn sm gold" data-buy="${s.id}" ${this.profile.data.coins < s.price ? 'disabled' : ''}><i class="coin"></i>${s.price}</button>`}
    </div>`;
  }
  pShop(b) {
    b.innerHTML = `<h2>SHOP</h2><p class="sub">Waffen-Skins · Münzen verdienst du mit Bargeld aus Matches.</p><div class="grid">${SKINS.map((s) => this.skinCard(s)).join('')}</div>`;
    b.querySelectorAll('[data-buy]').forEach((e) => (e.onclick = () => { if (this.profile.buySkin(e.dataset.buy)) { this.audio.pickup(); this.profile.equipSkin(e.dataset.buy); this.rebuildSoldier(); this.rerender(); } }));
    b.querySelectorAll('[data-eq]').forEach((e) => (e.onclick = () => { this.profile.equipSkin(e.dataset.eq); this.audio.click(); this.rebuildSoldier(); this.rerender(); }));
  }
  rewardHtml(r) {
    if (r.type === 'coins') return `<div class="rw"><i class="coin big"></i><b>${r.amount}</b></div>`;
    const s = SKIN_BY_ID[r.id]; return `<div class="rw skin" style="--rc:${RARITY[s.rarity].color}"><div class="sw" style="background:linear-gradient(135deg,${hex(s.color)} 50%,${hex(s.accent)} 51%)"></div><b>${s.name}</b></div>`;
  }
  pBP(b) {
    const p = this.profile, d = p.data, tier = p.bpTier, into = d.bpXp - tier * BP_XP;
    let cols = '';
    for (let t = 1; t <= BP_TIERS; t++) {
      const rw = bpReward(t), cf = p.canClaim('free', t), cp = p.canClaim('prem', t);
      const cell = (track, r, can) => {
        const done = d.bpClaimed[track].includes(t), locked = t > tier || (track === 'prem' && !d.bpPremium);
        return `<div class="bpc ${track} ${done ? 'done' : ''} ${locked ? 'locked' : ''} ${can ? 'can' : ''}" ${can ? `data-claim="${track}:${t}"` : ''}>${this.rewardHtml(r)}<div class="st">${done ? '✓ ERHALTEN' : can ? 'ABHOLEN' : locked ? '🔒' : ''}</div></div>`;
      };
      cols += `<div class="bpcol ${t <= tier ? 'reached' : ''}"><div class="bpt">${t}</div>${cell('free', rw.free, cf)}${cell('prem', rw.prem, cp)}</div>`;
    }
    b.innerHTML = `<h2>BATTLE PASS <small>SAISON 01 · noch ${p.daysLeft} Tage</small></h2>
      <div class="bp-head"><div><b>Stufe ${tier}</b>/${BP_TIERS}<div class="xpbar wide"><i style="width:${tier >= BP_TIERS ? 100 : (into / BP_XP) * 100}%"></i></div><small>${tier >= BP_TIERS ? 'Maximal' : into + ' / ' + BP_XP + ' XP bis Stufe ' + (tier + 1)}</small></div>
      <div class="bp-btns">${d.bpPremium ? '<span class="prem-on">★ PREMIUM AKTIV</span>' : `<button class="btn gold" id="bp-prem" ${d.coins < BP_PREMIUM_PRICE ? 'disabled' : ''}>★ PREMIUM FREISCHALTEN <i class="coin"></i>${BP_PREMIUM_PRICE}</button>`}<button class="btn" id="bp-all">ALLE ABHOLEN</button></div></div>
      <div class="bp-legend"><span>KOSTENLOS</span><span>PREMIUM</span></div><div class="bp-scroll"><div class="bprow">${cols}</div></div>
      <p class="sub">Obere Reihe: kostenlos · untere Reihe: Premium. XP bekommst du pro Match: Platzierung, Kills und Überlebenszeit.</p>`;
    b.querySelectorAll('[data-claim]').forEach((e) => (e.onclick = () => { const [tr, t] = e.dataset.claim.split(':'); const sc = b.querySelector('.bp-scroll').scrollLeft; this.profile.claim(tr, +t); this.audio.pickup(); this.rebuildSoldier(); this.rerender(); this.root.querySelector('.bp-scroll').scrollLeft = sc; }));
    const pr = b.querySelector('#bp-prem'); if (pr) pr.onclick = () => { if (p.buyPremium()) { this.audio.pickup(); this.rerender(); } };
    b.querySelector('#bp-all').onclick = () => { p.claimAll(); this.audio.pickup(); this.rerender(); };
    const sc = b.querySelector('.bp-scroll'); sc.scrollLeft = Math.max(0, (tier - 2) * 118);
  }
  pArsenal(b) {
    const mx = (k) => Math.max(...WEAPONS.map((w) => (k === 'dps' ? w.dmg * w.pellets * w.rpm / 60 : w[k])));
    const bar = (v, m, c) => `<div class="sb"><i style="width:${Math.min(100, v / m * 100)}%;background:${c}"></i></div>`;
    b.innerHTML = `<h2>WAFFENKAMMER <small>20 Waffen · in Kisten im Match zu finden</small></h2><div class="grid w">${WEAPONS.map((w) => {
      const rar = RARITY[w.rarity], dps = w.dmg * w.pellets * w.rpm / 60;
      return `<div class="card weap ${this.previewWeapon === w.id ? 'eq' : ''}" style="--rc:${rar.color}" data-w="${w.id}"><div class="wn">${w.name}</div><div class="wc">${w.cls} · <span style="color:${rar.color}">${rar.name}</span></div>
        <div class="stat"><span>Schaden</span>${bar(dps, mx('dps'), '#ff6a4a')}</div><div class="stat"><span>Reichweite</span>${bar(w.range, 750, '#4aa8ff')}</div><div class="stat"><span>Feuerrate</span>${bar(w.rpm, 1100, '#ffd24a')}</div><div class="stat"><span>Magazin</span>${bar(w.mag, 100, '#8aff8a')}</div>
        <div class="wm">${w.mag} Schuss · ${AMMO[w.ammo].name}</div></div>`; }).join('')}</div>`;
    b.querySelectorAll('[data-w]').forEach((e) => (e.onclick = () => { this.previewWeapon = e.dataset.w; this.rebuildSoldier(); this.audio.click(); this.openPanel('arsenal'); }));
  }
  pRank(b) {
    const p = this.profile, rk = p.rank, d = p.data;
    const need = rk.next ? rk.next.min - d.rp : 0;
    b.innerHTML = `<h2>RANGLISTE <small>Skill-Divisionen · Ranked</small></h2>
      <div class="rank-now">${badgeSVG(rk.idx, 110)}<div><b style="color:${rk.rank.color}">${rk.label}</b>
        ${rk.placing ? `<p>Spiele ${PLACEMENT_MATCHES} Ranked-Matches (${d.rankedPlayed}/${PLACEMENT_MATCHES}), um deinen Rang zu erhalten.</p>` : `<p>${d.rp} RP${rk.next ? ` · noch ${need} RP bis ${rk.next.name}` : ' · höchster Rang!'}</p><div class="xpbar wide"><i style="width:${rk.progress * 100}%"></i></div>`}
        <small>Matches: ${d.stats.matches} · Siege: ${d.stats.wins} · Kills: ${d.stats.kills} · Beste Platzierung: #${d.stats.best}</small></div></div>
      <div class="rank-row">${RANKS.map((r, i) => `<div class="rk ${i === rk.idx ? 'cur' : ''}">${badgeSVG(i, 70)}<b style="color:${r.color}">${r.name}</b><small>${i === 0 ? 'Platzierung' : r.min + '+ RP'}</small></div>`).join('')}</div>
      <p class="sub">RP pro Ranked-Match: Sieg +60 · Top 5 +40 · Top 10 +28 · Top 25 +14 · Top 50 ±0 · darunter Verlust. Dazu +5 RP pro Kill (max. 10). Die Gegner in der Lobby werden nach deinem Rang ausgewählt.</p>`;
  }
  pSettings(b) {
    const s = this.profile.data.settings;
    b.innerHTML = `<h2>EINSTELLUNGEN</h2><div class="set">
      <label>Grafikqualität <select id="s-q">${[['low', 'Niedrig'], ['medium', 'Mittel'], ['high', 'Hoch'], ['ultra', 'Ultra (hohe Auflösung)']].map(([k, n]) => `<option value="${k}" ${s.quality === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <small>Auflösung wirkt sofort. Schatten, Bäume & Gelände-Details nach Neuladen der Seite.</small>
      <label>Maus-Empfindlichkeit <input type="range" id="s-sens" min="0.2" max="3" step="0.1" value="${s.sens}"><b id="s-sens-v">${s.sens}</b></label>
      <label>Sichtfeld (FOV) <input type="range" id="s-fov" min="60" max="110" step="1" value="${s.fov}"><b id="s-fov-v">${s.fov}</b></label>
      <label>Lautstärke <input type="range" id="s-vol" min="0" max="1" step="0.05" value="${s.volume}"><b id="s-vol-v">${s.volume}</b></label>
      <h3>Steuerung</h3><div class="keys"><span><kbd>WASD</kbd> Bewegen</span><span><kbd>Shift</kbd> Sprinten</span><span><kbd>Leertaste</kbd> Springen / Fallschirm</span><span><kbd>Strg/C</kbd> Ducken</span><span><kbd>Maus L</kbd> Schießen</span><span><kbd>Maus R</kbd> Zielen</span><span><kbd>R</kbd> Nachladen</span><span><kbd>1-3 / Rad</kbd> Waffe wechseln</span><span><kbd>F halten</kbd> Kiste öffnen</span><span><kbd>H</kbd> Medkit</span><span><kbd>M</kbd> Karte</span><span><kbd>Esc</kbd> Pause</span></div></div>`;
    const bind = (id, key, cb) => { const el = b.querySelector('#' + id); el.oninput = () => { s[key] = key === 'quality' ? el.value : +el.value; const v = b.querySelector('#' + id + '-v'); if (v) v.textContent = el.value; this.profile.save(); cb && cb(); }; };
    bind('s-q', 'quality', () => this.onQuality()); bind('s-sens', 'sens'); bind('s-fov', 'fov'); bind('s-vol', 'volume', () => this.audio.setVolume(s.volume));
  }
  pAccount(b) {
    const d = this.profile.data, rk = this.profile.rank, lv = this.profile.level;
    b.innerHTML = `<h2>ACCOUNT</h2><div class="acc-big"><div class="avatar lg">${d.name.slice(0, 2).toUpperCase()}</div><div>
      <label>Spielername <input id="a-name" maxlength="16" value="${d.name}"></label>
      <p>Level <b>${lv.level}</b> · ${lv.cur}/${lv.need} XP</p><div class="xpbar wide"><i style="width:${lv.cur / lv.need * 100}%"></i></div>
      <p>Rang: <b style="color:${rk.rank.color}">${rk.label}</b> · ${d.rp} RP</p></div></div>
      <div class="res-grid"><div><b>${d.stats.matches}</b><span>Matches</span></div><div><b>${d.stats.wins}</b><span>Siege</span></div><div><b>${d.stats.top10}</b><span>Top 10</span></div><div><b>${d.stats.kills}</b><span>Kills</span></div></div>
      <button class="btn ghost" id="a-reset">Fortschritt zurücksetzen</button>`;
    b.querySelector('#a-name').onchange = (e) => { d.name = e.target.value.trim().slice(0, 16) || d.name; this.profile.save(); this.rerender(); };
    b.querySelector('#a-reset').onclick = () => { if (confirm('Wirklich alles zurücksetzen?')) { localStorage.removeItem('jermaine37_br_profile_v1'); location.reload(); } };
  }
}
