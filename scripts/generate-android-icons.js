const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuraciones de tamaños para cada densidad
const iconSizes = {
  'mipmap-mdpi': { size: 48, foreground: 108 },
  'mipmap-hdpi': { size: 72, foreground: 162 },
  'mipmap-xhdpi': { size: 96, foreground: 216 },
  'mipmap-xxhdpi': { size: 144, foreground: 324 },
  'mipmap-xxxhdpi': { size: 192, foreground: 432 },
};

async function generateAndroidIcons() {
  const logoPath = path.join(__dirname, '../public/logo.png');
  const androidResPath = path.join(__dirname, '../android/app/src/main/res');

  console.log('🚀 Generando iconos de Android con el logo de Paloparti...');

  if (!fs.existsSync(logoPath)) {
    console.error('❌ No se encontró el logo en:', logoPath);
    return;
  }

  // Crear fondo circular verde para el icono
  const createBackground = (size) => {
    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 16, g: 185, b: 129, alpha: 1 }, // Color primary-500
      },
    }).png();
  };

  // Crear fondo adaptativo (más grande para foreground)
  const createAdaptiveBackground = (size) => {
    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 16, g: 185, b: 129, alpha: 1 },
      },
    }).png();
  };

  try {
    // Generar iconos para cada densidad
    for (const [folder, config] of Object.entries(iconSizes)) {
      const folderPath = path.join(androidResPath, folder);

      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      // 1. ic_launcher.png - Icono principal con fondo
      const iconSize = config.size;
      const logoSize = Math.floor(iconSize * 0.6); // Logo al 60% del tamaño total

      await sharp(logoPath)
        .resize(logoSize, logoSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer()
        .then((logoBuffer) => {
          return createBackground(iconSize)
            .composite([
              {
                input: logoBuffer,
                top: Math.floor((iconSize - logoSize) / 2),
                left: Math.floor((iconSize - logoSize) / 2),
              },
            ])
            .png()
            .toFile(path.join(folderPath, 'ic_launcher.png'));
        });

      // 2. ic_launcher_round.png - Versión circular
      await sharp(logoPath)
        .resize(logoSize, logoSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer()
        .then((logoBuffer) => {
          return sharp({
            create: {
              width: iconSize,
              height: iconSize,
              channels: 4,
              background: { r: 16, g: 185, b: 129, alpha: 1 },
            },
          })
            .composite([
              {
                input: logoBuffer,
                top: Math.floor((iconSize - logoSize) / 2),
                left: Math.floor((iconSize - logoSize) / 2),
              },
            ])
            .png()
            .toBuffer();
        })
        .then((iconBuffer) => {
          // Crear máscara circular
          const circle = Buffer.from(
            `<svg width="${iconSize}" height="${iconSize}">
              <circle cx="${iconSize / 2}" cy="${iconSize / 2}" r="${
              iconSize / 2
            }" fill="white"/>
            </svg>`
          );

          return sharp(iconBuffer)
            .composite([
              {
                input: circle,
                blend: 'dest-in',
              },
            ])
            .png()
            .toFile(path.join(folderPath, 'ic_launcher_round.png'));
        });

      // 3. ic_launcher_foreground.png - Para iconos adaptativos
      const foregroundSize = config.foreground;
      const foregroundLogoSize = Math.floor(foregroundSize * 0.4); // Logo más pequeño para foreground

      await sharp(logoPath)
        .resize(foregroundLogoSize, foregroundLogoSize, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer()
        .then((logoBuffer) => {
          return sharp({
            create: {
              width: foregroundSize,
              height: foregroundSize,
              channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparente
            },
          })
            .composite([
              {
                input: logoBuffer,
                top: Math.floor((foregroundSize - foregroundLogoSize) / 2),
                left: Math.floor((foregroundSize - foregroundLogoSize) / 2),
              },
            ])
            .png()
            .toFile(path.join(folderPath, 'ic_launcher_foreground.png'));
        });

      console.log(`✅ Iconos generados para ${folder}`);
    }

    // Crear/actualizar archivos XML adaptativos
    const icLauncherXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>`;

    const icLauncherRoundXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>`;

    // Escribir archivos XML
    const xmlFolder = path.join(androidResPath, 'mipmap-anydpi-v26');
    if (!fs.existsSync(xmlFolder)) {
      fs.mkdirSync(xmlFolder, { recursive: true });
    }

    fs.writeFileSync(path.join(xmlFolder, 'ic_launcher.xml'), icLauncherXml);
    fs.writeFileSync(
      path.join(xmlFolder, 'ic_launcher_round.xml'),
      icLauncherRoundXml
    );

    // Actualizar colores de fondo
    const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#10B981</color>
</resources>`;

    const valuesFolder = path.join(androidResPath, 'values');
    if (!fs.existsSync(valuesFolder)) {
      fs.mkdirSync(valuesFolder, { recursive: true });
    }

    const colorsPath = path.join(valuesFolder, 'ic_launcher_background.xml');
    fs.writeFileSync(colorsPath, colorsXml);

    console.log('✅ Archivos XML adaptativos actualizados');
    console.log('🎉 ¡Iconos de Android generados exitosamente!');
    console.log('');
    console.log('📱 Para aplicar los cambios:');
    console.log('1. Ejecuta: npx cap sync android');
    console.log('2. Ejecuta: npx cap run android');
    console.log('3. O reinstala la app en el emulador');
  } catch (error) {
    console.error('❌ Error generando iconos:', error);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  generateAndroidIcons();
}

module.exports = { generateAndroidIcons };
