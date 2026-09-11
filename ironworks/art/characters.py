"""Character sprite sheets.

Every person - the player, hired staff, townsfolk - comes off the same rig with
different palettes, uniforms, headgear and hand props, so a crowd reads as
individuals without drifting out of the game's visual language.
"""
import math
import pygame

from ..core.rng import Rng
from ..core.utils import TAU
from . import draw as D
from . import palette as P
from .palette import mix, shade, rgba

FW, FH = 34, 46      # frame size
COLS, ROWS = 8, 4    # 0 idle | 1..5 walk | 6..7 work   x   dir N/E/S/W

SKIN = [(240, 200, 160), (224, 176, 136), (201, 145, 103),
        (169, 115, 76), (132, 83, 52), (95, 58, 34)]
HAIR = [(43, 29, 19), (74, 47, 27), (122, 75, 34), (176, 133, 68),
        (216, 207, 192), (26, 26, 30), (107, 58, 42)]

ROLE_STYLE = {
    'player':    dict(shirt=(200, 98, 42), pants=(58, 68, 80), helmet=P.YELLOW, vest=True, tool='wrench'),
    'worker':    dict(shirt=(77, 106, 134), pants=(57, 66, 77), helmet=P.YELLOW, vest=True, tool='box'),
    'engineer':  dict(shirt=(216, 210, 196), pants=(57, 66, 77), helmet=(232, 226, 212), vest=True, tool='tablet', glasses=True),
    'mechanic':  dict(shirt=(90, 95, 70), pants=(59, 63, 48), helmet=(138, 90, 42), vest=False, tool='wrench'),
    'logistics': dict(shirt=(63, 122, 82), pants=(57, 66, 77), helmet=P.ORANGE, vest=True, tool='box'),
    'manager':   dict(shirt=(46, 58, 74), pants=(36, 44, 54), helmet=None, vest=False, tool='tablet', tie=True),
    'researcher': dict(shirt=(230, 233, 236), pants=(74, 85, 96), helmet=None, vest=False, tool='tablet', coat=True, glasses=True),
    'technician': dict(shirt=(106, 79, 134), pants=(57, 66, 77), helmet=(191, 198, 205), vest=True, tool='wrench'),
    'civilian':  dict(shirt=None, pants=None, helmet=None, vest=False, tool=None),
    'vendor':    dict(shirt=(138, 90, 42), pants=(74, 58, 42), helmet=None, vest=False, tool='box', apron=True),
}

_sheets = {}
_portraits = {}


def character_sheet(role='worker', seed=1):
    key = (role, seed % 12)
    hit = _sheets.get(key)
    if hit is not None:
        return hit
    rnd = Rng(4242 + seed * 7919 + len(role) * 37)
    base = ROLE_STYLE.get(role, ROLE_STYLE['worker'])
    look = dict(
        skin=SKIN[int(rnd() * len(SKIN)) % len(SKIN)],
        hair=HAIR[int(rnd() * len(HAIR)) % len(HAIR)],
        shirt=base['shirt'] or [(138, 90, 74), (74, 106, 138), (106, 122, 74),
                                (122, 74, 106), (138, 122, 74)][int(rnd() * 5) % 5],
        pants=base['pants'] or [(58, 63, 74), (74, 64, 56), (47, 58, 68)][int(rnd() * 3) % 3],
        helmet=base['helmet'], vest=base['vest'], tool=base['tool'],
        tie=base.get('tie', False), coat=base.get('coat', False),
        glasses=base.get('glasses', False) or rnd() < 0.15,
        apron=base.get('apron', False),
        beard=rnd() < 0.3, long_hair=rnd() < 0.35, boots=(42, 38, 34),
    )

    def paint(s, w, h, k, look=look):
        for d in range(ROWS):
            for c in range(COLS):
                _frame(s, look, d, c, k, c * FW * k, d * FH * k)

    sheet = D.render_sprite(FW * COLS, FH * ROWS, paint)
    if pygame.display.get_surface():
        sheet = sheet.convert_alpha()
    out = dict(surf=sheet, fw=FW, fh=FH, look=look)
    _sheets[key] = out
    return out


def _frame(s, L, direction, col, k, ox, oy):
    cx = ox + FW * k / 2
    feet = oy + (FH - 5) * k
    walk = 1 <= col <= 5
    work = col >= 6
    phase = (col - 1) / 5 if walk else 0
    swing = math.sin(phase * TAU) if walk else 0
    bob = abs(math.cos(phase * TAU)) * 1.4 * k if walk else 0
    work_pose = -1 if not work else (0 if col == 6 else 1)
    top = feet - 32 * k - bob
    side = 1 if direction == 1 else (-1 if direction == 3 else 0)

    D.ellipse(s, rgba((8, 10, 14), 0.30), cx, feet + k, 8.5 * k, 3.4 * k)

    # ---- legs
    leg_swing = swing * 4.2 * k
    for sgn in (-1, 1):
        off = sgn * (1.2 * k if side else 3.1 * k)
        fwd = leg_swing * sgn * side if side else leg_swing * sgn
        D.rr(s, (cx + off - 2.6 * k + (fwd * 0.6 if side else 0), top + 17 * k, 5.2 * k, 12 * k),
             L['pants'] if sgn == 1 else shade(L['pants'], -0.18), int(2.2 * k))
        bx = cx + off - 3 * k + (fwd * 0.8 if side else 0)
        D.rr(s, (bx, feet - 4 * k, 6 * k, 4.4 * k), L['boots'], int(1.8 * k))
        D.rect(s, rgba(P.WHITE, 0.12), (bx, feet - 4 * k, 6 * k, k))

    # ---- torso
    tw = 9.5 * k if side else 12 * k
    th = 17 * k
    tx, ty = cx - tw / 2, top + 2 * k
    D.grad_rect(s, (tx, ty, tw, th), [(0.0, shade(L['shirt'], 0.2)), (0.55, L['shirt']),
                                      (1.0, shade(L['shirt'], -0.28))], radius=int(3 * k))
    D.rr(s, (tx, ty, tw, th), rgba(P.BLACK, 0.35), int(3 * k), 1)

    if L['coat']:
        D.rr(s, (tx - k, ty + k, tw + 2 * k, th + 4 * k), rgba((242, 244, 246), 0.95), int(3 * k))
        if direction == 2:
            D.line(s, rgba((174, 181, 188), 0.9), (cx, ty + 2 * k), (cx, ty + th + 3 * k), 1)
    if L['apron']:
        D.rr(s, (tx + k, ty + 5 * k, tw - 2 * k, th - 3 * k), rgba((107, 74, 42), 0.9), int(2 * k))
    if L['vest']:
        D.rr(s, (tx - 0.8 * k, ty + 3 * k, tw + 1.6 * k, th - 3 * k), rgba((232, 226, 74), 0.92), int(2.4 * k))
        D.rect(s, rgba((216, 221, 226), 0.95), (tx - 0.8 * k, ty + 7 * k, tw + 1.6 * k, 2 * k))
        D.rect(s, rgba((216, 221, 226), 0.95), (tx - 0.8 * k, ty + 12 * k, tw + 1.6 * k, 2 * k))
        if direction == 2:
            D.rect(s, rgba((138, 132, 32), 0.5), (cx - 0.5 * k, ty + 3 * k, k, th - 3 * k))
    if L['tie'] and direction == 2:
        D.polygon(s, (166, 58, 46), [(cx, ty + k), (cx + 1.8 * k, ty + 4 * k),
                                     (cx, ty + 12 * k), (cx - 1.8 * k, ty + 4 * k)])

    # ---- arms (angles in radians, 0 = straight down)
    for sgn in (-1, 1):
        ax = cx + sgn * (tw / 2 + 1.2 * k)
        ay = ty + 3 * k
        if work_pose >= 0:
            ang = sgn * (-0.9 if work_pose else -0.5)
            ay -= k
        elif side:
            ang = -swing * 0.5 * (1 if sgn == side else -1)
        else:
            ang = sgn * (0.1 + swing * 0.12)
        ln = 11 * k
        ex = ax + math.sin(ang) * ln * 0.6
        ey = ay + math.cos(ang) * ln * 0.6
        D.line(s, (242, 244, 246) if L['coat'] else shade(L['shirt'], -0.1 if sgn == 1 else 0.08),
               (ax, ay), (ex, ey), max(2, int(4.2 * k)))
        hx = ax + math.sin(ang) * ln
        hy = ay + math.cos(ang) * ln
        D.line(s, L['skin'], (ex, ey), (hx, hy), max(2, int(3.8 * k)))

    # ---- head
    hy = top - 2.5 * k
    hr = 5.6 * k
    D.ellipse(s, L['skin'], cx, hy, hr, hr * 1.06)
    D.ellipse(s, rgba(P.BLACK, 0.10), cx + (side * 1.6 * k if side else 0), hy + 1.6 * k, hr * 0.9, hr * 0.7)
    D.rect(s, rgba(P.BLACK, 0.22), (cx - 2.2 * k, hy + hr * 0.8, 4.4 * k, 2 * k))

    if not L['helmet'] or direction == 0:
        D.arc(s, L['hair'], cx, hy - 0.8 * k, hr * 1.02, 0, math.pi, max(2, int(hr * 0.9)))
        if L['long_hair']:
            D.rect(s, L['hair'], (cx - hr, hy - k, hr * 2, 5 * k))

    if direction == 2:
        D.circle(s, (42, 33, 24), cx - 2 * k, hy + 0.4 * k, max(1, 0.8 * k))
        D.circle(s, (42, 33, 24), cx + 2 * k, hy + 0.4 * k, max(1, 0.8 * k))
        D.arc(s, rgba((107, 70, 54), 0.8), cx, hy + 2.6 * k, 1.5 * k, 0.2, math.pi - 0.2, max(1, int(k)))
        if L['beard']:
            D.arc(s, rgba(L['hair'], 0.85), cx, hy + 2.4 * k, 3.4 * k, 0.15, math.pi - 0.15, max(1, int(2 * k)))
        if L['glasses']:
            D.circle(s, rgba(P.GLASS, 0.3), cx - 2 * k, hy + 0.4 * k, 1.8 * k)
            D.circle(s, rgba(P.GLASS, 0.3), cx + 2 * k, hy + 0.4 * k, 1.8 * k)
            D.circle(s, rgba((28, 28, 32), 0.9), cx - 2 * k, hy + 0.4 * k, 1.9 * k, 1)
            D.circle(s, rgba((28, 28, 32), 0.9), cx + 2 * k, hy + 0.4 * k, 1.9 * k, 1)
    elif side:
        D.circle(s, (42, 33, 24), cx + side * 2.4 * k, hy + 0.4 * k, max(1, 0.75 * k))

    if L['helmet'] and direction != 0:
        D.arc(s, L['helmet'], cx, hy - 1.8 * k, hr * 1.08, 0, math.pi, max(2, int(hr * 0.85)))
        D.rect(s, L['helmet'], (cx - hr * 1.08, hy - 2.6 * k, hr * 2.16, 1.6 * k))
        bx = cx + (side * 1.5 * k if side else 0)
        D.rr(s, (bx - hr * 1.12, hy - 1.8 * k, hr * 2.24, 1.7 * k), shade(L['helmet'], -0.18), int(k))
        D.rr(s, (bx - hr * 1.12, hy - 1.8 * k, hr * 2.24, 1.7 * k), rgba(P.BLACK, 0.4), int(k), 1)
        if direction == 2:
            D.rect(s, rgba(P.WHITE, 0.22), (cx - 0.7 * k, hy - hr * 1.05 - 1.8 * k, 1.4 * k, hr * 0.9))
    elif L['helmet']:
        D.circle(s, shade(L['helmet'], -0.05), cx, hy, hr * 1.08)
        D.circle(s, rgba(P.WHITE, 0.2), cx - 1.6 * k, hy - 1.6 * k, hr * 0.4)

    # ---- carried tool
    if L['tool'] and (work_pose >= 0 or col == 0):
        if L['tool'] == 'wrench':
            hx = cx + (side * 7 * k if side else 7 * k)
            hy2 = top + 13 * k
            tilt = -0.5 if work_pose == 1 else 0.25
            ex = hx + math.sin(tilt) * 9 * k
            ey = hy2 - math.cos(tilt) * 9 * k
            D.line(s, P.STEEL_HI, (hx, hy2), (ex, ey), max(1, int(2 * k)))
            D.circle(s, P.STEEL_MID, ex, ey - k, 2.6 * k)
            D.circle(s, (26, 28, 32), ex, ey - 1.6 * k, 1.2 * k)
        elif L['tool'] == 'box':
            D.rr(s, (cx - 6 * k, top + 8 * k, 12 * k, 9 * k), (165, 128, 74), int(1.5 * k))
            D.rr(s, (cx - 6 * k, top + 8 * k, 12 * k, 9 * k), (74, 55, 23), int(1.5 * k), 1)
            D.line(s, (74, 55, 23), (cx - 6 * k, top + 12.5 * k), (cx + 6 * k, top + 12.5 * k), 1)
        elif L['tool'] == 'tablet':
            px = cx + (side * 5 * k if side else 5 * k)
            D.rr(s, (px - 3.5 * k, top + 10 * k, 7 * k, 5 * k), (42, 47, 54), int(k))
            D.rect(s, rgba(P.GLOW_COLD, 0.8), (px - 2.8 * k, top + 10.6 * k, 5.6 * k, 3.8 * k))


def portrait(role, seed, size=56):
    """Framed 3/4 bust for dialogue and the employee roster."""
    key = (role, seed % 12, size)
    hit = _portraits.get(key)
    if hit is not None:
        return hit
    sheet = character_sheet(role, seed)
    s = D.surf(size, size)
    D.grad_rect(s, (0, 0, size, size), [(0.0, (51, 58, 68)), (1.0, (28, 33, 40))], radius=6)
    scale = size / 26.0
    body = sheet['surf'].subsurface(pygame.Rect(2 * FW, 2 * FH, FW, FH))
    body = pygame.transform.smoothscale(body, (int(FW * scale), int(FH * scale)))
    clip = D.surf(size, size)
    # frame the head and shoulders: the head sits ~14px down a 46px frame
    clip.blit(body, (int(size / 2 - body.get_width() / 2), int(size * 0.46 - 14 * scale)))
    mask = D.surf(size, size)
    D.rr(mask, (0, 0, size, size), (255, 255, 255, 255), 6)
    clip.blit(mask, (0, 0), special_flags=pygame.BLEND_RGBA_MULT)
    s.blit(clip, (0, 0))
    D.rr(s, (1, 1, size - 2, size - 2), rgba((13, 15, 18), 0.9), 6, 2)
    D.rr(s, (2.5, 2.5, size - 5, size - 5), rgba(P.UI_TRIM, 0.6), 5, 1)
    if pygame.display.get_surface():
        s = s.convert_alpha()
    _portraits[key] = s
    return s
