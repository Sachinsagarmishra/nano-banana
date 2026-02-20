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

        const { data: plans } = await supabase.from('subscription_plans').select('id, name, price_string');
        const planMap = {};
        const planPriceMap = {};
        if (plans) {
            plans.forEach(p => {
                planMap[p.id] = p.name;
                const match = p.price_string ? p.price_string.replace(/[^0-9.]/g, '') : '0';
                planPriceMap[p.id] = parseFloat(match) || 0;
            });
        }

        let mrr = 0;
        let cancelledMRR = 0;
        let cancelledUsers = 0;

        const profilesWithPlans = profiles.map(p => {
            const hasPlan = !!p.active_plan_id;
            const price = hasPlan ? (planPriceMap[p.active_plan_id] || 0) : 0;

            if (hasPlan && !p.subscription_cancelled) {
                mrr += price;
            } else if (hasPlan && p.subscription_cancelled) {
                cancelledMRR += price;
                cancelledUsers += 1;
            }

            return {
                ...p,
                active_plan_name: hasPlan && planMap[p.active_plan_id] ? planMap[p.active_plan_id] : null
            };
        });

        const totalGenerations = profiles.reduce((sum, p) => sum + (p.total_generations || 0), 0);

        const stats = {
            totalUsers: profiles.length,
            activeUsers: profiles.filter(p => p.is_active).length,
            totalGenerations: totalGenerations,
            admins: profiles.filter(p => p.role !== 'user').length,
            mrr,
            arr: mrr * 12,
            cancelledMRR,
            cancelledUsers
        };
        return res.status(200).json({ profiles: profilesWithPlans, stats });
    }

    if (req.method === 'PUT') {
        if (!isSuperAdmin(user)) return res.status(403).json({ error: 'Super admin required' });
        const { userId, is_active, role, credits, cancel_subscription } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId required' });
        if (userId === user.id && role && role !== 'super_admin') return res.status(400).json({ error: 'Cannot change own role' });

        const updates = { updated_at: new Date().toISOString() };
        if (is_active !== undefined) updates.is_active = is_active;
        if (role !== undefined) updates.role = role;
        if (credits !== undefined) updates.credits = credits;

        if (cancel_subscription) {
            const { data: targetProfile, error: targetError } = await supabase.from('profiles').select('dodo_subscription_id, subscription_cancelled').eq('id', userId).single();
            if (targetError || !targetProfile) return res.status(400).json({ error: 'User not found' });
            if (targetProfile.subscription_cancelled) return res.status(400).json({ error: 'Subscription is already cancelled' });
            if (!targetProfile.dodo_subscription_id) return res.status(400).json({ error: 'User does not have an active Dodo subscription' });

            // Cancel via Dodo API
            const { DodoPayments } = require('dodopayments');
            const { data: settingsData } = await supabase.from('app_settings').select('*');
            const settings = {};
            if (settingsData) settingsData.forEach(s => settings[s.key] = s.value);

            const isTestMode = settings.dodo_environment === 'test_mode';
            const apiKey = isTestMode ? settings.dodo_test_secret_key : settings.dodo_live_secret_key;

            if (!apiKey) return res.status(400).json({ error: 'Payment gateway not configured' });

            try {
                const client = new DodoPayments({
                    bearerToken: apiKey,
                    environment: isTestMode ? 'test_mode' : 'live_mode'
                });
                await client.subscriptions.update(targetProfile.dodo_subscription_id, {
                    cancel_at_next_billing_date: true
                });
                updates.subscription_cancelled = true;
            } catch (dodoErr) {
                return res.status(400).json({ error: 'Dodo Error: ' + dodoErr.message });
            }
        }

        const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single();
        if (error) return res.status(400).json({ error: error.message });
        return res.status(200).json({ profile: data });
    }

    if (req.method === 'DELETE') {
        if (!isSuperAdmin(user)) return res.status(403).json({ error: 'Super admin required' });
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId required' });
        if (userId === user.id) return res.status(400).json({ error: 'Cannot delete your own account' });

        const { data, error } = await supabase.auth.admin.deleteUser(userId);
        if (error) return res.status(400).json({ error: error.message });

        return res.status(200).json({ success: true, message: 'User deleted successfully' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
};
