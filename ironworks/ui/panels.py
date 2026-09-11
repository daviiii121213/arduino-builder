"""Full-screen windows: build menu, inventory, machine inspector, management hub,
research tree, world map, missions, skills, dialogue and options.
"""
import math

import pygame

from ..art import draw as D
from ..art import palette as P
from ..art import ui as U
from ..art.characters import portrait
from ..art.icons import item_icon, item_chip
from ..art.machines import machine_sprite
from ..core.utils import clamp, money, short_num, time_str, TAU
from ..data.buildables import BUILDABLES, CATEGORIES, buildables_for
from ..data.items import ITEMS
from ..data.recipes import RECIPES, recipes_for
from ..data.research import TECHS
from ..entities.npc import ROLE_INFO
from ..systems.missions import MISSIONS
from ..world.world import TILE
from ..art.palette import rgba, shade, mix


class Panels:
    def __init__(self, ui):
        self.ui = ui
        self.game = ui.game
        self.mgmt_tab = 'overview'
        self.build_cat = 'logistics'

    @property
    def s(self):
        return self.ui.screen

    @property
    def wc(self):
        return self.ui.wc

    def window(self, title, w, h, icon=None):
        """Standard window chrome; returns the inner content rect."""
        s = self.s
        W, H = self.ui.w, self.ui.h
        x = int(W / 2 - w / 2)
        y = int(H / 2 - h / 2)
        shade_layer = pygame.Surface((W, H), pygame.SRCALPHA)
        shade_layer.fill((6, 8, 11, 140))
        s.blit(shade_layer, (0, 0))
        U.draw_panel(s, x, y, w, h)
        if icon:
            s.blit(U.glyph(icon, 20, P.UI_TRIM_HI), (x + 16, y + 12))
        U.engraved(s, title, x + (44 if icon else 18), y + 13, U.FONT_TITLE, P.UI_TRIM_HI, 16, True)
        if self.wc.button(x + w - 40, y + 10, 26, 24, ''):
            self.ui.close()
        s.blit(U.glyph('close', 13, P.UI_TEXT), (x + w - 33, y + 15))
        if self.wc.hover(x, y, w, h):
            self.ui.hovering_ui = True
        return dict(x=x + 18, y=y + 46, w=w - 36, h=h - 64, ox=x, oy=y, ow=w, oh=h)

    # ============================================================ BUILD
    def build(self):
        s, wc, g = self.s, self.wc, self.game
        r = self.window('Construction', 760, 520, 'gear')
        tx = r['x']
        for cid, name in CATEGORIES:
            if wc.tab(tx, r['y'], 128, 30, name, self.build_cat == cid):
                self.build_cat = cid
            tx += 134
        lst = buildables_for(self.build_cat, g.research.unlocked)
        gx, gy = r['x'], r['y'] + 42
        cw, ch, cols = 152, 126, 4
        rows = (len(lst) + cols - 1) // cols
        off = wc.scroll('build', gx, gy, r['w'], r['h'] - 52, rows * (ch + 10))
        with wc.clip(gx, gy, r['w'], r['h'] - 52):
            for i, b in enumerate(lst):
                x = gx + (i % cols) * (cw + 8)
                y = gy + (i // cols) * (ch + 10) - off
                if y > gy + r['h'] or y + ch < gy:
                    continue
                afford = g.money >= b['cost']
                sel = g.build['type'] == b['id']
                extra = ''
                if b['power']:
                    extra += '  -  %g kW' % b['power']
                if b['output']:
                    extra += '  -  +%g kW' % b['output']
                _h, clicked = wc.slot(x, y, cw, ch, selected=sel, tip=b['name'],
                                      tip_body='%s\n\nCost $%d%s' % (b['desc'], b['cost'], extra))
                spr = machine_sprite(b['id'], 0)['surf']
                sc = min((cw - 28) / spr.get_width(), (ch - 52) / spr.get_height(), 1.6)
                img = pygame.transform.smoothscale(
                    spr, (int(spr.get_width() * sc), int(spr.get_height() * sc)))
                s.blit(img, (int(x + cw / 2 - img.get_width() / 2),
                             int(y + 12 + (ch - 52) / 2 - img.get_height() / 2)))
                U.engraved(s, b['name'], x + cw / 2, y + ch - 30, U.FONT_BODY, P.UI_TEXT, 11, False, 'center')
                U.engraved(s, '$' + short_num(b['cost']), x + cw / 2, y + ch - 16,
                           U.FONT_BODY, P.UI_GOOD if afford else P.UI_BAD, 10, False, 'center')
                if clicked:
                    g.pick_build(b['id'])
        U.engraved(s, 'Left click to place  -  R rotate  -  Right click cancel  -  X demolish',
                   r['x'], r['oy'] + r['oh'] - 26, U.FONT_BODY, P.UI_DIM, 11)

    # ============================================================ INVENTORY
    def inventory(self):
        s, wc, g = self.s, self.wc, self.game
        p = g.player
        r = self.window('Inventory', 700, 500, 'box')
        ids = sorted(p.inv, key=lambda i: -ITEMS.get(i, {}).get('value', 0))
        cols, cell = 8, 64
        U.engraved(s, '%d / %d slots' % (p.inv_used_slots(), p.inv_capacity()),
                   r['x'] + r['w'], r['y'] + 2, U.FONT_BODY, P.UI_DIM, 11, False, 'right')
        gy = r['y'] + 24
        rows = max(4, (len(ids) + cols - 1) // cols)
        off = wc.scroll('inv', r['x'], gy, r['w'], 270, rows * (cell + 6))
        with wc.clip(r['x'], gy, r['w'], 270):
            for i in range(rows * cols):
                x = r['x'] + (i % cols) * (cell + 6)
                y = gy + (i // cols) * (cell + 6) - off
                if y > gy + 280 or y + cell < gy:
                    continue
                item_id = ids[i] if i < len(ids) else None
                it = ITEMS.get(item_id) if item_id else None
                sel = self.ui.selected_item == item_id
                _h, clicked = wc.slot(x, y, cell, cell, selected=bool(sel and it),
                                      tip=it['name'] if it else None,
                                      tip_body=('Value $%d each\nHeld %d' %
                                                (g.market.sell_price(item_id), p.inv[item_id])) if it else None,
                                      tip_icon=item_icon(item_id) if it else None)
                if it:
                    s.blit(pygame.transform.smoothscale(item_icon(item_id), (48, 48)), (x + 8, y + 5))
                    U.engraved(s, str(p.inv[item_id]), x + cell - 5, y + cell - 17,
                               U.FONT_MONO, P.UI_TEXT, 12, True, 'right')
                    if clicked:
                        self.ui.selected_item = None if sel else item_id
        dy = gy + 284
        D.rr(s, (r['x'], dy, r['w'], 96), rgba(P.BLACK, 0.25), 4)
        sel = self.ui.selected_item
        if sel and p.inv.get(sel):
            it = ITEMS[sel]
            s.blit(pygame.transform.smoothscale(item_icon(sel), (56, 56)), (r['x'] + 14, dy + 16))
            U.engraved(s, it['name'], r['x'] + 84, dy + 16, U.FONT_TITLE, P.UI_TRIM_HI, 16, True)
            U.engraved(s, 'Tier %d  -  %s  -  base $%d' % (it['tier'], it['cat'], it['value']),
                       r['x'] + 84, dy + 38, U.FONT_BODY, P.UI_DIM, 11)
            U.engraved(s, 'Market price $%.1f each  (you hold %d)' % (g.market.sell_price(sel), p.inv[sel]),
                       r['x'] + 84, dy + 56, U.FONT_BODY, P.UI_TEXT, 11)
            bx = r['x'] + r['w'] - 330
            if wc.button(bx, dy + 26, 100, 30, 'Sell 1'):
                g.sell_from_inventory(sel, 1)
            if wc.button(bx + 106, dy + 26, 100, 30, 'Sell 10'):
                g.sell_from_inventory(sel, 10)
            if wc.button(bx + 212, dy + 26, 110, 30, 'Sell all', primary=True):
                g.sell_from_inventory(sel, p.inv[sel])
            if wc.button(bx + 212, dy + 60, 110, 26, 'Drop stack', danger=True, size=11):
                p.inv.pop(sel, None)
                self.ui.selected_item = None
        else:
            U.engraved(s, 'Select an item to sell it at the current market price.',
                       r['x'] + 16, dy + 22, U.FONT_BODY, P.UI_DIM, 13)
            U.engraved(s, 'Tip: a Loading Dock sells automatically, and pays the same rate.',
                       r['x'] + 16, dy + 46, U.FONT_BODY, P.UI_DIM, 11)

    # ============================================================ MACHINE
    def machine(self):
        s, wc, g = self.s, self.wc, self.game
        e = g.selected
        if e is None or e not in g.factory.ents:
            self.ui.close()
            return
        r = self.window(e.def_['name'], 620, 470, 'gear')
        spr = machine_sprite(e.type, e.dir)['surf']
        D.rr(s, (r['x'], r['y'], 170, 150), rgba(P.BLACK, 0.3), 4)
        sc = min(150 / spr.get_width(), 130 / spr.get_height(), 2.2)
        img = pygame.transform.smoothscale(spr, (int(spr.get_width() * sc), int(spr.get_height() * sc)))
        s.blit(img, (int(r['x'] + 85 - img.get_width() / 2), int(r['y'] + 78 - img.get_height() / 2)))

        ix = r['x'] + 186
        y = r['y'] + 8
        state = ('BROKEN DOWN' if e.broken else 'SWITCHED OFF' if e.disabled
                 else 'RUNNING' if e.active else 'IDLE')
        U.engraved(s, state, ix, y, U.FONT_BODY,
                   P.UI_BAD if e.broken else (P.UI_GOOD if e.active else P.UI_WARN), 13, True)
        y += 22
        U.engraved(s, 'Condition', ix, y, U.FONT_BODY, P.UI_DIM, 11)
        U.bar(s, ix + 74, y - 2, 200, 11, e.condition,
              P.UI_GOOD if e.condition > 0.5 else (P.UI_WARN if e.condition > 0.25 else P.UI_BAD),
              '%d%%' % (e.condition * 100))
        y += 22
        if e.def_['power'] > 0:
            U.engraved(s, 'Power', ix, y, U.FONT_BODY, P.UI_DIM, 11)
            U.bar(s, ix + 74, y - 2, 200, 11, e.satisfaction,
                  P.UI_GOOD if e.satisfaction > 0.95 else P.UI_WARN, '%g kW' % e.def_['power'])
            y += 22
        if e.kind == 'gen':
            U.engraved(s, 'Output', ix, y, U.FONT_BODY, P.UI_DIM, 11)
            U.engraved(s, '%d kW' % (e.def_['output'] * (0.55 + 0.45 * e.condition)),
                       ix + 74, y, U.FONT_MONO, P.UI_TRIM_HI, 12, True)
            y += 20
            if e.def_['fuel']:
                U.engraved(s, 'Fuel', ix, y, U.FONT_BODY, P.UI_DIM, 11)
                U.bar(s, ix + 74, y - 2, 200, 11, clamp(e.fuel / e.def_['burn_time'], 0, 1),
                      P.GLOW_HOT, '%d %s' % (e.in_buf.get(e.def_['fuel'], 0),
                                             ITEMS[e.def_['fuel']]['name']))
                y += 22
        if e.type == 'furnace':
            U.engraved(s, 'Temperature', ix, y, U.FONT_BODY, P.UI_DIM, 11)
            U.bar(s, ix + 90, y - 2, 184, 11, clamp(e.temp / 900, 0, 1),
                  P.UI_BAD if e.temp > 820 else P.GLOW_HOT, '%d C' % e.temp)
            y += 22
        U.engraved(s, 'Produced %d cycles  -  %d worker(s) on station' % (e.total_made, e.workers),
                   ix, y, U.FONT_BODY, P.UI_DIM, 11)

        ry = r['y'] + 168
        if e.kind == 'machine' and e.type != 'waterpump':
            U.heading(s, 'Recipe', r['x'], ry, r['w'])
            ry += 22
            lst = recipes_for(e.type, g.research.unlocked)
            cell_w = (r['w'] - 12) / 3
            for i, rec in enumerate(lst):
                x = r['x'] + (i % 3) * (cell_w + 6)
                yy = ry + (i // 3) * 52
                sel = e.recipe == rec['id']
                _h, clicked = wc.slot(x, yy, cell_w, 46, selected=sel, tip=rec['name'],
                                      tip_body=self.recipe_text(rec))
                out_id = next(iter(rec['out']), None)
                if out_id:
                    s.blit(item_chip(out_id, 30), (int(x + 7), int(yy + 8)))
                U.engraved(s, rec['name'], x + 44, yy + 12, U.FONT_BODY, P.UI_TEXT, 11)
                U.engraved(s, '%.1fs' % rec['time'], x + 44, yy + 28, U.FONT_BODY, P.UI_DIM, 10)
                if clicked:
                    e.recipe = rec['id']
                    e.progress = 0.0
                    g.notify('%s: %s' % (e.def_['name'], rec['name']), 'info')
            ry += ((len(lst) + 2) // 3) * 52 + 10

        U.heading(s, 'Buffers', r['x'], ry, r['w'])
        ry += 24

        def draw_buf(title, buf, bx):
            U.engraved(s, title, bx, ry + 4, U.FONT_BODY, P.UI_DIM, 11)
            ids = [k for k, v in buf.items() if v > 0][:6]
            if not ids:
                U.engraved(s, 'empty', bx + 62, ry + 4, U.FONT_BODY, rgba(P.UI_DIM, 0.6), 11)
            for i, item_id in enumerate(ids):
                x = bx + 62 + i * 40
                wc.slot(x, ry - 6, 36, 36, tip=ITEMS[item_id]['name'], tip_icon=item_icon(item_id))
                s.blit(item_chip(item_id, 26), (int(x + 5), int(ry - 1)))
                U.engraved(s, str(buf[item_id]), x + 33, ry + 20, U.FONT_BODY, P.UI_TEXT, 10, True, 'right')

        draw_buf('Input', e.in_buf, r['x'])
        ry += 44
        draw_buf('Output', e.out_buf, r['x'])

        by = r['oy'] + r['oh'] - 52
        repair_cost = int(e.def_['cost'] * 0.22 * (1 - e.condition))
        if wc.button(r['x'], by, 130, 34, 'Repair' if e.broken else 'Service',
                     disabled=e.condition > 0.995, primary=e.broken,
                     tip='Costs $%d' % repair_cost):
            g.repair_machine(e)
        if wc.button(r['x'] + 138, by, 120, 34, 'Switch on' if e.disabled else 'Switch off'):
            e.disabled = not e.disabled
        if wc.button(r['x'] + 266, by, 120, 34, 'Take output', disabled=e.total_out() == 0):
            g.take_output(e)
        if wc.button(r['x'] + r['w'] - 130, by, 130, 34, 'Demolish', danger=True,
                     tip='Refunds $%d' % int(e.def_['cost'] * 0.6)):
            g.demolish(e)
            self.ui.close()

    def recipe_text(self, rec):
        ins = ', '.join('%dx %s' % (n, ITEMS[k]['name']) for k, n in rec['inp'].items()) or 'nothing'
        outs = ', '.join('%dx %s' % (n, ITEMS[k]['name']) for k, n in rec['out'].items())
        return '%s\n  ->  %s\n%gs per cycle' % (ins, outs, rec['time'])

    # ============================================================ MANAGEMENT
    def management(self):
        wc = self.wc
        r = self.window('Factory Management', 880, 580, 'chart')
        tabs = (('overview', 'Overview'), ('market', 'Market'), ('contracts', 'Contracts'),
                ('staff', 'Employees'), ('stats', 'Statistics'))
        tx = r['x']
        for tid, name in tabs:
            if wc.tab(tx, r['y'], 140, 30, name, self.mgmt_tab == tid):
                self.mgmt_tab = tid
            tx += 146
        body = dict(r, y=r['y'] + 44, h=r['h'] - 54)
        getattr(self, 'mg_' + self.mgmt_tab)(body)

    def mg_overview(self, r):
        s, wc, g = self.s, self.wc, self.game
        f = g.factory

        def card(x, y, w, h, title):
            D.rr(s, (x, y, w, h), rgba(P.BLACK, 0.28), 5)
            D.rr(s, (x, y, w, h), rgba(P.WHITE, 0.06), 5, 1)
            U.engraved(s, title, x + 12, y + 8, U.FONT_BODY, P.UI_TRIM_HI, 13, True)

        cw = (r['w'] - 14) / 2
        card(r['x'], r['y'], cw, 150, 'Power Grid')
        gen, use = f.stats['power_gen'], f.stats['power_use']
        U.engraved(s, '%.1f kW generated' % gen, r['x'] + 14, r['y'] + 34, U.FONT_BODY, P.UI_GOOD, 13)
        U.engraved(s, '%.1f kW demanded' % use, r['x'] + 14, r['y'] + 54, U.FONT_BODY,
                   P.UI_BAD if use > gen else P.UI_TEXT, 13)
        frac = 1.0 if use <= 0 else clamp(gen / use, 0, 1)
        U.bar(s, r['x'] + 14, r['y'] + 76, cw - 28, 14, frac,
              P.UI_GOOD if gen >= use else P.UI_BAD,
              'idle' if use <= 0 else '%d%% satisfied' % (frac * 100))
        unconnected = sum(1 for e in f.ents if e.net < 0 and e.def_['power'] > 0)
        U.engraved(s, '%d network(s)  -  %d unconnected machine(s)' % (len(f.networks), unconnected),
                   r['x'] + 14, r['y'] + 100, U.FONT_BODY, P.UI_DIM, 11)
        U.engraved(s, 'Machines must touch a cable that reaches a generator.',
                   r['x'] + 14, r['y'] + 120, U.FONT_BODY, P.UI_DIM, 10)

        card(r['x'] + cw + 14, r['y'], cw, 150, 'Finances')
        fx = r['x'] + cw + 28
        U.engraved(s, 'Balance  %s' % money(g.money), fx, r['y'] + 30, U.FONT_TITLE, P.UI_TRIM_HI, 16, True)
        U.engraved(s, "Today's revenue  %s" % money(g.market.day_revenue), fx, r['y'] + 58,
                   U.FONT_BODY, P.UI_GOOD, 12)
        U.engraved(s, "Today's costs  %s" % money(g.market.day_costs + g.day_upkeep), fx, r['y'] + 78,
                   U.FONT_BODY, P.UI_BAD, 12)
        U.engraved(s, 'Payroll  %s/day  -  %d staff' % (money(g.employees.payroll()), len(g.employees.list)),
                   fx, r['y'] + 100, U.FONT_BODY, P.UI_DIM, 11)
        U.engraved(s, 'Upkeep + power  %s/min' % money(f.operating_cost(g) * 60),
                   fx, r['y'] + 118, U.FONT_BODY, P.UI_DIM, 11)
        plot = g.world.plot
        if wc.button(r['x'] + cw + 14 + cw - 168, r['y'] + 100, 154, 34, 'Buy more land',
                     primary=True, disabled=g.money < g.expansion_cost(),
                     tip='Expand the plot by 8 tiles on every side',
                     tip_body='Costs %s\nCurrent plot: %d x %d tiles' %
                              (money(g.expansion_cost()), plot['w'], plot['h'])):
            g.expand_land()

        card(r['x'], r['y'] + 162, r['w'], r['h'] - 172, 'Installed Machinery')
        groups = {}
        for e in f.ents:
            if e.kind == 'cable':
                continue
            groups.setdefault(e.type, []).append(e)
        keys = sorted(groups, key=lambda k: -len(groups[k]))
        row_h = 40
        off = wc.scroll('mgm', r['x'] + 8, r['y'] + 190, r['w'] - 16, r['h'] - 204, len(keys) * row_h)
        with wc.clip(r['x'] + 8, r['y'] + 190, r['w'] - 16, r['h'] - 204):
            for i, k in enumerate(keys):
                y = r['y'] + 192 + i * row_h - off
                if y > r['y'] + r['h'] or y + row_h < r['y'] + 190:
                    continue
                lst = groups[k]
                d = BUILDABLES[k]
                broken = sum(1 for e in lst if e.broken)
                avg = sum(e.condition for e in lst) / len(lst)
                running = sum(1 for e in lst if e.active)
                if i % 2:
                    D.rect(s, rgba(P.WHITE, 0.02), (r['x'] + 8, y, r['w'] - 16, row_h - 2))
                spr = machine_sprite(k, 0)['surf']
                sc = min(32 / spr.get_width(), 30 / spr.get_height())
                s.blit(pygame.transform.smoothscale(
                    spr, (int(spr.get_width() * sc), int(spr.get_height() * sc))), (r['x'] + 16, y + 4))
                U.engraved(s, '%dx %s' % (len(lst), d['name']), r['x'] + 58, y + 11, U.FONT_BODY, P.UI_TEXT, 13)
                U.engraved(s, '%d running' % running, r['x'] + 300, y + 11, U.FONT_BODY,
                           P.UI_GOOD if running else P.UI_DIM, 11)
                U.bar(s, r['x'] + 400, y + 13, 140, 10, avg,
                      P.UI_GOOD if avg > 0.5 else P.UI_WARN, '%d%%' % (avg * 100))
                if broken:
                    U.engraved(s, '%d BROKEN' % broken, r['x'] + 556, y + 11, U.FONT_BODY, P.UI_BAD, 11)
                if wc.button(r['x'] + r['w'] - 116, y + 6, 100, 26, 'Repair all',
                             disabled=avg > 0.995, size=11):
                    for e in lst:
                        g.repair_machine(e)

    def mg_market(self, r):
        s, wc, g = self.s, self.wc, self.game
        ids = [i for i in ITEMS if ITEMS[i]['cat'] != 'fluid']
        row_h = 44
        U.engraved(s, 'Prices drift with supply and demand. Flooding the market lowers your take.',
                   r['x'], r['y'] - 16, U.FONT_BODY, P.UI_DIM, 11)
        off = wc.scroll('mkt', r['x'], r['y'] + 6, r['w'], r['h'] - 10, len(ids) * row_h)
        with wc.clip(r['x'], r['y'] + 6, r['w'], r['h'] - 10):
            for i, item_id in enumerate(ids):
                y = r['y'] + 10 + i * row_h - off
                if y > r['y'] + r['h'] or y + row_h < r['y']:
                    continue
                it = ITEMS[item_id]
                if i % 2:
                    D.rect(s, rgba(P.WHITE, 0.025), (r['x'], y, r['w'], row_h - 3))
                s.blit(item_chip(item_id, 32), (int(r['x'] + 6), int(y + 4)))
                U.engraved(s, it['name'], r['x'] + 46, y + 8, U.FONT_BODY, P.UI_TEXT, 13)
                U.engraved(s, 'tier %d' % it['tier'], r['x'] + 46, y + 24, U.FONT_BODY, P.UI_DIM, 10)
                price = g.market.sell_price(item_id)
                U.engraved(s, '$%.1f' % price, r['x'] + 250, y + 14, U.FONT_MONO, P.UI_TEXT, 12, True, 'right')
                hist = g.market.history[item_id]
                if len(hist) > 2:
                    lo, hi = min(hist), max(hist)
                    span = max(0.05, hi - lo)
                    pts = [(r['x'] + 266 + (kk / (len(hist) - 1)) * 110,
                            y + 30 - ((v - lo) / span) * 20) for kk, v in enumerate(hist)]
                    col = P.UI_GOOD if g.market.trend[item_id] >= 0 else P.UI_BAD
                    for a, b in zip(pts, pts[1:]):
                        D.line(s, col, a, b, 2)
                have = g.player.inv_count(item_id) + g.total_stored(item_id)
                U.engraved(s, 'held %s' % short_num(have), r['x'] + 400, y + 14, U.FONT_BODY, P.UI_DIM, 11)
                if wc.button(r['x'] + 470, y + 6, 74, 28, 'Buy 10', size=11,
                             disabled=g.money < g.market.buy_price(item_id) * 10,
                             tip='$%d' % (g.market.buy_price(item_id) * 10)):
                    g.buy_to_inventory(item_id, 10)
                if wc.button(r['x'] + 550, y + 6, 74, 28, 'Buy 100', size=11,
                             disabled=g.money < g.market.buy_price(item_id) * 100):
                    g.buy_to_inventory(item_id, 100)
                if wc.button(r['x'] + 630, y + 6, 84, 28, 'Sell all', size=11,
                             disabled=g.player.inv_count(item_id) == 0):
                    g.sell_from_inventory(item_id, g.player.inv_count(item_id))

    def mg_contracts(self, r):
        s, wc, g = self.s, self.wc, self.game
        ct = g.contracts
        half = r['w'] / 2 - 10
        U.heading(s, 'Offers', r['x'], r['y'], half)
        for i, o in enumerate(ct.offers):
            y = r['y'] + 24 + i * 98
            D.rr(s, (r['x'], y, half, 88), rgba(P.BLACK, 0.28), 5)
            D.rr(s, (r['x'], y, half, 88), rgba(P.WHITE, 0.06), 5, 1)
            U.engraved(s, o['client'], r['x'] + 12, y + 10, U.FONT_BODY, P.UI_TRIM_HI, 13, True)
            s.blit(item_chip(o['item'], 30), (int(r['x'] + 12), int(y + 30)))
            U.engraved(s, '%dx %s' % (o['qty'], ITEMS[o['item']]['name']), r['x'] + 50, y + 36,
                       U.FONT_BODY, P.UI_TEXT, 13)
            U.engraved(s, 'Pays %s  -  %d min limit  -  +%d XP' %
                       (money(o['pay']), o['time'] // 60, o['xp']),
                       r['x'] + 50, y + 56, U.FONT_BODY, P.UI_DIM, 11)
            if wc.button(r['x'] + half - 96, y + 50, 86, 28, 'Accept', primary=True, size=11):
                ct.accept(o)
                break
        if not ct.offers:
            U.engraved(s, 'No offers right now - check back shortly.', r['x'] + 6, r['y'] + 38,
                       U.FONT_BODY, P.UI_DIM, 11)

        rx = r['x'] + half + 20
        U.heading(s, 'Active', rx, r['y'], half)
        for i, o in enumerate(ct.active):
            y = r['y'] + 24 + i * 98
            D.rr(s, (rx, y, half, 88), rgba(P.BLACK, 0.28), 5)
            D.rr(s, (rx, y, half, 88), rgba(P.UI_TRIM, 0.25), 5, 1)
            U.engraved(s, o['client'], rx + 12, y + 10, U.FONT_BODY, P.UI_TRIM_HI, 13, True)
            s.blit(item_chip(o['item'], 30), (int(rx + 12), int(y + 30)))
            U.engraved(s, '%d / %d  %s' % (o['delivered'], o['qty'], ITEMS[o['item']]['name']),
                       rx + 50, y + 34, U.FONT_BODY, P.UI_TEXT, 13)
            U.bar(s, rx + 50, y + 52, half - 150, 10, o['delivered'] / o['qty'], P.UI_GOOD)
            urgent = o['deadline'] < 60
            U.engraved(s, '%s left  -  %s' % (time_str(o['deadline']), money(o['pay'])),
                       rx + 50, y + 66, U.FONT_BODY, P.UI_BAD if urgent else P.UI_DIM, 11)
            if wc.button(rx + half - 96, y + 50, 86, 28, 'Deliver', size=11,
                         disabled=g.player.inv_count(o['item']) == 0,
                         tip='Hand over from your inventory'):
                n = min(g.player.inv_count(o['item']), o['qty'] - o['delivered'])
                g.player.take(o['item'], n)
                ct.deliver(o, n)
                break
        if not ct.active:
            U.engraved(s, 'Accept an offer to start a contract.', rx + 6, r['y'] + 38,
                       U.FONT_BODY, P.UI_DIM, 11)
        U.engraved(s, 'Anything sitting in a Loading Dock is delivered against active contracts automatically.',
                   r['x'], r['oy'] + r['oh'] - 30, U.FONT_BODY, P.UI_DIM, 11)

    def mg_staff(self, r):
        s, wc, g = self.s, self.wc, self.game
        emp = g.employees
        half = r['w'] / 2 - 10
        U.heading(s, 'Roster (%d)' % len(emp.list), r['x'], r['y'], half)
        row_h = 70
        off = wc.scroll('staff', r['x'], r['y'] + 20, half, r['h'] - 30, len(emp.list) * row_h)
        with wc.clip(r['x'], r['y'] + 20, half, r['h'] - 30):
            for i, e in enumerate(emp.list):
                y = r['y'] + 24 + i * row_h - off
                D.rr(s, (r['x'], y, half, row_h - 6), rgba(P.BLACK, 0.25), 4)
                s.blit(portrait(e.role, e.seed, 52), (int(r['x'] + 6), int(y + 6)))
                U.engraved(s, e.name, r['x'] + 66, y + 10, U.FONT_BODY, P.UI_TEXT, 13, True)
                U.engraved(s, '%s  -  skill %d  -  $%d/day' % (ROLE_INFO[e.role]['name'], e.skill, e.wage),
                           r['x'] + 66, y + 28, U.FONT_BODY, P.UI_DIM, 11)
                state = 'working' if e.state == 'work' else ('on break' if e.state == 'rest' else 'moving')
                U.engraved(s, state, r['x'] + 66, y + 46, U.FONT_BODY,
                           P.UI_GOOD if e.state == 'work' else P.UI_WARN, 10)
                U.bar(s, r['x'] + 150, y + 46, 100, 8, e.stamina, P.GLOW_COLD)
                U.bar(s, r['x'] + 150, y + 57, 100, 8, e.morale, P.UI_TRIM_HI)
                if wc.button(r['x'] + half - 78, y + 18, 68, 26, 'Dismiss', danger=True, size=11):
                    emp.fire(e)
                    break
        if not emp.list:
            U.engraved(s, 'Nobody on the books yet.', r['x'] + 6, r['y'] + 38, U.FONT_BODY, P.UI_DIM, 11)

        rx = r['x'] + half + 20
        U.heading(s, 'Applicants', rx, r['y'], half)
        for i, a in enumerate(emp.applicants):
            y = r['y'] + 24 + i * 78
            D.rr(s, (rx, y, half, 72), rgba(P.BLACK, 0.25), 4)
            s.blit(portrait(a['role'], a['seed'], 52), (int(rx + 6), int(y + 8)))
            U.engraved(s, a['name'], rx + 66, y + 10, U.FONT_BODY, P.UI_TEXT, 13, True)
            U.engraved(s, '%s  -  skill %d' % (a['info']['name'], a['skill']), rx + 66, y + 28,
                       U.FONT_BODY, P.UI_TRIM_HI, 11)
            U.engraved(s, '$%d/day wage  -  $%d signing fee' % (a['wage'], a['cost']),
                       rx + 66, y + 46, U.FONT_BODY, P.UI_DIM, 10)
            if wc.button(rx + half - 84, y + 20, 74, 30, 'Hire', primary=True,
                         disabled=g.money < a['cost'], tip=a['info']['desc']):
                emp.hire(a)
                break

    def mg_stats(self, r):
        s, g = self.s, self.game
        f = g.factory
        st = g.stats
        rows = [
            ('Days in business', g.time['day']),
            ('Total revenue', money(st['revenue'])),
            ('Total spent', money(st['spent'])),
            ('Items produced', short_num(f.stats['produced'])),
            ('Items shipped', short_num(f.stats['sold'])),
            ('Machines placed', short_num(st['built'])),
            ('Contracts completed', g.contracts.completed),
            ('Technologies unlocked', '%d / %d' % (len(g.research.unlocked), len(TECHS))),
            ('Research points earned', short_num(g.research.total_points)),
            ('Employees hired', len(g.employees.list)),
            ('Ore mined by hand', short_num(st['hand_mined'])),
            ('Machines repaired', short_num(st['repairs'])),
            ('Distance walked', '%s m' % short_num(st['walked'])),
            ('Factory footprint', '%d entities' % len(f.ents)),
        ]
        for i, (k, v) in enumerate(rows):
            y = r['y'] + 16 + i * 30
            if i % 2:
                D.rect(s, rgba(P.WHITE, 0.025), (r['x'], y - 4, r['w'], 26))
            U.engraved(s, k, r['x'] + 12, y, U.FONT_BODY, P.UI_DIM, 13)
            U.engraved(s, str(v), r['x'] + r['w'] - 12, y, U.FONT_MONO, P.UI_TRIM_HI, 12, True, 'right')

    # ============================================================ RESEARCH
    def research(self):
        s, wc, g = self.s, self.wc, self.game
        R = g.research
        r = self.window('Technology', 1010, 560, 'flask')
        D.rr(s, (r['x'], r['y'], r['w'], 54), rgba(P.BLACK, 0.3), 5)
        if R.current:
            t = TECHS[R.current]
            U.engraved(s, 'Researching: %s' % t['name'], r['x'] + 14, r['y'] + 10,
                       U.FONT_BODY, P.UI_TRIM_HI, 13, True)
            U.bar(s, r['x'] + 14, r['y'] + 32, r['w'] - 28, 12, R.progress(), P.GLOW_COLD,
                  '%d / %d points' % (R.points, t['cost']))
        else:
            U.engraved(s, 'No active research - pick a technology below.', r['x'] + 14, r['y'] + 10,
                       U.FONT_BODY, P.UI_DIM, 13, True)
            U.engraved(s, '%d points banked  -  labs generate points continuously' % R.points,
                       r['x'] + 14, r['y'] + 32, U.FONT_BODY, P.UI_DIM, 11)

        gx, gy = r['x'], r['y'] + 66
        gw, gh = r['w'], r['h'] - 76
        col_w, row_h = 130, 88

        def pos(t):
            return (gx + 6 + t['col'] * col_w, gy + 10 + t['row'] * row_h * 0.62)

        with wc.clip(gx, gy, gw, gh):
            for t in TECHS.values():
                p2 = pos(t)
                for req in t['req']:
                    p1 = pos(TECHS[req])
                    done = req in R.unlocked
                    col = rgba(P.UI_TRIM, 0.75) if done else rgba(P.WHITE, 0.12)
                    mid = ((p1[0] + 112 + p2[0]) / 2, (p1[1] + p2[1]) / 2 + 26)
                    D.line(s, col, (p1[0] + 112, p1[1] + 26), mid, 2)
                    D.line(s, col, mid, (p2[0], p2[1] + 26), 2)
            for t in TECHS.values():
                p = pos(t)
                done = t['id'] in R.unlocked
                can = R.can_start(t['id'])
                cur = R.current == t['id']
                _h, clicked = wc.slot(p[0], p[1], 112, 52, selected=cur, tip=t['name'],
                                      tip_body='%s\n\n%d research points' % (t['desc'], t['cost']))
                if done:
                    D.rr(s, (p[0] + 1, p[1] + 1, 110, 50), rgba(P.UI_GOOD, 0.16), 3)
                elif not can:
                    D.rr(s, (p[0] + 1, p[1] + 1, 110, 50), rgba(P.BLACK, 0.35), 3)
                s.blit(U.glyph('flask', 16, P.UI_GOOD if done else (P.UI_TRIM_HI if can else P.UI_DIM)),
                       (int(p[0] + 8), int(p[1] + 8)))
                U.engraved(s, t['name'], p[0] + 30, p[1] + 10, U.FONT_BODY,
                           P.UI_GOOD if done else (P.UI_TEXT if can else P.UI_DIM), 11)
                U.engraved(s, 'unlocked' if done else '%d pts' % t['cost'], p[0] + 30, p[1] + 28,
                           U.FONT_BODY, P.UI_DIM, 10)
                if clicked and can:
                    R.start(t['id'])

    # ============================================================ MAP
    def map(self):
        s, g = self.s, self.game
        r = self.window('Regional Map', 760, 700, 'map')
        size = min(r['w'], r['h'] - 20)
        mx = r['x'] + (r['w'] - size) / 2
        my = r['y'] + 10
        if self.ui.hud.minimap is None:
            self.ui.hud.build_minimap()
        s.blit(pygame.transform.scale(self.ui.hud.minimap, (int(size), int(size))), (int(mx), int(my)))
        w = g.world
        sc = size / w.W
        for reg in w.regions:
            D.rect(s, rgba(P.UI_TRIM_HI, 0.35),
                   (mx + reg['x'] * sc, my + reg['y'] * sc, reg['w'] * sc, reg['h'] * sc), 1)
            U.engraved(s, reg['name'], mx + (reg['x'] + reg['w'] / 2) * sc,
                       my + (reg['y'] + reg['h'] / 2) * sc, U.FONT_BODY, P.UI_TEXT, 11, True, 'center')
        for e in g.factory.ents:
            if e.kind == 'cable':
                continue
            D.rect(s, P.UI_TRIM_HI, (mx + e.x * sc, my + e.y * sc,
                                     max(2, e.w * sc), max(2, e.h * sc)))
        px, py = mx + g.player.x * sc, my + g.player.y * sc
        D.glow(s, px, py, 12, P.GLOW_COLD, 0.8, add=True)
        D.circle(s, P.WHITE, px, py, 3.4)
        D.rect(s, rgba(P.BLACK, 0.8), (mx, my, size, size), 2)
        U.engraved(s, 'Your plot is outlined in brass. Ore deposits show as gold speckles.',
                   r['x'], r['oy'] + r['oh'] - 30, U.FONT_BODY, P.UI_DIM, 11)

    # ============================================================ MISSIONS
    def missions(self):
        s, wc, g = self.s, self.wc, self.game
        ms = g.missions
        r = self.window('Missions', 780, 560, 'mission')
        lst = ms.active + [m for m in MISSIONS if m['id'] in ms.done]
        row_h = 86
        off = wc.scroll('miss', r['x'], r['y'], r['w'], r['h'], len(lst) * row_h)
        with wc.clip(r['x'], r['y'], r['w'], r['h']):
            for i, m in enumerate(lst):
                y = r['y'] + 6 + i * row_h - off
                if y > r['y'] + r['h'] or y + row_h < r['y']:
                    continue
                done = m['id'] in ms.done
                tracked = ms.tracked == m['id']
                bg = ((90, 140, 90, 26) if done else
                      ((200, 160, 70, 26) if tracked else rgba(P.BLACK, 0.25)))
                D.rr(s, (r['x'], y, r['w'], row_h - 8), bg, 5)
                D.rr(s, (r['x'], y, r['w'], row_h - 8),
                     rgba(P.UI_TRIM, 0.6) if tracked else rgba(P.WHITE, 0.05), 5, 1)
                U.engraved(s, m['name'], r['x'] + 14, y + 10, U.FONT_BODY,
                           P.UI_GOOD if done else P.UI_TRIM_HI, 13, True)
                U.wrap_text(s, m['text'], r['x'] + 14, y + 30, r['w'] - 230, 14, 11, P.UI_DIM)
                for gi, goal in enumerate(m['goals']):
                    gdone = ms.goal_done(m, gi)
                    U.engraved(s, ('* ' if gdone else '- ') +
                               ms.goal_text(goal, ms.goal_progress(m, gi), ms.goal_target(goal)),
                               r['x'] + r['w'] - 210, y + 10 + gi * 15, U.FONT_BODY,
                               P.UI_GOOD if gdone else P.UI_TEXT, 11)
                rw = m.get('reward') or {}
                U.engraved(s, 'Reward: %s %s' % (money(rw['money']) if rw.get('money') else '',
                                                 '+%d XP' % rw['xp'] if rw.get('xp') else ''),
                           r['x'] + 14, y + row_h - 26, U.FONT_BODY, P.UI_TRIM_HI, 10)
                if not done and wc.button(r['x'] + r['w'] - 96, y + row_h - 34, 84, 24,
                                          'Tracking' if tracked else 'Track',
                                          size=11, primary=tracked):
                    ms.tracked = m['id']

    # ============================================================ SKILLS
    def skills(self):
        s, wc, g = self.s, self.wc, self.game
        p = g.player
        r = self.window('Skills & Progression', 720, 540, 'xp')
        U.engraved(s, 'Level %d' % p.level, r['x'], r['y'], U.FONT_TITLE, P.UI_TRIM_HI, 22, True)
        U.bar(s, r['x'] + 110, r['y'] + 6, r['w'] - 260, 16, p.xp / p.xp_next, P.UI_TRIM_HI,
              '%d / %d XP' % (p.xp, p.xp_next))
        U.engraved(s, '%d point(s) to spend' % p.skill_points, r['x'] + r['w'], r['y'] + 6,
                   U.FONT_BODY, P.UI_GOOD if p.skill_points else P.UI_DIM, 13, True, 'right')

        info = [
            ('engineering', 'Engineering', 'Machines draw less power and repairs go faster.',
             lambda l: ['%d%% less power draw' % (l * 2), '%d%% faster repairs' % (l * 8)]),
            ('production', 'Production', 'The whole floor runs faster and wastes less material.',
             lambda l: ['%.1f%% machine speed' % (l * 3.5), '%.1f%% less waste' % (l * 0.6)]),
            ('logistics', 'Logistics', 'Belts move quicker and you carry more.',
             lambda l: ['%d%% belt speed' % (l * 4), '%d extra slots' % (l * 2)]),
            ('management', 'Management', 'Better prices from buyers, cheaper and happier staff.',
             lambda l: ['%.1f%% sale price' % (l * 1.8), 'Staff work harder']),
            ('technology', 'Technology', 'Research accumulates faster.',
             lambda l: ['%d%% research rate' % (l * 6)]),
        ]
        y = r['y'] + 50
        for sid, name, desc, effects in info:
            sk = p.skills[sid]
            D.rr(s, (r['x'], y, r['w'], 84), rgba(P.BLACK, 0.26), 5)
            D.rr(s, (r['x'], y, r['w'], 84), rgba(P.WHITE, 0.05), 5, 1)
            cx, cy = r['x'] + 40, y + 42
            D.circle(s, rgba(P.BLACK, 0.6), cx, cy, 22, 6)
            frac = clamp(sk['xp'] / sk['next'], 0, 1)
            D.arc(s, P.UI_TRIM_HI, cx, cy, 22, math.pi / 2 - TAU * frac, math.pi / 2, 5)
            U.engraved(s, str(sk['level']), cx, cy - 11, U.FONT_TITLE, P.UI_TEXT, 20, True, 'center')
            U.engraved(s, name, r['x'] + 76, y + 12, U.FONT_TITLE, P.UI_TRIM_HI, 16, True)
            U.wrap_text(s, desc, r['x'] + 76, y + 40, r['w'] - 420, 14, 11, P.UI_DIM)
            for i, eff in enumerate(effects(sk['level'])):
                U.engraved(s, '+ ' + eff, r['x'] + r['w'] - 300, y + 22 + i * 18,
                           U.FONT_BODY, P.UI_GOOD, 11)
            if wc.button(r['x'] + r['w'] - 96, y + 26, 84, 32, 'Train',
                         primary=p.skill_points > 0, disabled=p.skill_points <= 0,
                         tip='Spend a skill point'):
                p.spend_skill_point(sid)
            y += 92

    # ============================================================ DIALOGUE
    def dialogue(self):
        s, wc = self.s, self.wc
        d = self.ui.dialog
        if not d:
            return
        w, h = 620, 172
        x = self.ui.w / 2 - w / 2
        y = self.ui.h - h - 40
        U.draw_panel(s, x, y, w, h)
        s.blit(portrait(d['role'], d['seed'], 72), (int(x + 16), int(y + 20)))
        U.engraved(s, d['name'], x + 100, y + 20, U.FONT_TITLE, P.UI_TRIM_HI, 16, True)
        if d.get('title'):
            U.engraved(s, d['title'], x + 100, y + 42, U.FONT_BODY, P.UI_DIM, 11)
        U.wrap_text(s, d['text'], x + 100, y + 64, w - 130, 18, 13, P.UI_TEXT)
        if wc.button(x + w - 120, y + h - 44, 100, 30, 'Goodbye'):
            self.ui.dialog = None

    # ============================================================ OPTIONS
    def settings(self):
        s, wc, g = self.s, self.wc, self.game
        r = self.window('Options & Controls', 700, 560, 'gear')
        U.heading(s, 'Controls', r['x'], r['y'] + 6, r['w'] / 2 - 20)
        keys = [('WASD / Arrows', 'Move'), ('Shift', 'Sprint'), ('Mouse', 'Use tool / place'),
                ('E', 'Interact, repair, talk'), ('B', 'Build menu'), ('R', 'Rotate while building'),
                ('X', 'Demolish mode'), ('1-8', 'Hotbar'), ('I', 'Inventory'),
                ('Tab', 'Factory management'), ('T', 'Technology'), ('J', 'Missions'),
                ('K', 'Skills'), ('M', 'Map'), ('F5 / F9', 'Save / load'), ('Esc', 'Close window')]
        for i, (k, v) in enumerate(keys):
            y = r['y'] + 32 + i * 24
            U.engraved(s, k, r['x'] + 8, y, U.FONT_MONO, P.UI_TRIM_HI, 11, True)
            U.engraved(s, v, r['x'] + 130, y, U.FONT_BODY, P.UI_TEXT, 11)

        rx = r['x'] + r['w'] / 2 + 10
        U.heading(s, 'Audio', rx, r['y'] + 6, r['w'] / 2 - 20)
        for i, (vid, name) in enumerate((('master', 'Master'), ('music', 'Music'),
                                         ('sfx', 'Effects'), ('amb', 'Ambience'))):
            y = r['y'] + 34 + i * 40
            U.engraved(s, name, rx, y + 2, U.FONT_BODY, P.UI_TEXT, 11)
            bx, bw = rx + 80, 180
            U.bar(s, bx, y, bw, 14, g.audio.volume[vid], P.UI_TRIM_HI)
            if wc.hover(bx, y - 4, bw, 22) and g.input.down:
                g.audio.set_volume(vid, clamp((g.input.mx - bx) / bw, 0, 1))
                self.ui.hovering_ui = True

        y = r['y'] + 210
        U.heading(s, 'Game', rx, y, r['w'] / 2 - 20)
        y += 24
        if wc.button(rx, y, 180, 34, 'Save game', primary=True):
            g.save()
        if wc.button(rx, y + 42, 180, 34, 'Load last save'):
            g.load()
        if wc.button(rx, y + 84, 180, 34, 'Quit to desktop', danger=True):
            g.running = False

        y = r['y'] + 400
        U.heading(s, 'How the factory works', r['x'], y, r['w'])
        U.wrap_text(s,
                    'Generators make power. Cables carry it: every machine must touch a cable that '
                    'leads back to a generator. Mining drills sit on ore patches and fill their '
                    'output buffer. Conveyor belts pull from a machine behind them and push into '
                    'whatever is in front - chain them to feed furnaces, presses and assemblers. '
                    'Finished goods dropped on a Loading Dock are sold automatically, and count '
                    'toward contracts.',
                    r['x'], y + 24, r['w'], 17, 12, P.UI_TEXT)

    # ============================================================ TOAST
    def mission_complete(self):
        m = self.ui.mission_toast
        if not m:
            return
        s = self.s
        a = clamp(m['t'] / 0.4 if m['t'] < 0.4 else (m['life'] / 0.6 if m['life'] < 0.6 else 1), 0, 1)
        w, h = 420, 96
        x = self.ui.w / 2 - w / 2
        y = 96 - (1 - a) * 20
        layer = pygame.Surface((w + 8, h + 8), pygame.SRCALPHA)
        U.draw_panel(layer, 0, 0, w, h)
        layer.blit(U.glyph('mission', 26, P.UI_GOOD), (20, 32))
        U.engraved(layer, 'MISSION COMPLETE', 62, 24, U.FONT_BODY, P.UI_GOOD, 13, True)
        U.engraved(layer, m['mission']['name'], 62, 44, U.FONT_TITLE, P.UI_TRIM_HI, 16, True)
        rw = m['mission'].get('reward') or {}
        U.engraved(layer, '%s%s' % (money(rw['money']) + '  ' if rw.get('money') else '',
                                    '+%d XP' % rw['xp'] if rw.get('xp') else ''),
                   62, 66, U.FONT_BODY, P.UI_TEXT, 11)
        layer.set_alpha(int(255 * a))
        s.blit(layer, (int(x), int(y)))
