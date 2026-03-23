import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
}
