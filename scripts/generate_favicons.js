import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generateFavicons() {
  const imagesDir = path.join(process.cwd(), 'src', 'assets', 'images');
  const files = fs.readdirSync(imagesDir);
  const faviconFile = files.find((f) => f.startsWith('cod_favicon') && (f.endsWith('.jpg') || f.endsWith('.png')));

  if (!faviconFile) {
    console.error('Source favicon image not found in src/assets/images/');
    process.exit(1);
  }

  const sourcePath = path.join(imagesDir, faviconFile);
  console.log('Found source favicon image:', sourcePath);

  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Load raw image buffer with sharp
  const rawImage = sharp(sourcePath);
  const metadata = await rawImage.metadata();
  console.log(`Source metadata: ${metadata.width}x${metadata.height}, format: ${metadata.format}`);

  // Create clean sharp instance trimmed or background processed
  // Convert background near-white to transparent or keep clean smooth icon
  const processedImageBuffer = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = processedImageBuffer;
  // If outer corners are pure white or near white, flood fill or mask transparency
  // Let's create a transparent-capable PNG buffer
  const pixelCount = info.width * info.height;
  for (let i = 0; i < pixelCount * 4; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // If pixel is extremely close to white background (r > 240, g > 240, b > 240)
    if (r > 242 && g > 242 && b > 242) {
      data[i + 3] = 0; // Alpha transparent
    }
  }

  const basePngBuffer = await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();

  // 1. apple-touch-icon.png (180x180) - iOS standard prefers non-transparent or soft dark/blue bg, but clean 180x180
  const appleTouchBuffer = await sharp(sourcePath)
    .resize(180, 180, { fit: 'contain', background: { r: 30, g: 58, b: 138, alpha: 1 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouchBuffer);
  console.log('Created public/apple-touch-icon.png (180x180)');

  // 2. favicon-32x32.png (32x32 transparent)
  const png32Buffer = await sharp(basePngBuffer)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), png32Buffer);
  console.log('Created public/favicon-32x32.png (32x32)');

  // 3. favicon-16x16.png (16x16 transparent)
  const png16Buffer = await sharp(basePngBuffer)
    .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(publicDir, 'favicon-16x16.png'), png16Buffer);
  console.log('Created public/favicon-16x16.png (16x16)');

  // 4. favicon.ico (Multi-frame ICO container wrapping 16x16 and 32x32 PNGs)
  const icoBuffer = createIcoFromPngs([
    { buffer: png16Buffer, width: 16, height: 16 },
    { buffer: png32Buffer, width: 32, height: 32 },
  ]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  console.log('Created public/favicon.ico');

  // Also duplicate to dist if dist exists
  const distDir = path.join(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    fs.copyFileSync(path.join(publicDir, 'apple-touch-icon.png'), path.join(distDir, 'apple-touch-icon.png'));
    fs.copyFileSync(path.join(publicDir, 'favicon-32x32.png'), path.join(distDir, 'favicon-32x32.png'));
    fs.copyFileSync(path.join(publicDir, 'favicon-16x16.png'), path.join(distDir, 'favicon-16x16.png'));
    fs.copyFileSync(path.join(publicDir, 'favicon.ico'), path.join(distDir, 'favicon.ico'));
    console.log('Copied favicons to dist/');
  }
}

function createIcoFromPngs(pngFrames) {
  const numImages = pngFrames.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dataOffsetStart = headerSize + numImages * dirEntrySize;

  let totalSize = dataOffsetStart;
  pngFrames.forEach((frame) => {
    totalSize += frame.buffer.length;
  });

  const icoBuf = Buffer.alloc(totalSize);

  // ICO Header
  icoBuf.writeUInt16LE(0, 0); // Reserved
  icoBuf.writeUInt16LE(1, 2); // Image type: 1 = ICO
  icoBuf.writeUInt16LE(numImages, 4); // Number of images

  let currentOffset = dataOffsetStart;

  pngFrames.forEach((frame, idx) => {
    const entryOffset = headerSize + idx * dirEntrySize;
    const w = frame.width >= 256 ? 0 : frame.width;
    const h = frame.height >= 256 ? 0 : frame.height;

    icoBuf.writeUInt8(w, entryOffset + 0); // Width
    icoBuf.writeUInt8(h, entryOffset + 1); // Height
    icoBuf.writeUInt8(0, entryOffset + 2); // Color palette count (0 = no palette)
    icoBuf.writeUInt8(0, entryOffset + 3); // Reserved
    icoBuf.writeUInt16LE(1, entryOffset + 4); // Color planes
    icoBuf.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
    icoBuf.writeUInt32LE(frame.buffer.length, entryOffset + 8); // Image size in bytes
    icoBuf.writeUInt32LE(currentOffset, entryOffset + 12); // Offset of image data

    frame.buffer.copy(icoBuf, currentOffset);
    currentOffset += frame.buffer.length;
  });

  return icoBuf;
}

generateFavicons().catch((err) => {
  console.error('Favicon generation failed:', err);
  process.exit(1);
});
