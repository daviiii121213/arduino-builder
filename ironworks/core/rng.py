"""Deterministic RNG and value noise.

Every sprite is generated from a fixed seed, so a furnace always looks like the
same furnace and the world regenerates identically from the same world seed.
"""
import math


class Rng:
    """Mulberry32 — small, fast, and identical across runs."""

    __slots__ = ('a',)

    def __init__(self, seed=1):
        self.a = seed & 0xFFFFFFFF

    def next(self):
        self.a = (self.a + 0x6D2B79F5) & 0xFFFFFFFF
        t = self.a
        t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
        t ^= (t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0

    __call__ = next

    def rand(self, lo=0.0, hi=1.0):
        return lo + (hi - lo) * self.next()

    def irand(self, lo, hi):
        """Inclusive integer range."""
        return lo + int(self.next() * (hi - lo + 1)) % (hi - lo + 1)

    def chance(self, p):
        return self.next() < p

    def pick(self, seq):
        return seq[int(self.next() * len(seq)) % len(seq)]


def hash_str(s):
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def rng_for(s):
    return Rng(hash_str(s))


class Noise2D:
    """Value noise with smooth interpolation, seeded."""

    def __init__(self, seed=1337):
        rnd = Rng(seed)
        perm = list(range(256))
        for i in range(255, 0, -1):
            j = int(rnd() * (i + 1))
            perm[i], perm[j] = perm[j], perm[i]
        self.p = perm * 2

    def at(self, x, y):
        xi, yi = int(math.floor(x)), int(math.floor(y))
        X, Y = xi & 255, yi & 255
        xf, yf = x - xi, y - yi
        u = xf * xf * (3 - 2 * xf)
        v = yf * yf * (3 - 2 * yf)
        p = self.p
        aa = p[p[X] + Y] / 255.0
        ab = p[p[X] + Y + 1] / 255.0
        ba = p[p[X + 1] + Y] / 255.0
        bb = p[p[X + 1] + Y + 1] / 255.0
        x1 = aa + u * (ba - aa)
        x2 = ab + u * (bb - ab)
        return x1 + v * (x2 - x1)

    def fbm(self, x, y, octaves=4, gain=0.5, lac=2.0):
        amp, freq, total, norm = 1.0, 1.0, 0.0, 0.0
        for _ in range(octaves):
            total += amp * self.at(x * freq, y * freq)
            norm += amp
            amp *= gain
            freq *= lac
        return total / norm
