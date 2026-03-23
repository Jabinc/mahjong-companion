export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Google API key not configured' });

    // Try multiple model/method combinations
    const attempts = [
      // Gemini API style: generateImages
      {
        url: `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`,
        body: {
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: '9:16', safetyFilterLevel: 'block_some' }
        },
        extract: (data) => data.predictions?.[0]?.bytesBase64Encoded
      },
      // Alternative: Gemini generateContent with image generation
      {
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        body: {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
        },
        extract: (data) => {
          const parts = data.candidates?.[0]?.content?.parts || [];
          const imgPart = parts.find(p => p.inlineData);
          return imgPart?.inlineData?.data;
        }
      }
    ];

    let lastError = null;

    for (const attempt of attempts) {
      try {
        const response = await fetch(attempt.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(attempt.body)
        });

        const data = await response.json();
        const imageBase64 = attempt.extract(data);

        if (imageBase64) {
          return res.json({ image: `data:image/png;base64,${imageBase64}` });
        }

        lastError = { url: attempt.url.split('?')[0], status: response.status, data };
        console.error(`Attempt failed:`, JSON.stringify(data).slice(0, 500));
      } catch (fetchErr) {
        lastError = { url: attempt.url.split('?')[0], error: fetchErr.message };
        console.error(`Fetch error:`, fetchErr.message);
      }
    }

    res.status(500).json({ error: 'Image generation failed', debug: lastError });
  } catch (err) {
    console.error('Imagen error:', err);
    res.status(500).json({ error: err.message });
  }
}
