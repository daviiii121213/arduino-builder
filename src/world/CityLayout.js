/** Shared dimensions of the city grid (metres). */
export const CITY = {
  roadCenters: [-108, -36, 36, 108],
  roadHalf: 7,
  laneOffset: 2.6,
  parkingOffset: 5.6,
  sidewalk: 4,
  curbHeight: 0.15,
  outerEdge: 150,
};

const { roadCenters: R, roadHalf: H } = CITY;

/** Inner blocks: 3x3 grid between the four road lines. */
export const BLOCK_TYPES = [
  ['parking', 'buildings', 'buildings'],
  ['buildings', 'park', 'civic'],
  ['buildings', 'buildings', 'buildings'],
];

export function blockBounds(ix, iz) {
  return { x0: R[ix] + H, x1: R[ix + 1] - H, z0: R[iz] + H, z1: R[iz + 1] - H };
}

export const RING_OUTER = R[R.length - 1] + H; // 114

/** Iterates all inner blocks. */
export function forEachBlock(fn) {
  for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 3; iz++) fn(ix, iz, BLOCK_TYPES[ix][iz], blockBounds(ix, iz));
}
