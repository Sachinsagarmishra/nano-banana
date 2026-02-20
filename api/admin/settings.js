import { getUser, isSuperAdmin, getSupabaseAdmin, setCors } from '../../lib/supabase.js';

export default async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = await getUser(req);
    if (!user || !isSuperAdmin(user)) return res.status(403).json({ error: 'Super admin required' });

    const supabase = getSupabaseAdmin();

    // GET — Fetch all settings
    if (req.method === 'GET') {
        const { data, error } = await supabase
            .from('app_settings')
            .select('*')
            .order('key');

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ settings: data });
    }

    // PUT — Update a setting
    if (req.method === 'PUT') {
        const { key, value } = req.body;
        if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });

        const { data, error } = await supabase
            .from('app_settings')
            .upsert({
                key,
                value: String(value),
                updated_at: new Date().toISOString(),
                updated_by: user.id
            })
            .select()
            .single();

        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ setting: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
