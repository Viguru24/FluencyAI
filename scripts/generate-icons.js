import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');
const assetsDir = path.resolve(__dirname, '../src/assets');

const srcImg1 = 'C:/Users/louis/.gemini/antigravity/brain/20032ed8-d34e-40f0-82c5-6107af15b31a/.user_uploaded/media_1792240934266_03042fd3.jpg';
const srcImg2 = 'C:/Users/louis/.gemini/antigravity/brain/20032ed8-d34e-40f0-82c5-6107af15b31a/.user_uploaded/media_1792240936870_7b450b14.jpg';

async function generate() {
  console.log('Generating Fluency AI brand icons and assets...');

  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  const bgSquareSvg = `
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg" cx="50%" cy="48%" r="65%">
          <stop offset="0%" stop-color="#465160" />
          <stop offset="45%" stop-color="#333c48" />
          <stop offset="100%" stop-color="#1c222b" />
        </radialGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#bg)" />
    </svg>
  `;

  // Soft feathering mask for Image 2
  const maskSvg = `
    <svg width="1024" height="722" xmlns="http://www.w3.org/2000/svg">
      <defs><filter id="b"><feGaussianBlur stdDeviation="10" /></filter></defs>
      <rect x="18" y="18" width="988" height="686" rx="20" fill="white" filter="url(#b)" />
    </svg>
  `;
  const maskBuf = await sharp(Buffer.from(maskSvg)).png().toBuffer();
  const featheredEmblem = await sharp(srcImg2)
    .ensureAlpha()
    .composite([{ input: maskBuf, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Standard icon (880px wide)
  const standardW = 880;
  const standardH = Math.round(722 * (880 / 1024));
  const resizedStandard = await sharp(featheredEmblem).resize(standardW, standardH).toBuffer();

  const masterSquareBuffer = await sharp(Buffer.from(bgSquareSvg))
    .composite([
      {
        input: resizedStandard,
        top: Math.round((1024 - standardH) / 2),
        left: Math.round((1024 - standardW) / 2),
      }
    ])
    .png({ quality: 95 })
    .toBuffer();

  // Maskable icon (640px wide for Android safe circle)
  const maskableW = 640;
  const maskableH = Math.round(722 * (640 / 1024));
  const resizedMaskable = await sharp(featheredEmblem).resize(maskableW, maskableH).toBuffer();

  const masterMaskableBuffer = await sharp(Buffer.from(bgSquareSvg))
    .composite([
      {
        input: resizedMaskable,
        top: Math.round((1024 - maskableH) / 2),
        left: Math.round((1024 - maskableW) / 2),
      }
    ])
    .png({ quality: 95 })
    .toBuffer();

  // Output all files
  await sharp(masterSquareBuffer).resize(512, 512).toFile(path.join(publicDir, 'icon-512.png'));
  await sharp(masterSquareBuffer).resize(192, 192).toFile(path.join(publicDir, 'icon-192.png'));
  await sharp(masterSquareBuffer).resize(180, 180).toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(masterSquareBuffer).resize(32, 32).toFile(path.join(publicDir, 'favicon-32.png'));
  await sharp(masterSquareBuffer).resize(16, 16).toFile(path.join(publicDir, 'favicon-16.png'));
  await sharp(masterSquareBuffer).resize(32, 32).toFile(path.join(publicDir, 'favicon.ico'));

  await sharp(masterMaskableBuffer).resize(512, 512).toFile(path.join(publicDir, 'icon-maskable-512.png'));
  await sharp(masterMaskableBuffer).resize(192, 192).toFile(path.join(publicDir, 'icon-maskable-192.png'));

  // Full logos
  await sharp(srcImg1).png({ quality: 95 }).toFile(path.join(publicDir, 'logo.png'));
  await sharp(srcImg1).png({ quality: 95 }).toFile(path.join(assetsDir, 'logo.png'));
  await sharp(srcImg2).png({ quality: 95 }).toFile(path.join(publicDir, 'logo-mark.png'));
  await sharp(srcImg2).png({ quality: 95 }).toFile(path.join(assetsDir, 'logo-mark.png'));

  // SVG representation
  const pngBase64 = (await sharp(masterSquareBuffer).resize(256, 256).png().toBuffer()).toString('base64');
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <clipPath id="squircle">
      <rect width="512" height="512" rx="115" />
    </clipPath>
  </defs>
  <rect width="512" height="512" rx="115" fill="#1c222b" />
  <image href="data:image/png;base64,${pngBase64}" width="512" height="512" clip-path="url(#squircle)" preserveAspectRatio="xMidYMid slice" />
</svg>`;
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf8');
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgContent, 'utf8');

  console.log('All Fluency AI icons and brand assets generated successfully!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
