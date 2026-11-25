import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Echtes geriggtes Charaktermodell (GLB) mit Skelett-Animationen. Fällt auf die prozedurale Figur zurück, wenn es nicht lädt.
let base = null, loading = null, scale = 1;
export function loadCharacter() {
  if (loading) return loading;
  loading = new Promise((res) => {
    new GLTFLoader().load(`${import.meta.env.BASE_URL}models/Soldier.glb`, (g) => {
      base = g; const box = new THREE.Box3().setFromObject(g.scene); scale = 1.82 / Math.max(0.01, box.max.y - box.min.y); res(g);
    }, undefined, () => res(null));
  });
  return loading;
}
export const characterReady = () => !!base;
const TINTS = [0xffffff, 0xd8d0c0, 0xc8d0d8, 0xe0c8c8, 0xc8d8c8, 0xb8b8b8];

export class Actor {
  constructor(seed = 0) {
    this.root = new THREE.Group();
    this.model = clone(base.scene); this.model.scale.setScalar(scale); this.root.add(this.model);
    const tint = new THREE.Color(TINTS[seed % TINTS.length]);
    this.model.traverse((o) => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; o.material = o.material.clone(); o.material.color.copy(tint); o.material.roughness = 0.85; o.material.metalness = 0; }
    });
    this.mixer = new THREE.AnimationMixer(this.model); this.actions = {};
    for (const c of base.animations) { const n = c.name.toLowerCase(); if (n.includes('idle') || n.includes('walk') || n.includes('run')) this.actions[n.includes('idle') ? 'idle' : n.includes('walk') ? 'walk' : 'run'] = this.mixer.clipAction(c); }
    this.cur = null; this.play('idle'); this.mixer.update(Math.random() * 2);
    this.hand = null; this.model.traverse((o) => { if (o.isBone && /RightHand$/.test(o.name)) this.hand = o; });
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
