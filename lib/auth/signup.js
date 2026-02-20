const { getSupabaseAdmin, setCors } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { email, password, full_name } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.auth.admin.createUser({
            email, password, email_confirm: true,
            user_metadata: { full_name: full_name || '' }
        });
        if (error) return res.status(400).json({ error: error.message });

        // Force strictly 0 credits on signup, overriding any older database defaults
        if (data && data.user) {
            await supabase.from('profiles').update({ credits: 0 }).eq('id', data.user.id);
        }

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) return res.status(400).json({ error: signInError.message });

        return res.status(200).json({ user: signInData.user, session: signInData.session });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
