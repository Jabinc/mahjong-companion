import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
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
            text: `You are analyzing a photo of American Mahjong tiles arranged in a player's hand (a rack of tiles).

Identify each tile from left to right. American Mahjong uses these tile types:

SUITS (each has values 1-9):
- Bamboo (Bam): Has bamboo stick imagery. Use format: 1B, 2B, 3B... 9B
- Character (Crak): Has Chinese characters with red tops. Use format: 1C, 2C, 3C... 9C
- Dot: Has circular dot patterns. Use format: 1D, 2D, 3D... 9D

HONORS:
- Winds: North (N), East (E), South (S), West (W)
- Dragons: Red Dragon (RD), Green Dragon (GD), White Dragon/Soap (WD)

SPECIAL:
- Flowers (F): Decorative tiles, typically showing flowers or seasons
- Jokers (J): Wild tiles, usually marked "JOKER"

Return ONLY a JSON array of tile codes, left to right. Example:
["1B","3C","5D","F","J","N","RD","7B","7B","7B","2C","2C","GD"]

Count carefully. A standard hand has 13 tiles (14 if just drew). Return ONLY the JSON array, no other text.`
          }
        ]
      }]
    });

    const text = response.content[0].text.trim();
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) {
      return res.status(500).json({ error: 'Could not parse tiles', raw: text.slice(0, 500) });
    }

    const tiles = JSON.parse(match[0]);
    res.json({ tiles });
  } catch (err) {
    console.error('Tile recognition error:', err);
    res.status(500).json({ error: err.message });
  }
}
