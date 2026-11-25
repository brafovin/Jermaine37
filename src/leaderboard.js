import { randomName, getRank, PLACEMENT_MATCHES } from './data.js';
import { mulberry32 } from './world.js';

// Bestenliste (Top 100 Ranked). Mit Server: echte Spieler. Ohne Server: simulierte Spieler plus dein eigener Eintrag.
export function apiBase(profile) {
  const s = profile.data.settings.server;
  if (s) return s.replace(/^wss?:/, location.protocol === 'https:' ? 'https:' : 'http:').replace(/^(?!https?:)/, 'http://').replace(/\/$/, '');
  return location.port === '8080' ? location.origin : `http://${location.hostname || 'localhost'}:8080`;
}
export async function submitScore(profile) {
  const d = profile.data; if (d.rankedPlayed < PLACEMENT_MATCHES) return;
  try {
    await fetch(apiBase(profile) + '/api/score', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ id: d.playerId, name: d.name, rp: d.rp, rank: profile.rank.idx, wins: d.stats.wins, matches: d.stats.matches }), signal: AbortSignal.timeout(2500) });
  } catch (e) { /* offline */ }
}
const simPlayers = () => { // 100 feste, simulierte Gegner für die Offline-Liste
  const r = mulberry32(20260101), out = [];
  for (let i = 0; i < 100; i++) { const rp = Math.round(300 + 3100 * Math.pow(1 - i / 100, 1.5) + (r() - 0.5) * 30); out.push({ name: randomName(r), rp, rank: getRank(rp, 99).idx, wins: Math.round(rp / 28 + r() * 20), matches: Math.round(rp / 12 + 40 + r() * 60), sim: true }); }
  return out;
};
export async function loadLeaderboard(profile) {
  const d = profile.data, mine = { name: d.name, rp: d.rp, rank: profile.rank.idx, wins: d.stats.wins, matches: d.stats.matches, me: true };
  let live = null;
  try { const res = await fetch(`${apiBase(profile)}/api/leaderboard?id=${encodeURIComponent(d.playerId)}`, { signal: AbortSignal.timeout(2500) }); if (res.ok) live = await res.json(); } catch (e) { /* offline */ }
  const eligible = d.rankedPlayed >= PLACEMENT_MATCHES;
  let rows = live ? live.top.map((e) => ({ ...e })) : [];
  if (!live || rows.length < 100) rows = rows.concat(simPlayers().filter(() => true));
  if (!rows.some((e) => e.me) && eligible) rows.push(mine);
  rows.sort((a, b) => b.rp - a.rp || (b.me ? 1 : 0) - (a.me ? 1 : 0));
  const pos = rows.findIndex((e) => e.me);
  return { rows: rows.slice(0, 100), live: !!live, realCount: live ? live.top.length : 0, total: live ? live.total : 0, mine, eligible, pos: pos >= 0 ? pos + 1 : null };
}
