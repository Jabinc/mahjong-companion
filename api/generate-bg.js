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

    // Gemini image generation models (free tier compatible)
    const models = [
      'gemini-2.5-flash-image',
      'gemini-3.1-flash-image-preview',
      'gemini-3-pro-image-preview',
    ];

    const errors = [];

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiBody)
        });

        const data = await response.json();

        if (!response.ok) {
          const errMsg = data.error?.message || `HTTP ${response.status}`;
          const errStatus = data.error?.status || '';
          errors.push({ model, status: response.status, error: errMsg });
          console.error(`Model ${model} failed (${response.status}):`, errMsg);

          // Stop immediately on quota/auth errors — other models share the same limits
          if (response.status === 429 || response.status === 403 || response.status === 401
              || errStatus === 'RESOURCE_EXHAUSTED' || errStatus === 'PERMISSION_DENIED') {
            break;
          }
          continue;
        }

        const imageBase64 = geminiExtract(data);

        if (imageBase64) {
          return res.json({ image: `data:image/png;base64,${imageBase64}` });
        }

        // Model returned 200 but no image
        const textPart = data.candidates?.[0]?.content?.parts?.find(p => p.text);
        const blockReason = data.candidates?.[0]?.finishReason;
        errors.push({
          model,
          status: response.status,
          error: `No image in response (finishReason: ${blockReason})`,
          text: textPart?.text?.slice(0, 200)
        });
        console.error(`Model ${model}: no image returned, finishReason=${blockReason}`);
      } catch (fetchErr) {
        errors.push({ model, error: fetchErr.message });
        console.error(`Model ${model} fetch error:`, fetchErr.message);
      }
    }

    const primaryError = errors[0]?.error || 'All models failed';
    res.status(500).json({ error: primaryError, allErrors: errors });
  } catch (err) {
    console.error('Generate-bg error:', err);
    res.status(500).json({ error: err.message });
  }
}
