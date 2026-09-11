"""Sprites for every placeable.

Painters get (surface, w, h, k, top): w/h are the footprint in supersampled
pixels, k is the supersample factor (multiply absolute sizes by it) and `top` is
the y of the footprint's top edge - anything above it is overhang (chimneys,
roofs, gantry signs).
"""
import math
import pygame

from ..core.rng import Rng
from ..core.utils import TAU, clamp
from ..data.buildables import BUILDABLES
from ..world.world import TILE
from . import draw as D
from . import palette as P
from .palette import mix, shade, rgba

HEAD = 18          # logical pixels of headroom above the footprint
_cache = {}


def rotates(bid):
    kind = BUILDABLES[bid]['kind']
    return kind in ('belt', 'dock', 'machine', 'miner', 'gen', 'store', 'service', 'lab')


def machine_sprite(bid, direction=0):
    """Returns dict(surf, head, tw, th) - surf includes HEAD pixels of overhang."""
    d = BUILDABLES.get(bid)
    if d is None:
        return None
    key = (bid, direction if rotates(bid) else 0)
    hit = _cache.get(key)
    if hit is not None:
        return hit
    swap = rotates(bid) and direction % 2 == 1 and d['w'] != d['h']
    tw, th = (d['h'], d['w']) if swap else (d['w'], d['h'])
    lw, lh = tw * TILE, th * TILE + HEAD

    painter = PAINTERS.get(bid, _generic)

    def paint(s, w, h, k, painter=painter, bid=bid, direction=direction):
        top = HEAD * k
        rnd = Rng(len(bid) * 7717 + ord(bid[0]) * 131 + direction * 17 + 5)
        D.drop_shadow(s, w / 2, h - 6 * k, w * 0.82, 15 * k, 0.4)
        painter(s, w, h - top, k, top, rnd)

    spr = D.render_sprite(lw, lh, paint)
    D.noise_overlay(spr, 0.03, 17 + len(bid))
    if pygame.display.get_surface():
        spr = spr.convert_alpha()
    out = dict(surf=spr, head=HEAD, tw=tw, th=th, w=lw, h=lh)
    _cache[key] = out
    return out


# ----------------------------------------------------------------- shared bits

def chassis(s, w, h, k, top, base=P.STEEL_LO, seed=1):
    """Bolted base plate with a shadowed skirt - most machines start here."""
    D.rr(s, (2 * k, top + h - 8 * k, w - 4 * k, 8 * k), rgba((10, 12, 15), 0.55), 3 * k)
    D.plate(s, (k, top + 2 * k, w - 2 * k, h - 4 * k), base, 4 * k, k)
    D.brushed(s, (k, top + 2 * k, w - 2 * k, h - 4 * k), seed, k=k)
    D.bolt_frame(s, (k, top + 2 * k, w - 2 * k, h - 4 * k), 5 * k, 2.1 * k)


def control_panel(s, x, y, w, h, k):
    D.plate(s, (x, y, w, h), P.STEEL_DARK, 2 * k, k)
    D.glass_panel(s, (x + 2 * k, y + 2 * k, w - 4 * k, h * 0.5), P.GLOW_COLD, 0.7, k)
    for i, col in enumerate((P.UI_GOOD, P.UI_WARN, P.GLOW_COLD)):
        D.led(s, x + 4 * k + i * 5 * k, y + h - 3.5 * k, 1.4 * k, col)


def _generic(s, w, h, k, top, rnd):
    chassis(s, w, h, k, top, P.STEEL_LO, 3)
    D.plate(s, (w * 0.2, top + h * 0.2, w * 0.6, h * 0.5), P.STEEL_MID, 3 * k, k)
    D.gauge(s, w * 0.75, top + h * 0.28, 4 * k, k)


# ----------------------------------------------------------------- logistics

def _belt(s, w, h, k, top, rnd, fast=False):
    # Painted pointing north; the renderer rotates the finished sprite.
    D.plate(s, (0, top, w, h), P.STEEL_LO, k, k)
    D.rect(s, P.STEEL_DARK, (0, top, 4 * k, h))
    D.rect(s, P.STEEL_DARK, (w - 4 * k, top, 4 * k, h))
    D.rect(s, rgba(P.WHITE, 0.12), (k, top, 1.2 * k, h))
    D.rect(s, rgba(P.WHITE, 0.12), (w - 3 * k, top, 1.2 * k, h))
    D.grad_rect(s, (4 * k, top, w - 8 * k, h),
                [(0.0, P.RUBBER_HI), (0.25, P.RUBBER), (1.0, (27, 27, 32))])
    y = 0
    while y < h:
        D.rect(s, rgba(P.BLACK, 0.35), (4 * k, top + y, w - 8 * k, 1.6 * k))
        D.rect(s, rgba(P.WHITE, 0.06), (4 * k, top + y + 1.6 * k, w - 8 * k, 0.8 * k))
        y += 5 * k
    D.polygon(s, rgba(P.YELLOW if fast else P.ORANGE, 0.95), [
        (w / 2, top + h * 0.24), (w * 0.72, top + h * 0.5),
        (w / 2, top + h * 0.42), (w * 0.28, top + h * 0.5)])
    for ry in (top + 2.2 * k, top + h - 2.2 * k):
        D.rr(s, (3 * k, ry - 1.6 * k, w - 6 * k, 3.2 * k), P.STEEL_MID, 1.4 * k)
        D.rect(s, rgba(P.WHITE, 0.18), (3 * k, ry - 1.6 * k, w - 6 * k, 0.9 * k))
    for bx, by in ((2.4, 3), (w / k - 2.4, 3), (2.4, h / k - 3), (w / k - 2.4, h / k - 3)):
        D.bolt(s, bx * k, top + by * k, 1.2 * k)


def _pipe(s, w, h, k, top, rnd):
    D.rect(s, rgba((10, 12, 15), 0.3), (4 * k, top + h - 6 * k, w - 8 * k, 5 * k))
    D.pipe(s, w / 2, top, w / 2, top + h, 14 * k, P.STEEL)
    D.pipe(s, 0, top + h / 2, w, top + h / 2, 14 * k, P.STEEL)
    D.circle(s, P.STEEL_MID, w / 2, top + h / 2, 8 * k)
    D.circle(s, rgba(P.BLACK, 0.5), w / 2, top + h / 2, 8 * k, k)
    D.circle(s, rgba(P.WHITE, 0.2), w / 2 - 2 * k, top + h / 2 - 2.4 * k, 3.4 * k)
    D.bolt(s, w / 2 - 6 * k, top + h / 2 - 6 * k, 1.3 * k)
    D.bolt(s, w / 2 + 6 * k, top + h / 2 + 6 * k, 1.3 * k)


def _cable(s, w, h, k, top, rnd):
    D.rect(s, rgba((10, 12, 15), 0.25), (2 * k, top + h - 5 * k, w - 4 * k, 4 * k))
    for col, wd in ((P.STEEL_DARK, 7), ((23, 27, 32), 5)):
        D.line(s, col, (w / 2, top), (w / 2, top + h), wd * k)
        D.line(s, col, (0, top + h / 2), (w, top + h / 2), wd * k)
    D.line(s, P.ORANGE, (w / 2 - 1.4 * k, top), (w / 2 - 1.4 * k, top + h), 1.6 * k)
    D.line(s, P.ORANGE, (0, top + h / 2 - 1.4 * k), (w, top + h / 2 - 1.4 * k), 1.6 * k)
    D.line(s, P.COPPER_HI, (w / 2 + 1.6 * k, top), (w / 2 + 1.6 * k, top + h), k)
    D.line(s, P.COPPER_HI, (0, top + h / 2 + 1.6 * k), (w, top + h / 2 + 1.6 * k), k)
    D.plate(s, (w / 2 - 6 * k, top + h / 2 - 6 * k, 12 * k, 12 * k), P.STEEL_MID, 2 * k, k)
    D.bolt(s, w / 2, top + h / 2, 2.2 * k, P.BRASS)


def _chest(s, w, h, k, top, rnd):
    chassis(s, w, h, k, top, P.BLUE, 11)
    D.plate(s, (4 * k, top + 5 * k, w - 8 * k, h - 12 * k), shade(P.BLUE, -0.12), 2 * k, k)
    D.rect(s, rgba(P.BLACK, 0.3), (5 * k, top + h / 2 - k, w - 10 * k, 2 * k))
    D.hazard(s, (4 * k, top + h - 11 * k, w - 8 * k, 4 * k), pitch=int(5 * k))
    D.rr(s, (w / 2 - 5 * k, top + h / 2 - 3.5 * k, 10 * k, 4 * k), P.STEEL_HI, 1.5 * k)
    D.grime(s, (0, top, w, h), 21, 0.8, k)


def _warehouse(s, w, h, k, top, rnd):
    D.rr(s, (0, top + 2 * k, w, h - 2 * k), P.CONCRETE_LO, 4 * k)
    D.plate(s, (0, 2 * k, w, h + top - 6 * k), (139, 133, 121), 5 * k, k)
    for x in range(int(6 * k), int(w), int(12 * k)):
        D.rect(s, rgba(P.BLACK, 0.16), (x, 2 * k, 3 * k, h + top))
        D.rect(s, rgba(P.WHITE, 0.08), (x + 3 * k, 2 * k, 1.4 * k, h + top))
    for i in range(3):
        D.glass_panel(s, (w * 0.12 + i * w * 0.3, 10 * k, w * 0.18, 14 * k), P.GLASS, 0.55, k)
    for i in range(2):
        dx = w * 0.16 + i * w * 0.46
        D.plate(s, (dx, top + h - 22 * k, w * 0.22, 20 * k), P.STEEL_LO, 2 * k, k)
        for kk in range(5):
            D.rect(s, rgba(P.BLACK, 0.22), (dx, top + h - 20 * k + kk * 4 * k, w * 0.22, 1.6 * k))
        D.hazard(s, (dx, top + h - 5 * k, w * 0.22, 4 * k), pitch=int(5 * k))
    D.bolt_frame(s, (0, 2 * k, w, h + top - 6 * k), 6 * k, 2.2 * k)
    D.grime(s, (0, top, w, h), 44, 0.9, k)


def _dock(s, w, h, k, top, rnd):
    D.rr(s, (0, top, w, h), P.CONCRETE, 3 * k)
    for x in range(0, int(w), int(16 * k)):
        D.line(s, rgba((61, 59, 54), 0.5), (x, top), (x, top + h), 1.4 * k)
    for y in range(0, int(h), int(16 * k)):
        D.line(s, rgba((61, 59, 54), 0.35), (0, top + y), (w, top + y), 1.2 * k)
    D.rect(s, rgba(P.YELLOW, 0.7), (6 * k, top + 6 * k, w - 12 * k, h - 18 * k), max(1, int(2 * k)))
    D.plate(s, (5 * k, top + 4 * k, w - 10 * k, h - 20 * k), P.STEEL_LO, 2 * k, k)
    D.brushed(s, (5 * k, top + 4 * k, w - 10 * k, h - 20 * k), 26, k=k)
    for x in range(int(9 * k), int(w - 10 * k), int(8 * k)):
        D.rr(s, (x, top + h - 22 * k, 5 * k, 5 * k), P.STEEL_HI, 2 * k)
    # pallet of crates waiting for pickup
    px, py = w * 0.16, top + h * 0.3
    D.rect(s, (107, 80, 39), (px, py + 13 * k, 20 * k, 3.4 * k))
    D.plate(s, (px + k, py, 18 * k, 14 * k), (165, 128, 74), k, k)
    D.line(s, (74, 55, 23), (px + k, py), (px + 19 * k, py + 14 * k), k)
    D.line(s, (74, 55, 23), (px + 19 * k, py), (px + k, py + 14 * k), k)
    for i in range(3):
        bx = 8 * k + i * ((w - 26 * k) / 2)
        D.rr(s, (bx, top + h - 15 * k, 13 * k, 7 * k), P.RUBBER, 2 * k)
    for bx in (3 * k, w - 7 * k):
        D.rr(s, (bx, top + h - 26 * k, 4.5 * k, 12 * k), P.YELLOW, 2 * k)
        D.rect(s, rgba(P.BLACK, 0.45), (bx, top + h - 21 * k, 4.5 * k, 3 * k))
    D.hazard(s, (0, top + h - 9 * k, w, 8 * k), pitch=int(7 * k))
    D.rect(s, P.STEEL_DARK, (w * 0.3 - 3 * k, top - 12 * k, 3 * k, 14 * k))
    D.rect(s, P.STEEL_DARK, (w * 0.7, top - 12 * k, 3 * k, 14 * k))
    D.plate(s, (w * 0.28, top - 16 * k, w * 0.44, 13 * k), P.GREEN, 2 * k, k)
    D.led(s, w - 9 * k, top + 9 * k, 2.4 * k, P.UI_GOOD)
    D.led(s, w - 9 * k, top + 17 * k, 2.4 * k, P.YELLOW)
    D.grime(s, (0, top, w, h), 66, 0.7, k)


# ----------------------------------------------------------------- extraction

def _miner(s, w, h, k, top, rnd, deep=False):
    chassis(s, w, h, k, top, P.YELLOW if deep else P.ORANGE, 5)
    D.plate(s, (w * 0.16, top + h * 0.12, w * 0.68, h * 0.56), P.STEEL_LO, 3 * k, k)
    D.vents(s, (w * 0.2, top + h * 0.18, w * 0.2, h * 0.4), 4)
    cx, cy = w * 0.62, top + h * 0.58
    D.circle(s, P.STEEL_DARK, cx, cy, 10 * k)
    D.circle(s, P.STEEL_MID, cx, cy, 7.5 * k)
    D.circle(s, rgba(P.BLACK, 0.5), cx, cy, 7.5 * k, k)
    D.plate(s, (w - 12 * k, top + h * 0.62, 10 * k, h * 0.3), P.STEEL_MID, 2 * k, k)
    D.hazard(s, (2 * k, top + h - 9 * k, w - 4 * k, 6 * k), pitch=int(6 * k))
    D.gauge(s, w * 0.22, top + h * 0.76, 4.5 * k, k)
    control_panel(s, w * 0.36, top + h * 0.72, 16 * k, 10 * k, k)
    if deep:
        D.led(s, w - 7 * k, top + 7 * k, 2 * k, P.GLOW_COLD)
        D.plate(s, (4 * k, top + 4 * k, 10 * k, 10 * k), P.STEEL_HI, 2 * k, k)
    D.grime(s, (0, top, w, h), 9, 1.0, k)


def _waterpump(s, w, h, k, top, rnd):
    chassis(s, w, h, k, top, P.BLUE, 13)
    cx, cy = w * 0.38, top + h * 0.45
    D.circle(s, P.STEEL_MID, cx, cy, 13 * k)
    D.circle(s, P.STEEL_LO, cx, cy, 9 * k)
    D.circle(s, rgba(P.BLACK, 0.55), cx, cy, 9 * k, max(1, int(1.2 * k)))
    for i in range(6):
        a = i / 6 * TAU
        D.bolt(s, cx + math.cos(a) * 11 * k, cy + math.sin(a) * 11 * k, 1.5 * k)
    D.pipe(s, cx, cy, w - 4 * k, cy, 9 * k, P.STEEL)
    D.pipe(s, cx, cy, cx, top + h - 2 * k, 9 * k, P.STEEL)
    D.plate(s, (w * 0.58, top + h * 0.12, w * 0.34, h * 0.3), P.STEEL_LO, 2 * k, k)
    D.vents(s, (w * 0.62, top + h * 0.16, w * 0.26, h * 0.22), 3)
    D.gauge(s, w * 0.82, top + h * 0.62, 5 * k, k)
    D.grime(s, (0, top, w, h), 27, 0.8, k)


# ----------------------------------------------------------------- processing

def _furnace(s, w, h, k, top, rnd):
    chassis(s, w, h, k, top, P.IRON_LO, 2)
    D.plate(s, (4 * k, top + 4 * k, w - 8 * k, h - 12 * k), (122, 74, 51), 3 * k, k)
    y = top + 6 * k
    row = 0
    while y < top + h - 8 * k:
        D.line(s, rgba(P.BLACK, 0.22), (4 * k, y), (w - 4 * k, y), k)
        off = 7 * k if row % 2 else 0
        x = 4 * k + off
        while x < w - 4 * k:
            D.line(s, rgba(P.BLACK, 0.22), (x, y), (x, y + 7 * k), k)
            x += 14 * k
        y += 7 * k
        row += 1
    dw = w * 0.36
    dx, dy = w / 2 - dw / 2, top + h * 0.42
    D.rr(s, (dx, dy, dw, h * 0.3), (20, 12, 8), 3 * k)
    D.rr(s, (dx, dy, dw, h * 0.3), P.STEEL_DARK, 3 * k, max(1, int(2.4 * k)))
    D.rr(s, (dx + dw * 0.35, dy + h * 0.12, dw * 0.3, 3.4 * k), P.STEEL_MID, 1.5 * k)
    D.plate(s, (w - 18 * k, top - 14 * k, 13 * k, 26 * k), P.IRON, 2 * k, k)
    D.ellipse(s, (20, 20, 15), w - 11.5 * k, top - 13 * k, 6.5 * k, 2.6 * k)
    D.rect(s, rgba(P.RUST, 0.5), (w - 18 * k, top - 4 * k, 13 * k, 3 * k))
    D.gauge(s, 12 * k, top + h * 0.26, 5.5 * k, k)
    D.led(s, 12 * k, top + h * 0.5, 2 * k, P.GLOW_HOT)
    D.hazard(s, (3 * k, top + h - 9 * k, w - 6 * k, 6 * k), pitch=int(6 * k))
    D.grime(s, (0, top, w, h), 4, 1.3, k)


def _press(s, w, h, k, top, rnd):
    chassis(s, w, h, k, top, P.GREEN, 8)
    D.plate(s, (w * 0.1, top + h * 0.08, w * 0.8, h * 0.34), P.STEEL_LO, 3 * k, k)
    D.plate(s, (w * 0.1, top + h * 0.62, w * 0.8, h * 0.28), P.STEEL_LO, 3 * k, k)
    D.plate(s, (w * 0.12, top + h * 0.4, w * 0.14, h * 0.26), P.STEEL_MID, 2 * k, k)
    D.plate(s, (w * 0.74, top + h * 0.4, w * 0.14, h * 0.26), P.STEEL_MID, 2 * k, k)
    D.rect(s, rgba((13, 15, 18), 0.6), (w * 0.3, top + h * 0.4, w * 0.4, h * 0.24))
    D.rect(s, P.STEEL_DARK, (w * 0.32, top + h * 0.42, w * 0.36, h * 0.1))
    D.plate(s, (w * 0.34, top + h * 0.66, w * 0.32, h * 0.14), P.BRASS, k, k)
    D.bolt_frame(s, (w * 0.1, top + h * 0.08, w * 0.8, h * 0.34), 5 * k, 2 * k)
    D.gauge(s, w * 0.2, top + h * 0.2, 5 * k, k)
    control_panel(s, w * 0.58, top + h * 0.14, 18 * k, 12 * k, k)
    D.hazard(s, (3 * k, top + h - 9 * k, w - 6 * k, 6 * k), pitch=int(6 * k))
    D.grime(s, (0, top, w, h), 14, 1.0, k)


def _cutter(s, w, h, k, top, rnd):
    chassis(s, w, h, k, top, P.BLUE, 6)
    D.plate(s, (5 * k, top + 6 * k, w - 10 * k, h * 0.5), P.STEEL_LO, 3 * k, k)
    cx, cy = w * 0.5, top + h * 0.42
    D.arc(s, P.STEEL_DARK, cx, cy, 13 * k, 0, math.pi, max(2, int(4 * k)))
    D.arc(s, P.STEEL_MID, cx, cy, 11 * k, 0, math.pi, max(2, int(3 * k)))
    D.plate(s, (5 * k, top + h * 0.6, w - 10 * k, h * 0.28), P.STEEL_MID, 2 * k, k)
    D.rect(s, (17, 20, 24), (cx - 2 * k, top + h * 0.6, 4 * k, h * 0.28))
    D.plate(s, (w - 16 * k, top + h * 0.62, 12 * k, h * 0.24), P.GREEN_LO, 2 * k, k)
    D.glass_panel(s, (w - 13 * k, top + h * 0.66, 6 * k, h * 0.16), P.GLASS, 0.6, k)
    D.gauge(s, 12 * k, top + h * 0.72, 4.5 * k, k)
    D.hazard(s, (3 * k, top + h - 9 * k, w - 6 * k, 6 * k), pitch=int(6 * k))
    D.grime(s, (0, top, w, h), 18, 0.9, k)


def _assembler(s, w, h, k, top, rnd):
    chassis(s, w, h, k, top, P.STEEL_LO, 12)
    D.plate(s, (4 * k, top + 4 * k, w - 8 * k, h - 14 * k), P.STEEL_DARK, 3 * k, k)
    D.glass_panel(s, (7 * k, top + 7 * k, w - 14 * k, h - 22 * k), P.GLASS, 0.3, k)
    D.plate(s, (w * 0.2, top + h * 0.42, w * 0.6, h * 0.28), P.STEEL_MID, 2 * k, k)
    D.rect(s, rgba(P.ORANGE, 0.8), (w * 0.24, top + h * 0.48, w * 0.52, 2.4 * k))
    for ax in (w * 0.28, w * 0.72):
        D.circle(s, P.STEEL_DARK, ax, top + h * 0.3, 6 * k)
        D.circle(s, P.ORANGE, ax, top + h * 0.3, 4 * k)
    control_panel(s, w - 26 * k, top + h - 26 * k, 20 * k, 14 * k, k)
    D.led(s, 10 * k, top + 10 * k, 2.4 * k, P.UI_GOOD)
    D.hazard(s, (3 * k, top + h - 9 * k, w - 6 * k, 6 * k), pitch=int(6 * k))
    D.bolt_frame(s, (4 * k, top + 4 * k, w - 8 * k, h - 14 * k), 5 * k, 2 * k)
    D.grime(s, (0, top, w, h), 24, 0.7, k)


def _chemical(s, w, h, k, top, rnd):
    chassis(s, w, h, k, top, P.STEEL_LO, 15)
    for i in range(3):
        cx = w * (0.22 + i * 0.28)
        cy = top + h * 0.42
        r = min(w, h) * 0.13
        D.circle(s, P.STEEL_DARK, cx, cy, r + 2 * k)
        D.circle(s, P.STEEL, cx, cy, r)
        D.circle(s, shade(P.STEEL, 0.3), cx - r * 0.35, cy - r * 0.4, r * 0.55)
        D.glass_panel(s, (cx - 2.5 * k, cy - r * 0.7, 5 * k, r * 1.4), (127, 208, 138), 0.7, k)
        D.circle(s, rgba(P.BLACK, 0.45), cx, cy, r, k)
        for j in range(6):
            a = j / 6 * TAU
            D.bolt(s, cx + math.cos(a) * (r + k), cy + math.sin(a) * (r + k), 1.3 * k)
    for i in range(2):
        D.pipe(s, 4 * k, top + h * 0.74 + i * 6 * k, w - 4 * k, top + h * 0.74 + i * 6 * k, 4.4 * k)
    D.pipe(s, w * 0.22, top + h * 0.28, w * 0.78, top + h * 0.28, 5 * k, P.COPPER)
    D.plate(s, (w - 16 * k, top - 12 * k, 10 * k, 22 * k), P.STEEL_MID, 2 * k, k)
    D.sign(s, (6 * k, top + h * 0.8, 11 * k, 11 * k), P.YELLOW, 'excl', k)
    D.gauge(s, w * 0.86, top + h * 0.5, 5 * k, k)
    D.grime(s, (0, top, w, h), 35, 0.9, k)


def _packager(s, w, h, k, top, rnd):
    chassis(s, w, h, k, top, P.YELLOW, 19)
    D.plate(s, (4 * k, top + 5 * k, w - 8 * k, h * 0.44), P.STEEL_LO, 3 * k, k)
    D.rr(s, (w * 0.18, top + h * 0.16, w * 0.64, h * 0.24), (20, 23, 27), 3 * k)
    D.rect(s, rgba(P.GLOW_COLD, 0.25), (w * 0.2, top + h * 0.2, w * 0.6, 2 * k))
    D.plate(s, (2 * k, top + h * 0.56, w - 4 * k, h * 0.24), P.STEEL_MID, 2 * k, k)
    x = 6 * k
    while x < w - 6 * k:
        D.rr(s, (x, top + h * 0.58, 4.4 * k, h * 0.2), P.STEEL_HI, 2 * k)
        D.rect(s, rgba(P.BLACK, 0.25), (x, top + h * 0.58, 1.2 * k, h * 0.2))
        x += 7 * k
    D.plate(s, (w - 20 * k, top + h * 0.6, 15 * k, 14 * k), (165, 128, 74), k, k)
    control_panel(s, 6 * k, top + h * 0.82, 18 * k, 11 * k, k)
    D.hazard(s, (3 * k, top + h - 8 * k, w - 6 * k, 5 * k), pitch=int(6 * k))
    D.grime(s, (0, top, w, h), 41, 0.8, k)


def _recycler(s, w, h, k, top, rnd):
    chassis(s, w, h, k, top, P.GREEN, 22)
    D.polygon(s, P.STEEL_MID, [(w * 0.14, top + 6 * k), (w * 0.86, top + 6 * k),
                               (w * 0.66, top + h * 0.42), (w * 0.34, top + h * 0.42)])
    D.polygon(s, rgba(P.BLACK, 0.6), [(w * 0.14, top + 6 * k), (w * 0.86, top + 6 * k),
                                      (w * 0.66, top + h * 0.42), (w * 0.34, top + h * 0.42)], max(1, int(1.2 * k)))
    for i in range(7):
        x = w * 0.36 + i * (w * 0.28 / 6)
        D.polygon(s, P.STEEL_HI, [(x, top + h * 0.42), (x + 2.6 * k, top + h * 0.42),
                                  (x + 1.3 * k, top + h * 0.5)])
    D.plate(s, (4 * k, top + h * 0.56, w - 8 * k, h * 0.3), P.STEEL_LO, 2 * k, k)
    cx, cy, r = w * 0.5, top + h * 0.7, min(w, h) * 0.1
    for i in range(3):
        a0 = i / 3 * TAU - 0.4
        D.arc(s, rgba((223, 240, 223), 0.85), cx, cy, r, a0, a0 + 1.4, max(1, int(2.2 * k)))
    D.gauge(s, w - 12 * k, top + h * 0.7, 4.5 * k, k)
    D.hazard(s, (3 * k, top + h - 8 * k, w - 6 * k, 5 * k), pitch=int(6 * k))
    D.grime(s, (0, top, w, h), 48, 0.9, k)


def _robotics(s, w, h, k, top, rnd):
    chassis(s, w, h, k, top, (47, 58, 70), 28)
    D.plate(s, (4 * k, top + 4 * k, w - 8 * k, h - 14 * k), (29, 38, 48), 4 * k, k)
    D.rect(s, (16, 24, 32), (6 * k, top + 6 * k, w - 12 * k, h - 18 * k))
    for x in range(int(6 * k), int(w), int(10 * k)):
        D.line(s, rgba(P.GLOW_COLD, 0.3), (x, top + 6 * k), (x, top + h - 12 * k), k)
    for y in range(int(6 * k), int(h - 12 * k), int(10 * k)):
        D.line(s, rgba(P.GLOW_COLD, 0.3), (6 * k, top + y), (w - 6 * k, top + y), k)
    for ax, ay in ((w * 0.26, h * 0.3), (w * 0.74, h * 0.3), (w * 0.5, h * 0.7)):
        D.circle(s, P.STEEL_DARK, ax, top + ay, 7.5 * k)
        D.circle(s, P.ORANGE, ax, top + ay, 5 * k)
        D.circle(s, rgba(P.WHITE, 0.25), ax - 1.4 * k, top + ay - 1.6 * k, 2 * k)
    D.plate(s, (w - 14 * k, top + 8 * k, 9 * k, h * 0.4), P.STEEL_LO, 2 * k, k)
    for i, col in enumerate((P.UI_GOOD, P.GLOW_COLD, P.UI_WARN)):
        D.led(s, w - 9.5 * k, top + 14 * k + i * 7 * k, 2 * k, col)
    D.glass_panel(s, (8 * k, top + h - 26 * k, w * 0.3, 14 * k), P.GLOW_COLD, 0.75, k)
    D.bolt_frame(s, (4 * k, top + 4 * k, w - 8 * k, h - 14 * k), 6 * k, 2.2 * k)


# ----------------------------------------------------------------- power

def _coal_gen(s, w, h, k, top, rnd):
    chassis(s, w, h, k, top, P.IRON_LO, 31)
    by, bh = top + h * 0.42, h * 0.4
    D.grad_rect(s, (5 * k, by - bh / 2, w - 26 * k, bh),
                [(0.0, P.STEEL_HI), (0.3, P.STEEL), (1.0, P.STEEL_DARK)], radius=int(bh / 2))
    D.rr(s, (5 * k, by - bh / 2, w - 26 * k, bh), rgba(P.BLACK, 0.55), int(bh / 2), max(1, int(1.2 * k)))
    for i in range(1, 4):
        x = 5 * k + (w - 26 * k) * i / 4
        D.line(s, rgba(P.BLACK, 0.3), (x, by - bh / 2), (x, by + bh / 2), 1.6 * k)
    D.plate(s, (8 * k, by + bh / 2 - 2 * k, 20 * k, 12 * k), (58, 42, 32), 2 * k, k)
    D.rect(s, (18, 10, 6), (10 * k, by + bh / 2, 16 * k, 8 * k))
    for i in range(4):
        D.rect(s, P.IRON_DARK, (11 * k + i * 4 * k, by + bh / 2, 1.6 * k, 8 * k))
    D.plate(s, (w - 20 * k, top - 14 * k, 14 * k, 30 * k), P.IRON, 2 * k, k)
    D.ellipse(s, (20, 20, 15), w - 13 * k, top - 13 * k, 7 * k, 2.8 * k)
    D.plate(s, (w - 22 * k, top + h * 0.55, 18 * k, h * 0.3), P.COPPER_LO, 2 * k, k)
    for i in range(5):
        D.rect(s, rgba(P.COPPER_HI, 0.7), (w - 21 * k, top + h * 0.57 + i * 3 * k, 16 * k, 1.4 * k))
    D.gauge(s, 14 * k, top + h * 0.2, 5.5 * k, k)
    D.led(s, w - 30 * k, top + h * 0.2, 2.2 * k, P.UI_GOOD)
    D.hazard(s, (3 * k, top + h - 8 * k, w - 6 * k, 5 * k), pitch=int(6 * k))
    D.grime(s, (0, top, w, h), 52, 1.2, k)


def _solar(s, w, h, k, top, rnd):
    D.rr(s, (3 * k, top + h - 7 * k, w - 6 * k, 6 * k), rgba((10, 12, 15), 0.35), 2 * k)
    D.plate(s, (k, top + k, w - 2 * k, h - 6 * k), P.STEEL_MID, 2 * k, k)
    pad = 4 * k
    cw = (w - pad * 2) / 4
    ch = (h - 6 * k - pad * 2) / 4
    for y in range(4):
        for x in range(4):
            px, py = pad + x * cw, top + pad + y * ch
            D.grad_rect(s, (px + 0.6 * k, py + 0.6 * k, cw - 1.2 * k, ch - 1.2 * k),
                        [(0.0, (43, 63, 110)), (0.5, (27, 42, 78)), (1.0, (51, 80, 127))])
            D.rect(s, rgba((143, 180, 224), 0.35), (px + 0.6 * k, py + 0.6 * k, cw - 1.2 * k, ch - 1.2 * k), 1)
            D.line(s, rgba((207, 226, 245), 0.22), (px + cw * 0.5, py), (px + cw * 0.5, py + ch), 1)
    sh = D.surf(int(w), int(h))
    D.polygon(sh, rgba(P.WHITE, 0.12), [(0, h), (w * 0.5, 0), (w * 0.78, 0), (w * 0.2, h)])
    s.blit(sh, (0, int(top)))
    D.bolt_frame(s, (k, top + k, w - 2 * k, h - 6 * k), 4 * k, 1.8 * k)
    D.led(s, w - 5 * k, top + h - 4 * k, 1.8 * k, P.UI_GOOD)


def _turbine(s, w, h, k, top, rnd):
    chassis(s, w, h, k, top, P.STEEL_LO, 37)
    cy, ch = top + h * 0.44, h * 0.42
    D.grad_rect(s, (6 * k, cy - ch / 2, w - 12 * k, ch),
                [(0.0, P.STEEL_HI), (0.28, P.STEEL), (1.0, P.STEEL_DARK)], radius=int(8 * k))
    D.rr(s, (6 * k, cy - ch / 2, w - 12 * k, ch), rgba(P.BLACK, 0.6), int(8 * k), max(1, int(1.3 * k)))
    D.rect(s, rgba(P.BLACK, 0.3), (6 * k, cy - 1.2 * k, w - 12 * k, 2.4 * k))
    for i in range(8):
        D.bolt(s, 10 * k + i * (w - 20 * k) / 7, cy, 1.6 * k, P.BRASS)
    D.circle(s, P.STEEL_DARK, w * 0.2, cy, 9 * k)
    D.pipe(s, 4 * k, top + h * 0.82, w - 4 * k, top + h * 0.82, 8 * k, P.STEEL)
    D.pipe(s, w * 0.75, top + h * 0.82, w * 0.75, cy + ch / 2, 8 * k, P.STEEL)
    D.plate(s, (w - 22 * k, top - 12 * k, 14 * k, 24 * k), P.STEEL_MID, 2 * k, k)
    D.gauge(s, 14 * k, top + h * 0.18, 6 * k, k)
    D.gauge(s, 28 * k, top + h * 0.18, 4.5 * k, k)
    control_panel(s, w - 34 * k, top + h * 0.12, 22 * k, 14 * k, k)
    D.hazard(s, (3 * k, top + h - 8 * k, w - 6 * k, 5 * k), pitch=int(6 * k))
    D.grime(s, (0, top, w, h), 58, 0.8, k)


def _fusion(s, w, h, k, top, rnd):
    chassis(s, w, h, k, top, (36, 48, 64), 44)
    D.plate(s, (4 * k, top + 4 * k, w - 8 * k, h - 14 * k), (22, 32, 44), 6 * k, k)
    cx, cy = w / 2, top + h * 0.46
    R = min(w, h) * 0.3
    D.circle(s, P.STEEL_MID, cx, cy, R, max(2, int(10 * k)))
    D.circle(s, P.STEEL_HI, cx, cy, R - 3 * k, max(1, int(3 * k)))
    for i in range(12):
        a = i / 12 * TAU
        D.plate(s, (cx + math.cos(a) * R - 4 * k, cy + math.sin(a) * R - 4 * k, 8 * k, 8 * k),
                P.STEEL_LO, k, k)
    D.glow(s, cx, cy, R * 0.95, P.GLOW_COLD, 0.55)
    D.circle(s, rgba(P.WHITE, 0.8), cx, cy, R * 0.22)
    for a in (0.4, 2.0, 3.6, 5.2):
        D.pipe(s, cx + math.cos(a) * R, cy + math.sin(a) * R,
               cx + math.cos(a) * (R + 16 * k), cy + math.sin(a) * (R + 16 * k), 6 * k)
    D.glass_panel(s, (8 * k, top + h - 26 * k, w * 0.26, 14 * k), P.GLOW_COLD, 0.8, k)
    D.bolt_frame(s, (4 * k, top + 4 * k, w - 8 * k, h - 14 * k), 7 * k, 2.4 * k)


def _lamp(s, w, h, k, top, rnd):
    D.ellipse(s, rgba((10, 12, 15), 0.3), w / 2, top + h - 4 * k, 7 * k, 3 * k)
    D.rr(s, (w / 2 - 5 * k, top + h - 8 * k, 10 * k, 5 * k), P.STEEL_DARK, 2 * k)
    D.grad_rect(s, (w / 2 - 2 * k, top + h - 26 * k, 4 * k, 20 * k),
                [(0.0, P.STEEL), (1.0, P.STEEL_DARK)])
    D.polygon(s, P.GREEN, [(w / 2 - 10 * k, top + h - 26 * k), (w / 2 + 10 * k, top + h - 26 * k),
                           (w / 2 + 6 * k, top + h - 33 * k), (w / 2 - 6 * k, top + h - 33 * k)])
    D.polygon(s, rgba(P.BLACK, 0.5), [(w / 2 - 10 * k, top + h - 26 * k), (w / 2 + 10 * k, top + h - 26 * k),
                                      (w / 2 + 6 * k, top + h - 33 * k), (w / 2 - 6 * k, top + h - 33 * k)], k)
    D.rr(s, (w / 2 - 8 * k, top + h - 27 * k, 16 * k, 2.6 * k), rgba(P.GLOW_WARM, 0.95), 1.2 * k)


# ----------------------------------------------------------------- structures

def _floor(s, w, h, k, top, rnd):
    D.rect(s, P.CONCRETE, (0, top, w, h))
    for _ in range(26):
        D.ellipse(s, rgba(P.CONCRETE_HI if rnd() > 0.5 else P.CONCRETE_LO, 0.35),
                  rnd() * w, top + rnd() * h, 1.6 * k, 1.2 * k)
    D.rect(s, rgba((61, 59, 54), 0.6), (0.8 * k, top + 0.8 * k, w - 1.6 * k, h - 1.6 * k), max(1, int(1.6 * k)))
    D.rect(s, rgba(P.WHITE, 0.10), (2.4 * k, top + 2.4 * k, w - 4.8 * k, h - 4.8 * k), max(1, int(k)))


def _wall(s, w, h, k, top, rnd):
    D.plate(s, (0, top - 10 * k, w, h + 10 * k), P.STEEL_MID, k, k)
    for x in range(int(2 * k), int(w), int(6 * k)):
        D.rect(s, rgba(P.BLACK, 0.24), (x, top - 10 * k, 2.6 * k, h + 10 * k))
        D.rect(s, rgba(P.WHITE, 0.1), (x + 2.6 * k, top - 10 * k, 1.2 * k, h + 10 * k))
    D.rect(s, rgba((12, 14, 17), 0.6), (0, top + h - 5 * k, w, 5 * k))
    D.rect(s, P.STEEL_DARK, (0, top - 10 * k, w, 3 * k))
    D.grime(s, (0, top - 10 * k, w, h + 10 * k), 71, 0.9, k)


def _door(s, w, h, k, top, rnd):
    D.plate(s, (0, top - 10 * k, w, h + 10 * k), P.STEEL_LO, k, k)
    for i in range(8):
        D.rect(s, rgba(P.BLACK, 0.22), (k, top - 9 * k + i * 5 * k, w - 2 * k, 2 * k))
        D.rect(s, rgba(P.WHITE, 0.09), (k, top - 7 * k + i * 5 * k, w - 2 * k, k))
    D.hazard(s, (0, top + h - 7 * k, w, 6 * k), pitch=int(5 * k))
    D.rr(s, (w / 2 - 5 * k, top + h - 14 * k, 10 * k, 3 * k), P.STEEL_HI, 1.4 * k)
    D.led(s, w - 4 * k, top - 6 * k, 1.6 * k, P.UI_GOOD)


def _window(s, w, h, k, top, rnd):
    D.plate(s, (0, top - 10 * k, w, h + 10 * k), P.STEEL_MID, k, k)
    D.glass_panel(s, (3 * k, top - 7 * k, w - 6 * k, h + 3 * k), P.GLASS, 0.45, k)
    D.line(s, P.STEEL_DARK, (w / 2, top - 7 * k), (w / 2, top + h - 4 * k), 1.6 * k)
    D.line(s, P.STEEL_DARK, (3 * k, top + (h - 10 * k) / 2), (w - 3 * k, top + (h - 10 * k) / 2), 1.6 * k)
    D.grime(s, (0, top - 10 * k, w, h + 10 * k), 73, 0.6, k)


def _office(s, w, h, k, top, rnd):
    D.rr(s, (0, top + 2 * k, w, h - 2 * k), P.CONCRETE_LO, 4 * k)
    D.plate(s, (0, 2 * k, w, h + top - 6 * k), (122, 133, 146), 5 * k, k)
    for y in range(3):
        for x in range(4):
            lit = rnd() < 0.5
            D.glass_panel(s, (8 * k + x * ((w - 16 * k) / 4), 8 * k + y * 16 * k,
                              (w - 16 * k) / 4 - 4 * k, 12 * k),
                          P.GLOW_WARM if lit else P.GLASS, 0.8 if lit else 0.4, k)
    D.plate(s, (w * 0.34, top + h - 20 * k, w * 0.32, 18 * k), (74, 85, 96), 2 * k, k)
    D.glass_panel(s, (w * 0.36, top + h - 17 * k, w * 0.28, 12 * k), P.GLOW_WARM, 0.85, k)
    D.bolt_frame(s, (0, 2 * k, w, h + top - 6 * k), 6 * k, 2 * k)


def _breakroom(s, w, h, k, top, rnd):
    D.rr(s, (0, top + 2 * k, w, h - 2 * k), P.CONCRETE_LO, 4 * k)
    D.plate(s, (0, 4 * k, w, h + top - 8 * k), (154, 123, 88), 4 * k, k)
    for x in range(int(4 * k), int(w), int(8 * k)):
        D.rect(s, rgba(P.BLACK, 0.14), (x, 4 * k, 2 * k, h + top))
    D.glass_panel(s, (8 * k, top + h - 30 * k, w * 0.3, 16 * k), P.GLOW_WARM, 0.85, k)
    D.glass_panel(s, (w * 0.58, top + h - 30 * k, w * 0.3, 16 * k), P.GLOW_WARM, 0.85, k)
    D.plate(s, (w * 0.4, top + h - 18 * k, w * 0.2, 16 * k), (93, 74, 51), 2 * k, k)
    D.rr(s, (w - 22 * k, top - 12 * k, 10 * k, 9 * k), (232, 226, 212), 2 * k)
    D.arc(s, (232, 226, 212), w - 11 * k, top - 7.5 * k, 3 * k, -1, 1.4, max(1, int(1.4 * k)))
    D.glow(s, w / 2, top + h - 22 * k, 16 * k, P.GLOW_WARM, 0.16)


def _lab(s, w, h, k, top, rnd):
    D.rr(s, (0, top + 2 * k, w, h - 2 * k), P.CONCRETE_LO, 4 * k)
    D.plate(s, (0, 2 * k, w, h + top - 6 * k), (213, 218, 224), 5 * k, k)
    D.glass_panel(s, (6 * k, 8 * k, w - 12 * k, 18 * k), P.GLOW_COLD, 0.6, k)
    cx, cy = w / 2, top + h * 0.5
    D.arc(s, P.STEEL_MID, cx, cy, 15 * k, 0, math.pi, max(2, int(5 * k)))
    D.glow(s, cx, cy - 4 * k, 18 * k, P.GLOW_COLD, 0.35)
    D.arc(s, rgba(P.GLOW_COLD, 0.7), cx, cy - 3 * k, 8 * k, 0, math.pi, max(2, int(6 * k)))
    D.plate(s, (5 * k, top + h - 26 * k, w * 0.3, 12 * k), (184, 190, 197), k, k)
    D.plate(s, (w * 0.64, top + h - 26 * k, w * 0.3, 12 * k), (184, 190, 197), k, k)
    for i, col in enumerate(((127, 208, 138), (143, 212, 232), P.YELLOW, (212, 138, 212))):
        D.rr(s, (8 * k + i * 6 * k, top + h - 24 * k, 3.4 * k, 7 * k), rgba(col, 0.85), 1.4 * k)
    D.bolt_frame(s, (0, 2 * k, w, h + top - 6 * k), 6 * k, 2 * k)


def _maintenance(s, w, h, k, top, rnd):
    chassis(s, w, h, k, top, P.ORANGE_LO, 63)
    D.plate(s, (3 * k, top - 12 * k, w - 6 * k, h - 2 * k), (138, 90, 42), 3 * k, k)
    D.rr(s, (8 * k, top + h - 26 * k, w - 16 * k, 22 * k), (26, 29, 33), 2 * k)
    for i in range(6):
        x = 12 * k + i * ((w - 26 * k) / 5)
        D.line(s, P.STEEL_HI, (x, top + h - 22 * k), (x, top + h - 12 * k), 1.6 * k)
        D.circle(s, P.STEEL_MID, x, top + h - 11 * k, 2.4 * k)
    D.sign(s, (w - 20 * k, top - 8 * k, 14 * k, 14 * k), P.YELLOW, 'bolt', k)
    D.hazard(s, (3 * k, top + h - 7 * k, w - 6 * k, 5 * k), pitch=int(6 * k))
    D.grime(s, (0, top, w, h), 81, 1.1, k)


PAINTERS = {
    'belt': lambda s, w, h, k, t, r: _belt(s, w, h, k, t, r, False),
    'belt_fast': lambda s, w, h, k, t, r: _belt(s, w, h, k, t, r, True),
    'pipe': _pipe, 'cable': _cable, 'chest': _chest, 'warehouse': _warehouse, 'dock': _dock,
    'miner': lambda s, w, h, k, t, r: _miner(s, w, h, k, t, r, False),
    'miner_adv': lambda s, w, h, k, t, r: _miner(s, w, h, k, t, r, True),
    'waterpump': _waterpump, 'furnace': _furnace, 'press': _press, 'cutter': _cutter,
    'assembler': _assembler, 'chemical': _chemical, 'packager': _packager,
    'recycler': _recycler, 'robotics': _robotics, 'coal_gen': _coal_gen, 'solar': _solar,
    'turbine': _turbine, 'fusion': _fusion, 'lamp': _lamp, 'floor': _floor, 'wall': _wall,
    'door': _door, 'window': _window, 'office': _office, 'breakroom': _breakroom,
    'lab': _lab, 'maintenance': _maintenance,
}
