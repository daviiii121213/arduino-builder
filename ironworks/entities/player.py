"""The player: an engineer who walks the floor, gathers, builds, repairs and levels up."""
import math

import pygame

from ..art.characters import character_sheet, FW, FH
from ..core.utils import clamp, dist

SKILL_IDS = ('engineering', 'production', 'logistics', 'management', 'technology')


class Player:
    def __init__(self, game, x, y):
        self.game = game
        self.x = float(x)
        self.y = float(y)
        self.dir = 2
        self.frame = 0
        self.anim_t = 0.0
        self.moving = False
        self.working = 0.0
        self.speed = 4.2          # tiles / second
        self.radius = 0.3

        self.health = 100.0
        self.max_health = 100.0
        self.stamina = 100.0
        self.max_stamina = 100.0
        self.level = 1
        self.xp = 0.0
        self.xp_next = 120.0
        self.skill_points = 0
        self.skills = {s: dict(level=1, xp=0.0, next=100.0) for s in SKILL_IDS}

        self.inv = {}
        self.inv_slots = 24
        self.sheet = character_sheet('player', 3)
        self.action_cooldown = 0.0

    # ------------------------------------------------------------- inventory
    def inv_count(self, item_id):
        return self.inv.get(item_id, 0)

    def inv_used_slots(self):
        return len(self.inv)

    def inv_capacity(self):
        return self.inv_slots + self.skills['logistics']['level'] * 2

    def give(self, item_id, n=1):
        if n <= 0:
            return 0
        if item_id not in self.inv and self.inv_used_slots() >= self.inv_capacity():
            self.game.notify('Inventory full', 'warn')
            return 0
        self.inv[item_id] = self.inv.get(item_id, 0) + n
        self.game.ui.flash_item(item_id, n)
        return n

    def take(self, item_id, n=1):
        have = self.inv.get(item_id, 0)
        if have < n:
            return False
        if have == n:
            del self.inv[item_id]
        else:
            self.inv[item_id] = have - n
        return True

    # ------------------------------------------------------------ progression
    def add_xp(self, n):
        self.xp += n
        while self.xp >= self.xp_next:
            self.xp -= self.xp_next
            self.level += 1
            self.skill_points += 1
            self.xp_next = round(self.xp_next * 1.28 + 40)
            self.max_health += 6
            self.health = self.max_health
            self.max_stamina += 5
            self.game.notify('Level %d! +1 skill point' % self.level, 'good')
            self.game.audio.play('levelup')

    def add_skill_xp(self, skill, n):
        s = self.skills.get(skill)
        if not s:
            return
        s['xp'] += n
        while s['xp'] >= s['next']:
            s['xp'] -= s['next']
            s['level'] += 1
            s['next'] = round(s['next'] * 1.35 + 30)
            self.game.notify('%s skill up -> %d' % (skill.capitalize(), s['level']), 'good')
        self.add_xp(n * 0.5)

    def spend_skill_point(self, skill):
        if self.skill_points <= 0:
            return False
        self.skill_points -= 1
        self.skills[skill]['level'] += 1
        self.game.audio.play('click')
        return True

    # -------------------------------------------------------------- movement
    def update(self, dt, keys, game):
        mx = my = 0
        if keys[pygame.K_w] or keys[pygame.K_UP]:
            my -= 1
        if keys[pygame.K_s] or keys[pygame.K_DOWN]:
            my += 1
        if keys[pygame.K_a] or keys[pygame.K_LEFT]:
            mx -= 1
        if keys[pygame.K_d] or keys[pygame.K_RIGHT]:
            mx += 1
        sprint = (keys[pygame.K_LSHIFT] or keys[pygame.K_RSHIFT]) and self.stamina > 1
        length = math.hypot(mx, my)
        self.moving = length > 0

        speed = self.speed * (1.7 if (sprint and self.moving) else 1.0)
        tx, ty = int(self.x), int(self.y)
        if (tx, ty) in game.floors:
            speed *= 1.18
        elif game.world.tile(tx, ty) == 5:
            speed *= 1.14
        speed *= 1 + self.skills['logistics']['level'] * 0.012

        if self.moving:
            mx /= length
            my /= length
            if abs(mx) > abs(my):
                self.dir = 1 if mx > 0 else 3
            else:
                self.dir = 2 if my > 0 else 0
            if sprint:
                self.stamina = max(0.0, self.stamina - dt * 14)
            self.move(mx * speed * dt, my * speed * dt, game)
            self.anim_t += dt * (12 if sprint else 8)
            self.frame = 1 + int(self.anim_t) % 5
        else:
            self.frame = 0
            self.anim_t = 0.0

        if not sprint:
            self.stamina = min(self.max_stamina, self.stamina + dt * (4 if self.moving else 9))
        if self.working > 0:
            self.working -= dt
            self.anim_t += dt * 6
            self.frame = 6 + int(self.anim_t * 1.6) % 2
        self.action_cooldown = max(0.0, self.action_cooldown - dt)
        self.health = min(self.max_health, self.health + dt * 0.6)

    def move(self, dx, dy, game):
        if not game.blocked(self.x + dx, self.y, self.radius):
            self.x += dx
        if not game.blocked(self.x, self.y + dy, self.radius):
            self.y += dy
        self.x = clamp(self.x, 1, game.world.W - 1)
        self.y = clamp(self.y, 1, game.world.H - 1)

    def draw(self, target, sx, sy):
        src = pygame.Rect(self.frame * FW, self.dir * FH, FW, FH)
        target.blit(self.sheet['surf'], (int(sx - FW / 2), int(sy - FH + 6)), src)

    # ------------------------------------------------------------ persistence
    def serialize(self):
        return dict(x=self.x, y=self.y, hp=self.health, st=self.stamina, lvl=self.level,
                    xp=self.xp, xp_next=self.xp_next, sp=self.skill_points,
                    skills=self.skills, inv=self.inv)

    def deserialize(self, s):
        self.x, self.y = s['x'], s['y']
        self.health, self.stamina = s['hp'], s['st']
        self.level, self.xp, self.xp_next = s['lvl'], s['xp'], s['xp_next']
        self.skill_points = s.get('sp', 0)
        self.skills = s.get('skills', self.skills)
        self.inv = s.get('inv', {})
