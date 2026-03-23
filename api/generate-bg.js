export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Google API key not configured' });

    const imagePrompt = `Generate an image: ${prompt}`;
    const geminiBody = {
      contents: [{ parts: [{ text: imagePrompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
    };
    const geminiExtract = (data) => {
      const parts = data.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find(p => p.inlineData);
      return imgPart?.inlineData?.data;
    };

    // Try models in order — current Gemini image generation model names
    const models = [
      'gemini-2.5-flash-image',
      'gemini-3.1-flash-image-preview',
      'gemini-3-pro-image-preview',
      'imagen-4.0-generate-001',
    ];

    let lastError = null;

    for (const model of models) {
      try {
        const isImagen = model.startsWith('imagen');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${isImagen ? 'predict' : 'generateContent'}?key=${apiKey}`;
        const body = isImagen
          ? { instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: '9:16', safetyFilterLevel: 'block_some' } }
          : geminiBody;
        const extract = isImagen
          ? (data) => data.predictions?.[0]?.bytesBase64Encoded
          : geminiExtract;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        const data = await response.json();
        const imageBase64 = extract(data);

        if (imageBase64) {
          return res.json({ image: `data:image/png;base64,${imageBase64}` });
        }

        lastError = { model, status: response.status, error: data.error?.message || 'No image returned' };
        console.error(`Model ${model} failed:`, data.error?.message || 'No image');
      } catch (fetchErr) {
        lastError = { model, error: fetchErr.message };
        console.error(`Model ${model} fetch error:`, fetchErr.message);
      }
    }

    res.status(500).json({ error: 'Image generation failed', debug: lastError });
  } catch (err) {
    console.error('Imagen error:', err);
    res.status(500).json({ error: err.message });
  }
}
