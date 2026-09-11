"""Factory simulation: placement grid, power and fluid networks, machine
processing, conveyor transport, wear and breakdowns.

Built so several hundred entities stay cheap: power is solved only when the
layout changes, and belts move items with a single scalar per item.
"""
import random

from ..core.utils import DIRS, clamp
from ..data.buildables import BUILDABLES
from ..data.items import ITEMS, is_fluid
from ..data.recipes import RECIPES

_next_id = [1]


class Entity:
    __slots__ = ('id', 'type', 'def_', 'kind', 'x', 'y', 'dir', 'w', 'h',
                 'in_buf', 'out_buf', 'recipe', 'progress', 'condition', 'broken',
                 'temp', 'powered', 'satisfaction', 'active', 'net', 'fuel', 'items',
                 'total_made', 'anim', 'workers', 'disabled', 'sell_timer', 'depleted')

    def __init__(self, type_, x, y, direction):
        d = BUILDABLES[type_]
        self.id = _next_id[0]
        _next_id[0] += 1
        self.type = type_
        self.def_ = d
        self.kind = d['kind']
        self.x, self.y = x, y
        self.dir = direction % 4
        swap = self.dir % 2 == 1 and d['w'] != d['h']
        self.w, self.h = (d['h'], d['w']) if swap else (d['w'], d['h'])

        self.in_buf = {}
        self.out_buf = {}
        self.recipe = None
        self.progress = 0.0
        self.condition = 1.0
        self.broken = False
        self.temp = 20.0
        self.powered = False
        self.satisfaction = 0.0
        self.active = False
        self.net = -1
        self.fuel = 0.0
        self.items = []          # belts: [[item_id, pos], ...]
        self.total_made = 0
        self.anim = random.random() * 10
        self.workers = 0
        self.disabled = False
        self.sell_timer = 0.0
        self.depleted = False

    # ------------------------------------------------------------- geometry
    @property
    def cx(self):
        return self.x + self.w / 2

    @property
    def cy(self):
        return self.y + self.h / 2

    def covers(self, tx, ty):
        return self.x <= tx < self.x + self.w and self.y <= ty < self.y + self.h

    # -------------------------------------------------------------- buffers
    def total_out(self):
        return sum(self.out_buf.values())

    def total_in(self):
        return sum(self.in_buf.values())

    def accepts(self, item_id):
        if self.disabled:
            return False
        k = self.kind
        if k == 'store':
            return self.total_out() < self.def_['capacity']
        if k == 'dock':
            return True
        if k == 'gen':
            return self.def_['fuel'] == item_id and self.in_buf.get(item_id, 0) < 50
        if k in ('machine', 'miner'):
            r = RECIPES.get(self.recipe)
            if not r or item_id not in r['inp']:
                return False
            return self.in_buf.get(item_id, 0) < max(10, r['inp'][item_id] * 8)
        if k == 'belt':
            return len(self.items) < 3 and not any(it[1] < 0.34 for it in self.items)
        return False

    def insert(self, item_id, n=1):
        if self.kind == 'belt':
            self.items.append([item_id, 0.0])
            return 1
        buf = self.out_buf if self.kind in ('store', 'dock') else self.in_buf
        buf[item_id] = buf.get(item_id, 0) + n
        return n

    def take_any(self):
        for k, v in self.out_buf.items():
            if v > 0:
                self.out_buf[k] = v - 1
                if self.out_buf[k] <= 0:
                    del self.out_buf[k]
                return k
        return None


class Factory:
    def __init__(self, game):
        self.game = game
        self.ents = []
        self.grid = {}
        self.networks = []
        self.pipe_nets = []
        self.dirty_power = True
        self.stats = dict(produced=0, sold=0, power_use=0.0, power_gen=0.0)
        self.pollution = 0.0

    def at(self, x, y):
        return self.grid.get((x, y))

    # ------------------------------------------------------------- placement
    def can_place(self, type_, x, y, direction):
        d = BUILDABLES.get(type_)
        if not d:
            return False, 'Unknown'
        swap = direction % 2 == 1 and d['w'] != d['h']
        w, h = (d['h'], d['w']) if swap else (d['w'], d['h'])
        world = self.game.world
        for dy in range(h):
            for dx in range(w):
                tx, ty = x + dx, y + dy
                if not world.in_bounds(tx, ty):
                    return False, 'Outside the world'
                if not world.in_plot(tx, ty):
                    return False, 'Outside your land - buy an expansion'
                if world.is_water(tx, ty) and type_ != 'waterpump':
                    return False, 'Cannot build on water'
                ex = self.at(tx, ty)
                if ex is not None and not (d['kind'] == 'floor' and ex.kind == 'floor'):
                    return False, 'Tile occupied'
                if world.prop_solid_at(tx + 0.5, ty + 0.5, 0.1):
                    return False, 'Blocked by terrain'
        if d['kind'] == 'miner':
            if not any(world.node_at(x + dx, y + dy)
                       for dy in range(h) for dx in range(w)):
                return False, 'Must sit on a resource deposit'
        if type_ == 'waterpump':
            near = any(world.is_water(x + dx, y + dy)
                       for dy in range(-1, h + 1) for dx in range(-1, w + 1))
            if not near:
                return False, 'Must touch water'
        return True, 'ok'

    def place(self, type_, x, y, direction=0):
        ok, _why = self.can_place(type_, x, y, direction)
        if not ok:
            return None
        e = Entity(type_, x, y, direction)
        if e.kind == 'floor':
            self.game.floors[(x, y)] = True
            return e
        self.ents.append(e)
        for dy in range(e.h):
            for dx in range(e.w):
                self.grid[(x + dx, y + dy)] = e
        # a fresh machine gets a sensible default recipe so it is immediately useful
        if e.kind == 'machine':
            opts = [r for r in RECIPES.values() if r['machine'] == type_ and not r['tech']]
            if opts:
                e.recipe = opts[0]['id']
        if type_ == 'waterpump':
            e.recipe = 'pump_water'
        if e.kind == 'miner':
            e.recipe = 'mine_node'
        self.dirty_power = True
        return e

    def remove(self, e):
        if e not in self.ents:
            return
        self.ents.remove(e)
        for dy in range(e.h):
            for dx in range(e.w):
                self.grid.pop((e.x + dx, e.y + dy), None)
        self.dirty_power = True

    # --------------------------------------------------------------- networks
    def rebuild_power(self):
        self.dirty_power = False
        self.rebuild_pipes()
        for e in self.ents:
            e.net = -1
        self.networks = []
        visited = set()

        for start in self.ents:
            if start.kind != 'cable' or start.id in visited:
                continue
            net = dict(id=len(self.networks), gen=0.0, use=0.0, ratio=0.0,
                       members=[], cables=[])
            stack = [start]
            visited.add(start.id)
            while stack:
                c = stack.pop()
                c.net = net['id']
                net['cables'].append(c)
                for dx, dy in DIRS:
                    n = self.at(c.x + dx, c.y + dy)
                    if n is not None and n.kind == 'cable' and n.id not in visited:
                        visited.add(n.id)
                        stack.append(n)
            self.networks.append(net)

        # consumers and producers join a network if any tile touches one of its cables
        for e in self.ents:
            if e.kind in ('cable', 'belt'):
                continue
            if e.def_['power'] <= 0 and e.kind != 'gen':
                continue
            net = -1
            for dy in range(-1, e.h + 1):
                if net >= 0:
                    break
                for dx in range(-1, e.w + 1):
                    if 0 <= dx < e.w and 0 <= dy < e.h:
                        continue
                    n = self.at(e.x + dx, e.y + dy)
                    if n is not None and n.kind == 'cable' and n.net >= 0:
                        net = n.net
                        break
            e.net = net
            if net >= 0:
                self.networks[net]['members'].append(e)

        # Belts share power along a run: energising one belt of a line energises the
        # whole line, so the player doesn't have to cable every single tile.
        seen = set()
        for start in self.ents:
            if start.kind != 'belt' or start.id in seen:
                continue
            group, stack, net = [], [start], -1
            seen.add(start.id)
            while stack:
                b = stack.pop()
                group.append(b)
                for dx, dy in DIRS:
                    n = self.at(b.x + dx, b.y + dy)
                    if n is None:
                        continue
                    if n.kind == 'belt' and n.id not in seen:
                        seen.add(n.id)
                        stack.append(n)
                    elif n.kind == 'cable' and n.net >= 0 and net < 0:
                        net = n.net
            for b in group:
                b.net = net
                if net >= 0:
                    self.networks[net]['members'].append(b)

    def rebuild_pipes(self):
        """Pipe runs form fluid networks: any machine touching a run can push
        fluid in or draw it out."""
        self.pipe_nets = []
        seen = set()
        for start in self.ents:
            if start.kind != 'pipe' or start.id in seen:
                continue
            net = dict(pipes=[], taps=[], t=0.0)
            taps = set()
            stack = [start]
            seen.add(start.id)
            while stack:
                c = stack.pop()
                net['pipes'].append(c)
                for dx, dy in DIRS:
                    n = self.at(c.x + dx, c.y + dy)
                    if n is None:
                        continue
                    if n.kind == 'pipe':
                        if n.id not in seen:
                            seen.add(n.id)
                            stack.append(n)
                    else:
                        taps.add(n)
            net['taps'] = list(taps)
            self.pipe_nets.append(net)

    def tick_pipes(self, dt):
        for net in self.pipe_nets:
            taps = net['taps']
            if len(taps) < 2:
                continue
            net['t'] += dt
            if net['t'] < 0.35:
                continue
            net['t'] = 0.0
            for src in taps:
                for item_id in list(src.out_buf.keys()):
                    if not is_fluid(item_id) or src.out_buf.get(item_id, 0) <= 0:
                        continue
                    for dst in taps:
                        if dst is src or not dst.accepts(item_id):
                            continue
                        move = min(4, src.out_buf[item_id])
                        src.out_buf[item_id] -= move
                        if src.out_buf[item_id] <= 0:
                            del src.out_buf[item_id]
                        dst.insert(item_id, move)
                        break

    # --------------------------------------------------------------- main tick
    def update(self, dt, game):
        if self.dirty_power:
            self.rebuild_power()
        skills = game.player.skills
        eng_bonus = 1 - min(0.4, skills['engineering']['level'] * 0.02)
        prod_bonus = 1 + skills['production']['level'] * 0.035
        logi_bonus = 1 + skills['logistics']['level'] * 0.04
        wear_bonus = 0.55 if game.services.get('maintenance') else 1.0
        daylight = game.time['daylight']

        total_gen = total_use = 0.0
        for net in self.networks:
            net['gen'] = net['use'] = 0.0

        for e in self.ents:
            d = e.def_
            if e.kind == 'gen' and not e.disabled:
                out = 0.0
                if d['solar']:
                    out = d['output'] * daylight
                elif d['fuel']:
                    if e.fuel <= 0 and e.in_buf.get(d['fuel'], 0) > 0:
                        e.in_buf[d['fuel']] -= 1
                        if e.in_buf[d['fuel']] <= 0:
                            del e.in_buf[d['fuel']]
                        e.fuel = d['burn_time']
                    if e.fuel > 0:
                        e.fuel -= dt
                        out = d['output']
                else:
                    out = d['output']
                out *= 0.55 + 0.45 * e.condition
                if e.broken:
                    out = 0.0
                e.satisfaction = 1.0 if out > 0 else 0.0
                e.active = out > 0
                if e.net >= 0:
                    self.networks[e.net]['gen'] += out
                total_gen += out
                if out > 0 and d['fuel']:
                    self.pollution += dt * 0.02
            elif d['power'] > 0 and not e.disabled and not e.broken:
                use = d['power'] * eng_bonus
                if e.net >= 0:
                    self.networks[e.net]['use'] += use
                total_use += use

        for net in self.networks:
            net['ratio'] = 1.0 if net['use'] <= 0 else min(1.0, net['gen'] / net['use'])
        self.stats['power_gen'] = total_gen
        self.stats['power_use'] = total_use

        for e in self.ents:
            if e.kind != 'gen':
                e.active = False
            e.anim += dt
            net = self.networks[e.net] if e.net >= 0 else None
            if e.kind != 'gen':
                e.satisfaction = (net['ratio'] if net else 0.0) if e.def_['power'] > 0 else 1.0
            e.powered = e.satisfaction > 0.02

            k = e.kind
            if k == 'machine':
                self.tick_machine(e, dt, game, prod_bonus, wear_bonus)
            elif k == 'miner':
                self.tick_miner(e, dt, game, prod_bonus, wear_bonus)
            elif k == 'belt':
                self.tick_belt(e, dt, logi_bonus)
            elif k == 'dock':
                self.tick_dock(e, dt, game)
            elif k == 'lab':
                self.tick_lab(e, dt, game)
            elif k == 'lamp':
                e.active = e.powered

            if e.temp > 20 and not e.active:
                e.temp -= dt * 6

        self.tick_pipes(dt)

    def machine_speed(self, e, game, prod_bonus):
        cond = 0.35 + 0.65 * e.condition
        workers = 1 + min(0.6, e.workers * 0.22) * (1.25 if game.services.get('breakroom') else 1.0)
        return e.satisfaction * cond * prod_bonus * workers

    def tick_machine(self, e, dt, game, prod_bonus, wear_bonus):
        if e.broken or e.disabled or not e.recipe:
            return
        r = RECIPES.get(e.recipe)
        if not r:
            return
        speed = self.machine_speed(e, game, prod_bonus)
        if speed <= 0.02:
            return

        if e.progress <= 0:
            for item_id, n in r['inp'].items():
                if e.in_buf.get(item_id, 0) < n:
                    return
            if e.total_out() > 60:
                return
            for item_id, n in r['inp'].items():
                e.in_buf[item_id] -= n
                if e.in_buf[item_id] <= 0:
                    del e.in_buf[item_id]
            e.progress = 0.0001

        e.progress += (dt * speed) / r['time']
        e.active = True
        # heat eases toward a working temperature rather than pinning at the red line
        target = 760 + e.workers * 20 if e.type == 'furnace' else 78
        e.temp += (target - e.temp) * min(1.0, dt * 0.35)

        e.condition -= dt * 0.0022 * wear_bonus * (1.35 if e.temp > 700 else 1.0)
        if e.condition < 0.18 and random.random() < dt * 0.09:
            self.breakdown(e, game)
        e.condition = clamp(e.condition, 0, 1)

        if e.progress >= 1:
            e.progress = 0.0
            waste = max(0.0, 0.06 - game.player.skills['production']['level'] * 0.006)
            for item_id, n in r['out'].items():
                amt = max(1, n - 1) if random.random() < waste else n
                e.out_buf[item_id] = e.out_buf.get(item_id, 0) + amt
            e.total_made += 1
            self.stats['produced'] += 1
            game.on_produced(e, r)

    def tick_miner(self, e, dt, game, prod_bonus, wear_bonus):
        if e.broken or e.disabled:
            return
        speed = self.machine_speed(e, game, prod_bonus) * e.def_['rate']
        if speed <= 0.02:
            return
        e.progress += (dt * speed) / RECIPES['mine_node']['time']
        e.active = True
        e.condition -= dt * 0.0016 * wear_bonus
        if e.condition < 0.18 and random.random() < dt * 0.07:
            self.breakdown(e, game)
        if e.progress >= 1:
            e.progress = 0.0
            if e.total_out() > 60:
                return
            for dy in range(e.h):
                for dx in range(e.w):
                    node = game.world.node_at(e.x + dx, e.y + dy)
                    if node and node.amount > 0:
                        got = game.world.mine_node(e.x + dx, e.y + dy, 1)
                        if got:
                            e.out_buf[node.type] = e.out_buf.get(node.type, 0) + got
                            e.total_made += 1
                            self.stats['produced'] += 1
                            game.on_produced(e, dict(out={node.type: got}))
                        return
            e.depleted = True

    def tick_belt(self, e, dt, logi_bonus):
        if not e.powered and e.def_['power'] > 0:
            return
        spd = e.def_['speed'] * logi_bonus * (e.satisfaction or 1.0)
        dx, dy = DIRS[e.dir]
        target = self.at(e.x + dx, e.y + dy)
        e.items.sort(key=lambda it: -it[1])
        i = 0
        while i < len(e.items):
            it = e.items[i]
            ahead = e.items[i - 1][1] - 0.34 if i > 0 else 1.0
            it[1] = min(it[1] + dt * spd, ahead)
            if it[1] >= 1.0:
                if target is not None and target is not e and target.accepts(it[0]):
                    target.insert(it[0], 1)
                    e.items.pop(i)
                    e.active = True
                    continue
                it[1] = 1.0
            i += 1
        # pull from whatever sits behind us
        if not e.items or e.items[-1][1] > 0.34:
            back = self.at(e.x - dx, e.y - dy)
            if back is not None and back is not e and back.kind != 'belt' and back.total_out() > 0:
                item_id = back.take_any()
                if item_id:
                    e.items.append([item_id, 0.0])
                    e.active = True

    def tick_dock(self, e, dt, game):
        e.sell_timer += dt
        if e.sell_timer < 1.2:
            return
        e.sell_timer = 0.0
        sold = 0
        revenue = 0.0
        for item_id, n in list(e.out_buf.items()):
            if n <= 0:
                continue
            batch = min(n, 25)
            revenue += game.market.sell(item_id, batch)
            sold += batch
            e.out_buf[item_id] -= batch
            if e.out_buf[item_id] <= 0:
                del e.out_buf[item_id]
        if sold:
            e.active = True
            self.stats['sold'] += sold
            game.on_sold(revenue, sold, e)

    def tick_lab(self, e, dt, game):
        if not e.powered or e.broken or e.disabled:
            return
        e.active = True
        game.research.add_points(dt * e.satisfaction *
                                 (1 + game.player.skills['technology']['level'] * 0.06))

    # ------------------------------------------------------------ maintenance
    def breakdown(self, e, game):
        if e.broken:
            return
        e.broken = True
        e.active = False
        e.condition = min(e.condition, 0.12)
        game.notify('%s has broken down!' % e.def_['name'], 'bad')
        game.audio.play('alarm')

    def repair(self, e, amount):
        e.condition = clamp(e.condition + amount, 0, 1)
        if e.condition > 0.35:
            e.broken = False

    def operating_cost(self, game):
        cost = 0.0
        for e in self.ents:
            if e.kind in ('cable', 'floor'):
                continue
            cost += e.def_['cost'] * 0.00022
            if e.def_['power'] > 0 and e.powered:
                cost += e.def_['power'] * 0.010
        for emp in game.employees.list:
            cost += emp.wage / 60.0
        if game.services.get('office'):
            cost *= 0.88
        return cost

    # ------------------------------------------------------------ persistence
    def serialize(self):
        return [dict(t=e.type, x=e.x, y=e.y, d=e.dir, r=e.recipe, c=e.condition,
                     b=e.broken, i=e.in_buf, o=e.out_buf, f=e.fuel, p=e.progress,
                     dis=e.disabled, it=[[i[0], round(i[1], 2)] for i in e.items])
                for e in self.ents]

    def deserialize(self, arr):
        self.ents = []
        self.grid = {}
        for s in arr:
            e = self.place(s['t'], s['x'], s['y'], s['d'])
            if e is None:
                continue
            e.recipe = s.get('r')
            e.condition = s.get('c', 1.0)
            e.broken = bool(s.get('b'))
            e.in_buf = dict(s.get('i') or {})
            e.out_buf = dict(s.get('o') or {})
            e.fuel = s.get('f', 0.0)
            e.progress = s.get('p', 0.0)
            e.disabled = bool(s.get('dis'))
            e.items = [[i[0], i[1]] for i in (s.get('it') or [])]
        self.dirty_power = True
