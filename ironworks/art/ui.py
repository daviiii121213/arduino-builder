"""UI art kit: fonts, riveted panels, machined buttons, gauge bars and drawn
glyph icons. Panels and glyphs are cached, so the HUD costs almost nothing.
"""
import math
import pygame

from ..core.rng import Rng
from ..core.utils import TAU, clamp
from . import draw as D
from . import palette as P
from .palette import mix, shade, rgba

FONT_TITLE = 'serif'
FONT_BODY = 'sans'
FONT_MONO = 'mono'

_FAMILIES = {
    'serif': 'liberationserif,dejavuserif,georgia,times new roman',
    'sans': 'liberationsans,dejavusans,segoeui,arial',
    'mono': 'liberationmono,dejavusansmono,consolas,couriernew',
}

_fonts = {}
_text_cache = {}
_panel_cache = {}
_glyph_cache = {}


def font(family=FONT_BODY, size=14, bold=False):
    key = (family, size, bold)
    f = _fonts.get(key)
    if f is None:
        f = pygame.font.SysFont(_FAMILIES.get(family, _FAMILIES['sans']), size, bold=bold)
        _fonts[key] = f
    return f


def text_surface(text, family=FONT_BODY, color=P.UI_TEXT, size=14, bold=False):
    key = (text, family, size, bold, color)
    s = _text_cache.get(key)
    if s is None:
        s = font(family, size, bold).render(str(text), True, color)
        if len(_text_cache) > 3000:
            _text_cache.clear()
        _text_cache[key] = s
    return s


def text_size(text, family=FONT_BODY, size=14, bold=False):
    return font(family, size, bold).size(str(text))


def engraved(target, text, x, y, family=FONT_BODY, color=P.UI_TEXT, size=14,
             bold=False, align='left'):
    """Text with a hard drop shadow, as if stamped into the panel."""
    sh = text_surface(text, family, (0, 0, 0), size, bold)
    tx = text_surface(text, family, color, size, bold)
    if align == 'center':
        x -= tx.get_width() / 2
    elif align == 'right':
        x -= tx.get_width()
    sh.set_alpha(150)
    target.blit(sh, (int(x), int(y) + 1))
    sh.set_alpha(255)
    target.blit(tx, (int(x), int(y)))
    return tx.get_width()


def wrap_text(target, text, x, y, max_w, line_h=16, size=12, color=P.UI_DIM,
              family=FONT_BODY):
    f = font(family, size)
    words = str(text).split(' ')
    line = ''
    for w in words:
        t = (line + ' ' + w).strip()
        if f.size(t)[0] > max_w and line:
            target.blit(text_surface(line, family, color, size), (int(x), int(y)))
            y += line_h
            line = w
        else:
            line = t
    if line:
        target.blit(text_surface(line, family, color, size), (int(x), int(y)))
        y += line_h
    return y


# ------------------------------------------------------------------ panels

def panel_texture(w, h, variant='main'):
    """Big riveted panel used by every window; cached per size."""
    key = (int(w), int(h), variant)
    hit = _panel_cache.get(key)
    if hit is not None:
        return hit
    w, h = int(w), int(h)
    base = (27, 31, 37) if variant == 'dark' else P.UI_PANEL
    s = D.surf(w, h)
    D.rr(s, (3, 5, w - 6, h - 6), rgba(P.BLACK, 0.55), 8)
    D.plate(s, (0, 0, w - 3, h - 3), base, 8, 1)
    D.brushed(s, (0, 0, w - 3, h - 3), 91, 0.06)
    D.grad_rect(s, (8, 8, w - 19, h - 19),
                [(0.0, shade(base, -0.22)), (1.0, shade(base, -0.08))], radius=6)
    D.rr(s, (8, 8, w - 19, h - 19), rgba(P.BLACK, 0.7), 6, 2)
    D.rr(s, (10, 10, w - 23, h - 23), rgba(P.WHITE, 0.07), 5, 1)
    D.rect(s, rgba(P.UI_TRIM, 0.55), (10, 34, w - 23, 2))
    D.rect(s, rgba(P.UI_TRIM_HI, 0.3), (10, 36, w - 23, 1))
    step = 34
    for x in range(14, w - 12, step):
        D.bolt(s, x, 5.5, 2.2)
        D.bolt(s, x, h - 8.5, 2.2)
    for y in range(14, h - 12, step):
        D.bolt(s, 5.5, y, 2.2)
        D.bolt(s, w - 8.5, y, 2.2)
    for gx, gy, sx, sy in ((0, 0, 1, 1), (w - 3, 0, -1, 1), (0, h - 3, 1, -1), (w - 3, h - 3, -1, -1)):
        D.polygon(s, rgba(P.UI_TRIM, 0.45),
                  [(gx + 2 * sx, gy + 2 * sy), (gx + 20 * sx, gy + 2 * sy), (gx + 2 * sx, gy + 20 * sy)])
    D.noise_overlay(s, 0.022, 12)
    if pygame.display.get_surface():
        s = s.convert_alpha()
    if len(_panel_cache) > 80:
        _panel_cache.clear()
    _panel_cache[key] = s
    return s


def draw_panel(target, x, y, w, h, variant='main'):
    target.blit(panel_texture(w, h, variant), (int(x), int(y)))


def slot(target, x, y, w, h, hover=False, selected=False):
    D.grad_rect(target, (x, y, w, h), [(0.0, (21, 26, 31)), (1.0, (30, 36, 43))], radius=3)
    D.rr(target, (x, y, w, h), rgba(P.BLACK, 0.8), 3, 1)
    D.rr(target, (x + 1.4, y + 1.4, w - 2.8, h - 2.8), rgba(P.WHITE, 0.22 if hover else 0.07), 2, 1)
    if selected:
        D.rr(target, (x, y, w, h), P.UI_TRIM_HI, 3, 2)


def button(target, x, y, w, h, label, hover=False, pressed=False, disabled=False,
           primary=False, danger=False, size=13):
    base = P.RED if danger else (P.UI_TRIM if primary else P.STEEL_LO)
    col = shade(base, -0.42) if disabled else (shade(base, 0.14) if hover else base)
    dy = 1 if pressed else 0
    D.rr(target, (x + 1, y + 3, w, h), rgba(P.BLACK, 0.5), 4)
    D.plate(target, (x, y + dy, w, h), col, 4, 1)
    if not disabled:
        D.rect(target, rgba(P.WHITE, 0.12 if hover else 0.06), (x + 2, y + dy + 2, w - 4, h * 0.42), 0)
    for bx, by in ((x + 4.5, y + dy + 4.5), (x + w - 4.5, y + dy + 4.5),
                   (x + 4.5, y + dy + h - 4.5), (x + w - 4.5, y + dy + h - 4.5)):
        D.bolt(target, bx, by, 1.5)
    if label:
        col_t = P.UI_DIM if disabled else ((29, 22, 8) if primary else P.UI_TEXT)
        engraved(target, label, x + w / 2, y + dy + h / 2 - size / 2 - 1,
                 FONT_BODY, col_t, size, True, 'center')


def tab(target, x, y, w, h, label, active, hover=False):
    base = P.UI_TRIM if active else (50, 57, 67)
    D.rr(target, (x + 1, y + 2, w, h), rgba(P.BLACK, 0.45), 4)
    D.plate(target, (x, y, w, h - (0 if active else 2)),
            shade(base, 0.12) if (hover and not active) else base, 4, 1)
    engraved(target, label, x + w / 2, y + h / 2 - 8, FONT_BODY,
             (29, 22, 8) if active else P.UI_TEXT, 13, True, 'center')
    if active:
        D.rect(target, P.UI_TRIM_HI, (x + 3, y + h - 3, w - 6, 2))


def bar(target, x, y, w, h, frac, color, label=None, label_color=None):
    frac = clamp(frac, 0, 1)
    D.rr(target, (x, y, w, h), (14, 18, 22), int(h / 2))
    D.rr(target, (x, y, w, h), rgba(P.BLACK, 0.85), int(h / 2), 1)
    if frac > 0.01:
        fw = max(2, (w - 3) * frac)
        D.grad_rect(target, (x + 1.5, y + 1.5, fw, h - 3),
                    [(0.0, shade(color, 0.35)), (0.5, color), (1.0, shade(color, -0.3))],
                    radius=int((h - 3) / 2))
        D.rect(target, rgba(P.WHITE, 0.22), (x + 2, y + 2, fw - 1, (h - 3) * 0.34))
    D.rr(target, (x + 1, y + 1, w - 2, h - 2), rgba(P.WHITE, 0.10), int((h - 2) / 2), 1)
    if label:
        col = label_color or ((10, 14, 10) if frac > 0.55 else P.UI_TEXT)
        engraved(target, label, x + w / 2, y + h / 2 - 6, FONT_BODY, col, 10, True, 'center')


def tooltip_box(target, x, y, w, h):
    D.rr(target, (x + 2, y + 3, w, h), rgba(P.BLACK, 0.55), 5)
    D.plate(target, (x, y, w, h), (37, 43, 51), 5, 1)
    D.rr(target, (x + 3, y + 3, w - 6, h - 6), rgba(P.UI_TRIM, 0.55), 3, 1)


def heading(target, text, x, y, w):
    tw = engraved(target, text, x, y, FONT_TITLE, P.UI_TRIM_HI, 16, True)
    D.rect(target, rgba(P.UI_TRIM, 0.35), (x + tw + 10, y + 10, max(0, w - tw - 12), 2))


# ------------------------------------------------------------------ glyphs

def glyph(name, size=20, color=P.UI_TRIM_HI):
    key = (name, size, color)
    hit = _glyph_cache.get(key)
    if hit is not None:
        return hit

    def paint(s, w, h, k, name=name, color=color):
        c = w / 2
        u = w / 20.0          # glyph units: designed on a 20x20 grid
        lw = max(1, int(1.8 * u))
        if name == 'money':
            D.circle(s, color, c, c, 8 * u, max(1, int(1.6 * u)))
            D.circle(s, rgba(color, 0.35), c, c, 5.6 * u, max(1, int(u)))
            mark = text_surface('$', FONT_TITLE, color, int(11 * u), True)
            s.blit(mark, (int(c - mark.get_width() / 2), int(c - mark.get_height() / 2)))
        elif name == 'xp':
            pts = []
            for i in range(5):
                a = -math.pi / 2 + (i / 5) * TAU
                a2 = a + TAU / 10
                pts.append((c + math.cos(a) * 8 * u, c + math.sin(a) * 8 * u))
                pts.append((c + math.cos(a2) * 3.5 * u, c + math.sin(a2) * 3.5 * u))
            D.polygon(s, color, pts)
        elif name == 'power':
            D.polygon(s, color, [(c + 2.5 * u, c - 8.5 * u), (c - 4.5 * u, c + u),
                                 (c - 0.5 * u, c + u), (c - 2.5 * u, c + 8.5 * u),
                                 (c + 4.5 * u, c - u), (c + 0.5 * u, c - u)])
        elif name == 'wrench':
            D.line(s, color, (c - 5 * u, c + 5 * u), (c + 4 * u, c - 4 * u), max(2, int(3.2 * u)))
            D.circle(s, color, c + 5.5 * u, c - 5.5 * u, 3.6 * u, max(1, int(2 * u)))
            D.circle(s, color, c - 6 * u, c + 6 * u, 2.2 * u)
        elif name == 'box':
            D.polygon(s, color, [(c - 8 * u, c - 3.5 * u), (c, c - 7.5 * u), (c + 8 * u, c - 3.5 * u),
                                 (c + 8 * u, c + 4.5 * u), (c, c + 8.5 * u), (c - 8 * u, c + 4.5 * u)],
                      max(1, int(1.6 * u)))
            D.line(s, color, (c - 8 * u, c - 3.5 * u), (c, c + 0.5 * u), max(1, int(1.6 * u)))
            D.line(s, color, (c + 8 * u, c - 3.5 * u), (c, c + 0.5 * u), max(1, int(1.6 * u)))
            D.line(s, color, (c, c + 0.5 * u), (c, c + 8.5 * u), max(1, int(1.6 * u)))
        elif name == 'flask':
            D.line(s, color, (c - 2.5 * u, c - 7.5 * u), (c - 2.5 * u, c - 2 * u), lw)
            D.line(s, color, (c + 2.5 * u, c - 7.5 * u), (c + 2.5 * u, c - 2 * u), lw)
            D.line(s, color, (c - 4.5 * u, c - 7.5 * u), (c + 4.5 * u, c - 7.5 * u), lw)
            D.polygon(s, color, [(c - 2.5 * u, c - 2 * u), (c + 2.5 * u, c - 2 * u),
                                 (c + 7 * u, c + 8 * u), (c - 7 * u, c + 8 * u)], max(1, int(1.6 * u)))
            D.polygon(s, rgba(color, 0.55), [(c - 5.6 * u, c + 4 * u), (c + 5.6 * u, c + 4 * u),
                                             (c + 7 * u, c + 8 * u), (c - 7 * u, c + 8 * u)])
        elif name == 'map':
            D.polygon(s, color, [(c - 8 * u, c - 5.5 * u), (c - 2.6 * u, c - 7.5 * u),
                                 (c + 2.6 * u, c - 5 * u), (c + 8 * u, c - 7.5 * u),
                                 (c + 8 * u, c + 5.5 * u), (c + 2.6 * u, c + 7.5 * u),
                                 (c - 2.6 * u, c + 5 * u), (c - 8 * u, c + 7.5 * u)],
                      max(1, int(1.6 * u)))
            D.line(s, color, (c - 2.6 * u, c - 7.5 * u), (c - 2.6 * u, c + 5 * u), max(1, int(1.4 * u)))
            D.line(s, color, (c + 2.6 * u, c - 5 * u), (c + 2.6 * u, c + 7.5 * u), max(1, int(1.4 * u)))
        elif name == 'mission':
            D.rect(s, color, (c - 6.5 * u, c - 8 * u, 13 * u, 16 * u), max(1, int(1.6 * u)))
            D.line(s, color, (c - 3.6 * u, c - 1.5 * u), (c - 1.2 * u, c + u), max(1, int(1.6 * u)))
            D.line(s, color, (c - 1.2 * u, c + u), (c + 3.8 * u, c - 4 * u), max(1, int(1.6 * u)))
            D.line(s, color, (c - 3.6 * u, c + 4.5 * u), (c + 3.8 * u, c + 4.5 * u), max(1, int(1.4 * u)))
        elif name == 'gear':
            pts = []
            for i in range(8):
                a = (i / 8) * TAU
                a2 = a + TAU / 16
                pts.append((c + math.cos(a) * 8.5 * u, c + math.sin(a) * 8.5 * u))
                pts.append((c + math.cos(a2) * 5.4 * u, c + math.sin(a2) * 5.4 * u))
            D.polygon(s, color, pts)
            pygame.draw.circle(s, (0, 0, 0, 0), (int(c), int(c)), int(2.8 * u))
        elif name == 'clock':
            D.circle(s, color, c, c, 7.6 * u, max(1, int(1.7 * u)))
            D.line(s, color, (c, c), (c, c - 4.4 * u), max(1, int(1.6 * u)))
            D.line(s, color, (c, c), (c + 3.4 * u, c + 1.6 * u), max(1, int(1.6 * u)))
        elif name == 'heart':
            D.circle(s, color, c - 3.4 * u, c - 2.4 * u, 4 * u)
            D.circle(s, color, c + 3.4 * u, c - 2.4 * u, 4 * u)
            D.polygon(s, color, [(c - 7 * u, c - 1 * u), (c + 7 * u, c - 1 * u), (c, c + 8 * u)])
        elif name == 'stamina':
            D.line(s, color, (c - 7.5 * u, c + 4 * u), (c - 3.5 * u, c - 3 * u), max(1, int(1.7 * u)))
            D.line(s, color, (c - 3.5 * u, c - 3 * u), (c, c + 2 * u), max(1, int(1.7 * u)))
            D.line(s, color, (c, c + 2 * u), (c + 3.5 * u, c - 6 * u), max(1, int(1.7 * u)))
            D.line(s, color, (c + 3.5 * u, c - 6 * u), (c + 7.5 * u, c + u), max(1, int(1.7 * u)))
        elif name == 'people':
            D.circle(s, color, c + 4.2 * u, c - 3.2 * u, 2.6 * u)
            D.rr(s, (c + 0.6 * u, c - 0.2 * u, 7.2 * u, 8 * u), color, int(3 * u))
            D.circle(s, color, c - 3.4 * u, c - 4.4 * u, 3.2 * u)
            D.rr(s, (c - 8.4 * u, c - 0.8 * u, 10 * u, 9 * u), color, int(4 * u))
        elif name == 'chart':
            D.line(s, color, (c - 8 * u, c + 7 * u), (c + 8 * u, c + 7 * u), max(1, int(1.6 * u)))
            D.line(s, color, (c - 8 * u, c + 7 * u), (c - 8 * u, c - 8 * u), max(1, int(1.6 * u)))
            D.rect(s, color, (c - 5.5 * u, c - u, 3 * u, 8 * u))
            D.rect(s, color, (c - 0.5 * u, c - 5 * u, 3 * u, 12 * u))
            D.rect(s, color, (c + 4.5 * u, c - 8 * u, 3 * u, 15 * u))
        elif name == 'water':
            D.polygon(s, color, [(c, c - 8.5 * u), (c + 6 * u, c + 2 * u), (c, c + 9 * u), (c - 6 * u, c + 2 * u)])
        elif name == 'close':
            D.line(s, color, (c - 5.5 * u, c - 5.5 * u), (c + 5.5 * u, c + 5.5 * u), max(2, int(2.4 * u)))
            D.line(s, color, (c + 5.5 * u, c - 5.5 * u), (c - 5.5 * u, c + 5.5 * u), max(2, int(2.4 * u)))
        elif name == 'arrow':
            D.polygon(s, color, [(c - 5 * u, c - 7 * u), (c + 6 * u, c), (c - 5 * u, c + 7 * u)])
        else:
            D.circle(s, color, c, c, 6 * u, lw)

    spr = D.render_sprite(size, size, paint)
    if pygame.display.get_surface():
        spr = spr.convert_alpha()
    _glyph_cache[key] = spr
    return spr
