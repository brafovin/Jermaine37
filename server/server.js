// Online-Server: Matchmaking + Räume + Nachrichten-Relay (Treffer sind clientseitig, kein Anti-Cheat).
// Modi: "online" (Battle Royale mit echten Spielern) und "bomb" (6 gegen 6, Bombe legen/entschärfen, Server steuert die Runden).
// Start:  npm run server   (nur WebSocket, Port 8080)   oder   npm run online   (baut das Spiel und liefert es zusätzlich aus)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const PORT = +process.env.PORT || 8080, WAIT = +process.env.WAIT_SEC || 20;
const CFG = { online: { max: +process.env.MAX_PLAYERS || 16, min: +process.env.MIN_PLAYERS || 2 }, bomb: { max: 12, min: +process.env.BOMB_MIN || 2 } };
const BOMB = { freeze: 8, live: 120, planted: 40, end: 5, winRounds: 4 };
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream' };

const server = http.createServer((req, res) => {
  let f = path.join(dist, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(dist)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Spiel nicht gebaut: erst "npm run build" ausführen.'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const wss = new WebSocketServer({ server });
let nextId = 1; const queues = { online: [], bomb: [] }, minAt = { online: 0, bomb: 0 };
const rooms = new Set();
const send = (c, m) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(m)); };
const bcast = (room, m, except) => { for (const c of room.clients) if (c !== except) send(c, m); };

function startRoom(list, mode) {
  const room = { mode, clients: list, seed: (Math.random() * 1e9) | 0, ready: 0, started: false };
  rooms.add(room);
  if (mode === 'bomb') list.forEach((c, i) => { c.team = i % 2; });
  const players = list.map((c, i) => ({ id: c.id, name: c.name, rank: c.rank, skin: c.skin, index: i, team: c.team ?? 0 }));
  list.forEach((c, i) => { c.room = room; c.alive = true; c.ready = false; send(c, { t: 'start', mode, seed: room.seed, you: c.id, index: i, team: c.team ?? 0, count: list.length, players }); });
  room.timer = setTimeout(() => go(room), 70000);
  console.log(`Raum (${mode}) gestartet mit ${list.length} Spielern (Seed ${room.seed})`);
}
function go(room) { if (room.started) return; room.started = true; clearTimeout(room.timer); bcast(room, { t: 'go' }); if (room.mode === 'bomb') bombInit(room); }
const alive = (room) => room.clients.filter((c) => c.alive);

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
  if (room.mode === 'bomb') checkRound(room); else if (c.alive === false) checkEnd(room);
  if (!room.clients.length) { clearTimeout(room.timer); rooms.delete(room); }
}
function checkEnd(room) { const a = alive(room); if (room.started && a.length <= 1) bcast(room, { t: 'end', winner: a[0] ? a[0].id : null }); }

wss.on('connection', (ws) => {
  const c = { id: nextId++, ws, name: 'Spieler', rank: 0, skin: 'default', room: null, alive: false, team: 0 };
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'queue') {
      c.name = String(m.name || 'Spieler').slice(0, 16); c.rank = m.rank | 0; c.skin = String(m.skin || 'default'); const mode = m.mode === 'bomb' ? 'bomb' : 'online';
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
      if (to && to.alive && !(room.mode === 'bomb' && (to.team === c.team || room.phase === 'freeze' || room.phase === 'end'))) send(to, { t: 'hit', from: c.id, dmg: Math.min(400, +m.dmg || 0), head: !!m.head, w: m.w, x: m.x, z: m.z });
      return;
    }
    if (m.t === 'dead') {
      if (!c.alive) return; c.alive = false; const place = alive(room).length + 1;
      bcast(room, { t: 'dead', id: c.id, by: m.by ?? null, w: m.w || '', place, x: m.x, y: m.y, z: m.z, loot: m.loot }, null);
      if (room.mode === 'bomb') checkRound(room); else checkEnd(room);
      return;
    }
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

server.listen(PORT, () => console.log(`Online-Server läuft auf Port ${PORT} (BR min ${CFG.online.min}/max ${CFG.online.max}, Bombe min ${CFG.bomb.min}/max 12, Wartezeit ${WAIT}s). Spiel: http://localhost:${PORT}`));
