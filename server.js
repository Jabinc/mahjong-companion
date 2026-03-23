import Anthropic from '@anthropic-ai/sdk';
import express from 'express';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

const anthropic = new Anthropic();

// Recognize tiles from a photo of a mahjong hand
app.post('/api/read-tiles', async (req, res) => {
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
});

// Get Charleston advice given tiles and card data
app.post('/api/charleston-advice', async (req, res) => {
  const { tiles, cardData, round, receivedTiles } = req.body;
  if (!tiles) return res.status(400).json({ error: 'No tiles provided' });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are an expert American Mahjong Charleston advisor. A player needs help deciding which 3 tiles to pass.

CURRENT HAND: ${JSON.stringify(tiles)}
${receivedTiles ? `TILES RECEIVED THIS ROUND: ${JSON.stringify(receivedTiles)}` : ''}
CHARLESTON ROUND: ${round || 'First Right'}
${cardData ? `NMJL CARD HANDS:\n${cardData}` : ''}

Analyze the hand and recommend which 3 tiles to pass. Consider these strategies:

KEY RULES:
- You CANNOT pass Jokers (they must stay in your hand)
- Flowers are rare and valuable — NEVER pass them unless you are certain your target hand doesn't use them
- Don't pass matching tiles in the same suit together (helps opponents)
- Keep pairs and triples — they're hard to rebuild
- Look for patterns that match multiple possible winning hands
- Consider which section of the card gives the most flexibility

Return a JSON object with this exact structure:
{
  "pass": ["tile1", "tile2", "tile3"],
  "keep_strategy": "Brief explanation of what you're building toward",
  "target_hands": ["Hand name 1", "Hand name 2"],
  "tips": ["Contextual tip 1", "Contextual tip 2"],
  "hand_breakdown": {
    "strong": ["tiles that are definitely keepers"],
    "flexible": ["tiles that could go either way"],
    "weak": ["tiles with no current purpose"]
  }
}

Return ONLY the JSON object, no other text.`
      }]
    });

    const text = response.content[0].text.trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ error: 'Could not parse advice', raw: text.slice(0, 500) });
    }

    const advice = JSON.parse(match[0]);
    res.json(advice);
  } catch (err) {
    console.error('Charleston advice error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get hand matching analysis
app.post('/api/match-hands', async (req, res) => {
  const { tiles, cardData } = req.body;
  if (!tiles) return res.status(400).json({ error: 'No tiles provided' });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are an expert American Mahjong hand advisor. Analyze a player's current tiles and find the best matching hands from the NMJL card.

CURRENT HAND: ${JSON.stringify(tiles)}
${cardData ? `NMJL CARD HANDS:\n${cardData}` : 'Use your knowledge of common NMJL card hand categories (2468, Quints, Consecutive Run, 13579, Winds-Dragons, 369, Singles & Pairs, etc.)'}

For each promising hand, calculate how many tiles the player already has and what they still need.

Return a JSON object:
{
  "matches": [
    {
      "hand_name": "Name/description of the hand",
      "category": "Card section (e.g., 2468, Consecutive Run)",
      "tiles_have": 8,
      "tiles_need": 6,
      "needed": ["list of specific tiles still needed"],
      "discard": ["tiles in hand not used by this hand"],
      "difficulty": "easy|medium|hard",
      "notes": "Brief strategic note"
    }
  ],
  "recommendation": "Overall strategic recommendation",
  "discard_suggestion": {
    "tile": "best tile to discard",
    "reason": "why this tile is safest to discard"
  }
}

Return top 3-5 most promising hands, sorted by tiles_have descending. Return ONLY JSON.`
      }]
    });

    const text = response.content[0].text.trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ error: 'Could not parse analysis', raw: text.slice(0, 500) });
    }

    const analysis = JSON.parse(match[0]);
    res.json(analysis);
  } catch (err) {
    console.error('Hand matching error:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🀄 Mahjong Companion running at http://localhost:${PORT}`);
});
