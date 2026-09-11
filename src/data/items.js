// Every material and product in the game. `art` drives the procedural icon/world sprite.
import { P } from '../art/palette.js';

export const ITEMS = {
  // ---- raw ----
  wood:       { name: 'Wood',            tier: 0, value: 3,   cat: 'raw', art: { kind: 'log',    a: '#8a6234', b: '#c79a5c' } },
  stone:      { name: 'Stone',           tier: 0, value: 3,   cat: 'raw', art: { kind: 'rock',   a: P.rock,    b: P.rockHi } },
  iron_ore:   { name: 'Iron Ore',        tier: 0, value: 6,   cat: 'raw', art: { kind: 'ore',    a: '#6b6560', b: '#a08a76', fleck: '#d8c2a0' } },
  copper_ore: { name: 'Copper Ore',      tier: 0, value: 7,   cat: 'raw', art: { kind: 'ore',    a: '#6a4a33', b: P.copper,  fleck: P.copperHi } },
  coal:       { name: 'Coal',            tier: 0, value: 5,   cat: 'raw', art: { kind: 'ore',    a: '#1e1e22', b: '#3a3a42', fleck: '#6a6a78' } },
  sand:       { name: 'Sand',            tier: 0, value: 2,   cat: 'raw', art: { kind: 'grain',  a: '#b09561', b: P.sand } },
  water:      { name: 'Water',           tier: 0, value: 1,   cat: 'fluid', art: { kind: 'fluid', a: P.waterDeep, b: P.waterHi } },
  crude_oil:  { name: 'Crude Oil',       tier: 1, value: 12,  cat: 'fluid', art: { kind: 'fluid', a: '#15151a', b: '#3d3448' } },

  // ---- intermediate ----
  iron_plate: { name: 'Iron Plate',      tier: 1, value: 16,  cat: 'mat', art: { kind: 'plate',  a: '#6e7480', b: '#a8b0ba' } },
  copper_plate:{name: 'Copper Plate',    tier: 1, value: 18,  cat: 'mat', art: { kind: 'plate',  a: P.copperLo, b: P.copperHi } },
  steel:      { name: 'Steel Ingot',     tier: 2, value: 46,  cat: 'mat', art: { kind: 'ingot',  a: '#565e69', b: '#c3ccd6' } },
  glass:      { name: 'Glass Sheet',     tier: 2, value: 30,  cat: 'mat', art: { kind: 'sheet',  a: P.glassLo, b: P.glass } },
  aluminum:   { name: 'Aluminium',       tier: 2, value: 52,  cat: 'mat', art: { kind: 'ingot',  a: '#8e9aa4', b: '#e2ecf2' } },
  plastic:    { name: 'Plastic Pellets', tier: 2, value: 34,  cat: 'mat', art: { kind: 'grain',  a: '#9c6ea8', b: '#d5a8dd' } },
  chemicals:  { name: 'Chemicals',       tier: 2, value: 40,  cat: 'fluid', art: { kind: 'fluid', a: '#2c5c3a', b: '#7fd08a' } },
  alloy:      { name: 'Advanced Alloy',  tier: 3, value: 210, cat: 'mat', art: { kind: 'ingot',  a: '#4a4258', b: '#b6a8d8' } },

  // ---- components ----
  gear:       { name: 'Iron Gear',       tier: 1, value: 42,  cat: 'part', art: { kind: 'gear',   a: '#5e6570', b: '#aab2bc' } },
  metal_part: { name: 'Metal Part',      tier: 2, value: 96,  cat: 'part', art: { kind: 'bracket',a: '#5a6270', b: '#9aa4b0' } },
  wire:       { name: 'Copper Wire',     tier: 1, value: 30,  cat: 'part', art: { kind: 'coil',   a: P.copperLo, b: P.copperHi } },
  circuit:    { name: 'Circuit Board',   tier: 2, value: 130, cat: 'part', art: { kind: 'board',  a: '#1e4a30', b: '#3f8a56', fleck: P.gold } },
  frame:      { name: 'Steel Frame',     tier: 3, value: 260, cat: 'part', art: { kind: 'frame',  a: '#4e5560', b: '#98a2ae' } },
  motor:      { name: 'Electric Motor',  tier: 3, value: 340, cat: 'part', art: { kind: 'motor',  a: '#3b4450', b: P.copper } },
  ind_part:   { name: 'Industrial Part', tier: 3, value: 420, cat: 'part', art: { kind: 'bracket',a: '#4a4038', b: P.brass } },
  adv_circuit:{ name: 'Advanced Circuit',tier: 4, value: 720, cat: 'part', art: { kind: 'board',  a: '#2a1e46', b: '#6a52b0', fleck: '#ffd97a' } },
  robo_part:  { name: 'Robotic Arm Unit',tier: 4, value: 1150,cat: 'part', art: { kind: 'arm',    a: '#3c4450', b: P.paintOrange } },
  precision:  { name: 'Precision Module',tier: 4, value: 1480,cat: 'part', art: { kind: 'module', a: '#2e3a44', b: P.glass } },

  // ---- sellable products ----
  tool_kit:   { name: 'Tool Kit',        tier: 1, value: 150, cat: 'product', art: { kind: 'crate', a: '#6b4a26', b: P.paintOrange } },
  pump:       { name: 'Industrial Pump', tier: 2, value: 470, cat: 'product', art: { kind: 'crate', a: '#33506b', b: P.paintBlueHi } },
  engine:     { name: 'Combustion Engine',tier:3, value: 1250,cat: 'product', art: { kind: 'crate', a: '#5a3a2a', b: P.paintRedHi } },
  appliance:  { name: 'Smart Appliance', tier: 3, value: 1620,cat: 'product', art: { kind: 'crate', a: '#3a5a44', b: P.paintGreenHi } },
  drone:      { name: 'Logistics Drone', tier: 4, value: 3400,cat: 'product', art: { kind: 'crate', a: '#463a5a', b: '#a88ae0' } },
  robot:      { name: 'Assembly Robot',  tier: 5, value: 7800,cat: 'product', art: { kind: 'crate', a: '#2e3d4a', b: P.glowCold } },
  ai_core:    { name: 'Autonomy Core',   tier: 5, value: 15600,cat:'product', art: { kind: 'crate', a: '#1e2c3a', b: '#7ef0d0' } },
};

for (const [id, it] of Object.entries(ITEMS)) it.id = id;

export const itemName = (id) => (ITEMS[id] ? ITEMS[id].name : id);
export const itemValue = (id) => (ITEMS[id] ? ITEMS[id].value : 1);
export const isFluid = (id) => ITEMS[id] && ITEMS[id].cat === 'fluid';
