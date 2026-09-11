"""Dynamic market and bulk contracts.

Prices drift, respond to how much you flood the market with, and slowly recover.
Contracts are fixed-price orders with deadlines.
"""
from ..core.rng import Rng
from ..core.utils import clamp
from ..data.items import ITEMS, item_value
from ..data.recipes import RECIPES

CLIENTS = ['Meridian Freight', 'Kessler Works', 'Redhaven Rail', 'Saltwater Port Authority',
           'Northridge Quarry Co.', 'Union Foundry', 'Pinehollow Timber', 'City of Redhaven',
           'Blackvein Mining', 'Halden Motors']


class Market:
    def __init__(self, game):
        self.game = game
        rnd = Rng(4711)
        self.price = {i: 0.9 + rnd() * 0.25 for i in ITEMS}
        self.trend = {i: (rnd() - 0.5) * 0.02 for i in ITEMS}
        self.history = {i: [] for i in ITEMS}
        self.t = 0.0
        self.day_revenue = 0.0
        self.day_costs = 0.0

    def unit(self, item_id):
        return item_value(item_id) * self.price.get(item_id, 1.0)

    def buy_price(self, item_id):
        return self.unit(item_id) * 1.35

    def sell_price(self, item_id):
        mgr = 1.06 if self.game.services.get('office') else 1.0
        skill = 1 + self.game.player.skills['management']['level'] * 0.018
        return self.unit(item_id) * mgr * skill

    def sell(self, item_id, n):
        revenue = self.sell_price(item_id) * n
        self.game.money += revenue
        self.day_revenue += revenue
        self.price[item_id] = clamp(self.price[item_id] - n * 0.0016, 0.35, 2.6)
        return revenue

    def buy(self, item_id, n):
        cost = self.buy_price(item_id) * n
        if self.game.money < cost:
            return 0.0
        self.game.money -= cost
        self.day_costs += cost
        self.price[item_id] = clamp(self.price[item_id] + n * 0.0009, 0.35, 2.6)
        return cost

    def update(self, dt):
        self.t += dt
        if self.t < 1.0:
            return
        self.t = 0.0
        rnd = self.game.rnd
        for item_id in self.price:
            self.trend[item_id] = clamp(self.trend[item_id] + (rnd() - 0.5) * 0.006, -0.02, 0.02)
            self.price[item_id] = clamp(
                self.price[item_id] + self.trend[item_id] + (1 - self.price[item_id]) * 0.012,
                0.35, 2.6)
            h = self.history[item_id]
            h.append(self.price[item_id])
            if len(h) > 60:
                h.pop(0)


class Contracts:
    def __init__(self, game):
        self.game = game
        self.offers = []
        self.active = []
        self.completed = 0
        self.refresh_t = 0.0
        self.rnd = Rng(99)
        for _ in range(3):
            self.generate()

    def candidate_items(self):
        known = {'iron_plate', 'copper_plate', 'gear', 'wire', 'stone', 'wood', 'coal', 'iron_ore'}
        for r in RECIPES.values():
            if r['tech'] and r['tech'] not in self.game.research.unlocked:
                continue
            known.update(r['out'].keys())
        return sorted(i for i in known if i in ITEMS)

    def generate(self):
        pool = self.candidate_items()
        item_id = self.rnd.pick(pool)
        base = item_value(item_id)
        qty = max(5, int((260 + self.rnd() * 900) / max(3, base) *
                         (1 + self.game.player.level * 0.09)))
        pay = int(base * qty * (1.45 + self.rnd() * 0.5))
        time_limit = int(180 + qty * 2.2 + self.rnd() * 240)
        self.offers.append(dict(
            id='c%d' % int(self.rnd() * 1e9), client=self.rnd.pick(CLIENTS),
            item=item_id, qty=qty, pay=pay, time=time_limit, delivered=0,
            xp=int(pay * 0.05), deadline=time_limit))
        if len(self.offers) > 4:
            self.offers.pop(0)

    def accept(self, offer):
        if offer not in self.offers:
            return
        self.offers.remove(offer)
        offer['deadline'] = offer['time']
        self.active.append(offer)
        self.game.notify('Contract accepted: %dx %s' %
                         (offer['qty'], ITEMS[offer['item']]['name']), 'good')

    def deliver(self, contract, amount):
        got = min(amount, contract['qty'] - contract['delivered'])
        contract['delivered'] += got
        if contract['delivered'] >= contract['qty']:
            self.complete(contract)
        return got

    def complete(self, c):
        if c in self.active:
            self.active.remove(c)
        self.game.money += c['pay']
        self.game.player.add_xp(c['xp'])
        self.game.player.add_skill_xp('management', c['xp'] * 0.4)
        self.completed += 1
        self.game.notify('Contract complete - %s paid $%d' % (c['client'], c['pay']), 'good')
        self.game.audio.play('cash')

    def fail(self, c):
        if c in self.active:
            self.active.remove(c)
        penalty = int(c['pay'] * 0.15)
        self.game.money -= penalty
        self.game.notify('Contract failed - %s charged $%d' % (c['client'], penalty), 'bad')

    def update(self, dt):
        self.refresh_t += dt
        if self.refresh_t > 75:
            self.refresh_t = 0.0
            self.generate()
        for c in list(self.active):
            c['deadline'] -= dt
            if c['deadline'] <= 0:
                self.fail(c)
        # docks deliver against active contracts automatically
        for c in list(self.active):
            for e in self.game.factory.ents:
                if e.kind != 'dock':
                    continue
                have = e.out_buf.get(c['item'], 0)
                if have > 0:
                    n = self.deliver(c, have)
                    e.out_buf[c['item']] -= n
                    if e.out_buf[c['item']] <= 0:
                        del e.out_buf[c['item']]
