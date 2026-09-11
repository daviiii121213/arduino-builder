"""Boot: open a window, warm every procedural art cache behind a loading bar,
then run the game loop.
"""
import argparse
import sys
import time

import pygame

from .art import draw as D
from .art import palette as P
from .art import ui as U
from .art.characters import ROLE_STYLE, character_sheet
from .art.icons import item_icon
from .art.machines import machine_sprite
from .art.props import PROPS, prop_sprite
from .core.input import Input
from .data.buildables import BUILDABLES
from .data.items import ITEMS
from .game import Game
from .systems.save import has_save, load_game

WINDOW = (1440, 860)


def loading_screen(screen, frac, msg):
    w, h = screen.get_size()
    screen.fill((11, 13, 16))
    D.glow(screen, w / 2, h / 2 - 40, 320, (40, 52, 68), 0.5)
    plate_w = min(420, w - 60)
    x = w / 2 - plate_w / 2
    y = h / 2 - 90
    D.plate(screen, (x, y, plate_w, 76), (43, 49, 58), 6, 1)
    D.hazard(screen, (x + 4, y + 64, plate_w - 8, 8), pitch=8)
    U.engraved(screen, 'IRONWORKS', w / 2, y + 12, U.FONT_TITLE, P.UI_TRIM_HI, 40, True, 'center')
    U.engraved(screen, 'a factory RPG', w / 2, y + 58, U.FONT_BODY, P.UI_DIM, 12, False, 'center')
    bar_y = y + 110
    D.rect(screen, (20, 23, 27), (x, bar_y, plate_w, 15))
    D.rect(screen, (74, 67, 53), (x, bar_y, plate_w, 15), 2)
    if frac > 0:
        D.grad_rect(screen, (x + 2, bar_y + 2, (plate_w - 4) * frac, 11),
                    [(0.0, P.UI_TRIM_HI), (0.55, P.UI_TRIM), (1.0, (140, 93, 22))])
    U.engraved(screen, msg, w / 2, bar_y + 24, U.FONT_BODY, P.UI_DIM, 12, False, 'center')
    pygame.display.flip()
    for e in pygame.event.get(pygame.QUIT):
        pygame.quit()
        sys.exit(0)


def warm_art(screen):
    """Generate every sprite up front so play never hitches."""
    tasks = [('Mixing pigments',
              lambda: [U.glyph(n, 20) for n in ('money', 'xp', 'power', 'wrench', 'box',
                                                'flask', 'map', 'mission', 'gear', 'clock',
                                                'heart', 'stamina', 'people', 'chart', 'water',
                                                'close', 'arrow')]),
             ('Illustrating materials', lambda: [item_icon(i) for i in ITEMS])]
    for bid in BUILDABLES:
        tasks.append(('Fabricating %s' % BUILDABLES[bid]['name'],
                      lambda bid=bid: (machine_sprite(bid, 0), machine_sprite(bid, 1))))
    tasks.append(('Planting the forest',
                  lambda: [prop_sprite(t, v) for t in PROPS for v in range(3)]))
    tasks.append(('Tailoring uniforms',
                  lambda: [character_sheet(r, s) for r in ROLE_STYLE for s in range(4)]))
    tasks.append(('Riveting the interface',
                  lambda: (U.panel_texture(760, 520), U.panel_texture(700, 500))))
    for i, (msg, fn) in enumerate(tasks):
        loading_screen(screen, i / len(tasks), msg + '...')
        fn()
    return len(tasks)


def main(argv=None):
    ap = argparse.ArgumentParser(description='Ironworks - a factory-building RPG')
    ap.add_argument('--width', type=int, default=WINDOW[0])
    ap.add_argument('--height', type=int, default=WINDOW[1])
    ap.add_argument('--fullscreen', action='store_true')
    ap.add_argument('--seed', type=int, default=20260911, help='world generation seed')
    ap.add_argument('--no-audio', action='store_true')
    ap.add_argument('--continue', dest='cont', action='store_true',
                    help='load the last save on start')
    args = ap.parse_args(argv)

    pygame.init()
    pygame.display.set_caption('Ironworks - a factory RPG')
    flags = pygame.FULLSCREEN if args.fullscreen else pygame.RESIZABLE
    screen = pygame.display.set_mode((args.width, args.height), flags)

    warm_art(screen)

    loading_screen(screen, 0.92, 'Surveying the land...')
    inp = Input()
    game = Game(screen, inp, seed=args.seed)
    if not args.no_audio:
        game.audio.init()
    else:
        game.audio.enabled = False
    if args.cont and has_save():
        game.load()

    loading_screen(screen, 1.0, 'Ready')
    game.notify('Welcome to Ironworks. Press B to build, Tab to manage.', 'info')

    clock = pygame.time.Clock()
    last = time.perf_counter()
    while game.running:
        events = pygame.event.get()
        for e in events:
            if e.type == pygame.VIDEORESIZE:
                screen = pygame.display.set_mode((e.w, e.h), flags)
                game.screen = screen
        inp.begin_frame(events)
        if inp.quit:
            break

        now = time.perf_counter()
        dt = min(now - last, 0.1)
        last = now

        game.update(dt)
        game.draw(dt)
        pygame.display.flip()
        clock.tick(60)

    game.save()
    pygame.quit()
    return 0
