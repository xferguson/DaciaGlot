"""Generate DaciaGlot icon SVGs: a playful 'ă' in a speech bubble, framed by ie-style embroidery."""
import sys, os

OUT = sys.argv[1]
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


def art():
    """Centered artwork (bubble + letter), designed around (256,256)."""
    bubble = (f'<path d="M256 96 a158 150 0 1 1 -96 270 L118 404 L132 340 A158 150 0 0 1 256 96 Z" fill="{CREAM}"/>')
    # single-storey bold 'a': ring + stem
    letter = (f'<circle cx="238" cy="284" r="58" fill="none" stroke="{INK}" stroke-width="38"/>'
              f'<rect x="296" y="214" width="38" height="132" rx="19" fill="{INK}"/>')
    # breve as a red smile
    breve = f'<path d="M196 168 Q240 214 284 168" fill="none" stroke="{RED}" stroke-width="24" stroke-linecap="round"/>'
    # a small yellow embroidery sparkle in the bubble
    spark = motif(352, 160, 16)
    return bubble + letter + breve + spark


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
