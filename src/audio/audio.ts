/**
 * Áudio procedural — nenhum arquivo de som é usado.
 * Os efeitos são sintetizados com osciladores e ruído na Web Audio API.
 */

export class Audio {
  private ctx: AudioContext | null = null;
  private mestre: GainNode | null = null;
  ligado = true;
  volume = 0.35;

  /** Precisa ser chamado a partir de um gesto do usuário. */
  iniciar(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    type JanelaComAudio = Window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as JanelaComAudio).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.mestre = this.ctx.createGain();
    this.mestre.gain.value = this.volume;
    this.mestre.connect(this.ctx.destination);
  }

  alternar(): boolean {
    this.ligado = !this.ligado;
    if (this.mestre) this.mestre.gain.value = this.ligado ? this.volume : 0;
    return this.ligado;
  }

  private get pronto(): boolean {
    return !!this.ctx && !!this.mestre && this.ligado;
  }

  private tom(
    tipo: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    vol: number,
    atraso = 0,
  ): void {
    if (!this.pronto) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + atraso;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.mestre!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private ruido(dur: number, vol: number, corte: number, tipo: BiquadFilterType = 'bandpass'): void {
    if (!this.pronto) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const amostras = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, amostras, ctx.sampleRate);
    const dados = buffer.getChannelData(0);
    for (let i = 0; i < amostras; i++) {
      dados[i] = (Math.random() * 2 - 1) * (1 - i / amostras);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filtro = ctx.createBiquadFilter();
    filtro.type = tipo;
    filtro.frequency.value = corte;
    filtro.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filtro).connect(g).connect(this.mestre!);
    src.start(t);
  }

  golpe(): void {
    this.ruido(0.16, 0.22, 1500, 'bandpass');
    this.tom('triangle', 420, 180, 0.12, 0.06);
  }

  acerto(): void {
    this.tom('square', 620, 180, 0.1, 0.12);
    this.ruido(0.1, 0.18, 900, 'lowpass');
  }

  dano(): void {
    this.tom('sawtooth', 260, 80, 0.28, 0.16);
    this.ruido(0.2, 0.14, 500, 'lowpass');
  }

  morte(): void {
    this.tom('sawtooth', 200, 50, 0.6, 0.14);
    this.tom('square', 140, 40, 0.7, 0.08, 0.05);
  }

  passo(agua = false): void {
    if (agua) this.ruido(0.14, 0.1, 2600, 'bandpass');
    else this.ruido(0.05, 0.05, 1200, 'lowpass');
  }

  curar(): void {
    this.tom('sine', 520, 780, 0.18, 0.1);
    this.tom('sine', 780, 1040, 0.16, 0.06, 0.09);
  }

  magia(): void {
    this.tom('sine', 900, 300, 0.3, 0.09);
    this.tom('triangle', 1400, 600, 0.22, 0.05, 0.02);
  }

  rugido(grave = false): void {
    this.tom('sawtooth', grave ? 110 : 190, grave ? 45 : 80, grave ? 0.75 : 0.5, 0.16);
    this.ruido(0.4, 0.1, 320, 'lowpass');
  }

  menu(): void {
    this.tom('square', 660, 660, 0.05, 0.07);
  }

  confirmar(): void {
    this.tom('square', 520, 880, 0.12, 0.09);
  }

  maquina(): void {
    this.tom('sawtooth', 60, 240, 1.6, 0.08);
    this.tom('sine', 220, 900, 1.8, 0.05, 0.1);
  }

  trovao(): void {
    this.ruido(0.7, 0.28, 220, 'lowpass');
    this.tom('sawtooth', 90, 30, 0.8, 0.12);
  }

  portal(): void {
    this.tom('sine', 300, 1200, 0.5, 0.09);
    this.tom('triangle', 150, 900, 0.6, 0.06, 0.05);
  }

  respingo(): void {
    this.ruido(0.22, 0.14, 2200, 'bandpass');
  }
}
