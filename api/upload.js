const { setCors } = require('../lib/supabase.js');

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'No image provided' });

        const match = image.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return res.status(400).json({ error: 'Invalid image data' });

        const mime = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const blob = new Blob([buffer], { type: mime });
        const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';

        const formData = new FormData();
        formData.append('file', blob, `reference.${ext}`);

        const uploadRes = await fetch('https://0x0.st', { method: 'POST', body: formData });

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            throw new Error(`Upload failed (${uploadRes.status}): ${errText}`);
        }

        const url = (await uploadRes.text()).trim();
        return res.status(200).json({ url });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

module.exports.config = { api: { bodyParser: { sizeLimit: '30mb' } } };
