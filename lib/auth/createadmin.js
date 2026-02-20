const { getSupabaseAdmin, setCors } = require('../../lib/supabase.js');

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { email, password, full_name } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const supabase = getSupabaseAdmin();

        // Check if user already exists — if so, just update role
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === email);

        let userId;

        if (existingUser) {
            // User exists — just update role
            userId = existingUser.id;
        } else {
            // Create new user
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name: full_name || '' }
            });

            if (createError) return res.status(400).json({ error: createError.message });
            userId = newUser.user.id;

            // Wait a moment for the trigger to create the profile
            await new Promise(r => setTimeout(r, 1000));
        }

        // Set role to super_admin
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'super_admin', full_name: full_name || '', is_active: true })
            .eq('id', userId);

        if (updateError) {
            // Profile might not exist yet, try insert
            await supabase.from('profiles').upsert({
                id: userId,
                email: email,
                full_name: full_name || '',
                role: 'super_admin',
                is_active: true,
                credits: 9999
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Super Admin created! Login at /admin',
            userId
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
