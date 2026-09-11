"""Every material and product. `art` drives the procedural icon."""
from ..art import palette as P

ITEMS = {
    # ---- raw ----
    'wood':        dict(name='Wood',             tier=0, value=3,    cat='raw',   art=dict(kind='log',  a=(138, 98, 52),  b=(199, 154, 92))),
    'stone':       dict(name='Stone',            tier=0, value=3,    cat='raw',   art=dict(kind='rock', a=P.ROCK,         b=P.ROCK_HI)),
    'iron_ore':    dict(name='Iron Ore',         tier=0, value=6,    cat='raw',   art=dict(kind='ore',  a=(107, 101, 96), b=(160, 138, 118), fleck=(216, 194, 160))),
    'copper_ore':  dict(name='Copper Ore',       tier=0, value=7,    cat='raw',   art=dict(kind='ore',  a=(106, 74, 51),  b=P.COPPER,        fleck=P.COPPER_HI)),
    'coal':        dict(name='Coal',             tier=0, value=5,    cat='raw',   art=dict(kind='ore',  a=(30, 30, 34),   b=(58, 58, 66),    fleck=(106, 106, 120))),
    'sand':        dict(name='Sand',             tier=0, value=2,    cat='raw',   art=dict(kind='grain', a=(176, 149, 97), b=P.SAND)),
    'water':       dict(name='Water',            tier=0, value=1,    cat='fluid', art=dict(kind='fluid', a=P.WATER_DEEP,  b=P.WATER_HI)),
    'crude_oil':   dict(name='Crude Oil',        tier=1, value=12,   cat='fluid', art=dict(kind='fluid', a=(21, 21, 26),  b=(61, 52, 72))),

    # ---- intermediate ----
    'iron_plate':  dict(name='Iron Plate',       tier=1, value=16,   cat='mat',   art=dict(kind='plate', a=(110, 116, 128), b=(168, 176, 186))),
    'copper_plate':dict(name='Copper Plate',     tier=1, value=18,   cat='mat',   art=dict(kind='plate', a=P.COPPER_LO,   b=P.COPPER_HI)),
    'steel':       dict(name='Steel Ingot',      tier=2, value=46,   cat='mat',   art=dict(kind='ingot', a=(86, 94, 105), b=(195, 204, 214))),
    'glass':       dict(name='Glass Sheet',      tier=2, value=30,   cat='mat',   art=dict(kind='sheet', a=P.GLASS_LO,    b=P.GLASS)),
    'aluminum':    dict(name='Aluminium',        tier=2, value=52,   cat='mat',   art=dict(kind='ingot', a=(142, 154, 164), b=(226, 236, 242))),
    'plastic':     dict(name='Plastic Pellets',  tier=2, value=34,   cat='mat',   art=dict(kind='grain', a=(156, 110, 168), b=(213, 168, 221))),
    'chemicals':   dict(name='Chemicals',        tier=2, value=40,   cat='fluid', art=dict(kind='fluid', a=(44, 92, 58),  b=(127, 208, 138))),
    'alloy':       dict(name='Advanced Alloy',   tier=3, value=210,  cat='mat',   art=dict(kind='ingot', a=(74, 66, 88),  b=(182, 168, 216))),

    # ---- components ----
    'gear':        dict(name='Iron Gear',        tier=1, value=42,   cat='part',  art=dict(kind='gear',  a=(94, 101, 112), b=(170, 178, 188))),
    'metal_part':  dict(name='Metal Part',       tier=2, value=96,   cat='part',  art=dict(kind='bracket', a=(90, 98, 112), b=(154, 164, 176))),
    'wire':        dict(name='Copper Wire',      tier=1, value=30,   cat='part',  art=dict(kind='coil',  a=P.COPPER_LO,   b=P.COPPER_HI)),
    'circuit':     dict(name='Circuit Board',    tier=2, value=130,  cat='part',  art=dict(kind='board', a=(30, 74, 48),  b=(63, 138, 86), fleck=P.GOLD)),
    'frame':       dict(name='Steel Frame',      tier=3, value=260,  cat='part',  art=dict(kind='frame', a=(78, 85, 96),  b=(152, 162, 174))),
    'motor':       dict(name='Electric Motor',   tier=3, value=340,  cat='part',  art=dict(kind='motor', a=(59, 68, 80),  b=P.COPPER)),
    'ind_part':    dict(name='Industrial Part',  tier=3, value=420,  cat='part',  art=dict(kind='bracket', a=(74, 64, 56), b=P.BRASS)),
    'adv_circuit': dict(name='Advanced Circuit', tier=4, value=720,  cat='part',  art=dict(kind='board', a=(42, 30, 70),  b=(106, 82, 176), fleck=(255, 217, 122))),
    'robo_part':   dict(name='Robotic Arm Unit', tier=4, value=1150, cat='part',  art=dict(kind='arm',   a=(60, 68, 80),  b=P.ORANGE)),
    'precision':   dict(name='Precision Module', tier=4, value=1480, cat='part',  art=dict(kind='module', a=(46, 58, 68), b=P.GLASS)),

    # ---- sellable products ----
    'tool_kit':    dict(name='Tool Kit',         tier=1, value=150,  cat='product', art=dict(kind='crate', a=(107, 74, 38), b=P.ORANGE)),
    'pump':        dict(name='Industrial Pump',  tier=2, value=470,  cat='product', art=dict(kind='crate', a=(51, 80, 107), b=P.BLUE_HI)),
    'engine':      dict(name='Combustion Engine', tier=3, value=1250, cat='product', art=dict(kind='crate', a=(90, 58, 42), b=P.RED_HI)),
    'appliance':   dict(name='Smart Appliance',  tier=3, value=1620, cat='product', art=dict(kind='crate', a=(58, 90, 68), b=P.GREEN_HI)),
    'drone':       dict(name='Logistics Drone',  tier=4, value=3400, cat='product', art=dict(kind='crate', a=(70, 58, 90), b=(168, 138, 224))),
    'robot':       dict(name='Assembly Robot',   tier=5, value=7800, cat='product', art=dict(kind='crate', a=(46, 61, 74), b=P.GLOW_COLD)),
    'ai_core':     dict(name='Autonomy Core',    tier=5, value=15600, cat='product', art=dict(kind='crate', a=(30, 44, 58), b=(126, 240, 208))),
}

for _id, _it in ITEMS.items():
    _it['id'] = _id


def item_name(item_id):
    it = ITEMS.get(item_id)
    return it['name'] if it else item_id


def item_value(item_id):
    it = ITEMS.get(item_id)
    return it['value'] if it else 1


def is_fluid(item_id):
    it = ITEMS.get(item_id)
    return bool(it) and it['cat'] == 'fluid'
