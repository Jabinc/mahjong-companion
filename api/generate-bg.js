export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Google API key not configured' });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '9:16',
            safetyFilterLevel: 'block_some'
          }
        })
      }
    );

    const data = await response.json();

    if (data.predictions && data.predictions[0]) {
      const imageBase64 = data.predictions[0].bytesBase64Encoded;
      res.json({ image: `data:image/png;base64,${imageBase64}` });
    } else {
      res.status(500).json({ error: 'No image generated', details: data });
    }
  } catch (err) {
    console.error('Imagen error:', err);
    res.status(500).json({ error: err.message });
  }
}
