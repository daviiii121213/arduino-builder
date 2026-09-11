"""One shared colour language: warm rusted industrial orange against cold
blue-grey steel, on desaturated earth. Colours are plain (r, g, b) tuples.
"""


def _h(s):
    return (int(s[1:3], 16), int(s[3:5], 16), int(s[5:7], 16))


# steel / machine bodies
STEEL_HI = _h('#b9c2cb'); STEEL = _h('#7d8792'); STEEL_MID = _h('#636d78')
STEEL_LO = _h('#434b55'); STEEL_DARK = _h('#2c323a')
IRON = _h('#6e6a66'); IRON_LO = _h('#4a4744'); IRON_DARK = _h('#2a2826')

# painted industrial surfaces
ORANGE = _h('#d4762a'); ORANGE_HI = _h('#f0a352'); ORANGE_LO = _h('#8c4616')
YELLOW = _h('#e0b53c'); YELLOW_HI = _h('#f6d878'); YELLOW_LO = _h('#8f6c12')
GREEN = _h('#4f8b5a'); GREEN_HI = _h('#7cb986'); GREEN_LO = _h('#2c5433')
BLUE = _h('#3c6c96'); BLUE_HI = _h('#6a9cc4'); BLUE_LO = _h('#20415e')
RED = _h('#a63a2e'); RED_HI = _h('#d46354'); RED_LO = _h('#5e1d16')

# materials
COPPER = _h('#c47a3d'); COPPER_HI = _h('#e8a76a'); COPPER_LO = _h('#7d4519')
BRASS = _h('#c9a544'); GOLD = _h('#e8c25a')
RUST = _h('#8a4a22'); RUST_LO = _h('#5a2d12')
GLASS = _h('#8fd4e8'); GLASS_LO = _h('#2f6b7d')
RUBBER = _h('#2b2b30'); RUBBER_HI = _h('#45454d')
CONCRETE = _h('#8e8a80'); CONCRETE_HI = _h('#a9a59a'); CONCRETE_LO = _h('#5d5a53')

# world
GRASS = _h('#5d7a3c'); GRASS_HI = _h('#78964d'); GRASS_LO = _h('#41582a')
DIRT = _h('#7a6144'); DIRT_HI = _h('#93764f'); DIRT_LO = _h('#54412c')
ROCK = _h('#6b6a68'); ROCK_HI = _h('#8a8886'); ROCK_LO = _h('#45443f')
SAND = _h('#c2a973'); WATER = _h('#2e5d78'); WATER_HI = _h('#4d87a3')
WATER_DEEP = _h('#1b3b52')
TREE = _h('#3c6136'); TREE_HI = _h('#54803f'); TREE_LO = _h('#24401f')
ROAD = _h('#4a4844'); ROAD_HI = _h('#5e5b56')

# light & fx
GLOW_WARM = _h('#ffbb55'); GLOW_HOT = _h('#ff6a1e'); GLOW_COLD = _h('#8fdcff')
SPARK = _h('#ffe9a8'); SMOKE = _h('#7a7671'); STEAM = _h('#cfd8dd')

# ui
UI_BG = _h('#191d22'); UI_BG2 = _h('#23282f'); UI_PANEL = _h('#2b313a')
UI_EDGE = _h('#0d0f12'); UI_TRIM = _h('#c08a3a'); UI_TRIM_HI = _h('#e8b661')
UI_TEXT = _h('#e8e2d4'); UI_DIM = _h('#98917f')
UI_GOOD = _h('#7cc07a'); UI_WARN = _h('#e0b53c'); UI_BAD = _h('#d4604e')

BLACK = (0, 0, 0)
WHITE = (255, 255, 255)


def mix(a, b, t):
    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
    return (int(a[0] + (b[0] - a[0]) * t),
            int(a[1] + (b[1] - a[1]) * t),
            int(a[2] + (b[2] - a[2]) * t))


def shade(c, amt):
    """amt > 0 lightens toward white, amt < 0 darkens toward black."""
    return mix(c, WHITE if amt > 0 else BLACK, abs(amt))


def rgba(c, a):
    return (c[0], c[1], c[2], int(max(0, min(255, a * 255)) if a <= 1 else a))
