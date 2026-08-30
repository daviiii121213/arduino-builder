import type { Settings } from '../core/gameState';

/** All sound is synthesized in real time via the WebAudio API — no external
 * audio files are used. Engine tone tracks RPM/speed; SFX are short
 * generated bursts (noise, sweeps, tones). */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private engineBusGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private uiGain: GainNode | null = null;
  private started = false;
  settings: Settings;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.masterGain);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);
      this.engineBusGain = this.ctx.createGain();
      this.engineBusGain.connect(this.masterGain);
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.connect(this.masterGain);
      this.uiGain = this.ctx.createGain();
      this.uiGain.connect(this.masterGain);
    }
    return this.ctx;
  }

  /** Must be called from a user gesture (click) to unlock audio in browsers. */
  unlock(): void {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
    if (!this.ctx) return;
    const m = settings.musicOn ? settings.volMaster / 100 : 0;
    this.masterGain!.gain.value = settings.volMaster / 100;
    this.musicGain!.gain.value = settings.musicOn ? settings.volMusic / 100 : 0;
    this.sfxGain!.gain.value = settings.sfxOn ? settings.volSfx / 100 : 0;
    this.engineBusGain!.gain.value = settings.sfxOn ? settings.volEngine / 100 : 0;
    this.ambientGain!.gain.value = settings.sfxOn ? settings.volAmbient / 100 : 0;
    this.uiGain!.gain.value = settings.volUi / 100;
    void m;
  }

  startEngine(): void {
    const ctx = this.ensureContext();
    if (this.started) return;
    this.started = true;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0001;
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.engineBusGain ?? ctx.destination);
    this.engineOsc.frequency.value = 60;
    this.engineOsc.start();
    this.applySettings(this.settings);
  }

  stopEngine(): void {
    if (!this.started) return;
    this.engineOsc?.stop();
    this.engineOsc = null;
    this.started = false;
  }

  /** Updates the synthesized engine tone. speedRatio 0..1 of top speed. */
  updateEngine(speedRatio: number, throttle: number, nitro: boolean): void {
    if (!this.engineOsc || !this.engineGain || !this.ctx) return;
    const freq = 55 + speedRatio * 260 + (nitro ? 60 : 0);
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    const gain = 0.05 + throttle * 0.12 + speedRatio * 0.05;
    this.engineGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.08);
  }

  private burstNoise(duration: number, destination: GainNode, gainValue: number): void {
    const ctx = this.ensureContext();
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(gain);
    gain.connect(destination);
    src.start();
  }

  playCollision(intensity: number): void {
    if (!this.sfxGain) return;
    this.burstNoise(0.25, this.sfxGain, Math.min(1, 0.3 + intensity * 0.05));
  }

  playTireScreech(): void {
    if (!this.sfxGain || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 900;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    osc.stop(this.ctx.currentTime + 0.32);
  }

  playNitro(): void {
    if (!this.sfxGain || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    const gain = this.ctx.createGain();
    gain.gain.value = 0.001;
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.4);
    gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.42);
  }

  playHorn(): void {
    if (!this.sfxGain || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = 320;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.12;
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  playUiClick(): void {
    if (!this.uiGain || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 720;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(this.uiGain);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
    osc.stop(this.ctx.currentTime + 0.09);
  }

  playCountdownBeep(final: boolean): void {
    if (!this.sfxGain || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = final ? 880 : 520;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.stop(this.ctx.currentTime + 0.26);
  }
}
