// Converte o cenário FBX num formato compacto para a versão web (o FBX tem 29 MB).
// Uso: node export-scene.mjs <shooting_range.fbx> <saida.bin.txt> <saida.json>
// O binário sai em base64 (.txt) porque o Artifact só serve tipos de arquivo conhecidos.
// Precisa do pacote "three" (0.160) instalado onde o script roda.
import fs from 'fs';

globalThis.self = globalThis;
globalThis.window = { URL: { createObjectURL: () => 'blob:x' } };
const THREE = await import('three');
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
THREE.TextureLoader.prototype.load = () => new THREE.Texture();

const [input, binPath, jsonPath] = process.argv.slice(2);
const buf = fs.readFileSync(input);
const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
root.updateMatrixWorld(true);

const chunks = [];
let offset = 0;
function push(typed) {
  // Alinha cada bloco em 4 bytes para poder criar Float32Array/Uint32Array direto do buffer.
  const pad = (4 - (offset % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
  const at = offset;
  chunks.push(Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength));
  offset += typed.byteLength;
  return at;
}

const parts = [];
root.traverse((mesh) => {
  if (!mesh.isMesh) return;
  const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  const pos = g.attributes.position, uv = g.attributes.uv;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  // O three.js divide as malhas em muitos grupos pequenos; junta todos os do mesmo material.
  const ranges = new Map();
  for (const group of (g.groups.length ? g.groups : [{ start: 0, count: pos.count, materialIndex: 0 }])) {
    if (!ranges.has(group.materialIndex)) ranges.set(group.materialIndex, []);
    ranges.get(group.materialIndex).push(group);
  }
  for (const [materialIndex, groups] of ranges) {
    const mat = materials[materialIndex];
    // Junta vértices iguais (posição + uv) para indexar.
    const map = new Map(), positions = [], uvs = [], indices = [];
    for (const group of groups)
    for (let i = group.start; i < group.start + group.count; i++) {
      const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      const t = uv ? [uv.getX(i), uv.getY(i)] : [0, 0];
      const key = p.map((v) => v.toFixed(3)).join(',') + '|' + t.map((v) => v.toFixed(5)).join(',');
      let index = map.get(key);
      if (index === undefined) {
        index = positions.length / 3;
        map.set(key, index);
        positions.push(...p);
        uvs.push(...t);
      }
      indices.push(index);
    }
    const count = positions.length / 3;
    const range = (values, stride, axis, pick) => values.filter((_, i) => i % stride === axis).reduce((a, b) => pick(a, b));
    const min = [0, 1, 2].map((a) => range(positions, 3, a, Math.min));
    const max = [0, 1, 2].map((a) => range(positions, 3, a, Math.max));
    const uvMin = [0, 1].map((a) => range(uvs, 2, a, Math.min));
    const uvMax = [0, 1].map((a) => range(uvs, 2, a, Math.max));
    // Posições e uvs quantizados em 16 bits dentro da caixa de cada parte.
    const qp = new Uint16Array(count * 3), qt = new Uint16Array(count * 2);
    for (let i = 0; i < count; i++) {
      for (let a = 0; a < 3; a++) qp[i * 3 + a] = Math.round(((positions[i * 3 + a] - min[a]) / ((max[a] - min[a]) || 1)) * 65535);
      for (let a = 0; a < 2; a++) qt[i * 2 + a] = Math.round(((uvs[i * 2 + a] - uvMin[a]) / ((uvMax[a] - uvMin[a]) || 1)) * 65535);
    }
    const idx = count < 65536 ? new Uint16Array(indices) : new Uint32Array(indices);
    parts.push({
      name: mesh.name.replace(/Shape$/, ''),
      material: mat.name,
      texture: mat.map ? `${mat.name}_C.jpg` : null,
      color: mat.map ? [1, 1, 1] : mat.color.toArray().map((v) => +v.toFixed(4)),
      vertexCount: count,
      positionOffset: push(qp), positionMin: min, positionMax: max,
      uvOffset: push(qt), uvMin, uvMax,
      indexOffset: push(idx), indexCount: idx.length, index32: idx instanceof Uint32Array,
    });
  }
});

fs.writeFileSync(binPath, Buffer.concat(chunks).toString('base64'));
fs.writeFileSync(jsonPath, JSON.stringify({ parts }, null, 1));
console.log(`${parts.length} partes, ${(offset / 1e6).toFixed(1)} MB`);
