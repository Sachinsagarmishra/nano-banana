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

        const isTestMode = settings.dodo_environment === 'test_mode';
        const apiKey = isTestMode ? settings.dodo_test_secret_key : settings.dodo_live_secret_key;
        const productId = settings.dodo_product_id;

        if (!apiKey || !productId) {
            return res.status(400).json({ error: 'Payments are not fully configured yet.' });
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
            billing: {
                city: "Local",
                country: "US", // Default country, can be dynamic if you have it
                state: "NY",
                street: "123 Main St",
                zipCode: "10001",
            },
            customer: {
                email: user.email,
                name: fullName
            },
            productCart: [
                {
                    productId: productId,
                    quantity: 1,
                }
            ],
            // Pass user id to know who paid for it in the webhook
            metadata: {
                userId: user.id
            },
            returnUrl: `${origin}?payment=success`,
        });

        return res.status(200).json({ url: session.url });
    } catch (err) {
        console.error('Create checkout error:', err);
        return res.status(500).json({ error: err.message || 'Payment initiation failed' });
    }
};
