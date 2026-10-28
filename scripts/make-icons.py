"""Generate the PNG/ICO icons for Ludoka (matches icons/favicon.svg).

Usage: python3 scripts/make-icons.py   (needs Pillow: pip install pillow)
"""
import os
from PIL import Image, ImageDraw

BG = (26, 20, 70, 255)
WHITE = (255, 255, 255, 255)
PIPS = [
    ((0.27, 0.27), (229, 57, 53, 255)),   # red
    ((0.73, 0.27), (67, 160, 71, 255)),   # green
    ((0.73, 0.73), (253, 216, 53, 255)),  # yellow
    ((0.27, 0.73), (30, 136, 229, 255)),  # blue
    ((0.50, 0.50), BG),                   # centre
]

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS = os.path.join(ROOT, "icons")
os.makedirs(ICONS, exist_ok=True)


def draw_icon(size, die_ratio=0.6875, corner=0.22):
    scale = 4  # supersample for smooth edges
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * corner), fill=BG)

    side = s * die_ratio
    x0 = (s - side) / 2
    d.rounded_rectangle([x0, x0, x0 + side, x0 + side], radius=side * 0.2, fill=WHITE)
    r = side * 0.114
    for (fx, fy), color in PIPS:
        cx, cy = x0 + side * fx, x0 + side * fy
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=color)
    return img.resize((size, size), Image.LANCZOS)


# Standard "any" icons (rounded)
draw_icon(192).save(os.path.join(ICONS, "icon-192.png"))
draw_icon(512).save(os.path.join(ICONS, "icon-512.png"))

# Maskable: full-bleed background, artwork kept inside the 80% safe zone
draw_icon(512, die_ratio=0.5, corner=0).save(os.path.join(ICONS, "icon-maskable-512.png"))

# iOS home screen icon (iOS applies its own rounding)
draw_icon(180, die_ratio=0.6, corner=0).save(os.path.join(ICONS, "apple-touch-icon.png"))

# favicon.ico lives at the site root
ico_base = draw_icon(256)
ico_base.save(os.path.join(ROOT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])

print("Icons written to", ICONS)
