const { getUser, getSupabaseAdmin, setCors } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    if (req.method === 'GET') {
        return res.status(200).json({ profile: user.profile });
    }

    if (req.method === 'PUT') {
        const { full_name, avatar_url } = req.body;
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.from('profiles')
            .update({
                full_name: full_name !== undefined ? full_name : user.profile.full_name,
                avatar_url: avatar_url !== undefined ? avatar_url : user.profile.avatar_url,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id).select().single();
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ profile: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
