# Session 23 — April 4, 2026

## 23.1 — Visual Design System — Design Doc

**What happened:** Full design exploration and planning session focused on app-wide visual polish. No code changes to the app — this session produced a design doc and interactive mockups for review.

### Process

Reviewed all three views that exist in the current app: student TodayView, teacher Dashboard, and admin schedule-calendar (CalendarView, CalendarWeekGrid, CalendarEventCard, etc.). Also reviewed the AppLayout/AdminLayout shell, action buttons, and all supporting components (roster, student detail overlay, feedback modal, help page, activity detail).

Explored the app's design history by reviewing styling approaches from the two predecessor codebases (interntrackerv1 and here-app-v0) to identify what worked, what was too much, and what personality elements were lost in the current "get it working" build phase. Key takeaways: the current app is visually plain (DaisyUI defaults everywhere, custom theme colors barely used), while earlier versions had more personality (emoji-based interactions, per-role color coding, playful nav animations, warm color palettes) that sometimes tipped into "overwhelming."

Built two interactive React mockups (served as standalone HTML for full-screen review):
1. **Style mockup** — Student/Teacher/Admin views with proposed warm palette, Outfit + Plus Jakarta Sans typography, branded "Here" wordmark with gradient hover, larger emoji action buttons with animations, toast feedback, calendar-color-tinted admin event cards
2. **Icon comparison** — Side-by-side emoji vs SVG icon approaches with adjustable button size slider, showing all action button states in both modes

### Design philosophy established

**"Here feels like a well-made tool that someone clearly loved building."**

The personality comes from interaction quality (how things move, respond, and feel) rather than visual decoration. Organized as concentric rings: universal warm foundation → role-appropriate warmth → sprinkled surprise-and-delight moments. This scales from a student check-in screen to a future SIS/LMS platform without fighting itself.

### Decisions made

**Palette:** Warm the base layer — `base-100` shifts from pure white to warm off-white (`#FFFDF7`). Existing primary/secondary/accent colors retained.

**Typography:** Outfit (headings/display, friendly rounded) + Plus Jakarta Sans (body/UI, clean legibility). Loaded via Google Fonts CDN.

**Icons — consolidated to Phosphor:** All six icon families currently in use (Phosphor, Ionicons, Material Design, Font Awesome 5/6, Game Icons, Tabler) consolidated to Phosphor exclusively. Migrating from `react-icons` to `@phosphor-icons/react` for a cleaner, lighter dependency.

**Complete icon mapping decided:**
- Student actions: `HandWaving`, `CheckCircle` (regular/fill), `SignOut`, `NotePencil`, `Flame` (fill)
- Admin behavior flags: `ClipboardText`, `CheckCircle`, `HandWaving`, `ListChecks`, `MapPin`, `DoorOpen`, `CalendarX`
- Admin nav: `SquaresFour`, `CalendarBlank`, `CardsThree`, `Users`, `ChartBar`, `Gear`
- App layout: `Backpack` (student role), `ChalkboardTeacher` (teacher), `UserGear` (admin), `CaretCircleRight` (table rows)

**Action buttons:** Grow from 28px to 36px, stay edge-overlapping (no layout restructure). New styling: colored border + tinted background + shadow. Animations: pulse ring on available state, wave animation on tap, check-pop on completion.

**Block overlay:** Removed from all roles (student, teacher, admin). Never looked right, block info is already on cards and in the filter bar.

**Card styling:** 16px border radius, hover lift with soft shadow, staggered fade-up on page load, calendar-color tinted backgrounds on admin event cards.

**Toast feedback system:** New component for student action confirmations with conversational messages.

**Card sizing:** No layout changes this pass. Acknowledged as a known constraint — the time-proportional grid creates wildly different card heights. Deferred to a future card-list vs. time-grid exploration.

### Design doc produced

Written to `docs/user-flows/visual-design-system-design-doc.md` (relocated from initial placement in `docs/architecture/`). Covers all decisions above with specific CSS values, icon mappings, sizing tables, and implementation ordering. Ready for a build spec to be written from it.

### Files created/modified

| File | Action |
|------|--------|
| `docs/user-flows/visual-design-system-design-doc.md` | Created — full design doc |
| `docs/architecture/visual-design-system.md` | Created then relocated to user-flows (delete this copy) |
| `STATUS.md` | Updated — session 23, #60 design doc reference, user-flows doc table |

### What's next

- Daniel will review the design doc and may append additional detail (spacing fixes, specific component tweaks noticed during the review)
- Build spec to be written from the design doc, likely by Claude Code
- Implementation follows the ordering in the doc: dependency swap → theme/fonts → block overlay removal → navbar → action buttons → cards → toasts → empty states → admin layout
