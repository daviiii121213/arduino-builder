"""Item icons: a purpose-drawn illustration for every material and component,
used in the inventory, tooltips, machine panels, on belts and on the ground.
"""
import math
import pygame

from ..core.rng import Rng
from ..core.utils import TAU
from ..data.items import ITEMS
from . import draw as D
from . import palette as P
from .palette import mix, shade, rgba

ICON = 40
_cache = {}
_chips = {}


def item_icon(item_id):
    hit = _cache.get(item_id)
    if hit is not None:
        return hit
    it = ITEMS.get(item_id)

    def paint(s, w, h, k, it=it, item_id=item_id):
        if not it:
            return
        rnd = Rng(len(item_id) * 977 + ord(item_id[0]) * 53 + 11)
        cx, cy = w / 2, h / 2
        D.drop_shadow(s, cx, cy + 13 * k, 22 * k, 8 * k, 0.35)
        KINDS.get(it['art']['kind'], _rock)(s, cx, cy, k, it['art'], rnd)

    spr = D.render_sprite(ICON, ICON, paint)
    if pygame.display.get_surface():
        spr = spr.convert_alpha()
    _cache[item_id] = spr
    return spr


def item_chip(item_id, size=18):
    """Small version for belts and buffer readouts."""
    key = (item_id, size)
    hit = _chips.get(key)
    if hit is None:
        hit = pygame.transform.smoothscale(item_icon(item_id), (size, size))
        if pygame.display.get_surface():
            hit = hit.convert_alpha()
        _chips[key] = hit
    return hit


# --------------------------------------------------------------- icon kinds

def _facet(s, cx, cy, k, r, a, b, rnd, n=7):
    pts = []
    for i in range(n):
        ang = (i / n) * TAU
        rr = r * (0.72 + rnd() * 0.45)
        pts.append((cx + math.cos(ang) * rr, cy + math.sin(ang) * rr * 0.88))
    D.polygon(s, a, pts)
    D.polygon(s, rgba(P.BLACK, 0.55), pts, max(1, int(1.2 * k)))
    # lit facet
    D.polygon(s, rgba(b, 0.55), [pts[0], pts[1], (cx, cy)])
    D.polygon(s, rgba(b, 0.32), [pts[1], pts[2], (cx, cy)])
    return pts


def _rock(s, cx, cy, k, art, rnd):
    _facet(s, cx, cy, k, 13 * k, art['a'], art['b'], rnd)
    D.ellipse(s, rgba(P.WHITE, 0.16), cx - 4 * k, cy - 4 * k, 5 * k, 3 * k)


def _ore(s, cx, cy, k, art, rnd):
    _facet(s, cx, cy, k, 13 * k, art['a'], art['b'], rnd)
    fleck = art.get('fleck', art['b'])
    for _ in range(7):
        a, r = rnd() * TAU, rnd() * 8 * k
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r
        D.circle(s, rgba(fleck, 0.9), x, y, (1.1 + rnd() * 1.5) * k)
        D.circle(s, rgba(P.WHITE, 0.4), x - 0.5 * k, y - 0.5 * k, max(1, 0.6 * k))


def _log(s, cx, cy, k, art, rnd):
    D.grad_rect(s, (cx - 14 * k, cy - 6 * k, 28 * k, 12 * k),
                [(0.0, shade(art['b'], 0.15)), (0.45, art['a']), (1.0, shade(art['a'], -0.4))],
                radius=int(5 * k))
    D.rr(s, (cx - 14 * k, cy - 6 * k, 28 * k, 12 * k), rgba((58, 42, 22), 0.8), int(5 * k), max(1, int(1.2 * k)))
    D.ellipse(s, (214, 180, 131), cx + 12 * k, cy, 3.4 * k, 5.6 * k)
    for i in (1, 2):
        D.ellipse(s, rgba((138, 106, 58), 0.9), cx + 12 * k, cy, 1.2 * i * k, 2 * i * k, 1)
    for _ in range(5):
        D.line(s, rgba((74, 52, 28), 0.5),
               (cx - 12 * k + rnd() * 20 * k, cy - 5 * k + rnd() * 10 * k),
               (cx - 8 * k + rnd() * 20 * k, cy - 5 * k + rnd() * 10 * k), k)


def _grain(s, cx, cy, k, art, rnd):
    for _ in range(24):
        a, r = rnd() * math.pi, rnd() * 12 * k
        x = cx + math.cos(a) * r
        y = cy + 6 * k - math.sin(a) * r * 0.7
        rad = (1.6 + rnd() * 1.4) * k
        D.circle(s, art['a'], x, y, rad)
        D.circle(s, art['b'], x - rad * 0.3, y - rad * 0.3, max(1, rad * 0.55))
        D.circle(s, rgba(P.BLACK, 0.25), x, y, rad, 1)


def _fluid(s, cx, cy, k, art, rnd):
    body = [(cx - 4 * k, cy - 13 * k), (cx + 4 * k, cy - 13 * k), (cx + 4 * k, cy - 6 * k),
            (cx + 10 * k, cy + 2 * k), (cx + 10 * k, cy + 9 * k), (cx + 6 * k, cy + 14 * k),
            (cx - 6 * k, cy + 14 * k), (cx - 10 * k, cy + 9 * k), (cx - 10 * k, cy + 2 * k),
            (cx - 4 * k, cy - 6 * k)]
    D.polygon(s, rgba((207, 230, 238), 0.25), body)
    liquid = [(cx - 9.4 * k, cy + 1 * k), (cx + 9.4 * k, cy + 1 * k), (cx + 9.4 * k, cy + 9 * k),
              (cx + 6 * k, cy + 14 * k), (cx - 6 * k, cy + 14 * k), (cx - 9.4 * k, cy + 9 * k)]
    D.polygon(s, art['b'], liquid)
    D.polygon(s, rgba(art['a'], 0.75), [(cx - 9.4 * k, cy + 5 * k), (cx + 9.4 * k, cy + 5 * k),
                                        (cx + 9.4 * k, cy + 9 * k), (cx + 6 * k, cy + 14 * k),
                                        (cx - 6 * k, cy + 14 * k), (cx - 9.4 * k, cy + 9 * k)])
    D.rect(s, rgba(P.WHITE, 0.35), (cx - 9.4 * k, cy + k, 18.8 * k, 1.4 * k))
    D.polygon(s, rgba((232, 244, 248), 0.6), body, max(1, int(1.2 * k)))
    D.ellipse(s, rgba(P.WHITE, 0.35), cx - 5 * k, cy + 4 * k, 1.6 * k, 6 * k)
    D.rr(s, (cx - 5 * k, cy - 16 * k, 10 * k, 4 * k), (138, 106, 58), int(1.4 * k))


def _plate(s, cx, cy, k, art, rnd):
    for i in (2, 1, 0):
        y = cy + i * 3 * k - 3 * k
        x = cx - i * 1.5 * k
        pts = [(x - 14 * k, y), (x, y - 7 * k), (x + 14 * k, y), (x, y + 7 * k)]
        D.polygon(s, mix(art['a'], art['b'], 0.4), pts)
        D.polygon(s, art['b'], [pts[0], pts[1], (x, y)])
        D.polygon(s, rgba(P.BLACK, 0.5), pts, max(1, int(k)))
    D.polygon(s, rgba(P.WHITE, 0.35), [(cx - 8 * k, cy - 7 * k), (cx - 2 * k, cy - 10 * k),
                                       (cx + 2 * k, cy - 8 * k), (cx - 4 * k, cy - 5 * k)])


def _ingot(s, cx, cy, k, art, rnd):
    def bar(ox, oy):
        pts = [(cx + ox - 12 * k, cy + oy + 4 * k), (cx + ox - 9 * k, cy + oy - 4 * k),
               (cx + ox + 9 * k, cy + oy - 4 * k), (cx + ox + 12 * k, cy + oy + 4 * k)]
        D.polygon(s, mix(art['a'], art['b'], 0.45), pts)
        D.polygon(s, art['b'], [pts[1], pts[2], (cx + ox + 9 * k, cy + oy - 2 * k),
                                (cx + ox - 9 * k, cy + oy - 2 * k)])
        D.polygon(s, rgba(P.BLACK, 0.55), pts, max(1, int(k)))
    bar(-3 * k, 7 * k)
    bar(4 * k, 7 * k)
    bar(0, -2 * k)


def _sheet(s, cx, cy, k, art, rnd):
    pts = [(cx - 13 * k, cy - 9 * k), (cx + 13 * k, cy - 11 * k),
           (cx + 13 * k, cy + 7 * k), (cx - 13 * k, cy + 9 * k)]
    D.polygon(s, rgba(art['a'], 0.75), pts)
    D.polygon(s, rgba(art['b'], 0.55), [pts[0], pts[1], (cx, cy)])
    D.polygon(s, rgba((223, 242, 248), 0.8), pts, max(1, int(1.4 * k)))
    D.polygon(s, rgba(P.WHITE, 0.35), [(cx - 10 * k, cy + 8 * k), (cx, cy - 10 * k),
                                       (cx + 4 * k, cy - 10 * k), (cx - 6 * k, cy + 8 * k)])


def _gear(s, cx, cy, k, art, rnd):
    R, teeth = 13 * k, 9
    pts = []
    for i in range(teeth):
        a0 = (i / teeth) * TAU
        a1 = a0 + TAU / teeth * 0.5
        a2 = a0 + TAU / teeth
        pts.append((cx + math.cos(a0) * R, cy + math.sin(a0) * R))
        pts.append((cx + math.cos(a0 + 0.12) * (R + 3.4 * k), cy + math.sin(a0 + 0.12) * (R + 3.4 * k)))
        pts.append((cx + math.cos(a1 - 0.12) * (R + 3.4 * k), cy + math.sin(a1 - 0.12) * (R + 3.4 * k)))
        pts.append((cx + math.cos(a1) * R, cy + math.sin(a1) * R))
        pts.append((cx + math.cos(a2) * R, cy + math.sin(a2) * R))
    D.polygon(s, mix(art['a'], art['b'], 0.35), pts)
    D.polygon(s, rgba(P.BLACK, 0.55), pts, max(1, int(1.1 * k)))
    D.arc(s, rgba(art['b'], 0.8), cx, cy, R * 0.72, 3.4, 5.6, max(1, int(2 * k)))
    D.circle(s, shade(art['a'], -0.35), cx, cy, 5 * k)
    D.circle(s, rgba(P.BLACK, 0.5), cx, cy, 5 * k, max(1, int(k)))


def _bracket(s, cx, cy, k, art, rnd):
    pts = [(cx - 13 * k, cy - 8 * k), (cx + 6 * k, cy - 8 * k), (cx + 13 * k, cy - k),
           (cx + 13 * k, cy + 8 * k), (cx + 2 * k, cy + 8 * k), (cx + 2 * k, cy),
           (cx - 13 * k, cy)]
    D.polygon(s, mix(art['a'], art['b'], 0.4), pts)
    D.polygon(s, rgba(P.BLACK, 0.55), pts, max(1, int(1.1 * k)))
    D.rect(s, rgba(P.WHITE, 0.3), (cx - 12 * k, cy - 7 * k, 16 * k, 1.2 * k))
    D.bolt(s, cx - 9 * k, cy - 4 * k, 2 * k, art['b'])
    D.bolt(s, cx + 8 * k, cy + 4 * k, 2 * k, art['b'])


def _coil(s, cx, cy, k, art, rnd):
    for i in range(5):
        D.ellipse(s, art['a'], cx, cy - 7 * k + i * 3.6 * k, (11 - i * 0.4) * k, 4.4 * k, max(2, int(3.4 * k)))
    for i in range(5):
        D.arc(s, art['b'], cx, cy - 7.8 * k + i * 3.6 * k, (11 - i * 0.4) * k, 3.3, 6.1, max(1, int(1.6 * k)))
    D.line(s, art['b'], (cx + 10 * k, cy + 9 * k), (cx + 13 * k, cy + k), max(1, int(2 * k)))


def _board(s, cx, cy, k, art, rnd):
    D.grad_rect(s, (cx - 13 * k, cy - 11 * k, 26 * k, 22 * k),
                [(0.0, art['b']), (1.0, art['a'])], radius=int(2 * k))
    D.rr(s, (cx - 13 * k, cy - 11 * k, 26 * k, 22 * k), rgba(P.BLACK, 0.6), int(2 * k), 1)
    trace = art.get('fleck', P.GOLD)
    for _ in range(7):
        x, y = cx - 11 * k + rnd() * 22 * k, cy - 9 * k + rnd() * 18 * k
        for _ in range(3):
            nx, ny = x + (rnd() - 0.5) * 10 * k, y + (rnd() - 0.5) * 10 * k
            D.line(s, rgba(trace, 0.85), (x, y), (nx, ny), max(1, int(k)))
            x, y = nx, ny
    D.rr(s, (cx - 7 * k, cy - 5 * k, 11 * k, 8 * k), (26, 26, 30), int(k))
    D.rect(s, rgba(P.WHITE, 0.12), (cx - 6.4 * k, cy - 4.4 * k, 9.8 * k, k))
    for i in range(4):
        D.rect(s, P.GOLD, (cx - 9 * k, cy - 4 * k + i * 2 * k, 2 * k, k))
        D.rect(s, P.GOLD, (cx + 4 * k, cy - 4 * k + i * 2 * k, 2 * k, k))
    D.rr(s, (cx + 6 * k, cy + 3 * k, 5 * k, 4 * k), (176, 48, 38), int(k))
    D.circle(s, P.GLOW_COLD, cx + 8 * k, cy - 7 * k, 1.6 * k)


def _frame(s, cx, cy, k, art, rnd):
    def beam(x, y, w, h):
        D.grad_rect(s, (x, y, w, h), [(0.0, art['b']), (1.0, art['a'])], radius=int(1.5 * k))
        D.rr(s, (x, y, w, h), rgba(P.BLACK, 0.55), int(1.5 * k), 1)
    beam(cx - 14 * k, cy - 12 * k, 28 * k, 5 * k)
    beam(cx - 14 * k, cy + 8 * k, 28 * k, 5 * k)
    beam(cx - 14 * k, cy - 12 * k, 5 * k, 25 * k)
    beam(cx + 9 * k, cy - 12 * k, 5 * k, 25 * k)
    D.line(s, art['a'], (cx - 9 * k, cy - 7 * k), (cx + 9 * k, cy + 8 * k), max(2, int(3.4 * k)))
    D.line(s, art['a'], (cx + 9 * k, cy - 7 * k), (cx - 9 * k, cy + 8 * k), max(2, int(3.4 * k)))
    D.line(s, rgba(P.WHITE, 0.2), (cx - 9 * k, cy - 7 * k), (cx + 9 * k, cy + 8 * k), max(1, int(k)))
    for x, y in ((-11.5, -9.5), (11.5, -9.5), (-11.5, 10.5), (11.5, 10.5)):
        D.bolt(s, cx + x * k, cy + y * k, 1.8 * k)


def _motor(s, cx, cy, k, art, rnd):
    D.grad_rect(s, (cx - 12 * k, cy - 8 * k, 20 * k, 16 * k),
                [(0.0, shade(art['a'], 0.3)), (0.5, art['a']), (1.0, shade(art['a'], -0.35))],
                radius=int(4 * k))
    D.rr(s, (cx - 12 * k, cy - 8 * k, 20 * k, 16 * k), rgba(P.BLACK, 0.6), int(4 * k), 1)
    for i in range(-9, 6, 3):
        D.line(s, rgba(P.BLACK, 0.3), (cx + i * k, cy - 8 * k), (cx + i * k, cy + 8 * k), max(1, int(1.4 * k)))
    D.circle(s, art['b'], cx + 10 * k, cy, 6 * k)
    for i in range(1, 5):
        D.circle(s, shade(art['b'], -0.4), cx + 10 * k, cy, 1.2 * i * k, 1)
    D.rect(s, P.STEEL_HI, (cx - 16 * k, cy - 1.6 * k, 5 * k, 3.2 * k))
    D.bolt(s, cx - 10 * k, cy - 6 * k, 1.6 * k)
    D.bolt(s, cx - 10 * k, cy + 6 * k, 1.6 * k)


def _arm(s, cx, cy, k, art, rnd):
    cx -= 2 * k
    cy += 4 * k
    D.rr(s, (cx - 10 * k, cy + 4 * k, 20 * k, 7 * k), art['a'], int(2 * k))
    D.rr(s, (cx - 10 * k, cy + 4 * k, 20 * k, 7 * k), rgba(P.BLACK, 0.6), int(2 * k), 1)

    def seg(x1, y1, x2, y2, w):
        D.line(s, shade(art['b'], -0.25), (x1, y1), (x2, y2), max(2, int(w)))
        D.line(s, art['b'], (x1, y1), (x2, y2), max(1, int(w * 0.6)))
    seg(cx, cy + 3 * k, cx - 8 * k, cy - 8 * k, 6.5 * k)
    seg(cx - 8 * k, cy - 8 * k, cx + 8 * k, cy - 14 * k, 5.5 * k)
    D.circle(s, P.STEEL_DARK, cx, cy + 3 * k, 3 * k)
    D.circle(s, P.STEEL_DARK, cx - 8 * k, cy - 8 * k, 2.6 * k)
    D.line(s, P.STEEL_HI, (cx + 8 * k, cy - 14 * k), (cx + 13 * k, cy - 17 * k), max(1, int(2 * k)))
    D.line(s, P.STEEL_HI, (cx + 8 * k, cy - 14 * k), (cx + 13 * k, cy - 11 * k), max(1, int(2 * k)))


def _module(s, cx, cy, k, art, rnd):
    D.grad_rect(s, (cx - 13 * k, cy - 13 * k, 26 * k, 26 * k),
                [(0.0, shade(art['a'], 0.3)), (1.0, shade(art['a'], -0.3))], radius=int(3 * k))
    D.rr(s, (cx - 13 * k, cy - 13 * k, 26 * k, 26 * k), rgba(P.BLACK, 0.65), int(3 * k), max(1, int(1.2 * k)))
    D.glass_panel(s, (cx - 8 * k, cy - 8 * k, 16 * k, 16 * k), art['b'], 0.8, k)
    D.glow(s, cx, cy, 11 * k, art['b'], 0.4)
    D.circle(s, rgba(P.WHITE, 0.5), cx, cy, 5 * k, max(1, int(k)))
    D.circle(s, rgba(P.WHITE, 0.5), cx, cy, 2 * k, max(1, int(k)))
    for x, y in ((-10, -10), (10, -10), (-10, 10), (10, 10)):
        D.bolt(s, cx + x * k, cy + y * k, 1.7 * k)


def _crate(s, cx, cy, k, art, rnd):
    top = [(cx - 14 * k, cy - 6 * k), (cx, cy - 13 * k), (cx + 14 * k, cy - 6 * k), (cx, cy + k)]
    left = [(cx - 14 * k, cy - 6 * k), (cx, cy + k), (cx, cy + 14 * k), (cx - 14 * k, cy + 7 * k)]
    right = [(cx + 14 * k, cy - 6 * k), (cx, cy + k), (cx, cy + 14 * k), (cx + 14 * k, cy + 7 * k)]
    D.polygon(s, shade(art['b'], 0.15), top)
    D.polygon(s, art['a'], left)
    D.polygon(s, shade(art['a'], -0.25), right)
    for pts in (top, left, right):
        D.polygon(s, rgba(P.BLACK, 0.5), pts, max(1, int(k)))
    D.line(s, rgba(art['b'], 0.9), (cx - 7 * k, cy - 9.5 * k), (cx - 7 * k, cy + 10.5 * k), max(1, int(1.6 * k)))
    D.line(s, rgba(art['b'], 0.9), (cx + 7 * k, cy - 9.5 * k), (cx + 7 * k, cy + 10.5 * k), max(1, int(1.6 * k)))
    D.polygon(s, rgba((240, 234, 216), 0.75), [(cx - 10 * k, cy + 2 * k), (cx - 4 * k, cy + 5 * k),
                                               (cx - 4 * k, cy + 8 * k), (cx - 10 * k, cy + 5 * k)])


KINDS = {
    'rock': _rock, 'ore': _ore, 'log': _log, 'grain': _grain, 'fluid': _fluid,
    'plate': _plate, 'ingot': _ingot, 'sheet': _sheet, 'gear': _gear,
    'bracket': _bracket, 'coil': _coil, 'board': _board, 'frame': _frame,
    'motor': _motor, 'arm': _arm, 'module': _module, 'crate': _crate,
}
