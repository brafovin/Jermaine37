import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Mehrere geriggte 3D-Charaktere (GLB) mit Skelett-Animationen. Fehlt ein Modell, wird der Soldat benutzt, fehlt auch er, die prozedurale Figur.
const B = import.meta.env.BASE_URL + 'models/';
export const CHAR_MODELS = {
  soldier: { file: 'Soldier.glb', hand: /RightHand$/ },
  xbot: { file: 'Xbot.glb', hand: /RightHand$/, faceZ: true, paint: { color: 0x9aa4ae, metalness: 0.75, roughness: 0.32 } },
  robot: { file: 'RobotExpressive.glb', hand: /^Palm2R$/, faceZ: true },
};
const loaded = {};
let loading = null;
function loadOne(id) {
  return new Promise((res) => new GLTFLoader().load(B + CHAR_MODELS[id].file, (g) => {
    const box = new THREE.Box3().setFromObject(g.scene); loaded[id] = { g, scale: 1.82 / Math.max(0.01, box.max.y - box.min.y) }; res(g);
  }, undefined, () => res(null)));
}
export function loadCharacter() { // lädt alle Modelle; liefert den Soldaten (Pflicht) zurück
  if (!loading) loading = Promise.all(Object.keys(CHAR_MODELS).map(loadOne)).then(() => loaded.soldier ? loaded.soldier.g : null);
  return loading;
}
export const characterReady = (id = 'soldier') => !!loaded[id];
const TINTS = [0xffffff, 0xd8d0c0, 0xc8d0d8, 0xe0c8c8, 0xc8d8c8, 0xb8b8b8];
const BOT_MODELS = ['soldier', 'soldier', 'soldier', 'xbot'];
export const botModel = (i) => { const m = BOT_MODELS[i % BOT_MODELS.length]; return loaded[m] ? m : 'soldier'; };

const pickClip = (clips, kind) => {
  const names = { idle: ['idle'], walk: ['walk', 'walking'], run: ['run', 'running'] }[kind];
  return clips.find((c) => names.includes(c.name.toLowerCase())) || clips.find((c) => c.name.toLowerCase().includes(kind) && !/jump|dance/i.test(c.name));
};

export class Actor {
  constructor(seed = 0, tintHex = null, modelId = 'soldier') {
    const id = loaded[modelId] ? modelId : 'soldier', cfg = CHAR_MODELS[id], L = loaded[id];
    this.modelId = id; this.root = new THREE.Group();
    this.model = clone(L.g.scene); this.model.scale.setScalar(L.scale); if (cfg.faceZ) this.model.rotation.y = Math.PI; this.root.add(this.model);
    const tint = new THREE.Color(tintHex ?? TINTS[seed % TINTS.length]);
    this.model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.material = o.material.clone(); if (cfg.paint && o.material.name !== 'Beta_Joints_MAT') { o.material.color.setHex(cfg.paint.color); o.material.metalness = cfg.paint.metalness; o.material.roughness = cfg.paint.roughness; } o.material.color.multiply(tint); if (!cfg.paint && o.material.roughness !== undefined) o.material.roughness = Math.max(0.55, o.material.roughness); }
    });
    this.mixer = new THREE.AnimationMixer(this.model); this.actions = {};
    let clips = L.g.animations;
    if (cfg.borrow && loaded[cfg.borrow]) clips = loaded[cfg.borrow].g.animations.map((c) => { const k = c.clone(); k.tracks = k.tracks.filter((t) => !t.name.endsWith('.position') && t.name !== 'mixamorigHips.quaternion'); return k; });
    for (const kind of ['idle', 'walk', 'run']) { const c = pickClip(clips, kind); if (c) this.actions[kind] = this.mixer.clipAction(c); }
    this.cur = null; this.play('idle'); this.mixer.update(Math.random() * 2);
    this.hand = null; this.model.traverse((o) => { if (o.isBone && cfg.hand.test(o.name)) this.hand = o; });
  }
  play(n, fade = 0.25) {
    const a = this.actions[n]; if (!a || this.cur === n) return;
    a.reset().fadeIn(fade).play(); if (this.cur) this.actions[this.cur].fadeOut(fade); this.cur = n;
  }
  update(dt, speed) {
    this.play(speed < 0.4 ? 'idle' : speed < 3.4 ? 'walk' : 'run');
    if (this.actions.walk) this.actions.walk.timeScale = clamp(speed / 1.7, 0.6, 1.6);
    if (this.actions.run) this.actions.run.timeScale = clamp(speed / 4.8, 0.7, 1.6);
    this.mixer.update(dt);
  }
  attachWeapon(w, o = {}) {
    if (!this.hand) { this.root.add(w); return; }
    this.root.updateMatrixWorld(true);
    const ws = new THREE.Vector3(); this.hand.getWorldScale(ws);
    const holder = new THREE.Group(); holder.scale.setScalar(1 / ws.x); holder.position.set(...(o.pos || [0, 0, 0])); holder.rotation.set(...(o.rot || [0, 0, 0]));
    holder.add(w); this.hand.add(holder); this.weapon = holder;
  }
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
