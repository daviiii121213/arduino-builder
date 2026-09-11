"""World props: vegetation, rocks, city architecture, port and mine furniture.

Each prop is painted once per variant into a cached surface with its own shadow.
`ox/oy` is the anchor: the point that sits on the prop's world position.
"""
import math
import pygame

from ..core.rng import Rng
from ..core.utils import TAU
from . import draw as D
from . import palette as P
from .palette import mix, shade, rgba

_cache = {}


def prop_sprite(type_, seed=0):
    spec = PROPS.get(type_)
    if spec is None:
        return None
    v = abs(int(seed)) % 3
    key = (type_, v)
    hit = _cache.get(key)
    if hit is not None:
        return hit
    lw, lh, ox, oy, painter = spec

    def paint(s, w, h, k, painter=painter, type_=type_, v=v, ox=ox, oy=oy):
        rnd = Rng(9001 + v * 7919 + len(type_) * 131 + ord(type_[0]) * 37)
        D.drop_shadow(s, ox * k, oy * k - 5 * k, w * 0.5, 14 * k, 0.34)
        painter(s, w, h, k, ox * k, oy * k, rnd)

    spr = D.render_sprite(lw, lh, paint)
    D.noise_overlay(spr, 0.035, 31 + v)
    if pygame.display.get_surface():
        spr = spr.convert_alpha()
    out = dict(surf=spr, ox=ox, oy=oy, w=lw, h=lh)
    _cache[key] = out
    return out


# ------------------------------------------------------------------ vegetation

def _tree(s, w, h, k, ox, oy, rnd):
    tx, base = ox, oy
    # trunk with bark grooves
    D.polygon(s, (61, 44, 28), [
        (tx - 5 * k, base), (tx - 4 * k, base - 30 * k), (tx - 3.5 * k, base - 46 * k),
        (tx + 3.5 * k, base - 46 * k), (tx + 5 * k, base - 28 * k), (tx + 5.5 * k, base)])
    D.grad_rect(s, (tx - 5 * k, base - 46 * k, 10.5 * k, 46 * k),
                [(0.0, (61, 44, 28)), (0.45, (107, 76, 44)), (1.0, (46, 33, 21))], horiz=True)
    D.polygon(s, (0, 0, 0, 0), [(tx - 6 * k, base - 47 * k), (tx - 6 * k, base)])
    for _ in range(9):
        x = tx - 4 * k + rnd() * 8 * k
        D.line(s, rgba((32, 22, 13), 0.4), (x, base - rnd() * 10 * k),
               (x + (rnd() - 0.5) * 2 * k, base - 20 * k - rnd() * 22 * k), k)
    for i in range(4):
        a = math.pi + (i / 3) * math.pi
        D.line(s, (61, 44, 28), (tx, base - 2 * k),
               (tx + math.cos(a) * 13 * k, base + 3 * k), max(1, int(2.4 * k)))
    # canopy: clustered blobs lit from the upper left
    clusters = []
    for _ in range(13):
        a, r = rnd() * TAU, rnd() * 22 * k
        clusters.append((tx + math.cos(a) * r * 1.15,
                         base - 52 * k - math.sin(a) * r * 0.75,
                         (11 + rnd() * 10) * k))
    for cx, cy, r in clusters:
        D.circle(s, P.TREE_LO, cx, cy + 2 * k, r)
    for cx, cy, r in clusters:
        D.circle(s, P.TREE, cx, cy, r * 0.94)
        D.circle(s, P.TREE_HI, cx - r * 0.3, cy - r * 0.34, r * 0.5)
    for _ in range(90):
        cx, cy, r = clusters[int(rnd() * len(clusters)) % len(clusters)]
        a, rr = rnd() * TAU, rnd() * r * 0.9
        D.ellipse(s, rgba((127, 174, 92) if rnd() > 0.5 else P.TREE_LO, 0.5),
                  cx + math.cos(a) * rr, cy + math.sin(a) * rr, 1.6 * k, 1.1 * k)


def _bush(s, w, h, k, ox, oy, rnd):
    for _ in range(7):
        x = ox + (rnd() - 0.5) * 22 * k
        y = oy - 4 * k - rnd() * 12 * k
        r = (5 + rnd() * 7) * k
        D.circle(s, P.TREE_LO, x, y, r)
        D.circle(s, P.TREE, x, y, r * 0.85)
        D.circle(s, P.GRASS_HI, x - r * 0.3, y - r * 0.35, r * 0.45)
    for _ in range(26):
        D.ellipse(s, rgba((134, 182, 97) if rnd() > 0.5 else P.TREE_LO, 0.55),
                  ox + (rnd() - 0.5) * 24 * k, oy - 4 * k - rnd() * 16 * k, 1.5 * k, k)


def _reed(s, w, h, k, ox, oy, rnd):
    for _ in range(9):
        x = ox + (rnd() - 0.5) * 14 * k
        ln = (12 + rnd() * 18) * k
        D.line(s, rgba((138, 160, 90) if rnd() > 0.5 else (95, 114, 56), 0.9),
               (x, oy), (x + (rnd() - 0.5) * 10 * k, oy - ln), max(1, int(1.3 * k)))


def _tuft(s, w, h, k, ox, oy, rnd):
    for _ in range(12):
        x = ox + (rnd() - 0.5) * 16 * k
        ln = (4 + rnd() * 9) * k
        D.line(s, rgba(P.GRASS_HI if rnd() > 0.5 else P.GRASS_LO, 0.85),
               (x, oy), (x + (rnd() - 0.5) * 7 * k, oy - ln), max(1, int(k)))


# ------------------------------------------------------------------ rocks

def _boulder(s, w, h, k, ox, oy, rnd):
    cx, cy = ox, oy - 8 * k
    pts = []
    n = 9
    for i in range(n):
        a = (i / n) * TAU
        r = (13 + rnd() * 7) * k
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r * 0.72))
    D.polygon(s, P.ROCK, pts)
    D.polygon(s, rgba((29, 28, 26), 0.6), pts, max(1, int(1.2 * k)))
    D.ellipse(s, rgba(P.ROCK_HI, 0.5), cx - 3 * k, cy - 4 * k, 11 * k, 7 * k)
    D.ellipse(s, rgba((201, 205, 198), 0.16), cx - 5 * k, cy - 6 * k, 7 * k, 4 * k)
    for _ in range(5):
        D.line(s, rgba((42, 41, 38), 0.45),
               (cx + (rnd() - 0.5) * 20 * k, cy + (rnd() - 0.5) * 14 * k),
               (cx + (rnd() - 0.5) * 20 * k, cy + (rnd() - 0.5) * 14 * k), k)
    D.ellipse(s, rgba(P.GRASS_LO, 0.35), cx + 6 * k, cy + 5 * k, 6 * k, 3 * k)


def _rubble(s, w, h, k, ox, oy, rnd):
    cols = (P.ROCK, P.ROCK_HI, P.ROCK_LO)
    for _ in range(7):
        x = ox + (rnd() - 0.5) * 26 * k
        y = oy - rnd() * 8 * k
        r = (2 + rnd() * 4) * k
        pts = []
        for i in range(6):
            a = (i / 6) * TAU
            rr = r * (0.7 + rnd() * 0.5)
            pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr * 0.75))
        D.polygon(s, cols[int(rnd() * 3) % 3], pts)
        D.polygon(s, rgba(P.BLACK, 0.4), pts, 1)


# ------------------------------------------------------------------ industrial

def _barrel(s, w, h, k, ox, oy, rnd):
    x, y = ox - 10 * k, oy - 26 * k
    bw, bh = 20 * k, 26 * k
    body = P.ORANGE if rnd() > 0.5 else P.BLUE
    D.grad_rect(s, (x, y, bw, bh), [
        (0.0, shade(body, -0.4)), (0.3, shade(body, 0.22)),
        (0.62, body), (1.0, shade(body, -0.5))], horiz=True)
    D.ellipse(s, shade(body, 0.3), x + bw / 2, y, bw / 2, 3.4 * k)
    D.ellipse(s, rgba(P.BLACK, 0.5), x + bw / 2, y, bw / 2, 3.4 * k, 1)
    for ry in (y + bh * 0.24, y + bh * 0.72):
        D.rect(s, rgba((28, 28, 32), 0.8), (x, ry, bw, 2.6 * k))
        D.rect(s, rgba(P.WHITE, 0.12), (x, ry, bw, 0.9 * k))
    D.grime(s, (x, y, bw, bh), 12, 0.9, k)
    D.rect(s, rgba(P.BLACK, 0.6), (x, y, bw, bh), 1)


def _pallet(s, w, h, k, ox, oy, rnd):
    x, y = ox - 17 * k, oy - 14 * k
    for i in range(4):
        D.grad_rect(s, (x, y + i * 5 * k, 34 * k, 4 * k),
                    [(0.0, (165, 128, 74)), (1.0, (107, 80, 39))])
        D.rect(s, rgba((59, 44, 22), 0.7), (x, y + i * 5 * k, 34 * k, 4 * k), 1)
    D.rect(s, (79, 60, 29), (x, y, 3 * k, 19 * k))
    D.rect(s, (79, 60, 29), (x + 31 * k, y, 3 * k, 19 * k))
    cw, ch = 26 * k, 16 * k
    D.grad_rect(s, (x + 4 * k, y - ch, cw, ch), [(0.0, (176, 138, 78)), (1.0, (122, 90, 44))])
    D.rect(s, (74, 55, 23), (x + 4 * k, y - ch, cw, ch), max(1, int(1.2 * k)))
    D.line(s, (74, 55, 23), (x + 4 * k, y - ch), (x + 4 * k + cw, y), k)
    D.line(s, (74, 55, 23), (x + 4 * k + cw, y - ch), (x + 4 * k, y), k)


def _container(s, w, h, k, ox, oy, rnd):
    cw, ch = 68 * k, 40 * k
    x, y = ox - cw / 2, oy - ch
    col = (P.RED, P.BLUE, P.GREEN, P.ORANGE)[int(rnd() * 4) % 4]
    D.plate(s, (x, y, cw, ch), col, 2 * k, k)
    for i in range(int(2 * k), int(cw), int(5 * k)):
        D.line(s, rgba(P.BLACK, 0.22), (x + i, y + 4 * k), (x + i, y + ch - 4 * k), 1.6 * k)
        D.line(s, rgba(P.WHITE, 0.10), (x + i + 1.6 * k, y + 4 * k), (x + i + 1.6 * k, y + ch - 4 * k), k)
    D.rect(s, rgba((14, 14, 16), 0.85), (x, y, cw, 4 * k))
    D.rect(s, rgba((14, 14, 16), 0.85), (x, y + ch - 4 * k, cw, 4 * k))
    D.rect(s, shade(col, -0.55), (x, y, 4 * k, ch))
    D.rect(s, shade(col, -0.55), (x + cw - 4 * k, y, 4 * k, ch))
    D.grime(s, (x, y, cw, ch), 33, 1.0, k)


def _streetlight(s, w, h, k, ox, oy, rnd):
    x, base = ox, oy
    D.grad_rect(s, (x - 3 * k, base - 62 * k, 6 * k, 62 * k),
                [(0.0, P.STEEL), (0.5, P.STEEL_LO), (1.0, P.STEEL_DARK)], horiz=True)
    D.rr(s, (x - 7 * k, base - 5 * k, 14 * k, 6 * k), P.STEEL_DARK, 2 * k)
    D.line(s, P.STEEL_LO, (x, base - 62 * k), (x + 11 * k, base - 72 * k), max(2, int(5 * k)))
    D.rr(s, (x + 6 * k, base - 72 * k, 14 * k, 5 * k), P.STEEL_MID, 2 * k)
    D.glow(s, x + 13 * k, base - 66 * k, 13 * k, P.GLOW_WARM, 0.5)
    D.rr(s, (x + 8 * k, base - 68 * k, 10 * k, 3 * k), rgba(P.GLOW_WARM, 0.95), 1.5 * k)


def _roadsign(s, w, h, k, ox, oy, rnd):
    x, base = ox, oy
    D.rect(s, P.STEEL_LO, (x - 1.6 * k, base - 30 * k, 3.2 * k, 30 * k))
    D.plate(s, (x - 14 * k, base - 46 * k, 28 * k, 18 * k), P.GREEN, 2 * k, k)
    D.rect(s, rgba(P.WHITE, 0.5), (x - 11.5 * k, base - 43.5 * k, 23 * k, 13 * k), 1)
    for i in range(3):
        D.rect(s, rgba(P.WHITE, 0.75), (x - 9 * k, base - 40 * k + i * 4 * k, 18 * k - i * 4 * k, 1.6 * k))


def _signboard(s, w, h, k, ox, oy, rnd, label='IRONWORKS'):
    x, y = ox - 52 * k, oy - 46 * k
    bw, bh = 104 * k, 34 * k
    D.rect(s, P.STEEL_DARK, (x + 8 * k, y + bh, 5 * k, 14 * k))
    D.rect(s, P.STEEL_DARK, (x + bw - 13 * k, y + bh, 5 * k, 14 * k))
    D.plate(s, (x, y, bw, bh), P.STEEL_LO, 3 * k, k)
    D.brushed(s, (x, y, bw, bh), 4, k=k)
    D.hazard(s, (x + 3 * k, y + bh - 7 * k, bw - 6 * k, 5 * k), pitch=int(8 * k))
    from .ui import text_surface, FONT_TITLE
    t = text_surface(label, FONT_TITLE, P.UI_TRIM_HI, int(17 * k))
    s.blit(t, (int(x + bw / 2 - t.get_width() / 2), int(y + 6 * k)))
    D.bolt_frame(s, (x, y, bw, bh), 5 * k, 2.2 * k)
    D.grime(s, (x, y, bw, bh), 88, 0.8, k)


def _minecart(s, w, h, k, ox, oy, rnd):
    x, y = ox - 18 * k, oy - 22 * k
    cw, ch = 36 * k, 20 * k
    D.circle(s, P.IRON_DARK, x + 8 * k, y + ch + 3 * k, 4.5 * k)
    D.circle(s, P.IRON_DARK, x + cw - 8 * k, y + ch + 3 * k, 4.5 * k)
    D.circle(s, P.STEEL_MID, x + 8 * k, y + ch + 3 * k, 1.8 * k)
    D.circle(s, P.STEEL_MID, x + cw - 8 * k, y + ch + 3 * k, 1.8 * k)
    pts = [(x, y), (x + cw, y), (x + cw - 4 * k, y + ch), (x + 4 * k, y + ch)]
    D.polygon(s, P.IRON_LO, pts)
    D.polygon(s, rgba(P.BLACK, 0.7), pts, k)
    for _ in range(9):
        D.circle(s, (58, 58, 66), x + 6 * k + rnd() * (cw - 12 * k), y + k + rnd() * 3 * k,
                 (2 + rnd() * 2.4) * k)
    D.grime(s, (x, y, cw, ch), 55, 1.2, k)


def _crane(s, w, h, k, ox, oy, rnd):
    cx, base = ox, oy
    for col, wd in ((P.ORANGE_LO, 6), (P.ORANGE, 3.4)):
        D.line(s, col, (cx - 34 * k, base), (cx - 12 * k, base - 78 * k), max(2, int(wd * k)))
        D.line(s, col, (cx + 34 * k, base), (cx + 12 * k, base - 78 * k), max(2, int(wd * k)))
    for i in range(7):
        t0, t1 = i / 7, (i + 1) / 7
        D.line(s, rgba(P.ORANGE_HI, 0.8),
               (cx - 34 * k + 22 * k * t0, base - 78 * k * t0),
               (cx + 34 * k - 22 * k * t1, base - 78 * k * t1), max(1, int(1.4 * k)))
        D.line(s, rgba(P.ORANGE_HI, 0.8),
               (cx + 34 * k - 22 * k * t0, base - 78 * k * t0),
               (cx - 34 * k + 22 * k * t1, base - 78 * k * t1), max(1, int(1.4 * k)))
    D.plate(s, (cx - 52 * k, base - 92 * k, 104 * k, 12 * k), P.ORANGE, 2 * k, k)
    D.hazard(s, (cx - 52 * k, base - 82 * k, 104 * k, 4 * k), pitch=int(5 * k))
    D.plate(s, (cx - 16 * k, base - 116 * k, 32 * k, 24 * k), P.STEEL_LO, 3 * k, k)
    D.glass_panel(s, (cx - 12 * k, base - 112 * k, 24 * k, 12 * k), P.GLASS, 0.5, k)
    D.bolt_frame(s, (cx - 16 * k, base - 116 * k, 32 * k, 24 * k), 4 * k, 1.8 * k)
    D.line(s, (27, 27, 31), (cx + 34 * k, base - 86 * k), (cx + 34 * k, base - 44 * k), max(1, int(1.4 * k)))
    D.arc(s, P.STEEL_HI, cx + 34 * k, base - 40 * k, 4.5 * k, 0.3, 4.7, max(1, int(2.4 * k)))


def _ship(s, w, h, k, ox, oy, rnd):
    cx, base = ox, oy
    hull = [(cx - 112 * k, base - 34 * k), (cx + 96 * k, base - 34 * k),
            (cx + 118 * k, base - 14 * k), (cx + 92 * k, base + 8 * k),
            (cx - 96 * k, base + 8 * k), (cx - 114 * k, base - 12 * k)]
    D.polygon(s, (109, 47, 39), hull)
    D.grad_rect(s, (cx - 112 * k, base - 4 * k, 210 * k, 12 * k),
                [(0.0, (42, 42, 48)), (1.0, (22, 22, 26))])
    D.polygon(s, rgba(P.BLACK, 0.7), hull, max(1, int(1.4 * k)))
    D.plate(s, (cx - 104 * k, base - 46 * k, 196 * k, 14 * k), P.STEEL_LO, 2 * k, k)
    D.plate(s, (cx + 34 * k, base - 86 * k, 56 * k, 42 * k), (216, 210, 196), 3 * k, k)
    for i in range(3):
        for j in range(4):
            D.glass_panel(s, (cx + 40 * k + j * 12 * k, base - 80 * k + i * 12 * k, 9 * k, 7 * k),
                          P.GLASS, 0.45, k)
    D.plate(s, (cx + 54 * k, base - 108 * k, 16 * k, 24 * k), P.RED, 2 * k, k)
    D.rect(s, (26, 26, 30), (cx + 54 * k, base - 108 * k, 16 * k, 4 * k))
    for i in range(8):
        col = (P.BLUE, P.GREEN, P.ORANGE, P.RED)[int(rnd() * 4) % 4]
        D.plate(s, (cx - 100 * k + i * 17 * k, base - 62 * k - (i % 2) * 14 * k, 15 * k, 15 * k), col, k, k)


def _mine_entrance(s, w, h, k, ox, oy, rnd):
    cx, base = ox, oy
    face = [(cx - 50 * k, base + 8 * k), (cx - 46 * k, base - 40 * k), (cx, base - 68 * k),
            (cx + 46 * k, base - 40 * k), (cx + 50 * k, base + 8 * k)]
    D.polygon(s, P.ROCK, face)
    # light the face from the upper left and let the right side fall into shadow
    D.polygon(s, rgba(P.ROCK_HI, 0.45), [(cx - 50 * k, base + 8 * k), (cx - 46 * k, base - 40 * k),
                                         (cx, base - 68 * k), (cx - 6 * k, base + 8 * k)])
    D.polygon(s, rgba(P.ROCK_LO, 0.5), [(cx + 6 * k, base + 8 * k), (cx, base - 68 * k),
                                        (cx + 46 * k, base - 40 * k), (cx + 50 * k, base + 8 * k)])
    D.polygon(s, rgba((28, 27, 25), 0.7), face, max(1, int(1.4 * k)))
    for _ in range(14):
        x, y = cx - 44 * k + rnd() * 88 * k, base - 60 * k + rnd() * 60 * k
        D.line(s, rgba((42, 41, 38), 0.4), (x, y),
               (x + (rnd() - 0.5) * 16 * k, y + (rnd() - 0.5) * 16 * k), k)
    D.polygon(s, (10, 10, 12), [(cx - 20 * k, base + 8 * k), (cx - 18 * k, base - 26 * k),
                                (cx, base - 38 * k), (cx + 18 * k, base - 26 * k),
                                (cx + 20 * k, base + 8 * k)])
    D.rect(s, (93, 69, 38), (cx - 26 * k, base - 30 * k, 7 * k, 38 * k))
    D.rect(s, (93, 69, 38), (cx + 19 * k, base - 30 * k, 7 * k, 38 * k))
    D.rect(s, (93, 69, 38), (cx - 28 * k, base - 36 * k, 56 * k, 8 * k))
    D.rect(s, rgba((45, 32, 17), 0.8), (cx - 28 * k, base - 36 * k, 56 * k, 8 * k), 1)
    for i in range(5):
        y = base - 18 * k + i * 7 * k
        D.line(s, (74, 58, 34), (cx - 12 * k, y), (cx + 12 * k, y), max(1, int(2.4 * k)))
    D.line(s, (74, 71, 64), (cx - 8 * k, base - 20 * k), (cx - 10 * k, base + 14 * k), max(1, int(2 * k)))
    D.line(s, (74, 71, 64), (cx + 8 * k, base - 20 * k), (cx + 10 * k, base + 14 * k), max(1, int(2 * k)))
    D.glow(s, cx, base - 24 * k, 18 * k, P.GLOW_WARM, 0.3)


def _city(s, w, h, k, ox, oy, rnd, kind):
    bw, bh = w - 12 * k, h - 20 * k
    x, y = 6 * k, 10 * k
    roof_h = 26 * k if kind in ('factory', 'warehouse') else 16 * k
    wall = {'shop': (168, 113, 74), 'apartment': (141, 127, 109), 'office': (111, 127, 140),
            'factory': (122, 113, 105), 'warehouse': (138, 129, 119)}[kind]

    D.grad_rect(s, (x, y + roof_h, bw, bh - roof_h),
                [(0.0, shade(wall, 0.18)), (0.6, wall), (1.0, shade(wall, -0.32))])
    if kind in ('shop', 'apartment'):        # brick courses
        by = y + roof_h
        row = 0
        while by < y + bh:
            D.line(s, rgba(P.BLACK, 0.16), (x, by), (x + bw, by), k)
            off = 6 * k if row % 2 else 0
            bx = x + off
            while bx < x + bw:
                D.line(s, rgba(P.BLACK, 0.16), (bx, by), (bx, by + 6 * k), k)
                bx += 12 * k
            by += 6 * k
            row += 1
    else:                                    # corrugated panels
        bx = x
        while bx < x + bw:
            D.line(s, rgba(P.BLACK, 0.2), (bx, y + roof_h), (bx, y + bh), max(1, int(1.6 * k)))
            D.line(s, rgba(P.WHITE, 0.08), (bx + 1.6 * k, y + roof_h), (bx + 1.6 * k, y + bh), k)
            bx += 9 * k

    roof = [(x - 5 * k, y + roof_h), (x + bw * 0.5, y), (x + bw + 5 * k, y + roof_h)]
    D.polygon(s, (58, 57, 54), roof)
    D.polygon(s, rgba(P.BLACK, 0.6), roof, max(1, int(1.2 * k)))
    if kind in ('factory', 'warehouse'):
        for i in range(4):
            D.rect(s, rgba(P.GLASS, 0.45),
                   (x + 8 * k + i * (bw / 4.4), y + roof_h * 0.45, bw / 8, roof_h * 0.4))

    cols = max(2, int(bw / (26 * k)))
    rows = max(2, int((bh - roof_h) / (26 * k)))
    for r in range(rows):
        for c in range(cols):
            wx = x + 8 * k + c * ((bw - 16 * k) / cols)
            wy = y + roof_h + 8 * k + r * ((bh - roof_h - 14 * k) / rows)
            ww = (bw - 16 * k) / cols - 8 * k
            wh = (bh - roof_h - 14 * k) / rows - 10 * k
            if ww < 4 * k or wh < 4 * k:
                continue
            lit = rnd() < 0.45
            D.rect(s, shade(wall, -0.45), (wx - 1.5 * k, wy - 1.5 * k, ww + 3 * k, wh + 3 * k))
            D.glass_panel(s, (wx, wy, ww, wh), P.GLOW_WARM if lit else P.GLASS,
                          0.85 if lit else 0.35, k)
            if lit:
                D.glow(s, wx + ww / 2, wy + wh / 2, ww * 1.4, P.GLOW_WARM, 0.14)

    dw = min(46 * k, bw * 0.4)
    dx, dy = x + bw / 2 - dw / 2, y + bh - 26 * k
    if kind in ('factory', 'warehouse'):
        D.plate(s, (dx - 6 * k, dy, dw + 12 * k, 26 * k), P.STEEL_LO, k, k)
        for i in range(6):
            D.rect(s, rgba(P.BLACK, 0.2), (dx - 6 * k, dy + 2 * k + i * 4 * k, dw + 12 * k, 1.6 * k))
        D.hazard(s, (dx - 6 * k, dy + 22 * k, dw + 12 * k, 4 * k), pitch=int(5 * k))
    else:
        D.plate(s, (dx, dy, dw, 26 * k), P.GREEN if kind == 'shop' else (93, 74, 51), 2 * k, k)
        D.glass_panel(s, (dx + 4 * k, dy + 4 * k, dw - 8 * k, 14 * k), P.GLOW_WARM, 0.8, k)
        D.circle(s, P.BRASS, dx + dw - 7 * k, dy + 22 * k, 1.6 * k)

    if kind in ('shop', 'office'):
        D.plate(s, (x + 6 * k, y + roof_h + 2 * k, bw - 12 * k, 12 * k), P.UI_PANEL, k, k)
        D.rect(s, rgba(P.UI_TRIM_HI, 0.85), (x + 9 * k, y + roof_h + 5 * k, bw - 18 * k, 1.4 * k))
    D.grime(s, (x, y, bw, bh + 10 * k), 61, 0.8, k)
    for _ in range(2 + int(rnd() * 2)):
        vx = x + 10 * k + rnd() * (bw - 30 * k)
        D.plate(s, (vx, y + roof_h - 10 * k, 14 * k, 10 * k), P.STEEL_MID, k, k)
        D.vents(s, (vx + 2 * k, y + roof_h - 8 * k, 10 * k, 6 * k), 2)


# type -> (w, h, ox, oy, painter)
PROPS = {
    'tree':       (72, 92, 36, 80, _tree),
    'bush':       (40, 34, 20, 28, _bush),
    'boulder':    (46, 40, 23, 32, _boulder),
    'rubble':     (34, 22, 17, 16, _rubble),
    'reed':       (26, 34, 13, 30, _reed),
    'grasstuft':  (24, 20, 12, 16, _tuft),
    'barrel':     (26, 34, 13, 28, _barrel),
    'pallet':     (40, 30, 20, 22, _pallet),
    'container':  (76, 52, 38, 42, _container),
    'streetlight': (26, 78, 13, 72, _streetlight),
    'roadsign':   (34, 46, 17, 42, _roadsign),
    'signboard':  (120, 62, 60, 54, _signboard),
    'minecart':   (44, 36, 22, 28, _minecart),
    'crane':      (130, 150, 65, 132, _crane),
    'ship':       (240, 130, 120, 100, _ship),
    'mine_entrance': (110, 92, 55, 78, _mine_entrance),
    'shop':       (160, 150, 80, 128, lambda *a: _city(*a, 'shop')),
    'apartment':  (150, 178, 75, 154, lambda *a: _city(*a, 'apartment')),
    'office_bldg': (170, 196, 85, 170, lambda *a: _city(*a, 'office')),
    'factory_bldg': (220, 170, 110, 146, lambda *a: _city(*a, 'factory')),
    'warehouse_bldg': (200, 150, 100, 128, lambda *a: _city(*a, 'warehouse')),
}
