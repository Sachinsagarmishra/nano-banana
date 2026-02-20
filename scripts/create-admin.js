// Run this AFTER setting up Supabase + Vercel env vars
// Usage: node scripts/create-admin.js

const VERCEL_URL = 'https://nano-banana-mu-lemon.vercel.app';

async function createSuperAdmin() {
    console.log('🍌 Creating Super Admin account...\n');

    // Step 1: Sign up
    const signupRes = await fetch(`${VERCEL_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'sm621331@gmail.com',
            password: 'Mercedes@001',
            full_name: 'Sachin Sagar'
        })
    });

    const signupData = await signupRes.json();

    if (signupData.error) {
        console.log('❌ Signup error:', signupData.error);
        console.log('\nIf user already exists, try logging in on the admin page directly.');
        return;
    }

    console.log('✅ Account created successfully!');
    console.log('📧 Email:', 'sm621331@gmail.com');
    console.log('🔑 User ID:', signupData.user?.id);
    console.log('\n⚠️  IMPORTANT: Now go to Supabase SQL Editor and run:');
    console.log('─────────────────────────────────────────────');
    console.log(`UPDATE public.profiles SET role = 'super_admin' WHERE email = 'sm621331@gmail.com';`);
    console.log('─────────────────────────────────────────────');
    console.log('\n🎉 After that, login at:', `${VERCEL_URL}/admin`);
}

createSuperAdmin().catch(console.error);
