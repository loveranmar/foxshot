#!/usr/bin/env python3
"""Draws the 32x32 Foxshot pixel-art logo.

The fox's left half is drawn by hand below and mirrored for the right half.
Usage: draw_logo.py <variant> <out.png>   (variant: corners | dashed)
"""
import sys
from PIL import Image

# Left half of the fox (columns 0-15); mirrored to make columns 16-31.
FOX_LEFT = [
    "................",  # 0
    "................",  # 1
    "................",  # 2
    "......B.........",  # 3
    ".....BYB........",  # 4
    ".....BYOB.......",  # 5
    "....BYMOOB......",  # 6
    "....BYMMOOB.....",  # 7
    "....BOMMMOOB....",  # 8
    "....BOMMMOOOBBBB",  # 9
    "...BOOMMOOOOOOOO",  # 10
    "...BOOOOOOOOOOOO",  # 11
    "...BOOOOOOOOOOOO",  # 12
    "..BROOOOOOOOOOOO",  # 13
    "..BROOOOWKOOOOOO",  # 14
    "..BROOOOKKOOOOOO",  # 15
    "..BRROOOKKOOOOOO",  # 16
    "..BRRCOOOOOOOOOO",  # 17
    "..BRCCCOOOOOOOOO",  # 18
    "...BCCCCOOOOOOOO",  # 19
    "...BCCCCCCOOOOOO",  # 20
    "....BCCCCCCCOOOO",  # 21
    "....BCCCCCCCCCOO",  # 22
    ".....BCCCCCCCCCO",  # 23
    "......BCCCCCCCKK",  # 24
    ".......BCCCCCCKK",  # 25
    "........BBCCCCCC",  # 26
    "..........BBBCCC",  # 27
    ".............BBB",  # 28
    "................",  # 29
    "................",  # 30
    "................",  # 31
]

# Firefox flame colours: a diagonal yellow -> orange -> red sweep, dithered
# with a 2x2 Bayer pattern so the steps read as pixel art, not stripes.
FUR_STOPS = [
    (255, 196, 64),
    (255, 160, 46),
    (255, 132, 24),
    (255, 96, 40),
    (238, 58, 70),
]
BAYER = [[0.5, 0.5], [0.5, 0.5]]  # flat 0.5 = clean diagonal bands, no dither


def fur(x, y):
    t = (y + 0.45 * x - 3) / 36
    t = min(max(t, 0), 0.999) * (len(FUR_STOPS) - 1)
    i, frac = int(t), t - int(t)
    return FUR_STOPS[i + 1] if frac > BAYER[y % 2][x % 2] else FUR_STOPS[i]


PALETTE = {
    "B": (90, 21, 48),      # outline (dark wine)
    "Y": (255, 226, 38),    # highlight yellow
    "R": (232, 67, 43),     # side shade
    "M": (242, 85, 122),    # inner ear pink
    "K": (30, 15, 46),      # eyes / nose
    "W": (255, 255, 255),   # eye shine
    "C": (255, 244, 230),   # cream fur
}

PURPLE = (144, 89, 255)
PURPLE_DARK = (89, 42, 203)


def fox_pixels():
    px = {}
    for y, left in enumerate(FOX_LEFT):
        row = left + left[::-1]
        for x, ch in enumerate(row):
            if ch == ".":
                continue
            px[(x, y)] = fur(x, y) if ch == "O" else PALETTE[ch]
    # Light from the top-left, like Firefox's flame: yellow tip on the left
    # ear only, warm shade on the right side of the face.
    for (x, y), c in list(px.items()):
        if x >= 16 and c == PALETTE["Y"]:
            px[(x, y)] = fur(x, y)
        if x >= 26 and c == PALETTE["R"]:
            px[(x, y)] = (214, 40, 70)
    return px


def purple_at(x, y):
    t = (x + y) / 62
    return tuple(round(a + (b - a) * t) for a, b in zip(PURPLE, PURPLE_DARK))


def corners():
    px = {}
    for i in range(7):
        for t in range(2):
            for (x, y) in [(i, t), (t, i), (31 - i, t), (31 - t, i),
                           (i, 31 - t), (t, 31 - i), (31 - i, 31 - t), (31 - t, 31 - i)]:
                px[(x, y)] = purple_at(x, y)
    # round the outer corner pixel off
    for (x, y) in [(0, 0), (31, 0), (0, 31), (31, 31)]:
        px.pop((x, y), None)
    return px


def dashed():
    """Firefox Screenshots-style dashed selection box with round handles."""
    px = {}
    for i in range(1, 31):
        on = (i // 2) % 2 == 0
        if on:
            for (x, y) in [(i, 1), (1, i), (i, 30), (30, i)]:
                px[(x, y)] = purple_at(x, y)
    handle = [".WW.", "WWWW", "WWWW", ".WW."]
    outline = [".PP.", "P..P", "P..P", ".PP."]
    for ox, oy in [(0, 0), (28, 0), (0, 28), (28, 28)]:
        for dy in range(4):
            for dx in range(4):
                if outline[dy][dx] == "P":
                    px[(ox + dx, oy + dy)] = PURPLE_DARK
                elif handle[dy][dx] == "W":
                    px[(ox + dx, oy + dy)] = (255, 255, 255)
    return px


def render(variant):
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    base = {"corners": corners, "dashed": dashed}[variant]()
    base.update(fox_pixels())
    for (x, y), c in base.items():
        img.putpixel((x, y), (*c, 255))
    return img


if __name__ == "__main__":
    render(sys.argv[1]).save(sys.argv[2])
