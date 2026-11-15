"""Génère les icônes de l'app (iPhone + manifest) dans public/. Usage : npm run icons"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public"
BLEU, BLEU_FONCE, BLANC = (47, 111, 237), (31, 85, 196), (255, 255, 255)
S = 1024  # dessin en grand puis réduction, pour des bords nets


def dessiner(zone: float) -> Image.Image:
    """zone = part de l'icône occupée par le motif (plus petit pour l'icône 'maskable')."""
    img = Image.new("RGB", (S, S), BLEU)
    d = ImageDraw.Draw(img)
    # léger dégradé vertical
    for y in range(S):
        t = y / S
        c = tuple(int(BLEU[i] * (1 - t) + BLEU_FONCE[i] * t) for i in range(3))
        d.line([(0, y), (S, y)], fill=c)
    m = S * (1 - zone) / 2
    w = S - 2 * m
    # portefeuille : corps blanc arrondi
    x0, y0, x1, y1 = m, m + w * 0.18, m + w, m + w * 0.86
    d.rounded_rectangle([x0, y0, x1, y1], radius=w * 0.13, fill=BLANC)
    # rabat bleu pâle
    d.rounded_rectangle([x0 + w * 0.52, y0 + w * 0.22, x1 + 1, y0 + w * 0.46], radius=w * 0.08, fill=(230, 238, 253))
    # bouton du rabat
    r = w * 0.055
    cx, cy = x0 + w * 0.66, y0 + w * 0.34
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BLEU)
    # trois barres (un petit graphique)
    bw = w * 0.08
    for i, h in enumerate((0.16, 0.26, 0.36)):
        bx = x0 + w * 0.12 + i * bw * 1.6
        d.rounded_rectangle([bx, y1 - w * 0.1 - w * h, bx + bw, y1 - w * 0.1], radius=bw * 0.3, fill=BLEU)
    return img


def save(img: Image.Image, name: str, size: int) -> None:
    img.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)


normal, maskable = dessiner(0.62), dessiner(0.5)
save(normal, "apple-touch-icon.png", 180)
save(normal, "icon-192.png", 192)
save(normal, "icon-512.png", 512)
save(maskable, "icon-maskable-512.png", 512)
print("Icônes générées dans", OUT)
