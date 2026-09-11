"""UI manager: owns the HUD, the windows, notifications and tooltips, and routes
keyboard shortcuts.
"""
import pygame

from ..art import draw as D
from ..art import palette as P
from ..art import ui as U
from ..art.characters import portrait
from ..art.icons import item_icon
from ..core.utils import clamp
from ..data.items import ITEMS
from .hud import HUD
from .panels import Panels
from .widgets import Widgets
from ..art.palette import rgba

PANEL_KEYS = {
    pygame.K_i: 'inventory', pygame.K_TAB: 'management', pygame.K_b: 'build',
    pygame.K_t: 'research', pygame.K_j: 'missions', pygame.K_k: 'skills',
    pygame.K_m: 'map', pygame.K_F1: 'settings',
}


class UI:
    def __init__(self, game):
        self.game = game
        self.screen = None
        self.panel = None
        self.notifications = []
        self.pickups = []
        self.tooltip = None
        self.dialog = None
        self.mission_toast = None
        self.selected_item = None
        self.scrolls = {}
        self.hovering_ui = False
        self.w = self.h = 0
        self.wc = Widgets(self)
        self.hud = HUD(self)
        self.panels = Panels(self)
        self.player_portrait = portrait('player', 3, 58)

    # ------------------------------------------------------------- messages
    def notify(self, text, kind='info'):
        self.notifications.insert(0, dict(text=text, kind=kind, life=4.0))
        del self.notifications[5:]

    def flash_item(self, item_id, n):
        for p in self.pickups:
            if p['id'] == item_id and p['life'] > 1.4:
                p['n'] += n
                p['life'] = 2.4
                return
        self.pickups.insert(0, dict(id=item_id, n=n, life=2.4))
        del self.pickups[6:]

    def show_mission_complete(self, m):
        self.mission_toast = dict(mission=m, t=0.0, life=5.0)

    def set_tooltip(self, title, body=None, icon=None, x=None, y=None):
        self.tooltip = dict(title=title, body=body, icon=icon, x=x, y=y)

    # ---------------------------------------------------------------- panels
    def open(self, name):
        if self.panel == name:
            self.close()
            return
        self.panel = name
        self.game.audio.play('open')
        if name != 'machine':
            self.game.selected = None

    def close(self):
        if self.panel:
            self.game.audio.play('close')
        self.panel = None
        self.game.selected = None

    def update(self, dt, inp):
        for n in self.notifications:
            n['life'] -= dt
        self.notifications = [n for n in self.notifications if n['life'] > 0]
        for p in self.pickups:
            p['life'] -= dt
        self.pickups = [p for p in self.pickups if p['life'] > 0]
        if self.mission_toast:
            self.mission_toast['t'] += dt
            self.mission_toast['life'] -= dt
            if self.mission_toast['life'] <= 0:
                self.mission_toast = None

        for key, name in PANEL_KEYS.items():
            if inp.hit(key):
                if name == 'build' and self.game.build['active'] and not self.panel:
                    self.game.cancel_build()
                self.open(name)
        if inp.hit(pygame.K_ESCAPE):
            if self.dialog:
                self.dialog = None
            elif self.panel:
                self.close()
            elif self.game.build['active'] or self.game.build['demolish']:
                self.game.cancel_build()
            else:
                self.open('settings')

    # ----------------------------------------------------------------- draw
    def draw(self, screen):
        self.screen = screen
        self.w, self.h = screen.get_size()
        self.hovering_ui = False
        self.tooltip = None

        self.hud.draw(screen, self.w, self.h)
        self.draw_pickups(screen)

        p = self.panel
        if p:
            getattr(self.panels, p, lambda: None)()
        if self.dialog:
            self.panels.dialogue()
        self.panels.mission_complete()
        self.draw_build_banner(screen)
        self.draw_cursor_info(screen)
        self.draw_tooltip(screen)

    def draw_pickups(self, s):
        y = self.h - 260
        for p in self.pickups:
            a = clamp(p['life'] / 0.8, 0, 1)
            icon = item_icon(p['id'])
            icon.set_alpha(int(255 * a))
            s.blit(pygame.transform.smoothscale(icon, (30, 30)), (20, int(y)))
            icon.set_alpha(255)
            U.engraved(s, '+%d  %s' % (p['n'], ITEMS.get(p['id'], {}).get('name', p['id'])),
                       56, y + 7, U.FONT_BODY, P.UI_TRIM_HI, 13)
            y -= 32

    def draw_build_banner(self, s):
        b = self.game.build
        if not b['active'] and not b['demolish']:
            return
        if b['demolish']:
            text = 'DEMOLISH MODE - click a machine to remove it'
            col = P.UI_BAD
        else:
            from ..data.buildables import BUILDABLES
            text = ('Placing %s  -  R rotate  -  right click / Esc cancel'
                    % BUILDABLES[b['type']]['name'])
            col = P.UI_TRIM_HI
        tw = 520
        x = self.w / 2 - tw / 2
        D.rr(s, (x, 62, tw, 30), rgba((10, 12, 16), 0.82), 5)
        D.rr(s, (x, 62, tw, 30), rgba(col, 0.8), 5, 2)
        U.engraved(s, text, self.w / 2, 69, U.FONT_BODY, col, 13, True, 'center')

    def draw_cursor_info(self, s):
        g = self.game
        if self.hovering_ui or self.panel or self.dialog:
            return
        t = g.hover_target
        if not t:
            return
        kind = t[0]
        title, body, icon = '', '', None
        if kind == 'ent':
            e = t[1]
            title = e.def_['name']
            bits = []
            if e.broken:
                bits.append('BROKEN - press E to repair')
            elif e.def_['power'] > 0 and not e.powered:
                bits.append('No power')
            from ..data.recipes import RECIPES
            if e.recipe and e.recipe in RECIPES:
                bits.append(RECIPES[e.recipe]['name'])
            bits.append('Condition %d%%' % (e.condition * 100))
            if e.kind == 'gen':
                bits.append('%g kW' % e.def_['output'])
            body = '\n'.join(bits)
        elif kind == 'node':
            n = t[1]
            title = '%s deposit' % ITEMS[n.type]['name']
            body = '%d remaining\nClick to mine by hand' % n.amount
            icon = item_icon(n.type)
        elif kind == 'prop':
            p = t[1]
            title = p.label or dict(tree='Tree', boulder='Boulder', bush='Shrub').get(p.type, 'Scenery')
            if p.type == 'tree':
                body = 'Click to chop for wood'
            elif p.type == 'boulder':
                body = 'Click to break for stone'
        elif kind == 'npc':
            n = t[1]
            title = n.name
            body = '%s\nPress E to talk' % (n.title or ROLE_LABEL.get(n.role, n.role))
        if title:
            self.set_tooltip(title, body, icon, g.input.mx + 18, g.input.my + 18)

    def draw_tooltip(self, s):
        t = self.tooltip
        if not t:
            return
        pad = 10
        lines = [ln for ln in (t['body'] or '').split('\n') if ln]
        tw = U.text_size(t['title'], U.FONT_BODY, 13, True)[0]
        for ln in lines:
            tw = max(tw, U.text_size(ln, U.FONT_BODY, 11)[0])
        icon_w = 44 if t['icon'] else 0
        bw = tw + pad * 2 + icon_w
        bh = 26 + len(lines) * 15 + pad
        x = t['x'] if t['x'] is not None else self.game.input.mx + 16
        y = t['y'] if t['y'] is not None else self.game.input.my + 16
        x = clamp(x, 4, self.w - bw - 4)
        y = clamp(y, 4, self.h - bh - 4)
        U.tooltip_box(s, x, y, bw, bh)
        if t['icon']:
            s.blit(pygame.transform.smoothscale(t['icon'], (36, 36)), (int(x + pad), int(y + pad)))
        U.engraved(s, t['title'], x + pad + icon_w, y + pad, U.FONT_BODY, P.UI_TRIM_HI, 13, True)
        for i, ln in enumerate(lines):
            U.engraved(s, ln, x + pad + icon_w, y + 30 + i * 15, U.FONT_BODY, P.UI_TEXT, 11)


ROLE_LABEL = {
    'worker': 'Factory worker', 'logistics': 'Logistics', 'mechanic': 'Mechanic',
    'technician': 'Technician', 'engineer': 'Engineer', 'researcher': 'Researcher',
    'manager': 'Manager', 'civilian': 'Resident', 'vendor': 'Trader',
}
