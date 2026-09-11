"""Terrain tileset. Each terrain gets several painted variants so large areas
never tile visibly. Generated once at boot into cached surfaces.
"""
import math
import pygame

from ..core.rng import Rng
from ..core.utils import TAU
from ..world.world import (TILE, GRASS, DIRT, ROCK, WATER, SAND, ROAD,
                           CONCRETE, FOREST, GRAVEL, DEEP)
from . import draw as D
from . import palette as P
from .palette import mix, shade, rgba

VARIANTS = 4

TILE_AVG = {
    GRASS: P.GRASS, DIRT: P.DIRT, ROCK: P.ROCK,
    GRAVEL: mix(P.ROCK_LO, P.DIRT, 0.35), SAND: P.SAND, WATER: P.WATER,
    DEEP: P.WATER_DEEP, ROAD: P.ROAD, CONCRETE: P.CONCRETE, FOREST: P.GRASS_LO,
}


def _speckle(s, rnd, n, colors, size, w, h, alpha=0.5):
    for _ in range(n):
        c = colors[int(rnd() * len(colors)) % len(colors)]
        D.ellipse(s, rgba(c, 0.25 + rnd() * alpha), rnd() * w, rnd() * h,
                  max(1, size * (0.5 + rnd())), max(1, size * (0.4 + rnd() * 0.8)))


def _grass(s, w, h, k, rnd, dark=False):
    base = P.GRASS_LO if dark else P.GRASS
    s.fill(base)
    _speckle(s, rnd, 26, (P.GRASS_HI, P.GRASS_LO, mix(base, P.DIRT, 0.35)), 2.4 * k, w, h, 0.35)
    for _ in range(42):
        x, y = rnd() * w, rnd() * h
        ln = (2 + rnd() * 4) * k
        D.line(s, rgba(P.GRASS_HI if rnd() > 0.45 else P.GRASS_LO, 0.35 + rnd() * 0.45),
               (x, y), (x + (rnd() - 0.5) * 4 * k, y - ln), max(1, int(k)))


def _dirt(s, w, h, k, rnd):
    s.fill(P.DIRT)
    _speckle(s, rnd, 40, (P.DIRT_HI, P.DIRT_LO, (107, 84, 54)), 2.2 * k, w, h, 0.4)
    for _ in range(7):
        x, y = rnd() * w, rnd() * h
        r = (0.9 + rnd() * 1.6) * k
        D.circle(s, rgba(P.ROCK_LO, 0.8), x, y, r)
        D.circle(s, rgba(P.ROCK_HI, 0.55), x - r * 0.25, y - r * 0.3, max(1, r * 0.55))


def _rock(s, w, h, k, rnd):
    s.fill(P.ROCK)
    for _ in range(6):
        cx, cy = rnd() * w, rnd() * h
        r = (5 + rnd() * 9) * k
        pts = []
        n = 5 + int(rnd() * 3)
        for i in range(n + 1):
            a = (i / n) * TAU
            rr = r * (0.65 + rnd() * 0.5)
            pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.8))
        D.polygon(s, rgba(P.ROCK_HI if rnd() > 0.5 else P.ROCK_LO, 0.55), pts)
        D.polygon(s, rgba(P.BLACK, 0.28), pts, max(1, int(k)))
    _speckle(s, rnd, 24, (P.ROCK_HI, P.ROCK_LO, (85, 82, 76)), 1.4 * k, w, h, 0.4)


def _gravel(s, w, h, k, rnd):
    s.fill(mix(P.ROCK_LO, P.DIRT, 0.35))
    cols = (P.ROCK, P.ROCK_HI, P.ROCK_LO, P.DIRT_LO)
    for _ in range(58):
        x, y = rnd() * w, rnd() * h
        r = (0.8 + rnd() * 2.1) * k
        D.ellipse(s, cols[int(rnd() * 4) % 4], x, y, r, r * 0.82)
        D.circle(s, rgba(P.WHITE, 0.14), x - r * 0.3, y - r * 0.32, max(1, r * 0.45))


def _sand(s, w, h, k, rnd):
    s.fill(P.SAND)
    _speckle(s, rnd, 46, ((216, 192, 138), (169, 143, 92)), 1.5 * k, w, h, 0.35)
    for i in range(4):
        y = rnd() * h
        pts = [(x, y + math.sin(x / (5 * k) + i) * 1.6 * k) for x in range(0, int(w) + 1, int(6 * k))]
        for a, b in zip(pts, pts[1:]):
            D.line(s, rgba((141, 115, 69), 0.3), a, b, max(1, int(k)))


def _water(s, w, h, k, rnd, deep=False):
    base = P.WATER_DEEP if deep else P.WATER
    D.grad_rect(s, (0, 0, w, h), [(0.0, shade(base, 0.08)), (1.0, shade(base, -0.12))])
    for i in range(5):
        y = rnd() * h
        pts = [(x, y + math.sin(x / (4 * k) + i * 2) * 1.3 * k) for x in range(0, int(w) + 1, int(4 * k))]
        col = rgba(P.WATER_HI, 0.14 + rnd() * 0.18)
        for a, b in zip(pts, pts[1:]):
            D.line(s, col, a, b, max(1, int(k)))
    if not deep:
        _speckle(s, rnd, 8, (P.WATER_HI, (143, 208, 224)), 1.2 * k, w, h, 0.2)


def _road(s, w, h, k, rnd):
    s.fill(P.ROAD)
    _speckle(s, rnd, 70, (P.ROAD_HI, (55, 53, 47), (106, 102, 95)), 1.2 * k, w, h, 0.3)
    for _ in range(2):
        x, y = rnd() * w, rnd() * h
        for _ in range(4):
            nx, ny = x + (rnd() - 0.5) * 12 * k, y + (rnd() - 0.5) * 12 * k
            D.line(s, rgba((35, 34, 31), 0.5), (x, y), (nx, ny), max(1, int(k)))
            x, y = nx, ny


def _concrete(s, w, h, k, rnd):
    s.fill(P.CONCRETE)
    _speckle(s, rnd, 40, (P.CONCRETE_HI, P.CONCRETE_LO), 1.6 * k, w, h, 0.22)
    D.line(s, rgba((61, 59, 54), 0.55), (0, 0.8 * k), (w, 0.8 * k), max(1, int(1.6 * k)))
    D.line(s, rgba((61, 59, 54), 0.55), (0.8 * k, 0), (0.8 * k, h), max(1, int(1.6 * k)))
    D.line(s, rgba(P.WHITE, 0.10), (0, 2.4 * k), (w, 2.4 * k), max(1, int(k)))
    D.line(s, rgba(P.WHITE, 0.10), (2.4 * k, 0), (2.4 * k, h), max(1, int(k)))
    if rnd() < 0.4:   # oil stain
        x, y = rnd() * w, rnd() * h
        r = (4 + rnd() * 7) * k
        s.blit(D.radial((24, 22, 20), r, 0.35), (x - r, y - r))


def _forest(s, w, h, k, rnd):
    _grass(s, w, h, k, rnd, dark=True)
    overlay = D.surf(int(w), int(h))
    overlay.fill(rgba(P.TREE_LO, 0.25))
    s.blit(overlay, (0, 0))
    for _ in range(10):
        D.ellipse(s, rgba((107, 90, 46) if rnd() > 0.5 else P.TREE_LO, 0.5),
                  rnd() * w, rnd() * h, (1.8 + rnd()) * k, 1.1 * k)


PAINTERS = {
    GRASS: _grass, DIRT: _dirt, ROCK: _rock, GRAVEL: _gravel, SAND: _sand,
    WATER: _water, DEEP: lambda s, w, h, k, rnd: _water(s, w, h, k, rnd, True),
    ROAD: _road, CONCRETE: _concrete, FOREST: _forest,
}


def build_tileset():
    out = {}
    for key, painter in PAINTERS.items():
        variants = []
        for v in range(VARIANTS):
            def paint(s, w, h, k, painter=painter, v=v, key=key):
                painter(s, w, h, k, Rng(1000 + key * 97 + v * 13))
            spr = D.render_sprite(TILE, TILE, paint)
            D.noise_overlay(spr, 0.045, 40 + v)
            variants.append(spr.convert_alpha() if pygame.display.get_surface() else spr)
        out[key] = variants
    return out


def build_ore_overlays():
    spec = {
        'iron_ore':   ((141, 123, 104), (192, 169, 140), (227, 211, 184)),
        'copper_ore': ((125, 77, 36), P.COPPER, P.COPPER_HI),
        'coal':       ((34, 34, 42), (58, 58, 70), (92, 92, 108)),
        'stone':      ((111, 109, 105), (143, 141, 136), (173, 171, 166)),
        'sand':       ((166, 143, 93), P.SAND, (221, 199, 148)),
    }
    out = {}
    for item_id, cols in spec.items():
        variants = []
        for v in range(3):
            def paint(s, w, h, k, cols=cols, v=v, item_id=item_id):
                rnd = Rng(7700 + v * 31 + len(item_id) * 17)
                for _ in range(16):
                    x = 3 * k + rnd() * (w - 6 * k)
                    y = 3 * k + rnd() * (h - 6 * k)
                    r = (1.6 + rnd() * 3.4) * k
                    n = 5 + int(rnd() * 3)
                    pts = []
                    for i in range(n + 1):
                        a = (i / n) * TAU
                        rr = r * (0.7 + rnd() * 0.5)
                        pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
                    D.polygon(s, cols[0], pts)
                    D.polygon(s, rgba(P.BLACK, 0.4), pts, max(1, int(k)))
                    D.circle(s, rgba(cols[1], 0.9), x - r * 0.2, y - r * 0.25, max(1, r * 0.5))
                    D.circle(s, rgba(cols[2], 0.85), x - r * 0.35, y - r * 0.4, max(1, r * 0.22))
            variants.append(D.render_sprite(TILE, TILE, paint))
        out[item_id] = variants
    return out
