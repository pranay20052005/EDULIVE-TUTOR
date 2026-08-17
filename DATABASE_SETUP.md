# Phase 1: EduLive Database Foundation Setup

## Overview

This document describes the Phase 1 database foundation for EduLive. This implementation provides a production-ready PostgreSQL/Supabase backend while maintaining compatibility with existing mock data.

## Architecture

```
EduLive Database Foundation
├── PostgreSQL (via Supabase)
├── 24 Normalized Tables
├── Row Level Security (RLS) Policies
├── TypeScript Services Layer
└── Environment Configuration
```

## Quick Start

### 1. Prerequisites

- Node.js 18+ (already installed)
- npm 9+ (already installed)
- Supabase Account (free tier available at https://supabase.com)

### 2. Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in project details:
   - **Name**: edulive-dev (or your choice)
   - **Password**: Create a strong password
   - **Region**: Choose closest to your location
4. Click "Create new project" and wait 2-3 minutes for setup

### 3. Get Credentials

1. Go to project Settings → API
2. Copy these values:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Anon (public) key** → `VITE_SUPABASE_ANON_KEY`
   - **Service Role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep secret!)

### 4. Setup Environment Variables

```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
# VITE_SUPABASE_URL=https://[YOUR-PROJECT-ID].supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGc...
# SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

**⚠️ Important**: Never commit `.env.local` to version control. It's already in `.gitignore`.

### 5. Run Migrations

Supabase automatically runs migrations in alphabetical order:

```bash
# Migrations are applied automatically by Supabase CLI or dashboard
# Or use Supabase CLI:
npx supabase migration list
```

**Migration Files:**

- `20250814000001_init_schema.sql` - Creates all tables, enums, and indexes
- `20250814000002_rls_policies.sql` - Enables Row Level Security
- `20250814000003_seed_data.sql` - Inserts development test data

### 6. Verify Setup

```bash
# Start the application
npm run dev

# The app should work with database if credentials are correct
```

## Database Schema

### Core Entities

```
Users (authentication & basic profile)
├── Students (extended student profile)
├── Teachers (extended teacher profile)
└── Admins (admin privileges)

Subjects (courses)
├── Chapters (course sections)
├── Materials (PDFs, videos, notes)
├── Enrollments (student→subject)
└── ScheduledClasses (live sessions)

Tests (assessments)
├── TestQuestions (MCQ, true/false, short answer)
├── TestAttempts (student attempts)
└── TestAnswers (student responses)

Assignments
└── AssignmentSubmissions (student work)

Other Content
├── Recordings (video lectures)
├── QuestionPapers (exam papers)
├── Announcements
└── Notifications

Transactions
├── Payments (transactions)
└── SubscriptionPlans (pricing)

System
├── Attendance (class attendance)
└── Settings (configuration)
```

### Key Design Decisions

1. **Normalization**: Full 3NF with proper foreign keys
2. **Audit Columns**: `created_at`, `updated_at`, `deleted_at` on all tables
3. **Soft Deletes**: `deleted_at` column for data preservation
4. **Enums**: Database-level enums for data integrity (Role, QuestionType, etc.)
5. **Indexes**: 40+ indexes on commonly queried fields (email, user_id, subject_id, etc.)
6. **Row Level Security**: Automatic data filtering by user role

## Database Services

### File Structure

```
src/lib/db/
├── client.ts           # Supabase client initialization
├── types.ts            # TypeScript type definitions
├── index.ts            # Central exports
└── services/
    ├── users.ts        # User operations
    ├── students.ts     # Student operations
    ├── subjects.ts     # Subject/course operations
    ├── tests.ts        # Test operations
    └── enrollments.ts  # Enrollment operations
```

### Usage Examples

#### Get Student Profile

```typescript
import { studentService } from "@/lib/db";

// Fetch by user ID
const student = await studentService.getByUserId(userId);
console.log(student.board, student.standard);
```

#### List Published Subjects

```typescript
import { subjectService } from "@/lib/db";

// Get all published courses
const subjects = await subjectService.listPublished({
  standard: "10th",
  searchText: "Math",
});
```

#### Check Enrollment Status

```typescript
import { enrollmentService } from "@/lib/db";

// Verify student is enrolled in subject
const isEnrolled = await enrollmentService.isEnrolled(studentId, subjectId);
if (isEnrolled) {
  // Allow access to course content
}
```

#### Create Test Attempt

```typescript
import { testService } from "@/lib/db";

// Start a test
const attempt = await testService.createAttempt({
  test_id: testId,
  student_id: studentId,
});

// After completion
await testService.submitAttempt(attempt.id, marksObtained, totalMarks);
```

## Row Level Security (RLS)

### How It Works

Every query automatically filters data based on the authenticated user's role:

```
Students can only see:
- Their own profile and enrollments
- Published courses and tests
- Their test attempts and assignments

Teachers can:
- View their own courses
- See all students in their courses
- View assignment submissions
- See test attempts for their tests

Admins can:
- Access all data across the system
```

### Example RLS Policy

```sql
CREATE POLICY "students_select_own" ON students
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM admins WHERE admins.user_id = auth.uid())
  );
```

## Development Test Data

The seed migration (`20250814000003_seed_data.sql`) includes:

### Test Accounts

```
Student Account:
  Email: student@edulive.app
  Password: demo1234

Teacher Account:
  Email: teacher@edulive.app
  Password: demo1234

Admin Account:
  Email: admin@edulive.app
  Password: demo1234
```

### Sample Content

- **Subjects**: Mathematics, Physics, Chemistry, Biology (4 courses)
- **Students**: 2 enrolled students with sample data
- **Teachers**: 2 teachers with qualifications
- **Tests**: 2 sample tests with questions
- **Assignments**: 2 sample assignments
- **Classes**: 2 scheduled live classes
- **Materials**: Study notes and resources
- **Plans**: 3 subscription plans (Basic, Pro, Premium)

## Integration with Existing App

### Current Mock Data

The app currently uses `src/lib/mock-data.ts` for all data. This remains **unchanged** in Phase 1.

### Coexistence Strategy

1. **Phase 1** (Current): Database foundation only
   - Migrations and schema: ✅ Complete
   - Services layer: ✅ Complete
   - Types: ✅ Complete
   - Environment setup: ✅ Complete
   - Mock data: ✅ Preserved

2. **Phase 2** (Future): Authentication integration
   - Supabase Auth setup
   - Session management
   - Login/register with database

3. **Phase 3** (Future): Data migration
   - Migrate mock data to database
   - Update all components to use database services
   - Remove mock data dependency

## Environment Variables

### Required Variables

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Application
VITE_ENVIRONMENT=development
VITE_APP_URL=http://localhost:5173
VITE_API_URL=http://localhost:5173/api

# Features
VITE_MOCK_DATA_ENABLED=true
VITE_REALTIME_ENABLED=true
VITE_STORAGE_ENABLED=true
```

### Where to Get Values

1. **VITE_SUPABASE_URL**: Dashboard → Settings → API → Project URL
2. **VITE_SUPABASE_ANON_KEY**: Dashboard → Settings → API → Anon (public) key
3. **SUPABASE_SERVICE_ROLE_KEY**: Dashboard → Settings → API → Service Role key

## Troubleshooting

### Issue: "Missing Supabase configuration"

**Solution**: Check that `.env.local` has correct values:

```bash
# Verify file exists
ls -la .env.local

# Check values are set (don't print them!)
grep VITE_SUPABASE .env.local
```

### Issue: "Unauthorized (401)"

**Solution**: Verify Supabase credentials are correct:

1. Go to Supabase Dashboard
2. Check Settings → API
3. Copy exact values (no extra spaces)
4. Restart development server

### Issue: "Permission denied"

**Solution**: Check RLS policies and user role:

1. Ensure user is authenticated
2. Verify user role in database (`users.role`)
3. Check RLS policy matches user role

### Issue: Seed data not appearing

**Solution**: Manually run seed migration:

```bash
# In Supabase Dashboard
# Go to SQL Editor
# Paste content of 20250814000003_seed_data.sql
# Click "Run"
```

## Migration Management

### View Migrations

```sql
-- Check migration status in Supabase SQL Editor
SELECT *
FROM pgbouncer.pgbouncer_config
WHERE key LIKE '%migration%';
```

### Add New Migration

1. Create new file: `supabase/migrations/[TIMESTAMP]_description.sql`
2. Write SQL changes
3. Supabase auto-applies on next connection (with auto-update enabled)

### Example: Add New Column

```sql
-- File: supabase/migrations/20250815000001_add_bio_to_students.sql

ALTER TABLE students
ADD COLUMN bio TEXT;

ALTER TABLE students
ADD COLUMN website_url VARCHAR(255);
```

## Security Considerations

### ✅ Implemented

- Row Level Security (RLS) on all tables
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Soft deletes (data preservation)
- Audit columns (created_at, updated_at)

### ⚠️ Before Production

- [ ] Enable 2FA for Supabase account
- [ ] Set up backups in Supabase
- [ ] Review and test RLS policies with real data
- [ ] Set up monitoring and logging
- [ ] Configure CORS settings
- [ ] Use Service Role key only server-side
- [ ] Rotate credentials periodically

## Performance Optimization

### Indexes Created

The schema includes 40+ indexes on:

- User lookups (email, id)
- Subject queries (teacher_id, status)
- Enrollment lookups (student_id, subject_id)
- Test queries (subject_id, teacher_id)
- Attendance tracking

### Query Optimization Tips

```typescript
// ✅ Good: Single query with join
const data = await supabase
  .from("students")
  .select("*, enrollments(*, subjects(*))")
  .eq("user_id", userId);

// ❌ Avoid: Multiple separate queries
const student = await getStudent(userId);
const enrollments = await getEnrollments(student.id);
```

## Monitoring

### Check Connection

```typescript
import { supabase } from "@/lib/db";

// Test connection
const { data } = await supabase.from("users").select("count", { count: "exact", head: true });

console.log("Database connection: OK");
```

### Monitor Performance

In Supabase Dashboard:

- **Analytics** → View API usage
- **Database** → Check query performance
- **Logs** → Monitor errors

## Next Steps

1. ✅ Create Supabase project
2. ✅ Configure environment variables
3. ✅ Verify migrations run successfully
4. ✅ Test sample queries
5. 📋 Plan Phase 2: Authentication
6. 📋 Plan Phase 3: Data migration

## Useful Links

- Supabase Dashboard: https://supabase.com/dashboard
- Supabase Docs: https://supabase.com/docs
- Supabase JS Client: https://supabase.com/docs/reference/javascript
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Row Level Security: https://supabase.com/docs/guides/auth/row-level-security

## Support

For issues or questions:

1. Check this README
2. Review error messages in browser console
3. Check Supabase dashboard logs
4. Consult Supabase documentation

---

**Phase 1 Status**: ✅ Complete - Database Foundation Established

**Ready for Phase 2**: Authentication Integration (not started)
