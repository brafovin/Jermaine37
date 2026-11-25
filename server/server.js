// Online-Server: Matchmaking + Räume + Nachrichten-Relay (Treffer sind clientseitig, kein Anti-Cheat).
// Modi: "online" (Battle Royale mit echten Spielern), "bomb" (6 gegen 6, Bombe legen/entschärfen) und "flag" (6 gegen 6, Flaggen einnehmen).
// Der Server steuert Runden bzw. Flaggen-Punkte.
// Start:  npm run server   (nur WebSocket, Port 8080)   oder   npm run online   (baut das Spiel und liefert es zusätzlich aus)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const PORT = +process.env.PORT || 8080, WAIT = +process.env.WAIT_SEC || 20;
const CFG = { online: { max: +process.env.MAX_PLAYERS || 16, min: +process.env.MIN_PLAYERS || 2 }, bomb: { max: 12, min: +process.env.BOMB_MIN || 2 }, flag: { max: 12, min: +process.env.FLAG_MIN || 2 } };
const FLAG = { target: 150, time: 600, rate: 0.125 };
const BOMB = { freeze: 8, live: 120, planted: 40, end: 5, winRounds: 4 };
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream' };

// Bestenliste (Ranked): wird in server/leaderboard.json gespeichert
const LB_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'leaderboard.json');
let lb = {}; try { lb = JSON.parse(fs.readFileSync(LB_FILE, 'utf8')); } catch { /* neu */ }
let lbTimer; const saveLb = () => { clearTimeout(lbTimer); lbTimer = setTimeout(() => fs.writeFile(LB_FILE, JSON.stringify(lb), () => {}), 1000); };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const ranked = () => Object.entries(lb).map(([id, e]) => ({ id, ...e })).sort((a, b) => b.rp - a.rp || b.wins - a.wins);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS).end(); return; }
  if (url.pathname === '/api/leaderboard') {
    const all = ranked(), me = url.searchParams.get('id'), idx = all.findIndex((e) => e.id === me);
    res.writeHead(200, { ...CORS, 'content-type': 'application/json' }).end(JSON.stringify({ top: all.slice(0, 100).map(({ id, ...e }) => ({ ...e, me: id === me })), total: all.length, you: idx >= 0 ? { ...all[idx], rank: idx + 1, id: undefined } : null }));
    return;
  }
  if (url.pathname === '/api/score' && req.method === 'POST') {
    let body = ''; req.on('data', (d) => { body += d; if (body.length > 2048) req.destroy(); });
    req.on('end', () => {
      try {
        const m = JSON.parse(body), id = String(m.id || ''), rp = Math.round(+m.rp);
        if (id.length < 8 || id.length > 64 || !(rp >= 0 && rp < 100000)) throw new Error('bad');
        lb[id] = { name: String(m.name || 'Spieler').replace(/[<>]/g, '').slice(0, 16), rp, rank: m.rank | 0, wins: Math.max(0, m.wins | 0), matches: Math.max(0, m.matches | 0), ts: Date.now() }; saveLb();
        res.writeHead(200, { ...CORS, 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, rank: ranked().findIndex((e) => e.id === id) + 1 }));
      } catch { res.writeHead(400, CORS).end('bad request'); }
    });
    return;
  }
  let f = path.join(dist, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(dist)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Spiel nicht gebaut: erst "npm run build" ausführen.'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const wss = new WebSocketServer({ server });
let nextId = 1; const queues = { online: [], bomb: [], flag: [] }, minAt = { online: 0, bomb: 0, flag: 0 };
const rooms = new Set();
const send = (c, m) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(m)); };
const bcast = (room, m, except) => { for (const c of room.clients) if (c !== except) send(c, m); };

function startRoom(list, mode) {
  const room = { mode, clients: list, seed: (Math.random() * 1e9) | 0, ready: 0, started: false };
  rooms.add(room);
  if (mode === 'bomb' || mode === 'flag') list.forEach((c, i) => { c.team = i % 2; });
  const players = list.map((c, i) => ({ id: c.id, name: c.name, rank: c.rank, skin: c.skin, cskin: c.cskin, index: i, team: c.team ?? 0 }));
  list.forEach((c, i) => { c.room = room; c.alive = true; c.ready = false; send(c, { t: 'start', mode, seed: room.seed, you: c.id, index: i, team: c.team ?? 0, count: list.length, players }); });
  room.timer = setTimeout(() => go(room), 70000);
  console.log(`Raum (${mode}) gestartet mit ${list.length} Spielern (Seed ${room.seed})`);
}
function go(room) { if (room.started) return; room.started = true; clearTimeout(room.timer); bcast(room, { t: 'go' }); if (room.mode === 'bomb') bombInit(room); if (room.mode === 'flag') flagInit(room); }
const alive = (room) => room.clients.filter((c) => c.alive);

// ---------- Flaggen-Modus ----------
function flagInit(room) { room.flags = [0, 1, 2].map(() => ({ p: 0, owner: -1 })); room.score = [0, 0]; room.t0 = Date.now(); room.endAt = room.t0 + FLAG.time * 1000; room.lastScore = room.t0; room.lastBc = 0; room.over = false; }
function flagEnd(room, winner, forfeit) { if (room.over) return; room.over = true; bcast(room, { t: 'matchend', winner, score: room.score, forfeit: !!forfeit }); }
function flagTick(room, now) {
  if (room.over) return; const dt = 0.25;
  room.flags.forEach((f, i) => {
    const cnt = [0, 0]; for (const c of room.clients) if (c.alive && c.capFlag === i && now - c.capAt < 1200) cnt[c.team]++;
    if (cnt[0] && cnt[1]) { /* umkämpft */ } else if (cnt[0]) f.p = Math.max(-1, f.p - Math.min(cnt[0], 3) * FLAG.rate * dt); else if (cnt[1]) f.p = Math.min(1, f.p + Math.min(cnt[1], 3) * FLAG.rate * dt);
    if (f.p <= -1) f.owner = 0; else if (f.p >= 1) f.owner = 1; else if ((f.owner === 0 && f.p > -0.5) || (f.owner === 1 && f.p < 0.5)) f.owner = -1;
  });
  while (now - room.lastScore >= 1000) { room.lastScore += 1000; for (const f of room.flags) if (f.owner >= 0) room.score[f.owner]++; }
  if (room.score[0] >= FLAG.target || room.score[1] >= FLAG.target) return flagEnd(room, room.score[0] >= FLAG.target ? 0 : 1);
  if (now >= room.endAt) { const own = [0, 1].map((t) => room.flags.filter((f) => f.owner === t).length); return flagEnd(room, room.score[0] !== room.score[1] ? (room.score[0] > room.score[1] ? 0 : 1) : own[0] >= own[1] ? 0 : 1); }
  if (now - room.lastBc >= 500) { room.lastBc = now; bcast(room, { t: 'fstate', f: room.flags.map((f) => [Math.round(f.p * 1000) / 1000, f.owner]), score: room.score, left: Math.max(0, (room.endAt - now) / 1000) }); }
}
setInterval(() => { const now = Date.now(); for (const room of rooms) if (room.mode === 'flag' && room.started) flagTick(room, now); }, 250);

// ---------- Bomben-Modus ----------
function bombInit(room) { room.score = [0, 0]; room.round = 0; room.attTeam = 0; room.over = false; startRound(room); }
function startRound(room) {
  if (room.round === 3) room.attTeam = 1 - room.attTeam; // Seitenwechsel nach der Halbzeit
  room.round++; room.planted = false; room.phase = 'freeze'; room.deadline = Date.now() + BOMB.freeze * 1000;
  room.clients.forEach((c) => { c.alive = true; });
  bcast(room, { t: 'round', n: room.round, attTeam: room.attTeam, score: room.score, dur: BOMB.freeze });
}
function roundEnd(room, winTeam, reason) {
  if (room.phase === 'end' || room.over) return;
  room.phase = 'end'; room.deadline = Date.now() + BOMB.end * 1000; room.score[winTeam]++;
  bcast(room, { t: 'roundend', winner: winTeam, reason, score: room.score });
  if (room.score[winTeam] >= BOMB.winRounds) { room.over = true; setTimeout(() => { bcast(room, { t: 'matchend', winner: winTeam, score: room.score }); }, BOMB.end * 1000 - 200); }
}
function checkRound(room) {
  if (room.mode !== 'bomb' || !room.started || room.over || (room.phase !== 'live' && room.phase !== 'planted')) return;
  const att = room.clients.filter((c) => c.team === room.attTeam && c.alive).length, def = room.clients.filter((c) => c.team !== room.attTeam && c.alive).length;
  if (def === 0) roundEnd(room, room.attTeam, 'elim'); else if (att === 0 && !room.planted) roundEnd(room, 1 - room.attTeam, 'elim');
  const teams = [0, 1].map((t) => room.clients.filter((c) => c.team === t).length);
  if (!teams[0] || !teams[1]) { const w = teams[0] ? 0 : 1; room.over = true; bcast(room, { t: 'matchend', winner: w, score: room.score, forfeit: true }); }
}
setInterval(() => {
  const now = Date.now();
  for (const room of rooms) {
    if (room.mode !== 'bomb' || !room.started || room.over && room.phase !== 'end') continue;
    if (now < room.deadline) continue;
    if (room.phase === 'freeze') { room.phase = 'live'; room.deadline = now + BOMB.live * 1000; bcast(room, { t: 'phase', phase: 'live', dur: BOMB.live }); }
    else if (room.phase === 'live') roundEnd(room, 1 - room.attTeam, 'time');
    else if (room.phase === 'planted') roundEnd(room, room.attTeam, 'bomb');
    else if (room.phase === 'end' && !room.over) startRound(room);
  }
}, 250);

function leave(c) {
  for (const q of Object.values(queues)) { const i = q.indexOf(c); if (i >= 0) q.splice(i, 1); }
  const room = c.room; if (!room) return;
  if (c.alive) { c.alive = false; bcast(room, { t: 'dead', id: c.id, by: null, w: 'Verlassen', place: alive(room).length + 1, left: true }, c); }
  room.clients = room.clients.filter((x) => x !== c);
  if (room.mode === 'bomb') checkRound(room); else if (room.mode === 'flag') { const t = [0, 1].map((k) => room.clients.filter((x) => x.team === k).length); if (room.started && (!t[0] || !t[1])) flagEnd(room, t[0] ? 0 : 1, true); } else if (c.alive === false) checkEnd(room);
  if (!room.clients.length) { clearTimeout(room.timer); rooms.delete(room); }
}
function checkEnd(room) { const a = alive(room); if (room.started && a.length <= 1) bcast(room, { t: 'end', winner: a[0] ? a[0].id : null }); }

wss.on('connection', (ws) => {
  const c = { id: nextId++, ws, name: 'Spieler', rank: 0, skin: 'default', room: null, alive: false, team: 0 };
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'queue') {
      c.name = String(m.name || 'Spieler').slice(0, 16); c.rank = m.rank | 0; c.skin = String(m.skin || 'default'); c.cskin = String(m.cskin || 'standard'); const mode = m.mode === 'bomb' ? 'bomb' : m.mode === 'flag' ? 'flag' : 'online';
      if (!c.room && !Object.values(queues).some((q) => q.includes(c))) { c.mode = mode; queues[mode].push(c); }
      return;
    }
    if (m.t === 'unqueue') { for (const q of Object.values(queues)) { const i = q.indexOf(c); if (i >= 0) q.splice(i, 1); } return; }
    const room = c.room; if (!room) return;
    if (m.t === 'ready') { c.ready = true; if (room.clients.every((x) => x.ready)) go(room); return; }
    if (!room.started) return;
    if (m.t === 's' || m.t === 'shot' || m.t === 'crate') { m.id = c.id; bcast(room, m, c); return; }
    if (m.t === 'hit') {
      const to = room.clients.find((x) => x.id === m.to);
      const tm = room.mode === 'bomb' || room.mode === 'flag';
      if (to && to.alive && !(tm && to.team === c.team) && !(room.mode === 'bomb' && (room.phase === 'freeze' || room.phase === 'end')) && !(to.prot > Date.now())) send(to, { t: 'hit', from: c.id, dmg: Math.min(400, +m.dmg || 0), head: !!m.head, w: m.w, x: m.x, z: m.z });
      return;
    }
    if (m.t === 'dead') {
      if (!c.alive) return; c.alive = false; const place = alive(room).length + 1;
      bcast(room, { t: 'dead', id: c.id, by: m.by ?? null, w: m.w || '', place, x: m.x, y: m.y, z: m.z, loot: m.loot }, null);
      if (room.mode === 'bomb') checkRound(room); else if (room.mode === 'online') checkEnd(room);
      return;
    }
    if (m.t === 'cap' && room.mode === 'flag' && c.alive) { c.capFlag = m.f | 0; c.capAt = Date.now(); return; }
    if (m.t === 'alive' && room.mode === 'flag' && !c.alive) { c.alive = true; c.prot = Date.now() + 2500; c.capFlag = -1; bcast(room, { t: 'respawn', id: c.id }, null); return; }
    if (room.mode !== 'bomb') return;
    if (m.t === 'plant' && room.phase === 'live' && c.team === room.attTeam && c.alive && !room.planted) {
      room.planted = true; room.phase = 'planted'; room.deadline = Date.now() + BOMB.planted * 1000; bcast(room, { t: 'planted', by: c.id, site: m.site | 0, dur: BOMB.planted });
    } else if (m.t === 'defuse' && room.phase === 'planted' && c.team !== room.attTeam && c.alive) {
      bcast(room, { t: 'defused', by: c.id }); roundEnd(room, c.team, 'defuse');
    }
  });
  ws.on('close', () => leave(c));
  send(c, { t: 'hello', id: c.id });
});

setInterval(() => {
  for (const mode of Object.keys(queues)) {
    const q = queues[mode], { min, max } = CFG[mode];
    if (q.length >= min) { if (!minAt[mode]) minAt[mode] = Date.now(); } else minAt[mode] = 0;
    const waited = minAt[mode] ? (Date.now() - minAt[mode]) / 1000 : 0;
    if (q.length >= max || (q.length >= min && waited >= WAIT)) { startRoom(q.splice(0, max), mode); minAt[mode] = 0; }
    for (const c of q) send(c, { t: 'queue', mode, n: q.length, min, max, eta: minAt[mode] ? Math.max(0, Math.ceil(WAIT - waited)) : null });
  }
}, 1000);

server.listen(PORT, () => console.log(`Online-Server läuft auf Port ${PORT} (BR min ${CFG.online.min}/max ${CFG.online.max}, Bombe min ${CFG.bomb.min}/max 12, Flaggen min ${CFG.flag.min}/max 12, Wartezeit ${WAIT}s). Spiel: http://localhost:${PORT}`));
