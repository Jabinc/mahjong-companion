import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
}
