"""Immediate-mode widgets. Each returns whether it was activated this frame."""
import pygame

from ..art import draw as D
from ..art import palette as P
from ..art import ui as U
from ..core.utils import clamp, rect_hit


class Widgets:
    def __init__(self, ui):
        self.ui = ui

    @property
    def s(self):
        return self.ui.screen

    @property
    def inp(self):
        return self.ui.game.input

    def hover(self, x, y, w, h):
        return rect_hit(self.inp.mx, self.inp.my, (x, y, w, h))

    def consume_click(self, x, y, w, h):
        if not self.hover(x, y, w, h):
            return False
        self.ui.hovering_ui = True
        if self.inp.clicked:
            self.inp.clicked = False
            self.ui.game.audio.play('click')
            return True
        return False

    def button(self, x, y, w, h, label, disabled=False, primary=False, danger=False,
               tip=None, tip_body=None, size=13):
        hov = self.hover(x, y, w, h) and not disabled
        if hov:
            self.ui.hovering_ui = True
        U.button(self.s, x, y, w, h, label, hover=hov, pressed=hov and self.inp.down,
                 disabled=disabled, primary=primary, danger=danger, size=size)
        if tip and hov:
            self.ui.set_tooltip(tip, tip_body)
        if disabled:
            if hov and self.inp.clicked:
                self.inp.clicked = False
            return False
        return self.consume_click(x, y, w, h)

    def tab(self, x, y, w, h, label, active):
        hov = self.hover(x, y, w, h)
        if hov:
            self.ui.hovering_ui = True
        U.tab(self.s, x, y, w, h, label, active, hov)
        return self.consume_click(x, y, w, h)

    def slot(self, x, y, w, h, selected=False, tip=None, tip_body=None, tip_icon=None):
        hov = self.hover(x, y, w, h)
        if hov:
            self.ui.hovering_ui = True
        U.slot(self.s, x, y, w, h, hover=hov, selected=selected)
        if tip and hov:
            self.ui.set_tooltip(tip, tip_body, tip_icon)
        return hov, self.consume_click(x, y, w, h)

    def bar(self, x, y, w, h, frac, color, label=None, label_color=None):
        U.bar(self.s, x, y, w, h, frac, color, label, label_color)

    def text(self, t, x, y, color=P.UI_TEXT, size=13, bold=False, align='left',
             family=U.FONT_BODY):
        return U.engraved(self.s, t, x, y, family, color, size, bold, align)

    def heading(self, t, x, y, w):
        U.heading(self.s, t, x, y, w)

    def wrap(self, t, x, y, w, line_h=16, size=12, color=P.UI_DIM):
        return U.wrap_text(self.s, t, x, y, w, line_h, size, color)

    def icon(self, name, x, y, size=20, color=P.UI_TRIM_HI):
        self.s.blit(U.glyph(name, size, color), (int(x), int(y)))

    def scroll(self, key, x, y, w, h, content_h):
        """Wheel-driven scrolling for a list region; returns the current offset."""
        offsets = self.ui.scrolls
        off = offsets.get(key, 0)
        if self.hover(x, y, w, h) and self.inp.wheel:
            off += self.inp.wheel * 42
            self.ui.hovering_ui = True
        off = clamp(off, 0, max(0, content_h - h))
        offsets[key] = off
        if content_h > h:
            th = max(24, (h / content_h) * h)
            ty = y + (off / max(1, content_h - h)) * (h - th)
            D.rect(self.s, (0, 0, 0, 115), (x + w - 7, y, 6, h))
            D.rect(self.s, P.rgba(P.UI_TRIM, 0.7), (x + w - 7, ty, 6, th))
        return off

    def clip(self, x, y, w, h):
        return _Clip(self.s, pygame.Rect(int(x), int(y), int(w), int(h)))


class _Clip:
    def __init__(self, surf, rect):
        self.surf = surf
        self.rect = rect
        self.prev = None

    def __enter__(self):
        self.prev = self.surf.get_clip()
        self.surf.set_clip(self.rect)
        return self.surf

    def __exit__(self, *a):
        self.surf.set_clip(self.prev)
        return False
