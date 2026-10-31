"""Generate DaciaGlot icon SVGs: a playful 'ă' in a speech bubble, framed by ie-style embroidery."""
import sys, os, math

OUT = sys.argv[1]
# Variant of the in-bubble accent: "diamond" (original), "tulip", "rim" (dotted plate rim) or "both" (tulip + rim).
VARIANT = sys.argv[2] if len(sys.argv) > 2 else "both"
BLUE, YELLOW, RED, CREAM, INK = "#0B2A6F", "#FCD116", "#CE1126", "#FFF4DF", "#0B2A6F"


def motif(cx, cy, s):
    """One cusătură motif: red diamond, yellow core, cream center stitch."""
    return (f'<path d="M{cx} {cy-s} L{cx+s} {cy} L{cx} {cy+s} L{cx-s} {cy} Z" fill="{RED}"/>'
            f'<path d="M{cx} {cy-s*.55} L{cx+s*.55} {cy} L{cx} {cy+s*.55} L{cx-s*.55} {cy} Z" fill="{YELLOW}"/>'
            f'<rect x="{cx-s*.14}" y="{cy-s*.14}" width="{s*.28}" height="{s*.28}" fill="{BLUE}" transform="rotate(45 {cx} {cy})"/>')


def band(y, s=17, n=7, width=512):
    step = width / n
    parts = [motif(step * (i + .5), y, s) for i in range(n)]
    # small cream "stitches" between motifs
    parts += [f'<circle cx="{step*i}" cy="{y}" r="{s*.22}" fill="{CREAM}"/>' for i in range(1, n)]
    # thin running-stitch lines above and below
    for dy in (-s - 9, s + 9):
        parts.append(f'<line x1="18" y1="{y+dy}" x2="{width-18}" y2="{y+dy}" stroke="{YELLOW}" '
                     f'stroke-width="4" stroke-dasharray="10 8" stroke-linecap="round"/>')
    return "".join(parts)


GREEN, OCHRE = "#2E7D4F", "#D9A23B"


def tulip(cx, cy, k):
    """A small Horezu tulip: red bloom, ochre side petals, green stem and leaves."""
    return (f'<g transform="translate({cx} {cy}) scale({k})" stroke-linecap="round">'
            f'<path d="M0 -60C-34 -28-30 22 0 44 30 22 34 -28 0 -60Z" fill="{RED}"/>'
            f'<path d="M0 44C-46 38-70 -14-58 -52-24 -40-4 -4 0 44Z" fill="{OCHRE}"/>'
            f'<path d="M0 44C46 38 70 -14 58 -52 24 -40 4 -4 0 44Z" fill="{OCHRE}"/>'
            f'<path d="M0 44L0 110" stroke="{GREEN}" stroke-width="9"/>'
            f'<path d="M0 100C-30 96-46 74-48 56-22 62-6 80 0 100Z" fill="{GREEN}"/>'
            f'<path d="M0 92C30 88 46 66 48 48 22 54 6 72 0 92Z" fill="{GREEN}"/></g>')


def plate_rim():
    """Ochre dots just inside the bubble edge, like the rim of a painted plate."""
    out = []
    for i in range(30):
        a = i / 30 * 2 * math.pi
        x, y = 256 + math.cos(a) * 140, 246 + math.sin(a) * 132
        if math.hypot(x - 352, y - 164) < 52 or (x < 190 and y > 330):  # leave the tulip and the bubble tail clear
            continue
        out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="{OCHRE}"/>')
    return "".join(out)


def art():
    """Centered artwork (bubble + letter), designed around (256,256)."""
    bubble = (f'<path d="M256 96 a158 150 0 1 1 -96 270 L118 404 L132 340 A158 150 0 0 1 256 96 Z" fill="{CREAM}"/>')
    # single-storey bold 'a': ring + stem
    letter = (f'<circle cx="238" cy="284" r="58" fill="none" stroke="{INK}" stroke-width="38"/>'
              f'<rect x="296" y="214" width="38" height="132" rx="19" fill="{INK}"/>')
    # breve as a red smile
    breve = f'<path d="M196 168 Q240 214 284 168" fill="none" stroke="{RED}" stroke-width="24" stroke-linecap="round"/>'
    # a small yellow embroidery sparkle in the bubble
    spark = tulip(352, 164, .36) if VARIANT in ("tulip", "both") else motif(352, 160, 16)
    rim = plate_rim() if VARIANT in ("rim", "both") else ""
    return bubble + rim + letter + breve + spark


def favicon():
    head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">'
    return (head + f'<rect width="512" height="512" rx="120" fill="{BLUE}"/>'
            + f'<g transform="translate(256 262) scale(1.18) translate(-256 -256)">{art()}</g></svg>\n')


def svg(maskable):
    head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">'
    if maskable:
        # full bleed; keep the art inside the 80% safe zone
        bg = f'<rect width="512" height="512" fill="{BLUE}"/>'
        bands = band(46, 17, 6) + band(466, 17, 6)
        body = f'<g transform="translate(256 262) scale(0.78) translate(-256 -256)">{art()}</g>'
    else:
        bg = f'<rect width="512" height="512" rx="112" fill="{BLUE}"/>'
        bands = band(58, 22, 6) + band(454, 22, 6)
        body = f'<g transform="translate(256 258) scale(0.86) translate(-256 -256)">{art()}</g>'
    return head + "<title>DaciaGlot</title>" + bg + bands + body + "</svg>\n"


os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, "icon.svg"), "w").write(svg(False))
open(os.path.join(OUT, "icon-maskable.svg"), "w").write(svg(True))
open(os.path.join(OUT, "favicon.svg"), "w").write(favicon())
print("ok")
