"""Production recipes. `time` is seconds per cycle at 100% efficiency."""

RECIPES = {
    # --- furnace ---
    'smelt_iron':   dict(machine='furnace', name='Smelt Iron',       inp={'iron_ore': 2, 'coal': 1},                   out={'iron_plate': 1},  time=3.0),
    'smelt_copper': dict(machine='furnace', name='Smelt Copper',     inp={'copper_ore': 2, 'coal': 1},                 out={'copper_plate': 1}, time=3.0),
    'make_steel':   dict(machine='furnace', name='Cast Steel',       inp={'iron_plate': 3, 'coal': 2},                 out={'steel': 1},       time=5.5, tech='steelmaking'),
    'make_glass':   dict(machine='furnace', name='Melt Glass',       inp={'sand': 3, 'coal': 1},                       out={'glass': 1},       time=4.0, tech='steelmaking'),
    'make_alu':     dict(machine='furnace', name='Refine Aluminium', inp={'stone': 4, 'chemicals': 1, 'coal': 2},      out={'aluminum': 1},    time=6.5, tech='light_metals'),
    'make_alloy':   dict(machine='furnace', name='Forge Alloy',      inp={'steel': 2, 'aluminum': 2, 'chemicals': 1},  out={'alloy': 1},       time=9.0, tech='metallurgy'),

    # --- press ---
    'press_gear':   dict(machine='press', name='Stamp Gears',        inp={'iron_plate': 2},                            out={'gear': 1},        time=2.4),
    'press_part':   dict(machine='press', name='Press Metal Part',   inp={'steel': 1, 'iron_plate': 1},                out={'metal_part': 1},  time=3.6, tech='steelmaking'),
    'press_frame':  dict(machine='press', name='Form Frame',         inp={'steel': 3, 'metal_part': 1},                out={'frame': 1},       time=6.0, tech='heavy_industry'),
    'press_ind':    dict(machine='press', name='Industrial Part',    inp={'metal_part': 2, 'alloy': 1},                out={'ind_part': 1},    time=7.5, tech='metallurgy'),

    # --- cutter ---
    'cut_wire':     dict(machine='cutter', name='Draw Wire',         inp={'copper_plate': 1},                          out={'wire': 2},        time=2.0),
    'cut_sand':     dict(machine='cutter', name='Crush to Sand',     inp={'stone': 2},                                 out={'sand': 3},        time=1.8),
    'cut_precision': dict(machine='cutter', name='Machine Precision', inp={'alloy': 1, 'adv_circuit': 1},              out={'precision': 1},   time=11.0, tech='precision_eng'),

    # --- chemical ---
    'chem_basic':   dict(machine='chemical', name='Basic Chemicals', inp={'water': 2, 'coal': 1},                      out={'chemicals': 2},   time=4.0, tech='chemistry'),
    'chem_plastic': dict(machine='chemical', name='Polymerise',      inp={'crude_oil': 2, 'chemicals': 1},             out={'plastic': 3},     time=5.0, tech='chemistry'),
    'chem_oil':     dict(machine='chemical', name='Synthesise Oil',  inp={'coal': 3, 'water': 2},                      out={'crude_oil': 2},   time=5.5, tech='chemistry'),

    # --- assembler ---
    'asm_circuit':  dict(machine='assembler', name='Assemble Circuit', inp={'wire': 3, 'iron_plate': 1},               out={'circuit': 1},     time=3.2),
    'asm_toolkit':  dict(machine='assembler', name='Build Tool Kit',   inp={'gear': 2, 'iron_plate': 2, 'wood': 1},    out={'tool_kit': 1},    time=4.5),
    'asm_motor':    dict(machine='assembler', name='Wind Motor',       inp={'gear': 2, 'wire': 4, 'steel': 1},         out={'motor': 1},       time=6.0, tech='electrification'),
    'asm_pump':     dict(machine='assembler', name='Build Pump',       inp={'motor': 1, 'metal_part': 2, 'gear': 2},   out={'pump': 1},        time=8.0, tech='electrification'),
    'asm_advcirc':  dict(machine='assembler', name='Advanced Circuit', inp={'circuit': 2, 'plastic': 2, 'glass': 1},   out={'adv_circuit': 1}, time=8.5, tech='electronics'),
    'asm_engine':   dict(machine='assembler', name='Build Engine',     inp={'frame': 1, 'motor': 2, 'ind_part': 1},    out={'engine': 1},      time=12.0, tech='heavy_industry'),
    'asm_appliance': dict(machine='assembler', name='Smart Appliance', inp={'adv_circuit': 1, 'motor': 1, 'plastic': 3, 'glass': 1}, out={'appliance': 1}, time=13.0, tech='electronics'),

    # --- robotics ---
    'rob_arm':      dict(machine='robotics', name='Robotic Arm Unit', inp={'precision': 1, 'motor': 2, 'adv_circuit': 1}, out={'robo_part': 1}, time=14.0, tech='robotics'),
    'rob_drone':    dict(machine='robotics', name='Logistics Drone',  inp={'robo_part': 1, 'aluminum': 2, 'adv_circuit': 2}, out={'drone': 1}, time=18.0, tech='robotics'),
    'rob_robot':    dict(machine='robotics', name='Assembly Robot',   inp={'robo_part': 2, 'frame': 1, 'precision': 2}, out={'robot': 1},     time=24.0, tech='automation_ai'),
    'rob_ai':       dict(machine='robotics', name='Autonomy Core',    inp={'robot': 1, 'precision': 3, 'adv_circuit': 4}, out={'ai_core': 1}, time=34.0, tech='automation_ai'),

    # --- packaging (raises market value) ---
    'pack_small':   dict(machine='packager', name='Package Goods',    inp={'tool_kit': 2, 'wood': 1},                  out={'tool_kit': 2},    time=3.0, value_boost=1.35, tech='logistics_ii'),
    'pack_large':   dict(machine='packager', name='Crate Machinery',  inp={'engine': 1, 'wood': 2},                    out={'engine': 1},      time=5.0, value_boost=1.4, tech='logistics_ii'),

    # --- recycling ---
    'rec_scrap':    dict(machine='recycler', name='Reclaim Scrap',    inp={'metal_part': 1},                           out={'iron_plate': 2},  time=3.0, tech='recycling'),
    'rec_circuit':  dict(machine='recycler', name='Recover Metals',   inp={'circuit': 1},                              out={'copper_plate': 2}, time=3.5, tech='recycling'),

    # --- automatic ---
    'mine_node':    dict(machine='miner', name='Extract Ore',         inp={}, out={},                                  time=2.4, auto=True),
    'pump_water':   dict(machine='waterpump', name='Pump Water',      inp={}, out={'water': 2},                        time=2.0),
}

for _id, _r in RECIPES.items():
    _r['id'] = _id
    _r.setdefault('tech', None)
    _r.setdefault('auto', False)
    _r.setdefault('value_boost', None)


def recipes_for(machine_id, unlocked_tech):
    return [r for r in RECIPES.values()
            if r['machine'] == machine_id and not r['auto']
            and (r['tech'] is None or r['tech'] in unlocked_tech)]
