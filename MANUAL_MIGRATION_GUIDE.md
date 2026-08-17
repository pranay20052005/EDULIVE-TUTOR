# Phase 1 Database Migration - Manual Execution Guide

## Quick Start (10 minutes)

You'll execute 3 SQL migration files through the Supabase SQL Editor. This ensures all tables, policies, and test data are created correctly.

---

## Step 1: Access Supabase SQL Editor

1. **Go to**: https://supabase.com/dashboard
2. **Select your project**: "edulive"
3. **Navigate to**: SQL Editor (left sidebar)
4. **Click**: "+ New Query"

---

## Step 2: Execute Migration 1 - Schema

### File: `supabase/migrations/20250814000001_init_schema.sql`

1. **Copy the entire contents** from this file
2. **Paste into SQL Editor**
3. **Click**: "Run" (or Cmd+Enter)
4. **Wait for completion** - should see:
   ```
   ✓ Query returned successfully
   ```

**What this creates:**

- ✓ 24 database tables (users, students, teachers, subjects, etc.)
- ✓ Enum types (Role, QuestionType, PublishStatus, etc.)
- ✓ Primary & foreign key constraints
- ✓ Audit columns (created_at, updated_at)
- ✓ 40+ performance indexes

---

## Step 3: Execute Migration 2 - Row-Level Security

### File: `supabase/migrations/20250814000002_rls_policies.sql`

1. **Create a new query** in SQL Editor
2. **Copy entire contents** from this file
3. **Paste into SQL Editor**
4. **Click**: "Run"
5. **Wait for completion** - should see success

**What this creates:**

- ✓ RLS enabled on all 24 tables
- ✓ 30+ security policies
- ✓ Role-based access control (Student/Teacher/Admin)
- ✓ Data isolation by user

---

## Step 4: Execute Migration 3 - Seed Data

### File: `supabase/migrations/20250814000003_seed_data.sql`

1. **Create a new query** in SQL Editor
2. **Copy entire contents** from this file
3. **Paste into SQL Editor**
4. **Click**: "Run"
5. **Wait for completion**

**What this creates:**

- ✓ Test users (student@edulive.app, teacher@edulive.app, admin@edulive.app)
- ✓ Student/Teacher/Admin profiles
- ✓ Sample subjects/courses
- ✓ Enrollments
- ✓ Tests and assignments
- ✓ All passwords hashed with bcrypt

**Test Accounts Created:**

```
Email: student@edulive.app / Password: demo1234
Email: teacher@edulive.app / Password: demo1234
Email: admin@edulive.app / Password: demo1234
```

---

## Step 5: Verify All Migrations Succeeded

After all 3 migrations complete, run this verification query:

```sql
-- Count all tables
SELECT COUNT(*) as total_tables FROM information_schema.tables
WHERE table_schema = 'public';

-- List all tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Expected result: 24 tables**

---

## Troubleshooting

### If Migration 1 Fails: "Extension pgcrypto does not exist"

**Solution:**

1. Go to **Database** → **Extensions**
2. Search for "pgcrypto"
3. **Enable** it
4. Re-run Migration 1

### If Any Migration Fails: "Error in line X"

**Solution:**

1. Expand the error in the SQL Editor
2. Note the line number
3. Review [DATABASE_SETUP.md](DATABASE_SETUP.md) troubleshooting section
4. Or contact support

### If Tables Exist But Migration Fails

**Solution:**

1. Check if running tests have existing data
2. You can safely re-run migrations (they're idempotent)
3. Or delete the schema and restart

---

## Next Steps After Migrations

✅ All migrations completed?

**Then run the verification script:**

```bash
npm run dev
```

The application should:

- ✓ Connect to Supabase successfully
- ✓ Load test data from database
- ✓ Display in browser at http://localhost:5173
- ✓ Show 0 TypeScript errors
- ✓ Show 0 console errors

---

## File Locations

All migration files are in: `supabase/migrations/`

| File                            | Purpose                | Lines |
| ------------------------------- | ---------------------- | ----- |
| 20250814000001_init_schema.sql  | Create tables & schema | 2000+ |
| 20250814000002_rls_policies.sql | Security policies      | 400+  |
| 20250814000003_seed_data.sql    | Test data              | 500+  |

---

## Need Help?

- **Setup questions**: See [DATABASE_SETUP.md](DATABASE_SETUP.md)
- **API reference**: See [DB_SERVICES_REFERENCE.md](DB_SERVICES_REFERENCE.md)
- **Getting started**: See [QUICKSTART.md](QUICKSTART.md)

---

## What Comes Next?

After verifying migrations:

1. ✅ Phase 1 Complete: Database Foundation (done!)
2. ⏳ Phase 2: Supabase Auth integration
3. ⏳ Phase 3: Component migration to database

**Stay in Phase 1 until all verification is complete!**

---

Made with ❤️ for EduLive
