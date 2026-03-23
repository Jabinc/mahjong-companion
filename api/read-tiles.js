import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'No image provided' });

  try {
    // Step 1: Describe each tile in detail (chain-of-thought)
    const describeResponse = await anthropic.messages.create({
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
            text: `You are an expert at identifying American Mahjong tiles. Look at this photo of tiles on a rack.

IMPORTANT: Some tiles may be upside down or sideways. Look at the imagery carefully regardless of orientation.

Go through each tile from LEFT to RIGHT and describe what you see on its face. For each tile, note:
- What imagery/symbols are on it (circles, bamboo sticks, Chinese characters, letters, etc.)
- How many of those symbols there are (count carefully)
- Any text or letters visible
- The dominant colors

TILE IDENTIFICATION GUIDE:

DOT tiles: Show circular dots/circles arranged in patterns. Count the dots.
- 1 Dot: One large circle, often ornate/decorated
- 2 Dot: Two circles stacked vertically
- 3 Dot: Three circles in a diagonal or triangle
- 4 Dot: Four circles in a square pattern
- 5 Dot: Five circles (four corners + center)
- 6 Dot: Six circles in two columns of three
- 7 Dot: Seven circles (varies by set)
- 8 Dot: Eight circles in two columns of four
- 9 Dot: Nine circles in three rows of three

BAMBOO (BAM) tiles: Show green/blue bamboo sticks.
- 1 Bam: Usually a bird or single ornate bamboo (often looks like a peacock/sparrow)
- 2 Bam: Two bamboo sticks
- 3 Bam: Three bamboo sticks
- 4 Bam: Four bamboo sticks
- 5 Bam: Five bamboo sticks
- 6 Bam: Six bamboo sticks
- 7 Bam: Seven bamboo sticks
- 8 Bam: Eight bamboo sticks
- 9 Bam: Nine bamboo sticks

CHARACTER (CRAK) tiles: Show a Chinese character with a red symbol (often 万/萬) at the top or bottom. The number is indicated by the Chinese numeral.
- 1 Crak: 一 (one horizontal line)
- 2 Crak: 二 (two horizontal lines)
- 3 Crak: 三 (three horizontal lines)
- 4 Crak: 四
- 5 Crak: 五
- 6 Crak: 六
- 7 Crak: 七
- 8 Crak: 八
- 9 Crak: 九
The red character 万/萬 (meaning 10,000) appears on every Crak tile.

WIND tiles: Show a letter (N, S, E, W) with directional imagery or Chinese characters for the wind directions.

DRAGON tiles:
- Red Dragon: Red Chinese character 中 (center) on white background
- Green Dragon: Green character 發 or the word "Fa" in green
- White Dragon (Soap): Blank tile or tile with just a border/frame, no imagery

FLOWER tiles: Ornate, decorative tiles showing flowers, seasons, or artistic scenes. Often more colorful and detailed than other tiles.

JOKER tiles: Clearly marked with the word "JOKER" or "J". Often have a jester/clown image.

Now describe each tile you see, left to right. Be specific about what you observe on each tile face.`
          }
        ]
      }]
    });

    const descriptions = describeResponse.content[0].text.trim();

    // Step 2: Classify based on descriptions
    const classifyResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Based on these tile descriptions from an American Mahjong hand, classify each tile.

TILE DESCRIPTIONS:
${descriptions}

CLASSIFICATION CODES:
- Bamboo: 1B through 9B
- Character/Crak: 1C through 9C
- Dot: 1D through 9D
- Winds: N, E, S, W
- Dragons: RD (Red), GD (Green), WD (White/Soap)
- Flowers: F
- Jokers: J

Return ONLY a JSON array of tile codes in left-to-right order. Example:
["7C","8D","5D","J","7D","5B","N","2C","6D","3B","8B"]

Return ONLY the JSON array, no other text.`
      }]
    });

    const text = classifyResponse.content[0].text.trim();
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) {
      return res.status(500).json({ error: 'Could not parse tiles', raw: text.slice(0, 500) });
    }

    const tiles = JSON.parse(match[0]);
    res.json({ tiles, descriptions });
  } catch (err) {
    console.error('Tile recognition error:', err);
    res.status(500).json({ error: err.message });
  }
}
