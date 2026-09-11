"""Hiring and payroll. Applicants rotate; hired staff walk the factory floor."""
from ..core.rng import Rng
from ..entities.npc import Employee, ROLE_WAGE, ROLE_INFO, random_name


class Employees:
    def __init__(self, game):
        self.game = game
        self.list = []
        self.applicants = []
        self.rnd = Rng(555)
        self.refresh_t = 0.0
        for _ in range(5):
            self.add_applicant()

    def hire_cost(self, role, skill):
        return int(ROLE_WAGE[role] * 12 * (0.8 + skill * 0.35))

    def add_applicant(self):
        roles = []
        for r in ROLE_WAGE:
            if r == 'researcher' and not self.game.research.unlocked:
                continue
            if r in ('engineer', 'manager') and self.game.player.level < 4:
                continue
            roles.append(r)
        role = self.rnd.pick(roles)
        seed = int(self.rnd() * 1e6)
        skill = 1 + int(self.rnd() * 3)
        self.applicants.append(dict(
            role=role, seed=seed, skill=skill, name=random_name(self.rnd),
            wage=int(ROLE_WAGE[role] * (0.85 + skill * 0.12)),
            cost=self.hire_cost(role, skill), info=ROLE_INFO[role]))
        if len(self.applicants) > 6:
            self.applicants.pop(0)

    def hire(self, app):
        if self.game.money < app['cost']:
            self.game.notify('Not enough money to hire', 'bad')
            return False
        self.game.money -= app['cost']
        p = self.game.world.plot
        e = Employee(app['role'], p['x'] + 3 + self.rnd() * 4, p['y'] + 3 + self.rnd() * 3,
                     app['seed'], app['name'])
        e.skill = app['skill']
        e.wage = app['wage']
        self.list.append(e)
        if app in self.applicants:
            self.applicants.remove(app)
        self.add_applicant()
        self.game.notify('%s hired as %s' % (e.name, ROLE_INFO[app['role']]['name']), 'good')
        self.game.audio.play('cash')
        return True

    def fire(self, emp):
        if emp in self.list:
            self.list.remove(emp)
            if emp.assigned is not None:
                emp.assigned.workers = max(0, emp.assigned.workers - 1)
            self.game.notify('%s has left the company' % emp.name, 'warn')

    def payroll(self):
        return sum(e.wage for e in self.list)

    def update(self, dt, game):
        self.refresh_t += dt
        if self.refresh_t > 90:
            self.refresh_t = 0.0
            self.add_applicant()
        for e in self.list:
            e.update(dt, game)

    def serialize(self):
        return [e.serialize() for e in self.list]

    def deserialize(self, arr):
        self.list = []
        for s in arr or []:
            e = Employee(s['r'], s['x'], s['y'], s['s'], s['n'])
            e.skill = s['sk']
            e.morale = s['m']
            e.stamina = s['st']
            e.wage = s['w']
            self.list.append(e)
