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
        const { data: settingsData } = await supabase.from('app_settings').select('*');
        const settings = {};
        if (settingsData) {
            settingsData.forEach(s => settings[s.key] = s.value);
        }

        const { planId } = req.body || {};
        if (!planId) return res.status(400).json({ error: 'Subscription plan ID is required' });

        const { data: plan, error: planError } = await supabase.from('subscription_plans').select('*').eq('id', planId).single();
        if (planError || !plan) return res.status(404).json({ error: 'Subscription plan not found' });

        const isTestMode = settings.dodo_environment === 'test_mode';
        const apiKey = isTestMode ? settings.dodo_test_secret_key : settings.dodo_live_secret_key;
        const productId = plan.dodo_product_id;

        if (!apiKey || !productId) {
            return res.status(400).json({ error: 'Payments or plan not fully configured yet.' });
        }

        const client = new DodoPayments({
            bearerToken: apiKey,
            environment: isTestMode ? 'test_mode' : 'live_mode'
        });

        // Use the origin from the request to build the return URL
        const origin = req.headers.origin || 'https://nano-banana-mu-lemon.vercel.app';

        // Split name
        const fullName = user.profile.full_name || user.email.split('@')[0];

        const session = await client.checkoutSessions.create({
            billing_address: {
                city: "Local",
                country: "US",
                state: "NY",
                street: "123 Main St",
                zipcode: "10001",
            },
            customer: {
                email: user.email,
                name: fullName
            },
            product_cart: [
                {
                    product_id: productId,
                    quantity: 1,
                }
            ],
            metadata: {
                userId: user.id,
                planId: String(plan.id),
                credits: String(plan.credits)
            },
            return_url: `${origin}/success.html`,
        });

        console.log('Checkout session created:', JSON.stringify(session));

        const checkoutUrl = session.checkout_url;
        if (!checkoutUrl) {
            return res.status(500).json({ error: 'Checkout session created but no URL returned', session_id: session.session_id });
        }

        return res.status(200).json({ url: checkoutUrl });
    } catch (err) {
        console.error('Create checkout error:', err);
        return res.status(500).json({ error: err.message || 'Payment initiation failed' });
    }
};
