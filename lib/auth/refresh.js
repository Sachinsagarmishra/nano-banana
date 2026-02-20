const { createClient } = require('@supabase/supabase-js');
const { getSupabaseAdmin, setCors } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { refresh_token } = req.body;
        if (!refresh_token) return res.status(400).json({ error: 'Refresh token required' });

        // Use anon client for refresh (not admin)
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data, error } = await supabase.auth.refreshSession({ refresh_token });

        if (error || !data.session) {
            return res.status(401).json({ error: error?.message || 'Session refresh failed' });
        }

        // Get fresh profile using admin client (bypasses RLS)
        const adminClient = getSupabaseAdmin();
        const { data: profile, error: profileError } = await adminClient
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profile && !profile.is_active) {
            return res.status(403).json({ error: 'Account deactivated. Contact admin.' });
        }

        return res.status(200).json({
            user: data.user,
            session: data.session,
            profile: profile || null,
            profileError: profileError?.message || null
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
