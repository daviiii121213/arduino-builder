"""Research: labs generate points that unlock the tech tree."""
from ..data.research import TECHS, available


class Research:
    def __init__(self, game):
        self.game = game
        self.unlocked = set()
        self.points = 0.0
        self.total_points = 0.0
        self.current = None

    def add_points(self, n):
        self.points += n
        self.total_points += n
        if self.current:
            t = TECHS.get(self.current)
            if t and self.points >= t['cost']:
                self.finish(self.current)

    def can_start(self, tech_id):
        t = TECHS.get(tech_id)
        return bool(t) and tech_id not in self.unlocked and all(r in self.unlocked for r in t['req'])

    def start(self, tech_id):
        if not self.can_start(tech_id):
            return False
        self.current = tech_id
        self.game.notify('Researching %s' % TECHS[tech_id]['name'], 'info')
        return True

    def finish(self, tech_id):
        self.unlocked.add(tech_id)
        self.points = max(0.0, self.points - TECHS[tech_id]['cost'])
        self.current = None
        self.game.notify('Technology unlocked: %s' % TECHS[tech_id]['name'], 'good')
        self.game.audio.play('unlock')
        self.game.player.add_xp(TECHS[tech_id]['cost'] * 0.35)
        self.game.player.add_skill_xp('technology', TECHS[tech_id]['cost'] * 0.25)

    def progress(self):
        if not self.current:
            return 0.0
        return min(1.0, self.points / TECHS[self.current]['cost'])

    def available(self):
        return available(self.unlocked)

    def serialize(self):
        return dict(u=sorted(self.unlocked), p=self.points, c=self.current, t=self.total_points)

    def deserialize(self, s):
        self.unlocked = set(s.get('u', []))
        self.points = s.get('p', 0.0)
        self.current = s.get('c')
        self.total_points = s.get('t', 0.0)
