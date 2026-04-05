# Build Spec 1 — Foundation
**Status:** Ready to build
**Depends on:** Nothing (this spec is the prerequisite for Specs 2 and 3)
**Design doc:** `docs/user-flows/visual-design-system-design-doc.md`
**Analysis:** `docs/user-flows/visual-design-system-analysis.md` (plan file)

---

## Scope

Global changes with immediate impact on every surface in the app:

1. Icon library swap: `@phosphor-icons/react` replaces `react-icons` across 19 files
2. Font loading: `@fontsource-variable/outfit` + `@fontsource-variable/plus-jakarta-sans`
3. Font + theme registration in `index.css`
4. Warm base palette (`base-100`, `base-200`, `base-300`)
5. Favicon update

No component architecture changes. No layout changes. No animation. This spec is purely foundational — it makes the app look warmer and sets up the utility classes that Specs 2 and 3 use.

---

## Step 1: Install / uninstall packages

```bash
npm install @phosphor-icons/react @fontsource-variable/outfit @fontsource-variable/plus-jakarta-sans
npm uninstall react-icons
```

---

## Step 2: Font imports in `src/main.jsx`

Add at the top of `src/main.jsx`, before the CSS import:

```js
import '@fontsource-variable/outfit'
import '@fontsource-variable/plus-jakarta-sans'
```

---

## Step 3: Update `src/index.css`

### 3a. Warm the base palette

In the `@plugin "daisyui/theme"` block, update the three base color variables:

```css
--color-base-100: oklch(99.2% 0.005 90);   /* warm off-white, ~#FFFDF7 */
--color-base-200: oklch(96.5% 0.008 85);   /* warm light gray, ~#F5F2EB */
--color-base-300: oklch(91% 0.01 80);      /* warm mid-gray for borders */
```

`base-100` replaces the existing pure neutral white. `base-200` and `base-300` must also be set explicitly — DaisyUI v5 can auto-derive them from `base-100`, but the automatic derivation is neutral, not warm. Override all three to maintain consistent warmth across all surface tiers.

### 3b. Register font families

Add a `@theme` block **before** the `@plugin "daisyui"` line (Tailwind v4 requires `@theme` before plugin declarations):

```css
@import "tailwindcss";

@theme {
  --font-display: 'Outfit Variable', sans-serif;
  --font-sans: 'Plus Jakarta Sans Variable', sans-serif;
}

@plugin "daisyui";
```

**Font naming:** `@fontsource-variable` packages register under names with "Variable" appended — use `'Outfit Variable'` and `'Plus Jakarta Sans Variable'` exactly (not `'Outfit'` / `'Plus Jakarta Sans'`).

Tailwind v4 auto-generates `font-display` and `font-sans` utility classes from `--font-*` variables. `--font-sans` becomes the global default body font automatically — no need to add `font-sans` classes anywhere.

**Important:** Do NOT apply `font-display` globally to all headings yet. That selective application (wordmark, page titles, card names, date headers) happens in Spec 3. This spec only registers the utility.

---

## Step 4: Update `index.html` — favicon

Replace:
```html
<link rel="icon" type="image/svg+xml" href="/vite.svg" />
```

With:
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

Create `public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="oklch(62.31% 0.1881 259.82)"/>
  <text x="16" y="23" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="white" text-anchor="middle">H</text>
</svg>
```

---

## Step 5: Icon migration across all 19 files

**Import style change:**

```jsx
// Before (react-icons):
import { PiHandWaving } from 'react-icons/pi'

// After (@phosphor-icons/react):
import { HandWaving } from '@phosphor-icons/react'
// Usage: <HandWaving size={20} /> or <HandWaving weight="fill" size={20} />
```

Key differences:
- No `Pi` / `Fa` / `Md` / `Gi` prefix — just the icon name
- `weight` prop replaces separate fill/outline imports: `weight="regular"` (default) | `"fill"` | `"bold"` | `"duotone"`
- `size` prop works the same

### Icon mapping by file

#### `src/components/student/ActionButton.jsx`
```jsx
// Remove:
import { PiHandWaving } from 'react-icons/pi'
import { IoCheckmarkCircle, IoCheckmarkCircleOutline } from 'react-icons/io5'
import { MdOutlineAddComment } from 'react-icons/md'
import { IoExitOutline } from 'react-icons/io5'

// Add:
import { HandWaving, CheckCircle, NotePencil, SignOut } from '@phosphor-icons/react'
```

Icon substitutions:
| Old | New | Notes |
|-----|-----|-------|
| `<PiHandWaving size={20} />` | `<HandWaving size={20} />` | |
| `<IoCheckmarkCircle size={20} />` | `<CheckCircle weight="fill" size={20} />` | fill = completed state |
| `<IoCheckmarkCircleOutline size={20} />` | `<CheckCircle size={20} />` | regular = available state |
| `<IoExitOutline size={20} />` | `<SignOut size={20} />` | checkout action |
| `<MdOutlineAddComment size={20} />` | `<NotePencil size={20} />` | status update |

#### `src/components/agenda/StudentActivityCard.jsx`
```jsx
// Remove:
import { GiFlame } from 'react-icons/gi'

// Add:
import { Flame } from '@phosphor-icons/react'
```

| Old | New |
|-----|-----|
| `<GiFlame size={14} className={...} />` | `<Flame weight="fill" size={14} className={...} />` |

#### `src/components/agenda/TeacherActivityCard.jsx`
```jsx
// Remove:
import { FaLayerGroup } from 'react-icons/fa6'
import { PiHandWaving } from 'react-icons/pi'

// Add:
import { Stack, HandWaving } from '@phosphor-icons/react'
```

| Old | New |
|-----|-----|
| `<FaLayerGroup size={14} />` | `<Stack size={14} />` |
| `<PiHandWaving size={14} className="inline" />` | `<HandWaving size={14} />` |

#### `src/components/layout/AppLayout.jsx`
```jsx
// Remove:
import { FaUser, FaChalkboardTeacher, FaCog, FaSignOutAlt } from 'react-icons/fa'
import { MdHelpOutline } from 'react-icons/md'

// Add:
import { Backpack, ChalkboardTeacher, UserGear, SignOut, Question } from '@phosphor-icons/react'
```

| Old | New |
|-----|-----|
| `FaUser` (student role icon) | `Backpack` |
| `FaChalkboardTeacher` | `ChalkboardTeacher` |
| `FaCog` (admin role icon) | `UserGear` |
| `<FaSignOutAlt className="w-4 h-4" />` | `<SignOut size={16} />` |
| `<MdHelpOutline className="w-5 h-5" />` | `<Question size={20} />` |

Update `roleIcons` map:
```jsx
const roleIcons = {
  student: Backpack,
  teacher: ChalkboardTeacher,
  admin: UserGear,
}
```

#### `src/components/layout/AdminLayout.jsx`
```jsx
// Remove:
import { FaCalendarAlt, FaTasks, FaUsers, FaChartBar, FaTachometerAlt, FaCog } from 'react-icons/fa'

// Add:
import { SquaresFour, CalendarBlank, CardsThree, Users, ChartBar, Gear } from '@phosphor-icons/react'
```

Update `adminNav` array:
```jsx
const adminNav = [
  { to: '/admin', icon: SquaresFour, label: 'Dashboard', end: true },
  { to: '/admin/calendar', icon: CalendarBlank, label: 'Calendar' },
  { to: '/admin/activities', icon: CardsThree, label: 'Activities' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/reports', icon: ChartBar, label: 'Reports' },
  { to: '/admin/settings', icon: Gear, label: 'Settings' },
]
```

Update render: `<Icon className="w-4 h-4" />` → `<Icon size={16} />`

#### `src/components/activities/ActivityDetail.jsx`
```jsx
// Remove:
import { FaPencilAlt, FaCheck, FaTimes, FaClipboardList, FaHandPaper, FaTags,
         FaMapMarkerAlt, FaDoorOpen, FaCalendarTimes, FaUserGraduate, FaTrash } from 'react-icons/fa'
import { TbClockCheck } from 'react-icons/tb'

// Add:
import { PencilSimple, Check, X, ClipboardText, HandWaving, ListChecks,
         MapPin, DoorOpen, CalendarX, Student, Trash } from '@phosphor-icons/react'
```

Update `BEHAVIOR_FLAGS` array:
```jsx
const BEHAVIOR_FLAGS = [
  { field: 'requires_attendance',  icon: ClipboardText, tooltip: 'Requires attendance' },
  { field: 'requires_checkin',     icon: CheckCircle,   tooltip: 'Requires check-in' },
  { field: 'allows_presence_wave', icon: HandWaving,    tooltip: 'Allows presence wave' },
  { field: 'allows_freeform',      icon: ListChecks,    tooltip: 'Allows freeform tagging' },
  { field: 'requires_geofence',    icon: MapPin,        tooltip: 'Requires geofence' },
  { field: 'is_release',           icon: DoorOpen,      tooltip: 'Release (no attendance)' },
  { field: 'is_not_scheduled',     icon: CalendarX,     tooltip: 'Not scheduled' },
]
```

Add `CheckCircle` to the import. Update pencil/check/times/trash usages in the JSX.

#### `src/components/school-calendar/CalendarGrid.jsx`
```jsx
// Remove:
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'

// Add:
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
```

| Old | New |
|-----|-----|
| `<FaChevronLeft />` | `<CaretLeft size={14} />` |
| `<FaChevronRight />` | `<CaretRight size={14} />` |

#### `src/components/activities/ActivityTable.jsx`
Search for react-icons imports and replace with Phosphor equivalents. Common ones in this file are likely sort/chevron/filter icons — match to `CaretUp`, `CaretDown`, `CaretCircleRight`, `Funnel` as appropriate.

#### `src/components/activities/ActivityDetailModal.jsx`
Search for react-icons imports. Likely uses close (`X`), edit (`PencilSimple`), or similar.

#### `src/components/activities/BulkEditModal.jsx`
Search for react-icons imports. Replace with Phosphor equivalents.

#### `src/components/activities/StaffRows.jsx`
Search for react-icons imports. Replace with Phosphor equivalents.

#### `src/components/roster/RosterModal.jsx`
Search for react-icons imports. Common: close (`X`), check (`Check`), person (`User`).

#### `src/components/roster/StudentDetailOverlay.jsx`
Search for react-icons imports. Replace with Phosphor equivalents.

#### `src/components/panels/FloatingPanel.jsx`
Search for react-icons imports. Likely uses close (`X`) or panel toggle icons.

#### `src/components/schedule-calendar/CalendarSidebar.jsx`
Search for react-icons imports. Replace with Phosphor equivalents (likely chevron/caret for collapse).

#### `src/pages/admin/OrgSettings.jsx`
Search for react-icons imports. Replace with Phosphor equivalents.

#### `src/pages/HelpPage.jsx`
```jsx
// Replace react-icons imports with:
import { Bug, Lightbulb, CalendarX, Question } from '@phosphor-icons/react'
```

#### `src/components/feedback/FeedbackModal.jsx`
Search for react-icons imports. Replace with Phosphor equivalents.

---

## Step 6: Verify no remaining react-icons imports

After migration, confirm zero remaining imports:

```bash
grep -r "from 'react-icons" src/
```

Should return empty.

---

## Verification

1. `npm run dev` — app loads without errors
2. `npm run build` — production build succeeds (confirms no missing icon names)
3. Visual check: all icon locations render correctly (no blank spaces)
4. Visual check: base background color is warm off-white (not pure white) across all pages
5. Visual check: body text uses Plus Jakarta Sans (inspect element → computed font)
6. Visual check: favicon is "H" in blue square (check browser tab)
7. `npm run lint` — no lint errors
