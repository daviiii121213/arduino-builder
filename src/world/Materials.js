import * as THREE from 'three';
import {
  corrugatedTexture, fenceTexture,
  asphaltTexture, sidewalkTexture, plazaTexture, grassTexture, roofTexture, concreteTexture,
  facadeTextures, storefrontTextures,
} from './Textures.js';

/** Shared material library. Created lazily so textures are only painted when used. */
const lib = new Map();

function get(key, create) {
  if (!lib.has(key)) lib.set(key, create());
  return lib.get(key);
}

const std = (params) => new THREE.MeshStandardMaterial(params);

/** Materials whose emissive glow follows the night factor: [material, intensity at full night]. */
export const nightMaterials = [];
const nightGlow = (material, max) => {
  nightMaterials.push([material, max]);
  return material;
};

export const Materials = {
  asphalt: () => get('asphalt', () => std({ map: asphaltTexture(), roughness: 0.92 })),
  sidewalk: () => get('sidewalk', () => std({ map: sidewalkTexture(), roughness: 0.88 })),
  curb: () => get('curb', () => std({ map: concreteTexture(), color: 0xc8c4bc, roughness: 0.85 })),
  plaza: () => get('plaza', () => std({ map: plazaTexture(), roughness: 0.85 })),
  grass: () => get('grass', () => std({ map: grassTexture(), roughness: 1 })),
  concrete: () => get('concrete', () => std({ map: concreteTexture(), roughness: 0.9 })),
  roof: () => get('roof', () => std({ map: roofTexture(), roughness: 0.95 })),
  roadPaint: () => get('roadPaint', () => std({
    color: 0xe9e6dc, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  })),
  roadPaintYellow: () => get('roadPaintY', () => std({
    color: 0xd9a52b, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  })),
  facade: (style) => get('facade:' + style, () => {
    const t = facadeTextures(style);
    return nightGlow(std({ map: t.map, roughnessMap: t.roughnessMap, roughness: 1, metalness: 0.05, emissiveMap: t.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0 }), 1.1);
  }),
  storefront: (style) => get('store:' + style, () => {
    const t = storefrontTextures(style);
    return nightGlow(std({ map: t.map, roughnessMap: t.roughnessMap, roughness: 1, metalness: 0.05, emissiveMap: t.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0 }), 1.4);
  }),
  /** Untextured, vertex-coloured material used for trims, props and details. */
  painted: () => get('painted', () => std({ vertexColors: true, roughness: 0.75 })),
  metal: () => get('metal', () => std({ vertexColors: true, roughness: 0.45, metalness: 0.6 })),
  glass: () => get('glass', () => std({ color: 0x3b4d58, roughness: 0.08, metalness: 0.3 })),
  foliage: () => get('foliage', () => std({ vertexColors: true, roughness: 0.9, flatShading: true })),
  emissiveWarm: () => get('emissiveWarm', () => std({ color: 0xfff1d0, emissive: 0xffd9a0, emissiveIntensity: 0.3 })),
  /** See-through shop windows and doors. */
  shopGlass: () => get('shopGlass', () => {
    const m = std({ color: 0x9fc0cc, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.32, depthWrite: false });
    m.userData.castShadow = false;
    return m;
  }),
  rollupDoor: () => get('rollupDoor', () => std({ map: corrugatedTexture(), color: 0x9aa7b0, roughness: 0.5, metalness: 0.4 })),
  /** Interior surfaces get a little self-light so rooms read well under a roof. */
  interior: () => get('interior', () => std({ vertexColors: true, roughness: 0.8, emissive: 0x3a352e })),
  lightPanel: () => get('lightPanel', () => std({ color: 0xfffaf0, emissive: 0xfff2dc, emissiveIntensity: 1.4 })),
  fridgeGlass: () => get('fridgeGlass', () => std({ color: 0xbfe3f0, emissive: 0x9fd4ec, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.2 })),
  corrugated: () => get('corrugated', () => std({ map: corrugatedTexture(), vertexColors: true, roughness: 0.55, metalness: 0.35 })),
  fence: () => get('fence', () => {
    const m = std({ map: fenceTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 });
    m.userData.castShadow = true;
    return m;
  }),
  water: () => get('water', () => std({ color: 0x3f6a78, roughness: 0.05, metalness: 0.2 })),
};
