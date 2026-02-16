# Here App - Attendance Tracking for City View Alternative High School

A modern, flexible attendance tracking application designed specifically for City View Alternative High School's complex scheduling needs, including A/B day rotations, off-campus internships, remote work, and monitoring sessions.

## Overview

Here App replaces manual spreadsheet-based attendance tracking with a streamlined web application that handles:

- **Complex scheduling:** A/B day rotations, variable block schedules, off-campus activities
- **Multiple activity types:** Standard classes, monitoring sessions, internships, independent study
- **Student engagement:** Check-ins with geolocation, presence waves with streaks, status updates
- **Teacher workflows:** Roster management, real-time monitoring, attendance marking
- **Admin tools:** Calendar management, session creation, conflict resolution, reporting

## Key Features

### For Students
- 📅 **Daily schedule view** with current block highlighted
- ✅ **Check-in/check-out** for remote work and internships (with geolocation validation)
- 👋 **Presence waves** with streak tracking for low-pressure engagement
- 💬 **Status updates** (plans, progress, reflections) throughout the day
- 📊 **Attendance history** with detailed records

### For Teachers
- 👥 **Session rosters** with real-time check-in status
- 📋 **Flexible attendance marking** (present, absent, excused, tardy)
- 💬 **Student engagement monitoring** with comments and reactions
- 🔍 **Activity-based grouping** for monitoring sessions
- 📈 **Attendance reports** and analytics

### For Admins
- 📅 **Calendar management** with rotation scheduling and special schedules
- 🎓 **Session creation** with enrollment management
- ⚙️ **Conflict resolution** for overlapping activities
- 📊 **System-wide reporting** and data export
- 👤 **User management** with role-based access

## Tech Stack

- **Frontend:** React 19 + Vite 7
- **Routing:** React Router v6
- **Styling:** Tailwind CSS + DaisyUI
- **Backend:** Supabase (PostgreSQL, Auth, Real-time)
- **Data Management:** TanStack Query (React Query)
- **State Management:** Zustand
- **Forms:** React Hook Form
- **Icons:** React Icons
- **Avatars:** DiceBear

## Prerequisites

- **Node.js** 18+ and npm
- **Supabase account** with a project created
- **Git** for version control

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd here-app
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Add your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Set Up Supabase Database

Run the SQL migrations found in `docs/DATABASE_SCHEMA.md` to create:
- Tables (user_profiles, sessions, enrollments, check_ins, etc.)
- Row Level Security (RLS) policies
- Indexes for performance

### 5. Configure Tailwind + DaisyUI

Update `tailwind.config.js`:

```js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        cityview: {
          "primary": "#3b82f6",
          "secondary": "#8b5cf6",
          "accent": "#10b981",
          "neutral": "#1f2937",
          "base-100": "#ffffff",
          "info": "#0ea5e9",
          "success": "#22c55e",
          "warning": "#f59e0b",
          "error": "#ef4444",
        },
      },
    ],
  },
}
```

Update `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 6. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Project Structure

```
here-app/
├── docs/                      # Comprehensive documentation
│   ├── DATABASE_SCHEMA.md     # Complete database design
│   ├── USER_FLOWS.md          # User workflows and interactions
│   ├── BUSINESS_LOGIC.md      # Rules and algorithms
│   └── SYSTEM_ARCHITECTURE.md # Technical architecture
│
├── src/
│   ├── api/                   # Supabase API functions
│   ├── components/            # React components
│   │   ├── ui/               # Base UI components
│   │   ├── layout/           # Layout components
│   │   ├── student/          # Student-specific components
│   │   ├── teacher/          # Teacher-specific components
│   │   └── admin/            # Admin-specific components
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Utilities and helpers
│   ├── pages/                 # Page components (routes)
│   ├── store/                 # Zustand stores
│   └── styles/                # Global styles
│
└── public/                    # Static assets
```

See `docs/SYSTEM_ARCHITECTURE.md` for detailed structure.

## Available Scripts

```bash
npm run dev      # Start development server (port 5173)
npm run build    # Build for production
npm run preview  # Preview production build locally
npm run lint     # Run ESLint
```

## Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md)** - Complete database schema, tables, relationships, and RLS policies
- **[USER_FLOWS.md](./docs/USER_FLOWS.md)** - Detailed user workflows for students, teachers, and admins
- **[BUSINESS_LOGIC.md](./docs/BUSINESS_LOGIC.md)** - Business rules, algorithms, and validation logic
- **[SYSTEM_ARCHITECTURE.md](./docs/SYSTEM_ARCHITECTURE.md)** - Technical architecture and implementation guide

## Key Concepts

### Three-Layer Activity System

1. **Enrollments** - Roster/accountability ("Who is responsible for this student?")
2. **Student Activities** - Actual work ("What is the student doing?")
3. **Enrollment Overrides** - Conflict resolution ("When doesn't the student attend enrolled sessions?")

### Schedule Conflict Resolution

When students have overlapping activities:
1. **Explicit overrides** take priority (enrollment_overrides table)
2. **Activity priority** determines default (conflict_priority field)
3. **Student choice** if no clear winner

### Engagement Options

Students can engage with activities in different ways:
- **Check-ins** - Required location-based accountability for remote work
- **Presence waves** - Optional one-time daily engagement with streak tracking
- **Status updates** - Share plans, progress, and reflections throughout sessions

## Development Workflow

### Setting Up for Development

1. Create feature branch: `git checkout -b feature/your-feature-name`
2. Make changes following project structure
3. Test locally with `npm run dev`
4. Commit with descriptive messages
5. Push and create pull request

### Code Organization

- **API functions** in `src/api/` organized by domain (students.js, sessions.js, etc.)
- **Custom hooks** in `src/hooks/` for reusable logic
- **Business logic** in `src/lib/business-logic/` following BUSINESS_LOGIC.md
- **Components** organized by role (student, teacher, admin) or shared
- **State** managed appropriately:
  - Server data → React Query
  - UI state → Zustand
  - Form state → React Hook Form

## Deployment

### Vercel Deployment (Recommended)

1. Connect GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy automatically on push to `main` branch

**Build Settings:**
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

## Contributing

### Before Submitting PRs

- [ ] Code follows project structure conventions
- [ ] Components are properly organized by role/domain
- [ ] Error handling implemented for async operations
- [ ] Loading states handled for data fetching
- [ ] Forms use React Hook Form with validation
- [ ] No console.logs in production code
- [ ] Code is formatted (Prettier) and linted (ESLint)

## License

This project is proprietary software developed for City View Alternative High School.

## Support

For questions or issues:
- Review documentation in `/docs`
- Check SYSTEM_ARCHITECTURE.md for implementation patterns
- Refer to BUSINESS_LOGIC.md for rules and algorithms

---

**Built with ❤️ for City View Alternative High School**
