export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Google API key not configured' });

    const model = 'gemini-2.5-flash-image';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Generate an image: ${prompt}` }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || `HTTP ${response.status}`;
      console.error(`Gemini image gen failed (${response.status}):`, errMsg);
      return res.status(response.status).json({ error: errMsg });
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find(p => p.inlineData);

    if (imgPart?.inlineData?.data) {
      return res.json({ image: `data:image/png;base64,${imgPart.inlineData.data}` });
    }

    const reason = data.candidates?.[0]?.finishReason || 'unknown';
    res.status(500).json({ error: `No image generated (reason: ${reason})` });
  } catch (err) {
    console.error('Generate-bg error:', err);
    res.status(500).json({ error: err.message });
  }
}
