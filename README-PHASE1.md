# EduLive - Online Learning Management System

A full-featured online learning platform built with React, TypeScript, and TanStack, providing comprehensive educational management for students, teachers, and administrators.

## Project Status

🚀 **Phase 1: Database Foundation** - ✅ Complete

- PostgreSQL/Supabase backend schema
- Row-level security policies
- TypeScript service layer
- Development seed data
- Ready for Phase 2 integration

## Features

### For Students

- 📚 Enroll in multiple courses
- 🧪 Take online tests with timer and scoring
- 📝 Submit assignments
- 📺 Watch recorded lectures
- 📊 Track academic performance
- 📅 View class attendance
- 🔔 Receive notifications
- 💬 Attend live classes

### For Teachers

- 📖 Create and manage courses
- ❓ Build tests with multiple question types
- 📋 Create assignments and grade submissions
- 🎥 Record and publish lectures
- 👥 Track student enrollment and attendance
- 📊 View performance analytics
- 🗣️ Conduct live classes
- 📢 Share announcements

### For Admins

- 👤 Manage users (students, teachers)
- 📚 Oversee all courses
- 💰 Handle subscriptions and payments
- 📊 View system-wide analytics
- ⚙️ Configure system settings

## Tech Stack

### Frontend

- **React 18+** with TypeScript
- **TanStack Start** - Full-stack React framework with SSR
- **TanStack Router** - File-based routing
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library (50+ pre-built components)

### Backend

- **PostgreSQL** - Primary database
- **Supabase** - Backend as a Service
- **Row Level Security** - Automatic data filtering
- **Authentication** - Supabase Auth (coming in Phase 2)

### Build & Development

- **Vite** - Lightning-fast build tool
- **TypeScript** - Type-safe code
- **npm** - Package manager
- **ESLint** - Code quality

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Clone or navigate to project
cd /Users/pranayshetty/Downloads/EDULIVE

# Install dependencies
npm install

# Setup database (see DATABASE_SETUP.md)
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Test Credentials (Development)

```
Student: student@edulive.app / demo1234
Teacher: teacher@edulive.app / demo1234
Admin:   admin@edulive.app / demo1234
```

## Database Setup

**Important**: Phase 1 includes a complete database foundation but is currently running with mock data. To use the real database:

👉 **See [DATABASE_SETUP.md](./DATABASE_SETUP.md)** for detailed setup instructions.

### What's Included

1. **Schema** - 24 normalized tables (migrations/20250814000001_init_schema.sql)
2. **Security** - Row-level security policies (migrations/20250814000002_rls_policies.sql)
3. **Seed Data** - Development test data (migrations/20250814000003_seed_data.sql)
4. **Services** - TypeScript query layer (src/lib/db/)
5. **Types** - Full type definitions (src/lib/db/types.ts)

## Project Structure

```
EDULIVE/
├── public/                 # Static assets
├── src/
│   ├── components/         # React components
│   │   ├── ui/            # shadcn/ui components
│   │   ├── faculty/       # Teacher-specific components
│   │   └── ...
│   ├── hooks/             # Custom React hooks
│   ├── lib/
│   │   ├── db/            # Database services (NEW - Phase 1)
│   │   │   ├── client.ts  # Supabase client
│   │   │   ├── types.ts   # Type definitions
│   │   │   └── services/  # Data services
│   │   ├── types.ts       # Domain types
│   │   ├── mock-data.ts   # Demo data (preserved)
│   │   ├── auth.ts        # Auth logic
│   │   ├── session.tsx    # Session context
│   │   └── ...
│   ├── routes/            # Page routes (46 total)
│   │   ├── __root.tsx     # App shell
│   │   ├── app.tsx        # Student dashboard
│   │   ├── teacher.tsx    # Teacher dashboard
│   │   ├── admin.tsx      # Admin dashboard
│   │   └── ...
│   ├── styles/            # Global styles
│   ├── server.ts          # Server entry point
│   ├── start.ts           # Client entry point
│   └── router.tsx         # Router config
├── supabase/              # Database migrations (NEW - Phase 1)
│   └── migrations/        # SQL migration files
├── .env.example           # Environment template (NEW - Phase 1)
├── DATABASE_SETUP.md      # Database guide (NEW - Phase 1)
└── package.json
```

## Available Scripts

```bash
# Development
npm run dev          # Start dev server (http://localhost:5173)

# Build
npm run build        # Create production build
npm run preview      # Preview production build

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler

# Database
npm run db:push      # Push schema to database (requires Supabase CLI)
npm run db:migrate   # Run migrations
```

## Routes Overview

### Public Routes

- `/` - Landing page
- `/login` - Student/teacher login
- `/register` - Registration
- `/forgot-password` - Password recovery

### Student Routes (under `/app`)

- `/app` - Dashboard
- `/app/courses` - Browse courses
- `/app/subjects` - My subjects
- `/app/tests` - Take tests
- `/app/assignments` - Submit assignments
- `/app/results` - View results
- `/app/attendance` - Check attendance
- `/app/live` - Live classes
- `/app/profile` - Profile settings
- And more...

### Teacher Routes (under `/teacher`)

- `/teacher` - Dashboard
- `/teacher/subjects` - Manage courses
- `/teacher/students` - View students
- `/teacher/tests` - Create tests
- `/teacher/assignments` - Grade assignments
- `/teacher/live` - Conduct live classes
- `/teacher/attendance` - Mark attendance
- And more...

### Admin Routes (under `/admin`)

- `/admin` - Dashboard
- `/admin/students` - Manage students
- `/admin/teachers` - Manage teachers
- `/admin/subjects` - Oversee subjects
- `/admin/subscriptions` - Manage plans
- And more...

## Core Concepts

### Roles

- **Student**: Learn, take tests, submit assignments
- **Teacher**: Create content, manage classes, grade work
- **Admin**: Oversee system, manage users, analytics

### Data Model

- **Users** → accounts with roles
- **Students/Teachers** → role-specific profiles
- **Subjects** → courses with teacher
- **Enrollments** → student→subject relationships
- **Tests** → assessments with questions
- **Assignments** → work submissions
- **Classes** → scheduled live sessions
- **Materials** → course content (videos, PDFs, notes)

### Authentication (Current)

Phase 1 uses mock authentication with hardcoded demo accounts. Phase 2 will integrate Supabase Auth for production authentication.

## Configuration

### Environment Variables

```env
# Database (required for real data)
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Application
VITE_ENVIRONMENT=development
VITE_APP_URL=http://localhost:5173

# Features
VITE_REALTIME_ENABLED=true
```

See [.env.example](.env.example) for all options.

## Phase Roadmap

### ✅ Phase 1: Database Foundation (Complete)

- PostgreSQL schema with 24 tables
- Row-level security policies
- TypeScript service layer
- Development environment setup
- Seed data for testing

### 📋 Phase 2: Authentication (Planned)

- Supabase Auth integration
- Login/register with database
- Session management
- Role-based access control
- OAuth integrations

### 📋 Phase 3: Data Migration (Planned)

- Migrate mock data to database
- Update components for database queries
- Performance optimization
- Caching strategies

### 📋 Phase 4: Advanced Features (Planned)

- Real-time notifications
- Video streaming
- File uploads
- Payment processing
- Advanced analytics

## Development Guidelines

### Adding New Features

1. **Update database schema** (if needed)
   - Create migration: `supabase/migrations/[timestamp]_description.sql`
   - Define TypeScript types in `src/lib/db/types.ts`

2. **Create service layer**
   - Add functions to `src/lib/db/services/`
   - Export from `src/lib/db/index.ts`

3. **Build UI components**
   - Create in `src/components/`
   - Use existing UI components from `src/components/ui/`

4. **Add routes**
   - Create in `src/routes/`
   - Use TanStack Router conventions

### Code Quality

- TypeScript strict mode enabled
- ESLint configured for code style
- Pre-commit checks recommended
- 50+ UI components available (shadcn/ui)

## Performance Optimization

### Database

- 40+ indexes on frequently queried fields
- Connection pooling via Supabase
- Optimized queries with proper joins

### Frontend

- Code splitting via TanStack Router
- Lazy loading of components
- Tailwind CSS with purging
- Optimized images and assets

### Caching (Coming Soon)

- React Query for data caching
- Local storage for session data
- Service worker for offline support

## Security Measures

### ✅ Implemented

- Row-level security on all database tables
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Soft deletes for data preservation
- Audit columns (created_at, updated_at)

### 📋 Coming in Phase 2

- Supabase Auth integration
- JWT token management
- CSRF protection
- Rate limiting
- Two-factor authentication

## Troubleshooting

### Build Issues

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Database Connection

See [DATABASE_SETUP.md](./DATABASE_SETUP.md) → Troubleshooting section

### Development Server

```bash
# Clear next build cache
rm -rf .output dist
npm run dev
```

## Useful Commands

```bash
# View TypeScript errors
npm run type-check

# Format code (if prettier installed)
npm run format

# Check dependencies
npm list

# Update dependencies
npm update
```

## Contributing

When contributing:

1. Follow existing code style
2. Keep TypeScript strict mode happy
3. Test with both mock data and database
4. Update documentation if needed
5. Run `npm run lint` before committing

## License

[Add your license here]

## Support & Documentation

- 📖 **Database Setup**: [DATABASE_SETUP.md](./DATABASE_SETUP.md)
- 🏗️ **Architecture**: See project structure above
- 🗺️ **Routes**: See routes overview above
- 🛠️ **Components**: Check `src/components/`
- 📦 **Dependencies**: Check `package.json`

## Changelog

### Phase 1 (Current Release)

- ✅ Complete PostgreSQL schema (24 tables)
- ✅ Row-level security policies
- ✅ TypeScript service layer
- ✅ Database client initialization
- ✅ Development seed data
- ✅ Environment configuration
- ✅ Comprehensive documentation

---

**Version**: 1.0.0 (Phase 1)  
**Last Updated**: 2025-01-14  
**Status**: Development with Database Foundation
