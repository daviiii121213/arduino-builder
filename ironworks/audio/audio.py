"""Fully synthesised industrial soundscape - no audio files, no numpy.

Every sound is generated into a raw 16-bit buffer with the standard library and
handed to pygame.mixer. An ambience bed reacts to how much machinery is running
and the music gains layers as the factory grows.
"""
import array
import math
import random

import pygame

RATE = 44100
CHANNELS = 2
MAX_AMP = 20000


def _buf(samples):
    """samples: iterable of floats in -1..1 -> interleaved stereo 16-bit bytes."""
    out = array.array('h')
    for v in samples:
        s = int(max(-1.0, min(1.0, v)) * MAX_AMP)
        out.append(s)
        out.append(s)
    return out.tobytes()


def _env(i, n, attack, decay):
    """Simple attack/decay envelope, both in samples."""
    if i < attack:
        return i / max(1, attack)
    left = n - i
    if left < decay:
        return left / max(1, decay)
    return 1.0


class Audio:
    def __init__(self):
        self.enabled = True
        self.started = False
        self.volume = dict(master=0.7, music=0.45, sfx=0.8, amb=0.5)
        self._sfx = {}
        self._notes = {}
        self._amb = {}
        self.tier = 0
        self.music_timer = 0.0
        self.step = 0
        self._amb_level = dict(rumble=0.0, hum=0.0, belt=0.0, wind=0.04)
        self._perc = []

    # ---------------------------------------------------------------- setup
    def init(self):
        if self.started or not self.enabled:
            return
        try:
            pygame.mixer.pre_init(RATE, -16, CHANNELS, 512)
            pygame.mixer.init(RATE, -16, CHANNELS, 512)
            pygame.mixer.set_num_channels(32)
        except pygame.error:
            self.enabled = False
            return
        self.started = True
        self._build_ambience()

    def _snd(self, data):
        return pygame.mixer.Sound(buffer=data)

    # ------------------------------------------------------------- generators
    def _tone(self, freq, dur, wave='sine', attack=0.005, decay=0.08, vol=0.3, detune=0.0):
        n = int(RATE * dur)
        atk, dec = int(RATE * attack), int(RATE * decay)
        phase = 0.0
        step = freq / RATE
        samples = []
        for i in range(n):
            phase += step
            p = phase % 1.0
            if wave == 'sine':
                v = math.sin(p * math.tau)
            elif wave == 'square':
                v = 1.0 if p < 0.5 else -1.0
            elif wave == 'saw':
                v = 2 * p - 1
            else:                       # triangle
                v = 4 * abs(p - 0.5) - 1
            if detune:
                v = (v + math.sin((phase * (1 + detune)) % 1.0 * math.tau)) * 0.5
            samples.append(v * _env(i, n, atk, dec) * vol)
        return samples

    def _noise(self, dur, cutoff=0.35, vol=0.3, attack=0.004, decay=None, highpass=False):
        n = int(RATE * dur)
        dec = int(RATE * (decay if decay is not None else dur * 0.9))
        atk = int(RATE * attack)
        samples = []
        last = 0.0
        prev_in = 0.0
        for i in range(n):
            white = random.random() * 2 - 1
            last += (white - last) * cutoff            # one-pole lowpass
            v = (white - prev_in) if highpass else last
            prev_in = white
            samples.append(v * _env(i, n, atk, dec) * vol)
        return samples

    @staticmethod
    def _mix(*layers):
        out = []
        for i in range(max(len(l) for l in layers)):
            out.append(sum(l[i] for l in layers if i < len(l)))
        return out

    # ------------------------------------------------------------- ambience
    def _loop(self, samples, vol=0.0):
        snd = self._snd(_buf(samples))
        ch = pygame.mixer.find_channel(True)
        ch.play(snd, loops=-1)
        ch.set_volume(vol)
        return dict(snd=snd, ch=ch)

    def _build_ambience(self):
        random.seed(7)
        # low factory rumble
        rumble = self._noise(2.0, cutoff=0.012, vol=0.9, attack=0.2, decay=0.2)
        self._amb['rumble'] = self._loop(rumble)
        # machine hum: detuned saws
        hum = []
        n = int(RATE * 2.0)
        for i in range(n):
            t = i / RATE
            v = (math.sin(math.tau * 55 * t) * 0.5 +
                 math.sin(math.tau * 82.5 * t) * 0.3 +
                 math.sin(math.tau * 110.3 * t) * 0.2)
            hum.append(v * 0.5)
        self._amb['hum'] = self._loop(hum)
        # conveyor rattle: bandpassed noise with a slow tremolo
        belt = self._noise(2.0, cutoff=0.55, vol=0.55, attack=0.1, decay=0.1, highpass=True)
        for i in range(len(belt)):
            belt[i] *= 0.6 + 0.4 * math.sin(math.tau * 7.5 * i / RATE)
        self._amb['belt'] = self._loop(belt)
        # outdoor wind
        wind = self._noise(3.0, cutoff=0.02, vol=0.7, attack=0.3, decay=0.3)
        self._amb['wind'] = self._loop(wind, 0.04)
        # a few pre-baked percussion hits: generating these per beat was the one
        # thing slow enough to show up in the frame time
        self._perc = [self._snd(_buf(self._noise(0.18, 0.7 + i * 0.12, 0.22,
                                                 highpass=True, decay=0.16)))
                      for i in range(3)]
        random.seed()

    def set_ambience(self, active_machines, active_belts, outdoors, dt):
        if not self.started:
            return
        target = dict(
            rumble=min(0.35, active_machines * 0.022),
            hum=min(0.20, active_machines * 0.016),
            belt=min(0.10, active_belts * 0.006),
            wind=0.09 if outdoors else 0.02,
        )
        for key, want in target.items():
            cur = self._amb_level[key]
            cur += (want - cur) * min(1.0, dt * 1.5)
            self._amb_level[key] = cur
            entry = self._amb.get(key)
            if entry:
                entry['ch'].set_volume(cur * self.volume['amb'] * self.volume['master'])

    # ------------------------------------------------------------- one-shots
    def _get(self, name):
        snd = self._sfx.get(name)
        if snd is not None:
            return snd
        s = self._make(name)
        if s is None:
            return None
        snd = self._snd(_buf(s))
        self._sfx[name] = snd
        return snd

    def _make(self, name):
        T, N, M = self._tone, self._noise, self._mix
        if name == 'click':
            return T(880, 0.05, 'square', 0.002, 0.04, 0.25)
        if name == 'click_soft':
            return T(520, 0.07, 'sine', 0.003, 0.06, 0.22)
        if name == 'place':
            return M(N(0.12, 0.25, 0.5), T(160, 0.16, 'sine', 0.004, 0.14, 0.5))
        if name == 'demolish':
            return N(0.35, 0.18, 0.55, decay=0.3)
        if name == 'mine':
            return M(N(0.14, 0.7, 0.45, highpass=True), T(240, 0.12, 'triangle', 0.003, 0.1, 0.35))
        if name == 'chop':
            return N(0.2, 0.45, 0.5, decay=0.18)
        if name == 'hammer':
            return M(N(0.09, 0.9, 0.5, highpass=True), T(320, 0.09, 'square', 0.002, 0.08, 0.3))
        if name == 'repair':
            return T(440, 0.26, 'saw', 0.01, 0.22, 0.22)
        if name == 'cash':
            return M(T(1046, 0.26, 'triangle', 0.005, 0.22, 0.22),
                     [0] * int(RATE * 0.05) + T(1318, 0.24, 'triangle', 0.005, 0.2, 0.2),
                     [0] * int(RATE * 0.10) + T(1568, 0.24, 'triangle', 0.005, 0.2, 0.2))
        if name == 'levelup':
            layers = []
            for i, f in enumerate((523, 659, 784, 1046)):
                layers.append([0] * int(RATE * 0.09 * i) + T(f, 0.3, 'square', 0.01, 0.26, 0.2))
            return M(*layers)
        if name == 'unlock':
            layers = []
            for i, f in enumerate((392, 523, 659)):
                layers.append([0] * int(RATE * 0.12 * i) + T(f, 0.45, 'sine', 0.02, 0.4, 0.24))
            return M(*layers)
        if name == 'mission':
            layers = []
            for i, f in enumerate((659, 784, 988, 1318)):
                layers.append([0] * int(RATE * 0.11 * i) + T(f, 0.35, 'triangle', 0.01, 0.3, 0.22))
            return M(*layers)
        if name == 'alarm':
            layers = []
            for i in range(3):
                off = int(RATE * 0.32 * i)
                layers.append([0] * off + T(660, 0.18, 'square', 0.01, 0.15, 0.2))
                layers.append([0] * (off + int(RATE * 0.11)) + T(520, 0.18, 'square', 0.01, 0.15, 0.2))
            return M(*layers)
        if name == 'error':
            return T(150, 0.16, 'square', 0.005, 0.14, 0.28)
        if name == 'open':
            return M(T(300, 0.14, 'sine', 0.005, 0.12, 0.22), T(600, 0.16, 'sine', 0.01, 0.14, 0.12))
        if name == 'close':
            return T(240, 0.12, 'sine', 0.005, 0.1, 0.2)
        if name == 'steam':
            return N(0.5, 0.8, 0.3, highpass=True, decay=0.4)
        if name == 'engine':
            return T(90, 0.6, 'saw', 0.05, 0.5, 0.2)
        return None

    def play(self, name, volume=1.0):
        if not self.enabled:
            return
        if not self.started:
            self.init()
            if not self.started:
                return
        if name == 'step':                       # cheap variation, generated fresh
            snd = self._snd(_buf(self._noise(0.06, 0.25 + random.random() * 0.2, 0.25)))
        else:
            snd = self._get(name)
        if snd is None:
            return
        ch = pygame.mixer.find_channel(True)
        if ch:
            ch.set_volume(volume * self.volume['sfx'] * self.volume['master'])
            ch.play(snd)

    # ---------------------------------------------------------------- music
    def _note(self, freq, wave, dur, vol):
        key = (round(freq, 1), wave, round(dur, 2), round(vol, 2))
        snd = self._notes.get(key)
        if snd is None:
            snd = self._snd(_buf(self._tone(freq, dur, wave, 0.01, dur * 0.7, vol)))
            if len(self._notes) > 120:
                self._notes.clear()
            self._notes[key] = snd
        return snd

    def update_music(self, dt, tier):
        if not self.started or not self.enabled:
            return
        self.tier = tier
        self.music_timer -= dt
        if self.music_timer > 0:
            return
        bpm = 74 + tier * 5
        beat = 60.0 / bpm
        self.music_timer = beat
        s = self.step % 16
        self.step += 1
        roots = (55.0, 55.0, 73.42, 65.41)
        root = roots[(self.step // 16) % len(roots)]
        scale = (0, 3, 5, 7, 10, 12)
        vol = self.volume['music'] * self.volume['master']

        def play(snd, v):
            ch = pygame.mixer.find_channel(True)
            if ch:
                ch.set_volume(v * vol)
                ch.play(snd)

        if s % 4 == 0:
            play(self._note(root, 'saw', beat * 1.6, 0.45), 0.8)
        if s % 8 == 4 or (tier > 1 and s % 8 == 7):
            play(self._perc[random.randrange(len(self._perc))], 0.5)
        if tier >= 2 and s in (2, 10, 13):
            deg = scale[random.randrange(len(scale))]
            freq = root * 4 * (2 ** (deg / 12.0))
            play(self._note(freq, 'square' if tier >= 3 else 'triangle', beat * 0.8, 0.22), 0.7)
        if tier >= 3 and s == 0:
            # pads are the longest buffers we generate, so keep them bounded and cached
            for mult in (1, 1.5, 2):
                play(self._note(root * 2 * mult, 'sine', min(3.0, beat * 5), 0.12), 0.5)

    def set_volume(self, kind, v):
        self.volume[kind] = max(0.0, min(1.0, v))
        if self.started:
            for key, entry in self._amb.items():
                entry['ch'].set_volume(self._amb_level[key] * self.volume['amb'] * self.volume['master'])
