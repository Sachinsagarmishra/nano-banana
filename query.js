const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

// We need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
// Let's get them from environment or grep the codebase
// Actually, I can just require lib/supabase.js
const { getSupabaseAdmin } = require('./lib/supabase.js');

async function check() {
    const supabase = getSupabaseAdmin();
    const { data: profiles, error } = await supabase.from('profiles').select('*');
    if (error) console.error(error);
    console.log("PROFILES:");
    console.table(profiles.map(p => ({ email: p.email, credits: p.credits, role: p.role, active_plan: p.active_plan_id })));

    const { data: plans } = await supabase.from('subscription_plans').select('*');
    console.log("\nPLANS:");
    console.table(plans);
}
check();
