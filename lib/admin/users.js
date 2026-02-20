const { getUser, isAdmin, isSuperAdmin, getSupabaseAdmin, setCors } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = await getUser(req);
    if (!user || !isAdmin(user)) return res.status(403).json({ error: 'Admin access required' });

    const supabase = getSupabaseAdmin();

    if (req.method === 'GET') {
        const { data: profiles, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });

        const { data: plans } = await supabase.from('subscription_plans').select('id, name');
        const planMap = {};
        if (plans) plans.forEach(p => planMap[p.id] = p.name);

        const profilesWithPlans = profiles.map(p => ({
            ...p,
            active_plan_name: p.active_plan_id && planMap[p.active_plan_id] ? planMap[p.active_plan_id] : null
        }));

        const { count: totalGenerations } = await supabase.from('generation_logs').select('*', { count: 'exact', head: true });

        const stats = {
            totalUsers: profiles.length,
            activeUsers: profiles.filter(p => p.is_active).length,
            totalGenerations: totalGenerations || 0,
            admins: profiles.filter(p => p.role !== 'user').length
        };
        return res.status(200).json({ profiles: profilesWithPlans, stats });
    }

    if (req.method === 'PUT') {
        if (!isSuperAdmin(user)) return res.status(403).json({ error: 'Super admin required' });
        const { userId, is_active, role, credits } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId required' });
        if (userId === user.id && role && role !== 'super_admin') return res.status(400).json({ error: 'Cannot change own role' });

        const updates = { updated_at: new Date().toISOString() };
        if (is_active !== undefined) updates.is_active = is_active;
        if (role !== undefined) updates.role = role;
        if (credits !== undefined) updates.credits = credits;

        const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ profile: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
