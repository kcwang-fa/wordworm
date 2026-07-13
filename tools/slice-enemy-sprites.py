#!/usr/bin/env python3
"""Slice generated enemy sprite sheets into optimized transparent WebP files."""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHEET_DIR = ROOT / "assets" / "characters" / "enemy-sheets"
OUT_DIR = ROOT / "assets" / "characters" / "enemies"


SHEETS = [
    (
        "dusty-library.png",
        ["paper-mouse", "bookmark-thief", "ink-blob", "spine-guard", "bookworm-king"],
        5,
    ),
    (
        "ink-gallery.png",
        ["dust-scribe", "violet-ink", "echo-proofreader", "missing-word-ghost", "archive-book"],
        5,
    ),
    (
        "crooked-fairytale.png",
        ["cookie-soldier", "nightcap-cat", "glass-slipper-shadow", "paper-crown-queen", "comma-giant"],
        5,
    ),
    (
        "star-chart-room.png",
        ["stardust-moth", "moonphase-clerk", "lost-comet", "observatory-golem", "atlas-curator"],
        5,
    ),
    (
        "forbidden-greenhouse.png",
        ["root-vine", "pollen-note", "dew-slime", "greenhouse-warden", "thousand-page-mandrake"],
        5,
    ),
    (
        "storm-index-harbor.png",
        ["salt-bookmark", "ragged-sail-letterer", "lighthouse-copyeditor", "chapter-kraken", "storm-binder"],
        5,
    ),
    (
        "living-type-core.png",
        ["lead-type-ant", "reverse-print-shade", "proof-press-mechanic", "mojibake-oracle"],
        4,
    ),
]


SINGLE_IMAGES = [
    ("dew-slime.png", "dew-slime", 512),
    ("final-type-golem.png", "final-type-golem", 640),
]

OUTPUT_COMPONENT_REMOVALS = {
    "moonphase-clerk": [(70, 0, 145, 175)],
    "root-vine": [(115, 450, 145, 512)],
    "salt-bookmark": [(340, 0, 430, 350)],
    "spine-guard": [(315, 0, 430, 512)],
}


def background_candidates(rgb: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    green_screen = (g > 105) & ((g - r) > 14) & ((g - b) > 0)
    magenta_screen = (r > 175) & (b > 175) & (g < 100) & (np.abs(r - b) < 90)
    pale_divider = (r > 242) & (g > 242) & (b > 242) & (np.abs(r - g) < 10) & (np.abs(g - b) < 10)
    return green_screen | magenta_screen | pale_divider


def edge_connected_background(candidate: np.ndarray) -> np.ndarray:
    h, w = candidate.shape
    seen = np.zeros((h, w), dtype=bool)
    q = deque()

    for x in range(w):
        if candidate[0, x]:
            seen[0, x] = True
            q.append((0, x))
        if candidate[h - 1, x]:
            seen[h - 1, x] = True
            q.append((h - 1, x))
    for y in range(h):
        if candidate[y, 0]:
            seen[y, 0] = True
            q.append((y, 0))
        if candidate[y, w - 1]:
            seen[y, w - 1] = True
            q.append((y, w - 1))

    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and candidate[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


def transparent_trim(img: Image.Image) -> Image.Image:
    alpha = np.array(img.getchannel("A"))
    ys, xs = np.where(alpha > 0)
    if not len(xs) or not len(ys):
        return img
    pad = 10
    left = max(int(xs.min()) - pad, 0)
    top = max(int(ys.min()) - pad, 0)
    right = min(int(xs.max()) + pad + 1, img.width)
    bottom = min(int(ys.max()) + pad + 1, img.height)
    return img.crop((left, top, right, bottom))


def remove_edge_artifacts(img: Image.Image) -> Image.Image:
    rgba = np.array(img.convert("RGBA"))
    alpha = rgba[:, :, 3] > 0
    h, w = alpha.shape
    seen = np.zeros((h, w), dtype=bool)
    components = []

    for y in range(h):
        for x in range(w):
            if not alpha[y, x] or seen[y, x]:
                continue
            q = deque([(y, x)])
            seen[y, x] = True
            pixels = []
            while q:
                cy, cx = q.popleft()
                pixels.append((cy, cx))
                for ny in range(cy - 1, cy + 2):
                    for nx in range(cx - 1, cx + 2):
                        if (
                            0 <= ny < h
                            and 0 <= nx < w
                            and not seen[ny, nx]
                            and alpha[ny, nx]
                        ):
                            seen[ny, nx] = True
                            q.append((ny, nx))
            ys = np.array([p[0] for p in pixels])
            xs = np.array([p[1] for p in pixels])
            components.append(
                {
                    "pixels": pixels,
                    "area": len(pixels),
                    "bbox": (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1),
                }
            )

    if not components:
        return img

    main = max(components, key=lambda item: item["area"])
    ml, mt, mr, mb = main["bbox"]
    pad_x = max(70, int(w * 0.16))
    pad_y = max(70, int(h * 0.12))
    expanded = (
        max(0, ml - pad_x),
        max(0, mt - pad_y),
        min(w, mr + pad_x),
        min(h, mb + pad_y),
    )

    keep = np.zeros((h, w), dtype=bool)
    for comp in components:
        left, top, right, bottom = comp["bbox"]
        area = comp["area"]
        touches_edge = left <= 1 or top <= 1 or right >= w - 1 or bottom >= h - 1
        near_main = not (
            right < expanded[0]
            or left > expanded[2]
            or bottom < expanded[1]
            or top > expanded[3]
        )
        width = right - left
        height = bottom - top
        slender_artifact = area < 2500 and ((width <= 12 and height >= 70) or (height <= 12 and width >= 70))
        if comp is main or (near_main and area >= 40 and not slender_artifact and not (touches_edge and area < 2200)):
            for y, x in comp["pixels"]:
                keep[y, x] = True

    rgba[:, :, 3] = np.where(keep, rgba[:, :, 3], 0)
    return Image.fromarray(rgba, "RGBA")


def erase_named_components(img: Image.Image, name: str) -> Image.Image:
    boxes = OUTPUT_COMPONENT_REMOVALS.get(name)
    if not boxes:
        return img

    rgba = np.array(img.convert("RGBA"))
    alpha = rgba[:, :, 3] > 0
    h, w = alpha.shape
    seen = np.zeros((h, w), dtype=bool)
    components = []

    for y in range(h):
        for x in range(w):
            if not alpha[y, x] or seen[y, x]:
                continue
            q = deque([(y, x)])
            seen[y, x] = True
            pixels = []
            while q:
                cy, cx = q.popleft()
                pixels.append((cy, cx))
                for ny in range(cy - 1, cy + 2):
                    for nx in range(cx - 1, cx + 2):
                        if (
                            0 <= ny < h
                            and 0 <= nx < w
                            and alpha[ny, nx]
                            and not seen[ny, nx]
                        ):
                            seen[ny, nx] = True
                            q.append((ny, nx))
            ys = np.array([p[0] for p in pixels])
            xs = np.array([p[1] for p in pixels])
            components.append(
                {
                    "pixels": pixels,
                    "area": len(pixels),
                    "bbox": (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1),
                }
            )

    if not components:
        return img

    main = max(components, key=lambda item: item["area"])
    for comp in components:
        if comp is main:
            continue
        left, top, right, bottom = comp["bbox"]
        should_remove = any(
            not (right < bx1 or left > bx2 or bottom < by1 or top > by2)
            for bx1, by1, bx2, by2 in boxes
        )
        if should_remove:
            for y, x in comp["pixels"]:
                rgba[y, x, 3] = 0

    return Image.fromarray(rgba, "RGBA")


def remove_background(img: Image.Image) -> Image.Image:
    rgba = np.array(img.convert("RGBA"))
    rgb = rgba[:, :, :3]
    bg = edge_connected_background(background_candidates(rgb))
    rgba[:, :, 3] = np.where(bg, 0, rgba[:, :, 3])
    return transparent_trim(remove_edge_artifacts(Image.fromarray(rgba, "RGBA")))


def fit_canvas(img: Image.Image, size: int) -> Image.Image:
    img.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - img.width) // 2
    y = (size - img.height) // 2
    canvas.alpha_composite(img, (x, y))
    return canvas


def save_sprite(img: Image.Image, name: str, size: int) -> None:
    out = fit_canvas(remove_background(img), size)
    out = erase_named_components(out, name)
    out.save(OUT_DIR / f"{name}.webp", "WEBP", quality=72, method=6)


def slice_sheet(filename: str, names: list[str], panels: int) -> None:
    img = Image.open(SHEET_DIR / filename).convert("RGBA")
    width, height = img.size
    for idx, name in enumerate(names):
        left = round(width * idx / panels)
        right = round(width * (idx + 1) / panels)
        crop = img.crop((left, 0, right, height))
        inset = max(6, round(crop.width * 0.018))
        crop = crop.crop((inset, 8, crop.width - inset, crop.height - 8))
        size = 640 if idx == panels - 1 else 512
        save_sprite(crop, name, size)


def process_single(filename: str, name: str, size: int) -> None:
    img = Image.open(SHEET_DIR / filename).convert("RGBA")
    save_sprite(img, name, size)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, names, panels in SHEETS:
        slice_sheet(filename, names, panels)
    for filename, name, size in SINGLE_IMAGES:
        process_single(filename, name, size)


if __name__ == "__main__":
    main()
