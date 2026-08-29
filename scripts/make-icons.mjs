/**
 * Generator ikon aplikacji.
 *
 * Uruchomienie:  node scripts/make-icons.mjs
 *
 * Znak: pierścień z przerwą (symbol powtórki/archiwum) z trójkątem odtwarzania
 * w środku, na fioletowym gradiencie w tonacji Twitcha.
 *
 * Świadomie NIE odwzorowuje znaku Twitcha - charakterystyczna sylwetka dymku
 * czatu jest ich znakiem towarowym. Wspólny jest wyłącznie kolor, który sam
 * w sobie nie podlega ochronie, i ogólny klimat.
 *
 * iOS sam przycina ikonę do zaokrąglonego kwadratu, więc tło jest pełnym
 * kwadratem bez własnych zaokrągleń.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets');

const PURPLE_LIGHT = '#A970FF';
const PURPLE = '#9147FF';
const PURPLE_DARK = '#6E22D6';
const NEAR_WHITE = '#EFEFF1';

/** Punkt na okręgu o środku (512,512) i promieniu r, kąt w stopniach. */
function onCircle(angleDeg, r) {
  const rad = (angleDeg * Math.PI) / 180;
  return [512 + r * Math.cos(rad), 512 + r * Math.sin(rad)];
}

/**
 * Pierścień z przerwą u góry po prawej. Zaczyna się na -10 stopni i biegnie
 * zgodnie z ruchem wskazówek przez 300 stopni.
 */
function ringPath(radius) {
  const [x1, y1] = onCircle(-10, radius);
  const [x2, y2] = onCircle(290, radius);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${radius} ${radius} 0 1 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/**
 * Trójkąt odtwarzania. Zaokrąglenie narożników uzyskane obrysem w tym samym
 * kolorze co wypełnienie - prostsze i pewniejsze niż ręczne łuki w ścieżce.
 */
const PLAY_POINTS = '421,378 421,646 646,512';

function markup({ ringColor, triangleColor, background }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${PURPLE_LIGHT}"/>
      <stop offset="1" stop-color="${PURPLE_DARK}"/>
    </linearGradient>
  </defs>
  ${background ? '<rect width="1024" height="1024" fill="url(#bg)"/>' : ''}
  <path d="${ringPath(300)}"
        fill="none"
        stroke="${ringColor}"
        stroke-width="76"
        stroke-linecap="round"/>
  <polygon points="${PLAY_POINTS}"
           fill="${triangleColor}"
           stroke="${triangleColor}"
           stroke-width="44"
           stroke-linejoin="round"/>
</svg>`;
}

/** Ikona aplikacji: biały znak na fioletowym tle. */
const ICON_SVG = markup({
  ringColor: NEAR_WHITE,
  triangleColor: NEAR_WHITE,
  background: true,
});

/** Splash: bez tła, bo ekran startowy ma własny kolor #0E0E10. */
const SPLASH_SVG = markup({
  ringColor: PURPLE,
  triangleColor: NEAR_WHITE,
  background: false,
});

const OUTPUTS = [
  { file: 'icon.png', svg: ICON_SVG, size: 1024 },
  { file: 'splash-icon.png', svg: SPLASH_SVG, size: 512 },
  { file: 'favicon.png', svg: ICON_SVG, size: 64 },
  // Android nie jest budowany, ale trzymamy komplet spójny.
  { file: 'android-icon-foreground.png', svg: SPLASH_SVG, size: 432 },
  { file: 'android-icon-monochrome.png', svg: SPLASH_SVG, size: 432 },
];

await mkdir(ASSETS, { recursive: true });

for (const { file, svg, size } of OUTPUTS) {
  const target = path.join(ASSETS, file);
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(target);
  console.log(`  ${file} — ${size}x${size}`);
}

// Tło ikony adaptacyjnej Androida to jednolity fiolet.
await sharp({
  create: {
    width: 432,
    height: 432,
    channels: 4,
    background: PURPLE,
  },
})
  .png({ compressionLevel: 9 })
  .toFile(path.join(ASSETS, 'android-icon-background.png'));
console.log('  android-icon-background.png — 432x432');

// Podgląd do obejrzenia w przeglądarce bez rasteryzacji.
await writeFile(path.join(ASSETS, 'icon.svg'), ICON_SVG, 'utf8');
console.log('  icon.svg — źródło wektorowe');
