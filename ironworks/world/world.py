"""Procedural overworld: a factory plot surrounded by forest, mountains, a mining
valley, a river with a port, a highway and a small city. Tiles are 32px.
"""
import math

from ..core.rng import Rng, Noise2D
from ..core.utils import clamp

TILE = 32

GRASS, DIRT, ROCK, WATER, SAND, ROAD, CONCRETE, FOREST, GRAVEL, DEEP = range(10)

NODE_TYPES = {
    'iron_ore':   dict(rich=4200),
    'copper_ore': dict(rich=3400),
    'coal':       dict(rich=5200),
    'stone':      dict(rich=6000),
    'sand':       dict(rich=5000),
}


class Node:
    __slots__ = ('type', 'amount', 'max', 'x', 'y')

    def __init__(self, type_, amount, x, y):
        self.type = type_
        self.amount = amount
        self.max = amount
        self.x = x
        self.y = y


class Prop:
    __slots__ = ('type', 'x', 'y', 'seed', 'solid', 'r', 'label', 'hp')

    def __init__(self, type_, x, y, seed, solid=False, r=0.35, label=None):
        self.type = type_
        self.x = x
        self.y = y
        self.seed = seed
        self.solid = solid
        self.r = r
        self.label = label
        self.hp = 3


class World:
    def __init__(self, seed=20260911):
        self.seed = seed
        self.W = 240
        self.H = 240
        self.tiles = bytearray(self.W * self.H)
        self.variant = bytearray(self.W * self.H)
        self.nodes = {}
        self.props = []
        self._prop_grid = {}      # (cx, cy) -> [solid props]  - collision lookup
        self.regions = []
        self.plot = dict(x=100, y=104, w=40, h=34)
        self.generate()

    # ------------------------------------------------------------- queries
    def idx(self, x, y):
        return y * self.W + x

    def in_bounds(self, x, y):
        return 0 <= x < self.W and 0 <= y < self.H

    def tile(self, x, y):
        if 0 <= x < self.W and 0 <= y < self.H:
            return self.tiles[y * self.W + x]
        return DEEP

    def set_tile(self, x, y, t):
        if self.in_bounds(x, y):
            self.tiles[y * self.W + x] = t

    def node_at(self, x, y):
        return self.nodes.get((x, y))

    def is_water(self, x, y):
        return self.tile(x, y) in (WATER, DEEP)

    def solid_tile(self, x, y):
        return self.is_water(x, y) or not self.in_bounds(x, y)

    def in_plot(self, x, y):
        p = self.plot
        return p['x'] <= x < p['x'] + p['w'] and p['y'] <= y < p['y'] + p['h']

    def region_at(self, x, y):
        for r in self.regions:
            if r['x'] <= x < r['x'] + r['w'] and r['y'] <= y < r['y'] + r['h']:
                return r
        return None

    def mine_node(self, x, y, amount):
        n = self.nodes.get((x, y))
        if not n or n.amount <= 0:
            return 0
        got = min(amount, n.amount)
        n.amount -= got
        if n.amount <= 0:
            del self.nodes[(x, y)]
        return got

    PROP_CELL = 4      # tiles per collision cell

    def index_props(self):
        """Bucket solid props by cell so collision never walks the whole list."""
        self._prop_grid = {}
        c = self.PROP_CELL
        for p in self.props:
            if not p.solid:
                continue
            reach = (p.r or 0.35) + 1.0
            for cy in range(int((p.y - reach) // c), int((p.y + reach) // c) + 1):
                for cx in range(int((p.x - reach) // c), int((p.x + reach) // c) + 1):
                    self._prop_grid.setdefault((cx, cy), []).append(p)

    def remove_prop(self, p):
        if p in self.props:
            self.props.remove(p)
        if p.solid:
            self.index_props()

    def prop_solid_at(self, wx, wy, radius=0.28):
        c = self.PROP_CELL
        bucket = self._prop_grid.get((int(wx // c), int(wy // c)))
        if not bucket:
            return None
        for p in bucket:
            rr = (p.r or 0.35) + radius
            if (p.x - wx) ** 2 + (p.y + 0.25 - wy) ** 2 < rr * rr:
                return p
        return None

    # ------------------------------------------------------------- generation
    def generate(self):
        n1 = Noise2D(self.seed)
        n2 = Noise2D(self.seed ^ 0x9E3779B9)
        n3 = Noise2D(self.seed + 77)
        rnd = Rng(self.seed)
        W, H = self.W, self.H

        for y in range(H):
            row = y * W
            for x in range(W):
                e = n1.fbm(x / 46.0, y / 46.0, 5) * 0.72 + n2.fbm(x / 13.0, y / 13.0, 3) * 0.28
                m = n2.fbm(x / 60.0 + 40, y / 60.0 - 12, 4)
                if e > 0.665:
                    t = ROCK
                elif e > 0.60:
                    t = GRAVEL
                elif e < 0.365:
                    t = WATER
                elif e < 0.395:
                    t = SAND
                elif m > 0.58:
                    t = FOREST
                elif m < 0.40:
                    t = DIRT
                else:
                    t = GRASS
                self.tiles[row + x] = t
                self.variant[row + x] = int(n3.at(x * 1.7, y * 1.7) * 255) & 255

        # river running north-south through the east, widening into the port bay
        rx = 186.0
        for y in range(H):
            rx += (n1.at(y / 18.0, 3.3) - 0.5) * 2.6
            rx = clamp(rx, 168, 206)
            w_river = 3 + n2.at(y / 24.0, 9) * 4 + ((y - 150) * 0.09 if y > 150 else 0)
            d = -int(w_river)
            while d <= w_river:
                x = int(round(rx + d))
                if self.in_bounds(x, y):
                    if abs(d) > w_river - 1.2:
                        t = SAND
                    elif abs(d) < w_river * 0.45:
                        t = DEEP
                    else:
                        t = WATER
                    self.tiles[y * W + x] = t
                d += 1

        # mountain ridge to the south-west (the mine) and northern quarry hills
        for cx, cy, sx, sy in ((44, 186, 38, 30), (150, 34, 30, 22)):
            for y in range(H):
                for x in range(W):
                    d = math.hypot((x - cx) / sx, (y - cy) / sy)
                    if d < 1 and not self.is_water(x, y):
                        self.tiles[y * W + x] = ROCK if d < 0.6 else GRAVEL

        # the player's plot: flattened gravel yard with a concrete pad
        p = self.plot
        for y in range(p['y'] - 2, p['y'] + p['h'] + 2):
            for x in range(p['x'] - 2, p['x'] + p['w'] + 2):
                if self.in_bounds(x, y) and not self.is_water(x, y):
                    self.tiles[y * W + x] = GRAVEL
        for y in range(p['y'] + 2, p['y'] + 14):
            for x in range(p['x'] + 2, p['x'] + 18):
                self.tiles[y * W + x] = CONCRETE

        # roads
        self.road(p['x'] + 20, p['y'] - 2, p['x'] + 20, 6)
        self.road(p['x'] + 20, 14, 60, 14)
        self.road(60, 14, 60, 60)
        self.road(p['x'] - 2, p['y'] + 16, 62, p['y'] + 16)
        self.road(p['x'] + 20, p['y'] + p['h'] + 2, p['x'] + 20, 196)
        self.road(p['x'] + 20, 196, 62, 196)
        self.road(p['x'] + p['w'] + 2, p['y'] + 10, 176, p['y'] + 10)
        self.road(30, 30, 30, 90)
        self.road(30, 30, 92, 30)
        self.road(46, 30, 46, 72)
        self.road(30, 56, 92, 56)

        self.regions = [
            dict(name='Ironworks Plot', x=p['x'], y=p['y'], w=p['w'], h=p['h'], kind='home'),
            dict(name='Redhaven City', x=18, y=18, w=78, h=52, kind='city'),
            dict(name='Blackvein Mine', x=16, y=160, w=66, h=56, kind='mine'),
            dict(name='Pinehollow Forest', x=96, y=168, w=62, h=60, kind='forest'),
            dict(name='Northridge Quarry', x=124, y=12, w=56, h=46, kind='quarry'),
            dict(name='Saltwater Port', x=172, y=120, w=56, h=60, kind='port'),
            dict(name='Eastfield Highway', x=150, y=96, w=40, h=18, kind='road'),
        ]

        self.place_deposits(rnd)
        self.place_props(rnd)

    def road(self, x1, y1, x2, y2):
        steps = max(abs(x2 - x1), abs(y2 - y1))
        for i in range(steps + 1):
            x = int(round(x1 + (x2 - x1) * i / steps))
            y = int(round(y1 + (y2 - y1) * i / steps))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if self.in_bounds(x + dx, y + dy) and not self.is_water(x + dx, y + dy):
                        self.tiles[(y + dy) * self.W + (x + dx)] = ROAD

    def add_deposit(self, type_, cx, cy, radius, richness, rnd):
        for y in range(int(cy - radius), int(cy + radius) + 1):
            for x in range(int(cx - radius), int(cx + radius) + 1):
                if not self.in_bounds(x, y) or self.is_water(x, y):
                    continue
                d = math.hypot(x - cx, y - cy) / radius
                if d > 1 or rnd() < 0.22 + d * 0.5:
                    continue
                amount = int(richness * (1 - d * 0.65) * (0.7 + rnd() * 0.6))
                if amount < 40:
                    continue
                self.nodes[(x, y)] = Node(type_, amount, x, y)

    def place_deposits(self, rnd):
        p = self.plot
        # starter patches near the plot so the first hour is playable on foot
        self.add_deposit('iron_ore', p['x'] - 9, p['y'] + 8, 4.5, 2600, rnd)
        self.add_deposit('coal', p['x'] + 14, p['y'] + p['h'] + 7, 4.5, 3200, rnd)
        self.add_deposit('stone', p['x'] + p['w'] + 6, p['y'] + 22, 4, 3600, rnd)
        self.add_deposit('copper_ore', p['x'] - 12, p['y'] + 26, 4, 2200, rnd)
        for type_, x, y, r in (
                ('iron_ore', 40, 176, 9), ('iron_ore', 62, 198, 8), ('coal', 28, 196, 9),
                ('coal', 56, 170, 7), ('copper_ore', 46, 206, 8), ('copper_ore', 22, 172, 7),
                ('stone', 70, 184, 8), ('iron_ore', 146, 30, 9), ('stone', 162, 44, 8),
                ('copper_ore', 132, 22, 7), ('coal', 168, 26, 7), ('sand', 196, 150, 7),
                ('sand', 182, 96, 6)):
            self.add_deposit(type_, x, y, r, NODE_TYPES[type_]['rich'], rnd)

    def place_props(self, rnd):
        add = lambda t, x, y, **kw: self.props.append(Prop(t, x, y, int(rnd() * 1e9), **kw))

        for y in range(2, self.H - 2):
            for x in range(2, self.W - 2):
                if self.in_plot(x, y):
                    continue
                t = self.tile(x, y)
                if t == FOREST and rnd() < 0.34:
                    add('tree', x + rnd() * 0.6 - 0.3, y + rnd() * 0.6 - 0.3, solid=True, r=0.38)
                elif t == GRASS and rnd() < 0.045:
                    add('bush' if rnd() < 0.6 else 'tree', x + rnd() * 0.5, y + rnd() * 0.5,
                        solid=rnd() < 0.5, r=0.32)
                elif t == ROCK and rnd() < 0.14:
                    add('boulder', x + rnd() * 0.4, y + rnd() * 0.4, solid=True, r=0.42)
                elif t == GRAVEL and rnd() < 0.05:
                    add('rubble', x + rnd() * 0.5, y + rnd() * 0.5)
                elif t == SAND and rnd() < 0.03:
                    add('reed', x + rnd() * 0.5, y + rnd() * 0.5)
                elif t == DIRT and rnd() < 0.02:
                    add('grasstuft', x + rnd() * 0.5, y + rnd() * 0.5)

        # ---- city block ----
        for type_, x, y, label in (
                ('shop', 34, 26, 'Redhaven Supplies'), ('apartment', 40, 24, None),
                ('apartment', 52, 24, None), ('office_bldg', 58, 32, 'Meridian Freight'),
                ('shop', 34, 44, 'Tool Exchange'), ('apartment', 52, 44, None),
                ('factory_bldg', 70, 34, 'Kessler Works'), ('office_bldg', 36, 62, 'City Hall'),
                ('shop', 60, 62, 'Market Hall'), ('apartment', 74, 60, None),
                ('factory_bldg', 80, 22, 'Union Foundry')):
            add(type_, x, y, solid=True, r=2.2, label=label)
        for _ in range(46):
            x, y = 24 + rnd() * 66, 22 + rnd() * 46
            if self.tile(int(round(x)), int(round(y))) == ROAD:
                add('streetlight', x, y)

        # ---- port ----
        add('crane', 176, 138, solid=True, r=1.6)
        add('crane', 176, 152, solid=True, r=1.6)
        add('warehouse_bldg', 168, 130, solid=True, r=2.4, label='Port Authority')
        for _ in range(22):
            add('container', 160 + rnd() * 12, 126 + rnd() * 36, solid=True, r=0.7)
        add('ship', 196, 146, solid=True, r=3)

        # ---- mine camp ----
        add('mine_entrance', 40, 178, solid=True, r=1.4, label='Blackvein Adit')
        add('minecart', 44, 182)
        add('minecart', 37, 186)
        for _ in range(16):
            add('rubble', 30 + rnd() * 30, 170 + rnd() * 30)

        # ---- highway furniture ----
        for _ in range(30):
            x = 20 + rnd() * 200
            if self.tile(int(round(x)), 14) == ROAD:
                add('roadsign', x, 16.2)

        # ---- starting plot dressing ----
        p = self.plot
        add('signboard', p['x'] + 3, p['y'] + 1)
        add('barrel', p['x'] + 20, p['y'] + 5)
        add('barrel', p['x'] + 21.2, p['y'] + 5.4)
        add('pallet', p['x'] + 24, p['y'] + 8)
        add('pallet', p['x'] + 25.5, p['y'] + 9)

        self.props.sort(key=lambda pr: pr.y)
        self.index_props()
