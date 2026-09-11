// Fully synthesised industrial soundscape — no audio files. A layered ambience bed
// reacts to how much machinery is running, and the music shifts as the factory grows.

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.ambGain = null;
    this.started = false;
    this.tier = 0;
    this.musicTimer = 0;
    this.step = 0;
    this.volume = { master: 0.7, music: 0.45, sfx: 0.8, amb: 0.5 };
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.volume.master;
    this.master.connect(this.ctx.destination);
    const mk = (v) => { const g = this.ctx.createGain(); g.gain.value = v; g.connect(this.master); return g; };
    this.musicGain = mk(this.volume.music);
    this.sfxGain = mk(this.volume.sfx);
    this.ambGain = mk(this.volume.amb);
    this.buildAmbience();
    this.started = true;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  /** Brown-ish noise buffer reused by every noisy sound. */
  noiseBuffer(seconds = 2) {
    if (this._noise) return this._noise;
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.2;
    }
    this._noise = buf;
    return buf;
  }

  // ------------------------------------------------------------- ambience bed
  buildAmbience() {
    const ctx = this.ctx;
    // low factory rumble
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(4); src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    this.rumbleGain = ctx.createGain(); this.rumbleGain.gain.value = 0.0;
    src.connect(lp); lp.connect(this.rumbleGain); this.rumbleGain.connect(this.ambGain);
    src.start();

    // machine hum: two detuned saws through a bandpass
    this.humOsc = [];
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 220; bp.Q.value = 2.5;
    for (const f of [55, 82.5, 110]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = 0.18;
      o.connect(g); g.connect(bp); o.start();
      this.humOsc.push(o);
    }
    bp.connect(this.humGain); this.humGain.connect(this.ambGain);

    // conveyor rattle: filtered noise with a slow tremolo
    const rsrc = ctx.createBufferSource(); rsrc.buffer = this.noiseBuffer(3); rsrc.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 1100; hp.Q.value = 0.8;
    this.beltGain = ctx.createGain(); this.beltGain.gain.value = 0;
    const trem = ctx.createOscillator(); trem.type = 'sine'; trem.frequency.value = 7.5;
    const tremGain = ctx.createGain(); tremGain.gain.value = 0.5;
    trem.connect(tremGain); tremGain.connect(this.beltGain.gain); trem.start();
    rsrc.connect(hp); hp.connect(this.beltGain); this.beltGain.connect(this.ambGain);
    rsrc.start();

    // outdoor wind for when you leave the plot
    const wsrc = ctx.createBufferSource(); wsrc.buffer = this.noiseBuffer(5); wsrc.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 520;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0.04;
    wsrc.connect(wf); wf.connect(this.windGain); this.windGain.connect(this.ambGain);
    wsrc.start();
  }

  /** Called each frame with the factory state. */
  setAmbience(activeMachines, activeBelts, outdoors, dt) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const ramp = (param, v) => param.setTargetAtTime(v, t, 0.6);
    ramp(this.rumbleGain.gain, Math.min(0.35, activeMachines * 0.022));
    ramp(this.humGain.gain, Math.min(0.20, activeMachines * 0.016));
    ramp(this.beltGain.gain, Math.min(0.10, activeBelts * 0.006));
    ramp(this.windGain.gain, outdoors ? 0.09 : 0.02);
  }

  // ------------------------------------------------------------- one-shots
  env(gain, a, d, peak = 1) {
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  tone(freq, type, a, d, peak, dest, detune = 0) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    o.connect(g); g.connect(dest || this.sfxGain);
    this.env(g, a, d, peak);
    o.start(); o.stop(this.ctx.currentTime + a + d + 0.05);
    return o;
  }

  noise(dur, filterType, freq, peak, q = 1) {
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuffer();
    const f = this.ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    this.env(g, 0.005, dur, peak);
    src.start(); src.stop(this.ctx.currentTime + dur + 0.1);
    return { src, f, g };
  }

  play(name, opt = {}) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    this.resume();
    const t = this.ctx.currentTime;
    switch (name) {
      case 'click': this.tone(880, 'square', 0.002, 0.05, 0.12); break;
      case 'clickSoft': this.tone(520, 'sine', 0.003, 0.07, 0.10); break;
      case 'place': {
        this.noise(0.12, 'lowpass', 420, 0.45);
        this.tone(160, 'sine', 0.004, 0.16, 0.3);
        break;
      }
      case 'demolish': this.noise(0.35, 'lowpass', 900, 0.5, 0.6); break;
      case 'mine': {
        this.noise(0.14, 'bandpass', 2200, 0.4, 1.6);
        this.tone(220 + Math.random() * 60, 'triangle', 0.003, 0.1, 0.2);
        break;
      }
      case 'chop': this.noise(0.2, 'bandpass', 700, 0.42, 1.2); break;
      case 'hammer': {
        this.noise(0.09, 'highpass', 2600, 0.5);
        this.tone(320, 'square', 0.002, 0.08, 0.18);
        break;
      }
      case 'repair': this.tone(440, 'sawtooth', 0.01, 0.25, 0.12); break;
      case 'cash': {
        [1046, 1318, 1568].forEach((f, i) => setTimeout(() => this.tone(f, 'triangle', 0.005, 0.24, 0.16), i * 55));
        break;
      }
      case 'levelup': {
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 'square', 0.01, 0.3, 0.12), i * 90));
        break;
      }
      case 'unlock': {
        [392, 523, 659].forEach((f, i) => setTimeout(() => this.tone(f, 'sine', 0.02, 0.45, 0.14), i * 120));
        break;
      }
      case 'mission': {
        [659, 784, 988, 1318].forEach((f, i) => setTimeout(() => this.tone(f, 'triangle', 0.01, 0.35, 0.15), i * 110));
        break;
      }
      case 'alarm': {
        for (let i = 0; i < 3; i++) setTimeout(() => {
          this.tone(660, 'square', 0.01, 0.18, 0.12);
          setTimeout(() => this.tone(520, 'square', 0.01, 0.18, 0.12), 110);
        }, i * 320);
        break;
      }
      case 'error': this.tone(150, 'square', 0.005, 0.16, 0.14); break;
      case 'open': this.tone(300, 'sine', 0.005, 0.13, 0.1); this.tone(600, 'sine', 0.01, 0.16, 0.06); break;
      case 'close': this.tone(240, 'sine', 0.005, 0.12, 0.09); break;
      case 'step': this.noise(0.06, 'lowpass', 320 + Math.random() * 120, 0.10); break;
      case 'furnace': this.noise(0.6, 'lowpass', 260, 0.18, 0.5); break;
      case 'steam': this.noise(0.5, 'highpass', 2400, 0.14, 0.5); break;
      case 'engine': this.tone(90, 'sawtooth', 0.05, 0.6, 0.08); break;
      case 'ui': this.tone(700, 'sine', 0.002, 0.04, 0.07); break;
      default: break;
    }
  }

  // ------------------------------------------------------------- music
  /** Sparse industrial sequencer: a pulse bass, metallic hits, and evolving pads. */
  updateMusic(dt, tier) {
    if (!this.started || !this.enabled) return;
    this.tier = tier;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    const bpm = 74 + tier * 5;
    const beat = 60 / bpm;
    this.musicTimer = beat;
    const s = this.step++ % 16;

    const roots = [55, 55, 73.42, 65.41];
    const root = roots[Math.floor(this.step / 16) % roots.length];
    const scale = [0, 3, 5, 7, 10, 12];

    // bass pulse on the downbeats
    if (s % 4 === 0) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320 + tier * 90;
      o.type = 'sawtooth'; o.frequency.value = root;
      o.connect(f); f.connect(g); g.connect(this.musicGain);
      this.env(g, 0.01, beat * 1.6, 0.30);
      o.start(); o.stop(this.ctx.currentTime + beat * 2);
    }
    // metallic percussion
    if (s % 8 === 4 || (tier > 1 && s % 8 === 7)) {
      const n = this.noise(0.18, 'bandpass', 3200 + Math.random() * 900, 0.10, 4);
      n.g.connect(this.musicGain);
    }
    if (tier >= 1 && s % 2 === 0) {
      const n = this.noise(0.05, 'highpass', 6000, 0.03);
    }
    // melodic motif appears as the factory matures
    if (tier >= 2 && (s === 2 || s === 10 || s === 13)) {
      const deg = scale[Math.floor(Math.random() * scale.length)];
      const freq = root * 4 * Math.pow(2, deg / 12);
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = tier >= 3 ? 'square' : 'triangle'; o.frequency.value = freq;
      const dl = this.ctx.createDelay(); dl.delayTime.value = beat * 0.75;
      const fb = this.ctx.createGain(); fb.gain.value = 0.3;
      o.connect(g); g.connect(this.musicGain);
      g.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(this.musicGain);
      this.env(g, 0.01, beat * 0.8, 0.085);
      o.start(); o.stop(this.ctx.currentTime + beat * 1.2);
    }
    // pad swell every bar in the late game
    if (tier >= 3 && s === 0) {
      for (const mult of [1, 1.5, 2]) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'sine'; o.frequency.value = root * 2 * mult;
        o.connect(g); g.connect(this.musicGain);
        this.env(g, 0.8, beat * 7, 0.045);
        o.start(); o.stop(this.ctx.currentTime + beat * 9);
      }
    }
  }

  setVolume(kind, v) {
    this.volume[kind] = v;
    if (!this.started) return;
    ({ master: this.master, music: this.musicGain, sfx: this.sfxGain, amb: this.ambGain })[kind].gain.value = v;
  }
}
