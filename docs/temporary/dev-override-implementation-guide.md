# Dev Date/Time Override — Implementation Guide

## New file: `src/lib/devOverrides.js`
Copy the provided `devOverrides.js` into `src/lib/`.

## Changes to existing files

### 1. `src/pages/student/TodayView.jsx`

**Add import (top of file):**
```js
import { getDevNow, getDevToday, isDevOverrideActive } from '@/lib/devOverrides' // DEV OVERRIDE — remove for production
```

**Line ~33 — initial date state:**
```js
// BEFORE:
const [date, setDate] = useState(new Date())
// AFTER:
const [date, setDate] = useState(getDevToday()) // DEV OVERRIDE
```

**Line ~44 — isToday check:**
```js
// BEFORE:
const isToday = isSameDay(date, new Date())
// AFTER:
const isToday = isSameDay(date, getDevNow()) // DEV OVERRIDE
```

**Line ~204 — "Back to today" button:**
```js
// BEFORE:
onClick={() => setDate(new Date())}
// AFTER:
onClick={() => setDate(getDevToday())} // DEV OVERRIDE
```

**Line ~236 — getGreeting function:**
```js
// BEFORE:
function getGreeting() {
  const hour = new Date().getHours()
// AFTER:
function getGreeting() {
  const hour = getDevNow().getHours() // DEV OVERRIDE
```

---

### 2. `src/pages/teacher/Dashboard.jsx`

**Add import (top of file):**
```js
import { getDevNow, getDevToday } from '@/lib/devOverrides' // DEV OVERRIDE — remove for production
```

**Line ~18 — initial date state:**
```js
// BEFORE:
const [date, setDate] = useState(new Date())
// AFTER:
const [date, setDate] = useState(getDevToday()) // DEV OVERRIDE
```

**Line ~37 — isToday check:**
```js
// BEFORE:
const isToday = isSameDay(date, new Date())
// AFTER:
const isToday = isSameDay(date, getDevNow()) // DEV OVERRIDE
```

**Line ~174 — "Back to today" button:**
```js
// BEFORE:
onClick={() => setDate(new Date())}
// AFTER:
onClick={() => setDate(getDevToday())} // DEV OVERRIDE
```

---

### 3. `src/components/agenda/StudentActivityCard.jsx`

**Add import (top of file):**
```js
import { getDevNow } from '@/lib/devOverrides' // DEV OVERRIDE — remove for production
```

**Line ~31 — now variable:**
```js
// BEFORE:
const now = new Date()
// AFTER:
const now = getDevNow() // DEV OVERRIDE
```

---

### No changes needed:
- `src/lib/actionAvailability.js` — already accepts `now` as a parameter,
  so it picks up the override automatically from the call sites above.

---

## Usage

1. Open `src/lib/devOverrides.js`
2. Set `DEV_OVERRIDE_ENABLED = true`
3. Set `DEV_DATE` to a school day (e.g. `'2026-04-10'` for a Friday)
4. Set `DEV_TIME` to a time during activities (e.g. `'09:30'`)
5. Run `npm run dev` — the student and teacher views will behave as if
   it's that date/time. Action buttons will be enabled, greeting will
   match, "today" logic will point to the override date.

## Before production deploy
Search for `// DEV OVERRIDE` across the codebase and either:
- Set `DEV_OVERRIDE_ENABLED = false` (quick), or
- Remove the imports and revert to `new Date()` (clean)
