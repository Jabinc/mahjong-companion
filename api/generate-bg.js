import { GoogleAuth } from 'google-auth-library';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, referenceImage } = req.body;
  if (!prompt && !referenceImage) return res.status(400).json({ error: 'No prompt or image provided' });

  try {
    const credJson = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!credJson) return res.status(500).json({ error: 'Google credentials not configured' });

    const credentials = JSON.parse(credJson);
    const projectId = credentials.project_id;

    // Get access token via service account
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    let finalPrompt = prompt;

    // If a reference image was provided, use Gemini to analyze it and build a prompt
    if (referenceImage) {
      finalPrompt = await buildPromptFromImage(referenceImage, token, projectId);
    }

    // Generate image with Imagen 4.0
    const model = 'imagen-4.0-generate-001';
    const location = 'us-central1';
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:predict`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        instances: [{ prompt: finalPrompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '9:16',
          safetyFilterLevel: 'block_medium_and_above',
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errMsg = data.error?.message || JSON.stringify(data.error) || `HTTP ${response.status}`;
      console.error(`Imagen generation failed (${response.status}):`, errMsg);
      return res.status(response.status).json({ error: errMsg });
    }

    const imageBase64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (imageBase64) {
      return res.json({ image: `data:image/png;base64,${imageBase64}` });
    }

    res.status(500).json({ error: 'No image returned from Imagen' });
  } catch (err) {
    console.error('Generate-bg error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function buildPromptFromImage(imageBase64, token, projectId) {
  const rawBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const location = 'us-central1';
  const model = 'gemini-2.0-flash';
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: rawBase64,
            }
          },
          {
            text: `You are a creative art director. Analyze this photo of a mahjong setup and describe the visual aesthetic to use as an image generation prompt.

Focus on: colors, textures, materials, lighting, mood, decorative elements, and overall style. Ignore any tiles, cards, or game pieces — focus on the environment, surfaces, accessories, and atmosphere.

Output ONLY a single image generation prompt (no explanation) in this format:
"Beautiful decorative wallpaper background inspired by [describe aesthetic]. [Key visual elements]. [Color palette]. Abstract decorative pattern — no food, no plates, no drinks, no cutlery, no place settings, no people, no game pieces, no tiles. Soft watercolor style. Seamless pattern suitable as a phone wallpaper."`
          }
        ]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
      }
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Gemini analysis failed:', data.error?.message || response.status);
    // Fallback to a generic prompt
    return 'Beautiful decorative wallpaper background inspired by a mahjong game night. Warm ambient lighting, rich textures, and elegant accessories. Abstract decorative pattern — no food, no plates, no drinks, no people. Soft watercolor style. Phone wallpaper.';
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text) {
    // Clean up any quotes or extra formatting
    return text.replace(/^["']|["']$/g, '').trim();
  }

  return 'Beautiful decorative wallpaper background inspired by a mahjong game night. Rich colors and elegant decor. Abstract decorative pattern — no food, no plates, no drinks, no people. Soft watercolor style. Phone wallpaper.';
}
