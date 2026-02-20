-- ================================================
-- Nano Banana Pro — Supabase Schema
-- Run this in Supabase SQL Editor
-- ================================================

-- 1. Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text default '',
  avatar_url text default '',
  role text default 'user' check (role in ('user', 'admin', 'super_admin')),
  credits integer default 10,
  total_generations integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. App settings (API key, etc.)
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  label text default '',
  updated_at timestamptz default now(),
  updated_by uuid references auth.users
);

-- 3. Generation logs
create table if not exists public.generation_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  prompt text,
  task_id text,
  status text default 'pending' check (status in ('pending', 'success', 'fail')),
  image_url text,
  aspect_ratio text,
  resolution text,
  cost_time_ms integer,
  created_at timestamptz default now()
);

-- 4. Auto-create profile on signup (trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists and recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. Insert default settings
insert into public.app_settings (key, value, label) values
  ('kie_api_key', '72ca6ff81a2fb81444f16ebcf5b4dd41', 'Kie AI API Key'),
  ('max_credits_free', '10', 'Max Free Credits'),
  ('credits_per_generation', '1', 'Credits Per Generation')
on conflict (key) do nothing;

-- 6. Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.generation_logs enable row level security;

-- Profiles: users can read/update their own, admins can read all
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

create policy "Super admins can update any profile"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );

-- App settings: only admins can read/update
create policy "Admins can read settings"
  on public.app_settings for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

create policy "Super admins can update settings"
  on public.app_settings for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'super_admin'
    )
  );

-- Generation logs: users see own, admins see all
create policy "Users can view own logs"
  on public.generation_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own logs"
  on public.generation_logs for insert
  with check (auth.uid() = user_id);

create policy "Admins can view all logs"
  on public.generation_logs for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );

-- ================================================
-- IMPORTANT: After running this schema:
-- 1. Sign up with your email
-- 2. Run this to make yourself super_admin:
--
--    UPDATE public.profiles 
--    SET role = 'super_admin' 
--    WHERE email = 'YOUR_EMAIL_HERE';
--
-- ================================================

-- 7. Subscription Plans
create table if not exists public.subscription_plans (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  dodo_product_id text not null,
  credits integer not null,
  price_string text default '',
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.subscription_plans enable row level security;

create policy "Anyone can read active plans"
  on public.subscription_plans for select
  using (is_active = true or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin')));

create policy "Admins can manage plans"
  on public.subscription_plans for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'super_admin')));
