// Vercel serverless function: Upload image to 0x0.st (no CORS issues server-side)
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { image } = req.body;
        if (!image) return res.status(400).json({ error: 'No image provided' });

        // Parse data URL
        const match = image.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return res.status(400).json({ error: 'Invalid image data' });

        const mime = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        const blob = new Blob([buffer], { type: mime });
        const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/webp' ? 'webp' : 'png';

        // Upload to 0x0.st using FormData (works perfectly server-side)
        const formData = new FormData();
        formData.append('file', blob, `reference.${ext}`);

        const uploadRes = await fetch('https://0x0.st', {
            method: 'POST',
            body: formData
        });

        if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            throw new Error(`0x0.st upload failed (${uploadRes.status}): ${errText}`);
        }

        const url = (await uploadRes.text()).trim();
        return res.status(200).json({ url });
    } catch (err) {
        console.error('Upload error:', err);
        return res.status(500).json({ error: err.message });
    }
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '30mb'
        }
    }
};
