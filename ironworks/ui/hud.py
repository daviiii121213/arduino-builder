"""Heads-up display: vitals, money and power, hotbar, minimap, notifications and
the objective tracker.
"""
import math

import pygame

from ..art import draw as D
from ..art import palette as P
from ..art import ui as U
from ..art.icons import item_icon
from ..art.machines import machine_sprite
from ..art.tiles import TILE_AVG
from ..core.utils import clamp, money, short_num
from ..data.buildables import BUILDABLES
from ..systems.missions import MISSION_BY_ID
from ..world.world import TILE
from ..art.palette import rgba


class HUD:
    def __init__(self, ui):
        self.ui = ui
        self.game = ui.game
        self.minimap = None
        self.minimap_size = 168

    def draw(self, s, w, h):
        self.vitals(s, 14, 14)
        self.money_panel(s, w - 14, 14)
        self.objective(s, w - 14, 104)
        self.clock(s, w / 2, 16)
        self.hotbar(s, w / 2, h - 14)
        self.minimap_panel(s, 14, h - 14)
        self.notifications(s, w, h)

    # ------------------------------------------------------------------ vitals
    def vitals(self, s, x, y):
        p = self.game.player
        w, h = 246, 96
        U.draw_panel(s, x, y, w, h)
        s.blit(self.ui.player_portrait, (x + 12, y + 14))
        bx = x + 78
        bw = w - 92
        U.engraved(s, 'Engineer  -  Level %d' % p.level, bx, y + 14, U.FONT_BODY, P.UI_TRIM_HI, 13, True)
        s.blit(U.glyph('heart', 11, P.UI_BAD), (bx - 2, y + 33))
        U.bar(s, bx + 13, y + 33, bw - 13, 11, p.health / p.max_health, P.UI_BAD,
              '%d' % p.health, (26, 12, 10))
        s.blit(U.glyph('stamina', 11, P.UI_GOOD), (bx - 2, y + 49))
        U.bar(s, bx + 13, y + 49, bw - 13, 11, p.stamina / p.max_stamina, P.UI_GOOD,
              '%d' % p.stamina, (12, 26, 12))
        s.blit(U.glyph('xp', 11, P.UI_TRIM_HI), (bx - 2, y + 65))
        U.bar(s, bx + 13, y + 65, bw - 13, 11, p.xp / p.xp_next, P.UI_TRIM_HI,
              '%d / %d XP' % (p.xp, p.xp_next), (29, 22, 8))
        if p.skill_points > 0:
            D.circle(s, P.UI_TRIM_HI, x + 18, y + h - 18, 8)
            U.engraved(s, str(p.skill_points), x + 18, y + h - 25, U.FONT_BODY, (29, 22, 8), 11, True, 'center')

    # ------------------------------------------------------------------ money
    def money_panel(self, s, right, y):
        g = self.game
        w, h = 260, 80
        x = right - w
        U.draw_panel(s, x, y, w, h)
        s.blit(U.glyph('money', 22, P.UI_TRIM_HI), (x + 16, y + 16))
        U.engraved(s, money(g.money), x + 46, y + 14, U.FONT_TITLE,
                   P.UI_BAD if g.money < 0 else P.UI_TEXT, 22, True)
        net = g.net_per_minute
        U.engraved(s, '%s%s/min' % ('+' if net >= 0 else '', money(net)), x + 46, y + 40,
                   U.FONT_BODY, P.UI_GOOD if net >= 0 else P.UI_BAD, 11)
        gen = g.factory.stats['power_gen']
        use = g.factory.stats['power_use']
        frac = 1.0 if use <= 0 else clamp(gen / use, 0, 1)
        s.blit(U.glyph('power', 14, P.UI_GOOD if gen >= use else P.UI_BAD), (x + 15, y + 55))
        U.bar(s, x + 34, y + 56, w - 50, 13, frac, P.UI_GOOD if gen >= use else P.UI_WARN,
              '%d / %d kW' % (gen, use), (13, 20, 16))

    # ------------------------------------------------------------------ clock
    def clock(self, s, cx, y):
        t = self.game.time
        w, h = 168, 34
        x = cx - w / 2
        U.draw_panel(s, x, y, w, h, 'dark')
        hour = int(t['hour'])
        minute = int((t['hour'] % 1) * 60)
        U.engraved(s, 'Day %d   %02d:%02d' % (t['day'], hour, minute), x + w / 2 + 8, y + 9,
                   U.FONT_MONO, P.UI_TEXT, 13, True, 'center')
        dl = t['daylight']
        cxx, cyy = x + 22, y + h / 2
        if dl > 0.4:
            D.circle(s, P.GLOW_WARM, cxx, cyy, 6)
            for i in range(8):
                a = i / 8 * math.tau
                D.line(s, rgba(P.GLOW_WARM, 0.6),
                       (cxx + math.cos(a) * 7.6, cyy + math.sin(a) * 7.6),
                       (cxx + math.cos(a) * 10, cyy + math.sin(a) * 10), 1)
        else:
            D.circle(s, (205, 214, 224), cxx, cyy, 6)
            D.circle(s, (35, 40, 47), cxx + 2.6, cyy - 2, 5)

    # ------------------------------------------------------------------ objective
    def objective(self, s, right, y):
        ms = self.game.missions
        m = MISSION_BY_ID.get(ms.tracked)
        if not m:
            return
        w = 250
        x = right - w
        h = 42 + len(m['goals']) * 17
        U.draw_panel(s, x, y, w, h, 'dark')
        s.blit(U.glyph('mission', 14, P.UI_TRIM_HI), (x + 14, y + 13))
        U.engraved(s, m['name'], x + 34, y + 14, U.FONT_BODY, P.UI_TRIM_HI, 13, True)
        for i, goal in enumerate(m['goals']):
            done = ms.goal_done(m, i)
            gy = y + 40 + i * 17
            D.circle(s, P.UI_GOOD if done else rgba(P.WHITE, 0.25), x + 20, gy + 5, 4.2)
            if done:
                D.line(s, (16, 20, 24), (x + 18, gy + 5), (x + 19.6, gy + 7), 2)
                D.line(s, (16, 20, 24), (x + 19.6, gy + 7), (x + 22.4, gy + 3), 2)
            U.engraved(s, ms.goal_text(goal, ms.goal_progress(m, i), ms.goal_target(goal)),
                       x + 30, gy, U.FONT_BODY, P.UI_DIM if done else P.UI_TEXT, 11)

    # ------------------------------------------------------------------ hotbar
    def hotbar(self, s, cx, bottom):
        slots = self.game.hotbar
        n = len(slots)
        size, pad = 54, 5
        w = n * (size + pad) + pad + 8
        h = size + 16
        x = cx - w / 2
        y = bottom - h
        U.draw_panel(s, x, y, w, h, 'dark')
        wc = self.ui.wc
        for i, bid in enumerate(slots):
            sx = x + 8 + i * (size + pad)
            sy = y + 8
            sel = self.game.build['active'] and self.game.build['type'] == bid
            d = BUILDABLES.get(bid)
            _hov, clicked = wc.slot(sx, sy, size, size, selected=sel,
                                    tip=d['name'] if d else 'Empty slot',
                                    tip_body=('%s\n$%d' % (d['desc'], d['cost'])) if d else None)
            if d:
                spr = machine_sprite(bid, 0)['surf']
                sc = min((size - 14) / spr.get_width(), (size - 22) / spr.get_height(), 1.4)
                img = pygame.transform.smoothscale(
                    spr, (int(spr.get_width() * sc), int(spr.get_height() * sc)))
                s.blit(img, (int(sx + size / 2 - img.get_width() / 2),
                             int(sy + (size - 12) / 2 - img.get_height() / 2 + 2)))
                D.rect(s, rgba((8, 10, 14), 0.7), (sx + 1, sy + size - 13, size - 2, 12))
                U.engraved(s, '$' + short_num(d['cost']), sx + size / 2, sy + size - 13,
                           U.FONT_BODY, P.UI_TEXT if self.game.money >= d['cost'] else P.UI_BAD,
                           10, False, 'center')
            U.engraved(s, str(i + 1), sx + 5, sy + 2, U.FONT_BODY, P.UI_DIM, 10)
            if clicked:
                self.game.select_hotbar(i)

    # ------------------------------------------------------------------ minimap
    def build_minimap(self):
        w = self.game.world
        size = self.minimap_size
        s = pygame.Surface((size, size)).convert()
        step = w.W / size
        for y in range(size):
            ty = int(y * step)
            for x in range(size):
                tx = int(x * step)
                col = (212, 162, 74) if w.node_at(tx, ty) else TILE_AVG.get(w.tile(tx, ty), (51, 51, 51))
                s.set_at((x, y), col)
        self.minimap = s

    def minimap_panel(self, s, x, bottom):
        if self.minimap is None:
            self.build_minimap()
        size, pad = self.minimap_size, 10
        y = bottom - size - pad * 2
        U.draw_panel(s, x, y, size + pad * 2, size + pad * 2, 'dark')
        mx, my = x + pad, y + pad
        s.blit(self.minimap, (mx, my))
        w = self.game.world
        sc = size / w.W
        for e in self.game.factory.ents:
            if e.kind in ('cable', 'belt'):
                continue
            D.rect(s, P.UI_TRIM_HI, (mx + e.x * sc, my + e.y * sc,
                                     max(1.5, e.w * sc), max(1.5, e.h * sc)))
        p = w.plot
        D.rect(s, rgba(P.UI_TRIM, 0.9), (mx + p['x'] * sc, my + p['y'] * sc,
                                         p['w'] * sc, p['h'] * sc), 1)
        px = mx + self.game.player.x * sc
        py = my + self.game.player.y * sc
        D.glow(s, px, py, 7, P.GLOW_COLD, 0.7, add=True)
        D.circle(s, P.WHITE, px, py, 2.4)
        v = self.game.cam.view()
        D.rect(s, rgba(P.WHITE, 0.5), (mx + v[0] / TILE * sc, my + v[1] / TILE * sc,
                                       (v[2] - v[0]) / TILE * sc, (v[3] - v[1]) / TILE * sc), 1)
        D.rect(s, rgba(P.BLACK, 0.8), (mx - 1, my - 1, size + 2, size + 2), 1)
        region = self.game.current_region
        if region:
            U.engraved(s, region['name'], mx + size / 2, my + size - 14,
                       U.FONT_BODY, P.UI_TRIM_HI, 10, True, 'center')

    # ------------------------------------------------------------ notifications
    def notifications(self, s, w, h):
        y = 150
        for n in self.ui.notifications:
            a = clamp(n['life'] / 0.6, 0, 1) if n['life'] < 0.6 else 1.0
            col = dict(good=P.UI_GOOD, bad=P.UI_BAD, warn=P.UI_WARN,
                       info=P.GLOW_COLD).get(n['kind'], P.UI_TEXT)
            tw = 300
            x = w / 2 - tw / 2
            D.rr(s, (x, y, tw, 30), rgba((10, 12, 16), 0.82 * a), 5)
            D.rr(s, (x, y, tw, 30), rgba(col, 0.8 * a), 5, 2)
            D.rect(s, rgba(col, a), (x + 3, y + 3, 3.5, 24))
            U.engraved(s, n['text'], x + 16, y + 7, U.FONT_BODY, P.UI_TEXT, 13)
            y += 36
