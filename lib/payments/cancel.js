const { getSupabaseAdmin, getUser, setCors } = require('../../lib/supabase.js');
const { DodoPayments } = require('dodopayments');

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const user = await getUser(req);
        if (!user) return res.status(401).json({ error: 'Not authenticated' });

        const supabase = getSupabaseAdmin();

        // Get user's subscription ID
        const subscriptionId = user.profile.dodo_subscription_id;
        if (!subscriptionId) {
            return res.status(400).json({ error: 'No active subscription found' });
        }

        // Get Dodo settings
        const { data: settingsData } = await supabase.from('app_settings').select('*');
        const settings = {};
        if (settingsData) settingsData.forEach(s => settings[s.key] = s.value);

        const isTestMode = settings.dodo_environment === 'test_mode';
        const apiKey = isTestMode ? settings.dodo_test_secret_key : settings.dodo_live_secret_key;

        if (!apiKey) {
            return res.status(400).json({ error: 'Payment gateway not configured' });
        }

        const client = new DodoPayments({
            bearerToken: apiKey,
            environment: isTestMode ? 'test_mode' : 'live_mode'
        });

        // Cancel at end of current billing period (user keeps this month's credits)
        const updated = await client.subscriptions.update(subscriptionId, {
            cancel_at_next_billing_date: true
        });

        // Update user profile — mark as cancelling but keep credits until period ends
        await supabase.from('profiles').update({
            subscription_cancelled: true
        }).eq('id', user.id);

        console.log(`Subscription ${subscriptionId} set to cancel at next billing for user ${user.id}`);

        return res.status(200).json({
            success: true,
            message: 'Subscription will cancel at end of current billing period. Your credits remain active until then.',
            next_billing_date: updated.next_billing_date || null
        });
    } catch (err) {
        console.error('Cancel subscription error:', err);
        return res.status(500).json({ error: err.message || 'Failed to cancel subscription' });
    }
};
