import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const anthropic = new Anthropic();

const EXPECTED = ["N","W","3D","3D","5D","6D","3B","7B","8B","2C","5C","7C","8C"];

const PROMPT = `Identify each American Mahjong tile in this photo. Tiles are on a rack.

IMPORTANT: The tiles are NOT all the same! Even tiles that look similar at first glance have DIFFERENT numbers. You must examine EACH tile individually. Do not assume adjacent tiles are identical.

For each tile, left to right:

1. FIND THE SMALL PRINTED ARABIC NUMERAL on the tile. It is typically near the top-right corner of the tile face, in a small font. This number tells you the tile's value (1-9). Read it carefully for EACH tile — nearby tiles will have DIFFERENT numbers.

2. DETERMINE THE TILE TYPE from the main imagery:
   - DOT: Round circles/rings (blue, red, or multicolored)
   - BAMBOO (BAM): Green/teal vertical sticks or bars
   - CHARACTER (CRAK): Chinese characters with 万/萬, often in a pagoda/lantern frame. Multiple Crak tiles share a similar ornate frame but have DIFFERENT numbers and different Chinese numerals (一=1, 二=2, 三=3, 四=4, 五=5, 六=6, 七=7, 八=8, 九=9)
   - WIND: Large letter N, E, S, or W
   - DRAGON: Red=中, Green=發, White/Soap=blank or border only
   - FLOWER: Unique decorative scenes, each looks different
   - JOKER: Says "JOKER"

3. VERIFY by counting imagery:
   - For DOT tiles: count the distinct circles (ignore concentric inner rings within each circle). A 3-Dot has 3 separate circles. A 5-Dot has 5. An 8-Dot has 8.
   - For BAM tiles: count the distinct bamboo sticks
   - The count should match the printed number

For each tile, write:
"Tile N: I see the printed number [X] in the top area. The imagery shows [description]. Type: [TYPE] → CODE"

CRITICAL: Adjacent tiles of the same suit will have DIFFERENT values. If you wrote the same code for 2+ tiles in a row, go back and look more carefully — you probably missed a difference in the printed numbers.

LAST line: JSON array of codes.
CODES: 1D-9D, 1B-9B, 1C-9C, N/E/S/W, RD/GD/WD, F, J`;

async function preprocessImage(imagePath) {
  // Sharpen, boost contrast, and upscale to make small printed numbers more legible
  const processed = await sharp(imagePath)
    .resize({ width: 3000, withoutEnlargement: false, fit: 'inside' }) // upscale
    .sharpen({ sigma: 2, m1: 1.5, m2: 0.7 }) // strong sharpen
    .normalize() // auto contrast stretch
    .gamma(1.2) // slight contrast boost
    .png() // lossless output
    .toBuffer();

  // Also save for visual inspection
  const debugPath = imagePath.replace(/\.\w+$/, '_processed.png');
  await sharp(processed).toFile(debugPath);
  console.log(`Saved processed image to: ${debugPath}`);

  return processed;
}

async function testImage(imagePath) {
  const processed = await preprocessImage(imagePath);
  const base64 = processed.toString('base64');
  const mediaType = 'image/png';

  console.log(`\nTesting: ${imagePath}`);
  console.log(`Expected: ${JSON.stringify(EXPECTED)}`);
  console.log('---');

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 }
        },
        { type: 'text', text: PROMPT }
      ]
    }]
  });

  const text = response.content[0].text.trim();
  console.log('\nModel response:');
  console.log(text);

  const match = text.match(/\[[\s\S]*?\]/g);
  if (match) {
    const tiles = JSON.parse(match[match.length - 1]);
    console.log(`\nResult:   ${JSON.stringify(tiles)}`);
    console.log(`Expected: ${JSON.stringify(EXPECTED)}`);

    let correct = 0;
    const max = Math.max(tiles.length, EXPECTED.length);
    for (let i = 0; i < max; i++) {
      const got = tiles[i] || '???';
      const exp = EXPECTED[i] || '???';
      const mark = got === exp ? '✓' : '✗';
      console.log(`  ${mark} Tile ${i+1}: got ${got}, expected ${exp}`);
      if (got === exp) correct++;
    }
    console.log(`\nAccuracy: ${correct}/${EXPECTED.length} (${Math.round(100*correct/EXPECTED.length)}%)`);
  }
}

const imagePath = process.argv[2];
if (!imagePath) {
  console.log('Usage: node test-tiles.js <image-path>');
  console.log('Save a test image to test-images/ first');
  process.exit(1);
}
testImage(imagePath);
