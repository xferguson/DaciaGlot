# Icon sources

The DaciaGlot icon is a single-storey **ă** whose breve is a red smile, inside a cream speech bubble on Romanian blue. It is framed by rows of *ie*-style embroidery motifs (*cusături*) in red and yellow, using a deep blue `#0B2A6F` close to the flag's, yellow `#FCD116` and red `#CE1126`.

The committed files in `app/icons/` are the source of truth. These scripts regenerate them if the design changes. They are **optional dev tooling**, not run in CI. They need Python 3 and a local Playwright/Chromium.

```bash
python3 scripts/icons/make-svg.py app/icons          # writes icon.svg, icon-maskable.svg, favicon.svg
node scripts/icons/render.cjs app/icons /tmp/preview  # writes the PNGs + /tmp/preview/preview.png
```

| File | Use |
|---|---|
| `icon.svg`, `icon-192.png`, `icon-512.png` | manifest `purpose: "any"` (rounded corners) |
| `icon-maskable.svg`, `icon-maskable-192.png`, `icon-maskable-512.png` | manifest `purpose: "maskable"` (full bleed, art inside the 80% safe zone) |
| `apple-touch-icon.png` (180) | iOS home screen |
| `favicon.svg`, `favicon-32.png` | browser tab (simplified: no embroidery bands) |
