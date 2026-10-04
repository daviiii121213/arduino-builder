/**
 * Minimal in-game overlay: crosshair, weapon/ammo panel, interaction prompt,
 * speedometer and a short controls reminder. Text is in Brazilian Portuguese.
 */
export class HUD {
  constructor(root) {
    this.root = root;
    root.innerHTML = `
      <div id="crosshair" class="hidden"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><b class="dot"></b></div>
      <div id="hitmarker"></div>
      <div id="prompt" class="hidden"></div>
      <div id="clock"></div>
      <div id="weapon-panel">
        <div class="slots">
          <div class="slot" data-slot="pistol"><span class="key">1</span>Pistola</div>
          <div class="slot" data-slot="rifle"><span class="key">2</span>Fuzil</div>
        </div>
        <div class="ammo hidden"><span class="weapon-name"></span><span class="mag"></span><span class="reserve"></span></div>
        <div class="reloading hidden">Recarregando…</div>
      </div>
      <div id="speedometer" class="hidden"><span class="value">0</span><span class="unit">km/h</span></div>
      <div id="help">
        <div><b>WASD</b> mover · <b>Shift</b> correr · <b>Espaço</b> pular</div>
        <div><b>1</b> pistola · <b>2</b> fuzil · <b>Botão esq.</b> atirar · <b>Botão dir.</b> mirar · <b>R</b> recarregar</div>
        <div><b>F</b> entrar, sair ou roubar um carro · no carro: <b>W/S</b> acelerar/frear-ré · <b>A/D</b> direção · <b>Espaço</b> freio de mão · <b>H</b> buzina · <b>L</b> faróis</div>
      </div>`;
    this.el = {
      crosshair: root.querySelector('#crosshair'),
      hitmarker: root.querySelector('#hitmarker'),
      prompt: root.querySelector('#prompt'),
      slots: [...root.querySelectorAll('.slot')],
      ammo: root.querySelector('.ammo'),
      weaponName: root.querySelector('.weapon-name'),
      mag: root.querySelector('.mag'),
      reserve: root.querySelector('.reserve'),
      reloading: root.querySelector('.reloading'),
      speedometer: root.querySelector('#speedometer'),
      speed: root.querySelector('#speedometer .value'),
      help: root.querySelector('#help'),
      clock: root.querySelector('#clock'),
    };
    this.hitTimer = 0;
    this.helpTimer = 20;
    this.last = {};
  }

  set(key, value, apply) {
    if (this.last[key] === value) return;
    this.last[key] = value;
    apply(value);
  }

  showHit(kill = false, headshot = false) {
    this.hitTimer = headshot ? 0.3 : 0.18;
    this.el.hitmarker.classList.toggle('kill', kill);
    this.el.hitmarker.classList.toggle('head', headshot);
    this.el.hitmarker.classList.add('show');
  }

  update(dt, s) {
    const e = this.el;
    this.set('crosshair', s.armed && !s.driving, (v) => e.crosshair.classList.toggle('hidden', !v));
    // Crosshair gap reflects the current weapon spread.
    const gap = Math.round(4 + s.spread * 520);
    this.set('gap', gap, (v) => e.crosshair.style.setProperty('--gap', `${v}px`));
    this.set('aiming', s.aiming, (v) => e.crosshair.classList.toggle('aiming', v));

    this.set('weapon', s.weaponId ?? 'none', (id) => {
      e.slots.forEach((el) => el.classList.toggle('active', el.dataset.slot === id));
      e.ammo.classList.toggle('hidden', id === 'none');
    });
    this.set('panelHidden', s.driving, (v) => this.root.querySelector('#weapon-panel').classList.toggle('hidden', v));
    if (s.weaponId) {
      this.set('name', s.weaponName, (v) => (e.weaponName.textContent = v));
      this.set('mag', s.ammo, (v) => {
        e.mag.textContent = v;
        e.mag.classList.toggle('low', v <= Math.ceil(s.magazineSize * 0.25));
      });
      this.set('reserve', s.reserve, (v) => (e.reserve.textContent = `/ ${v}`));
    }
    this.set('reloading', !!s.reloading, (v) => e.reloading.classList.toggle('hidden', !v));
    this.set('prompt', s.prompt ?? '', (v) => {
      e.prompt.textContent = v;
      e.prompt.classList.toggle('hidden', !v);
    });
    this.set('speedo', s.driving, (v) => e.speedometer.classList.toggle('hidden', !v));
    if (s.driving) this.set('speed', Math.round(Math.abs(s.speed) * 3.6), (v) => (e.speed.textContent = v));

    this.set('clock', s.weather ? `${s.clock} · ${s.weather}` : s.clock, (v) => (e.clock.textContent = v));
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) e.hitmarker.classList.remove('show');
    }
    if (this.helpTimer > 0) {
      this.helpTimer -= dt;
      if (this.helpTimer <= 0) e.help.classList.add('faded');
    }
  }
}
