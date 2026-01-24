const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

async function generateIcons() {
  console.log('Generating PWA icons...\n');

  for (const size of sizes) {
    // Create SVG with the design
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#FF0099"/>
            <stop offset="100%" style="stop-color:#7B008B"/>
          </linearGradient>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="60%" style="stop-color:rgba(255,0,153,0.08)"/>
            <stop offset="100%" style="stop-color:rgba(255,0,153,0)"/>
          </radialGradient>
        </defs>
        <!-- Background -->
        <rect width="${size}" height="${size}" fill="#0a0a0a"/>
        <!-- Subtle glow -->
        <rect width="${size}" height="${size}" fill="url(#glow)"/>
        <!-- Y letter -->
        <text
          x="50%"
          y="55%"
          font-family="Arial, Helvetica, sans-serif"
          font-size="${size * 0.55}"
          font-weight="bold"
          fill="url(#textGrad)"
          text-anchor="middle"
          dominant-baseline="middle"
        >Y</text>
        <!-- Accent spark/dot -->
        <circle cx="${size * 0.72}" cy="${size * 0.28}" r="${size * 0.06}" fill="#FFDE00"/>
      </svg>
    `;

    try {
      await sharp(Buffer.from(svg))
        .png()
        .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));

      console.log(`  Created icon-${size}x${size}.png`);

      // Apple touch icon (180x180)
      if (size === 180) {
        await sharp(Buffer.from(svg))
          .png()
          .toFile(path.join(iconsDir, 'apple-touch-icon.png'));
        console.log('  Created apple-touch-icon.png');
      }
    } catch (err) {
      console.error(`  Error creating icon-${size}x${size}.png:`, err.message);
    }
  }

  console.log('\n✅ All icons generated in public/icons/');
}

generateIcons().catch(console.error);
