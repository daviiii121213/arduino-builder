"""Frame input state: edge-triggered keys and mouse, collected from the pygame
event queue. Edge flags survive until the frame is fully drawn, because the UI
hit-tests while drawing.
"""
import pygame


class Input:
    def __init__(self):
        self.keys = pygame.key.get_pressed()
        self.pressed = set()          # keys that went down this frame
        self.text = []
        self.mx = self.my = 0
        self.down = False
        self.rdown = False
        self.clicked = False
        self.rclicked = False
        self.wheel = 0
        self.quit = False
        self._pos_from_event = False

    def begin_frame(self, events):
        self._pos_from_event = False
        self.pressed.clear()
        self.text = []
        self.clicked = False
        self.rclicked = False
        self.wheel = 0
        for e in events:
            if e.type == pygame.QUIT:
                self.quit = True
            elif e.type == pygame.KEYDOWN:
                self.pressed.add(e.key)
                if e.unicode and e.unicode.isprintable():
                    self.text.append(e.unicode)
            elif e.type == pygame.MOUSEMOTION:
                self.mx, self.my = e.pos
                self._pos_from_event = True
            elif e.type == pygame.MOUSEBUTTONDOWN:
                if getattr(e, 'pos', None):
                    self.mx, self.my = e.pos
                    self._pos_from_event = True
                if e.button == 1:
                    self.down = True
                    self.clicked = True
                elif e.button == 3:
                    self.rdown = True
                    self.rclicked = True
                elif e.button == 4:
                    self.wheel -= 1
                elif e.button == 5:
                    self.wheel += 1
            elif e.type == pygame.MOUSEBUTTONUP:
                if getattr(e, 'pos', None):
                    self.mx, self.my = e.pos
                    self._pos_from_event = True
                if e.button == 1:
                    self.down = False
                elif e.button == 3:
                    self.rdown = False
            elif e.type == pygame.MOUSEWHEEL:
                self.wheel -= e.y
        self.keys = pygame.key.get_pressed()
        if not self._pos_from_event:
            self.mx, self.my = pygame.mouse.get_pos()

    def hit(self, key):
        return key in self.pressed

    def held(self, key):
        return bool(self.keys[key])
