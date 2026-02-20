// Vercel serverless function: Create generation task on Kie AI
// API key is stored as Vercel environment variable KIE_API_KEY
const API_KEY = process.env.KIE_API_KEY;
const API_BASE = 'https://api.kie.ai/api/v1';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { prompt, imageInput, aspectRatio, resolution, outputFormat } = req.body;

        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        const response = await fetch(`${API_BASE}/jobs/createTask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'nano-banana-pro',
                input: {
                    prompt: prompt,
                    image_input: imageInput || [],
                    aspect_ratio: aspectRatio || '1:1',
                    resolution: resolution || '1K',
                    output_format: outputFormat || 'png'
                }
            })
        });

        const data = await response.json();
        return res.status(200).json(data);
    } catch (err) {
        console.error('Generate error:', err);
        return res.status(500).json({ error: err.message });
    }
}
