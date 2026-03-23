export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Google API key not configured' });

    // Try Imagen 3.0 first, fall back to imagen-3.0-generate-001
    const models = [
      'imagen-3.0-generate-002',
      'imagen-3.0-generate-001',
      'imagen-3.0-fast-generate-001'
    ];

    let lastError = null;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
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
          return res.json({ image: `data:image/png;base64,${imageBase64}` });
        }

        lastError = { model, status: response.status, data };
        console.error(`Model ${model} failed:`, JSON.stringify(data).slice(0, 500));
      } catch (fetchErr) {
        lastError = { model, error: fetchErr.message };
        console.error(`Model ${model} fetch error:`, fetchErr.message);
      }
    }

    // All models failed
    res.status(500).json({
      error: 'Image generation failed',
      debug: lastError
    });
  } catch (err) {
    console.error('Imagen error:', err);
    res.status(500).json({ error: err.message });
  }
}
