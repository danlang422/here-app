# Here App — Visual Design System

**Date:** April 4, 2026
**Status:** Design doc — ready for build spec
**Scope:** App-wide visual polish pass. Covers palette, typography, icon consolidation, interaction design, component-level styling, and role-differentiated personality.

---

## Design Philosophy

**"Here feels like a well-made tool that someone clearly loved building."**

The foundation is warm, tactile, and physically grounded — not through skeuomorphic textures or illustrations, but through *interaction quality*: the way a button responds to a press, the way a card settles into place, the satisfying weight of a transition. The app should feel like a good physical device feels — not because it looks like one, but because every interaction has the right amount of resistance, feedback, and polish.

Personality comes through in specific, contained moments — conversational copy, playful micro-animations, warm feedback on student actions — rather than being wallpapered across every surface. The design language must scale from a student checking in on their phone to an admin managing 50+ activities in a week-view calendar.

### Concentric rings of personality

**Ring 1 — Universal foundation (everything gets this):** Warm palette, intentional typography, smooth interaction physics, consistent card anatomy, calendar-color accents, proper hover/focus/active states on all interactive elements.

**Ring 2 — Role-appropriate warmth:** Student pages are the friendliest (larger action buttons, conversational prompts, streaks). Teacher pages are warm but professional (clean data rows, icon indicators, wave counts). Admin pages are the most restrained (dense data, functional UI, personality lives in polish not decoration).

**Ring 3 — Surprise and delight (sprinkled, not systemic):** The "Here" wordmark treatment, playful empty states, animated toast feedback, streak celebrations, the Help page. These are Easter eggs that reward attention without distracting from function.

---

## Color Palette

### DaisyUI Custom Theme: `cityview`

The existing `cityview` theme in `src/index.css` is retained but adjusted. Key changes:

**Warm the base layer.** `base-100` shifts from pure white to a warm off-white. This single change affects every surface in the app and makes the whole thing feel friendlier.

```
--color-base-100: oklch(99.2% 0.005 90);    /* warm off-white, approx #FFFDF7 */
--color-base-200: oklch(96.5% 0.008 85);    /* warm light gray, approx #F5F2EB */
--color-base-300: oklch(91% 0.01 80);       /* warm mid-gray for borders */
```

The existing primary (blue), secondary (purple), accent (teal), and semantic colors are kept. They're well-chosen and already distinct enough for role differentiation:

- **Primary (blue):** Admin surfaces, links, primary actions
- **Secondary (purple):** Teacher accents, rotation day badges
- **Accent (teal-green):** Student actions, success-adjacent feedback
- **Warning (amber/orange):** Streaks, warm highlights, attention moments

### Calendar colors

Calendar colors are user-defined and rendered via inline styles. No change needed — the current system of calendar-assigned colors for event cards works well.

---

## Typography

### Font pairing

Add two fonts to the app, loaded via Google Fonts CDN.

- **Headings / display:** [Outfit](https://fonts.google.com/specimen/Outfit) — rounded, friendly, slightly playful. Used for page titles, card activity names, the "Here" wordmark, date headers. Weights: 500 (medium), 600 (semibold), 700 (bold wordmark only).

- **Body / UI:** [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) — clean, contemporary, excellent legibility at small sizes. Used for metadata, labels, form elements, table text, timestamps. Weights: 400 (regular), 500 (medium), 600 (semibold for emphasis).

### Application

| Element | Font | Weight | Size |
|---------|------|--------|------|
| "Here" wordmark | Outfit | 700 | 22px |
| Page titles (h1) | Outfit | 600 | 20px |
| Card activity names | Outfit | 600 | 15px |
| Section headers | Outfit | 600 | 16px |
| Admin sub-nav labels | Plus Jakarta Sans | 500/600 | 13px |
| Card metadata, timestamps | Plus Jakarta Sans | 400 | 13px |
| Small labels, muted text | Plus Jakarta Sans | 400 | 12px |
| Badges, pills | Plus Jakarta Sans | 600 | 12px |
| Form inputs | Plus Jakarta Sans | 400 | 14px (DaisyUI default) |
| Table body text | Plus Jakarta Sans | 400 | 14px |

### Implementation

Add font imports to `index.css` above the Tailwind import. Extend the DaisyUI theme or Tailwind config with `fontFamily` settings. The heading font should be available via a utility class (e.g., `font-display`) rather than applied globally to all headings, since some headings (like section labels) should use the body font.

---

## Iconography

### Migration to `@phosphor-icons/react`

Replace `react-icons` with the dedicated `@phosphor-icons/react` package. This is a cleaner dependency than pulling Phosphor through the react-icons meta-package alongside five other unused families.

**Why:** react-icons bundles icon data for 20+ families. Since the app is consolidating to Phosphor only, importing directly from `@phosphor-icons/react` is lighter and provides a better API — notably the `weight` prop (`"regular"`, `"fill"`, `"bold"`, `"duotone"`) instead of needing separate named imports for each variant.

**Import style change:**
```jsx
// Before (react-icons):
import { PiHandWaving } from 'react-icons/pi'
import { PiCheckCircleFill } from 'react-icons/pi'

// After (@phosphor-icons/react):
import { HandWaving, CheckCircle } from '@phosphor-icons/react'
// Use: <CheckCircle weight="fill" /> for filled variant
```

**Migration:** `npm install @phosphor-icons/react`, then `npm uninstall react-icons`. All icon imports are updated from `PiIconName` → `IconName` with PascalCase, no prefix. The `weight` prop replaces separate fill/outline imports.

### Icon mapping

All icon names below use the `@phosphor-icons/react` naming convention (no `Pi` prefix).

**Student action buttons:**

| Function | Icon | Weight | Notes |
|----------|------|--------|-------|
| Presence wave (available) | `HandWavingIcon` | regular | |
| Presence wave (completed) | `CheckCircleIcon` | fill | State transition: outline → fill |
| Check-in available | `CheckCircleIcon` | regular | Outline circle with check |
| Checked in | `CheckCircleIcon` | fill | Solid fill signals completion |
| Check-out available | `SignOutIcon` | regular | Exit/departure metaphor |
| Checked out | `CheckCircleIcon` | fill | Same completed state as check-in |
| Status update | `NotePencilIcon` | regular | "Writing something" — matches the conversational prompts |
| Status (has updates) | `NotePencilIcon` | regular | Same icon, distinguished by dot indicator |
| Streak | `FlameIcon` | fill | |

**Admin behavior flags (ActivityDetail toggles):**

| Function | Icon | Notes |
|----------|------|-------|
| Requires attendance | `ClipboardTextIcon` | |
| Requires check-in | `CheckCircleIcon` | Same icon as the student button — shared function, shared icon |
| Allows presence wave | `HandWavingIcon` | Same icon as student action |
| Allows freeform | `ListChecksIcon` | |
| Requires geofence | `MapPinIcon` | |
| Release | `DoorOpenIcon` | |
| Not scheduled | `CalendarXIcon` | |

**Admin navigation (AdminLayout tabs):**

| Function | Icon |
|----------|------|
| Dashboard | `SquaresFourIcon` |
| Calendar | `CalendarBlankIcon` |
| Activities | `CardsThreeIcon` |
| Users | `UsersIcon` |
| Reports | `ChartBarIcon` |
| Settings | `GearIcon` |

**App layout / shared:**

| Function | Icon | Notes |
|----------|------|-------|
| Student role (nav) | `BackpackIcon` | |
| Teacher role (nav) | `ChalkboardTeacherIcon` | |
| Admin role (nav) | `UserGearIcon` | |
| Help | `QuestionIcon` | |
| Logout | `SignOutIcon` | |
| Close / cancel | `XIcon` | |
| Edit | `PencilSimpleIcon` | |
| Save / confirm | `CheckIcon` | |
| Delete | `TrashIcon` | |
| Back | `ArrowLeftIcon` | |
| Row chevron (tables) | `CaretCircleRightIcon` | |
| Sidebar collapse/expand | `CaretLeftIcon` / `CaretRightIcon` | |
| Aggregate/stacked | `Stack` | |
| Geofence failure | `MapPinSlash` | If unavailable in Phosphor, fall back to `WarningCircleIcon` |
| Bug report | `BugIcon` | |
| Feedback | `Lightbulb` | |
| Schedule issue (feedback) | `CalendarXIcon` | |
| Empty enrollment state | `StudentIcon` | |

### Icon sizing guidelines

| Context | Size | Notes |
|---------|------|-------|
| Student action buttons | 18–20px | Inside 36px touch targets (see Action Buttons section) |
| Admin behavior flag toggles | 14–16px | Inside ~28px btn-circle |
| Admin nav tabs | 16px | Inline with 13px label text |
| Roster row indicators | 16px | Inline with row text |
| Navbar icons | 18–20px | |
| Table row chevrons | 14px | `CaretCircleRight` — slightly larger than plain caret to read well |
| Student detail overlay section icons | 16px | Inline with 14px text |

---

## Interaction Design

This is where the "well-made tool" philosophy becomes concrete. Every interactive element should have visible, satisfying feedback.

### Card hover and lift

All clickable cards (student activity cards, teacher activity cards, admin calendar event cards) gain:

```css
transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

/* On hover: */
transform: translateY(-2px);
box-shadow: 0 8px 24px rgba(0,0,0,0.06);
```

The lift is subtle (2px) and the shadow is soft. The cubic-bezier curve gives it a slightly organic feel — it accelerates gently, like something physical lifting off a surface.

### Button press feedback

All buttons gain active-state feedback:

```css
transition: transform 0.1s ease;

/* On active/press: */
transform: scale(0.97);
```

This applies to nav buttons, action buttons, form submit buttons, PAET attendance buttons — everything the user taps. The 3% scale-down is subtle but gives the sensation of a physical press.

### Student action buttons — sizing, styling, and animation

**Size:** Action buttons grow from the current 28px circles to **36px rounded squares** with 12px border-radius. This is a meaningful tappability improvement while remaining compatible with the existing edge-overlapping card layout. The buttons keep their current placement (overlapping the right edge of the card, vertically centered, `overflow: visible` on the card container).

**Why 36px and not 44px:** At `PX_PER_HOUR = 100`, short activity cards (45 min = 75px) cannot accommodate 44px inline buttons without a fundamental layout restructure. 36px edge-overlapping buttons are big enough to be comfortable tap targets while fitting the current grid proportions. A future layout rethink (card list vs. time grid) can revisit sizing when the proportional grid constraint is relaxed.

**Visual treatment:** Each button uses a 2px colored border with a tinted background matching the action color at ~8% opacity, plus a subtle shadow. This replaces the current thin-outline-on-white treatment with something more visually substantial.

```
border: 2px solid {action-color};
background: {action-color} at 8% opacity;
box-shadow: 0 2px 6px {action-color} at 15% opacity;
```

**Pulse animation on available state:** Buttons in the `available` state have a gentle pulsing ring animation to draw attention without being obnoxious:

```css
@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 rgba(var(--action-color), 0.3); }
  70% { box-shadow: 0 0 0 6px rgba(var(--action-color), 0); }
  100% { box-shadow: 0 0 0 0 rgba(var(--action-color), 0); }
}
```

**Wave animation:** When the wave button is tapped, it plays a hand-wave keyframe animation (~0.6s).

**Check pop:** When check-in/status buttons are tapped, they play a quick scale pop (scale up to 1.15, back to 1, ~0.4s).

### Toast feedback

When a student performs an action (wave, check-in, status save), a toast notification appears:

- Slides up from the bottom center of the viewport
- Dark background (`base-content` color), rounded (16px), with the action's icon and a short message
- Auto-dismisses after ~2.5 seconds with a fade-out animation
- Messages are conversational: "Hey!", "You're here!", "Update saved", "See you later!"

### Smooth page transitions

Card lists (student agenda, teacher agenda) use staggered fade-up animations on load. Each card animates in sequence with ~80ms delay between cards:

```css
@keyframes fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

This creates a gentle cascade effect when the page loads or the date changes.

---

## Block Overlay — Removal

The `AgendaBlockOverlay` component is **removed from all agenda views** (student, teacher, and admin calendar). The alternating `bg-primary/5` / `bg-secondary/5` bands with 10px block labels have never looked right — they add visual noise without providing information that isn't already on the cards and in the filter bar. The hour gridlines provide sufficient time-axis scaffolding.

**Files affected:** `AgendaBlockOverlay.jsx` (delete or deprecate), `SingleDayAgenda.jsx` (remove block overlay rendering), `CalendarWeekGrid.jsx` (remove block overlay rendering). The `blockDefinitions` and `blockLabels` props can be removed from these components' interfaces, though the data is still used elsewhere (filter bar, card metadata).

---

## Component-Level Changes

### "Here" Wordmark

The navbar "Here" text gains a branded treatment:

- Font: Outfit, 700 weight, 22px
- Default color: `primary`
- Hover effect: gradient text fill cycling through the app's accent colors (primary → secondary → accent → warm), with a shimmer animation. CSS `background-clip: text` with animated `background-position`.

This is the most prominent "surprise and delight" moment in the app shell. It's visible on every page but only activates on hover, so it never distracts.

### Date header (student and teacher views)

The date navigation header becomes a more prominent "moment":

- Date text: Outfit, 600 weight, 20px
- Student view adds a time-of-day greeting above the date ("Good morning", "Good afternoon", "Good evening") in muted text
- Rotation day indicator becomes a small pill/badge next to the date (e.g., styled with secondary color at 15% opacity background)
- Nav arrows: styled as rounded square buttons (36px, 12px radius) with border instead of bare `btn-ghost`

### Student activity cards

Card styling updates (layout structure unchanged):

- Card background: `base-100` (warm off-white from theme change)
- Left accent: 4px border in calendar color (unchanged)
- Border radius: increased to 16px (from current `rounded-lg` ~8px)
- Card shadow: `0 1px 3px rgba(0,0,0,0.04)` resting, lifts on hover
- Action buttons: edge-overlapping at 36px (up from 28px), with new colored border + tint treatment
- Streak badge uses `Flame` icon (fill weight) in the metadata row

The two-row content layout (name + time on row 1, metadata on row 2) is unchanged. The buttons remain edge-overlapping on the right side of the card.

### Teacher activity cards

Same card styling updates as student (left accent, 16px radius, hover lift) without action buttons. Wave count displays inline in the metadata row with a gentle bounce animation when count > 0.

### Admin calendar event cards

Event cards gain a **tinted background** matching their calendar color at ~5% opacity, in addition to the existing left border accent. This makes the week grid scannable by color at a glance — currently all cards are white with only the thin left border for differentiation.

### Empty states

Empty states gain personality:

- A contextual line of friendly copy (not just "No data")
- Student empty states can include a simple Phosphor icon as a decorative element
- Admin empty states stay more functional: "No activities yet — create your first activity to get started"

### Navbar

- Background: `base-100` (warm white) with subtle bottom border and light shadow
- "Here" wordmark left-aligned with branded treatment
- Role switcher uses styled pill buttons (rounded, color-tinted for active role) instead of a dropdown
- User avatar uses a gradient background (primary → secondary) with initials, 12px border-radius (rounded square)
- Help button is a simple rounded square

---

## Card and Grid Sizing (Known Constraint)

The time-proportional grid is central to the agenda identity — it shows students and teachers their *actual day* with proportional time blocks. However, it creates design tension for short activities:

- A 45-minute activity gets ~75px of vertical space at `PX_PER_HOUR = 100`
- A 3-hour internship gets ~300px — much of it empty
- Short cards can't fit larger inline action buttons without clipping

### Current approach for this design pass

**No layout changes.** The action buttons stay edge-overlapping (as they are today) and grow from 28px to 36px. The card content layout is unchanged. This avoids the overlap problems that a minimum card height would introduce, and avoids the need to solve the grid-vs-list question right now.

### Future exploration (separate spec)

- A scrolling card list layout where cards have consistent minimum heights and time markers are informational (shown in the margin or as separators) rather than proportionally structural
- This would solve the sizing problem entirely and work better on mobile
- The trade-off is losing the visual "shape of your day" that the proportional grid provides
- Could potentially offer both views (grid vs. list) as a user preference
- The card list approach also opens the door to larger (44px+) inline action buttons since cards would have guaranteed minimum height

---

## Mobile Considerations (Deferred)

The current app is built for Chromebook/desktop. Mobile is needed for internship check-ins and general student access. Key concerns for the future mobile pass:

- Action buttons at 36px are adequate touch targets (Apple's minimum is 44pt, but 36px with the pulse animation and generous hit area is workable for interim use)
- Card layout may need to shift from side-by-side (content + buttons) to stacked (content above, buttons below) on narrow viewports
- The time grid needs a mobile viewport strategy (full-width single column, swipe for date navigation)
- The admin calendar week view is desktop-only and that's fine — admin work happens on computers

This is deferred to a separate mobile-responsive spec.

---

## Implementation Notes

### Dependency changes

1. `npm install @phosphor-icons/react`
2. `npm uninstall react-icons`
3. Update all icon imports across the codebase (see icon mapping above)

### What changes globally (theme-level)

1. `src/index.css` — update `base-100`, `base-200`, `base-300` values in the cityview theme
2. `src/index.css` or `index.html` — add Google Fonts imports for Outfit and Plus Jakarta Sans
3. Tailwind/DaisyUI config — add `font-display` utility class for Outfit, set Plus Jakarta Sans as default sans

### What changes per-component

The build spec should address components in this order (foundational → visible):

1. **Dependency swap + icon migration** — install `@phosphor-icons/react`, uninstall `react-icons`, update all imports across the codebase. This is the largest mechanical change (many files) but is a straightforward find-and-replace.
2. **Theme + fonts** — global CSS changes, immediate visual impact everywhere
3. **Block overlay removal** — delete/deprecate `AgendaBlockOverlay.jsx`, remove from `SingleDayAgenda` and `CalendarWeekGrid`
4. **AppLayout / navbar** — wordmark treatment, role switcher restyling, avatar gradient, Phosphor icon swap
5. **Student action buttons (ActionButton.jsx)** — resize to 36px, new border+tint treatment, animations (pulse, wave, pop)
6. **StudentActivityCard** — border radius increase, hover lift, shadow, Phosphor icons for streak
7. **TeacherActivityCard** — same card styling, wave count with bounce animation
8. **Admin CalendarEventCard** — tinted backgrounds
9. **Date headers** — greeting, rotation badge, styled nav arrows
10. **Toast system** — new component for action feedback on student interactions
11. **Empty states** — personality copy and Phosphor decorative icons
12. **AdminLayout** — tab styling with Phosphor icons
13. **ActivityDetail** — Phosphor icons for behavior flag toggles
14. **RosterModal / StudentDetailOverlay** — Phosphor icon swap for indicators
15. **FeedbackModal / HelpPage** — Phosphor icon swap

### What does NOT change

- Component architecture, props, data flow, hooks
- Database schema, API layer, business logic
- Route structure, auth flow
- Card content layout (two-row structure stays the same)
- Button placement strategy (edge-overlapping stays for now)
- Existing DaisyUI component usage for forms, modals, tables (just restyled within DaisyUI's system)
- `PX_PER_HOUR` value (stays at 100)
