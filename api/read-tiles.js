import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });

  try {
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
              media_type: 'image/jpeg',
              data: image.replace(/^data:image\/\w+;base64,/, '')
            }
          },
          {
            type: 'text',
            text: `You are identifying American Mahjong tiles in a photo. The tiles are on a rack.

KEY SHORTCUT: Most American Mahjong tile sets print a SMALL NUMBER on each suited tile (usually in a corner or edge). Look for these numbers FIRST — they tell you the tile's value directly without needing to decode the imagery.

For each tile, left to right, do TWO things:
1. FIND THE NUMBER: Look for a small printed numeral (1-9) on the tile
2. IDENTIFY THE TYPE: Determine which of these 7 categories the tile belongs to

THE 7 TILE TYPES — how to tell them apart:

DOT: The main imagery is CIRCLES/DOTS arranged in a pattern. Colors vary by set but the shapes are always round circles. Look for the number printed on the tile to confirm the count.

BAMBOO (BAM): The main imagery is STRAIGHT STICKS/BARS (bamboo). They are usually green or blue-green. 1-Bam is special — it often shows a bird instead of a single stick. Look for the number.

CHARACTER (CRAK): Has a RED Chinese character (万 or 萬) prominently displayed. The rest of the tile has Chinese numerals. These are the only tiles with prominent RED Chinese writing. Look for the number.

WIND: Shows a large LETTER — N, E, S, or W — or the Chinese character for that direction. No number needed, just read the letter.

DRAGON: Three varieties:
  - Red Dragon: Shows the red character 中 or says "Red"
  - Green Dragon: Shows green character 發 or says "Green"/"Fa"
  - White Dragon (Soap): Nearly BLANK — just a border or frame, no imagery

FLOWER: Ornate, colorful, decorative scenes (flowers, birds, seasons). More artistic/detailed than any other tile. Often has "F" or a number 1-8.

JOKER: Clearly says "JOKER" in text. Often has a jester image.

PROCESS FOR EACH TILE:
1. Look for a printed number on the tile
2. Look at the main imagery to determine the type (circles=Dot, sticks=Bam, red Chinese character=Crak, letter=Wind, etc.)
3. Combine: number + type = tile code

OUTPUT FORMAT:
Think through each tile, then provide the final answer.

For each tile write one line:
"Tile N: [what you see] → CODE"

Then on the final line, provide ONLY a JSON array of all codes.

CODES: 1D-9D (Dot), 1B-9B (Bam), 1C-9C (Crak), N/E/S/W (Wind), RD/GD/WD (Dragon), F (Flower), J (Joker)

Example final line:
["7C","8D","5D","J","7D","5B","N","2C","6D","3B","8B"]`
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
