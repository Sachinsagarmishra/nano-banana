const { getSupabaseAdmin, setCors } = require('../lib/supabase.js');

module.exports = async function handler(req, res) {
    setCors(res);

    try {
        const supabase = getSupabaseAdmin();

        // Check if profiles table exists and list all profiles
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*');

        // Check auth users
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

        // Try to directly insert/update the profile for the user
        let fixResult = null;
        if (authData?.users?.length > 0) {
            const user = authData.users.find(u => u.email === 'sm621331@gmail.com');
            if (user) {
                const { data: upsertData, error: upsertError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: user.id,
                        email: user.email,
                        full_name: 'Sachin Sagar',
                        role: 'super_admin',
                        credits: 9999,
                        total_generations: 0,
                        is_active: true
                    }, { onConflict: 'id' })
                    .select();

                fixResult = {
                    upsertData,
                    upsertError: upsertError?.message || null
                };
            }
        }

        return res.status(200).json({
            profiles: profiles || [],
            profilesError: profilesError?.message || null,
            authUsers: authData?.users?.map(u => ({ id: u.id, email: u.email })) || [],
            authError: authError?.message || null,
            fixResult,
            envCheck: {
                hasUrl: !!process.env.SUPABASE_URL,
                hasAnon: !!process.env.SUPABASE_ANON_KEY,
                hasService: !!process.env.SUPABASE_SERVICE_ROLE_KEY
            }
        });
    } catch (err) {
        return res.status(500).json({ error: err.message, stack: err.stack });
    }
};
