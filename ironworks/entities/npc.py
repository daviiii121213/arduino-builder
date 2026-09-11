"""NPCs: hired employees who physically work the factory floor, and townsfolk who
wander, trade and hand out contracts.
"""
import math

import pygame

from ..art.characters import character_sheet, FW, FH
from ..core.rng import Rng
from ..core.utils import clamp, dist

FIRST = ['Mara', 'Tomas', 'Ines', 'Kwame', 'Yuki', 'Dario', 'Petra', 'Sven', 'Nadia', 'Bo',
         'Lucia', 'Otto', 'Rina', 'Ezra', 'Halle', 'Milo', 'Vera', 'Anders', 'Femi', 'Sasha',
         'Rosa', 'Hugo', 'Ilse', 'Jun', 'Karim', 'Elke', 'Nils', 'Tara', 'Ravi', 'Greta']
LAST = ['Vogel', 'Marek', 'Okafor', 'Lindqvist', 'Duarte', 'Novak', 'Haas', 'Bianchi',
        'Kowal', 'Rennes', 'Sato', 'Abara', 'Holt', 'Ferreira', 'Steen', 'Ivanov',
        'Marchetti', 'Baptiste']

ROLE_WAGE = dict(worker=22, logistics=26, mechanic=34, technician=38,
                 engineer=52, researcher=58, manager=64)

ROLE_INFO = {
    'worker':     dict(name='Factory Worker', desc='Operates machines, adding throughput wherever they stand.'),
    'logistics':  dict(name='Logistics Worker', desc='Keeps storage and shipping moving; faster dock turnaround.'),
    'mechanic':   dict(name='Mechanic', desc='Walks the floor repairing worn and broken machines.'),
    'technician': dict(name='Technician', desc='Boosts machine efficiency and slows wear.'),
    'engineer':   dict(name='Engineer', desc='Large throughput boost on complex machines.'),
    'researcher': dict(name='Researcher', desc='Staffs the lab, generating extra research points.'),
    'manager':    dict(name='Manager', desc='Improves sale prices and lowers operating costs.'),
}


def random_name(rnd):
    return '%s %s' % (rnd.pick(FIRST), rnd.pick(LAST))


class Person:
    def __init__(self, role, x, y, seed):
        self.role = role
        self.x = float(x)
        self.y = float(y)
        self.seed = int(seed)
        self.dir = 2
        self.frame = 0
        self.anim_t = 0.0
        self.speed = 2.4 + (self.seed % 7) * 0.08
        self.sheet = character_sheet(role, self.seed)
        self.state = 'idle'
        self.state_t = 0.0
        self.radius = 0.28
        self.wander_target = None

    def step_toward(self, tx, ty, dt, game, speed_mul=1.0):
        dx, dy = tx - self.x, ty - self.y
        d = math.hypot(dx, dy)
        if d < 0.12:
            return True
        sp = self.speed * speed_mul * dt
        nx, ny = dx / d * sp, dy / d * sp
        self.dir = (1 if nx > 0 else 3) if abs(nx) > abs(ny) else (2 if ny > 0 else 0)
        if not game.blocked(self.x + nx, self.y, self.radius):
            self.x += nx
        elif not game.blocked(self.x + nx, self.y + (0.4 if ny > 0 else -0.4), self.radius):
            self.y += (0.4 if ny > 0 else -0.4) * 0.4
        if not game.blocked(self.x, self.y + ny, self.radius):
            self.y += ny
        elif not game.blocked(self.x + (0.4 if nx > 0 else -0.4), self.y + ny, self.radius):
            self.x += (0.4 if nx > 0 else -0.4) * 0.4
        self.anim_t += dt * 8
        self.frame = 1 + int(self.anim_t) % 5
        return False

    def idle(self):
        self.frame = 0
        self.anim_t = 0.0

    def draw(self, target, sx, sy):
        src = pygame.Rect(self.frame * FW, self.dir * FH, FW, FH)
        target.blit(self.sheet['surf'], (int(sx - FW / 2), int(sy - FH + 6)), src)


class Employee(Person):
    def __init__(self, role, x, y, seed, name=None):
        super().__init__(role, x, y, seed)
        rnd = Rng(self.seed)
        self.name = name or random_name(rnd)
        self.skill = 1 + int(rnd() * 3)
        self.morale = 0.8
        self.stamina = 1.0
        self.wage = ROLE_WAGE[role] * (0.85 + self.skill * 0.12)
        self.assigned = None
        self.state = 'seek'

    def update(self, dt, game):
        self.state_t -= dt
        factory = game.factory

        if self.stamina < 0.15 and game.services.get('breakroom_ent'):
            self.state = 'rest'
            self.assigned = None

        if self.state == 'rest':
            b = game.services.get('breakroom_ent')
            if not b:
                self.state = 'seek'
            elif self.step_toward(b.cx, b.cy, dt, game):
                self.idle()
                self.stamina = min(1.0, self.stamina + dt * 0.12)
                self.morale = min(1.0, self.morale + dt * 0.05)
                if self.stamina >= 0.95:
                    self.state = 'seek'
        elif self.state == 'seek':
            self.assigned = self.pick_job(game)
            self.state = 'goto' if self.assigned else 'wander'
            self.state_t = 3
        elif self.state == 'goto':
            t = self.assigned
            if t is None or t not in factory.ents:
                self.state = 'seek'
            elif self.step_toward(t.cx, t.cy + 0.6, dt, game):
                self.state = 'work'
                self.state_t = 6 + (self.seed % 6)
                t.workers += 1
        elif self.state == 'work':
            t = self.assigned
            if t is None or t not in factory.ents:
                self.state = 'seek'
            else:
                self.anim_t += dt * 3
                self.frame = 6 + int(self.anim_t * 2) % 2
                self.stamina = max(0.0, self.stamina - dt * 0.012)
                if self.role == 'mechanic' and (t.broken or t.condition < 0.9):
                    factory.repair(t, dt * 0.06 * self.skill *
                                   (1.6 if game.services.get('maintenance') else 1.0))
                    if game.rnd() < dt * 0.5:
                        game.fx.sparks(t.cx, t.cy, 2)
                if self.state_t <= 0:
                    t.workers = max(0, t.workers - 1)
                    self.state = 'seek'
        else:
            if self.wander_target is None or self.state_t <= 0:
                p = game.world.plot
                self.wander_target = (p['x'] + 2 + game.rnd() * (p['w'] - 4),
                                      p['y'] + 2 + game.rnd() * (p['h'] - 4))
                self.state_t = 5 + game.rnd() * 5
            if self.step_toward(self.wander_target[0], self.wander_target[1], dt, game, 0.6):
                self.idle()
            if self.state_t <= 0:
                self.state = 'seek'

        self.morale = clamp(self.morale - dt * 0.002 +
                            (dt * 0.004 if game.services.get('breakroom') else 0), 0.2, 1.0)

    def pick_job(self, game):
        best, best_score = None, -1
        for e in game.factory.ents:
            score = -1
            if self.role == 'mechanic':
                if e.broken:
                    score = 100
                elif e.condition < 0.75:
                    score = (1 - e.condition) * 40
            elif self.role == 'logistics':
                if e.kind in ('store', 'dock'):
                    score = 12
                elif e.kind == 'machine' and e.total_out() > 10:
                    score = 18
            elif self.role == 'researcher':
                if e.kind == 'lab':
                    score = 40
            elif self.role in ('engineer', 'technician'):
                if e.kind == 'machine' and e.active:
                    score = 20 - e.workers * 6
            else:
                if e.kind in ('machine', 'miner') and not e.broken:
                    score = 15 - e.workers * 5
            if score <= 0:
                continue
            score -= dist(self.x, self.y, e.cx, e.cy) * 0.25
            if score > best_score:
                best_score, best = score, e
        return best

    def serialize(self):
        return dict(r=self.role, x=self.x, y=self.y, s=self.seed, n=self.name,
                    sk=self.skill, m=self.morale, st=self.stamina, w=self.wage)


class Townsfolk(Person):
    def __init__(self, x, y, seed, role='civilian', name=None, title=None,
                 lines=None, range_=6, vendor=False, quest_giver=False):
        super().__init__(role, x, y, seed)
        rnd = Rng(self.seed * 3 + 7)
        self.name = name or random_name(rnd)
        self.home = (x, y)
        self.range = range_
        self.title = title
        self.vendor = vendor
        self.quest_giver = quest_giver
        self.lines = lines or [
            'The old foundry closed last winter. Plenty of hands looking for work.',
            'Hear the port pays well for finished goods.',
            'Careful in the mine - the deep seams flood after rain.',
            'Redhaven grows every year. Somebody has to build the machines.',
        ]
        self._line = 0

    def update(self, dt, game):
        self.state_t -= dt
        if self.state_t <= 0 or self.wander_target is None:
            self.wander_target = (self.home[0] + (game.rnd() - 0.5) * self.range * 2,
                                  self.home[1] + (game.rnd() - 0.5) * self.range * 2)
            self.state_t = 4 + game.rnd() * 6
        if self.step_toward(self.wander_target[0], self.wander_target[1], dt, game, 0.55):
            self.idle()

    def speak(self):
        line = self.lines[self._line % len(self.lines)]
        self._line += 1
        return line
