// Save / load to localStorage, with a versioned envelope.

const KEY = 'ironworks_save_v1';

export function saveGame(game) {
  try {
    const data = {
      v: 1, when: Date.now(),
      money: game.money, time: game.time.t, day: game.time.day,
      player: game.player.serialize(),
      factory: game.factory.serialize(),
      floors: [...game.floors.keys()],
      research: game.research.serialize(),
      missions: game.missions.serialize(),
      employees: game.employees.serialize(),
      market: { price: game.market.price },
      contracts: { active: game.contracts.active, offers: game.contracts.offers, completed: game.contracts.completed },
      plot: game.world.plot, expansions: game.expansions,
      nodes: [...game.world.nodes.entries()].map(([k, n]) => [k, n.amount]),
      stats: game.stats,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('save failed', err);
    return false;
  }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function loadGame(game) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    game.money = d.money;
    game.time.t = d.time; game.time.day = d.day;
    game.player.deserialize(d.player);
    game.research.deserialize(d.research);
    game.floors = new Map((d.floors || []).map((k) => [k, true]));
    game.factory.deserialize(d.factory);
    game.missions.deserialize(d.missions);
    game.employees.deserialize(d.employees);
    if (d.market) Object.assign(game.market.price, d.market.price);
    if (d.contracts) {
      game.contracts.active = d.contracts.active || [];
      game.contracts.offers = d.contracts.offers || [];
      game.contracts.completed = d.contracts.completed || 0;
    }
    if (d.plot) Object.assign(game.world.plot, d.plot);
    game.expansions = d.expansions || 0;
    for (const [k, amount] of d.nodes || []) {
      const n = game.world.nodes.get(k);
      if (n) n.amount = amount; else if (amount <= 0) game.world.nodes.delete(k);
    }
    if (d.stats) Object.assign(game.stats, d.stats);
    game.factory.dirtyPower = true;
    return true;
  } catch (err) {
    console.error('load failed', err);
    return false;
  }
}

export function clearSave() { try { localStorage.removeItem(KEY); } catch {} }
