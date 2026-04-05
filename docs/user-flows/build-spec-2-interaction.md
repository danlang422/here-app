# Build Spec 2 — Interaction Layer
**Status:** Ready to build (after Spec 1 complete)
**Depends on:** Spec 1 (Phosphor icons installed, fonts registered)
**Design doc:** `docs/user-flows/visual-design-system-design-doc.md`

---

## Scope

Animations and interactive behaviors. No structural component changes — this spec only touches styling, sizing, and new behavior layers:

1. `ActionButton` — resize to 36px rounded-square, colored border+tint, pulse/wave/pop animations
2. Card hover lift — `StudentActivityCard`, `TeacherActivityCard`, `CalendarEventCard`
3. Global button press feedback (`scale(0.97)` on `:active`)
4. Toast notification system (new Zustand store + component)
5. Staggered card fade-up animation on agenda load

---

## Step 1: Add animation keyframes to `src/index.css`

Add inside `src/index.css` (after the `@theme` block from Spec 1):

```css
/* ── Agenda card entrance ───────────────────────────────────── */
@keyframes fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Action button animations ───────────────────────────────── */
@keyframes wave-hand {
  0%   { transform: rotate(0deg); }
  15%  { transform: rotate(14deg); }
  30%  { transform: rotate(-8deg); }
  45%  { transform: rotate(14deg); }
  60%  { transform: rotate(-4deg); }
  75%  { transform: rotate(10deg); }
  100% { transform: rotate(0deg); }
}

@keyframes check-pop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.15); }
  70%  { transform: scale(0.95); }
  100% { transform: scale(1); }
}

/* Pulse ring — uses ::after pseudo-element for GPU compositing */
@keyframes pulse-ring {
  0%   { transform: scale(1); opacity: 0.5; }
  100% { transform: scale(1.7); opacity: 0; }
}

/* ── Toast entrance/exit ─────────────────────────────────────── */
@keyframes toast-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes toast-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(8px); }
}

/* ── Global button press feedback ───────────────────────────── */
.btn:active:not(:disabled) {
  transform: scale(0.97);
  transition: transform 0.1s ease;
}
```

---

## Step 2: Rewrite `src/components/student/ActionButton.jsx`

Full replacement. Key changes:
- `w-7 h-7 rounded-full` → `w-9 h-9 rounded-xl` (36px, 12px radius)
- Colored border + tinted background per action state
- `inactive` state now renders `<button disabled>` (not `<div>`)
- Pulse ring via `::after` on available state (CSS class)
- Wave animation on wave button click
- Check-pop animation on checkin/status button click
- Redundant `isClickable` condition cleaned up

```jsx
import { HandWaving, CheckCircle, NotePencil, SignOut } from '@phosphor-icons/react'

// Action color tokens (maps to Tailwind/DaisyUI color vars)
const actionColors = {
  wave:    { available: 'info',    completed: 'success' },
  checkin: { available: 'info',    completed: 'success' },
  status:  { available: 'neutral', completed: 'neutral' },
}

// State → border/text/bg color class sets
const stateStyles = {
  inactive:          'border-base-content/20 text-base-content/30 bg-base-100 cursor-default',
  available:         'border-info/80 text-info bg-info/8 shadow-[0_2px_6px_rgba(0,0,0,0.08)] cursor-pointer hover:border-info hover:bg-info/12',
  completed:         'border-success/70 text-success bg-success/8',
  'checked-in':      'border-success/70 text-success bg-success/8',
  'checkout-available': 'border-info/80 text-info bg-info/8 shadow-[0_2px_6px_rgba(0,0,0,0.08)] cursor-pointer hover:border-info hover:bg-info/12',
  'checked-out':     'border-success/70 text-success bg-success/8',
  'has-updates':     'border-success/70 text-success bg-success/8 cursor-pointer',
}

const icons = {
  wave: {
    inactive:  <HandWaving size={18} />,
    available: <HandWaving size={18} />,
    completed: <CheckCircle weight="fill" size={18} />,
  },
  checkin: {
    inactive:          <CheckCircle size={18} />,
    available:         <CheckCircle size={18} />,
    'checked-in':      <CheckCircle weight="fill" size={18} />,
    'checkout-available': <SignOut size={18} />,
    'checked-out':     <CheckCircle weight="fill" size={18} />,
  },
  status: {
    inactive:     <NotePencil size={18} />,
    available:    <NotePencil size={18} />,
    'has-updates': <NotePencil size={18} />,
  },
}

// Which states allow clicking
const CLICKABLE_STATES = new Set(['available', 'checkout-available', 'has-updates'])

function ActionButton({ type, state, onClick, hasUpdates }) {
  const icon = icons[type]?.[state] ?? icons[type]?.inactive
  const style = stateStyles[state] ?? stateStyles.inactive
  const isClickable = CLICKABLE_STATES.has(state)
  const isAvailable = state === 'available' || state === 'checkout-available'

  // Animation class: wave gets the hand-wave, checkin/status get the pop
  const animClass = isAvailable
    ? (type === 'wave' ? 'active:animate-[wave-hand_0.6s_ease]' : 'active:animate-[check-pop_0.4s_ease]')
    : ''

  return (
    <button
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={`
        relative w-9 h-9 rounded-xl border-2 flex items-center justify-center z-[15]
        transition-all duration-150
        ${style}
        ${animClass}
        ${isAvailable ? 'pulse-available' : ''}
      `}
    >
      {icon}
      {type === 'status' && hasUpdates && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-success border border-base-100" />
      )}
    </button>
  )
}

export default ActionButton
```

Add the pulse ring CSS to `src/index.css`:

```css
/* Pulse ring on available action buttons */
.pulse-available {
  position: relative;
}
.pulse-available::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  border: 2px solid currentColor;
  opacity: 0;
  animation: pulse-ring 1.8s ease-out infinite;
}
```

**Note:** The button container in `StudentActivityCard` uses `right: '-14px'`. With the button growing from 28px to 36px, update this offset to `right: '-18px'` to maintain the same visual overlap proportion.

---

## Step 3: Card hover lift — `StudentActivityCard.jsx`

Add transition and hover classes to the card container div:

```jsx
// Before:
className="bg-base-100 border border-base-300 rounded-lg shadow-sm overflow-visible h-full relative"

// After:
className="bg-base-100 border border-base-300 rounded-2xl shadow-sm overflow-visible h-full relative transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
```

`rounded-2xl` = 16px border radius (up from `rounded-lg` ~8px).

Also update the button container offset:
```jsx
style={{ right: '-18px', top: '50%', transform: 'translateY(-50%)' }}
```

---

## Step 4: Card hover lift — `TeacherActivityCard.jsx`

Apply to both `SingleCard` and `AggregateCard`.

**SingleCard:**
```jsx
// Before:
className="bg-base-100 border border-base-300 rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow h-full"

// After:
className="bg-base-100 border border-base-300 rounded-2xl shadow-sm overflow-visible cursor-pointer h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
```

**AggregateCard:**
```jsx
// Before:
className="bg-base-200 border border-base-300 rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow h-full"

// After:
className="bg-base-200 border border-base-300 rounded-2xl shadow-sm overflow-visible cursor-pointer h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
```

Key: `overflow-hidden` → `overflow-visible` on both variants so hover shadow isn't clipped.

---

## Step 5: Card hover lift — `CalendarEventCard.jsx`

Apply to `few` and `single` modes. Aggregate mode stays as-is (`bg-base-200`, no lift).

```jsx
// few mode — before:
className={`absolute inset-0 rounded border-l-4 bg-base-100 overflow-hidden cursor-pointer hover:bg-base-200 transition-all ${isDimmed ? 'opacity-30' : ''}`}

// few mode — after:
className={`absolute inset-0 rounded-lg border-l-4 bg-base-100 overflow-hidden cursor-pointer transition-all duration-150 hover:-translate-y-px hover:shadow-md ${isDimmed ? 'opacity-30' : ''}`}

// single mode — same treatment as few mode
```

(Admin calendar cards sit within tight grid cells so the lift is constrained to 1px and shadow is modest.)

---

## Step 6: Staggered card fade-up on agenda load

This applies wherever `StudentActivityCard` or `TeacherActivityCard` cards are rendered in the agenda. Find the parent that maps over activities and wraps cards in positioned divs (`absolute left-2 right-5` in `SingleDayAgenda.jsx`).

In `SingleDayAgenda.jsx`, add an `animationDelay` style to each card wrapper:

```jsx
{activities.map((activity, idx) => (
  <div
    key={activity.id}
    className="absolute left-2 right-5"
    style={{
      top: `${activityTop(activity, gridStartMinutes) + GRID_PAD_Y}px`,
      height: `${activityHeight(activity)}px`,
      zIndex: 10,
      animation: `fade-up 0.3s ease both`,
      animationDelay: `${idx * 80}ms`,
    }}
  >
    {renderCard(activity)}
  </div>
))}
```

`animation: 'fade-up 0.3s ease both'` uses the keyframe defined in Step 1.

For `CalendarWeekGrid`, apply the same `fade-up` animation to day column card wrappers (inside `CalendarDayColumn.jsx`).

---

## Step 7: Toast system

### 7a. Create `src/store/toastStore.js`

```js
import { create } from 'zustand'

let toastTimeout = null

export const useToastStore = create((set) => ({
  toast: null, // { message, icon }
  show(message, icon = null) {
    if (toastTimeout) clearTimeout(toastTimeout)
    set({ toast: { message, icon } })
    toastTimeout = setTimeout(() => set({ toast: null }), 2500)
  },
  dismiss() {
    if (toastTimeout) clearTimeout(toastTimeout)
    set({ toast: null })
  },
}))
```

### 7b. Create `src/components/ui/Toast.jsx`

```jsx
import { useToastStore } from '@/store/toastStore'

export function Toast() {
  const { toast, dismiss } = useToastStore()

  if (!toast) return null

  return (
    <div
      onClick={dismiss}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-base-content text-base-100 shadow-xl cursor-pointer select-none"
      style={{ animation: 'toast-in 0.25s ease both' }}
    >
      {toast.icon && <span className="text-base-100">{toast.icon}</span>}
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  )
}
```

### 7c. Mount in `src/components/layout/AppLayout.jsx`

```jsx
import { Toast } from '@/components/ui/Toast'

// Inside AppLayout return, before closing </div>:
<Toast />
```

### 7d. Wire toast to student action mutations

In the student page/hooks that handle wave, check-in, and status mutations, call `useToastStore.getState().show(...)` in `onSuccess`:

```jsx
import { useToastStore } from '@/store/toastStore'
import { HandWaving, CheckCircle, NotePencil, SignOut } from '@phosphor-icons/react'

// Wave success:
onSuccess: () => useToastStore.getState().show("Hey!", <HandWaving size={16} />)

// Check-in success:
onSuccess: () => useToastStore.getState().show("You're here!", <CheckCircle weight="fill" size={16} />)

// Check-out success:
onSuccess: () => useToastStore.getState().show("See you later!", <SignOut size={16} />)

// Status save success:
onSuccess: () => useToastStore.getState().show("Update saved", <NotePencil size={16} />)
```

Find the actual mutation hooks in `src/hooks/useStudentActions.js` (or wherever `onWave`, `onCheckIn`, `onCheckOut`, `onStatusUpdate` mutations live) and add these `onSuccess` callbacks.

---

## Verification

1. `npm run dev` — no errors
2. Student view: action buttons are 36px, rounded squares, with colored borders and tinted backgrounds
3. Student view: available buttons have a visible pulsing ring
4. Hover a student activity card — it lifts 2px with a soft shadow
5. Hover a teacher activity card — same lift (confirm shadow is NOT clipped)
6. Hover admin calendar event cards — subtle 1px lift
7. Click any `.btn` — it scales down slightly on press
8. Trigger a wave/check-in (on an active school day with an active student) — toast slides up from bottom
9. Agenda loads with staggered card fade-up (cards appear in sequence, not all at once)
10. `npm run build` — no errors
