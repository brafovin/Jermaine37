import * as THREE from 'three';
import { Profile } from './profile.js';
import { AudioFX } from './audio.js';
import { Lobby } from './lobby.js';
import { runMatchmaking } from './matchmaking.js';
import { Match } from './game.js';
import { World } from './world.js';
import { WEAPON_BY_ID } from './data.js';
import { Net } from './net.js';
import { loadCharacter } from './character.js';
import { loadAssets } from './assets.js';

const dpr = window.devicePixelRatio || 1;
export const QUALITY = {
  low: { pr: () => 1, shadows: false, shadowMap: 1024, shadowRange: 60, trees: 2500, terrainSeg: 240, fog: 0.0012 },
  medium: { pr: () => Math.min(dpr, 1.25), shadows: true, shadowMap: 2048, shadowRange: 70, trees: 4500, terrainSeg: 360, fog: 0.001 },
  high: { pr: () => Math.min(Math.max(dpr, 1), 1.75), shadows: true, shadowMap: 4096, shadowRange: 85, trees: 7000, terrainSeg: 520, fog: 0.0009 },
  ultra: { pr: () => Math.min(Math.max(dpr * 1.25, 1.5), 2.25), shadows: true, shadowMap: 4096, shadowRange: 100, trees: 10000, terrainSeg: 700, fog: 0.0008 },
};

const profile = new Profile();
const audio = new AudioFX(); audio.setVolume(profile.data.settings.volume);
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.75;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const qual = () => QUALITY[profile.data.settings.quality] || QUALITY.high;
const applyRes = () => { renderer.setPixelRatio(qual().pr()); renderer.setSize(innerWidth, innerHeight); };
applyRes(); addEventListener('resize', applyRes);

let gameScene = null;
let world = null, match = null, busy = false;
const $ = (id) => document.getElementById(id);
const setLoad = (t, f = 0) => { const e = $('loading').querySelector('span'); if (e) e.textContent = t + (f ? ` (${Math.round(f * 100)} %)` : ''); };

const lobby = new Lobby({ renderer, profile, audio, root: $('lobby'), onPlay: play, onQuality: applyRes });

async function play(mode) {
  if (busy) return; busy = true;
  if (mode === 'online') return playOnline();
  const res = await runMatchmaking({ root: $('mm'), profile, mode, audio });
  if (res.cancelled) { busy = false; return; }
  $('loading').style.display = 'flex';
  lobby.stop();
  await new Promise((r) => setTimeout(r, 60));
  try {
    await assetsP; await loadCharacter();
    if (world) { world.dispose(); world = null; }
    gameScene = new THREE.Scene();
    world = await World.create(renderer, gameScene, qual(), (Math.random() * 1e9) | 0, setLoad);
    $('mm').style.display = 'none'; $('mm').innerHTML = '';
    match = new Match({
      renderer, scene: gameScene, world, profile, audio, opts: { mode, players: res.players }, hudRoot: $('hud'),
      onExit: () => { match = null; busy = false; lobby.start(); },
    });
    window.__br.match = match;
  } catch (e) { console.error(e); busy = false; lobby.start(); $('mm').style.display = 'none'; }
  $('loading').style.display = 'none';
}

const assetsP = loadAssets();
Promise.all([loadCharacter(), assetsP]).then(([g]) => { if (g) lobby.rebuildSoldier(); });
window.__br = { profile, play, lobby, W: WEAPON_BY_ID, get world() { return world; } };
lobby.start();

function serverUrl() {
  const s = profile.data.settings.server; if (s) return /^wss?:/.test(s) ? s : 'ws://' + s;
  return location.port === '8080' ? `ws://${location.host}` : `ws://${location.hostname || 'localhost'}:8080`;
}
function playOnline() {
  const mm = $('mm'); mm.style.display = 'flex';
  const url = serverUrl();
  const show = (title, sub, cancelLabel = 'ABBRECHEN') => { mm.innerHTML = `<div class="mm-box"><div class="mm-mode">ONLINE</div><div class="mm-title" id="on-t">${title}</div><div class="mm-spinner"></div><div class="mm-skill" id="on-s">${sub}</div><button class="btn ghost" id="on-c">${cancelLabel}</button></div>`; mm.querySelector('#on-c').onclick = cancel; };
  let net = null, started = false, startMsg = null;
  const end = () => { mm.style.display = 'none'; mm.innerHTML = ''; busy = false; };
  function cancel() { if (net) net.close(); end(); }
  show('VERBINDE…', url);
  net = new Net(url);
  net.on('error', () => { if (!started) { net.close(); show('SERVER NICHT ERREICHBAR', `${url}<br><small>Server starten mit: <b>npm run online</b> (oder Adresse unter Einstellungen → Server-Adresse ändern)</small>`, 'ZURÜCK'); mm.querySelector('.mm-spinner').style.display = 'none'; } });
  net.on('close', () => { if (!started && mm.style.display !== 'none' && !startMsg) { show('VERBINDUNG GETRENNT', url, 'ZURÜCK'); mm.querySelector('.mm-spinner').style.display = 'none'; } });
  net.on('open', () => { const d = profile.data; net.send({ t: 'queue', name: d.name, rank: profile.rank.idx, skin: d.skin }); show('SUCHE SPIELER…', 'Warte auf Mitspieler…'); });
  net.on('queue', (m) => { const e = mm.querySelector('#on-s'); if (e) e.innerHTML = `Spieler in der Warteschlange: <b>${m.n}</b> / ${m.max}<br>${m.eta !== null ? `Start in <b>${m.eta}</b> s` : `Mindestens ${m.min} Spieler nötig`}`; });
  net.on('start', async (m) => {
    startMsg = m; audio.match(); show('MATCH GEFUNDEN!', `${m.count} Spieler · Karte wird geladen…`); mm.querySelector('#on-c').style.display = 'none';
    await new Promise((r) => setTimeout(r, 400));
    $('loading').style.display = 'flex'; lobby.stop(); await new Promise((r) => setTimeout(r, 60));
    try {
      await assetsP; await loadCharacter();
      if (world) { world.dispose(); world = null; }
      gameScene = new THREE.Scene(); world = await World.create(renderer, gameScene, qual(), m.seed, setLoad);
      for (const v of world.vehicles) gameScene.remove(v.mesh); world.vehicles.length = 0;
      net.send({ t: 'ready' }); const e = $('loading').querySelector('span'); if (e) e.textContent = 'Warte auf andere Spieler…';
    } catch (err) { console.error(err); net.close(); $('loading').style.display = 'none'; lobby.start(); end(); }
  });
  net.on('go', () => {
    started = true; end(); $('loading').style.display = 'none'; const sp = $('loading').querySelector('span'); if (sp) sp.textContent = 'Gelände, Städte und Kisten werden erzeugt';
    busy = true;
    match = new Match({ renderer, scene: gameScene, world, profile, audio, opts: { mode: 'online', players: [], online: { net, seed: startMsg.seed, you: startMsg.you, index: startMsg.index, count: startMsg.count, players: startMsg.players } }, hudRoot: $('hud'), onExit: () => { match = null; busy = false; lobby.start(); } });
    window.__br.match = match;
  });
}
