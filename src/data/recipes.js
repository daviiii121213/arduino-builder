// Production recipes. `time` is seconds at 100% efficiency.
// Each recipe belongs to one machine family.

export const RECIPES = {
  // --- furnace ---
  smelt_iron:    { machine: 'furnace',   name: 'Smelt Iron',        in: { iron_ore: 2, coal: 1 },              out: { iron_plate: 1 }, time: 3.0 },
  smelt_copper:  { machine: 'furnace',   name: 'Smelt Copper',      in: { copper_ore: 2, coal: 1 },            out: { copper_plate: 1 }, time: 3.0 },
  make_steel:    { machine: 'furnace',   name: 'Cast Steel',        in: { iron_plate: 3, coal: 2 },            out: { steel: 1 }, time: 5.5, tech: 'steelmaking' },
  make_glass:    { machine: 'furnace',   name: 'Melt Glass',        in: { sand: 3, coal: 1 },                  out: { glass: 1 }, time: 4.0, tech: 'steelmaking' },
  make_alu:      { machine: 'furnace',   name: 'Refine Aluminium',  in: { stone: 4, chemicals: 1, coal: 2 },   out: { aluminum: 1 }, time: 6.5, tech: 'light_metals' },
  make_alloy:    { machine: 'furnace',   name: 'Forge Alloy',       in: { steel: 2, aluminum: 2, chemicals: 1 },out: { alloy: 1 }, time: 9.0, tech: 'metallurgy' },

  // --- press ---
  press_gear:    { machine: 'press',     name: 'Stamp Gears',       in: { iron_plate: 2 },                     out: { gear: 1 }, time: 2.4 },
  press_part:    { machine: 'press',     name: 'Press Metal Part',  in: { steel: 1, iron_plate: 1 },           out: { metal_part: 1 }, time: 3.6, tech: 'steelmaking' },
  press_frame:   { machine: 'press',     name: 'Form Frame',        in: { steel: 3, metal_part: 1 },           out: { frame: 1 }, time: 6.0, tech: 'heavy_industry' },
  press_ind:     { machine: 'press',     name: 'Industrial Part',   in: { metal_part: 2, alloy: 1 },           out: { ind_part: 1 }, time: 7.5, tech: 'metallurgy' },

  // --- cutter ---
  cut_planks:    { machine: 'cutter',    name: 'Cut Planks',        in: { wood: 2 },                           out: { tool_kit: 0 , plank: 0 }, time: 2, hidden: true },
  cut_wire:      { machine: 'cutter',    name: 'Draw Wire',         in: { copper_plate: 1 },                   out: { wire: 2 }, time: 2.0 },
  cut_sand:      { machine: 'cutter',    name: 'Crush to Sand',     in: { stone: 2 },                          out: { sand: 3 }, time: 1.8 },
  cut_precision: { machine: 'cutter',    name: 'Machine Precision',  in: { alloy: 1, adv_circuit: 1 },         out: { precision: 1 }, time: 11.0, tech: 'precision_eng' },

  // --- chemical ---
  chem_basic:    { machine: 'chemical',  name: 'Basic Chemicals',   in: { water: 2, coal: 1 },                 out: { chemicals: 2 }, time: 4.0, tech: 'chemistry' },
  chem_plastic:  { machine: 'chemical',  name: 'Polymerise',        in: { crude_oil: 2, chemicals: 1 },        out: { plastic: 3 }, time: 5.0, tech: 'chemistry' },
  chem_oil:      { machine: 'chemical',  name: 'Synthesise Oil',    in: { coal: 3, water: 2 },                 out: { crude_oil: 2 }, time: 5.5, tech: 'chemistry' },

  // --- assembler ---
  asm_circuit:   { machine: 'assembler', name: 'Assemble Circuit',  in: { wire: 3, iron_plate: 1 },            out: { circuit: 1 }, time: 3.2 },
  asm_toolkit:   { machine: 'assembler', name: 'Build Tool Kit',    in: { gear: 2, iron_plate: 2, wood: 1 },   out: { tool_kit: 1 }, time: 4.5 },
  asm_motor:     { machine: 'assembler', name: 'Wind Motor',        in: { gear: 2, wire: 4, steel: 1 },        out: { motor: 1 }, time: 6.0, tech: 'electrification' },
  asm_pump:      { machine: 'assembler', name: 'Build Pump',        in: { motor: 1, metal_part: 2, gear: 2 },  out: { pump: 1 }, time: 8.0, tech: 'electrification' },
  asm_advcirc:   { machine: 'assembler', name: 'Advanced Circuit',  in: { circuit: 2, plastic: 2, glass: 1 },  out: { adv_circuit: 1 }, time: 8.5, tech: 'electronics' },
  asm_engine:    { machine: 'assembler', name: 'Build Engine',      in: { frame: 1, motor: 2, ind_part: 1 },   out: { engine: 1 }, time: 12.0, tech: 'heavy_industry' },
  asm_appliance: { machine: 'assembler', name: 'Smart Appliance',   in: { adv_circuit: 1, motor: 1, plastic: 3, glass: 1 }, out: { appliance: 1 }, time: 13.0, tech: 'electronics' },

  // --- robotics ---
  rob_arm:       { machine: 'robotics',  name: 'Robotic Arm Unit',  in: { precision: 1, motor: 2, adv_circuit: 1 }, out: { robo_part: 1 }, time: 14.0, tech: 'robotics' },
  rob_drone:     { machine: 'robotics',  name: 'Logistics Drone',   in: { robo_part: 1, aluminum: 2, adv_circuit: 2 }, out: { drone: 1 }, time: 18.0, tech: 'robotics' },
  rob_robot:     { machine: 'robotics',  name: 'Assembly Robot',    in: { robo_part: 2, frame: 1, precision: 2 }, out: { robot: 1 }, time: 24.0, tech: 'automation_ai' },
  rob_ai:        { machine: 'robotics',  name: 'Autonomy Core',     in: { robot: 1, precision: 3, adv_circuit: 4 }, out: { ai_core: 1 }, time: 34.0, tech: 'automation_ai' },

  // --- packaging (adds value, prepares for sale) ---
  pack_small:    { machine: 'packager',  name: 'Package Goods',     in: { tool_kit: 2, wood: 1 },              out: { tool_kit: 2 }, time: 3.0, valueBoost: 1.35, tech: 'logistics_ii' },
  pack_large:    { machine: 'packager',  name: 'Crate Machinery',   in: { engine: 1, wood: 2 },                out: { engine: 1 }, time: 5.0, valueBoost: 1.4, tech: 'logistics_ii' },

  // --- recycling ---
  rec_scrap:     { machine: 'recycler',  name: 'Reclaim Scrap',     in: { metal_part: 1 },                     out: { iron_plate: 2 }, time: 3.0, tech: 'recycling' },
  rec_circuit:   { machine: 'recycler',  name: 'Recover Metals',    in: { circuit: 1 },                        out: { copper_plate: 2 }, time: 3.5, tech: 'recycling' },

  // --- miner (extracts from the node beneath it) ---
  mine_node:     { machine: 'miner',     name: 'Extract Ore',       in: {}, out: {}, time: 2.4, auto: true },
  pump_water:    { machine: 'waterpump', name: 'Pump Water',        in: {}, out: { water: 2 }, time: 2.0 },
};

for (const [id, r] of Object.entries(RECIPES)) r.id = id;
delete RECIPES.cut_planks; // reserved slot, not shipped

export function recipesFor(machineId, unlockedTech) {
  return Object.values(RECIPES).filter((r) => r.machine === machineId && !r.auto &&
    (!r.tech || unlockedTech.has(r.tech)));
}
