import * as THREE from 'three';
import { Profile } from './profile.js';
import { AudioFX } from './audio.js';
import { Lobby } from './lobby.js';
import { runMatchmaking } from './matchmaking.js';
import { Match } from './game.js';
import { World } from './world.js';
import { WEAPON_BY_ID } from './data.js';

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

const lobby = new Lobby({ renderer, profile, audio, root: $('lobby'), onPlay: play, onQuality: applyRes });

async function play(mode) {
  if (busy) return; busy = true;
  const res = await runMatchmaking({ root: $('mm'), profile, mode, audio });
  if (res.cancelled) { busy = false; return; }
  $('loading').style.display = 'flex';
  lobby.stop();
  await new Promise((r) => setTimeout(r, 60));
  try {
    if (world) { world.dispose(); world = null; }
    gameScene = new THREE.Scene();
    world = new World(renderer, gameScene, qual(), (Math.random() * 1e9) | 0);
    $('mm').style.display = 'none'; $('mm').innerHTML = '';
    match = new Match({
      renderer, scene: gameScene, world, profile, audio, opts: { mode, players: res.players }, hudRoot: $('hud'),
      onExit: () => { match = null; busy = false; lobby.start(); },
    });
    window.__br.match = match;
  } catch (e) { console.error(e); busy = false; lobby.start(); $('mm').style.display = 'none'; }
  $('loading').style.display = 'none';
}

window.__br = { profile, play, lobby, W: WEAPON_BY_ID, get world() { return world; } };
lobby.start();
