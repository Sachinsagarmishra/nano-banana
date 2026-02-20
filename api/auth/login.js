const { getSupabaseAdmin, setCors } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return res.status(401).json({ error: error.message });

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        if (profile && !profile.is_active) return res.status(403).json({ error: 'Account deactivated. Contact admin.' });

        return res.status(200).json({ user: data.user, session: data.session, profile });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
