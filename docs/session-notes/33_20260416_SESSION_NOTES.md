# Session 33 — April 16, 2026

## 33.1 Public-facing site — landing page, trust page, about page, public routing

Built the public-facing presence for Here in preparation for district approval review. The district needs to evaluate the app and its data handling practices before approving broader student use, so Here needed a public landing page, a trust/privacy page, and a downloadable privacy data sheet.

**Branch:** `feat/public-facing-site`

### What was built

**New components:**

- `src/components/layout/RootRedirect.jsx` — auth-aware component mounted at `/`. Unauthenticated users see the landing page rendered inside `PublicLayout`; authenticated users are redirected to their role home (`/admin`, `/teacher`, `/student`) based on `currentRole` from `useAuthStore`. Falls back to `/login` if no valid role is found.
- `src/components/layout/PublicLayout.jsx` — shared header + footer wrapper for all public pages. Header has the wordmark (links to `/`) and nav links: About, Trust, Log in (styled as `btn btn-primary btn-sm`). Footer has the tagline, links to the trust page, the privacy PDF (opens in new tab), and a `mailto:` contact link, plus copyright.
- `src/pages/public/LandingPage.jsx` — hero section with the "Welcome, glad you're Here!" headline, About copy, and a trust teaser section linking to `/trust`.
- `src/pages/public/TrustPage.jsx` — six sections covering the school-not-advertiser stance, minimal data collection, data ownership, security practices (Supabase/RLS), compliance (FERPA, Iowa Student Data Privacy Act, COPPA), and a "Download Privacy Data Sheet" CTA button.
- `src/pages/public/AboutPage.jsx` — full About copy plus a "Who's behind Here" section with a mailto link.

**Modified files:**

- `src/App.jsx` — added `/`, `/trust`, `/about` routes using `RootRedirect` and `PublicLayout`. Changed the wildcard `*` fallback from `/dashboard` to `/` (the old `/dashboard` route no longer exists).
- `src/index.css` — added `.here-wordmark-inline` CSS class: same primary-color treatment and hover shimmer as the existing `.here-wordmark` class, but inherits font-size from parent rather than setting it explicitly. Used to apply the wordmark styling to inline "Here" mentions in headings and body copy on public pages.

**Pre-existing:** `public/documents/here-privacy-data-sheet.pdf` was already in place (added by Daniel before this session, with contact info and signature included).

### Key decisions

**`currentRole` instead of `profile?.activeRole`:** The spec suggested `profile?.activeRole` for determining where to redirect authenticated users in `RootRedirect`. The implementation uses `currentRole` from `useAuthStore()` instead, matching the existing pattern used in `DashboardRedirect`. This keeps auth logic consistent across the routing layer.

**No separate loading check in `RootRedirect`:** The spec included an `isLoading` guard. `AuthProvider` already manages global auth loading state and prevents child rendering until auth is resolved, so no additional guard was needed in `RootRedirect`.

**`.here-wordmark-inline` added to `index.css`:** The spec didn't explicitly call for this class, but inline "Here" references in headings and body copy on public pages needed the wordmark color/hover treatment without overriding the surrounding font-size. The existing `.here-wordmark` class sets its own font-size, which breaks inline usage. The new class inherits size from context.

**Intentionally minimal visual design:** No screenshots, no feature tour, no illustrations. Deliberate per spec — the UI is still stabilizing and the audience (parents, staff, district admins) needs clarity about data practices, not marketing. Warmth comes from the palette and typography (Outfit + Plus Jakarta Sans) rather than decorative elements.

### Deviations from spec

None. The spec was followed closely. The `currentRole` vs `profile?.activeRole` substitution is consistent with existing patterns, and the spec explicitly noted to match whatever the existing auth flow uses.

### What's next

- Merge `feat/public-facing-site` to main and deploy.
- Create a GitHub issue for polished marketing follow-up: screenshots demonstrating student/teacher/admin experiences, richer copy, and additional public pages that emerge from district conversations. The spec explicitly called for this as a follow-up.
- Continue with iteration 4 priorities (data re-entry, #61, #62, #21).
