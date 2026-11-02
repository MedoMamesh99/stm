import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

await mkdir('public/icons', { recursive: true });
const input = 'public/images/stm_mark.png';
for (const [name, size] of [
  ['icon-32.png', 32], ['apple-touch-icon.png', 180],
  ['icon-192.png', 192], ['icon-512.png', 512],
]) {
  await sharp(input).resize(size, size).png({ compressionLevel: 9 }).toFile(`public/icons/${name}`);
}
