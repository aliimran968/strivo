'use strict';
// Generates all PNG image assets from SVG strings.
// Run: node scripts/generate-assets.js

const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets', 'images');

function render(svgString, outputPath) {
  const resvg = new Resvg(svgString, {
    font: { loadSystemFonts: true },
  });
  fs.writeFileSync(outputPath, resvg.render().asPng());
  console.log('✓', path.basename(outputPath));
}

// ─── App icon 1024×1024 ───────────────────────────────────────────────────────
// Dark brown background, gold 270° arc (12-o'clock → 9-o'clock, clockwise).
// Start (12-o'clock): (512, 172)  End (9-o'clock): (172, 512)
// large-arc-flag=1, sweep-flag=1

render(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#1A1208"/>
  <path d="M 512,172 A 340,340 0 1 1 172,512"
    fill="none" stroke="#C9933A" stroke-width="80" stroke-linecap="round"/>
</svg>`, path.join(ASSETS, 'icon.png'));

// ─── Splash icon 800×280 ──────────────────────────────────────────────────────
// Transparent bg — centred on #1A1208 via app.json backgroundColor.
// STRIVO wordmark in gold + tagline in warm off-white.

render(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="280" viewBox="0 0 800 280">
  <text x="400" y="168"
    text-anchor="middle"
    font-family="Georgia,'Times New Roman',serif"
    font-size="118" font-weight="bold" letter-spacing="24"
    fill="#C9933A">STRIVO</text>
  <text x="400" y="228"
    text-anchor="middle"
    font-family="Georgia,'Times New Roman',serif"
    font-size="26" letter-spacing="1.5"
    fill="#F0E6D3">your accountability partner</text>
</svg>`, path.join(ASSETS, 'splash-icon.png'));

// ─── Splash logo 800×200 ──────────────────────────────────────────────────────
// Transparent bg — just the STRIVO wordmark, no tagline.
// Centred on the dark brown splash background via app.json backgroundColor.

render(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200" viewBox="0 0 800 200">
  <text x="400" y="138"
    text-anchor="middle"
    font-family="Georgia,'Times New Roman',serif"
    font-size="120" font-weight="bold" letter-spacing="28"
    fill="#C9933A">STRIVO</text>
</svg>`, path.join(ASSETS, 'splash-logo.png'));

// ─── Android adaptive icon background 1024×1024 ───────────────────────────────

render(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect width="1024" height="1024" fill="#1A1208"/>
</svg>`, path.join(ASSETS, 'android-icon-background.png'));

// ─── Android adaptive icon foreground 1024×1024 (transparent bg) ─────────────

render(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <path d="M 512,172 A 340,340 0 1 1 172,512"
    fill="none" stroke="#C9933A" stroke-width="80" stroke-linecap="round"/>
</svg>`, path.join(ASSETS, 'android-icon-foreground.png'));

// ─── Android monochrome icon 1024×1024 (white arc, transparent bg) ────────────

render(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <path d="M 512,172 A 340,340 0 1 1 172,512"
    fill="none" stroke="#FFFFFF" stroke-width="80" stroke-linecap="round"/>
</svg>`, path.join(ASSETS, 'android-icon-monochrome.png'));
