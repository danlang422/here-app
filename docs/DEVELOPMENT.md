# Development Guide

## Initial Setup

### Prerequisites
- Node.js 18 or higher
- npm or yarn package manager
- Supabase account (free tier is fine for development)
- Git for version control

### Environment Variables
Create a `.env.local` file in the project root:
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Get these values from your Supabase project dashboard under Settings > API.

### Installation
```bash
npm install
```

## Development Workflow

### Running the App
```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

### Running Tests
```bash
npm test
```
_(Testing framework to be set up)_

### Building for Production
```bash
npm run build
npm start
```

### Linting and Formatting
```bash
npm run lint          # Check for code issues
npm run format        # Format code with Prettier
```

## Common Tasks

### Adding a New Page
1. Create a new folder in `/app` with your route name
2. Add a `page.tsx` file in that folder
3. Export a default component

Example:
```tsx
// app/student/schedule/page.tsx
export default function SchedulePage() {
  return <div>Student Schedule</div>
}
```

### Creating a Component
1. Create component file in appropriate `/components` subfolder
2. Use TypeScript for props definition
3. Export as named export

Example:
```tsx
// components/student/CheckInButton.tsx
interface CheckInButtonProps {
  sectionId: string
  onCheckIn: () => void
}

export function CheckInButton({ sectionId, onCheckIn }: CheckInButtonProps) {
  return <button onClick={onCheckIn}>Check In</button>
}
```

### Working with Supabase

#### Setting up Supabase Client
```tsx
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

const supabase = createClientComponentClient()
```

#### Querying Data
```tsx
const { data, error } = await supabase
  .from('sections')
  .select('*')
  .eq('student_id', userId)
```

#### Real-time Subscriptions
```tsx
const channel = supabase
  .channel('check-ins')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'check_ins' },
    (payload) => console.log(payload)
  )
  .subscribe()
```

### Styling with Tailwind

Tailwind uses utility classes directly in your JSX:

```tsx
<button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
  Check In
</button>
```

Common patterns:
- Spacing: `p-4` (padding), `m-2` (margin), `space-y-4` (vertical spacing between children)
- Layout: `flex`, `grid`, `hidden md:block` (responsive visibility)
- Colors: `bg-blue-500`, `text-gray-700`, `border-red-300`
- Typography: `text-lg`, `font-semibold`, `text-center`

## Performance Best Practices

### Use Server Components by Default

When creating new pages, follow the server component pattern:

**Pattern:**
1. Create async server component that fetches data
2. Pass data to client component as props
3. Client component handles interactivity only

**Example:**
```tsx
// app/admin/mypage/page.tsx (Server Component)
export default async function MyPage() {
  const data = await getData()  // Fetch on server
  return <MyPageClient initialData={data} />
}

// components/admin/MyPageClient.tsx
'use client'
export default function MyPageClient({ initialData }) {
  const [data, setData] = useState(initialData)
  // Interactive features here
}
```

**Benefits:**
- Data arrives with HTML (no loading spinner)
- Smaller JS bundle (less client-side code)
- Faster perceived load time

### Avoid N+1 Query Patterns

When fetching related data, use single queries with JOINs or views:

**Bad (N+1):**
```tsx
const items = await getItems()  // 1 query
for (const item of items) {
  item.count = await getCount(item.id)  // N queries
}
```

**Good (Single Query):**
```tsx
const items = await supabase
  .from('items_with_counts')  // Database view
  .select('*')
```

Or use Supabase's relational queries:
```tsx
const items = await supabase
  .from('items')
  .select(`
    *,
    related_table(count)
  `)
```

### Database Views for Computed Data

Create views for frequently accessed computed data:
- Enrollment counts
- Aggregated statistics
- Complex JOINs used in multiple places

See `supabase/migrations/003_add_sections_with_counts_view.sql` for example.

## Troubleshooting

### Supabase Connection Issues
**Symptom:** "Invalid API key" or connection errors
**Solution:** 
1. Check that `.env.local` exists and has correct values
2. Restart dev server after changing environment variables
3. Verify API keys in Supabase dashboard

### Build Errors After Adding Dependencies
**Symptom:** TypeScript errors about missing types
**Solution:**
```bash
npm install
npm run dev
```

### Geolocation Not Working
**Symptom:** Browser doesn't prompt for location
**Solution:** 
- Geolocation requires HTTPS in production
- In development, localhost is treated as secure
- Check browser permissions for location access

## Database Management

### Viewing Database Schema
Use Supabase Studio (dashboard) to view and edit tables.

### Running Migrations
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Pull remote schema
supabase db pull

# Create new migration
supabase migration new your_migration_name

# Push migrations to remote
supabase db push
```

### Seeding Test Data
_(To be implemented - will likely use Supabase SQL editor or seed scripts)_

## Deployment

### Vercel Deployment
1. Push code to GitHub repository
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on push to main branch

### Environment Variables for Production
Add these in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Database Setup for Production
The same Supabase project can be used for both development and production, or you can create separate projects for each environment.

## Git Workflow

### Branching
- `main` - Production-ready code
- `dev` - Development branch
- Feature branches: `feature/check-in-flow`, `feature/teacher-dashboard`

### Commits
Follow atomic commit principles:
- One logical change per commit
- Clear, descriptive commit messages
- Stage and commit frequently

Example commits:
```
Add section model and basic schedule display
Implement geolocation capture for check-ins
Create check-in form with plan prompt
```
