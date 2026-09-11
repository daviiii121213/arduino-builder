// Everything the player can place. `kind` selects the simulation behaviour,
// `art` selects the procedural sprite painter in src/art/machines.js.

export const BUILDABLES = {
  // ================= LOGISTICS =================
  belt: { name: 'Conveyor Belt', kind: 'belt', w: 1, h: 1, cost: 28, cat: 'logistics', power: 0.4,
    desc: 'Moves items one tile at a time. Pulls from machine outputs, feeds machine inputs.', speed: 1.6 },
  belt_fast: { name: 'Fast Conveyor', kind: 'belt', w: 1, h: 1, cost: 120, cat: 'logistics', power: 0.9,
    tech: 'logistics_ii', desc: 'Double-speed belt for high throughput lines.', speed: 3.2 },
  pipe: { name: 'Pipe', kind: 'pipe', w: 1, h: 1, cost: 22, cat: 'logistics', power: 0,
    tech: 'chemistry', desc: 'Carries fluids between pumps, chemical plants and boilers.' },
  cable: { name: 'Power Cable', kind: 'cable', w: 1, h: 1, cost: 14, cat: 'logistics', power: 0,
    desc: 'Links generators to machines. Machines must touch a powered cable.' },
  chest: { name: 'Storage Crate', kind: 'store', w: 1, h: 1, cost: 60, cat: 'logistics', power: 0,
    capacity: 240, desc: 'Buffers items. Belts fill it and draw from it.' },
  warehouse: { name: 'Warehouse', kind: 'store', w: 4, h: 3, cost: 1400, cat: 'logistics', power: 1.5,
    tech: 'logistics_ii', capacity: 4000, desc: 'Huge buffered storage with a covered loading floor.' },
  dock: { name: 'Loading Dock', kind: 'dock', w: 3, h: 2, cost: 520, cat: 'logistics', power: 1,
    desc: 'Trucks collect anything delivered here and the market pays you for it.' },

  // ================= EXTRACTION =================
  miner: { name: 'Mining Drill', kind: 'miner', w: 2, h: 2, cost: 220, cat: 'machine', power: 3,
    desc: 'Extracts ore from the deposit underneath it. Place on a resource patch.' },
  miner_adv: { name: 'Deep Drill', kind: 'miner', w: 2, h: 2, cost: 1900, cat: 'machine', power: 9,
    tech: 'heavy_industry', rate: 2.6, desc: 'Heavy rotary drill. Far higher yield per cycle.' },
  waterpump: { name: 'Water Pump', kind: 'machine', w: 2, h: 2, cost: 180, cat: 'machine', power: 2,
    tech: 'chemistry', desc: 'Draws water from a river or lake tile it touches.' },

  // ================= PROCESSING =================
  furnace: { name: 'Furnace', kind: 'machine', w: 2, h: 2, cost: 260, cat: 'machine', power: 4,
    desc: 'Smelts ore into plates and ingots. Runs hot — watch the temperature gauge.' },
  press: { name: 'Industrial Press', kind: 'machine', w: 2, h: 2, cost: 380, cat: 'machine', power: 5,
    desc: 'Stamps plates into gears, parts and frames.' },
  cutter: { name: 'Cutting Machine', kind: 'machine', w: 2, h: 2, cost: 340, cat: 'machine', power: 4.5,
    desc: 'Saws, crushes and draws material into finer stock.' },
  assembler: { name: 'Assembly Machine', kind: 'machine', w: 3, h: 2, cost: 720, cat: 'machine', power: 7,
    desc: 'Combines components into finished goods.' },
  chemical: { name: 'Chemical Plant', kind: 'machine', w: 3, h: 3, cost: 1100, cat: 'machine', power: 9,
    tech: 'chemistry', desc: 'Reactor vessels for chemicals, oil and polymers.' },
  packager: { name: 'Packaging Line', kind: 'machine', w: 3, h: 2, cost: 860, cat: 'machine', power: 5,
    tech: 'logistics_ii', desc: 'Crates finished goods, raising their market value.' },
  recycler: { name: 'Recycling Unit', kind: 'machine', w: 2, h: 2, cost: 640, cat: 'machine', power: 6,
    tech: 'recycling', desc: 'Breaks scrap back down into usable stock.' },
  robotics: { name: 'Robotic Assembler', kind: 'machine', w: 3, h: 3, cost: 4200, cat: 'machine', power: 16,
    tech: 'robotics', desc: 'Multi-arm robotic cell for high-tech manufacturing.' },

  // ================= POWER & UTILITIES =================
  coal_gen: { name: 'Coal Generator', kind: 'gen', w: 3, h: 2, cost: 420, cat: 'power', output: 18,
    fuel: 'coal', burnTime: 14, desc: 'Burns coal to make electricity. Smoky, cheap, reliable.' },
  solar: { name: 'Solar Array', kind: 'gen', w: 2, h: 2, cost: 900, cat: 'power', output: 7,
    tech: 'electrification', solar: true, desc: 'Silent daytime power. Output falls at night.' },
  turbine: { name: 'Steam Turbine', kind: 'gen', w: 3, h: 3, cost: 3600, cat: 'power', output: 70,
    fuel: 'coal', burnTime: 10, needsWater: true, tech: 'heavy_industry',
    desc: 'High-output turbine hall. Needs coal and piped water.' },
  fusion: { name: 'Fusion Reactor', kind: 'gen', w: 4, h: 4, cost: 26000, cat: 'power', output: 400,
    tech: 'automation_ai', desc: 'Clean, enormous, endgame power.' },
  lamp: { name: 'Industrial Lamp', kind: 'lamp', w: 1, h: 1, cost: 45, cat: 'power', power: 0.3,
    desc: 'Lights the factory floor at night. Workers move faster in lit areas.' },

  // ================= STRUCTURES =================
  floor: { name: 'Concrete Floor', kind: 'floor', w: 1, h: 1, cost: 10, cat: 'struct',
    desc: 'Clean industrial flooring. Walking on it is faster than mud.' },
  wall: { name: 'Factory Wall', kind: 'struct', w: 1, h: 1, cost: 32, cat: 'struct', solid: true,
    desc: 'Corrugated steel wall panel.' },
  door: { name: 'Industrial Door', kind: 'struct', w: 1, h: 1, cost: 90, cat: 'struct',
    desc: 'Roller door. Opens as you approach.' },
  window: { name: 'Factory Window', kind: 'struct', w: 1, h: 1, cost: 70, cat: 'struct', solid: true,
    desc: 'Reinforced glazing panel.' },
  office: { name: 'Office', kind: 'service', w: 3, h: 3, cost: 1600, cat: 'struct', power: 2,
    service: 'office', desc: 'Cuts operating costs by 12% and improves sale prices.' },
  breakroom: { name: 'Break Room', kind: 'service', w: 3, h: 2, cost: 900, cat: 'struct', power: 1.5,
    service: 'breakroom', desc: 'Workers rest here. Rested workers work 25% faster.' },
  lab: { name: 'Research Lab', kind: 'lab', w: 3, h: 3, cost: 2200, cat: 'struct', power: 8,
    desc: 'Generates research points so the tech tree can advance.' },
  maintenance: { name: 'Maintenance Bay', kind: 'service', w: 3, h: 2, cost: 1300, cat: 'struct', power: 3,
    service: 'maintenance', desc: 'Slows machine wear factory-wide and speeds repairs.' },
};

for (const [id, b] of Object.entries(BUILDABLES)) {
  b.id = id;
  if (b.power === undefined) b.power = 0;
}

export const CATEGORIES = [
  { id: 'logistics', name: 'Logistics' },
  { id: 'machine', name: 'Machines' },
  { id: 'power', name: 'Power' },
  { id: 'struct', name: 'Structures' },
];

export function buildablesFor(cat, unlockedTech) {
  return Object.values(BUILDABLES).filter((b) => b.cat === cat && (!b.tech || unlockedTech.has(b.tech)));
}
