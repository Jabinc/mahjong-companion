import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

const anthropic = new Anthropic();

async function preprocessImage(base64Data) {
  // Strip data URL prefix if present
  const rawBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const inputBuffer = Buffer.from(rawBase64, 'base64');

  // Upscale, sharpen, and boost contrast to make small printed numbers legible
  const processed = await sharp(inputBuffer)
    .resize({ width: 3000, withoutEnlargement: false, fit: 'inside' })
    .sharpen({ sigma: 2, m1: 1.5, m2: 0.7 })
    .normalize()
    .gamma(1.2)
    .png()
    .toBuffer();

  return processed.toString('base64');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });

  try {
    // Preprocess: upscale, sharpen, normalize contrast
    const processedBase64 = await preprocessImage(image);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: processedBase64
            }
          },
          {
            type: 'text',
            text: `Identify each American Mahjong tile in this photo. Tiles are on a rack.

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
CODES: 1D-9D, 1B-9B, 1C-9C, N/E/S/W, RD/GD/WD, F, J`
          }
        ]
      }]
    });

    const text = response.content[0].text.trim();
    const match = text.match(/\[[\s\S]*?\]/g);
    if (!match) {
      return res.status(500).json({ error: 'Could not parse tiles', raw: text.slice(0, 500) });
    }

    // Take the last JSON array found (the final answer after reasoning)
    const tiles = JSON.parse(match[match.length - 1]);

    // Extract the reasoning (everything before the final JSON array)
    const lastArrayStart = text.lastIndexOf('[');
    const descriptions = text.slice(0, lastArrayStart).trim();

    res.json({ tiles, descriptions });
  } catch (err) {
    console.error('Tile recognition error:', err);
    res.status(500).json({ error: err.message });
  }
}
