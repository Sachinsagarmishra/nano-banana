const { getSupabaseAdmin, setCors } = require('../lib/supabase.js');

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const { taskId } = req.query;
        if (!taskId) return res.status(400).json({ error: 'taskId required' });

        const supabase = getSupabaseAdmin();

        let apiKey = process.env.KIE_API_KEY;
        try {
            const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'kie_api_key').single();
            if (setting?.value) apiKey = setting.value;
        } catch (e) { }

        const response = await fetch(`https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        const data = await response.json();

        return res.status(200).json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
