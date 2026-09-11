"""World renderer: cached terrain chunks, depth-sorted actors, animated machinery,
day/night lighting and build previews.
"""
import math
import random

import pygame

from ..art import draw as D
from ..art import palette as P
from ..art import ui as U
from ..art.icons import item_chip
from ..art.machines import machine_sprite, HEAD
from ..art.props import prop_sprite
from ..art.tiles import build_tileset, build_ore_overlays, TILE_AVG
from ..core.utils import TAU, DIRS, clamp
from ..data.buildables import BUILDABLES
from ..data.recipes import RECIPES
from ..world.world import TILE, ROAD
from ..art.palette import rgba, shade, mix

CHUNK = 8            # tiles per chunk side


class Renderer:
    def __init__(self, game):
        self.game = game
        self.tileset = build_tileset()
        self.ore = build_ore_overlays()
        self.chunks = {}
        self.world_surf = None
        self.light_surf = None
        self._belt_rot = {}

    # ------------------------------------------------------------- terrain
    def invalidate_chunk_at(self, tx, ty):
        self.chunks.pop((tx // CHUNK, ty // CHUNK), None)

    def chunk(self, cx, cy):
        hit = self.chunks.get((cx, cy))
        if hit is not None:
            return hit
        w = self.game.world
        size = CHUNK * TILE
        s = pygame.Surface((size, size)).convert()
        for ty in range(CHUNK):
            for tx in range(CHUNK):
                wx, wy = cx * CHUNK + tx, cy * CHUNK + ty
                t = w.tile(wx, wy)
                variants = self.tileset.get(t) or self.tileset[0]
                v = w.variant[w.idx(wx, wy)] % len(variants) if w.in_bounds(wx, wy) else 0
                s.blit(variants[v], (tx * TILE, ty * TILE))

                # soft edge blending so biomes don't hard-cut
                for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
                    nt = w.tile(wx + dx, wy + dy)
                    if nt == t:
                        continue
                    col = TILE_AVG.get(nt)
                    if col is None:
                        continue
                    gx, gy = tx * TILE, ty * TILE
                    fade = D.surf(TILE, TILE)
                    if dx:
                        D.grad_rect(fade, (0, 0, TILE, TILE),
                                    [(0.0, col), (1.0, col)], horiz=True)
                        for i in range(TILE):
                            a = max(0.0, 1 - i / 10.0) * 0.62
                            px = TILE - 1 - i if dx > 0 else i
                            pygame.draw.line(fade, rgba(col, a), (px, 0), (px, TILE))
                    else:
                        for i in range(TILE):
                            a = max(0.0, 1 - i / 10.0) * 0.62
                            py = TILE - 1 - i if dy > 0 else i
                            pygame.draw.line(fade, rgba(col, a), (0, py), (TILE, py))
                    s.blit(fade, (gx, gy))

                node = w.node_at(wx, wy)
                if node:
                    ov = self.ore.get(node.type)
                    if ov:
                        img = ov[(wx * 7 + wy * 13) % len(ov)]
                        img.set_alpha(int(255 * clamp(0.35 + (node.amount / max(1, node.max)) * 0.65,
                                                      0.25, 1.0)))
                        s.blit(img, (tx * TILE, ty * TILE))
                        img.set_alpha(255)

                if (wx, wy) in self.game.floors:
                    spr = machine_sprite('floor', 0)
                    s.blit(spr['surf'], (tx * TILE, ty * TILE),
                           pygame.Rect(0, spr['head'], TILE, TILE))
        self.chunks[(cx, cy)] = s
        if len(self.chunks) > 900:
            self.chunks.pop(next(iter(self.chunks)))
        return s

    # ---------------------------------------------------------------- frame
    def draw(self, screen, cam, dt):
        game = self.game
        lw, lh = cam.lw, cam.lh
        if self.world_surf is None or self.world_surf.get_size() != (lw, lh):
            self.world_surf = pygame.Surface((lw, lh)).convert()
        ws = self.world_surf
        ws.fill((11, 13, 16))
        ox, oy = cam.offset()
        v = cam.view()

        # ---- terrain
        c0, c1 = int(v[0] // (CHUNK * TILE)), int(v[2] // (CHUNK * TILE))
        r0, r1 = int(v[1] // (CHUNK * TILE)), int(v[3] // (CHUNK * TILE))
        for cy in range(r0, r1 + 1):
            for cx in range(c0, c1 + 1):
                if cx < 0 or cy < 0 or cx * CHUNK >= game.world.W or cy * CHUNK >= game.world.H:
                    continue
                ws.blit(self.chunk(cx, cy), (cx * CHUNK * TILE - ox, cy * CHUNK * TILE - oy))

        self.draw_plot_edge(ws, game, ox, oy)

        # ---- flat entities first, then a depth-sorted layer
        flat, tall = [], []
        for e in game.factory.ents:
            if (e.x * TILE > v[2] + 200 or (e.x + e.w) * TILE < v[0] - 200 or
                    e.y * TILE > v[3] + 240 or (e.y + e.h) * TILE < v[1] - 240):
                continue
            (flat if e.kind in ('belt', 'cable', 'pipe') else tall).append(e)
        for e in flat:
            self.draw_entity(ws, e, dt, ox, oy)

        actors = []
        for p in game.world.props:
            if (p.x * TILE < v[0] - 260 or p.x * TILE > v[2] + 260 or
                    p.y * TILE < v[1] - 320 or p.y * TILE > v[3] + 260):
                continue
            actors.append((p.y, 0, p))
        for e in tall:
            actors.append((e.y + e.h, 1, e))
        for n in game.npcs:
            if (n.x * TILE < v[0] - 120 or n.x * TILE > v[2] + 120 or
                    n.y * TILE < v[1] - 160 or n.y * TILE > v[3] + 120):
                continue
            actors.append((n.y, 2, n))
        for e in game.employees.list:
            actors.append((e.y, 2, e))
        actors.append((game.player.y, 3, game.player))
        actors.sort(key=lambda a: (a[0], a[1]))

        for _y, kind, obj in actors:
            if kind == 0:
                self.draw_prop(ws, obj, ox, oy)
            elif kind == 1:
                self.draw_entity(ws, obj, dt, ox, oy)
            else:
                obj.draw(ws, obj.x * TILE - ox, obj.y * TILE - oy)

        game.fx.draw(ws, ox, oy)

        self.draw_build_preview(ws, game, ox, oy)
        self.draw_selection(ws, game, ox, oy)
        self.draw_lighting(ws, cam, game, ox, oy)

        # ---- one scale to the window
        if cam.zoom == 1.0:
            screen.blit(ws, (0, 0))
        else:
            pygame.transform.smoothscale(ws, (cam.vw, cam.vh), screen)

        game.fx.draw_texts(screen, cam)
        self.draw_region_label(screen, cam, game)

    # ---------------------------------------------------------------- pieces
    def draw_plot_edge(self, ws, game, ox, oy):
        p = game.world.plot
        x0, y0 = p['x'] * TILE - ox, p['y'] * TILE - oy
        w, h = p['w'] * TILE, p['h'] * TILE
        col = rgba(P.UI_TRIM, 0.55)
        dash = 14
        for x in range(0, int(w), dash * 2):
            D.line(ws, col, (x0 + x, y0), (x0 + min(x + dash, w), y0), 2)
            D.line(ws, col, (x0 + x, y0 + h), (x0 + min(x + dash, w), y0 + h), 2)
        for y in range(0, int(h), dash * 2):
            D.line(ws, col, (x0, y0 + y), (x0, y0 + min(y + dash, h)), 2)
            D.line(ws, col, (x0 + w, y0 + y), (x0 + w, y0 + min(y + dash, h)), 2)
        for cx, cy in ((x0, y0), (x0 + w, y0), (x0, y0 + h), (x0 + w, y0 + h)):
            D.rect(ws, P.STEEL_DARK, (cx - 3, cy - 14, 6, 16))
            D.rect(ws, P.YELLOW, (cx - 3, cy - 14, 6, 4))

    def draw_prop(self, ws, p, ox, oy):
        spr = prop_sprite(p.type, p.seed)
        if not spr:
            return
        ws.blit(spr['surf'], (int(p.x * TILE - spr['ox'] - ox), int(p.y * TILE - spr['oy'] - oy)))
        if p.label and self.game.cam.zoom > 0.9:
            t = U.text_surface(p.label, U.FONT_BODY, P.UI_TRIM_HI, 10, True)
            bx = int(p.x * TILE - t.get_width() / 2 - 5 - ox)
            by = int(p.y * TILE - spr['oy'] - 15 - oy)
            D.rr(ws, (bx, by, t.get_width() + 10, 14), rgba(P.BLACK, 0.6), 3)
            ws.blit(t, (bx + 5, by + 2))

    def belt_sprite(self, e):
        """Belts are painted pointing north; rotate once per direction and cache."""
        key = (e.type, e.dir)
        hit = self._belt_rot.get(key)
        if hit is None:
            base = machine_sprite(e.type, 0)['surf']
            hit = pygame.transform.rotate(base, -90 * e.dir)
            if pygame.display.get_surface():
                hit = hit.convert_alpha()
            self._belt_rot[key] = hit
        return hit

    def draw_entity(self, ws, e, dt, ox, oy):
        spr = machine_sprite(e.type, e.dir)
        if not spr:
            return
        px = e.x * TILE - ox
        py = e.y * TILE - spr['head'] - oy
        if e.kind == 'belt':
            img = self.belt_sprite(e)
            ws.blit(img, (int(px - (img.get_width() - e.w * TILE) / 2),
                          int(py + spr['head'] - (img.get_height() - e.h * TILE) / 2)))
        else:
            ws.blit(spr['surf'], (int(px), int(py)))

        if e.broken:
            D.rect(ws, rgba((20, 16, 12), 0.5), (px, py + spr['head'], e.w * TILE, e.h * TILE))
            if math.sin(e.anim * 7) > 0:
                D.glow(ws, e.cx * TILE - ox, e.cy * TILE - oy, 28, P.UI_BAD, 0.22, add=True)

        self.animate(ws, e, px, py + spr['head'], dt, ox, oy)
        self.draw_status(ws, e, px, py + spr['head'])

    # ------------------------------------------------------------- animation
    def animate(self, ws, e, px, top, dt, ox, oy):
        t = e.anim
        w, h = e.w * TILE, e.h * TILE
        cx, cy = px + w / 2, top + h / 2
        run = e.active and not e.broken
        fx = self.game.fx

        def emit(rate):
            return random.random() < dt * rate

        typ = e.type
        if typ in ('belt', 'belt_fast'):
            dx, dy = DIRS[e.dir]
            if run or e.items:
                off = (t * e.def_['speed'] * 9) % 8
                clip = ws.get_clip()
                ws.set_clip(pygame.Rect(int(px + 2), int(top + 2), int(w - 4), int(h - 4)))
                for i in range(-8, int(max(w, h)) + 8, 8):
                    o = i + off
                    if dx:
                        bx = px + (o if dx > 0 else w - o)
                        D.rect(ws, rgba(P.WHITE, 0.10), (bx, top + 3, 2.4, h - 6))
                    else:
                        by = top + (o if dy > 0 else h - o)
                        D.rect(ws, rgba(P.WHITE, 0.10), (px + 3, by, w - 6, 2.4))
                ws.set_clip(clip)
            for item_id, p in e.items:
                ix = px + w / 2 + dx * (p - 0.5) * w
                iy = top + h / 2 + dy * (p - 0.5) * h
                ws.blit(item_chip(item_id, 18), (int(ix - 9), int(iy - 9)))

        elif typ in ('miner', 'miner_adv'):
            dcx, dcy = px + w * 0.62, top + h * 0.58
            ang = t * 9 if run else 0
            for i in range(3):
                a = ang + i / 3 * TAU
                D.polygon(ws, P.STEEL_HI, [(dcx, dcy),
                                           (dcx + math.cos(a) * 7, dcy + math.sin(a) * 7),
                                           (dcx + math.cos(a + 0.5) * 7, dcy + math.sin(a + 0.5) * 7)])
            D.circle(ws, P.STEEL_DARK, dcx, dcy, 2.4)
            if run and emit(6):
                fx.dust(e.cx, e.cy + 0.3, 1)

        elif typ == 'furnace':
            dw = w * 0.36
            dx0 = px + w / 2 - dw / 2
            dy0 = top + h * 0.42
            heat = clamp((e.temp - 90) / 620.0, 0, 1)
            if heat > 0.02:
                f = 0.75 + math.sin(t * 11) * 0.12 + math.sin(t * 23) * 0.06
                # the firebox mouth glows; keep it inside the door frame
                D.rr(ws, (dx0 + 2, dy0 + 2, dw - 4, h * 0.3 - 4),
                     rgba(mix(P.GLOW_HOT, P.GLOW_WARM, f * 0.5), 0.55 * heat), 2)
                D.glow(ws, dx0 + dw / 2, dy0 + h * 0.16, 15 * f, P.GLOW_HOT, 0.16 * heat, add=True)
            if run and emit(7):
                fx.smoke(e.x + e.w - 0.45, e.y - 0.55, 1)
            if run and emit(9):
                fx.fire(e.cx, e.cy + 0.15, 1)

        elif typ == 'press':
            drop = abs(math.sin(e.progress * math.pi * 3)) if run else 0
            ry = top + h * 0.4 + drop * h * 0.2
            D.rect(ws, rgba(P.BLACK, 0.35), (px + w * 0.3, ry + 2, w * 0.4, h * 0.14))
            D.plate(ws, (px + w * 0.3, ry, w * 0.4, h * 0.14), P.STEEL_HI, 2, 1)
            if run and drop > 0.93 and emit(8):
                fx.sparks(e.cx, e.cy + 0.1, 3)

        elif typ == 'cutter':
            bx, by = px + w * 0.5, top + h * 0.42
            ang = t * 22 if run else 0
            for i in range(10):
                a = ang + (i / 10) * TAU
                D.line(ws, P.STEEL_HI, (bx + math.cos(a) * 3, by + math.sin(a) * 3),
                       (bx + math.cos(a) * 10, by + math.sin(a) * 10), 2)
            if run and emit(6):
                fx.sparks(e.cx, e.cy + 0.05, 2)

        elif typ == 'assembler':
            for sgn in (-1, 1):
                ax = px + w * (0.28 if sgn < 0 else 0.72)
                ay = top + h * 0.3
                a = math.sin(t * (4 if run else 0.6) + (1.6 if sgn > 0 else 0)) * 0.8 * sgn
                ex, ey = ax + math.sin(a) * 13, ay + math.cos(a) * 13
                D.line(ws, P.ORANGE, (ax, ay), (ex, ey), 4)
                D.line(ws, P.STEEL_HI, (ex, ey), (ex + sgn * 5, ey + 6), 3)
            if run and emit(3):
                fx.sparks(e.cx, e.cy, 2)

        elif typ == 'chemical':
            for i in range(3):
                vx = px + w * (0.22 + i * 0.28)
                vy = top + h * 0.42
                lvl = 0.5 + math.sin(t * 3 + i) * 0.2 if run else 0.35
                rh = min(w, h) * 0.13 * 1.4
                D.rect(ws, rgba((127, 208, 138), 0.75),
                       (vx - 2.5, vy + rh / 2 - rh * lvl, 5, rh * lvl))
                if run and emit(1.2):
                    fx.steam(e.x + 0.3 + i * 0.8, e.y + 0.3, 1)

        elif typ == 'packager':
            if run:
                p = (t * 0.5) % 1
                ws.blit(item_chip('tool_kit', 16), (int(px + 6 + p * (w - 30)), int(top + h * 0.6)))

        elif typ == 'recycler':
            if run:
                D.rect(ws, rgba(P.BLACK, 0.25),
                       (px + w * 0.34 + math.sin(t * 30) * 0.7, top + h * 0.4, w * 0.32, 3))
                if emit(4):
                    fx.dust(e.cx, e.cy, 1)

        elif typ == 'robotics':
            for ax, ay, ph in ((0.26, 0.3, 0), (0.74, 0.3, 2), (0.5, 0.7, 4)):
                jx, jy = px + w * ax, top + h * ay
                a = math.sin(t * (3.4 if run else 0.5) + ph) * 1.1
                ex, ey = jx + math.sin(a) * 14, jy + math.cos(a) * 14
                D.line(ws, P.ORANGE, (jx, jy), (ex, ey), 5)
                D.line(ws, P.STEEL_HI, (ex, ey), (ex + 6, ey + 6), 3)
            if run:
                D.glow(ws, cx, cy, 30 + math.sin(t * 4) * 6, P.GLOW_COLD, 0.10, add=True)

        elif typ == 'coal_gen':
            if run:
                D.glow(ws, px + 17, top + h * 0.78, 9, P.GLOW_HOT,
                       0.30 + math.sin(t * 9) * 0.06, add=True)
                if emit(6):
                    fx.smoke(e.x + e.w - 0.5, e.y - 0.5, 1)
                fw = px + w - 13
                fy = top + h * 0.7
                for i in range(4):
                    a = t * 6 + i / 4 * TAU
                    D.line(ws, P.COPPER_HI, (fw, fy),
                           (fw + math.cos(a) * 6, fy + math.sin(a) * 6), 2)

        elif typ == 'turbine':
            if run:
                rx, ry = px + w * 0.2, top + h * 0.44
                for i in range(6):
                    a = t * 16 + i / 6 * TAU
                    D.polygon(ws, P.STEEL_HI, [(rx, ry),
                                               (rx + math.cos(a) * 8, ry + math.sin(a) * 8),
                                               (rx + math.cos(a + 0.4) * 8, ry + math.sin(a + 0.4) * 8)])
                if emit(6):
                    fx.steam(e.cx + 0.6, e.y - 0.3, 1)

        elif typ == 'fusion':
            pulse = 0.6 + math.sin(t * 2.2) * 0.25
            D.glow(ws, cx, top + h * 0.46, min(w, h) * 0.4 * pulse, P.GLOW_COLD, 0.22, add=True)
            if emit(3):
                fx.arc(e.cx + (random.random() - 0.5), e.cy + (random.random() - 0.5) * 0.6)

        elif typ == 'solar':
            dl = self.game.time['daylight']
            if dl > 0.1:
                D.polygon(ws, rgba(P.WHITE, 0.12 * dl),
                          [(px, top + h), (px + w * 0.45, top), (px + w * 0.62, top),
                           (px + w * 0.14, top + h)])

        elif typ == 'lamp':
            # only spend light where it reads: at night
            if e.powered:
                night = 1 - self.game.time['daylight']
                D.glow(ws, cx, top + h * 0.2, 14 + 12 * night, P.GLOW_WARM,
                       0.10 + 0.16 * night, add=True)

        elif typ == 'dock':
            if e.active:
                self.draw_truck(ws, px + w * 0.5, top + h + 6, t)

        elif typ == 'lab':
            if run:
                D.glow(ws, cx, top + h * 0.5, 28 + math.sin(t * 3) * 4, P.GLOW_COLD, 0.12, add=True)
                if emit(1.2):
                    fx.steam(e.cx, e.cy - 0.2, 1)

        elif typ == 'waterpump':
            if run:
                wx, wy = px + w * 0.38, top + h * 0.45
                for i in range(3):
                    a = t * 7 + i / 3 * TAU
                    D.line(ws, rgba(P.WATER_HI, 0.7), (wx, wy),
                           (wx + math.cos(a) * 7, wy + math.sin(a) * 7), 2)

        if not e.powered and e.def_['power'] > 0 and not e.broken and math.sin(t * 5) > 0.4:
            D.glow(ws, px + 7, top + 7, 10, P.UI_WARN, 0.28, add=True)

    def draw_truck(self, ws, x, y, t):
        p = (math.sin(t * 0.6) * 0.5 + 0.5) * 12
        x = x - 34 + p
        D.plate(ws, (x, y - 26, 44, 24), (200, 205, 210), 2, 1)
        D.hazard(ws, (x, y - 6, 44, 5), pitch=5)
        D.plate(ws, (x + 44, y - 22, 18, 20), P.RED, 3, 1)
        D.rr(ws, (x + 47, y - 19, 12, 8), rgba(P.GLASS, 0.6), 2)
        for wx in (8, 20, 34, 52):
            D.circle(ws, (22, 22, 26), x + wx, y, 4.2)
            D.circle(ws, (74, 74, 82), x + wx, y, 1.6)

    def draw_status(self, ws, e, px, top):
        if self.game.cam.zoom < 0.7:
            return
        w = e.w * TILE
        if e.kind in ('machine', 'miner', 'gen', 'lab') and (
                e.active or e.progress > 0 or e.condition < 0.999 or e.broken):
            bw = min(w - 8, 48)
            bx = px + w / 2 - bw / 2
            by = top - 9
            if e.progress > 0 or e.active:
                D.rr(ws, (bx, by, bw, 4), rgba((6, 8, 11), 0.7), 2)
                D.rr(ws, (bx + 0.7, by + 0.7, max(1, (bw - 1.4) * clamp(e.progress, 0, 1)), 2.6),
                     P.UI_GOOD, 1)
            if e.condition < 0.85 or e.broken:
                D.rr(ws, (bx, by - 5, bw, 4), rgba((6, 8, 11), 0.7), 2)
                D.rr(ws, (bx + 0.7, by - 4.3, max(1, (bw - 1.4) * clamp(e.condition, 0, 1)), 2.6),
                     P.UI_BAD if e.condition < 0.3 else P.UI_WARN, 1)
        if self.game.cam.zoom > 1.05 and e.total_out() > 0 and e.kind in ('machine', 'miner', 'store'):
            for i, item_id in enumerate(list(e.out_buf)[:3]):
                ix = px + 4 + i * 16
                iy = top + e.h * TILE - 17
                ws.blit(item_chip(item_id, 15), (int(ix), int(iy)))
                U.engraved(ws, str(e.out_buf[item_id]), ix + 11, iy + 4, U.FONT_MONO, P.UI_TEXT, 9, True)

    # --------------------------------------------------------------- previews
    def draw_build_preview(self, ws, game, ox, oy):
        b = game.build
        if not b['active'] or not b['type']:
            return
        d = BUILDABLES[b['type']]
        tx, ty = game.cursor_tile
        ok, _why = game.factory.can_place(b['type'], tx, ty, b['dir'])
        swap = b['dir'] % 2 == 1 and d['w'] != d['h']
        w = (d['h'] if swap else d['w']) * TILE
        h = (d['w'] if swap else d['h']) * TILE
        spr = machine_sprite(b['type'], b['dir'])
        img = spr['surf'].copy()
        img.set_alpha(160)
        ws.blit(img, (int(tx * TILE - ox), int(ty * TILE - spr['head'] - oy)))
        col = P.UI_GOOD if ok else P.UI_BAD
        D.rect(ws, rgba(col, 0.18 if ok else 0.24), (tx * TILE - ox, ty * TILE - oy, w, h))
        D.rect(ws, col, (tx * TILE - ox, ty * TILE - oy, w, h), 2)
        if d['kind'] in ('belt', 'machine', 'dock', 'miner'):
            dx, dy = DIRS[b['dir']]
            cx = tx * TILE - ox + w / 2
            cy = ty * TILE - oy + h / 2
            D.line(ws, P.UI_TRIM_HI, (cx - dx * w * 0.3, cy - dy * h * 0.3),
                   (cx + dx * w * 0.32, cy + dy * h * 0.32), 3)
            D.polygon(ws, P.UI_TRIM_HI, [
                (cx + dx * w * 0.44, cy + dy * h * 0.44),
                (cx + dx * w * 0.24 - dy * 7, cy + dy * h * 0.24 - dx * 7),
                (cx + dx * w * 0.24 + dy * 7, cy + dy * h * 0.24 + dx * 7)])

    def draw_selection(self, ws, game, ox, oy):
        e = game.selected
        if e is None or e not in game.factory.ents:
            return
        x, y = e.x * TILE - ox, e.y * TILE - oy
        D.rect(ws, P.UI_TRIM_HI, (x - 2, y - 2, e.w * TILE + 4, e.h * TILE + 4), 2)

    # --------------------------------------------------------------- lighting
    def draw_lighting(self, ws, cam, game, ox, oy):
        night = 1 - game.time['daylight']
        if night < 0.04:
            return
        lw, lh = ws.get_size()
        if self.light_surf is None or self.light_surf.get_size() != (lw, lh):
            self.light_surf = pygame.Surface((lw, lh), pygame.SRCALPHA)
        ls = self.light_surf
        tint = mix((11, 16, 32), (20, 28, 46), 0.4)
        ls.fill((tint[0], tint[1], tint[2], int(190 * night)))

        def punch(wx, wy, r, strength=1.0):
            sx, sy = wx - ox, wy - oy
            if sx < -r or sy < -r or sx > lw + r or sy > lh + r:
                return
            hole = D.radial((0, 0, 0), int(r), 0.95 * strength, falloff=0.8)
            ls.blit(hole, (int(sx - r), int(sy - r)), special_flags=pygame.BLEND_RGBA_SUB)

        punch(game.player.x * TILE, game.player.y * TILE - 8, 130, 0.85)
        for e in game.factory.ents:
            if e.kind == 'lamp' and e.powered:
                punch(e.cx * TILE, e.cy * TILE, 150, 1.0)
            elif e.type == 'furnace' and e.temp > 200:
                punch(e.cx * TILE, e.cy * TILE, 110, 0.8)
            elif e.type == 'coal_gen' and e.active:
                punch(e.cx * TILE, e.cy * TILE, 90, 0.6)
            elif e.type == 'fusion':
                punch(e.cx * TILE, e.cy * TILE, 190, 0.95)
            elif e.kind == 'lab' and e.active:
                punch(e.cx * TILE, e.cy * TILE, 100, 0.65)
            elif e.kind in ('service', 'store'):
                punch(e.cx * TILE, e.cy * TILE, 70, 0.4)
        for p in game.world.props:
            if p.type == 'streetlight':
                punch(p.x * TILE + 13, p.y * TILE - 66, 120, 0.8)
            elif p.type == 'mine_entrance':
                punch(p.x * TILE, p.y * TILE - 24, 90, 0.6)
            elif p.type in ('shop', 'apartment', 'office_bldg', 'factory_bldg', 'warehouse_bldg'):
                punch(p.x * TILE, p.y * TILE - 40, 110, 0.5)
        ws.blit(ls, (0, 0))

        for e in game.factory.ents:
            if e.kind == 'lamp' and e.powered:
                D.glow(ws, e.cx * TILE - ox, e.cy * TILE - 12 - oy, 48, P.GLOW_WARM,
                       0.14 * night, add=True)

    def draw_region_label(self, screen, cam, game):
        r = game.current_region
        if not r or game.region_fade <= 0:
            return
        a = min(1.0, game.region_fade)
        t = U.text_surface(r['name'], U.FONT_TITLE, P.UI_TRIM_HI, 34, True)
        sh = U.text_surface(r['name'], U.FONT_TITLE, (0, 0, 0), 34, True)
        t.set_alpha(int(255 * a))
        sh.set_alpha(int(160 * a))
        x = cam.vw / 2 - t.get_width() / 2
        screen.blit(sh, (int(x + 2), 90))
        screen.blit(t, (int(x), 88))
        D.rect(screen, rgba(P.UI_TRIM, 0.6 * a), (cam.vw / 2 - 90, 128, 180, 2))
