const { getSupabaseAdmin, setCors } = require('../lib/supabase.js');

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return res.status(200).json({ plans: data });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
