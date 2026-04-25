// apps/web/scripts/gen-icons.ts
import sharp from 'sharp';

async function gen() {
  const svg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#1e1e2e"/>
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"
        font-family="JetBrains Mono, monospace" font-size="80" font-weight="500"
        fill="#cdd6f4">echo</text>
  <circle cx="256" cy="320" r="20" fill="#cba6f7"/>
  <text x="50%" y="80%" text-anchor="middle" dominant-baseline="middle"
        font-family="JetBrains Mono, monospace" font-size="80" font-weight="500"
        fill="#cdd6f4">link</text>
</svg>
  `);

  for (const size of [192, 512]) {
    await sharp(svg).resize(size, size).png().toFile(`static/icon-${size}.png`);
  }

  const svgMaskable = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#1e1e2e"/>
  <g transform="translate(64,64) scale(0.75)">
    <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle"
          font-family="JetBrains Mono, monospace" font-size="80" font-weight="500"
          fill="#cdd6f4">echo</text>
    <circle cx="256" cy="320" r="20" fill="#cba6f7"/>
    <text x="50%" y="80%" text-anchor="middle" dominant-baseline="middle"
          font-family="JetBrains Mono, monospace" font-size="80" font-weight="500"
          fill="#cdd6f4">link</text>
  </g>
</svg>
  `);
  await sharp(svgMaskable).resize(512, 512).png().toFile('static/icon-maskable.png');

  await sharp(svg).resize(180, 180).png().toFile('static/apple-touch-icon.png');
  await sharp(svg).resize(32, 32).png().toFile('static/favicon-32.png');

  const ogSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#1e1e2e"/>
  <text x="50%" y="48%" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="120" font-weight="500" fill="#cdd6f4">echo</text>
  <circle cx="600" cy="350" r="24" fill="#cba6f7"/>
  <text x="50%" y="70%" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="120" font-weight="500" fill="#cdd6f4">link</text>
</svg>
  `);
  await sharp(ogSvg).resize(1200, 630).png().toFile('static/og-default.png');

  console.log('icons generated.');
}

gen();
