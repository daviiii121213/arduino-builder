import * as THREE from 'three';
import { DIM } from '../characters/CharacterRig.js';

/**
 * Body regions of the blocky characters and how much a hit there hurts.
 * Effects are gameplay/animation only: nothing graphic is ever shown.
 */
export const BODY_REGIONS = {
  head: { multiplier: 4.0 },
  torso: { multiplier: 1.0 },
  arms: { multiplier: 0.45 },
  legs: { multiplier: 0.55 },
};

const HEAD_BOTTOM = DIM.hipY + 0.03 + DIM.torsoH;
const _local = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** Region for a point in the character's root space (upright pose). */
export function regionFromLocal(p) {
  if (p.y >= HEAD_BOTTOM) return { region: 'head', side: 0 };
  if (p.y < DIM.hipY - 0.02) return { region: 'legs', side: Math.sign(p.x) || 1 };
  if (Math.abs(p.x) > DIM.shoulderX - 0.02) return { region: 'arms', side: Math.sign(p.x) };
  return { region: 'torso', side: 0 };
}

/** Region hit by a world-space impact point on a standing character. */
export function regionFromWorld(rig, worldPoint) {
  rig.root.updateMatrixWorld(true);
  _local.copy(worldPoint);
  rig.root.worldToLocal(_local);
  return regionFromLocal(_local);
}

export const damageFor = (baseDamage, region) => baseDamage * BODY_REGIONS[region].multiplier;

/**
 * For characters without a collider of their own (drivers seen through a car's
 * glass): finds the body part a ray passes through, testing simple spheres
 * placed on the bones. Returns {region, side, distance} or null.
 */
export function regionAlongRay(rig, origin, dir, maxDistance) {
  rig.root.updateMatrixWorld(true);
  const scale = rig.root.getWorldScale(_b).x;
  const probes = [
    { bone: rig.head, offset: [0, DIM.head / 2, 0], r: 0.17, region: 'head', side: 0 },
    { bone: rig.spine, offset: [0, DIM.torsoH * 0.55, 0], r: 0.22, region: 'torso', side: 0 },
    { bone: rig.armL.fore, offset: [0, 0, 0], r: 0.09, region: 'arms', side: 1 },
    { bone: rig.armR.fore, offset: [0, 0, 0], r: 0.09, region: 'arms', side: -1 },
    { bone: rig.legL.shin, offset: [0, 0, 0], r: 0.1, region: 'legs', side: 1 },
    { bone: rig.legR.shin, offset: [0, 0, 0], r: 0.1, region: 'legs', side: -1 },
  ];
  let best = null;
  for (const p of probes) {
    _a.set(...p.offset).applyMatrix4(p.bone.matrixWorld);
    const t = _b.subVectors(_a, origin).dot(dir);
    if (t < 0 || t > maxDistance) continue;
    const dist = _b.copy(origin).addScaledVector(dir, t).distanceTo(_a);
    if (dist < p.r * scale && (!best || t < best.distance)) best = { region: p.region, side: p.side, distance: t, point: _a.clone() };
  }
  return best;
}
