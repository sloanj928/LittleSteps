// Builds every icon the app ships from one description of the logo
// (src/ui/logo.json): three footprints walking up and to the right, growing
// as they go. Run with `npm run icons` after changing the geometry.
//
//   src/app/favicon.ico        16/32/48, a single footprint
//   src/app/icon.svg           the same, as the modern scalable favicon
//   src/app/apple-icon.png     180, full-bleed (iOS rounds the corners itself)
//   public/icons/icon-*.png    192 and 512, rounded square
//   public/icons/maskable-*.png  192 and 512, full-bleed with the footprints
//                              inside the middle 80% that every mask keeps
//   public/logo.svg            the full mark

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default ?? require('png-to-ico');
const logo = require('../src/ui/logo.json');

const root = path.join(__dirname, '..');

// Left and right feet differ only in which side the big toe is on: the
// toes are mirrored, the sole is not.
function foot({ x, y, scale, rotate, mirror }, fill) {
  const toes = logo.toes.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('');
  return `<g fill="${fill}" transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})"><path d="${logo.sole}" transform="${logo.soleTransform}"/><g${mirror ? ' transform="scale(-1 1)"' : ''}>${toes}</g></g>`;
}

/** The full mark. `inset` shrinks the footprints toward the centre; `radius` 0 gives a full-bleed square. */
function mark({ radius = logo.radius, inset = 1 } = {}) {
  const s = logo.size;
  const shift = (s * (1 - inset)) / 2;
  const feet = logo.feet.map((f) => foot(f, logo.cream)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}"><rect width="${s}" height="${s}" rx="${radius}" fill="${logo.sage}"/><g transform="translate(${shift} ${shift}) scale(${inset})">${feet}</g></svg>`;
}

/** One footprint filling the square: three would be specks at 16px. */
function single() {
  const s = logo.size;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}"><rect width="${s}" height="${s}" rx="${logo.radius}" fill="${logo.sage}"/>${foot({ x: 236, y: 286, scale: 3.3, rotate: 28, mirror: false }, logo.cream)}</svg>`;
}

const png = (svg, size) => sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png().toBuffer();

async function main() {
  const icons = path.join(root, 'public', 'icons');
  fs.mkdirSync(icons, { recursive: true });

  fs.writeFileSync(path.join(root, 'public', 'logo.svg'), mark());
  fs.writeFileSync(path.join(root, 'src', 'app', 'icon.svg'), single());
  fs.writeFileSync(path.join(root, 'src', 'app', 'favicon.ico'), await pngToIco(await Promise.all([16, 32, 48].map((n) => png(single(), n)))));
  fs.writeFileSync(path.join(root, 'src', 'app', 'apple-icon.png'), await png(mark({ radius: 0, inset: 0.9 }), 180));
  for (const size of [192, 512]) {
    fs.writeFileSync(path.join(icons, `icon-${size}.png`), await png(mark(), size));
    fs.writeFileSync(path.join(icons, `maskable-${size}.png`), await png(mark({ radius: 0, inset: 0.74 }), size));
  }
  console.log('Icons written.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
