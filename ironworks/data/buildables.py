"""Everything the player can place.

`kind` selects the simulation behaviour, and the id selects the sprite painter in
ironworks/art/machines.py.
"""

BUILDABLES = {
    # ================= LOGISTICS =================
    'belt':       dict(name='Conveyor Belt', kind='belt', w=1, h=1, cost=28, cat='logistics', power=0.4, speed=1.6,
                       desc='Moves items one tile at a time. Pulls from machine outputs, feeds machine inputs.'),
    'belt_fast':  dict(name='Fast Conveyor', kind='belt', w=1, h=1, cost=120, cat='logistics', power=0.9, speed=3.2,
                       tech='logistics_ii', desc='Double-speed belt for high throughput lines.'),
    'pipe':       dict(name='Pipe', kind='pipe', w=1, h=1, cost=22, cat='logistics', power=0, tech='chemistry',
                       desc='Carries fluids between pumps, chemical plants and boilers.'),
    'cable':      dict(name='Power Cable', kind='cable', w=1, h=1, cost=14, cat='logistics', power=0,
                       desc='Links generators to machines. Machines must touch a powered cable.'),
    'chest':      dict(name='Storage Crate', kind='store', w=1, h=1, cost=60, cat='logistics', power=0, capacity=240,
                       desc='Buffers items. Belts fill it and draw from it.'),
    'warehouse':  dict(name='Warehouse', kind='store', w=4, h=3, cost=1400, cat='logistics', power=1.5, capacity=4000,
                       tech='logistics_ii', desc='Huge buffered storage with a covered loading floor.'),
    'dock':       dict(name='Loading Dock', kind='dock', w=3, h=2, cost=520, cat='logistics', power=1,
                       desc='Trucks collect anything delivered here and the market pays you for it.'),

    # ================= EXTRACTION =================
    'miner':      dict(name='Mining Drill', kind='miner', w=2, h=2, cost=220, cat='machine', power=3,
                       desc='Extracts ore from the deposit underneath it. Place on a resource patch.'),
    'miner_adv':  dict(name='Deep Drill', kind='miner', w=2, h=2, cost=1900, cat='machine', power=9, rate=2.6,
                       tech='heavy_industry', desc='Heavy rotary drill. Far higher yield per cycle.'),
    'waterpump':  dict(name='Water Pump', kind='machine', w=2, h=2, cost=180, cat='machine', power=2, tech='chemistry',
                       desc='Draws water from a river or lake tile it touches.'),

    # ================= PROCESSING =================
    'furnace':    dict(name='Furnace', kind='machine', w=2, h=2, cost=260, cat='machine', power=4,
                       desc='Smelts ore into plates and ingots. Runs hot - watch the temperature gauge.'),
    'press':      dict(name='Industrial Press', kind='machine', w=2, h=2, cost=380, cat='machine', power=5,
                       desc='Stamps plates into gears, parts and frames.'),
    'cutter':     dict(name='Cutting Machine', kind='machine', w=2, h=2, cost=340, cat='machine', power=4.5,
                       desc='Saws, crushes and draws material into finer stock.'),
    'assembler':  dict(name='Assembly Machine', kind='machine', w=3, h=2, cost=720, cat='machine', power=7,
                       desc='Combines components into finished goods.'),
    'chemical':   dict(name='Chemical Plant', kind='machine', w=3, h=3, cost=1100, cat='machine', power=9,
                       tech='chemistry', desc='Reactor vessels for chemicals, oil and polymers.'),
    'packager':   dict(name='Packaging Line', kind='machine', w=3, h=2, cost=860, cat='machine', power=5,
                       tech='logistics_ii', desc='Crates finished goods, raising their market value.'),
    'recycler':   dict(name='Recycling Unit', kind='machine', w=2, h=2, cost=640, cat='machine', power=6,
                       tech='recycling', desc='Breaks scrap back down into usable stock.'),
    'robotics':   dict(name='Robotic Assembler', kind='machine', w=3, h=3, cost=4200, cat='machine', power=16,
                       tech='robotics', desc='Multi-arm robotic cell for high-tech manufacturing.'),

    # ================= POWER & UTILITIES =================
    'coal_gen':   dict(name='Coal Generator', kind='gen', w=3, h=2, cost=420, cat='power', output=18, fuel='coal',
                       burn_time=14, desc='Burns coal to make electricity. Smoky, cheap, reliable.'),
    'solar':      dict(name='Solar Array', kind='gen', w=2, h=2, cost=900, cat='power', output=7, solar=True,
                       tech='electrification', desc='Silent daytime power. Output falls at night.'),
    'turbine':    dict(name='Steam Turbine', kind='gen', w=3, h=3, cost=3600, cat='power', output=70, fuel='coal',
                       burn_time=10, tech='heavy_industry',
                       desc='High-output turbine hall. Needs coal and piped water.'),
    'fusion':     dict(name='Fusion Reactor', kind='gen', w=4, h=4, cost=26000, cat='power', output=400,
                       tech='automation_ai', desc='Clean, enormous, endgame power.'),
    'lamp':       dict(name='Industrial Lamp', kind='lamp', w=1, h=1, cost=45, cat='power', power=0.3,
                       desc='Lights the factory floor at night. Workers move faster in lit areas.'),

    # ================= STRUCTURES =================
    'floor':      dict(name='Concrete Floor', kind='floor', w=1, h=1, cost=10, cat='struct',
                       desc='Clean industrial flooring. Walking on it is faster than mud.'),
    'wall':       dict(name='Factory Wall', kind='struct', w=1, h=1, cost=32, cat='struct', solid=True,
                       desc='Corrugated steel wall panel.'),
    'door':       dict(name='Industrial Door', kind='struct', w=1, h=1, cost=90, cat='struct',
                       desc='Roller door. Opens as you approach.'),
    'window':     dict(name='Factory Window', kind='struct', w=1, h=1, cost=70, cat='struct', solid=True,
                       desc='Reinforced glazing panel.'),
    'office':     dict(name='Office', kind='service', w=3, h=3, cost=1600, cat='struct', power=2, service='office',
                       desc='Cuts operating costs by 12% and improves sale prices.'),
    'breakroom':  dict(name='Break Room', kind='service', w=3, h=2, cost=900, cat='struct', power=1.5, service='breakroom',
                       desc='Workers rest here. Rested workers work 25% faster.'),
    'lab':        dict(name='Research Lab', kind='lab', w=3, h=3, cost=2200, cat='struct', power=8,
                       desc='Generates research points so the tech tree can advance.'),
    'maintenance': dict(name='Maintenance Bay', kind='service', w=3, h=2, cost=1300, cat='struct', power=3,
                        service='maintenance', desc='Slows machine wear factory-wide and speeds repairs.'),
}

for _id, _b in BUILDABLES.items():
    _b['id'] = _id
    _b.setdefault('power', 0)
    _b.setdefault('tech', None)
    _b.setdefault('output', 0)
    _b.setdefault('fuel', None)
    _b.setdefault('solar', False)
    _b.setdefault('service', None)
    _b.setdefault('capacity', 100)
    _b.setdefault('speed', 1.6)
    _b.setdefault('rate', 1.0)
    _b.setdefault('burn_time', 10)
    _b.setdefault('solid', False)

CATEGORIES = [
    ('logistics', 'Logistics'),
    ('machine', 'Machines'),
    ('power', 'Power'),
    ('struct', 'Structures'),
]


def buildables_for(cat, unlocked_tech):
    return [b for b in BUILDABLES.values()
            if b['cat'] == cat and (b['tech'] is None or b['tech'] in unlocked_tech)]
