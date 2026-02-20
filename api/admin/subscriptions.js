const { getSupabaseAdmin, getUser, isAdmin } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const user = await getUser(req);
        if (!isAdmin(user)) return res.status(401).json({ error: 'Unauthorized' });

        const supabase = getSupabaseAdmin();

        if (req.method === 'GET') {
            const { data, error } = await supabase.from('subscription_plans').select('*').order('created_at', { ascending: true });
            if (error) throw error;
            return res.status(200).json({ plans: data });
        }

        if (req.method === 'POST') {
            const { name, dodo_product_id, credits, price_string, is_active } = req.body;
            if (!name || !dodo_product_id || !credits) return res.status(400).json({ error: 'Missing required fields' });

            const { data, error } = await supabase.from('subscription_plans').insert([{
                name, dodo_product_id, credits: parseInt(credits), price_string, is_active: is_active !== false
            }]).select().single();
            if (error) throw error;
            return res.status(200).json({ plan: data });
        }

        if (req.method === 'PUT') {
            const { id, name, dodo_product_id, credits, price_string, is_active } = req.body;
            if (!id) return res.status(400).json({ error: 'Missing ID' });

            const updates = {};
            if (name !== undefined) updates.name = name;
            if (dodo_product_id !== undefined) updates.dodo_product_id = dodo_product_id;
            if (credits !== undefined) updates.credits = parseInt(credits);
            if (price_string !== undefined) updates.price_string = price_string;
            if (is_active !== undefined) updates.is_active = is_active;

            const { data, error } = await supabase.from('subscription_plans').update(updates).eq('id', id).select().single();
            if (error) throw error;
            return res.status(200).json({ plan: data });
        }

        if (req.method === 'DELETE') {
            const { id } = req.body;
            if (!id) return res.status(400).json({ error: 'Missing ID' });
            const { error } = await supabase.from('subscription_plans').delete().eq('id', id);
            if (error) throw error;
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
};
