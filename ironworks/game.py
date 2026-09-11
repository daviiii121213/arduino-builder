"""Game controller: owns the world and every system, routes input into actions,
advances the clock and the economy, and keeps the save file honest.
"""
import math
import random

import pygame

from .art.machines import machine_sprite
from .audio.audio import Audio
from .core.utils import clamp, dist, money as fmt_money, DIRS
from .data.buildables import BUILDABLES
from .data.items import ITEMS
from .data.recipes import RECIPES
from .entities.npc import Townsfolk
from .entities.player import Player
from .render.camera import Camera
from .render.renderer import Renderer
from .systems.economy import Contracts, Market
from .systems.employees import Employees
from .systems.factory import Factory
from .systems.fx import FX
from .systems.missions import Missions
from .systems.research import Research
from .systems.save import clear_save, has_save, load_game, save_game
from .ui.ui import UI
from .world.world import TILE, World

DAY_LENGTH = 600.0     # seconds of real time per in-game day
REACH = 2.6            # tiles the player can reach with a tool


class Game:
    def __init__(self, screen, inp, seed=20260911):
        self.screen = screen
        self.input = inp
        self.running = True

        self.world = World(seed)
        self.floors = {}
        self.money = 2500.0
        self.time = dict(t=8 * DAY_LENGTH / 24, day=1, hour=8.0, daylight=1.0)
        self.stats = dict(revenue=0.0, spent=0.0, built=0, hand_mined=0,
                          repairs=0.0, walked=0.0)

        self.audio = Audio()
        self.cam = Camera()
        self.fx = FX(self)
        self.player = Player(self, self.world.plot['x'] + 8, self.world.plot['y'] + 8)
        self.factory = Factory(self)
        self.market = Market(self)
        self.research = Research(self)
        self.employees = Employees(self)
        self.contracts = Contracts(self)
        self.missions = Missions(self)
        self.ui = UI(self)
        self.renderer = Renderer(self)

        self.npcs = []
        self.services = dict(office=False, breakroom=False, maintenance=False, breakroom_ent=None)
        self.build = dict(active=False, type=None, dir=0, demolish=False)
        self.hotbar = ['belt', 'cable', 'miner', 'furnace', 'chest', 'coal_gen', 'dock', 'floor']
        self.selected = None
        self.hover_target = None
        self.cursor_tile = (0, 0)
        self.cursor_world = (0.0, 0.0)
        self.current_region = None
        self.region_fade = 0.0
        self.net_per_minute = 0.0
        self.day_upkeep = 0.0
        self.paused = False
        self.expansions = 0
        self._upkeep_accum = 0.0
        self._money_history = []
        self._last_placed = None

        self.spawn_townsfolk()
        self.setup_starting_factory()
        self.cam.x = self.player.x * TILE
        self.cam.y = self.player.y * TILE

    # ------------------------------------------------------------------ setup
    def rnd(self):
        return random.random()

    def setup_starting_factory(self):
        p = self.world.plot

        def put(type_, x, y, direction=0):
            return self.factory.place(type_, p['x'] + x, p['y'] + y, direction)

        for y in range(2, 12):
            for x in range(2, 16):
                self.floors[(p['x'] + x, p['y'] + y)] = True
        put('furnace', 6, 5)
        put('chest', 9, 6)
        put('coal_gen', 11, 8)
        for i in range(5):
            put('cable', 8 + i, 7)
        put('cable', 8, 6)
        put('cable', 8, 5)
        put('lamp', 5, 9)
        put('lamp', 13, 4)
        self.player.give('iron_ore', 24)
        self.player.give('coal', 40)
        self.player.give('wood', 12)
        self.player.give('stone', 10)
        for e in self.factory.ents:
            if e.type == 'coal_gen':
                e.in_buf['coal'] = 20

    def spawn_townsfolk(self):
        p = self.world.plot
        add = lambda x, y, **kw: self.npcs.append(
            Townsfolk(x, y, random.randrange(1000000), **kw))
        add(p['x'] + 21, p['y'] - 4, role='manager', name='Halvard Ness',
            title='Redhaven Trade Guild', range_=3, quest_giver=True, lines=[
                'Your uncle built half this district with that old furnace. Put it to work.',
                'Ship anything you can make - the guild pays on collection, no haggling.',
                'Power first, then belts. A factory without cable is a very expensive shed.',
                'Contracts are where the real money is. Check the management board.'])
        add(34, 27, role='vendor', name='Bera Olsen', title='Redhaven Supplies',
            range_=3, vendor=True, lines=[
                'Ore, coal, timber - if it comes out of the ground I can get it.',
                'Buy through the market board. I take a small cut, everyone does.'])
        add(40, 178, role='mechanic', title='Blackvein Foreman', range_=5, lines=[
            'Seams down here run deep. Bring a proper drill and you will not regret it.',
            'Watch your machines. Heat and dust eat bearings alive.'])
        add(174, 136, role='logistics', title='Port Authority', range_=5, lines=[
            'Ships leave twice a day. Anything on your dock goes out with them.',
            'The high-value crates are what pay for a berth here.'])
        for _ in range(14):
            add(26 + random.random() * 64, 22 + random.random() * 46, range_=5)
        for _ in range(5):
            add(160 + random.random() * 20, 126 + random.random() * 34, role='worker', range_=4)
        for _ in range(4):
            add(28 + random.random() * 28, 170 + random.random() * 26, role='worker', range_=4)

    # ---------------------------------------------------------------- helpers
    def blocked(self, x, y, r=0.3):
        w = self.world
        for dx, dy in ((-r, -r), (r, -r), (-r, r), (r, r)):
            tx, ty = int(x + dx), int(y + dy)
            if w.solid_tile(tx, ty):
                return True
            e = self.factory.at(tx, ty)
            if e is not None and self.ent_solid(e):
                return True
        return w.prop_solid_at(x, y, r * 0.8) is not None

    @staticmethod
    def ent_solid(e):
        if e.kind in ('belt', 'cable', 'floor', 'pipe'):
            return False
        return e.type != 'door'

    def total_stored(self, item_id):
        n = self.player.inv_count(item_id)
        for e in self.factory.ents:
            n += e.out_buf.get(item_id, 0) + e.in_buf.get(item_id, 0)
        return n

    def notify(self, text, kind='info'):
        self.ui.notify(text, kind)

    # ----------------------------------------------------------------- events
    def on_produced(self, ent, recipe):
        produced = self.missions.counters['produced']
        for item_id, n in (recipe.get('out') or {}).items():
            produced[item_id] = produced.get(item_id, 0) + n
        self.player.add_skill_xp('production', 0.4)
        if random.random() < 0.25:
            self.audio.play('hammer', 0.5)

    def on_sold(self, revenue, count, ent):
        self.stats['revenue'] += revenue
        self.missions.counters['revenue'] += revenue
        self.fx.text(ent.cx, ent.cy - 0.6, '+' + fmt_money(revenue), (143, 224, 138), 15)
        self.player.add_skill_xp('management', revenue * 0.002)
        self.audio.play('cash', 0.7)

    def sell_from_inventory(self, item_id, n):
        n = min(n, self.player.inv_count(item_id))
        if n <= 0:
            return
        self.player.take(item_id, n)
        rev = self.market.sell(item_id, n)
        self.stats['revenue'] += rev
        self.missions.counters['revenue'] += rev
        self.notify('Sold %dx %s for %s' % (n, ITEMS[item_id]['name'], fmt_money(rev)), 'good')
        self.audio.play('cash')

    def buy_to_inventory(self, item_id, n):
        cost = self.market.buy(item_id, n)
        if not cost:
            self.notify('Not enough money', 'bad')
            self.audio.play('error')
            return
        self.stats['spent'] += cost
        self.player.give(item_id, n)
        self.notify('Bought %dx %s for %s' % (n, ITEMS[item_id]['name'], fmt_money(cost)), 'info')

    # ---------------------------------------------------------------- building
    def pick_build(self, type_):
        if type_ not in BUILDABLES:
            return
        self.build.update(active=True, type=type_, demolish=False)
        self.notify('%s selected - click to place' % BUILDABLES[type_]['name'], 'info')

    def cancel_build(self):
        self.build.update(active=False, type=None, demolish=False)

    def select_hotbar(self, i):
        bid = self.hotbar[i] if i < len(self.hotbar) else None
        if not bid:
            return
        if self.build['active'] and self.build['type'] == bid:
            self.cancel_build()
        else:
            self.pick_build(bid)

    def try_place(self, tx, ty):
        type_ = self.build['type']
        d = BUILDABLES[type_]
        ok, why = self.factory.can_place(type_, tx, ty, self.build['dir'])
        if not ok:
            self.notify(why, 'bad')
            self.audio.play('error')
            return False
        if self.money < d['cost']:
            self.notify('Not enough money', 'bad')
            self.audio.play('error')
            return False
        e = self.factory.place(type_, tx, ty, self.build['dir'])
        if e is None:
            return False
        self.money -= d['cost']
        self.stats['spent'] += d['cost']
        self.stats['built'] += 1
        built = self.missions.counters['built']
        built[type_] = built.get(type_, 0) + 1
        self.audio.play('place')
        self.fx.dust(tx + e.w / 2, ty + e.h / 2, 6)
        self.player.add_skill_xp('engineering', 1.2)
        if d['kind'] == 'floor':
            self.renderer.invalidate_chunk_at(tx, ty)
        self.refresh_services()
        return True

    def demolish(self, e):
        if e is None:
            return
        refund = int(e.def_['cost'] * 0.6)
        self.money += refund
        self.factory.remove(e)
        self.fx.dust(e.cx, e.cy, 10)
        self.audio.play('demolish')
        self.notify('%s removed (+%s)' % (e.def_['name'], fmt_money(refund)), 'info')
        if self.selected is e:
            self.selected = None
        self.refresh_services()

    def demolish_floor_at(self, tx, ty):
        if (tx, ty) not in self.floors:
            return False
        del self.floors[(tx, ty)]
        self.money += 4
        self.renderer.invalidate_chunk_at(tx, ty)
        self.audio.play('demolish')
        return True

    def repair_machine(self, e):
        need = 1 - e.condition
        if need < 0.005:
            return
        cost = int(e.def_['cost'] * 0.22 * need)
        if self.money < cost:
            self.notify('Not enough money to repair', 'bad')
            return
        self.money -= cost
        self.stats['spent'] += cost
        self.stats['repairs'] += 1
        self.factory.repair(e, 1.0)
        self.fx.sparks(e.cx, e.cy, 10)
        self.audio.play('repair')
        self.player.add_skill_xp('engineering', 3)
        self.notify('%s serviced for %s' % (e.def_['name'], fmt_money(cost)), 'good')

    def take_output(self, e):
        n = 0
        for item_id, count in list(e.out_buf.items()):
            got = self.player.give(item_id, count)
            if got > 0:
                e.out_buf[item_id] -= got
                n += got
                if e.out_buf[item_id] <= 0:
                    del e.out_buf[item_id]
        if n:
            self.audio.play('click_soft')

    def expansion_cost(self):
        return int(4000 * (1.75 ** self.expansions))

    def expand_land(self):
        cost = self.expansion_cost()
        if self.money < cost:
            self.notify('Not enough money to buy land', 'bad')
            self.audio.play('error')
            return False
        p, w = self.world.plot, self.world
        grow = 8
        nx = max(2, p['x'] - grow)
        ny = max(2, p['y'] - grow)
        nx2 = min(w.W - 2, p['x'] + p['w'] + grow)
        ny2 = min(w.H - 2, p['y'] + p['h'] + grow)
        if (nx, ny, nx2, ny2) == (p['x'], p['y'], p['x'] + p['w'], p['y'] + p['h']):
            self.notify('You already own everything within reach', 'warn')
            return False
        p['x'], p['y'], p['w'], p['h'] = nx, ny, nx2 - nx, ny2 - ny
        self.money -= cost
        self.stats['spent'] += cost
        self.expansions += 1
        for y in range(p['y'] - 1, p['y'] + p['h'] + 1):
            for x in range(p['x'] - 1, p['x'] + p['w'] + 1):
                if (w.in_bounds(x, y) and not w.is_water(x, y) and w.tile(x, y) != 5
                        and not w.node_at(x, y) and w.tile(x, y) != 6):
                    w.set_tile(x, y, 8)
        self.renderer.chunks.clear()
        self.ui.hud.minimap = None
        self.audio.play('cash')
        self.notify('Land expanded - plot is now %d x %d tiles' % (p['w'], p['h']), 'good')
        return True

    def refresh_services(self):
        def has(kind):
            for e in self.factory.ents:
                if e.def_['service'] == kind and not e.disabled:
                    return e
            return None
        br = has('breakroom')
        self.services['office'] = has('office') is not None
        self.services['breakroom'] = br is not None
        self.services['breakroom_ent'] = br
        self.services['maintenance'] = has('maintenance') is not None

    # ------------------------------------------------------------ interaction
    def update_cursor(self):
        wx, wy = self.cam.screen_to_world(self.input.mx, self.input.my)
        tx, ty = int(wx // TILE), int(wy // TILE)
        self.cursor_tile = (tx, ty)
        self.cursor_world = (wx / TILE, wy / TILE)
        self.hover_target = None
        if self.ui.hovering_ui or self.ui.panel:
            return
        ent = self.factory.at(tx, ty)
        if ent is not None:
            self.hover_target = ('ent', ent)
            return
        node = self.world.node_at(tx, ty)
        if node:
            self.hover_target = ('node', node)
            return
        prop = self.world.prop_solid_at(wx / TILE, wy / TILE, 0.45)
        if prop:
            self.hover_target = ('prop', prop)
            return
        for n in self.npcs + self.employees.list:
            if dist(n.x, n.y, wx / TILE, wy / TILE) < 0.6:
                self.hover_target = ('npc', n)
                return

    def handle_world_input(self, dt):
        inp = self.input
        if self.ui.hovering_ui or self.ui.panel or self.ui.dialog:
            return
        tx, ty = self.cursor_tile
        wx, wy = self.cursor_world

        for i in range(len(self.hotbar)):
            if inp.hit(pygame.K_1 + i):
                self.select_hotbar(i)
        if inp.hit(pygame.K_r) and self.build['active']:
            self.build['dir'] = (self.build['dir'] + 1) % 4
            self.audio.play('click_soft')
        if inp.hit(pygame.K_x):
            self.build['demolish'] = not self.build['demolish']
            self.build['active'] = False
            self.build['type'] = None
        if inp.rclicked:
            self.cancel_build()
            self.selected = None

        # a very fast click can press and release inside one frame, so treat the
        # edge-triggered flag as "held" too
        pressing = inp.down or inp.clicked

        if self.build['active'] and pressing:
            key = (tx, ty)
            if self._last_placed != key:
                if self.try_place(tx, ty) or inp.clicked:
                    self._last_placed = key
            return
        self._last_placed = None

        if self.build['demolish'] and inp.clicked:
            e = self.factory.at(tx, ty)
            if e is not None:
                self.demolish(e)
            else:
                self.demolish_floor_at(tx, ty)
            return

        if pressing and self.player.action_cooldown <= 0:
            t = self.hover_target
            reachable = dist(self.player.x, self.player.y, wx, wy) < REACH + 1
            if t and t[0] == 'ent' and inp.clicked:
                self.selected = t[1]
                self.ui.panel = 'machine'
                self.audio.play('open')
            elif t and t[0] == 'node' and reachable:
                self.hand_mine(t[1])
            elif t and t[0] == 'prop' and reachable:
                self.harvest_prop(t[1])

        if inp.hit(pygame.K_e):
            self.interact()

    def hand_mine(self, node):
        p = self.player
        p.action_cooldown = 0.42 - min(0.18, p.skills['engineering']['level'] * 0.012)
        p.working = 0.4
        bonus = 1 if random.random() < p.skills['production']['level'] * 0.05 else 0
        got = self.world.mine_node(node.x, node.y, 1 + bonus)
        if got > 0:
            p.give(node.type, got)
            self.stats['hand_mined'] += got
            produced = self.missions.counters['produced']
            produced[node.type] = produced.get(node.type, 0) + got
            self.fx.dust(node.x + 0.5, node.y + 0.5, 4)
            self.fx.item(node.x + 0.5, node.y + 0.3, node.type)
            self.audio.play('mine')
            p.add_skill_xp('production', 0.8)
            p.stamina = max(0.0, p.stamina - 1.2)
            if not self.world.node_at(node.x, node.y):
                self.renderer.invalidate_chunk_at(node.x, node.y)

    def harvest_prop(self, prop):
        if prop.type not in ('tree', 'boulder', 'bush'):
            return
        p = self.player
        p.action_cooldown = 0.5
        p.working = 0.45
        prop.hp -= 1
        self.fx.dust(prop.x, prop.y, 3)
        self.audio.play('mine' if prop.type == 'boulder' else 'chop')
        if prop.hp <= 0:
            item_id = 'stone' if prop.type == 'boulder' else 'wood'
            n = random.randint(3, 5) if prop.type == 'boulder' else random.randint(2, 4)
            p.give(item_id, n)
            produced = self.missions.counters['produced']
            produced[item_id] = produced.get(item_id, 0) + n
            self.fx.item(prop.x, prop.y - 0.4, item_id)
            self.world.remove_prop(prop)
            p.add_skill_xp('production', 1.5)

    def interact(self):
        p = self.player
        best, best_d = None, REACH
        for n in self.npcs + self.employees.list:
            d = dist(p.x, p.y, n.x, n.y)
            if d < best_d:
                best_d, best = d, ('npc', n)
        for e in self.factory.ents:
            d = dist(p.x, p.y, e.cx, e.cy) - max(e.w, e.h) * 0.4
            if d < best_d:
                best_d, best = d, ('ent', e)
        if not best:
            self.notify('Nothing within reach', 'info')
            return

        if best[0] == 'npc':
            n = best[1]
            if hasattr(n, 'speak'):
                text = n.speak()
                title = n.title
            else:
                text = ('Morale %d%%, stamina %d%%. %s' %
                        (n.morale * 100, n.stamina * 100,
                         'Working now.' if n.state == 'work' else 'Heading to a job.'))
                title = 'Employee'
            self.ui.dialog = dict(name=n.name, role=n.role, seed=n.seed, title=title, text=text)
            self.audio.play('open')
            return

        e = best[1]
        if e.broken or e.condition < 0.99:
            p.working = 0.6
            self.factory.repair(e, 0.08 + p.skills['engineering']['level'] * 0.012)
            p.stamina = max(0.0, p.stamina - 4)
            p.add_skill_xp('engineering', 1.5)
            self.fx.sparks(e.cx, e.cy, 5)
            self.audio.play('repair')
            if not e.broken and e.condition >= 0.999:
                self.notify('%s fully serviced' % e.def_['name'], 'good')
            self.stats['repairs'] += 0.1
        elif e.total_out() > 0:
            self.take_output(e)
            self.notify('Collected output from %s' % e.def_['name'], 'info')
        elif e.kind == 'gen' and e.def_['fuel'] and p.inv_count(e.def_['fuel']) > 0:
            n = min(20, p.inv_count(e.def_['fuel']))
            p.take(e.def_['fuel'], n)
            e.in_buf[e.def_['fuel']] = e.in_buf.get(e.def_['fuel'], 0) + n
            self.notify('Loaded %d %s' % (n, ITEMS[e.def_['fuel']]['name']), 'info')
            self.audio.play('click_soft')
        elif e.kind in ('machine', 'miner'):
            r = RECIPES.get(e.recipe)
            fed = 0
            if r:
                for item_id, n in r['inp'].items():
                    have = p.inv_count(item_id)
                    if have > 0:
                        give = min(have, n * 10)
                        p.take(item_id, give)
                        e.in_buf[item_id] = e.in_buf.get(item_id, 0) + give
                        fed += give
            if fed:
                self.notify('Loaded %d items into %s' % (fed, e.def_['name']), 'info')
                self.audio.play('click_soft')
            else:
                self.selected = e
                self.ui.panel = 'machine'
        else:
            self.selected = e
            self.ui.panel = 'machine'

    # -------------------------------------------------------------------- loop
    def update(self, dt):
        inp = self.input
        dt = min(dt, 0.05)

        self.ui.update(dt, inp)
        if inp.hit(pygame.K_F5):
            self.save()
        if inp.hit(pygame.K_F9):
            self.load()
        if inp.hit(pygame.K_p):
            self.paused = not self.paused
            self.notify('Paused' if self.paused else 'Resumed', 'info')

        if not self.ui.hovering_ui and inp.wheel:
            self.cam.target_zoom = clamp(
                self.cam.target_zoom * (0.88 if inp.wheel > 0 else 1.14), 0.5, 2.6)

        self.update_cursor()
        if not self.paused:
            px, py = self.player.x, self.player.y
            self.player.update(dt, inp.keys, self)
            self.stats['walked'] += dist(px, py, self.player.x, self.player.y) * 2
            if self.player.moving and random.random() < dt * 5:
                self.audio.play('step', 0.35)
            self.handle_world_input(dt)

            self.factory.update(dt, self)
            self.employees.update(dt, self)
            for n in self.npcs:
                n.update(dt, self)
            self.market.update(dt)
            self.contracts.update(dt)
            self.missions.update(dt)
            self.fx.update(dt)
            self.advance_time(dt)
            self.apply_upkeep(dt)

        self.cam.follow(self.player.x * TILE, self.player.y * TILE, dt)
        self.cam.update(dt)

        reg = self.world.region_at(int(self.player.x), int(self.player.y))
        if reg is not self.current_region:
            self.current_region = reg
            self.region_fade = 3.5 if reg else 0.0
        self.region_fade = max(0.0, self.region_fade - dt)

        active_machines = sum(1 for e in self.factory.ents if e.active and e.kind != 'belt')
        active_belts = sum(1 for e in self.factory.ents if e.kind == 'belt' and e.items)
        self.audio.set_ambience(active_machines, active_belts,
                                not self.world.in_plot(self.player.x, self.player.y), dt)
        self.audio.update_music(dt, self.music_tier())

    def music_tier(self):
        n = len(self.factory.ents)
        if 'robotics' in self.research.unlocked:
            return 4
        if n > 90 or 'electronics' in self.research.unlocked:
            return 3
        if n > 45 or 'chemistry' in self.research.unlocked:
            return 2
        return 1 if n > 18 else 0

    def advance_time(self, dt):
        t = self.time
        t['t'] += dt
        if t['t'] >= DAY_LENGTH:
            t['t'] -= DAY_LENGTH
            t['day'] += 1
            self.end_of_day()
        t['hour'] = (t['t'] / DAY_LENGTH) * 24
        h = t['hour']
        # never fully dark: the factory has to stay readable at 3am
        if h < 5 or h > 20:
            t['daylight'] = 0.2
        elif h < 7:
            t['daylight'] = clamp((h - 5) / 2, 0, 1) * 0.8 + 0.2
        elif h < 18:
            t['daylight'] = 1.0
        else:
            t['daylight'] = clamp(1 - (h - 18) / 2, 0, 1) * 0.8 + 0.2

    def end_of_day(self):
        wages = self.employees.payroll()
        self.money -= wages
        self.stats['spent'] += wages
        self.notify('Day %d: payroll %s paid' % (self.time['day'], fmt_money(wages)),
                    'warn' if wages > 0 else 'info')
        self.market.day_revenue = 0.0
        self.market.day_costs = 0.0
        self.day_upkeep = 0.0
        self.contracts.generate()
        if self.money < 0:
            self.notify('You are in debt - sell stock or take a contract', 'bad')
        self.save()

    def apply_upkeep(self, dt):
        rate = self.factory.operating_cost(self)
        self.money -= rate * dt
        self.day_upkeep += rate * dt
        self.stats['spent'] += rate * dt
        self._upkeep_accum += dt
        if self._upkeep_accum > 1:
            self._upkeep_accum = 0.0
            self._money_history.append(self.money)
            del self._money_history[:-90]
            if len(self._money_history) > 6:
                self.net_per_minute = (self.money - self._money_history[-6]) * 10

    def draw(self, dt):
        screen = self.screen
        self.cam.resize(*screen.get_size())
        self.renderer.draw(screen, self.cam, dt)
        self.ui.draw(screen)
        if self.paused:
            from .art import ui as U
            overlay = pygame.Surface(screen.get_size(), pygame.SRCALPHA)
            overlay.fill((6, 8, 11, 128))
            screen.blit(overlay, (0, 0))
            w, h = screen.get_size()
            U.engraved(screen, 'PAUSED', w / 2, h / 2 - 30, U.FONT_TITLE, (232, 226, 212), 42, True, 'center')
            U.engraved(screen, 'press P to resume', w / 2, h / 2 + 20, U.FONT_BODY, (152, 145, 127), 15, False, 'center')

    # ------------------------------------------------------------ persistence
    def save(self):
        self.notify('Game saved' if save_game(self) else 'Save failed', 'info')

    def load(self):
        if not has_save():
            self.notify('No save found', 'warn')
            return
        if load_game(self):
            self.renderer.chunks.clear()
            self.ui.hud.minimap = None
            self.refresh_services()
            self.notify('Game loaded', 'good')
        else:
            self.notify('Load failed', 'bad')
