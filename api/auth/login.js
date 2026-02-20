const { createClient } = require('@supabase/supabase-js');
const { setCors } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        // Use one client for auth sign-in
        const authClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
        const { data, error } = await authClient.auth.signInWithPassword({ email, password });
        if (error) return res.status(401).json({ error: error.message });

        // Use a SEPARATE admin client to fetch profile (bypasses RLS)
        const adminClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
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
