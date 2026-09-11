"""Save / load to a JSON file next to the game."""
import json
import os

SAVE_PATH = os.path.join(os.path.expanduser('~'), '.ironworks_save.json')
VERSION = 1


def save_game(game, path=SAVE_PATH):
    try:
        data = dict(
            v=VERSION,
            money=game.money, time=game.time['t'], day=game.time['day'],
            expansions=game.expansions,
            player=game.player.serialize(),
            factory=game.factory.serialize(),
            floors=['%d,%d' % k for k in game.floors],
            research=game.research.serialize(),
            missions=game.missions.serialize(),
            employees=game.employees.serialize(),
            market=dict(price=game.market.price),
            contracts=dict(active=game.contracts.active, offers=game.contracts.offers,
                           completed=game.contracts.completed),
            plot=game.world.plot,
            nodes=[['%d,%d' % k, n.amount] for k, n in game.world.nodes.items()],
            stats=game.stats,
        )
        with open(path, 'w') as fh:
            json.dump(data, fh)
        return True
    except Exception as err:                                   # pragma: no cover
        print('save failed:', err)
        return False


def has_save(path=SAVE_PATH):
    return os.path.exists(path)


def load_game(game, path=SAVE_PATH):
    try:
        with open(path) as fh:
            d = json.load(fh)
        game.money = d['money']
        game.time['t'] = d['time']
        game.time['day'] = d['day']
        game.expansions = d.get('expansions', 0)
        game.player.deserialize(d['player'])
        game.research.deserialize(d['research'])
        game.floors = {tuple(int(v) for v in k.split(',')): True for k in d.get('floors', [])}
        game.factory.deserialize(d['factory'])
        game.missions.deserialize(d['missions'])
        game.employees.deserialize(d['employees'])
        if d.get('market'):
            game.market.price.update(d['market']['price'])
        if d.get('contracts'):
            game.contracts.active = d['contracts'].get('active', [])
            game.contracts.offers = d['contracts'].get('offers', [])
            game.contracts.completed = d['contracts'].get('completed', 0)
        if d.get('plot'):
            game.world.plot.update(d['plot'])
        for key, amount in d.get('nodes', []):
            k = tuple(int(v) for v in key.split(','))
            n = game.world.nodes.get(k)
            if n:
                n.amount = amount
            elif amount <= 0:
                game.world.nodes.pop(k, None)
        if d.get('stats'):
            game.stats.update(d['stats'])
        game.factory.dirty_power = True
        return True
    except Exception as err:                                   # pragma: no cover
        print('load failed:', err)
        return False


def clear_save(path=SAVE_PATH):
    try:
        os.remove(path)
    except OSError:
        pass
