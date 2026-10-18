import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

/**
 * Script para geração automatizada de todos os Favicons, Ícones PWA e Imagem de Compartilhamento (og:image)
 * a partir das fontes estáticas SVG oficiais no diretório /public.
 */
async function generateAllAssets() {
  console.log('[Icon Generator] Iniciando geração coordenada de ícones e og:image...');

  const publicDir = path.resolve(process.cwd(), 'public');
  const faviconSvgPath = path.join(publicDir, 'favicon.svg');
  const ogSvgPath = path.join(publicDir, 'og-image.svg');

  if (!fs.existsSync(faviconSvgPath)) {
    throw new Error(`[Icon Generator Error] Arquivo fonte não encontrado: ${faviconSvgPath}`);
  }

  const faviconSvgBuffer = fs.readFileSync(faviconSvgPath);
  const ogSvgBuffer = fs.existsSync(ogSvgPath) ? fs.readFileSync(ogSvgPath) : faviconSvgBuffer;

  // 1. Favicon PNG 32x32 e 48x48 (para Google Search e compatibilidade)
  await sharp(faviconSvgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  console.log('  ✓ /public/favicon-32x32.png gerado');

  const png48Buffer = await sharp(faviconSvgBuffer)
    .resize(48, 48)
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(publicDir, 'favicon-48x48.png'), png48Buffer);
  console.log('  ✓ /public/favicon-48x48.png gerado');

  // 2. Favicon.ico (Container ICO válido embutindo PNG de 48x48)
  const icoHeader = Buffer.alloc(22);
  icoHeader.writeUInt16LE(0, 0); // Reserved
  icoHeader.writeUInt16LE(1, 2); // Type 1 = ICO
  icoHeader.writeUInt16LE(1, 4); // 1 Image
  icoHeader.writeUInt8(48, 6);   // Width 48
  icoHeader.writeUInt8(48, 7);   // Height 48
  icoHeader.writeUInt8(0, 8);    // Color palette
  icoHeader.writeUInt8(0, 9);    // Reserved
  icoHeader.writeUInt16LE(1, 10); // Color planes
  icoHeader.writeUInt16LE(32, 12); // Bits per pixel
  icoHeader.writeUInt32LE(png48Buffer.length, 14); // Image size
  icoHeader.writeUInt32LE(22, 18); // Image offset

  const icoBuffer = Buffer.concat([icoHeader, png48Buffer]);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  console.log('  ✓ /public/favicon.ico gerado (container ICO 48x48)');

  // 3. Apple Touch Icon 180x180 (Fundo sólido #09090b sem transparência alpha para iOS)
  await sharp(faviconSvgBuffer)
    .resize(180, 180)
    .flatten({ background: '#09090b' })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('  ✓ /public/apple-touch-icon.png gerado (180x180)');

  // 4. PWA Standard Icons (192x192 e 512x512)
  await sharp(faviconSvgBuffer)
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'pwa-192x192.png'));
  console.log('  ✓ /public/pwa-192x192.png gerado');

  await sharp(faviconSvgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'pwa-512x512.png'));
  console.log('  ✓ /public/pwa-512x512.png gerado');

  // 5. PWA Maskable Icon 512x512 (Logo em escala 75% centralizado com safe zone para Android)
  const logoScaledForMaskable = await sharp(faviconSvgBuffer)
    .resize(384, 384)
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 9, g: 9, b: 11, alpha: 1 }, // #09090b
    },
  })
    .composite([
      {
        input: logoScaledForMaskable,
        top: 64,
        left: 64,
      },
    ])
    .png()
    .toFile(path.join(publicDir, 'pwa-maskable-512x512.png'));
  console.log('  ✓ /public/pwa-maskable-512x512.png gerado (com safe zone)');

  // 6. Open Graph Image (og-image.png em 1200x630px otimizado)
  await sharp(ogSvgBuffer)
    .resize(1200, 630)
    .png({ quality: 90, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'og-image.png'));
  console.log('  ✓ /public/og-image.png gerado (1200x630px)');

  console.log('[Icon Generator] 🎉 Todos os ícones e imagens estáticas foram gerados com sucesso!');
}

generateAllAssets().catch((err) => {
  console.error('[Icon Generator Failure]:', err);
  process.exit(1);
});
