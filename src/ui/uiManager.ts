import { CARS, getCarDef } from '../data/cars';
import { getUpgrade, UPGRADES } from '../data/upgrades';
import { REGIONS, TRACKS, eventsForTrack, getTrack, tracksForRegion } from '../data/regions';
import type { CareerEventDef, TireType, UpgradeSlot } from '../data/types';
import { computeEffectiveStats, newOwnedCar, upgradeCost, type OwnedCarState } from '../entities/car';
import type { GameState } from '../core/gameState';
import { reputationRank } from '../core/gameState';
import { computeRaceEconomy } from '../systems/economy';
import { ACTION_LABELS, type ActionId, type Controls } from '../input/controls';
import { saveGame } from '../core/saveSystem';

const TIRE_LABELS: Record<TireType, string> = {
  normal: 'Normal', racing: 'Corrida', chuva: 'Chuva', offroad: 'Off-road',
};
const TIRE_COST = 300;

const EVENT_LABELS: Record<string, string> = {
  circuito: 'Circuito', contrarrelogio: 'Contra o Relógio', melhor_volta: 'Melhor Volta',
  drift: 'Drift', sprint: 'Sprint', eliminacao: 'Eliminação', destruicao: 'Destruição', duelo_rival: 'Duelo de Rival',
};
const WEATHER_LABELS: Record<string, string> = { sunny: 'Ensolarado', cloudy: 'Nublado', rain: 'Chuva', storm: 'Tempestade' };
const TIME_LABELS: Record<string, string> = { day: 'Dia', evening: 'Entardecer', night: 'Noite' };
const DIFF_LABELS: Record<string, string> = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil', profissional: 'Profissional' };

export interface StartRaceRequest {
  trackId: string;
  laps: number;
  difficulty: 'facil' | 'normal' | 'dificil';
  eventDifficulty: 'facil' | 'normal' | 'dificil' | 'profissional';
  weather: 'sunny' | 'cloudy' | 'rain' | 'storm';
  time: 'day' | 'evening' | 'night';
  eventType: CareerEventDef['eventType'];
  eventId?: string;
}

export class UIManager {
  private selectedGarageCarId: string;

  constructor(
    private state: GameState,
    private controls: Controls,
    private onStartRace: (req: StartRaceRequest) => void,
    private onSettingsChanged: () => void,
  ) {
    this.selectedGarageCarId = state.selectedCarId;
    this.wireNav();
    this.renderMenuHeader();
    this.wireQuickRace();
    this.renderCareer();
    this.renderGarage();
    this.renderMap();
    this.wireSettings();
  }

  private byId<T extends HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
  }

  showScreen(id: string): void {
    document.querySelectorAll<HTMLElement>('.screen').forEach((el) => {
      if (el.id === 'screen-' + id) el.classList.remove('hidden');
      else if (el.classList.contains('screen') && !el.classList.contains('overlay')) el.classList.add('hidden');
    });
  }

  private wireNav(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.showScreen(btn.dataset.nav!);
        if (btn.dataset.nav === 'garagem') this.renderGarage();
        if (btn.dataset.nav === 'carreira') this.renderCareer();
        if (btn.dataset.nav === 'mapa') this.renderMap();
      });
    });
    document.querySelectorAll<HTMLButtonElement>('[data-back]').forEach((btn) => {
      btn.addEventListener('click', () => this.showScreen(btn.dataset.back!));
    });
  }

  renderMenuHeader(): void {
    this.byId('menu-money').textContent = formatMoney(this.state.money);
    this.byId('menu-rep').textContent = reputationRank(this.state.reputation);
  }

  // ---------------- Quick Race ----------------
  private wireQuickRace(): void {
    const trackSel = this.byId<HTMLSelectElement>('qr-track');
    trackSel.innerHTML = '';
    for (const t of TRACKS) {
      const opt = document.createElement('option');
      opt.value = t.id;
      const playable = t.id === 'campo-1';
      opt.textContent = t.name + (playable ? '' : ' (Em breve)');
      opt.disabled = !playable;
      if (playable) opt.selected = true;
      trackSel.appendChild(opt);
    }
    this.byId('qr-start').addEventListener('click', () => {
      const laps = parseInt(this.byId<HTMLInputElement>('qr-laps').value, 10) || 3;
      const difficulty = this.byId<HTMLSelectElement>('qr-difficulty').value as any;
      const weather = this.byId<HTMLSelectElement>('qr-weather').value as any;
      const time = this.byId<HTMLSelectElement>('qr-time').value as any;
      this.onStartRace({
        trackId: trackSel.value, laps, difficulty, eventDifficulty: difficulty === 'facil' ? 'facil' : difficulty === 'dificil' ? 'dificil' : 'normal',
        weather, time, eventType: 'circuito',
      });
    });
  }

  // ---------------- Career ----------------
  private activeRegionId = 'interior';

  renderCareer(): void {
    const list = this.byId('career-regions');
    list.innerHTML = '';
    for (const region of REGIONS) {
      const unlocked = this.state.unlockedRegions.includes(region.id);
      const div = document.createElement('div');
      div.className = 'region-item' + (region.id === this.activeRegionId ? ' active' : '') + (!unlocked ? ' locked' : '');
      div.innerHTML = `<div class="region-name">${region.name}</div><div class="region-meta">${unlocked ? region.description : 'Bloqueado — R$ ' + region.unlockCost.toLocaleString('pt-BR')}</div>`;
      div.addEventListener('click', () => {
        if (!unlocked) {
          if (this.state.money >= region.unlockCost && window.confirm(`Desbloquear ${region.name} por R$ ${region.unlockCost.toLocaleString('pt-BR')}?`)) {
            this.state.money -= region.unlockCost;
            this.state.unlockedRegions.push(region.id);
            saveGame(this.state);
            this.renderMenuHeader();
            this.renderCareer();
          } else if (this.state.money < region.unlockCost) {
            window.alert('Dinheiro insuficiente para desbloquear esta região.');
          }
          return;
        }
        this.activeRegionId = region.id;
        this.renderCareer();
      });
      list.appendChild(div);
    }

    const events = this.byId('career-events');
    events.innerHTML = '';
    const tracks = tracksForRegion(this.activeRegionId);
    let any = false;
    for (const track of tracks) {
      for (const ev of eventsForTrack(track.id)) {
        any = true;
        const economy = computeRaceEconomy(ev.difficulty, ev.weather, ev.time, track.terrain);
        const progress = this.state.eventProgress[ev.id];
        const stars = progress?.stars ?? 0;
        const playable = track.id === 'campo-1';
        const card = document.createElement('div');
        card.className = 'event-card';
        card.innerHTML = `
          <div class="event-info">
            <div class="event-title">${track.name} — ${EVENT_LABELS[ev.eventType]}</div>
            <div class="event-meta">${DIFF_LABELS[ev.difficulty]} · ${WEATHER_LABELS[ev.weather]} · ${TIME_LABELS[ev.time]} · ${ev.laps} volta(s)${playable ? '' : ' · Em breve'}</div>
          </div>
          <div class="stars">${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</div>
          <div class="event-money">Entrada R$ ${economy.entryFee.toLocaleString('pt-BR')}<br/>Prêmio R$ ${economy.reward1st.toLocaleString('pt-BR')}</div>
        `;
        const btn = document.createElement('button');
        btn.className = 'menu-btn';
        btn.textContent = 'Correr';
        btn.disabled = !playable;
        btn.addEventListener('click', () => {
          if (this.state.money < economy.entryFee) {
            window.alert('Dinheiro insuficiente para a taxa de inscrição.');
            return;
          }
          this.state.money -= economy.entryFee;
          saveGame(this.state);
          this.onStartRace({
            trackId: track.id, laps: ev.laps, difficulty: 'normal', eventDifficulty: ev.difficulty,
            weather: ev.weather, time: ev.time, eventType: ev.eventType, eventId: ev.id,
          });
        });
        card.appendChild(btn);
        events.appendChild(card);
      }
    }
    if (!any) events.innerHTML = '<p class="hint">Nenhum evento disponível nesta região ainda.</p>';
  }

  // ---------------- Garage ----------------
  renderGarage(): void {
    this.byId('garage-money').textContent = formatMoney(this.state.money);
    const list = this.byId('garage-carlist');
    list.innerHTML = '';
    for (const def of CARS) {
      const owned = this.state.ownedCars.find((c) => c.carId === def.id);
      if (def.special && !owned) continue; // special cars only show once unlocked
      const div = document.createElement('div');
      div.className = 'car-item' + (owned ? ' owned' : '') + (def.id === this.selectedGarageCarId ? ' selected' : '');
      div.innerHTML = `<span>${def.name}</span><span>${owned ? (def.id === this.state.selectedCarId ? 'Em uso' : 'Na garagem') : 'R$ ' + def.price.toLocaleString('pt-BR')}</span>`;
      div.addEventListener('click', () => {
        this.selectedGarageCarId = def.id;
        this.renderGarage();
      });
      list.appendChild(div);
    }

    const detail = this.byId('garage-detail');
    const def = getCarDef(this.selectedGarageCarId);
    const owned = this.state.ownedCars.find((c) => c.carId === def.id);
    detail.innerHTML = '';

    const title = document.createElement('h3');
    title.textContent = `${def.name} — ${def.category}`;
    detail.appendChild(title);

    if (!owned) {
      const buyBtn = document.createElement('button');
      buyBtn.className = 'menu-btn';
      buyBtn.textContent = `Comprar por R$ ${def.price.toLocaleString('pt-BR')}`;
      buyBtn.disabled = this.state.money < def.price;
      buyBtn.addEventListener('click', () => {
        this.state.money -= def.price;
        this.state.ownedCars.push(newOwnedCar(def.id));
        saveGame(this.state);
        this.renderMenuHeader();
        this.renderGarage();
      });
      detail.appendChild(this.statsBlock(def, undefined));
      detail.appendChild(buyBtn);
      return;
    }

    detail.appendChild(this.statsBlock(def, owned));

    const selectBtn = document.createElement('button');
    selectBtn.className = 'menu-btn';
    selectBtn.textContent = def.id === this.state.selectedCarId ? 'Carro Selecionado' : 'Selecionar Este Carro';
    selectBtn.disabled = def.id === this.state.selectedCarId;
    selectBtn.addEventListener('click', () => {
      this.state.selectedCarId = def.id;
      saveGame(this.state);
      this.renderGarage();
    });
    detail.appendChild(selectBtn);

    const condRow = document.createElement('p');
    condRow.textContent = `Condição: ${Math.round(owned.condition)}% · Combustível cheio ao iniciar corridas`;
    detail.appendChild(condRow);

    const repairCost = Math.round((100 - owned.condition) * 15);
    const repairBtn = document.createElement('button');
    repairBtn.className = 'menu-btn';
    repairBtn.textContent = owned.condition >= 100 ? 'Carro em Perfeito Estado' : `Reparar por R$ ${repairCost.toLocaleString('pt-BR')}`;
    repairBtn.disabled = owned.condition >= 100 || this.state.money < repairCost;
    repairBtn.addEventListener('click', () => {
      this.state.money -= repairCost;
      owned.condition = 100;
      saveGame(this.state);
      this.renderMenuHeader();
      this.renderGarage();
    });
    detail.appendChild(repairBtn);

    const tireLabel = document.createElement('h3');
    tireLabel.textContent = 'Pneus';
    detail.appendChild(tireLabel);
    const tireSelect = document.createElement('select');
    for (const t of Object.keys(TIRE_LABELS) as TireType[]) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = TIRE_LABELS[t];
      if (owned.tireType === t) opt.selected = true;
      tireSelect.appendChild(opt);
    }
    const tireBtn = document.createElement('button');
    tireBtn.className = 'menu-btn';
    tireBtn.textContent = `Trocar Pneus (R$ ${TIRE_COST})`;
    tireBtn.addEventListener('click', () => {
      if (this.state.money < TIRE_COST) { window.alert('Dinheiro insuficiente.'); return; }
      this.state.money -= TIRE_COST;
      owned.tireType = tireSelect.value as TireType;
      saveGame(this.state);
      this.renderMenuHeader();
      this.renderGarage();
    });
    detail.appendChild(tireSelect);
    detail.appendChild(tireBtn);

    const upgradesTitle = document.createElement('h3');
    upgradesTitle.textContent = 'Upgrades';
    detail.appendChild(upgradesTitle);
    for (const upg of UPGRADES) {
      const level = owned.upgrades[upg.slot] ?? 0;
      const cost = upgradeCost(owned, upg.slot);
      const row = document.createElement('div');
      row.className = 'upgrade-row';
      row.innerHTML = `<span class="upgrade-name">${upg.name}</span><span class="upgrade-level">Nível ${level}/${upg.levels.length}</span>`;
      const btn = document.createElement('button');
      btn.className = 'menu-btn';
      if (cost === null) {
        btn.textContent = 'Nível Máximo';
        btn.disabled = true;
      } else {
        btn.textContent = `Melhorar (R$ ${cost.toLocaleString('pt-BR')})`;
        btn.disabled = this.state.money < cost;
        btn.addEventListener('click', () => {
          this.state.money -= cost;
          owned.upgrades[upg.slot] = level + 1;
          saveGame(this.state);
          this.renderMenuHeader();
          this.renderGarage();
        });
      }
      row.appendChild(btn);
      detail.appendChild(row);
    }
  }

  private statsBlock(def: typeof CARS[number], owned?: OwnedCarState): HTMLElement {
    const stats = computeEffectiveStats(def, owned ?? newOwnedCar(def.id));
    const container = document.createElement('div');
    container.className = 'car-stats';
    const rows: [string, number, number][] = [
      ['Velocidade Máx.', stats.topSpeed, 320],
      ['Aceleração', stats.acceleration, 100],
      ['Frenagem', stats.braking, 100],
      ['Aderência', stats.grip, 100],
      ['Manuseio', stats.handling, 100],
      ['Peso', 2000 - stats.weight, 1200],
    ];
    for (const [name, value, max] of rows) {
      const bar = document.createElement('div');
      bar.className = 'stat-bar';
      const pct = Math.max(3, Math.min(100, (value / max) * 100));
      bar.innerHTML = `<span class="stat-name">${name}</span><span class="stat-track"><span class="stat-fill" style="width:${pct}%"></span></span>`;
      container.appendChild(bar);
    }
    return container;
  }

  // ---------------- Map ----------------
  renderMap(): void {
    const wrap = this.byId('mapa-wrap');
    wrap.innerHTML = '';
    REGIONS.forEach((region, i) => {
      const unlocked = this.state.unlockedRegions.includes(region.id);
      const node = document.createElement('div');
      node.className = 'region-node ' + (unlocked ? 'unlocked' : 'locked');
      node.textContent = region.name;
      const col = i % 5;
      const row = Math.floor(i / 5);
      node.style.left = 40 + col * 150 + 'px';
      node.style.top = 40 + row * 110 + 'px';
      node.addEventListener('click', () => {
        this.showScreen('carreira');
        this.activeRegionId = region.id;
        this.renderCareer();
      });
      wrap.appendChild(node);
    });
  }

  // ---------------- Settings ----------------
  private wireSettings(): void {
    const s = this.state.settings;
    const bind = (id: string, get: () => any, set: (v: any) => void, isCheckbox = false) => {
      const el = this.byId<HTMLInputElement>(id);
      if (isCheckbox) el.checked = get(); else el.value = String(get());
      el.addEventListener('input', () => {
        set(isCheckbox ? el.checked : (el.type === 'range' ? Number(el.value) : el.value));
        saveGame(this.state);
        this.onSettingsChanged();
      });
    };
    bind('opt-vol-master', () => s.volMaster, (v) => (s.volMaster = v));
    bind('opt-vol-music', () => s.volMusic, (v) => (s.volMusic = v));
    bind('opt-vol-sfx', () => s.volSfx, (v) => (s.volSfx = v));
    bind('opt-vol-engine', () => s.volEngine, (v) => (s.volEngine = v));
    bind('opt-vol-ambient', () => s.volAmbient, (v) => (s.volAmbient = v));
    bind('opt-vol-ui', () => s.volUi, (v) => (s.volUi = v));
    bind('opt-music-on', () => s.musicOn, (v) => (s.musicOn = v), true);
    bind('opt-sfx-on', () => s.sfxOn, (v) => (s.sfxOn = v), true);
    bind('opt-vsync', () => s.vsync, (v) => (s.vsync = v), true);
    bind('opt-resolution', () => s.resolution, (v) => (s.resolution = v));
    bind('opt-vibration', () => s.vibration, (v) => (s.vibration = v), true);
    bind('opt-minimap', () => s.showMinimap, (v) => (s.showMinimap = v), true);
    bind('opt-speed', () => s.showSpeed, (v) => (s.showSpeed = v), true);
    bind('opt-damage', () => s.showDamage, (v) => (s.showDamage = v), true);
    bind('opt-fuel', () => s.showFuel, (v) => (s.showFuel = v), true);
    bind('opt-assist', () => s.drivingAssist, (v) => (s.drivingAssist = v), true);

    const fsBox = this.byId<HTMLInputElement>('opt-fullscreen');
    fsBox.checked = s.fullscreen;
    fsBox.addEventListener('change', () => {
      s.fullscreen = fsBox.checked;
      saveGame(this.state);
      if (s.fullscreen) document.documentElement.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.().catch(() => {});
    });

    this.renderControlsList();
  }

  renderControlsList(): void {
    const list = this.byId('controls-list');
    list.innerHTML = '';
    (Object.keys(ACTION_LABELS) as ActionId[]).forEach((action) => {
      const row = document.createElement('div');
      row.className = 'control-row';
      const keySpan = document.createElement('span');
      keySpan.className = 'control-key';
      keySpan.textContent = this.controls.keyLabel(this.controls.bindings[action]);
      const label = document.createElement('span');
      label.textContent = ACTION_LABELS[action];
      row.appendChild(label);
      row.appendChild(keySpan);
      keySpan.addEventListener('click', () => {
        const overlay = this.byId('remap-overlay');
        overlay.classList.remove('hidden');
        this.byId('remap-target').textContent = ACTION_LABELS[action];
        this.controls.beginRemap(action, (result) => {
          overlay.classList.add('hidden');
          if (result === 'ok') {
            this.state.controlBindings = { ...this.controls.bindings };
            saveGame(this.state);
            this.renderControlsList();
          }
        });
      });
      list.appendChild(row);
    });
    this.byId('remap-cancel').onclick = () => {
      this.controls.cancelRemap();
      this.byId('remap-overlay').classList.add('hidden');
    };
  }
}

export function formatMoney(v: number): string {
  return 'R$ ' + Math.round(v).toLocaleString('pt-BR');
}

export { getTrack };
