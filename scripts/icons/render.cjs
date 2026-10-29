// Render icon SVGs to PNGs with the preinstalled Chromium.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const jobs = [
  ['icon.svg', 'icon-512.png', 512],
  ['icon.svg', 'icon-192.png', 192],
  ['favicon.svg', 'favicon-32.png', 32],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-192.png', 192],
  ['icon-maskable.svg', 'apple-touch-icon.png', 180],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [src, out, size] of jobs) {
    const svg = fs.readFileSync(path.join(dir, src), 'utf8');
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">
      <img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${size}" height="${size}" style="display:block"></body></html>`);
    await page.waitForLoadState('load');
    await page.screenshot({ path: path.join(dir, out), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  }
  // preview sheet: any + maskable cropped to a circle (as Android launchers do)
  const b64 = f => fs.readFileSync(path.join(dir, f)).toString('base64');
  await page.setViewportSize({ width: 760, height: 300 });
  await page.setContent(`<body style="margin:0;display:flex;gap:24px;padding:20px;background:#ddd;align-items:center">
    <img src="data:image/png;base64,${b64('icon-512.png')}" width="240">
    <img src="data:image/png;base64,${b64('icon-maskable-512.png')}" width="240" style="border-radius:50%">
    <img src="data:image/png;base64,${b64('icon-192.png')}" width="96">
    <img src="data:image/png;base64,${b64('favicon-32.png')}" width="32"></body>`);
  await page.screenshot({ path: path.join(process.argv[3] || dir, 'preview.png') });
  await browser.close();
  console.log('rendered');
})();
