import { RANKS, randomName } from './data.js';
import { badgeSVG } from './badges.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Simuliertes Matchmaking: füllt eine 100er-Lobby nach Skill (Rang) des Spielers.
// Ranked: enger Skill-Bereich, der mit der Wartezeit langsam wächst. Normal: breiter.
export function runMatchmaking({ root, profile, mode, audio }) {
  return new Promise((resolve) => {
    const ranked = mode === 'ranked', rk = profile.rank;
    const center = rk.idx === 0 ? 2 : rk.idx;
    const fast = new URLSearchParams(location.search).has('fast');
    const players = [{ name: profile.data.name, rank: rk.idx, you: true }];
    let elapsed = 0, found = 1, stage = 'search', cd = 5, done = false;
    const rnd = Math.random;
    root.style.display = 'flex';
    root.innerHTML = `<div class="mm-box">
      <div class="mm-mode">${ranked ? 'RANKED' : 'BATTLE ROYALE'}</div>
      <div class="mm-title" id="mm-title">SUCHE LÄUFT…</div>
      <div class="mm-spinner"></div>
      <div class="mm-row"><div><b id="mm-time">0:00</b><span>Wartezeit</span></div><div><b id="mm-count">1/100</b><span>Spieler</span></div><div><b id="mm-ping">24 ms</b><span>Region: EU-Mitte</span></div></div>
      <div class="mm-bar"><i id="mm-fill"></i></div>
      <div class="mm-skill" id="mm-skill"></div>
      <div class="mm-list" id="mm-list"></div>
      <button class="btn ghost" id="mm-cancel">ABBRECHEN</button></div>`;
    const $ = (id) => root.querySelector('#' + id);
    const list = $('mm-list');
    const addRow = (p) => {
      const d = document.createElement('div'); d.className = 'mm-p' + (p.you ? ' you' : '');
      d.innerHTML = `${badgeSVG(p.rank, 26)}<span>${p.name}</span><em>${RANKS[p.rank].name}</em>`;
      list.prepend(d); while (list.children.length > 7) list.lastChild.remove();
    };
    addRow(players[0]);
    const tick = setInterval(() => {
      if (done) return;
      if (stage === 'search') {
        elapsed += 0.15 * (fast ? 5 : 1);
        const win = (ranked ? 1 : 3) + Math.floor(elapsed / 4);
        const lo = clamp(center - win, 1, 9), hi = clamp(center + win, 1, 9);
        $('mm-skill').innerHTML = `Skill-Bereich: <b style="color:${RANKS[lo].color}">${RANKS[lo].name}</b> – <b style="color:${RANKS[hi].color}">${RANKS[hi].name}</b>${elapsed > 8 ? ' <small>(wird erweitert)</small>' : ''}`;
        const n = Math.min(100 - found, 1 + Math.floor(rnd() * (3 + elapsed * 0.8)));
        for (let i = 0; i < n; i++) {
          // Rang ~ Normalverteilung um das Zentrum, innerhalb des Fensters
          const g = (rnd() + rnd() + rnd() - 1.5) / 1.5; let r = clamp(Math.round(center + g * win), lo, hi);
          const p = { name: randomName(), rank: r }; players.push(p); found++; if (i === n - 1) addRow(p);
        }
        $('mm-count').textContent = found + '/100'; $('mm-fill').style.width = found + '%';
        const m = Math.floor(elapsed / 60), s = Math.floor(elapsed % 60); $('mm-time').textContent = `${m}:${String(s).padStart(2, '0')}`;
        $('mm-ping').textContent = 18 + ((rnd() * 14) | 0) + ' ms';
        if (found >= 100 && elapsed > 3) { stage = 'found'; $('mm-title').textContent = 'MATCH GEFUNDEN!'; $('mm-title').classList.add('ok'); audio.match(); root.querySelector('.mm-spinner').style.display = 'none'; $('mm-cancel').style.display = 'none'; elapsed = 0; }
      } else {
        elapsed += 0.15;
        const left = 5 - Math.floor(elapsed * (fast ? 4 : 1));
        if (left !== cd) { cd = left; $('mm-skill').innerHTML = cd > 0 ? `Match startet in <b>${cd}</b>` : 'Lade Karte…'; audio.click(); }
        if (left <= 0) { done = true; clearInterval(tick); resolve({ players: players.slice(1), cancelled: false }); }
      }
    }, 150);
    $('mm-cancel').onclick = () => { done = true; clearInterval(tick); root.style.display = 'none'; root.innerHTML = ''; resolve({ cancelled: true }); };
  });
}
