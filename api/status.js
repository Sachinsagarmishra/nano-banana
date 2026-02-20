// Vercel serverless function: Query task status from Kie AI
const API_KEY = process.env.KIE_API_KEY;
const API_BASE = 'https://api.kie.ai/api/v1';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { taskId } = req.query;
        if (!taskId) return res.status(400).json({ error: 'taskId is required' });

        const response = await fetch(`${API_BASE}/jobs/recordInfo?taskId=${taskId}`, {
            headers: { 'Authorization': `Bearer ${API_KEY}` }
        });

        const data = await response.json();
        return res.status(200).json(data);
    } catch (err) {
        console.error('Status error:', err);
        return res.status(500).json({ error: err.message });
    }
}
