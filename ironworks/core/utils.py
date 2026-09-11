"""Small math / formatting helpers shared by every system."""
import math

TAU = math.pi * 2

# Directions: 0=N 1=E 2=S 3=W
DIRS = [(0, -1), (1, 0), (0, 1), (-1, 0)]
DIR_NAMES = ['N', 'E', 'S', 'W']


def clamp(v, a, b):
    return a if v < a else b if v > b else v


def lerp(a, b, t):
    return a + (b - a) * t


def smooth(t):
    return t * t * (3 - 2 * t)


def sign(v):
    return -1 if v < 0 else (1 if v > 0 else 0)


def dist(ax, ay, bx, by):
    return math.hypot(bx - ax, by - ay)


def dist2(ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    return dx * dx + dy * dy


def approach(cur, target, step):
    if cur < target:
        return min(cur + step, target)
    if cur > target:
        return max(cur - step, target)
    return target


def short_num(n):
    """128000 -> '128.0k' for money and stat readouts."""
    a = abs(n)
    if a >= 1e9:
        return '%.2fB' % (n / 1e9)
    if a >= 1e6:
        return '%.2fM' % (n / 1e6)
    if a >= 1e4:
        return '%.1fk' % (n / 1e3)
    return '%d' % round(n)


def money(n):
    return ('-$' if n < 0 else '$') + short_num(abs(n))


def time_str(sec):
    sec = max(0, sec)
    return '%d:%02d' % (int(sec // 60), int(sec % 60))


def rect_hit(x, y, r):
    return r[0] <= x < r[0] + r[2] and r[1] <= y < r[1] + r[3]


def rotate_footprint(w, h, direction):
    return (w, h) if direction % 2 == 0 else (h, w)
