import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Echte CC0-Assets (Poly Haven): PBR-Texturen und 3D-Modelle. Fehlt etwas, nutzt das Spiel die prozeduralen Ersatzobjekte.
export const ASSET = { img: {}, models: {} };
const B = import.meta.env.BASE_URL + 'assets/';
const IMGS = {
  leafy_grass_diff: 'tex/leafy_grass_diff.jpg', leafy_grass_nor: 'tex/leafy_grass_nor.jpg', asphalt_02_diff: 'tex/asphalt_02_diff.jpg', asphalt_02_nor: 'tex/asphalt_02_nor.jpg',
  concrete_pavement_diff: 'tex/concrete_pavement_diff.jpg', brick_wall_001_diff: 'tex/brick_wall_001_diff.jpg', brick_wall_005_diff: 'tex/brick_wall_005_diff.jpg', large_sandstone_blocks_01_diff: 'tex/large_sandstone_blocks_01_diff.jpg',
  crate_diff: 'models/wooden_military_crate/textures/wooden_military_crate_diff_1k.jpg', crate_nor: 'models/wooden_military_crate/textures/wooden_military_crate_nor_gl_1k.jpg',
};
const MODELS = ['service_pistol', 'bolt_action_rifle_7_62', 'fire_hydrant', 'street_lamp_01', 'metal_trash_can', 'concrete_road_barrier', 'korean_public_payphone_01', 'old_tyre'];
let promise = null;
export function loadAssets() {
  if (promise) return promise;
  const loader = new GLTFLoader();
  const imgs = Object.entries(IMGS).map(([k, u]) => new Promise((res) => { const i = new Image(); i.onload = () => { ASSET.img[k] = i; res(); }; i.onerror = () => res(); i.src = B + u; }));
  const models = MODELS.map((n) => loader.loadAsync(`${B}models/${n}/${n}.gltf`).then((g) => { g.scene.updateMatrixWorld(true); ASSET.models[n] = g.scene; }).catch(() => {}));
  promise = Promise.all([...imgs, ...models]);
  return promise;
}
export function texOf(name, rx = 1, ry = rx, srgb = true) {
  const img = ASSET.img[name]; if (!img) return null;
  const t = new THREE.Texture(img); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 16; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t;
}
// Viele Exemplare eines Modells als InstancedMesh (pro Teil-Mesh eine Instanz-Gruppe)
export function instanceModel(scene, name, placements) {
  const g = ASSET.models[name]; if (!g || !placements.length) return false;
  const d = new THREE.Object3D(), m = new THREE.Matrix4();
  g.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, placements.length);
    placements.forEach((pl, i) => { d.position.set(pl.x, pl.y, pl.z); d.rotation.set(0, pl.ry || 0, 0); d.scale.setScalar(pl.s || 1); d.updateMatrix(); m.multiplyMatrices(d.matrix, mesh.matrixWorld); im.setMatrixAt(i, m); });
    im.castShadow = im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im);
  });
  return true;
}
