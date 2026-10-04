/**
 * All sounds are synthesised at runtime with the Web Audio API (no audio files).
 * The context is created on the first user gesture, as browsers require.
 */
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
    this.engine = null;
  }

  start() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);

    // Short slap-back echo gives gunshots an urban "street canyon" feel.
    this.echoIn = ctx.createGain();
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.13;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const echoFilter = ctx.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.value = 1800;
    this.echoIn.connect(delay).connect(echoFilter).connect(fb).connect(delay);
    echoFilter.connect(this.master);

    this.noise = this.makeNoise(2, 'white');
    this.brown = this.makeNoise(4, 'brown');
    this.startAmbience();
  }

  get ready() {
    return !!this.ctx;
  }

  makeNoise(seconds, kind) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  setListener(x, y, z, yaw) {
    Object.assign(this.listener, { x, y, z, yaw });
  }

  /** Gain/pan for a world position relative to the listener. */
  spatial(pos, refDist = 6, maxDist = 120) {
    if (!pos) return { gain: 1, pan: 0 };
    const dx = pos.x - this.listener.x;
    const dz = pos.z - this.listener.z;
    const dist = Math.hypot(dx, dz, pos.y - this.listener.y);
    const gain = dist < refDist ? 1 : Math.max(0, (refDist / dist) * (1 - dist / maxDist));
    // Listener right vector for yaw (facing (sin yaw, cos yaw)) is (-cos yaw, sin yaw).
    const right = (-Math.cos(this.listener.yaw) * dx + Math.sin(this.listener.yaw) * dz) / Math.max(dist, 0.001);
    return { gain, pan: Math.max(-1, Math.min(1, right * 0.8)) };
  }

  output(gainValue, pan, echo = 0) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = gainValue;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    g.connect(p).connect(this.master);
    if (echo > 0) {
      const e = ctx.createGain();
      e.gain.value = echo;
      g.connect(e).connect(this.echoIn);
    }
    return g;
  }

  noiseBurst(dest, { t = 0, dur = 0.1, type = 'bandpass', freq = 1000, q = 1, gain = 1, attack = 0.002, freqEnd = null, buffer = this.noise }) {
    const ctx = this.ctx;
    const start = ctx.currentTime + t;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, start);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, start + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(start, Math.random() * Math.max(0, buffer.duration - dur - 0.1));
    src.stop(start + dur + 0.05);
  }

  tone(dest, { t = 0, dur = 0.1, type = 'sine', freq = 440, freqEnd = null, gain = 0.5, attack = 0.003 }) {
    const ctx = this.ctx;
    const start = ctx.currentTime + t;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(dest);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  /** Plays a named one-shot. `pos` (optional) enables distance attenuation and panning. */
  play(name, pos = null, volume = 1) {
    if (!this.ctx) return;
    const sp = this.spatial(pos);
    if (sp.gain < 0.01) return;
    const fn = SOUNDS[name];
    if (fn) fn(this, sp.gain * volume, sp.pan);
  }

  // ------------------------------------------------------------ engine

  setEngine(active, rpm = 0, throttle = 0, skid = 0) {
    if (!this.ctx) return;
    if (!this.engine && active) this.createEngine();
    if (!this.engine) return;
    const e = this.engine;
    const now = this.ctx.currentTime;
    const base = 32 + rpm * 120;
    e.o1.frequency.setTargetAtTime(base, now, 0.05);
    e.o2.frequency.setTargetAtTime(base * 0.5, now, 0.05);
    e.o3.frequency.setTargetAtTime(base * 2.01, now, 0.05);
    e.filter.frequency.setTargetAtTime(380 + throttle * 1500 + rpm * 600, now, 0.08);
    e.gain.gain.setTargetAtTime(active ? 0.1 + throttle * 0.1 + rpm * 0.05 : 0, now, active ? 0.1 : 0.3);
    e.skid.gain.setTargetAtTime(active ? Math.min(skid, 1) * 0.16 : 0, now, 0.06);
  }

  createEngine() {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.master);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 3;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 2.5);
    }
    shaper.curve = curve;
    const mk = (type, g) => {
      const o = ctx.createOscillator();
      o.type = type;
      const gn = ctx.createGain();
      gn.gain.value = g;
      o.connect(gn).connect(shaper);
      o.start();
      return o;
    };
    const o1 = mk('sawtooth', 0.5);
    const o2 = mk('square', 0.35);
    const o3 = mk('triangle', 0.15);
    shaper.connect(filter).connect(out);
    // Tyre squeal: band-passed noise, gain driven by lateral slip.
    const skidSrc = ctx.createBufferSource();
    skidSrc.buffer = this.noise;
    skidSrc.loop = true;
    const skidFilter = ctx.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.value = 1300;
    skidFilter.Q.value = 6;
    const skid = ctx.createGain();
    skid.gain.value = 0;
    skidSrc.connect(skidFilter).connect(skid).connect(this.master);
    skidSrc.start();
    this.engine = { o1, o2, o3, filter, gain: out, skid };
  }

  /** Low hum of nearby traffic; `proximity` 0 (none) .. 1 (right next to the listener). */
  setTrafficHum(proximity, speed01) {
    if (!this.ctx) return;
    if (!this.hum) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 300;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(f).connect(g).connect(this.master);
      o.start();
      const n = ctx.createBufferSource();
      n.buffer = this.brown;
      n.loop = true;
      const ng = ctx.createGain();
      ng.gain.value = 0;
      n.connect(ng).connect(this.master);
      n.start();
      this.hum = { o, g, ng };
    }
    const now = this.ctx.currentTime;
    this.hum.o.frequency.setTargetAtTime(38 + speed01 * 45, now, 0.2);
    this.hum.g.gain.setTargetAtTime(proximity * 0.05, now, 0.2);
    this.hum.ng.gain.setTargetAtTime(proximity * 0.18, now, 0.2);
  }

  // ------------------------------------------------------------ ambience

  startAmbience() {
    const ctx = this.ctx;
    // Distant traffic rumble.
    const rumble = ctx.createBufferSource();
    rumble.buffer = this.brown;
    rumble.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.value = 0.22;
    rumble.connect(lp).connect(g).connect(this.master);
    rumble.start();
    // Soft wind/air layer.
    const air = ctx.createBufferSource();
    air.buffer = this.noise;
    air.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 0.4;
    const ag = ctx.createGain();
    ag.gain.value = 0.012;
    air.connect(bp).connect(ag).connect(this.master);
    air.start();
    this.ambientTimer = 2;
  }

  updateAmbience(dt) {
    if (!this.ctx) return;
    this.ambientTimer -= dt;
    if (this.ambientTimer > 0) return;
    this.ambientTimer = 2 + Math.random() * 6;
    const r = Math.random();
    const pan = Math.random() * 1.6 - 0.8;
    if (r < 0.45) SOUNDS.bird(this, 0.5, pan);
    else if (r < 0.85) SOUNDS.distantCar(this, 0.6, pan);
    else SOUNDS.distantHorn(this, 0.35, pan);
  }
}

/** One-shot sound recipes: (audio, gain, pan) => void */
const SOUNDS = {
  pistolShot(a, gain, pan) {
    const out = a.output(gain * 0.9, pan, 0.35);
    a.noiseBurst(out, { dur: 0.16, type: 'lowpass', freq: 5200, freqEnd: 900, gain: 1, attack: 0.001 });
    a.noiseBurst(out, { dur: 0.05, type: 'highpass', freq: 2500, gain: 0.5, attack: 0.0005 });
    a.tone(out, { dur: 0.12, freq: 160, freqEnd: 45, gain: 0.9, attack: 0.001 });
  },
  rifleShot(a, gain, pan) {
    const out = a.output(gain * 0.85, pan, 0.4);
    a.noiseBurst(out, { dur: 0.22, type: 'lowpass', freq: 3800, freqEnd: 500, gain: 1, attack: 0.001 });
    a.noiseBurst(out, { dur: 0.04, type: 'bandpass', freq: 3000, q: 0.8, gain: 0.7, attack: 0.0005 });
    a.tone(out, { dur: 0.16, freq: 110, freqEnd: 38, gain: 1, attack: 0.001 });
  },
  emptyClick(a, gain, pan) {
    const out = a.output(gain * 0.5, pan);
    a.noiseBurst(out, { dur: 0.025, type: 'highpass', freq: 3500, gain: 0.8 });
    a.tone(out, { dur: 0.03, type: 'square', freq: 1800, freqEnd: 900, gain: 0.08 });
  },
  reloadOut(a, gain, pan) {
    const out = a.output(gain * 0.5, pan);
    a.noiseBurst(out, { dur: 0.05, type: 'bandpass', freq: 2200, q: 2, gain: 0.8 });
    a.tone(out, { dur: 0.06, type: 'triangle', freq: 900, freqEnd: 500, gain: 0.15 });
    a.noiseBurst(out, { t: 0.08, dur: 0.12, type: 'bandpass', freq: 600, q: 1, gain: 0.25 });
  },
  reloadIn(a, gain, pan) {
    const out = a.output(gain * 0.55, pan);
    a.noiseBurst(out, { dur: 0.04, type: 'bandpass', freq: 1500, q: 2, gain: 0.9 });
    a.tone(out, { dur: 0.05, type: 'triangle', freq: 700, freqEnd: 400, gain: 0.2 });
    a.noiseBurst(out, { t: 0.18, dur: 0.05, type: 'bandpass', freq: 2600, q: 3, gain: 0.8 });
    a.noiseBurst(out, { t: 0.25, dur: 0.06, type: 'bandpass', freq: 1900, q: 3, gain: 0.7 });
  },
  equip(a, gain, pan) {
    const out = a.output(gain * 0.35, pan);
    a.noiseBurst(out, { dur: 0.12, type: 'bandpass', freq: 900, q: 0.7, gain: 0.5 });
    a.noiseBurst(out, { t: 0.08, dur: 0.04, type: 'bandpass', freq: 2400, q: 3, gain: 0.6 });
  },
  footstep(a, gain, pan) {
    const out = a.output(gain * 0.22, pan);
    a.noiseBurst(out, { dur: 0.09, type: 'lowpass', freq: 700 + Math.random() * 400, gain: 0.8, attack: 0.004 });
    a.noiseBurst(out, { t: 0.01, dur: 0.04, type: 'bandpass', freq: 2500 + Math.random() * 1500, q: 1.5, gain: 0.15 });
  },
  jump(a, gain, pan) {
    const out = a.output(gain * 0.15, pan);
    a.noiseBurst(out, { dur: 0.18, type: 'bandpass', freq: 500, freqEnd: 1200, q: 0.8, gain: 0.6, attack: 0.03 });
  },
  land(a, gain, pan) {
    const out = a.output(gain * 0.35, pan);
    a.noiseBurst(out, { dur: 0.14, type: 'lowpass', freq: 500, gain: 1, attack: 0.003 });
    a.tone(out, { dur: 0.1, freq: 90, freqEnd: 50, gain: 0.4 });
  },
  impact(a, gain, pan) {
    const out = a.output(gain * 0.35, pan);
    a.noiseBurst(out, { dur: 0.07, type: 'bandpass', freq: 1800 + Math.random() * 1500, q: 1.2, gain: 0.8 });
    if (Math.random() < 0.25) a.tone(out, { t: 0.01, dur: 0.18, type: 'sine', freq: 2600 + Math.random() * 1200, freqEnd: 1700, gain: 0.07 });
  },
  hitBody(a, gain, pan) {
    const out = a.output(gain * 0.45, pan);
    a.noiseBurst(out, { dur: 0.08, type: 'lowpass', freq: 600, gain: 1 });
    a.tone(out, { dur: 0.08, freq: 140, freqEnd: 70, gain: 0.35 });
  },
  hitMarker(a, gain) {
    const out = a.output(gain * 0.12, 0);
    a.tone(out, { dur: 0.05, type: 'triangle', freq: 1500, gain: 0.5 });
  },
  doorOpen(a, gain, pan) {
    const out = a.output(gain * 0.5, pan);
    a.noiseBurst(out, { dur: 0.06, type: 'bandpass', freq: 1400, q: 2, gain: 0.7 });
    a.noiseBurst(out, { t: 0.05, dur: 0.2, type: 'bandpass', freq: 500, q: 0.8, gain: 0.25 });
  },
  doorClose(a, gain, pan) {
    const out = a.output(gain * 0.6, pan);
    a.noiseBurst(out, { dur: 0.12, type: 'lowpass', freq: 400, gain: 1 });
    a.tone(out, { dur: 0.12, freq: 110, freqEnd: 60, gain: 0.5 });
  },
  engineStart(a, gain, pan) {
    const out = a.output(gain * 0.4, pan);
    for (let i = 0; i < 5; i++) a.noiseBurst(out, { t: i * 0.07, dur: 0.06, type: 'lowpass', freq: 500, gain: 0.6 });
    a.tone(out, { t: 0.32, dur: 0.4, type: 'sawtooth', freq: 40, freqEnd: 70, gain: 0.25 });
  },
  carCrash(a, gain, pan) {
    const out = a.output(gain * 0.8, pan, 0.2);
    a.noiseBurst(out, { dur: 0.35, type: 'lowpass', freq: 1800, freqEnd: 300, gain: 1, attack: 0.002 });
    a.tone(out, { dur: 0.25, freq: 80, freqEnd: 35, gain: 0.8 });
    a.noiseBurst(out, { t: 0.04, dur: 0.25, type: 'bandpass', freq: 3200, q: 2, gain: 0.3 });
  },
  switchClick(a, gain, pan) {
    const out = a.output(gain * 0.3, pan);
    a.noiseBurst(out, { dur: 0.03, type: 'bandpass', freq: 3000, q: 3, gain: 0.8 });
  },
  doorCreak(a, gain, pan) {
    const out = a.output(gain * 0.35, pan);
    a.noiseBurst(out, { dur: 0.05, type: 'bandpass', freq: 1800, q: 2, gain: 0.6 });
    a.tone(out, { t: 0.03, dur: 0.35, type: 'sawtooth', freq: 180, freqEnd: 140, gain: 0.05, attack: 0.05 });
    a.noiseBurst(out, { t: 0.05, dur: 0.3, type: 'bandpass', freq: 500, q: 1, gain: 0.2, attack: 0.05 });
  },
  gateRoll(a, gain, pan) {
    const out = a.output(gain * 0.4, pan, 0.2);
    for (let i = 0; i < 10; i++) a.noiseBurst(out, { t: i * 0.11, dur: 0.08, type: 'bandpass', freq: 900 + Math.random() * 400, q: 3, gain: 0.5 });
    a.noiseBurst(out, { dur: 1.2, type: 'lowpass', freq: 300, gain: 0.4, attack: 0.1, buffer: a.brown });
  },
  horn(a, gain, pan) {
    const out = a.output(gain * 0.3, pan, 0.15);
    const g = (f) => a.tone(out, { dur: 0.45, type: 'square', freq: f, gain: 0.35, attack: 0.01 });
    g(415);
    g(523);
  },
  yelp(a, gain, pan) {
    // Short non-verbal shout: a vowel-like formant sweep.
    const out = a.output(gain * 0.22, pan);
    const base = 260 + Math.random() * 180;
    a.tone(out, { dur: 0.32, type: 'sawtooth', freq: base * 1.3, freqEnd: base * 0.9, gain: 0.25, attack: 0.01 });
    a.noiseBurst(out, { dur: 0.3, type: 'bandpass', freq: 900 + Math.random() * 300, q: 6, gain: 0.5, attack: 0.02 });
  },
  chatter(a, gain, pan) {
    // Murmur: a few soft formant blips, like distant indistinct talk.
    const out = a.output(gain * 0.08, pan);
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const f = 500 + Math.random() * 900;
      a.noiseBurst(out, { t: i * 0.14 + Math.random() * 0.05, dur: 0.1, type: 'bandpass', freq: f, q: 5, gain: 0.7, attack: 0.02 });
    }
  },
  bird(a, gain, pan) {
    const out = a.output(gain * 0.05, pan);
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2600 + Math.random() * 1600;
    for (let i = 0; i < n; i++) {
      a.tone(out, { t: i * 0.13, dur: 0.08, type: 'sine', freq: base, freqEnd: base * (1.2 + Math.random() * 0.4), gain: 0.6, attack: 0.01 });
    }
  },
  distantCar(a, gain, pan) {
    const out = a.output(gain * 0.12, pan);
    a.noiseBurst(out, { dur: 2.6, type: 'bandpass', freq: 250, freqEnd: 180, q: 1.2, gain: 0.8, attack: 1.2, buffer: a.brown });
  },
  distantHorn(a, gain, pan) {
    const out = a.output(gain * 0.03, pan);
    a.tone(out, { dur: 0.35, type: 'square', freq: 392, gain: 0.5, attack: 0.02 });
    a.tone(out, { dur: 0.35, type: 'square', freq: 494, gain: 0.4, attack: 0.02 });
  },
};
