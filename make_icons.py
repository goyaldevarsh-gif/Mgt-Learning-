#!/usr/bin/env python3
"""Generate a simple placeholder app icon (white bone on teal). Replace icons/*.png with a custom design any time."""
import math
import pathlib
from PIL import Image, ImageDraw

OUT = pathlib.Path(__file__).resolve().parent / "icons"
OUT.mkdir(exist_ok=True)
TEAL = (11, 93, 87)
INK = (15, 15, 15)
WHITE = (255, 255, 255)


def bone(size: int) -> Image.Image:
    s = size * 4
    img = Image.new("RGB", (s, s), TEAL)
    d = ImageDraw.Draw(img)
    # thick ink frame line near the edge for a bold, high-contrast look
    pad = int(s * 0.06)
    d.rounded_rectangle([pad, pad, s - pad, s - pad], radius=int(s * 0.16), outline=INK, width=int(s * 0.018))
    a = math.radians(-45)
    cx = cy = s / 2
    half = s * 0.27
    dx, dy = math.cos(a) * half, math.sin(a) * half
    x1, y1, x2, y2 = cx - dx, cy - dy, cx + dx, cy + dy
    w = int(s * 0.10)
    d.line([x1, y1, x2, y2], fill=WHITE, width=w)
    r = s * 0.082
    px, py = -math.sin(a), math.cos(a)
    off = s * 0.055
    for (x, y) in ((x1, y1), (x2, y2)):
        for sign in (-1, 1):
            ox, oy = x + px * off * sign, y + py * off * sign
            d.ellipse([ox - r, oy - r, ox + r, oy + r], fill=WHITE)
    return img.resize((size, size), Image.LANCZOS)


for name, size in (("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)):
    bone(size).save(OUT / name, optimize=True)
    print("wrote", name)
