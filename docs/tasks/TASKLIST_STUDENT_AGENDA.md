# Task: Implement Student Agenda with Clean Bright Design System

**Priority:** High  
**Estimated Complexity:** High  
**Related Documentation:** `/docs/DESIGN_SYSTEM.md`

---

## Context

The student agenda is the core feature of Here app. Students use it to:
- View their daily schedule
- Check in/out of remote and internship sections (required)
- Wave presence for in-person sections (optional)
- See their plans and track progress

We've designed a new "Clean Bright" visual style with specific interaction patterns documented in `DESIGN_SYSTEM.md`. This task implements that design for the student agenda page.

---

## Prerequisites

- [x] Design system documented in `/docs/DESIGN_SYSTEM.md`
- [x] Migration 008 run (instructor fields added)
- [x] TypeScript types regenerated
- [x] Color palette finalized (Orange, Purple, Pink, Yellow)

---

## Files to Create/Modify

### New Files to Create:
1. `app/student/agenda/page.tsx` - Main student agenda page (server component)
2. `app/student/agenda/AgendaClient.tsx` - Client wrapper with state management
3. `app/student/agenda/AgendaCard.tsx` - Individual section card component
4. `app/student/agenda/EmojiButton.tsx` - Reusable wave/peace button component
5. `app/student/agenda/CollapsibleSection.tsx` - Plans/progress collapsible component
6. `app/student/agenda/CheckInPrompt.tsx` - Modal/inline check-in prompt
7. `app/student/agenda/CheckOutPrompt.tsx` - Modal/inline check-out prompt
8. `app/student/agenda/actions.ts` - Server actions for check-in/out, presence waves
9. `app/globals.css` - Add "here" text styling and design system tokens (UPDATE existing)

### Files to Reference (Don't Modify):
- `/docs/DESIGN_SYSTEM.md` - Complete design specifications
- `app/student/agenda/page.tsx` (existing demo) - Can reference layout but will replace entirely

---

## Implementation Plan

### Phase 1: Setup & Foundation (30-45 min)

**1.1: Add Design System to globals.css**

Add CSS variables and "here" text styling to `app/globals.css`:

```css
/* Design System - Clean Bright */
:root {
  /* Base Colors */
  --color-bg-primary: #FFFEF9;
  --color-bg-card: linear-gradient(135deg, #FFFEF9 0%, #FFF8F0 100%);
  --color-text-primary: #1F2937;
  --color-text-secondary: #6B7280;
  --color-text-muted: #9CA3AF;
  
  /* Accent Colors */
  --color-orange: #FF9500;
  --color-purple: #7C3AED;
  --color-pink: #DB2777;
  --color-yellow: #F59E0B;
  
  /* Section Type Colors */
  --color-remote: #7C3AED;
  --color-remote-bg: rgba(124, 58, 237, 0.12);
  --color-internship: #DB2777;
  --color-internship-bg: rgba(219, 39, 119, 0.12);
  --color-class: #F59E0B;
  --color-class-bg: rgba(245, 158, 11, 0.12);
}

/* The special "here" text treatment */
.here {
  font-weight: 700;
  /* Color assigned dynamically via JS */
}

.here:hover {
  background: linear-gradient(135deg, var(--color-orange) 0%, var(--color-purple) 33%, var(--color-pink) 66%, var(--color-yellow) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-size: 200% 200%;
  animation: rainbowShimmer 1s ease-in-out;
}

@keyframes rainbowShimmer {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

**1.2: Create Server Actions File**

Create `app/student/agenda/actions.ts` with placeholder functions:

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Get student's schedule for a specific date
 */
export async function getStudentSchedule(date: string) {
  // TODO: Implement
  // Query sections where student is enrolled
  // Filter by schedule_pattern and date
  // Return sections with check-in status
}

/**
 * Create presence wave (optional, casual)
 */
export async function createPresenceWave(sectionId: string, moodEmoji?: string) {
  // TODO: Implement
  // Create interaction with type='presence'
  // Validate section has presence_enabled
}

/**
 * Create check-in (required, with prompt)
 */
export async function createCheckIn(sectionId: string, plans: string, location?: any) {
  // TODO: Implement
  // Create attendance_event with type='check_in'
  // Create interaction with plans response
  // Validate section requires check-in
  // Verify location if internship
}

/**
 * Create check-out (required, with prompt)
 */
export async function createCheckOut(sectionId: string, progress: string) {
  // TODO: Implement
  // Create attendance_event with type='check_out'
  // Create interaction with progress response
}
```

### Phase 2: Core Components (1-2 hours)

**2.1: EmojiButton Component**

Create `app/student/agenda/EmojiButton.tsx`:

Requirements:
- Accept props: `emoji`, `onClick`, `pressed`, `disabled`
- Implement hover lift animation (button + emoji lift separately)
- Implement wave animation (2 iterations on click)
- Implement peace rotation animation (360° on click)
- Use CSS from DESIGN_SYSTEM.md section "Emoji Buttons"

**2.2: CollapsibleSection Component**

Create `app/student/agenda/CollapsibleSection.tsx`:

Requirements:
- Accept props: `plans`, `progress`, `isExpanded`, `onToggle`
- Tabs: Plans | Progress
- Remember collapsed state in sessionStorage
- Key format: `agenda-card-{sectionId}-collapsed`
- Use CSS from DESIGN_SYSTEM.md section "Collapsible Plans & Progress Section"

**2.3: CheckInPrompt Component**

Create `app/student/agenda/CheckInPrompt.tsx`:

Requirements:
- Modal or inline (decide which feels better)
- Show prompt: "What are your plans for this session?"
- Textarea input
- Cancel and Submit buttons
- On submit: trigger wave animation, call createCheckIn action
- On cancel: un-depress button, close prompt

**2.4: CheckOutPrompt Component**

Create `app/student/agenda/CheckOutPrompt.tsx`:

Requirements:
- Similar to CheckInPrompt
- Show prompt: "What did you accomplish?"
- On submit: trigger peace rotation, call createCheckOut action
- On cancel: un-depress button, close prompt

### Phase 3: AgendaCard Component (1-2 hours)

**3.1: Create AgendaCard Component**

Create `app/student/agenda/AgendaCard.tsx`:

This is the most complex component. Follow these requirements carefully:

**State Management:**
```typescript
interface CardState {
  hasWaved: boolean          // For presence waves
  isCheckedIn: boolean       // For required check-ins
  isCheckedOut: boolean      // For check-outs
  showCheckInPrompt: boolean
  showCheckOutPrompt: boolean
  isCollapsed: boolean
  activeTab: 'plans' | 'progress'
  plans: string | null
  progress: string | null
}
```

**Visual States (from DESIGN_SYSTEM.md):**

1. **Presence Wave (Optional Sections)**
   - Before: Text "Say hey!" fades in → stays 3sec → fades out
   - Button: 👋 (hover shows lift, click shows 2x wave)
   - After: Button pressed, still waves on hover

2. **Check-In (Required Sections)**
   - Before: Text "Say you're here!" (stays visible)
   - Button: 👋 
   - Click → depress → show prompt → submit → wave → "You're here." + ✌️ appears

3. **Check-Out**
   - Text: "Say bye!"
   - Button: ✌️
   - Click → depress → show prompt → submit → spin 360° → "You're out!"

**Card Structure:**
```tsx
<div className="agenda-card">
  {/* Header */}
  <div className="card-header">
    <div className="card-info">
      <h3>{section.name}</h3>
      <div className="card-time">{startTime} - {endTime}</div>
    </div>
    <span className="section-badge badge-{type}">{type}</span>
  </div>
  
  {/* Action Area */}
  <div className="btn-area">
    {/* Text changes based on state */}
    {buttonText && <span className="btn-text">{buttonText}</span>}
    
    {/* Wave button */}
    <EmojiButton emoji="👋" ... />
    
    {/* Peace button (after check-in) */}
    {isCheckedIn && <EmojiButton emoji="✌️" ... />}
    
    {/* More text */}
  </div>
  
  {/* Prompts */}
  {showCheckInPrompt && <CheckInPrompt ... />}
  {showCheckOutPrompt && <CheckOutPrompt ... />}
  
  {/* Collapsible Section (after check-in) */}
  {isCheckedIn && <CollapsibleSection ... />}
</div>
```

**"Here" Color Rotation:**

Implement the color rotation logic:
```typescript
useEffect(() => {
  const COLORS = ['#FF9500', '#7C3AED', '#DB2777', '#F59E0B'];
  const startIndex = Math.floor(Math.random() * COLORS.length);
  
  const hereElements = document.querySelectorAll('.here');
  hereElements.forEach((el, i) => {
    const colorIndex = (startIndex + i) % COLORS.length;
    (el as HTMLElement).style.color = COLORS[colorIndex];
  });
}, []);
```

### Phase 4: Main Page & Client Wrapper (30-45 min)

**4.1: Create AgendaClient Component**

Create `app/student/agenda/AgendaClient.tsx`:

Requirements:
- Client component wrapper
- Date navigation (Previous | Today | Next)
- Manage date state
- Fetch schedule when date changes
- Map sections to AgendaCard components

**4.2: Create Main Page**

Create `app/student/agenda/page.tsx`:

Requirements:
- Server component
- Fetch initial schedule for today
- Pass to AgendaClient as `initialSections` prop
- Show loading state

### Phase 5: Server Actions Implementation (1-2 hours)

**5.1: Implement getStudentSchedule**

Requirements:
- Get authenticated user
- Query sections where student is enrolled (active enrollments)
- Join with section data
- Filter by schedule_pattern (every_day, specific_days, a_days, b_days)
- Check calendar_days for A/B designation
- Left join attendance_events for check-in/out status
- Return sections with status

**5.2: Implement Presence Wave**

Requirements:
- Verify section has `presence_enabled = true`
- Create interaction record:
  - type: 'presence'
  - section_id
  - author_id: student
  - content: mood emoji or '👋'
  - timestamp: now

**5.3: Implement Check-In**

Requirements:
- Verify section requires check-in (remote or internship)
- If internship: verify geolocation (soft check)
- Create attendance_event record:
  - type: 'check_in'
  - section_id
  - student_id
  - timestamp: now
  - location: captured location (if internship)
  - location_verified: true/false
- Create interaction record:
  - type: 'prompt_response'
  - attendance_event_id
  - content: plans text

**5.4: Implement Check-Out**

Requirements:
- Create attendance_event record:
  - type: 'check_out'
- Create interaction record:
  - type: 'prompt_response'
  - content: progress text

---

## Acceptance Criteria

### Visual Design
- [ ] Matches Clean Bright design system (colors, spacing, shadows)
- [ ] Background uses off-white (#FFFEF9)
- [ ] Cards have cream gradient background
- [ ] Section type badges use correct colors with 12% opacity
- [ ] "here" text rotates through 4 colors randomly
- [ ] "here" text shows rainbow shimmer on hover

### Emoji Buttons
- [ ] 👋 and ✌️ buttons are 64x64px
- [ ] Hover (before click): Button + emoji lift separately
- [ ] Click: Appropriate animation plays (wave or spin)
- [ ] After click: Button appears pressed/depressed
- [ ] Hover (after click): Still animates (for fun!)

### Presence Wave Flow
- [ ] Text "Say hey!" fades in → visible 3 seconds → fades out
- [ ] Only shows for sections with `presence_enabled = true`
- [ ] Click → wave 2x → button stays pressed
- [ ] Creates interaction record with type='presence'
- [ ] No prompts, no collapsible section

### Check-In Flow
- [ ] Text "Say you're here!" stays visible (doesn't fade)
- [ ] Only shows for remote and internship sections
- [ ] Click → button depresses → prompt appears
- [ ] Cancel → button un-depresses, prompt closes
- [ ] Submit → wave animation → "You're here." appears → ✌️ button shows → collapsible section appears

### Check-Out Flow
- [ ] ✌️ button only shows after check-in complete
- [ ] Text "Say bye!" visible
- [ ] Click → button depresses → prompt appears
- [ ] Cancel → button un-depresses
- [ ] Submit → 360° rotation → "You're out!" appears
- [ ] "You're here." text disappears after check-out

### Collapsible Section
- [ ] Appears after check-in with plans
- [ ] Expanded by default, showing Plans tab
- [ ] Can switch to Progress tab
- [ ] Can collapse/expand entire section
- [ ] State persists in sessionStorage for current session
- [ ] Resets (expands) on next day/new session

### Data & State
- [ ] Schedule filters correctly by date and schedule pattern
- [ ] A/B days work correctly
- [ ] Check-in creates attendance_event + interaction
- [ ] Check-out creates attendance_event + interaction
- [ ] Presence wave creates interaction only
- [ ] Geolocation captured for internships (soft verification)

---

## Testing Checklist

### Manual Testing
- [ ] Load page → see today's schedule
- [ ] Navigate to different dates
- [ ] Presence wave: click, see animation, button stays pressed
- [ ] Check-in: click, see prompt, submit, see animations, collapsible appears
- [ ] Check-out: click, see prompt, submit, see spin animation
- [ ] Cancel check-in: button returns to normal state
- [ ] Hover "here" text: see rainbow shimmer
- [ ] Refresh page: "here" colors are different
- [ ] Collapse section: refresh page, section re-expands
- [ ] Switch tabs in collapsible section

### Edge Cases
- [ ] No sections for today → show appropriate empty state
- [ ] Section without presence enabled → no wave button
- [ ] In-person section → no check-in button
- [ ] Already checked in → can't check in again
- [ ] Not checked in → check-out button doesn't show

---

## Notes & Tips

### Design System Reference
The complete design system is in `/docs/DESIGN_SYSTEM.md`. Key sections:
- Color Palette (page 2)
- Typography & "here" treatment (page 3)
- Emoji Buttons component (page 6-7)
- Collapsible Section component (page 8)
- Interaction Patterns (page 9-10)

### SessionStorage Pattern
```typescript
// Save collapsed state
sessionStorage.setItem(`agenda-card-${sectionId}-collapsed`, 'true');

// Load on mount
const wasCollapsed = sessionStorage.getItem(`agenda-card-${sectionId}-collapsed`) === 'true';
```

### Animation Timing
- Fast interactions: 0.2s (hover lifts, color changes)
- Standard transitions: 0.3s (most state changes)
- Deliberate animations: 0.5-0.6s (wave, peace rotation)
- Text fades: 0.6s

### Common Pitfalls
- Don't forget the separate lift for button AND emoji on hover
- Wave animation should play 2x, not infinite
- Text fades only for presence waves, not check-ins
- Check-out button doesn't appear until check-in is complete
- Color rotation must start from random index each page load

---

## Questions to Resolve During Implementation

1. **Prompt display:** Should check-in/out prompts be modal overlays or inline within cards?
   - **Suggestion:** Try inline first (simpler), can switch to modal if it feels cramped

2. **Empty state:** What to show when no sections scheduled?
   - **Suggestion:** Simple centered message: "No sections scheduled for [date]"

3. **Loading state:** Skeleton cards or spinner while fetching schedule?
   - **Suggestion:** Show skeleton cards matching layout

4. **Mobile considerations:** Any responsive breakpoints needed?
   - **Suggestion:** Test on mobile after desktop implementation, adjust as needed

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Tested on Chrome (primary target browser - Chromebooks)
- [ ] No TypeScript errors
- [ ] No console errors or warnings
- [ ] Code follows existing project patterns
- [ ] Server actions have proper error handling
- [ ] RLS policies allow student data access (verify existing policies work)
- [ ] Committed with clear commit message

---

## Estimated Time

- Phase 1 (Setup): 30-45 minutes
- Phase 2 (Core Components): 1-2 hours  
- Phase 3 (AgendaCard): 1-2 hours
- Phase 4 (Page & Client): 30-45 minutes
- Phase 5 (Server Actions): 1-2 hours
- Testing & Refinement: 1 hour

**Total: 5-8 hours** (depending on complexity of prompts and state management)

---

## Success Criteria

When complete, a student should be able to:
1. Open their agenda and see today's schedule
2. Wave 👋 at in-person sections (if enabled)
3. Check in to remote/internship sections with plans
4. Check out with progress notes
5. Collapse/expand their plans/progress
6. Navigate to different dates
7. Experience smooth, delightful animations
8. See the "here" brand consistently with rotating colors

The page should feel warm, welcoming, and intuitive - reinforcing "you are HERE."