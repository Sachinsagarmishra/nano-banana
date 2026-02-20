const { getSupabaseAdmin, setCors } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
    setCors(res);
    const supabase = getSupabaseAdmin();

    try {
        // 1. Get the pro monthly plan ID
        const { data: plans } = await supabase.from('subscription_plans').select('*');
        const proPlan = plans.find(p => p.name.toLowerCase().includes('pro monthly'));

        if (!proPlan) return res.status(500).json({ error: 'Pro plan not found' });

        // 2. Fetch all profiles that have 10 credits (old default) or 69 credits
        // Let's just fix the specific users the user has in mind, or anyone with > 0 credits but no active plan
        const { data: profiles } = await supabase.from('profiles').select('*');

        const updated = [];
        for (const p of profiles) {
            // Give them the plan and 20 credits minimum
            if (p.credits >= 10 && !p.active_plan_id) {
                await supabase.from('profiles').update({
                    active_plan_id: proPlan.id,
                    credits: Math.max(p.credits, proPlan.credits) // ensure they get at least 20
                }).eq('id', p.id);
                updated.push(p.email);
            }
        }

        return res.status(200).json({ success: true, fixed: updated });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};
