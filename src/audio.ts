/**
 * All sound is synthesised on the fly with WebAudio — engine note, nitro roar,
 * impacts and menu blips — so the game ships without a single audio file.
 */

export interface SoundSettings {
  /** 0..1 */
  master: number;
  sfx: number;
  engine: number;
  muted: boolean;
}

export const DEFAULT_SOUND: SoundSettings = { master: 0.7, sfx: 0.8, engine: 0.5, muted: false };

export class Audio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSub: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private nitroGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private settings: SoundSettings = { ...DEFAULT_SOUND };
  private started = false;

  /** Must run inside a user gesture; browsers block audio before that. */
  start(): void {
    if (this.started) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.started = true;
    const ctx = new Ctor();
    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.connect(ctx.destination);
    this.sfxGain = ctx.createGain();
    this.sfxGain.connect(this.masterGain);
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineGain.connect(this.masterGain);

    // Engine: a saw plus a sub an octave down, through a moving lowpass.
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 900;
    this.engineFilter.connect(this.engineGain);
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 70;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc.start();
    this.engineSub = ctx.createOscillator();
    this.engineSub.type = 'square';
    this.engineSub.frequency.value = 35;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.35;
    this.engineSub.connect(subGain).connect(this.engineFilter);
    this.engineSub.start();

    // Nitro: filtered noise, opened up while the bottle is burning.
    const length = Math.floor(ctx.sampleRate);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;

    const nitroSource = ctx.createBufferSource();
    nitroSource.buffer = buffer;
    nitroSource.loop = true;
    const nitroFilter = ctx.createBiquadFilter();
    nitroFilter.type = 'bandpass';
    nitroFilter.frequency.value = 1400;
    nitroFilter.Q.value = 0.9;
    this.nitroGain = ctx.createGain();
    this.nitroGain.gain.value = 0;
    nitroSource.connect(nitroFilter).connect(this.nitroGain).connect(this.masterGain);
    nitroSource.start();

    this.apply(this.settings);
  }

  apply(settings: SoundSettings): void {
    this.settings = settings;
    if (!this.masterGain || !this.sfxGain) return;
    this.masterGain.gain.value = settings.muted ? 0 : settings.master;
    this.sfxGain.gain.value = settings.sfx;
  }

  private get on(): boolean {
    return this.ctx !== null && !this.settings.muted && this.settings.master > 0;
  }

  /**
   * Engine note follows the revs, not road speed, so every gear change is
   * audible: the note climbs through a gear, drops on the shift, climbs again.
   * `load` opens the filter when the driver is on the throttle.
   */
  updateEngine(rpm: number, load: number, nitro: boolean): void {
    if (!this.ctx || !this.engineOsc || !this.engineFilter || !this.engineGain || !this.engineSub) return;
    const t = this.ctx.currentTime;
    const rev = 58 + rpm * 250 + (nitro ? 26 : 0);
    // Revs move faster than the car does, so track them with a short constant.
    this.engineOsc.frequency.setTargetAtTime(rev, t, 0.035);
    this.engineSub.frequency.setTargetAtTime(rev / 2, t, 0.035);
    this.engineFilter.frequency.setTargetAtTime(500 + rpm * 2400 + load * 500, t, 0.05);
    const level = this.settings.muted ? 0 : this.settings.engine * (0.06 + rpm * 0.13);
    this.engineGain.gain.setTargetAtTime(level, t, 0.06);
    if (this.nitroGain) {
      this.nitroGain.gain.setTargetAtTime(
        nitro && !this.settings.muted ? this.settings.sfx * 0.12 : 0,
        t,
        0.05,
      );
    }
  }

  /** Silences the engine (menus, results). */
  idleEngine(): void {
    if (!this.ctx || !this.engineGain || !this.nitroGain) return;
    this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    this.nitroGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  private tone(freq: number, duration: number, type: OscillatorType, gain: number): void {
    if (!this.on || !this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(env).connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  move(): void {
    this.tone(520, 0.06, 'square', 0.12);
  }

  confirm(): void {
    this.tone(660, 0.07, 'square', 0.16);
    window.setTimeout(() => this.tone(880, 0.09, 'square', 0.14), 60);
  }

  back(): void {
    this.tone(300, 0.09, 'square', 0.12);
  }

  /** Dull thud whose weight scales with the impact. */
  impact(strength: number): void {
    if (!this.on || !this.ctx || !this.sfxGain || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300 + strength * 500;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(Math.min(0.35, 0.08 + strength * 0.3), t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    src.connect(filter).connect(env).connect(this.sfxGain);
    src.start(t);
    src.stop(t + 0.25);
  }

  /**
   * The box swapping ratios: a bright mechanical click over a low thump, both
   * very short, so it lands inside the dip in the engine note.
   */
  gearShift(up: boolean): void {
    if (!this.on || !this.ctx || !this.sfxGain || !this.noise) return;
    const t = this.ctx.currentTime;

    const click = this.ctx.createBufferSource();
    click.buffer = this.noise;
    click.playbackRate.value = up ? 1.35 : 1.05;
    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = up ? 1500 : 1150;
    band.Q.value = 5;
    const clickEnv = this.ctx.createGain();
    clickEnv.gain.setValueAtTime(0.16, t);
    clickEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    click.connect(band).connect(clickEnv).connect(this.sfxGain);
    click.start(t);
    click.stop(t + 0.09);

    const thump = this.ctx.createOscillator();
    const thumpEnv = this.ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(up ? 150 : 120, t);
    thump.frequency.exponentialRampToValueAtTime(70, t + 0.09);
    thumpEnv.gain.setValueAtTime(0.14, t);
    thumpEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    thump.connect(thumpEnv).connect(this.sfxGain);
    thump.start(t);
    thump.stop(t + 0.13);
  }

  /** Three rising notes when the player takes the flag. */
  fanfare(): void {
    [523, 659, 784, 1046].forEach((f, i) => {
      window.setTimeout(() => this.tone(f, 0.18, 'square', 0.14), i * 110);
    });
  }
}
