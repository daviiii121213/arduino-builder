"""Technology tree. Cost is research points; col/row place the node on screen."""

TECHS = {
    'steelmaking':    dict(name='Steelmaking', cost=60, col=0, row=1, req=[],
                           desc='Cast steel and melt glass in your furnaces. Unlocks pressed metal parts.'),
    'electrification': dict(name='Electrification', cost=120, col=1, row=0, req=['steelmaking'],
                            desc='Motors, solar arrays and powered pumps.'),
    'logistics_ii':   dict(name='Logistics II', cost=150, col=1, row=2, req=['steelmaking'],
                           desc='Fast belts, warehouses and the packaging line.'),
    'chemistry':      dict(name='Industrial Chemistry', cost=260, col=2, row=1, req=['electrification'],
                           desc='Chemical plants, pipes, oil and plastics.'),
    'heavy_industry': dict(name='Heavy Industry', cost=420, col=2, row=3, req=['logistics_ii'],
                           desc='Deep drills, steel frames, engines and steam turbines.'),
    'electronics':    dict(name='Electronics', cost=560, col=3, row=0, req=['chemistry'],
                           desc='Advanced circuits and smart appliances.'),
    'light_metals':   dict(name='Light Metals', cost=500, col=3, row=2, req=['chemistry'],
                           desc='Aluminium refining for lightweight products.'),
    'recycling':      dict(name='Recycling', cost=380, col=3, row=4, req=['heavy_industry'],
                           desc='Reclaim scrap into usable stock. Cuts material costs.'),
    'metallurgy':     dict(name='Advanced Metallurgy', cost=900, col=4, row=2, req=['light_metals', 'heavy_industry'],
                           desc='Advanced alloys and industrial parts.'),
    'precision_eng':  dict(name='Precision Engineering', cost=1300, col=4, row=0, req=['electronics'],
                           desc='Precision modules machined to the micron.'),
    'robotics':       dict(name='Robotics', cost=2100, col=5, row=1, req=['precision_eng', 'metallurgy'],
                           desc='Robotic assemblers, arm units and logistics drones.'),
    'automation_ai':  dict(name='Autonomous Systems', cost=4200, col=6, row=1, req=['robotics'],
                           desc='Fusion power, assembly robots and the autonomy core.'),
}

for _id, _t in TECHS.items():
    _t['id'] = _id


def available(unlocked):
    return [t for t in TECHS.values()
            if t['id'] not in unlocked and all(r in unlocked for r in t['req'])]
