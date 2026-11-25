// Online-Server: Matchmaking + Räume + Nachrichten-Relay (Treffer sind clientseitig, kein Anti-Cheat).
// Start:  npm run server   (nur WebSocket, Port 8080)   oder   npm run online   (baut das Spiel und liefert es zusätzlich aus)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const PORT = +process.env.PORT || 8080, MAX = +process.env.MAX_PLAYERS || 16, MIN = +process.env.MIN_PLAYERS || 2, WAIT = +process.env.WAIT_SEC || 20;
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  let f = path.join(dist, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(dist)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Spiel nicht gebaut: erst "npm run build" ausführen.'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
const wss = new WebSocketServer({ server });
let nextId = 1, queue = [], minAt = 0;
const rooms = new Set();
const send = (c, m) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(m)); };
const bcast = (room, m, except) => { for (const c of room.clients) if (c !== except) send(c, m); };

function startRoom(list) {
  const room = { clients: list, seed: (Math.random() * 1e9) | 0, ready: 0, started: false };
  rooms.add(room);
  const players = list.map((c, i) => ({ id: c.id, name: c.name, rank: c.rank, skin: c.skin, index: i }));
  list.forEach((c, i) => { c.room = room; c.alive = true; c.ready = false; send(c, { t: 'start', seed: room.seed, you: c.id, index: i, count: list.length, players }); });
  room.timer = setTimeout(() => go(room), 70000);
  console.log(`Raum gestartet mit ${list.length} Spielern (Seed ${room.seed})`);
}
function go(room) { if (room.started) return; room.started = true; clearTimeout(room.timer); room.t0 = Date.now(); bcast(room, { t: 'go' }); }
function alive(room) { return room.clients.filter((c) => c.alive); }
function leave(c) {
  queue = queue.filter((q) => q !== c);
  const room = c.room; if (!room) return;
  if (c.alive) { c.alive = false; const n = alive(room).length + 1; bcast(room, { t: 'dead', id: c.id, by: null, w: 'Verlassen', place: n, left: true }, c); checkEnd(room); }
  room.clients = room.clients.filter((x) => x !== c);
  if (!room.clients.length) { clearTimeout(room.timer); rooms.delete(room); }
}
function checkEnd(room) { const a = alive(room); if (room.started && a.length <= 1) { bcast(room, { t: 'end', winner: a[0] ? a[0].id : null }); } }

wss.on('connection', (ws) => {
  const c = { id: nextId++, ws, name: 'Spieler', rank: 0, skin: 'default', room: null, alive: false };
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'queue') { c.name = String(m.name || 'Spieler').slice(0, 16); c.rank = m.rank | 0; c.skin = String(m.skin || 'default'); if (!queue.includes(c) && !c.room) queue.push(c); return; }
    if (m.t === 'unqueue') { queue = queue.filter((q) => q !== c); return; }
    const room = c.room; if (!room) return;
    if (m.t === 'ready') { c.ready = true; if (room.clients.every((x) => x.ready)) go(room); return; }
    if (!room.started) return;
    if (m.t === 's') { m.id = c.id; bcast(room, m, c); return; }
    if (m.t === 'shot' || m.t === 'crate') { m.id = c.id; bcast(room, m, c); return; }
    if (m.t === 'hit') { const to = room.clients.find((x) => x.id === m.to); if (to && to.alive) send(to, { t: 'hit', from: c.id, dmg: Math.min(400, +m.dmg || 0), head: !!m.head, w: m.w, x: m.x, z: m.z }); return; }
    if (m.t === 'dead') {
      if (!c.alive) return; c.alive = false; const place = alive(room).length + 1;
      bcast(room, { t: 'dead', id: c.id, by: m.by ?? null, w: m.w || '', place, x: m.x, y: m.y, z: m.z, loot: m.loot }, null); checkEnd(room);
    }
  });
  ws.on('close', () => leave(c));
  send(c, { t: 'hello', id: c.id });
});

setInterval(() => {
  if (queue.length >= MIN) { if (!minAt) minAt = Date.now(); } else minAt = 0;
  const waited = minAt ? (Date.now() - minAt) / 1000 : 0;
  if (queue.length >= MAX || (queue.length >= MIN && waited >= WAIT)) { startRoom(queue.splice(0, MAX)); minAt = 0; }
  for (const q of queue) send(q, { t: 'queue', n: queue.length, min: MIN, max: MAX, eta: minAt ? Math.max(0, Math.ceil(WAIT - waited)) : null });
}, 1000);

server.listen(PORT, () => console.log(`Online-Server läuft auf Port ${PORT} (min ${MIN}, max ${MAX}, Wartezeit ${WAIT}s). Spiel: http://localhost:${PORT}`));
