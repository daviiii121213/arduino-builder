// Technology tree. Cost is research points produced by labs (and by hand-crank research at the
// workbench early on). `col`/`row` place the node on the tech-tree screen.

export const TECHS = {
  steelmaking:   { name: 'Steelmaking',        cost: 60,   col: 0, row: 1, req: [],
    desc: 'Cast steel and melt glass in your furnaces. Unlocks pressed metal parts.' },
  electrification:{name: 'Electrification',    cost: 120,  col: 1, row: 0, req: ['steelmaking'],
    desc: 'Motors, solar arrays and powered pumps.' },
  logistics_ii:  { name: 'Logistics II',       cost: 150,  col: 1, row: 2, req: ['steelmaking'],
    desc: 'Fast belts, warehouses and the packaging line.' },
  chemistry:     { name: 'Industrial Chemistry',cost: 260, col: 2, row: 1, req: ['electrification'],
    desc: 'Chemical plants, pipes, oil and plastics.' },
  heavy_industry:{ name: 'Heavy Industry',     cost: 420,  col: 2, row: 3, req: ['logistics_ii'],
    desc: 'Deep drills, steel frames, engines and steam turbines.' },
  electronics:   { name: 'Electronics',        cost: 560,  col: 3, row: 0, req: ['chemistry'],
    desc: 'Advanced circuits and smart appliances.' },
  light_metals:  { name: 'Light Metals',       cost: 500,  col: 3, row: 2, req: ['chemistry'],
    desc: 'Aluminium refining for lightweight products.' },
  recycling:     { name: 'Recycling',          cost: 380,  col: 3, row: 4, req: ['heavy_industry'],
    desc: 'Reclaim scrap into usable stock. Cuts material costs.' },
  metallurgy:    { name: 'Advanced Metallurgy',cost: 900,  col: 4, row: 2, req: ['light_metals', 'heavy_industry'],
    desc: 'Advanced alloys and industrial parts.' },
  precision_eng: { name: 'Precision Engineering',cost:1300,col: 4, row: 0, req: ['electronics'],
    desc: 'Precision modules machined to the micron.' },
  robotics:      { name: 'Robotics',           cost: 2100, col: 5, row: 1, req: ['precision_eng', 'metallurgy'],
    desc: 'Robotic assemblers, arm units and logistics drones.' },
  automation_ai: { name: 'Autonomous Systems', cost: 4200, col: 6, row: 1, req: ['robotics'],
    desc: 'Fusion power, assembly robots and the autonomy core.' },
};

for (const [id, t] of Object.entries(TECHS)) t.id = id;

export function available(unlocked) {
  return Object.values(TECHS).filter((t) => !unlocked.has(t.id) && t.req.every((r) => unlocked.has(r)));
}
