"""Painterly primitives.

Everything in the game is assembled from these, so machines, buildings, props and
the UI all share one material language. Sprites are painted at a supersampled
size and scaled down, which is how we get clean edges out of pygame's
non-antialiased primitives.

Painters receive (surface, w, h, k, ...) where w/h are the supersampled pixel
size and `k` is the supersample factor: multiply *absolute* sizes (a bolt radius,
a line width) by k, while fractions of w/h scale by themselves.
"""
import math
import pygame

from ..core.rng import Rng
from ..core.utils import TAU, clamp
from . import palette as P
from .palette import mix, shade, rgba

SS = 2  # supersample factor for baked sprites


def surf(w, h):
    return pygame.Surface((max(1, int(w)), max(1, int(h))), pygame.SRCALPHA)


def _alpha(color):
    """pygame.draw writes colours verbatim, alpha included, instead of blending.
    Anything translucent therefore has to go through a scratch surface."""
    return len(color) == 4 and color[3] < 255


def line(target, color, p1, p2, width=1):
    width = max(1, int(width))
    if _alpha(color):
        pad = width + 2
        x0 = int(min(p1[0], p2[0])) - pad
        y0 = int(min(p1[1], p2[1])) - pad
        w = int(abs(p2[0] - p1[0])) + pad * 2
        h = int(abs(p2[1] - p1[1])) + pad * 2
        s = surf(w, h)
        pygame.draw.line(s, color, (p1[0] - x0, p1[1] - y0), (p2[0] - x0, p2[1] - y0), width)
        target.blit(s, (x0, y0))
    else:
        pygame.draw.line(target, color, (int(p1[0]), int(p1[1])), (int(p2[0]), int(p2[1])), width)


def rect(target, color, r, width=0, radius=0):
    x, y, w, h = int(r[0]), int(r[1]), max(1, int(r[2])), max(1, int(r[3]))
    if _alpha(color):
        pad = int(width) + 2
        s = surf(w + pad * 2, h + pad * 2)
        pygame.draw.rect(s, color, (pad, pad, w, h), int(width), border_radius=int(radius))
        target.blit(s, (x - pad, y - pad))
    else:
        pygame.draw.rect(target, color, (x, y, w, h), int(width), border_radius=int(radius))


def circle(target, color, cx, cy, r, width=0):
    r = max(1, int(r))
    if _alpha(color):
        pad = int(width) + 2
        s = surf(r * 2 + pad * 2, r * 2 + pad * 2)
        pygame.draw.circle(s, color, (r + pad, r + pad), r, int(width))
        target.blit(s, (int(cx) - r - pad, int(cy) - r - pad))
    else:
        pygame.draw.circle(target, color, (int(cx), int(cy)), r, int(width))


def polygon(target, color, pts, width=0):
    if len(pts) < 3:
        return
    pts = [(float(p[0]), float(p[1])) for p in pts]
    if _alpha(color):
        pad = int(width) + 2
        x0 = int(min(p[0] for p in pts)) - pad
        y0 = int(min(p[1] for p in pts)) - pad
        w = int(max(p[0] for p in pts)) - x0 + pad
        h = int(max(p[1] for p in pts)) - y0 + pad
        s = surf(w, h)
        pygame.draw.polygon(s, color, [(p[0] - x0, p[1] - y0) for p in pts], int(width))
        target.blit(s, (x0, y0))
    else:
        pygame.draw.polygon(target, color, [(int(p[0]), int(p[1])) for p in pts], int(width))


def ellipse(target, color, cx, cy, rx, ry, width=0):
    r = pygame.Rect(0, 0, max(1, int(rx * 2)), max(1, int(ry * 2)))
    if _alpha(color):
        pad = int(width) + 2
        s = surf(r.w + pad * 2, r.h + pad * 2)
        pygame.draw.ellipse(s, color, (pad, pad, r.w, r.h), int(width))
        target.blit(s, (int(cx - rx) - pad, int(cy - ry) - pad))
    else:
        pygame.draw.ellipse(target, color, (int(cx - rx), int(cy - ry), r.w, r.h), int(width))


def arc(target, color, cx, cy, r, a0, a1, width=1):
    box = pygame.Rect(int(cx - r), int(cy - r), max(2, int(r * 2)), max(2, int(r * 2)))
    if _alpha(color):
        pad = int(width) + 2
        s = surf(box.w + pad * 2, box.h + pad * 2)
        pygame.draw.arc(s, color, (pad, pad, box.w, box.h), a0, a1, max(1, int(width)))
        target.blit(s, (box.x - pad, box.y - pad))
    else:
        pygame.draw.arc(target, color, box, a0, a1, max(1, int(width)))


def render_sprite(lw, lh, painter, *args, ss=SS):
    """Paint at ss x size, then scale down for antialiasing."""
    lw, lh = max(1, int(lw)), max(1, int(lh))
    s = surf(lw * ss, lh * ss)
    painter(s, lw * ss, lh * ss, ss, *args)
    return pygame.transform.smoothscale(s, (lw, lh))


# --------------------------------------------------------------- gradients

def _sample(stops, t):
    if t <= stops[0][0]:
        return stops[0][1]
    for i in range(1, len(stops)):
        t0, c0 = stops[i - 1]
        t1, c1 = stops[i]
        if t <= t1:
            span = (t1 - t0) or 1
            return mix(c0, c1, (t - t0) / span)
    return stops[-1][1]


def grad_rect(target, r, stops, radius=0, horiz=False, alpha=255):
    """Linear gradient filling a (rounded) rectangle."""
    x, y, w, h = r
    w, h = int(round(w)), int(round(h))
    if w <= 0 or h <= 0:
        return
    g = surf(w, h)
    n = w if horiz else h
    for i in range(n):
        t = i / (n - 1) if n > 1 else 0.0
        c = _sample(stops, t)
        col = (c[0], c[1], c[2], alpha)
        if horiz:
            pygame.draw.line(g, col, (i, 0), (i, h - 1))
        else:
            pygame.draw.line(g, col, (0, i), (w - 1, i))
    if radius > 0:
        mask = surf(w, h)
        pygame.draw.rect(mask, (255, 255, 255, 255), (0, 0, w, h),
                         border_radius=int(radius))
        g.blit(mask, (0, 0), special_flags=pygame.BLEND_RGBA_MULT)
    target.blit(g, (int(x), int(y)))


def rr(target, r, color, radius=3, width=0):
    rect(target, color, r, width, radius)


# --------------------------------------------------------------- materials

def plate(target, r, base, radius=3, k=1, outline=True):
    """A bevelled metal plate: the fundamental building block of every machine."""
    x, y, w, h = r
    grad_rect(target, r, [
        (0.0, shade(base, 0.30)),
        (0.14, shade(base, 0.12)),
        (0.55, base),
        (1.0, shade(base, -0.30)),
    ], radius=radius)
    lw = max(1, int(1.4 * k))
    line(target, rgba(shade(base, 0.55), 0.85),
         (x + k, y + lw * 0.6), (x + w - k, y + lw * 0.6), lw)
    line(target, rgba(P.BLACK, 0.5),
         (x + k, y + h - lw * 0.6), (x + w - k, y + h - lw * 0.6), max(1, int(k)))
    if outline:
        rr(target, r, rgba(shade(base, -0.62), 0.9), radius, max(1, int(k)))


def brushed(target, r, seed=1, amt=0.09, k=1):
    """Brushed-metal streaks: tactile surface noise, never flat colour."""
    x, y, w, h = r
    rnd = Rng(seed)
    w, h = int(w), int(h)
    layer = surf(w, h)
    for _ in range(int(w * 0.5)):
        px = rnd() * w
        col = P.WHITE if rnd() > 0.5 else P.BLACK
        pygame.draw.line(layer, rgba(col, rnd() * amt),
                         (px, rnd() * h * 0.2),
                         (px + (rnd() - 0.5) * 2 * k, h - rnd() * h * 0.2),
                         max(1, int(rnd() * 1.4 * k)))
    target.blit(layer, (int(x), int(y)))


def grime(target, r, seed=7, strength=0.5, k=1):
    """Rust and dirt pooling low and in corners - sells the 'used' look."""
    x, y, w, h = r
    rnd = Rng(seed)
    w, h = int(w), int(h)
    layer = surf(w, h)
    n = max(5, int(w * h / (150 * k * k)))
    for _ in range(n):
        px = rnd() * w
        py = h - (rnd() ** 1.7) * h
        rad = rnd() * min(w, h) * 0.22 + k
        col = P.RUST if rnd() > 0.55 else P.BLACK
        blob = radial(col, rad, rnd() * 0.26 * strength)
        layer.blit(blob, (int(px - rad), int(py - rad)))
    target.blit(layer, (int(x), int(y)))


_radial_cache = {}


def radial(color, radius, strength=1.0, falloff=1.0):
    """Cached soft radial blob — used for glow, smoke, shadow and grime."""
    radius = max(1, int(radius))
    key = (color, radius, round(strength, 2), round(falloff, 2))
    hit = _radial_cache.get(key)
    if hit is not None:
        return hit
    s = surf(radius * 2, radius * 2)
    steps = max(6, min(radius * 2, 64))
    for i in range(steps, 0, -1):
        t = i / steps
        a = (1.0 - t) ** (2.2 * falloff) * strength
        if a <= 0.003:
            continue
        pygame.draw.circle(s, rgba(color, a), (radius, radius), max(1, int(radius * t)))
    _radial_cache[key] = s
    return s


def glow(target, x, y, radius, color, strength=0.8, add=False):
    """Soft light bloom. Baked art blends normally; runtime fire and plasma
    pass add=True for an additive hot-spot."""
    r = max(1, int(radius))
    src = radial(color, r, strength)
    target.blit(src, (int(x - r), int(y - r)),
                special_flags=pygame.BLEND_RGBA_ADD if add else 0)


def drop_shadow(target, cx, cy, w, h, a=0.34):
    r = max(2, int(max(w, h) / 1.5))
    s = radial((6, 8, 11), r, a)
    s = pygame.transform.smoothscale(s, (max(2, int(w * 1.6)), max(2, int(h * 1.6))))
    target.blit(s, (int(cx - s.get_width() / 2), int(cy - s.get_height() / 2)))


# --------------------------------------------------------------- fittings

def bolt(target, x, y, r, tint=P.STEEL_HI):
    r = max(1.0, r)
    hi = shade(tint, 0.35)
    pygame.draw.circle(target, shade(tint, -0.45), (int(x), int(y)), int(r) + 1)
    pygame.draw.circle(target, tint, (int(x), int(y)), max(1, int(r)))
    pygame.draw.circle(target, hi, (int(x - r * 0.3), int(y - r * 0.35)), max(1, int(r * 0.5)))
    line(target, rgba(P.BLACK, 0.4),
         (x - r * 0.55, y - r * 0.2), (x + r * 0.55, y + r * 0.2), max(1, int(r * 0.4)))


def bolt_frame(target, box, inset=3.5, r=1.9, tint=P.STEEL_HI):
    x, y, w, h = box
    bolt(target, x + inset, y + inset, r, tint)
    bolt(target, x + w - inset, y + inset, r, tint)
    bolt(target, x + inset, y + h - inset, r, tint)
    bolt(target, x + w - inset, y + h - inset, r, tint)


def vents(target, r, count=4, base=P.STEEL_LO):
    x, y, w, h = r
    gap = h / max(1, count)
    for i in range(count):
        vy = y + i * gap + gap * 0.16
        vh = max(1, gap * 0.55)
        rr(target, (x, vy, w, vh), shade(base, -0.5), max(1, int(vh * 0.4)))
        rr(target, (x, vy + vh * 0.55, w, max(1, vh * 0.42)),
           rgba(shade(base, 0.4), 0.55), max(1, int(vh * 0.3)))


def hazard(target, r, a=P.YELLOW, b=P.STEEL_DARK, pitch=7):
    """Diagonal hazard stripes."""
    x, y, w, h = r
    w, h = int(w), int(h)
    if w <= 0 or h <= 0:
        return
    s = surf(w, h)
    s.fill(a)
    i = -h
    while i < w + h:
        pygame.draw.polygon(s, b, [(i, h), (i + pitch, h), (i + pitch + h, 0), (i + h, 0)])
        i += pitch * 2
    rect(s, rgba(P.BLACK, 0.25), (0, h * 0.72, w, h * 0.28))
    target.blit(s, (int(x), int(y)))


def glass_panel(target, r, tint=P.GLASS, lit=0.6, k=1):
    x, y, w, h = r
    grad_rect(target, r, [
        (0.0, shade(tint, -0.55)),
        (0.5, mix(tint, (10, 20, 24), 1 - lit)),
        (1.0, shade(tint, -0.7)),
    ], radius=max(1, int(2 * k)))
    sh = surf(int(w), int(h))
    pygame.draw.polygon(sh, rgba(P.WHITE, 0.18),
                        [(0, h), (w * 0.55, 0), (w * 0.85, 0), (w * 0.2, h)])
    target.blit(sh, (int(x), int(y)))
    rr(target, r, rgba(P.BLACK, 0.7), max(1, int(2 * k)), max(1, int(k)))


def led(target, x, y, r, color, on=True):
    pygame.draw.circle(target, shade(P.STEEL_DARK, -0.2), (int(x), int(y)), int(r + 1))
    if on:
        glow(target, x, y, r * 3.2, color, 0.5)
    pygame.draw.circle(target, color if on else shade(color, -0.7), (int(x), int(y)), max(1, int(r)))
    if on:
        pygame.draw.circle(target, shade(color, 0.6),
                           (int(x - r * 0.3), int(y - r * 0.3)), max(1, int(r * 0.45)))


def pipe(target, x1, y1, x2, y2, w, base=P.STEEL):
    """Pipe segment with a specular highlight running along its length."""
    length = math.hypot(x2 - x1, y2 - y1)
    if length < 1:
        return
    w = max(2, int(w))
    seg = surf(int(length) + 4, w + 4)
    grad_rect(seg, (2, 2, int(length), w), [
        (0.0, shade(base, -0.45)), (0.22, shade(base, 0.35)),
        (0.45, base), (1.0, shade(base, -0.55))])
    rect(seg, rgba(P.BLACK, 0.5), (2, 2, int(length), w), 1)
    pygame.draw.rect(seg, shade(base, -0.15), (1, 0, 3, w + 4))
    pygame.draw.rect(seg, shade(base, -0.15), (int(length) - 1, 0, 3, w + 4))
    ang = -math.degrees(math.atan2(y2 - y1, x2 - x1))
    rot = pygame.transform.rotate(seg, ang)
    box = rot.get_rect(center=((x1 + x2) / 2, (y1 + y2) / 2))
    target.blit(rot, box.topleft)


def gauge(target, x, y, r, k=1):
    pygame.draw.circle(target, P.STEEL_DARK, (int(x), int(y)), int(r + 1.4 * k))
    pygame.draw.circle(target, (230, 224, 207), (int(x), int(y)), int(r))
    circle(target, rgba(P.BLACK, 0.5), x, y, r, max(1, int(k)))
    arc(target, (176, 48, 38), x, y, r * 0.78, -0.25, 0.5, max(1, int(1.4 * k)))
    line(target, (42, 42, 46), (x, y),
         (x + math.cos(-2.3) * r * 0.7, y + math.sin(-2.3) * r * 0.7), max(1, int(k)))
    pygame.draw.circle(target, (42, 42, 46), (int(x), int(y)), max(1, int(k)))


def sign(target, r, color=P.YELLOW, glyph=None, k=1):
    x, y, w, h = r
    rr(target, r, shade(color, -0.1), max(1, int(1.5 * k)))
    rr(target, r, rgba(P.BLACK, 0.75), max(1, int(1.5 * k)), max(1, int(k)))
    if glyph == 'bolt':
        polygon(target, rgba(P.BLACK, 0.8), [
            (x + w * 0.56, y + h * 0.14), (x + w * 0.30, y + h * 0.55),
            (x + w * 0.48, y + h * 0.55), (x + w * 0.40, y + h * 0.88),
            (x + w * 0.70, y + h * 0.42), (x + w * 0.50, y + h * 0.42)])
    elif glyph == 'excl':
        rect(target, rgba(P.BLACK, 0.8), (x + w * 0.44, y + h * 0.18, w * 0.12, h * 0.45))
        rect(target, rgba(P.BLACK, 0.8), (x + w * 0.44, y + h * 0.70, w * 0.12, h * 0.12))


# --------------------------------------------------------------- surface noise

_noise_tiles = {}


def _noise_tile(seed, amt):
    key = (seed, round(amt, 3))
    hit = _noise_tiles.get(key)
    if hit is not None:
        return hit
    size = 64
    rnd = Rng(seed)
    add = pygame.Surface((size, size))
    sub = pygame.Surface((size, size))
    for y in range(size):
        for x in range(size):
            v = rnd()
            hi = int(max(0.0, v - 0.5) * 2 * 255 * amt)
            lo = int(max(0.0, 0.5 - v) * 2 * 255 * amt)
            add.set_at((x, y), (hi, hi, hi))
            sub.set_at((x, y), (lo, lo, lo))
    _noise_tiles[key] = (add, sub)
    return _noise_tiles[key]


def noise_overlay(target, amt=0.05, seed=3):
    """Film-grain style surface noise; tiled so it costs nothing per sprite."""
    add, sub = _noise_tile(seed, amt)
    w, h = target.get_size()
    for y in range(0, h, 64):
        for x in range(0, w, 64):
            target.blit(add, (x, y), special_flags=pygame.BLEND_RGB_ADD)
            target.blit(sub, (x, y), special_flags=pygame.BLEND_RGB_SUB)


