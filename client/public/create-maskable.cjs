const sharp = require('sharp');

async function generateMaskableIcon() {
  try {
    // Read the original logo
    const logo = sharp('logo.png');
    
    // Resize logo to 380x380 so it fits safely inside the maskable icon 80% circle safe zone.
    // 512 * 0.8 = 409.6 max safe size. 380 gives it nice padding.
    const resizedLogo = await logo.resize(380, 380, { fit: 'contain' }).toBuffer();
    
    await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 5, g: 11, b: 20, alpha: 1 } // #050b14 Midnight Blue
      }
    })
    .composite([
      { input: resizedLogo, gravity: 'center' }
    ])
    .toFile('logo-maskable.png');
    
    console.log('Successfully created logo-maskable.png');
  } catch (error) {
    console.error('Error creating maskable icon:', error);
  }
}

generateMaskableIcon();
