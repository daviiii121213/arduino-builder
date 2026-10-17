// Separa o AKM.fbx (com ossos) em peças rígidas por osso, já no espaço da arma:
// centímetros, cano em +Z, para cima +Y, origem no punho. As peças são animadas por código
// (carregador, ferrolho, retém do carregador, seletor).
// Uso: node akm-parts.mjs <AKM.fbx> <saida.json>   (depois: python3 akm-glb.py <saida.json> <akm.glb>)
import fs from 'fs';

globalThis.self = globalThis;
globalThis.window = { URL: { createObjectURL: () => 'blob:x' } };
const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');

const LENGTH_CM = 88;                         // comprimento real do AKM
const GRIP = new THREE.Vector3(0, -1.4, -16.3); // centro do punho, já em cm
const PART_OF_BONE = { body: 'body', mag: 'mag', bullets: 'mag', bullet: 'mag', bolt: 'bolt', magrelease: 'magrelease', selector: 'selector' };

const buf = fs.readFileSync(process.argv[2]);
const fbx = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
fbx.updateMatrixWorld(true);
let mesh;
fbx.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
const box = new THREE.Box3().setFromObject(mesh, true);
const scale = LENGTH_CM / (box.max.x - box.min.x);

// No FBX o cano aponta para +X: gira -90° em Y para apontar para +Z.
const toGun = (v) => new THREE.Vector3(-v.z * scale, v.y * scale, v.x * scale).sub(GRIP);
const g = mesh.geometry, sk = g.attributes.skinIndex, sw = g.attributes.skinWeight;
const materials = [].concat(mesh.material);
const parts = {};
const v = new THREE.Vector3();
for (const group of g.groups) {
  for (let i = group.start; i < group.start + group.count; i += 3) {
    const tri = [], bones = [];
    for (let k = 0; k < 3; k++) {
      mesh.getVertexPosition(i + k, v);
      tri.push(toGun(v.clone().applyMatrix4(mesh.matrixWorld)));
      let best = 0, weight = 0;
      for (let c = 0; c < 4; c++) if (sw.getComponent(i + k, c) > weight) { weight = sw.getComponent(i + k, c); best = sk.getComponent(i + k, c); }
      bones.push(mesh.skeleton.bones[best].name);
    }
    const part = PART_OF_BONE[bones[0]] ?? 'body';
    const key = `${part}|${materials[group.materialIndex].name}`;
    (parts[key] ||= []).push(...tri.flatMap((p) => p.toArray().map((x) => +x.toFixed(3))));
  }
}
fs.writeFileSync(process.argv[3], JSON.stringify(parts));
console.log(Object.entries(parts).map(([k, p]) => `${k}: ${p.length / 9}`).join('\n'));
