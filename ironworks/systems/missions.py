"""Story missions plus repeatable objectives.

Progress is polled from live game state rather than pushed, so a mission can
never desync from the factory.
"""
from ..data.buildables import BUILDABLES
from ..data.items import ITEMS
from ..data.research import TECHS

MISSIONS = [
    dict(id='m_intro', name='Fire It Up', req=[],
         text='Your uncle left you this plot and a rusty furnace. Mine some iron ore by hand '
              'and smelt your first plates.',
         goals=[dict(kind='produce', item='iron_plate', count=5)],
         reward=dict(money=400, xp=60, items={'coal': 20})),

    dict(id='m_power', name='Keep the Lights On', req=['m_intro'],
         text='Nothing runs without electricity. Build a coal generator and run cable to your machines.',
         goals=[dict(kind='build', type='coal_gen', count=1), dict(kind='build', type='cable', count=6)],
         reward=dict(money=500, xp=80, items={'coal': 30})),

    dict(id='m_belt', name='Stop Carrying It Yourself', req=['m_power'],
         text='Automate the boring part. Lay conveyor belts and a mining drill so ore walks '
              'itself to the furnace.',
         goals=[dict(kind='build', type='miner', count=1), dict(kind='build', type='belt', count=10)],
         reward=dict(money=700, xp=120)),

    dict(id='m_sell', name='First Payday', req=['m_belt'],
         text='Build a loading dock and ship product. Trucks pay on collection.',
         goals=[dict(kind='build', type='dock', count=1), dict(kind='sell', amount=1200)],
         reward=dict(money=900, xp=150)),

    dict(id='m_lab', name='Learn Something New', req=['m_sell'],
         text='Knowledge compounds faster than steel. Put up a research lab and unlock Steelmaking.',
         goals=[dict(kind='build', type='lab', count=1), dict(kind='tech', id='steelmaking')],
         reward=dict(money=1200, xp=220)),

    dict(id='m_crew', name='Hire a Crew', req=['m_lab'],
         text='You cannot run a factory alone. Hire three workers and build somewhere for them to rest.',
         goals=[dict(kind='hire', count=3), dict(kind='build', type='breakroom', count=1)],
         reward=dict(money=1500, xp=260)),

    dict(id='m_steel', name='Steel City', req=['m_lab'],
         text='Steel is the backbone of everything that follows. Produce 60 steel ingots.',
         goals=[dict(kind='produce', item='steel', count=60)],
         reward=dict(money=2600, xp=400, items={'coal': 60})),

    dict(id='m_assembly', name='Assembly Line', req=['m_steel'],
         text='Stop selling raw stock. Assemble and ship 25 tool kits.',
         goals=[dict(kind='build', type='assembler', count=1),
                dict(kind='produce', item='tool_kit', count=25)],
         reward=dict(money=3200, xp=520)),

    dict(id='m_scale', name='Scale Up', req=['m_assembly'],
         text='A real plant needs real power and real storage. Reach 80 kW of generation and '
              'build a warehouse.',
         goals=[dict(kind='power', amount=80), dict(kind='build', type='warehouse', count=1)],
         reward=dict(money=5000, xp=700)),

    dict(id='m_chem', name='Better Living Through Chemistry', req=['m_scale'],
         text='Unlock Industrial Chemistry and get a chemical plant running.',
         goals=[dict(kind='tech', id='chemistry'), dict(kind='build', type='chemical', count=1)],
         reward=dict(money=6500, xp=900)),

    dict(id='m_electro', name='Silicon and Copper', req=['m_chem'],
         text='The market wants electronics. Produce 40 advanced circuits.',
         goals=[dict(kind='produce', item='adv_circuit', count=40)],
         reward=dict(money=12000, xp=1400)),

    dict(id='m_robot', name='Machines Making Machines', req=['m_electro'],
         text='Unlock Robotics and build a robotic assembler. Let the factory build itself.',
         goals=[dict(kind='tech', id='robotics'), dict(kind='build', type='robotics', count=1)],
         reward=dict(money=25000, xp=2600)),

    dict(id='m_empire', name='Industrial Complex', req=['m_robot'],
         text='One hundred machines, a quarter-million in the bank, and an autonomy core '
              'off the line.',
         goals=[dict(kind='machines', count=100), dict(kind='money', amount=250000),
                dict(kind='produce', item='ai_core', count=1)],
         reward=dict(money=100000, xp=12000)),
]

MISSION_BY_ID = {m['id']: m for m in MISSIONS}


class Missions:
    def __init__(self, game):
        self.game = game
        self.done = set()
        self.counters = dict(produced={}, built={}, revenue=0.0)
        self.tracked = None
        self.t = 0.0
        self.refresh()

    @property
    def active(self):
        return [m for m in MISSIONS
                if m['id'] not in self.done and all(r in self.done for r in m['req'])]

    def refresh(self):
        if not self.tracked or self.tracked in self.done:
            act = self.active
            self.tracked = act[0]['id'] if act else None

    def goal_target(self, goal):
        return goal.get('count', goal.get('amount', 1))

    def goal_progress(self, m, gi):
        g = m['goals'][gi]
        c = self.counters
        kind = g['kind']
        if kind == 'produce':
            return min(g['count'], c['produced'].get(g['item'], 0))
        if kind == 'build':
            return min(g['count'], c['built'].get(g['type'], 0))
        if kind == 'have':
            return min(g['count'], self.game.total_stored(g['item']))
        if kind == 'money':
            return min(g['amount'], self.game.money)
        if kind == 'sell':
            return min(g['amount'], c['revenue'])
        if kind == 'tech':
            return 1 if g['id'] in self.game.research.unlocked else 0
        if kind == 'hire':
            return min(g['count'], len(self.game.employees.list))
        if kind == 'power':
            return min(g['amount'], self.game.factory.stats['power_gen'])
        if kind == 'machines':
            return min(g['count'], sum(1 for e in self.game.factory.ents
                                       if e.kind in ('machine', 'miner')))
        return 0

    def goal_done(self, m, gi):
        return self.goal_progress(m, gi) >= self.goal_target(m['goals'][gi])

    def check(self):
        for m in self.active:
            if all(self.goal_done(m, i) for i in range(len(m['goals']))):
                self.complete(m)

    def complete(self, m):
        if m['id'] in self.done:
            return
        self.done.add(m['id'])
        r = m.get('reward') or {}
        if r.get('money'):
            self.game.money += r['money']
        if r.get('xp'):
            self.game.player.add_xp(r['xp'])
        for item_id, n in (r.get('items') or {}).items():
            self.game.player.give(item_id, n)
        self.game.notify('Mission complete: %s' % m['name'], 'good')
        self.game.audio.play('mission')
        self.game.ui.show_mission_complete(m)
        self.refresh()

    def update(self, dt):
        self.t += dt
        if self.t > 1.0:
            self.t = 0.0
            self.check()

    def goal_text(self, g, prog, target):
        kind = g['kind']
        if kind == 'produce':
            name = 'Produce %s' % ITEMS[g['item']]['name']
        elif kind == 'build':
            name = 'Build %s' % BUILDABLES[g['type']]['name']
        elif kind == 'have':
            name = 'Hold %s' % ITEMS[g['item']]['name']
        elif kind == 'money':
            name = 'Bank capital'
        elif kind == 'sell':
            name = 'Earn from sales'
        elif kind == 'tech':
            return 'Research %s' % TECHS[g['id']]['name']
        elif kind == 'hire':
            name = 'Hire staff'
        elif kind == 'power':
            name = 'Generation capacity'
        elif kind == 'machines':
            name = 'Machines built'
        else:
            name = kind
        from ..core.utils import short_num
        unit = '$' if kind in ('money', 'sell') else ''
        return '%s  %s%s/%s%s' % (name, unit, short_num(prog), unit, short_num(target))

    def serialize(self):
        return dict(d=sorted(self.done), c=self.counters, t=self.tracked)

    def deserialize(self, s):
        self.done = set(s.get('d', []))
        self.counters = s.get('c', self.counters)
        self.counters.setdefault('produced', {})
        self.counters.setdefault('built', {})
        self.counters.setdefault('revenue', 0.0)
        self.tracked = s.get('t')
        self.refresh()
