# Quick Start: Database Setup in 5 Minutes

Get EduLive database running in minutes.

## Prerequisites

- Node.js 18+ (already installed)
- npm 9+ (already installed)
- Supabase account (free at https://supabase.com)

## Step 1: Create Supabase Project (2 min)

1. Go to https://supabase.com/dashboard
2. Click **"New project"**
3. Fill in details:
   - Name: `edulive-dev` (or your choice)
   - Password: Create strong password
   - Region: Closest to you
4. Click **"Create new project"**
5. Wait 2-3 minutes for setup

## Step 2: Get Credentials (1 min)

Project created? Now get credentials:

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** → Copy this
   - **Anon (public) key** → Copy this
   - **Service Role key** → Copy this (keep secret!)

## Step 3: Configure Environment (1 min)

```bash
# Create .env.local in project root
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Paste your Supabase URL here
VITE_SUPABASE_URL=https://[PROJECT-ID].supabase.co

# Paste your Anon key here
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Paste your Service Role key here
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Keep these as-is
VITE_ENVIRONMENT=development
VITE_APP_URL=http://localhost:5173
VITE_REALTIME_ENABLED=true
```

**Save file.**

## Step 4: Deploy Migrations (1 min)

In **Supabase Dashboard**:

1. Go to **SQL Editor**
2. Click **New query**
3. Copy entire content of:
   `supabase/migrations/20250814000001_init_schema.sql`
4. Paste in editor
5. Click **Run**
6. Wait for success message

Repeat for other two migrations:

- `20250814000002_rls_policies.sql`
- `20250814000003_seed_data.sql`

(Or use Supabase CLI for automation)

## Step 5: Start Development (0 min)

```bash
npm run dev
```

Visit: http://localhost:5173

## Test It

Login with test account:

```
Email: student@edulive.app
Password: demo1234
```

Done! ✅

## Troubleshooting

### "Missing Supabase configuration"

- Check `.env.local` has correct values
- Restart dev server after editing `.env.local`

### "Unauthorized (401)"

- Verify Supabase credentials are correct
- Copy from dashboard exactly (no extra spaces)

### "Permission denied"

- Verify seed data loaded (check in Supabase Database view)
- Check RLS policies are applied

### Migrations not running

- Use Supabase CLI:
  ```bash
  npm install -g supabase
  supabase link --project-ref [PROJECT-ID]
  supabase db push
  ```

## What You Get

✅ Database with 24 tables
✅ Security policies
✅ Test data loaded
✅ Type-safe services
✅ 3 demo accounts

## Demo Accounts

```
Student: student@edulive.app / demo1234
Teacher: teacher@edulive.app / demo1234
Admin:   admin@edulive.app / demo1234
```

## Next Steps

1. Explore the application
2. Read `DATABASE_SETUP.md` for detailed info
3. Check `DB_SERVICES_REFERENCE.md` for development
4. Plan Phase 2: Authentication integration

## Still Having Issues?

1. Check browser console for errors
2. Check Supabase dashboard for connection status
3. Review `DATABASE_SETUP.md` Troubleshooting section
4. Verify .env.local is in project root (not in src/)

---

**That's it!** Your database is ready. 🚀
