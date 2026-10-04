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
  ['industrial', 'buildings', 'buildings'],
];

/** Character of each building block: drives heights, styles and how many shops. */
export const DISTRICTS = {
  '0,1': 'residential',
  '0,2': 'residential',
  '1,0': 'commercial',
  '2,1': 'commercial',
  '2,2': 'residential',
};

/** Original street names: roads running along z (by x position) and along x (by z position). */
export const STREET_NAMES = {
  x: ['Rua das Acácias', 'Av. Aurora', 'Rua do Mirante', 'Av. Beira-Leste'],
  z: ['Av. Contorno Sul', 'Rua dos Ipês', 'Av. Central', 'Rua Alto da Serra'],
};

export function blockBounds(ix, iz) {
  return { x0: R[ix] + H, x1: R[ix + 1] - H, z0: R[iz] + H, z1: R[iz + 1] - H };
}

export const RING_OUTER = R[R.length - 1] + H; // 114

/** Iterates all inner blocks. */
export function forEachBlock(fn) {
  for (let ix = 0; ix < 3; ix++) for (let iz = 0; iz < 3; iz++) fn(ix, iz, BLOCK_TYPES[ix][iz], blockBounds(ix, iz));
}
