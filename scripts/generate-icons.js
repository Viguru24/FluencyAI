import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');
const svgPath = path.join(publicDir, 'icon.svg');

async function generate() {
  console.log('Generating PWA icons from', svgPath);
  const svgBuffer = fs.readFileSync(svgPath);

  // Standard PWA icons
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-192.png'));

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-512.png'));

  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32.png'));

  // Maskable icons (with 15% safe padding for Android adaptive icon circles)
  const maskableSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
      <defs>
        <linearGradient id="bgGradM" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0284c7" />
          <stop offset="50%" stop-color="#0ea5e9" />
          <stop offset="100%" stop-color="#10b981" />
        </linearGradient>
      </defs>
      <rect width="600" height="600" fill="url(#bgGradM)" />
      <g transform="translate(145, 145) scale(0.6)">
        ${svgBuffer.toString().replace(/<\?xml.*?\?>/, '').replace(/<svg.*?>/, '').replace(/<\/svg>/, '')}
      </g>
    </svg>
  `;

  const maskableBuffer = Buffer.from(maskableSvg);

  await sharp(maskableBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-192.png'));

  await sharp(maskableBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-512.png'));

  console.log('All icons generated successfully!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
