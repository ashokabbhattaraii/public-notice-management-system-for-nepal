#!/usr/bin/env python3
"""
Regenerate every derived brand asset from the single source of truth,
public/images/logo.png.

    python3 -m pip install pillow
    python3 apps/web/scripts/generate-brand-assets.py

The full logo (monogram + wordmark + tagline) is unreadable below ~64px, so
favicons are cropped to the SAI monogram and rendered as a *knockout*: the
mark in solid white on a full-bleed brand-gradient tile, the way Facebook,
YouTube and every other app icon does it. No white plate, no letterboxing —
the tile is the brand colour edge to edge, which is what makes it read as an
icon rather than as a shrunken logo pasted on a card.

The knockout uses the artwork's alpha channel as a stencil, so the document
and bell — which are transparent cut-outs in the source, not painted white —
stay as negative space inside the S. Sizes/paths match what app/layout.tsx
and public/site.webmanifest reference; change one, change both.

The OG card is set in Poppins — the site's own display face — bundled beside
this script (SIL Open Font License, so redistribution is fine). If those .ttf
files are missing the card degrades to the logo alone rather than silently
swapping in a different typeface.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WEB = Path(__file__).resolve().parent.parent
SOURCE = WEB / "public" / "images" / "logo.png"

# Monogram region of the source artwork (the "SAI" mark above the wordmark).
MARK_BOX = (60, 61, 439, 308)

NAVY = (19, 41, 75)
BLUE = (46, 111, 208)
MUTED = (90, 104, 128)

# Rounded-tile geometry, as a fraction of the icon's edge. 0.225 is the iOS /
# Material "squircle-ish" corner most app icons land on.
CORNER_RADIUS = 0.225
MARK_INSET = 0.15
# Maskable icons are cropped to a circle by Android, so the mark must sit
# inside the 80% safe zone — noticeably smaller than the plain tile version.
MASKABLE_INSET = 0.26

# Anything at least this opaque in the source becomes part of the white
# stencil. Well above the soft anti-aliased edges, so those don't bleed into
# the mask and fur up the outline; the 4x supersample restores smooth edges.
STENCIL_ALPHA = 110


def mark() -> Image.Image:
    return Image.open(SOURCE).convert("RGBA").crop(MARK_BOX)


def brand_gradient(edge: int) -> Image.Image:
    """Navy → blue, top to bottom, sampled from the logo's own palette."""
    canvas = Image.new("RGB", (edge, edge))
    draw = ImageDraw.Draw(canvas)
    for y in range(edge):
        t = y / edge
        draw.line([(0, y), (edge, y)], fill=tuple(int(NAVY[i] + (BLUE[i] - NAVY[i]) * t) for i in range(3)))
    return canvas.convert("RGBA")


def tile(size: int, *, rounded: bool = True, inset: float = MARK_INSET) -> Image.Image:
    """The monogram knocked out in white on a full-bleed brand tile."""
    # Composed at 4x and downsampled: keeps the rounded corners and the mark's
    # thin strokes clean at 32px, where a direct render would alias badly.
    scale = 4
    edge = size * scale

    stencil = mark().split()[3].point(lambda v: 255 if v > STENCIL_ALPHA else 0)
    # Re-crop to the stencil's own bounds: the alpha box and the visible-ink
    # box differ slightly, and centring on the wrong one leaves the mark
    # visibly off-axis in the tile.
    stencil = stencil.crop(stencil.getbbox())
    available = int(edge * (1 - 2 * inset))
    ratio = min(available / stencil.width, available / stencil.height)
    stencil = stencil.resize(
        (max(1, int(stencil.width * ratio)), max(1, int(stencil.height * ratio))), Image.LANCZOS
    )

    mask = Image.new("L", (edge, edge), 0)
    mask.paste(stencil, ((edge - stencil.width) // 2, (edge - stencil.height) // 2))

    white = Image.new("RGBA", (edge, edge), (255, 255, 255, 255))
    canvas = Image.composite(white, brand_gradient(edge), mask)

    # The tile is opaque to its own edge; only the corner shape is cut away,
    # so there is no white/transparent margin anywhere in the icon.
    corners = Image.new("L", (edge, edge), 0)
    draw = ImageDraw.Draw(corners)
    if rounded:
        draw.rounded_rectangle((0, 0, edge - 1, edge - 1), radius=int(edge * CORNER_RADIUS), fill=255)
    else:
        draw.rectangle((0, 0, edge - 1, edge - 1), fill=255)
    canvas.putalpha(corners)

    return canvas.resize((size, size), Image.LANCZOS)


def font(name: str, size: int):
    path = Path(__file__).resolve().parent / name
    return ImageFont.truetype(str(path), size) if path.exists() else None


def og_card() -> Image.Image:
    """1200x630 link-preview card — the size Open Graph and Twitter both want."""
    width, height = 1200, 630
    card = Image.new("RGB", (width, height), (255, 255, 255))
    draw = ImageDraw.Draw(card)

    # Soft top-down tint so the card doesn't read as a blank white rectangle
    # in a feed, without competing with the logo for attention.
    for y in range(height):
        t = y / height
        draw.line(
            [(0, y), (width, y)],
            fill=(
                int(238 + (255 - 238) * t),
                int(243 + (255 - 243) * t),
                int(253 + (255 - 253) * t),
            ),
        )

    logo = Image.open(SOURCE).convert("RGBA")
    logo_size = 300
    logo = logo.resize((logo_size, logo_size), Image.LANCZOS)
    card.paste(logo, (86, (height - logo_size) // 2 - 20), logo)

    text_x = 430
    heading = font("Poppins-SemiBold.ttf", 68)
    body = font("Poppins-Regular.ttf", 32)
    small = font("Poppins-Regular.ttf", 20)

    if heading and body and small:
        draw.text((text_x, 196), "Suchana AI", font=heading, fill=NAVY)
        draw.text(
            (text_x, 292),
            "Nepal's public notices,\naggregated and AI-classified.",
            font=body,
            fill=MUTED,
            spacing=12,
        )
        draw.text((text_x, 424), "INFORMED CITIZENS, EMPOWERED SOCIETY", font=small, fill=BLUE)

    # Bottom accent rule, navy → blue, echoing the logo's own gradient.
    for x in range(width):
        t = x / width
        colour = tuple(int(NAVY[i] + (BLUE[i] - NAVY[i]) * t) for i in range(3))
        draw.line([(x, height - 10), (x, height)], fill=colour)

    return card


def save(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    print(f"  {path.relative_to(WEB)}  ({image.width}x{image.height})")


def main() -> None:
    print("Generating brand assets from", SOURCE.relative_to(WEB))

    # App Router file conventions: Next emits the <link> tags for these.
    save(tile(512), WEB / "app" / "icon.png")
    # iOS masks the corners itself, so this one is a full-bleed square —
    # a pre-rounded tile would get double-rounded and look pinched.
    save(tile(180, rounded=False), WEB / "app" / "apple-icon.png")

    ico = tile(256)
    ico_path = WEB / "app" / "favicon.ico"
    ico.save(ico_path, sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print(f"  {ico_path.relative_to(WEB)}  (16/32/48/64)")

    # PWA install icons, referenced by public/site.webmanifest.
    save(tile(192), WEB / "public" / "icons" / "icon-192.png")
    save(tile(512), WEB / "public" / "icons" / "icon-512.png")
    save(
        tile(512, rounded=False, inset=MASKABLE_INSET),
        WEB / "public" / "icons" / "icon-maskable-512.png",
    )

    save(og_card(), WEB / "public" / "og" / "og-image.png")


if __name__ == "__main__":
    main()
