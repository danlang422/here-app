# Build Spec 3 — Component Polish
**Status:** Ready to build (after Specs 1 and 2 complete)
**Depends on:** Spec 1 (fonts, palette), Spec 2 (card hover, button styles)
**Design doc:** `docs/user-flows/visual-design-system-design-doc.md`

---

## Scope

Structural and personality changes at the component level:

1. AppLayout — wordmark shimmer, inline pill role switcher, avatar gradient
2. StudentActivityCard — left calendar color accent (new prop), streak → metadata row
3. TeacherActivityCard — left calendar color accent (new prop)
4. CalendarEventCard — tinted calendar-color backgrounds (few/single modes)
5. AdminLayout — tab styling cleanup
6. Date headers (student + teacher) — greeting, rotation badge, styled nav arrows
7. Empty states — personality copy and Phosphor icon
8. AgendaBlockOverlay — removal
9. Shared utility — extract `formatTimeRange` from duplicate files
10. ESC-to-close — keyboard dismissal for roster and student detail modals

---

## Step 1: AppLayout — wordmark, role switcher, avatar

**File:** `src/components/layout/AppLayout.jsx`

### 1a. Wordmark

Replace the `btn btn-ghost` link with a plain styled link:

```jsx
// Before:
<Link to="/dashboard" className="btn btn-ghost text-xl">Here</Link>

// After:
<Link to="/dashboard" className="here-wordmark">Here</Link>
```

Add to `src/index.css`:

```css
/* "Here" wordmark — shimmer on hover */
.here-wordmark {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 22px;
  color: oklch(var(--color-primary));
  text-decoration: none;
  padding: 4px 8px;
  border-radius: 6px;
  background: transparent;
  -webkit-background-clip: unset;
  background-clip: unset;
  transition: color 0.3s ease;
}

.here-wordmark:hover {
  background-image: linear-gradient(
    90deg,
    oklch(var(--color-primary)),
    oklch(var(--color-secondary)),
    oklch(var(--color-accent)),
    oklch(var(--color-warning)),
    oklch(var(--color-primary))
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shimmer 2s linear infinite;
}

@keyframes shimmer {
  from { background-position: 200% center; }
  to   { background-position: -200% center; }
}
```

### 1b. Role switcher — inline pills

Replace the dropdown with always-visible pill buttons. Only renders when `availableRoles.length > 1`:

```jsx
{availableRoles.length > 1 && (
  <div className="flex items-center gap-1 bg-base-200 rounded-xl p-1">
    {availableRoles.map(role => {
      const Icon = roleIcons[role]
      const isActive = role === currentRole
      return (
        <button
          key={role}
          onClick={() => handleRoleSwitch(role)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
            isActive
              ? 'bg-base-100 text-base-content shadow-sm'
              : 'text-base-content/50 hover:text-base-content/80'
          }`}
        >
          <Icon size={14} />
          {roleLabels[role]}
        </button>
      )
    })}
  </div>
)}
```

Remove the old `<div className="dropdown dropdown-end">` role switcher block entirely.

### 1c. Avatar gradient

Replace the `bg-neutral` flat circle with a gradient:

```jsx
// Before:
<div className="w-10 rounded-full bg-neutral text-neutral-content flex items-center justify-center">
  <span className="text-sm font-medium">{initials}</span>
</div>

// After:
<div
  className="w-10 rounded-xl flex items-center justify-center text-white"
  style={{
    background: 'linear-gradient(135deg, oklch(62.31% 0.1881 259.82), oklch(60.56% 0.219 292.72))',
    fontSize: '13px',
    fontWeight: 600,
  }}
>
  {initials}
</div>
```

`rounded-xl` = 12px radius (rounded square, matching the design doc).

---

## Step 2: StudentActivityCard — calendar color accent + streak position

**File:** `src/components/agenda/StudentActivityCard.jsx`

### 2a. Add `calendarColor` prop

The card needs the activity's calendar color to render the left accent border. Add `calendarColor` to props:

```jsx
function StudentActivityCard({
  activity,
  staffDisplayName,
  blockLabel,
  isToday,
  checkIn,
  wave,
  statusCount,
  hasInstance,
  streak,
  onWave,
  onStatusUpdate,
  onCheckIn,
  onCheckOut,
  calendarColor,   // ← new
}) {
```

### 2b. Apply the left accent border

Update the card container to use an inline style for the left border color:

```jsx
<div
  className="bg-base-100 border border-base-300 border-l-4 rounded-2xl shadow-sm overflow-visible h-full relative transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
  style={calendarColor ? { borderLeftColor: calendarColor } : undefined}
>
```

`border-l-4` applies a 4px left border. The `borderLeftColor` inline style overrides the `border-base-300` color only on the left side. When no `calendarColor` is provided, the left border falls back to `base-300` like the rest.

### 2c. Move streak to the metadata row

Remove the existing streak block (the `{streak > 0 && <div className="mt-auto flex justify-end...">}` section).

Add streak inline at the end of the metadata line:

```jsx
{/* Row 2: block · location · staff [· 🔥 streak] */}
{(metaLine || streak > 0) && (
  <div className="flex items-center gap-1 text-sm text-base-content/60">
    {metaLine && <span className="truncate">{metaLine}</span>}
    {streak > 0 && (
      <span className={`inline-flex items-center gap-0.5 shrink-0 ${streak >= 5 ? 'text-amber-500' : 'text-base-content/40'}`}>
        <Flame weight="fill" size={13} />
        <span className="text-xs">{streak}</span>
      </span>
    )}
  </div>
)}
```

Add `Flame` to the import (from Spec 1 icon migration).

### 2d. Thread `calendarColor` from parent

Find where `StudentActivityCard` is rendered — likely in the student agenda page or a hook that processes activities. The activity object should have `activity.calendar?.color` available (same data that `CalendarEventCard` uses). Pass it down:

```jsx
<StudentActivityCard
  // ... existing props
  calendarColor={activity.calendar?.color}
/>
```

Check `src/pages/student/` and the relevant render function in `src/components/agenda/` or student page to find the render site.

---

## Step 3: TeacherActivityCard — calendar color accent

**File:** `src/components/agenda/TeacherActivityCard.jsx`

Same pattern as StudentActivityCard. Add `calendarColor` prop to `TeacherActivityCard`, `SingleCard`, and `AggregateCard`:

```jsx
function TeacherActivityCard({ item, blockLabels, waveCount = 0, onClick }) {
  if (item.isAggregate) {
    return <AggregateCard item={item} blockLabels={blockLabels} waveCount={waveCount} onClick={onClick} />
  }
  return <SingleCard item={item} blockLabels={blockLabels} waveCount={waveCount} onClick={onClick} />
}
```

**SingleCard** — add left accent (same as StudentActivityCard):
```jsx
function SingleCard({ item, blockLabels, waveCount, onClick }) {
  const calendarColor = item.calendar?.color

  return (
    <div
      className="bg-base-100 border border-base-300 border-l-4 rounded-2xl shadow-sm overflow-visible cursor-pointer h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
      style={calendarColor ? { borderLeftColor: calendarColor } : undefined}
      onClick={onClick}
    >
```

**AggregateCard** — no calendar color (multiple activities). Keep `bg-base-200`, no left accent:
```jsx
function AggregateCard({ item, blockLabels, waveCount, onClick }) {
  return (
    <div
      className="bg-base-200 border border-base-300 rounded-2xl shadow-sm overflow-visible cursor-pointer h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
      onClick={onClick}
    >
```

**Wave count bounce animation** — add to the wave count span in both SingleCard and AggregateCard:

```jsx
{waveCount > 0 && (
  <span className="ml-1.5 inline-flex items-center gap-0.5 animate-bounce">
    <HandWaving size={14} />
    <span>{waveCount}</span>
  </span>
)}
```

`animate-bounce` uses Tailwind's built-in bounce (loops while count > 0). If this feels too energetic, replace with a one-time animation using the same `check-pop` keyframe from Spec 2.

### Extract `formatTimeRange` (shared utility)

Both `StudentActivityCard.jsx` and `TeacherActivityCard.jsx` define identical `formatTimeRange` / `formatTime` functions. Move them to `src/components/agenda/agendaUtils.js` and import from there:

In `agendaUtils.js`, add:
```js
export function formatTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return null
  return `${formatTime(startTime)} – ${formatTime(endTime)}`
}

export function formatTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'p' : 'a'
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, '0')}${suffix}`
}
```

Remove the duplicate function definitions from `StudentActivityCard.jsx` and `TeacherActivityCard.jsx`, and import from `agendaUtils`.

---

## Step 4: CalendarEventCard — tinted backgrounds

**File:** `src/components/schedule-calendar/CalendarEventCard.jsx`

Add tinted calendar-color background to `few` and `single` modes. Aggregate mode unchanged.

```jsx
// few mode:
const bgTint = activity.calendar?.color
  ? `${activity.calendar.color}0D`  // hex color + '0D' = ~5% opacity
  : undefined

return (
  <div
    className={`absolute inset-0 rounded-lg border-l-4 overflow-hidden cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-md ${isDimmed ? 'opacity-30' : ''}`}
    style={{
      borderLeftColor: borderColor,
      backgroundColor: bgTint,
    }}
    onClick={() => onClick(activity)}
  >
```

Apply the same `bgTint` logic to `single` mode. The `0D` hex suffix produces ~5% opacity — if the calendar color is already stored as hex (e.g., `#4A90E2`), this works directly. If stored as a named color or other format, use a different opacity approach (e.g., CSS `color-mix` or compute inline rgba).

**Note:** Verify the shape of `activity.calendar?.color` values in the actual data before implementing — the approach above assumes hex strings.

---

## Step 5: AdminLayout — tab styling

**File:** `src/components/layout/AdminLayout.jsx`

The tab icons are now Phosphor (from Spec 1). Add explicit size and a small visual improvement to the active tab state:

```jsx
<NavLink
  key={to}
  to={to}
  end={end}
  className={({ isActive }) =>
    `tab gap-1.5 text-[13px] font-medium ${isActive ? 'tab-active' : 'text-base-content/60 hover:text-base-content'}`
  }
>
  <Icon size={15} />
  {label}
</NavLink>
```

The `tab-active` DaisyUI class handles the underline/highlight; this just tightens the label font and mutes inactive tabs slightly.

---

## Step 6: Date headers — student and teacher pages

Find the date navigation components in:
- `src/pages/student/StudentPage.jsx` (or wherever the student date header renders)
- `src/pages/teacher/TeacherPage.jsx` (or equivalent)

The current pattern: `<h1>{dateLabel}</h1>` with bare `‹` and `›` buttons.

### 6a. Student date header (with greeting)

```jsx
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// In render:
<div className="flex flex-col items-center gap-0.5 mb-4">
  {isToday && (
    <p className="text-sm text-base-content/50">{getGreeting()}</p>
  )}
  <div className="flex items-center gap-3">
    <button
      onClick={goToPrev}
      className="w-9 h-9 rounded-xl border border-base-300 flex items-center justify-center text-base-content/60 hover:text-base-content hover:border-base-content/30 transition-colors"
    >
      <CaretLeft size={16} />
    </button>

    <div className="flex items-center gap-2">
      <h1 className="font-display font-semibold text-xl">{formattedDate}</h1>
      {rotationDay && (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary/15 text-secondary">
          {rotationDay} Day
        </span>
      )}
    </div>

    <button
      onClick={goToNext}
      className="w-9 h-9 rounded-xl border border-base-300 flex items-center justify-center text-base-content/60 hover:text-base-content hover:border-base-content/30 transition-colors"
    >
      <CaretRight size={16} />
    </button>
  </div>
</div>
```

Import `CaretLeft`, `CaretRight` from `@phosphor-icons/react`.

The rotation day data (`rotationDay`) comes from the school day record — check how `isToday` and the current date's school day data are already being fetched in the student page and pass `rotationDay` from there.

### 6b. Teacher date header

Same structure as student but without the greeting (`isToday` greeting is student-specific per the design doc). Remove the greeting `<p>` block; keep the rotation badge and styled nav arrows.

### 6c. "Back to today" link

The current "Back to today" link is a plain button/link. Keep it, but style it as a small muted text link:
```jsx
{!isToday && (
  <button onClick={goToToday} className="text-xs text-primary hover:underline mt-1">
    Back to today
  </button>
)}
```

---

## Step 7: Empty states

Find the empty state rendering in student, teacher, and admin pages. The current text is "No activities scheduled for this date."

**Student empty state:**
```jsx
<div className="flex flex-col items-center gap-3 py-12 text-base-content/40">
  <CalendarBlank size={40} weight="thin" />
  <p className="text-sm">Nothing scheduled — enjoy the free time.</p>
</div>
```

**Teacher empty state:**
```jsx
<div className="flex flex-col items-center gap-3 py-12 text-base-content/40">
  <CalendarBlank size={40} weight="thin" />
  <p className="text-sm">No activities scheduled for this date.</p>
</div>
```

**Admin empty states** (e.g., empty activities list, empty enrollment):
```jsx
<div className="text-center py-8 text-base-content/50 text-sm">
  No activities yet — create your first activity to get started.
</div>
```

These are in-place text replacements wherever the empty state currently renders. Search for "No activities scheduled" to find all instances.

---

## Step 8: AgendaBlockOverlay removal

### 8a. Delete (or gut) `src/components/agenda/AgendaBlockOverlay.jsx`

Either delete the file entirely or replace its contents with:
```jsx
// Removed: block overlay bands were visually noisy. Hour gridlines provide sufficient scaffolding.
export default function AgendaBlockOverlay() { return null }
```

Keeping the file as a no-op avoids import errors while the references are cleaned up.

### 8b. Remove from `SingleDayAgenda.jsx`

```jsx
// Remove this import:
import AgendaBlockOverlay from './AgendaBlockOverlay'

// Remove these props from the function signature:
// blockDefinitions, blockLabels  ← remove from props destructuring

// Remove the component usage:
// <AgendaBlockOverlay ... />  ← delete this JSX
```

After removing, the `blockDefinitions` and `blockLabels` props no longer need to be passed to `SingleDayAgenda`. Remove them from all call sites.

### 8c. Remove from `CalendarWeekGrid.jsx`

```jsx
// Remove this import:
import AgendaBlockOverlay from '@/components/agenda/AgendaBlockOverlay'

// Remove blockDefinitions, blockLabels from CalendarWeekGrid props
// Remove the <AgendaBlockOverlay ... /> usage in the render
```

---

## Step 9: ESC-to-close modals

**GitHub issue:** File before or alongside this spec.

### 9a. Roster modal

Find the roster modal component (likely `src/components/roster/RosterModal.jsx` or in the teacher page). The modal uses DaisyUI's `<dialog>` element or a custom modal. Add keyboard dismissal:

```jsx
useEffect(() => {
  function handleKeyDown(e) {
    if (e.key === 'Escape') onClose()
  }
  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [onClose])
```

### 9b. Student detail overlay

Find `src/components/roster/StudentDetailOverlay.jsx` or wherever the student detail modal renders. Apply the same `useEffect` pattern with `Escape` → `onClose`.

### 9c. ActivityDetailModal (admin)

Check `src/components/activities/ActivityDetailModal.jsx` — if it's a DaisyUI `<dialog>`, ESC may already work via the native dialog API. If it uses a custom implementation, apply the same pattern.

---

## Verification

1. `npm run dev` — no errors
2. **Wordmark**: "Here" in Outfit bold, primary blue. Hover → gradient shimmer animation.
3. **Role switcher**: Inline pills (not dropdown) when user has multiple roles. Active role has white background and shadow. One click to switch.
4. **Avatar**: Primary→secondary gradient, rounded square.
5. **Student cards**: 4px left border in calendar color. Streak appears inline in metadata row (not bottom-right). No visual overlap with buttons.
6. **Teacher single cards**: 4px left border in calendar color.
7. **Teacher aggregate cards**: No left border, `bg-base-200`, rounded-2xl.
8. **Admin event cards**: Tinted background matching calendar color at ~5% opacity (few/single modes). Aggregate cards unchanged.
9. **Admin nav tabs**: Active tab clear, inactive tabs slightly muted. Phosphor icons throughout.
10. **Date header (student)**: Greeting text visible when viewing today. Rotation day is a pill badge (not plain "— A Day" text). Nav arrows are styled rounded-square buttons.
11. **Date header (teacher)**: Same as student minus greeting.
12. **Empty state**: Friendly copy + Phosphor icon, not bare "No activities scheduled for this date."
13. **Block overlay**: Gone. Hour gridlines visible. No alternating band backgrounds in student, teacher, or admin calendar views.
14. **ESC key**: Pressing ESC closes any open modal (roster, student detail).
15. `npm run build` — no errors
