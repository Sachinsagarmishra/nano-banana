const { getUser, getSupabaseAdmin, setCors } = require('../lib/supabase.js');

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const supabase = getSupabaseAdmin();
        const user = await getUser(req);
        const userId = user?.id || null;

        // Get API key from Supabase settings (fallback to env var)
        let apiKey = process.env.KIE_API_KEY;
        try {
            const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'kie_api_key').single();
            if (setting?.value) apiKey = setting.value;
        } catch (e) { }

        if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

        const { prompt, imageInput, aspectRatio, resolution, outputFormat } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        if (user?.profile && user.profile.credits <= 0) {
            return res.status(402).json({ error: 'No credits remaining. Contact admin.' });
        }

        const response = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: 'nano-banana-pro',
                input: { prompt, image_input: imageInput || [], aspect_ratio: aspectRatio || '1:1', resolution: resolution || '1K', output_format: outputFormat || 'png' }
            })
        });

        const data = await response.json();

        if (data.code === 200 && userId) {
            await supabase.from('generation_logs').insert({ user_id: userId, prompt, task_id: data.data.taskId, status: 'pending', aspect_ratio: aspectRatio, resolution });
            await supabase.from('profiles').update({ credits: Math.max(0, (user.profile.credits || 1) - 1), total_generations: (user.profile.total_generations || 0) + 1 }).eq('id', userId);
        }

        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
