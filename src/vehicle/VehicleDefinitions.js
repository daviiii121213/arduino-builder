/**
 * Original fictional vehicle types. Profiles are side silhouettes in (z, y):
 * z runs from rear (-length/2) to front (+length/2), y is height above ground.
 */
export const VEHICLE_TYPES = {
  compact: {
    name: 'Pétala',
    length: 3.3, width: 1.62, wheelRadius: 0.29, wheelFront: 1.05, wheelRear: -1.0, track: 0.68,
    bottom: 0.25, belt: 0.82, hood: 0.74, deck: 0.8, roof: 1.36,
    cabin: { rear: -1.55, roofRear: -1.3, roofFront: 0.05, front: 0.62 }, cabinWidth: 1.42,
    seat: { x: 0.33, z: -0.35 },
    mass: 850, engine: 1800, maxSpeed: 30, steer: 0.62,
    colors: [0xd9a440, 0x6fa8a3, 0xc9584a, 0xe9e4d8, 0x7c8fbf],
  },
  sedan: {
    name: 'Brisa',
    length: 4.0, width: 1.72, wheelRadius: 0.31, wheelFront: 1.3, wheelRear: -1.25, track: 0.74,
    bottom: 0.26, belt: 0.84, hood: 0.78, deck: 0.82, roof: 1.32,
    cabin: { rear: -1.15, roofRear: -0.85, roofFront: 0.3, front: 0.75 }, cabinWidth: 1.5,
    seat: { x: 0.36, z: -0.25 },
    mass: 1100, engine: 2400, maxSpeed: 36, steer: 0.58,
    colors: [0x2e6f78, 0x3d3f45, 0x8c2f2f, 0xb8b8b2, 0x2f4f7a],
  },
  suv: {
    name: 'Serra',
    length: 3.95, width: 1.82, wheelRadius: 0.36, wheelFront: 1.25, wheelRear: -1.22, track: 0.78,
    bottom: 0.36, belt: 1.02, hood: 0.98, deck: 1.0, roof: 1.68,
    cabin: { rear: -1.88, roofRear: -1.75, roofFront: 0.25, front: 0.82 }, cabinWidth: 1.62,
    seat: { x: 0.38, z: -0.25 },
    mass: 1500, engine: 3000, maxSpeed: 33, steer: 0.55,
    colors: [0x4b5a3a, 0x1f2a36, 0xd8d4c8, 0x7a3b2a, 0x5f6a72],
  },
  sports: {
    name: 'Faísca',
    length: 3.8, width: 1.78, wheelRadius: 0.3, wheelFront: 1.25, wheelRear: -1.2, track: 0.76,
    bottom: 0.2, belt: 0.68, hood: 0.6, deck: 0.7, roof: 1.08,
    cabin: { rear: -1.05, roofRear: -0.65, roofFront: 0.05, front: 0.55 }, cabinWidth: 1.44,
    seat: { x: 0.36, z: -0.35 },
    mass: 1000, engine: 3200, maxSpeed: 42, steer: 0.56,
    colors: [0xd23b2a, 0xf0c13a, 0x2a59c9, 0x1d1d1f, 0x3fb07a],
  },
  utility: {
    name: 'Lida',
    length: 4.2, width: 1.8, wheelRadius: 0.34, wheelFront: 1.4, wheelRear: -1.3, track: 0.78,
    bottom: 0.34, belt: 0.98, hood: 0.92, deck: 0.98, roof: 1.62,
    cabin: { rear: -0.3, roofRear: -0.25, roofFront: 0.7, front: 1.15 }, cabinWidth: 1.6,
    seat: { x: 0.38, z: 0.25 },
    bed: true,
    mass: 1400, engine: 2700, maxSpeed: 31, steer: 0.55,
    colors: [0xe7e3d6, 0xc96f2a, 0x3e6b8a, 0x6d7a3e, 0x9a9a94],
  },
};

export const VEHICLE_TYPE_IDS = Object.keys(VEHICLE_TYPES);
