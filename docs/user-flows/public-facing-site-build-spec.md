# Public-Facing Site — Build Spec

**Date:** April 16, 2026
**Status:** Ready to build
**Related:** `AppLayout.jsx`, `AuthProvider.jsx`, `ProtectedRoute.jsx`, `docs/user-flows/visual-design-system-design-doc.md`, `here-product-privacy-data-sheet.pdf`

**Context:** Staff at City View are ready to bring Here to the district for approval for broader student use. The district will need to review the app and its data handling practices before approving it. This means Here needs a public-facing presence — a landing page that introduces the app, a trust/privacy page that summarizes our data practices, and a downloadable privacy data sheet that can be shared with district IT or legal staff.

**Design principle:** Clean and functional over polished and marketing-heavy. The audience for this site is parents, staff, and district administrators who need to understand what the app is and that it takes data privacy seriously. No screenshots yet (the UI is still being revised in places), no testimonials, no feature tours. Honest, plainly-written content that's easy to scan.

**Scope boundary:** This spec covers the public landing page, the trust page, the privacy data sheet PDF link, and the routing changes to support public/authenticated route separation. It does NOT cover:

- Screenshots or feature tours (deferred — UI still stabilizing)
- In-app help/knowledge pages (that's #61, a separate effort)
- A full brand identity system beyond what the visual design system already establishes
- Blog, news, or updates content
- Contact forms (a simple `mailto:` link is sufficient for now)

A follow-up issue should be created for polished marketing work once the app is more stable: screenshots demonstrating student/teacher/admin experiences, richer copy, and any additional public pages that emerge from district conversations.

---

## Part 1: Routing Architecture

### Goal

The root route `/` should serve different content based on authentication state:

- **Unauthenticated visitors** → see the public landing page
- **Authenticated visitors** → redirect to their role-specific home (`/admin`, `/teacher`, or `/student`)

Public routes (`/`, `/trust`, `/about`) are accessible to everyone without authentication. They render with a new `PublicLayout` that's distinct from the existing `AppLayout`.

### Route structure

```jsx
// In App.jsx

// Public routes (no auth required)
<Route path="/" element={<RootRedirect />} />
<Route path="/trust" element={<PublicLayout><TrustPage /></PublicLayout>} />
<Route path="/about" element={<PublicLayout><AboutPage /></PublicLayout>} />

// Auth routes (existing — unchanged)
<Route path="/login" element={<LoginPage />} />
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />

// Authenticated app routes (existing — unchanged)
<Route path="/admin/*" element={<ProtectedRoute requiredRole="admin">...</ProtectedRoute>} />
<Route path="/teacher/*" element={<ProtectedRoute requiredRole="teacher">...</ProtectedRoute>} />
<Route path="/student/*" element={<ProtectedRoute requiredRole="student">...</ProtectedRoute>} />
<Route path="/help" element={...} />  // existing
<Route path="/account" element={...} />  // existing
```

### Component: `RootRedirect`

A small routing component that handles the auth-aware behavior at `/`.

```jsx
// src/components/layout/RootRedirect.jsx
function RootRedirect() {
  const { user, profile, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;

  if (!user) {
    return <PublicLayout><LandingPage /></PublicLayout>;
  }

  // Authenticated — redirect to role home
  const activeRole = profile?.activeRole || profile?.roles?.[0];
  if (activeRole === 'admin') return <Navigate to="/admin" replace />;
  if (activeRole === 'teacher') return <Navigate to="/teacher" replace />;
  if (activeRole === 'student') return <Navigate to="/student" replace />;

  // Fallback — no valid role somehow
  return <Navigate to="/login" replace />;
}
```

The exact mechanism for determining a user's "active role" should match whatever the existing auth flow uses after login (check `AuthProvider` / `authStore`).

### Impact on existing routes

None. The existing authenticated routes (`/admin/*`, `/teacher/*`, `/student/*`) continue to work exactly as they do today. The only change to existing behavior is that unauthenticated users hitting `/` now see a landing page instead of being redirected to `/login`.

Users who explicitly hit `/login` still see the login page — that route is unchanged.

---

## Part 2: PublicLayout Component

### File: `src/components/layout/PublicLayout.jsx`

A layout wrapper for all public pages. Distinct from `AppLayout`:

- No sidebar, no role switcher, no authenticated-user navigation
- Simple header with wordmark and minimal nav
- Footer with links to trust page, privacy PDF, contact email, and copyright

### Header

```
┌──────────────────────────────────────────────────────────────┐
│  Here                                    About  Trust  Log in │
└──────────────────────────────────────────────────────────────┘
```

- **Wordmark:** Left-aligned. "Here" in Outfit 700 at 24px (slightly larger than in-app, since it's the focal point). Links to `/`.
- **Nav:** Right-aligned, horizontal. Links: About (→ `/about`), Trust (→ `/trust`), Log in (→ `/login`). The login link is visually emphasized — DaisyUI `btn btn-primary btn-sm` styling.
- **Background:** `base-100` (warm off-white). Thin `base-300` border on the bottom.
- **Padding:** `py-4 px-6` on desktop; `py-3 px-4` on mobile.

### Footer

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Here — Scheduling and attendance for alternative schools    │
│                                                              │
│  Trust & privacy  ·  Privacy data sheet (PDF)  ·  Contact    │
│                                                              │
│  © 2026 Daniel Lang                                          │
└──────────────────────────────────────────────────────────────┘
```

- Simple, centered or left-aligned text
- Links: Trust page, Privacy data sheet PDF (opens in new tab), `mailto:` contact link
- `base-200` background, `base-content/70` text color for muted feel
- `py-8` vertical padding

### Mobile responsiveness

Both header and footer should collapse gracefully on mobile. The header nav can either collapse to a hamburger menu or simply stack the links beneath the wordmark at small widths. Given the small number of links (3), stacking is fine — no hamburger needed.

### Typography

Use the existing font stack from the visual design system:
- Headings: Outfit (500/600/700)
- Body: Plus Jakarta Sans (400/500/600)

Body text on public pages can be slightly larger than in-app (e.g., `text-base` or `text-lg` for paragraph copy) — these are reading-oriented pages, not data-dense UI.

---

## Part 3: Landing Page

### File: `src/pages/public/LandingPage.jsx`

A single-page marketing introduction. No screenshots, no features grid. Just the About content, a clear call-to-action to log in, and links to learn more.

### Structure

```
┌──────────────────────────────────────────────────────────────┐
│  [Header]                                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                                                              │
│              Welcome, glad you're Here!                      │
│                                                              │
│              Scheduling and attendance for schools           │
│              with unique or unusual schedules.               │
│                                                              │
│                    [  Log in  ]                              │
│                                                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  About Here                                                  │
│                                                              │
│  [Body copy from the About section — see below]              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Built for trust                                             │
│                                                              │
│  Here is built with student privacy at its foundation.       │
│  We don't sell data, don't show ads, and don't collect       │
│  more than we need. Read our trust page for details.         │
│                                                              │
│                [ Read about our privacy practices → ]        │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [Footer]                                                    │
└──────────────────────────────────────────────────────────────┘
```

### Hero section

- Headline: **"Welcome, glad you're Here!"** — Outfit 700, large (`text-4xl` or `text-5xl`)
- Subhead: **"Scheduling and attendance for schools with unique or unusual schedules."** — Outfit 500, medium (`text-xl`)
- CTA button: **"Log in"** — DaisyUI `btn btn-primary btn-lg`, navigates to `/login`
- Generous vertical spacing (`py-20` or `py-24`)
- Centered horizontally, max-width container (`max-w-3xl`)

### About section

Headline: **"About Here"** — Outfit 600, `text-2xl`

Body copy (from Daniel's existing About draft):

> Here is a scheduling, attendance tracking, and engagement app designed for schools with unique or unusual schedules.
>
> Traditional Student Information Systems like Infinite Campus or PowerSchool were designed with traditional school schedules in mind, meaning all students and staff adhere to a fixed set of blocks or periods. This makes taking attendance easy from an administrative perspective: a student is either present or absent for each of the fixed periods. But it doesn't work well for students who engage in more unique activities — things like internships or external courses.
>
> Here attempts to bridge that gap, accommodating highly unique, flexible schedules for individual students while "rolling up" attendance data in a way that maps cleanly to blocks or periods.

- Plus Jakarta Sans 400, `text-lg` for body, good line-height (`leading-relaxed`)
- "Here" in the first sentence is bold (Plus Jakarta Sans 600)
- Max-width `max-w-2xl`, left-aligned
- Vertical padding `py-12`

### Trust section

Short teaser for the trust page. Not a replacement for the trust page itself — just enough to signal that privacy is a core concern and point people there.

Headline: **"Built for trust"** — Outfit 600, `text-2xl`

Body:

> Here is built with student privacy at its foundation. We don't sell data, don't show ads, and don't collect more than we need. Our security practices follow industry standards, and our data handling practices comply with FERPA and Iowa's Student Data Privacy Act.

CTA link: **"Read about our privacy practices →"** — navigates to `/trust`

Same typography and spacing as the About section.

### Visual treatment

Keep it clean. No hero images, no illustrations, no decorative elements yet. The warmth of the palette (warm off-white base, Outfit headings) provides enough character without additional visual flourishes. This is a deliberate choice — we can add visual polish once the app UI stabilizes and we have real screenshots to show.

Each section can have a subtle visual separator — either a thin `border-t border-base-300` or generous vertical whitespace between sections.

---

## Part 4: Trust Page

### File: `src/pages/public/TrustPage.jsx`

The friendly, scannable version of the privacy data sheet. Modeled structurally on Remind's trust page (remind.com/trust-safety) but with Here's specifics.

### Structure

```
┌──────────────────────────────────────────────────────────────┐
│  [Header]                                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Trust & Privacy                                             │
│                                                              │
│  Here is built with student privacy at its foundation.       │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Built for schools, not advertisers                          │
│  [short explanatory paragraph]                               │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Minimal data collection                                     │
│  [short explanatory paragraph]                               │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Your data stays yours                                       │
│  [short explanatory paragraph]                               │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Security                                                    │
│  [short explanatory paragraph]                               │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Compliance                                                  │
│  - FERPA (Family Educational Rights and Privacy Act)         │
│  - Iowa Student Data Privacy Act (Iowa Code § 279.71)        │
│  - COPPA (Children's Online Privacy Protection Rule)         │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Full documentation                                          │
│  For a detailed accounting of Here's data practices, see     │
│  our Privacy Data Sheet (PDF).                               │
│                                                              │
│                 [ Download Privacy Data Sheet ]              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [Footer]                                                    │
└──────────────────────────────────────────────────────────────┘
```

### Section copy

Each section is a short heading (Outfit 600, `text-xl`) followed by 1–2 short paragraphs (Plus Jakarta Sans 400, `text-base`).

**Hero:**
> # Trust & Privacy
> Here is built with student privacy at its foundation.

**Built for schools, not advertisers**
> Here doesn't display advertising and doesn't sell, rent, or share student data with marketers or advertisers. Student data is used exclusively for scheduling, attendance, and the engagement features described in the app. We have no commercial interest in student data beyond providing the service schools pay for.

**Minimal data collection**
> We collect only what's needed to make the app work: names, email addresses, schedule information, attendance records, and — for students enrolled in off-campus internships — location coordinates at the moment of check-in. We don't collect Social Security numbers, medical records, disciplinary records, browsing history, or behavioral profiles.

**Your data stays yours**
> The school retains full ownership of all student records stored in Here. Schools can export all their data at any time, and we'll delete it at their request. Individual students can view and edit their own content (status updates, comments) at any time through the app.

**Security**
> All data is encrypted in transit (HTTPS/TLS) and at rest (AES-256, handled by our infrastructure provider Supabase). Database access is governed by Row Level Security policies that enforce permissions at the query level — so students can only see their own records, teachers can only see records for their assigned activities, and so on. These are structural protections, not just UI-level restrictions.

**Compliance**

Rendered as a bulleted list or series of small cards:

- **FERPA** — Family Educational Rights and Privacy Act. Here operates as a "school official" under FERPA's school official exception, with a Data Processing Agreement in place with partnering schools.
- **Iowa Student Data Privacy Act** — Iowa Code § 279.71. Here complies with Iowa's specific requirements for operators of online services designed for K–12 school purposes.
- **COPPA** — Children's Online Privacy Protection Rule. Here is designed for high school use; if used with students under 13, the school acts as the consenting party consistent with FTC guidance.

**Full documentation**

Pull paragraph:

> For a detailed accounting of Here's data practices — including a complete list of data collected, third-party service providers, security protocols, breach notification procedures, and retention policies — see our Privacy Data Sheet.

CTA button: **"Download Privacy Data Sheet (PDF)"** — DaisyUI `btn btn-primary`, links to the hosted PDF (opens in new tab).

### Layout

- Max-width container (`max-w-3xl`), left-aligned
- Generous vertical spacing between sections (`py-8` or `py-10`)
- Optional: subtle `border-t border-base-300` between sections, or use whitespace alone

---

## Part 5: About Page

### File: `src/pages/public/AboutPage.jsx`

A dedicated page for the About content. Effectively a richer version of the About section on the landing page — for now, it can be nearly identical, but having a dedicated route means we can expand it later (who built Here, why City View, the thinking behind the design) without bloating the landing page.

### MVP content

For the initial build, the About page renders the same About copy as the landing page, perhaps with one additional section:

**Headline:** "About Here"

**Body:** The full About copy (same as landing page).

**Additional section — "Who's behind Here"**

> Here is built by Daniel Lang, a former high school teacher turned developer. The app was designed specifically for City View Community High School in Cedar Rapids, Iowa, where traditional Student Information Systems couldn't accommodate the school's flexible, individualized schedules. It's a solo project built with care, and if you have questions or feedback, you can reach me at [contact email].

(Daniel — feel free to edit the "Who's behind Here" copy. This is a first draft capturing what feels relevant for a district reviewer without over-explaining.)

### Layout

Same as the trust page — `max-w-3xl`, left-aligned, generous spacing.

---

## Part 6: Privacy Data Sheet PDF

### Hosting

The PDF should be added to the `public/` directory of the Vite project so it's served as a static asset:

```
public/
  documents/
    here-privacy-data-sheet.pdf
```

This makes it accessible at `https://sayhere.xyz/documents/here-privacy-data-sheet.pdf`.

Daniel will add the PDF to this location once the document is finalized and signed.

### Links

Link to the PDF from:

1. The trust page — "Download Privacy Data Sheet" CTA button
2. The public footer — "Privacy data sheet (PDF)" link
3. (Optional) The landing page trust teaser — though the primary CTA there should be the trust page, not the PDF directly

All PDF links should open in a new tab (`target="_blank" rel="noopener noreferrer"`).

### Versioning

For future iterations: when the PDF is updated, either:
- Overwrite the file at the same path (simplest — users always get the current version)
- Or include a date or version in the filename and update the links (preserves history but more maintenance)

Recommend overwriting for now. If the document changes materially, the site can display a small "Last updated: [date]" note next to the download link.

---

## Part 7: File Structure

New files to create:

```
src/
├── components/
│   └── layout/
│       ├── PublicLayout.jsx       # NEW — header + footer for public pages
│       └── RootRedirect.jsx       # NEW — auth-aware root route
├── pages/
│   └── public/                     # NEW subdirectory
│       ├── LandingPage.jsx         # NEW
│       ├── TrustPage.jsx           # NEW
│       └── AboutPage.jsx           # NEW
public/
└── documents/
    └── here-privacy-data-sheet.pdf # NEW (added by Daniel, not by Claude Code)
```

Modified files:

```
src/App.jsx                         # Add public routes, replace "/" route with RootRedirect
```

No changes needed to existing authenticated routes, AppLayout, AuthProvider, or any other existing components.

---

## Part 8: Testing Checklist

Manual testing after implementation:

- [ ] Unauthenticated user visits `/` → sees landing page with header/footer
- [ ] Unauthenticated user clicks "Log in" → goes to `/login`
- [ ] Authenticated admin visits `/` → redirects to `/admin`
- [ ] Authenticated teacher visits `/` → redirects to `/teacher`
- [ ] Authenticated student visits `/` → redirects to `/student`
- [ ] Authenticated user with both teacher and admin roles → redirects based on active role
- [ ] Unauthenticated user visits `/trust` → sees trust page
- [ ] Unauthenticated user visits `/about` → sees about page
- [ ] Authenticated user visits `/trust` → sees trust page (public pages work for logged-in users too)
- [ ] All nav links in PublicLayout header work
- [ ] All footer links work, including PDF download in new tab (after PDF is added)
- [ ] Landing page → Log in button works
- [ ] Trust page → PDF download button works (after PDF is added)
- [ ] Trust page → renders cleanly on mobile
- [ ] Landing page → renders cleanly on mobile
- [ ] Header nav stacks or collapses gracefully on mobile
- [ ] No console errors on any public page
- [ ] Typography matches visual design system (Outfit for headings, Plus Jakarta Sans for body)

---

## Open Questions / Deferred Decisions

1. **Contact email.** Daniel needs to decide whether to use a personal email or set up a dedicated address like `privacy@sayhere.xyz` or `contact@sayhere.xyz`. The contact link in the footer and the mention in the About page copy both reference this. Can be a placeholder string that Daniel replaces before deploy.

2. **Social links / other channels.** None for now. If Here ever has a Twitter/LinkedIn/GitHub public presence, add links to the footer.

3. **Screenshots and feature visuals.** Deferred to a follow-up issue once the UI is more stable.

4. **SEO metadata.** Basic `<title>` and `<meta name="description">` per page is worth including — Claude Code can set sensible defaults. Full Open Graph / Twitter card metadata can be added later.

5. **Analytics.** None for now. If added later, it should be privacy-respecting (e.g., Plausible or Umami) rather than Google Analytics — consistent with the trust positioning.

6. **"Who's behind Here" copy.** Daniel to review and refine.
