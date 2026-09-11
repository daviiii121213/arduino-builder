"""Particle and floating-text effects: smoke, steam, sparks, dust, fire, arcs and
money popups. Pooled, view-culled and emitted frame-rate independently.
"""
import math
import random

import pygame

from ..art import draw as D
from ..art import palette as P
from ..art.icons import item_icon
from ..core.utils import TAU, clamp
from ..world.world import TILE

MAX = 420


class FX:
    def __init__(self, game):
        self.game = game
        self.parts = []
        self.texts = []

    def _add(self, p):
        if len(self.parts) >= MAX:
            return
        cam = self.game.cam
        if cam and cam.vw:
            v = cam.view()
            if (p['x'] * TILE < v[0] - 160 or p['x'] * TILE > v[2] + 160 or
                    p['y'] * TILE < v[1] - 160 or p['y'] * TILE > v[3] + 160):
                return
        self.parts.append(p)

    def smoke(self, x, y, n=1, tint=P.SMOKE):
        for _ in range(n):
            self._add(dict(kind='smoke', x=x + (random.random() - 0.5) * 0.3, y=y,
                           vx=(random.random() - 0.5) * 0.18 + 0.12,
                           vy=-0.5 - random.random() * 0.35,
                           life=2.6 + random.random() * 1.6, t=0.0,
                           r=4 + random.random() * 5, col=tint))

    def steam(self, x, y, n=1):
        self.smoke(x, y, n, P.STEAM)

    def sparks(self, x, y, n=6):
        for _ in range(n):
            a = random.random() * TAU
            sp = 0.6 + random.random() * 2.2
            self._add(dict(kind='spark', x=x, y=y, vx=math.cos(a) * sp,
                           vy=math.sin(a) * sp - 0.4, life=0.4 + random.random() * 0.5,
                           t=0.0, r=1 + random.random(),
                           col=P.GLOW_HOT if random.random() < 0.4 else P.SPARK))

    def dust(self, x, y, n=4):
        for _ in range(n):
            self._add(dict(kind='dust', x=x, y=y, vx=(random.random() - 0.5) * 0.8,
                           vy=(random.random() - 0.5) * 0.5 - 0.2,
                           life=0.7 + random.random() * 0.6, t=0.0,
                           r=2 + random.random() * 3, col=(181, 166, 138)))

    def fire(self, x, y, n=2):
        for _ in range(n):
            self._add(dict(kind='fire', x=x + (random.random() - 0.5) * 0.25, y=y,
                           vx=(random.random() - 0.5) * 0.2, vy=-0.7 - random.random() * 0.5,
                           life=0.4 + random.random() * 0.35, t=0.0,
                           r=2.5 + random.random() * 3,
                           col=P.GLOW_HOT if random.random() < 0.5 else P.GLOW_WARM))

    def arc(self, x, y):
        self._add(dict(kind='arc', x=x, y=y, vx=0, vy=0, life=0.16, t=0.0,
                       r=10 + random.random() * 8, col=P.GLOW_COLD))

    def item(self, x, y, item_id):
        self._add(dict(kind='item', x=x, y=y, vx=(random.random() - 0.5) * 0.5,
                       vy=-1.4, life=0.9, t=0.0, r=10, col=P.WHITE, id=item_id))

    def text(self, x, y, s, col=P.UI_TEXT, size=14):
        self.texts.append(dict(x=x, y=y, s=s, col=col, size=size, t=0.0, life=1.5, vy=-0.9))

    def update(self, dt):
        for p in self.parts[:]:
            p['t'] += dt
            if p['t'] >= p['life']:
                self.parts.remove(p)
                continue
            p['x'] += p['vx'] * dt
            p['y'] += p['vy'] * dt
            k = p['kind']
            if k == 'smoke':
                p['vy'] += dt * 0.06
                p['vx'] *= 1 - dt * 0.3
                p['r'] += dt * 5
            elif k == 'spark':
                p['vy'] += dt * 5.5
                p['vx'] *= 1 - dt * 1.6
            elif k == 'dust':
                p['vy'] += dt * 1.2
            elif k == 'fire':
                p['r'] *= 1 - dt * 0.6
            elif k == 'item':
                p['vy'] += dt * 3.2
        for t in self.texts[:]:
            t['t'] += dt
            t['y'] += t['vy'] * dt
            t['vy'] *= 1 - dt * 1.4
            if t['t'] >= t['life']:
                self.texts.remove(t)

    def draw(self, target, ox, oy):
        """Drawn into the world surface; ox/oy is the camera's top-left."""
        for p in self.parts:
            a = 1 - p['t'] / p['life']
            sx, sy = p['x'] * TILE - ox, p['y'] * TILE - oy
            k = p['kind']
            if k == 'smoke':
                r = max(1, int(p['r']))
                target.blit(D.radial(p['col'], r, 0.34 * a), (int(sx - r), int(sy - r)))
            elif k == 'spark':
                D.line(target, P.rgba(p['col'], a), (sx, sy),
                       (sx - p['vx'] * 4, sy - p['vy'] * 4), max(1, int(p['r'])))
            elif k == 'dust':
                r = max(1, int(p['r']))
                target.blit(D.radial(p['col'], r, 0.35 * a), (int(sx - r), int(sy - r)))
            elif k == 'fire':
                r = max(1, int(p['r'] * 2))
                target.blit(D.radial(p['col'], r, 0.85 * a), (int(sx - r), int(sy - r)),
                            special_flags=pygame.BLEND_RGBA_ADD)
            elif k == 'arc':
                cx, cy = sx, sy
                for _ in range(4):
                    nx = cx + (random.random() - 0.5) * p['r']
                    ny = cy + (random.random() - 0.5) * p['r']
                    D.line(target, P.rgba(p['col'], a), (cx, cy), (nx, ny), 2)
                    cx, cy = nx, ny
            elif k == 'item':
                ic = item_icon(p['id'])
                ic.set_alpha(int(255 * a))
                target.blit(pygame.transform.smoothscale(ic, (20, 20)), (int(sx - 10), int(sy - 10)))
                ic.set_alpha(255)

    def draw_texts(self, target, cam):
        """Screen space, so labels stay legible when zoomed out."""
        from ..art import ui as U
        for t in self.texts:
            a = clamp(1 - (t['t'] / t['life']) * 1.3, 0, 1)
            sx, sy = cam.world_to_screen(t['x'] * TILE, t['y'] * TILE)
            surf = U.text_surface(t['s'], U.FONT_BODY, t['col'], t['size'], True)
            surf.set_alpha(int(255 * a))
            target.blit(surf, (int(sx - surf.get_width() / 2), int(sy)))
            surf.set_alpha(255)
