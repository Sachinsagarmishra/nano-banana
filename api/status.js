import { getSupabaseAdmin, setCors } from '../lib/supabase.js';

export default async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { taskId } = req.query;
        if (!taskId) return res.status(400).json({ error: 'taskId required' });

        const supabase = getSupabaseAdmin();

        // Get API key from Supabase settings (fallback to env var)
        let apiKey = process.env.KIE_API_KEY;
        try {
            const { data: setting } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'kie_api_key')
                .single();
            if (setting?.value) apiKey = setting.value;
        } catch (e) { /* use env var */ }

        const response = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        const data = await response.json();

        // Update generation log if task completed
        if (data.code === 200 && (data.data.state === 'success' || data.data.state === 'fail')) {
            const updates = { status: data.data.state };
            if (data.data.state === 'success') {
                try {
                    const resultJson = JSON.parse(data.data.resultJson);
                    updates.image_url = resultJson.resultUrls?.[0] || null;
                } catch (e) { }
                updates.cost_time_ms = data.data.costTime || null;
            }

            await supabase
                .from('generation_logs')
                .update(updates)
                .eq('task_id', taskId);
        }

        return res.status(200).json(data);
    } catch (err) {
        console.error('Status error:', err);
        return res.status(500).json({ error: err.message });
    }
}
