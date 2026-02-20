import { createClient } from '@supabase/supabase-js';

// Admin client (service role key - full access, bypasses RLS)
export function getSupabaseAdmin() {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

// Client with user's JWT (respects RLS)
export function getSupabaseClient(accessToken) {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
            global: {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        }
    );
}

// Verify user from request Authorization header
export async function getUser(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseAdmin();

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    // Get profile with role
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    return { ...user, profile };
}

// Check if user is admin/super_admin
export function isAdmin(user) {
    return user?.profile?.role === 'admin' || user?.profile?.role === 'super_admin';
}

export function isSuperAdmin(user) {
    return user?.profile?.role === 'super_admin';
}

// CORS headers helper
export function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
