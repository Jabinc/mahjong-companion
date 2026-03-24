import { GoogleAuth } from 'google-auth-library';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'No prompt provided' });

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
        instances: [{ prompt }],
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
