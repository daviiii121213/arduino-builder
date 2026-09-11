"""Camera: world is rendered at 1:1 into a logical surface, then scaled once to the
window. That keeps zoom to a single transform per frame instead of per sprite.
"""
import random

from ..core.utils import clamp


class Camera:
    def __init__(self):
        self.x = 0.0
        self.y = 0.0
        self.zoom = 1.35
        self.target_zoom = 1.35
        self.vw = 0          # window size in pixels
        self.vh = 0
        self.shake = 0.0
        self.ox = 0.0
        self.oy = 0.0

    def resize(self, w, h):
        self.vw, self.vh = w, h

    @property
    def lw(self):
        """Logical (world-space) viewport width."""
        return max(64, int(self.vw / self.zoom))

    @property
    def lh(self):
        return max(64, int(self.vh / self.zoom))

    def follow(self, px, py, dt):
        k = 1 - pow(0.0015, dt)
        self.x += (px - self.x) * k
        self.y += (py - self.y) * k

    def update(self, dt):
        self.zoom += (self.target_zoom - self.zoom) * min(1.0, dt * 8)
        if self.shake > 0:
            self.shake = max(0.0, self.shake - dt * 2.4)
            self.ox = (random.random() - 0.5) * self.shake * 16
            self.oy = (random.random() - 0.5) * self.shake * 16
        else:
            self.ox = self.oy = 0.0

    def offset(self):
        """Top-left of the logical viewport in world pixels."""
        return (self.x + self.ox - self.lw / 2, self.y + self.oy - self.lh / 2)

    def world_to_logical(self, wx, wy):
        ox, oy = self.offset()
        return (wx - ox, wy - oy)

    def world_to_screen(self, wx, wy):
        lx, ly = self.world_to_logical(wx, wy)
        return (lx * self.zoom, ly * self.zoom)

    def screen_to_world(self, sx, sy):
        ox, oy = self.offset()
        return (sx / self.zoom + ox, sy / self.zoom + oy)

    def view(self):
        """(x0, y0, x1, y1) of the visible world rectangle, in world pixels."""
        ox, oy = self.offset()
        return (ox, oy, ox + self.lw, oy + self.lh)
