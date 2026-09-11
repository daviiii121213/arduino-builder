#!/usr/bin/env python3
"""Ironworks — a factory-building RPG in pure pygame.

    python3 run.py            play
    python3 run.py --help     options
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ironworks.main import main

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
