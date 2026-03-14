# Session 14 — March 14, 2026

Planning session (Claude.ai). No code changes beyond a single constant adjustment. Focus was on designing the student actions spec — the interaction flows for presence wave, status update, check-in/check-out, and the card layout redesign needed to support them.

---

## 14.1 — Orientation & Priority Check

Reviewed CLAUDE.md and STATUS.md. Discovered documentation was slightly behind — the teacher agenda (from `teacher-agenda-build-spec.md`) had already been built in a prior session but STATUS.md hadn't been updated to reflect this. Confirmed current priority: student action buttons/flows, then circling back to the teacher view to surface student interactions.

Decided to write a single spec covering all student actions rather than separate specs, since the flows share components (status update modal) and the card redesign affects all of them.

---

## 14.2 — Card Layout Review & PX_PER_HOUR Decision

Reviewed the existing `StudentActivityCard` at 45-minute block heights (60px at PX_PER_HOUR = 80). Found significant issues:

- Text clipping on short cards — descenders cut off with just two rows of content
- Action buttons in the `CardActions` strip were cramped against edges
- Property icons (`requires_geofence`, `allows_freeform`) weren't rendering and consumed vertical space

**Decisions made:**

- **PX_PER_HOUR bumped from 80 to 100.** Gives 75px for 45-min blocks — enough for two clean text rows. Committed directly to `agendaUtils.js`.
- **Property icons cut.** Not displaying, and the information is available elsewhere. Easy space savings.
- **Combined row 1:** Activity name (left) + time range (right-aligned) on the same line. Frees row 2 for block · location · staff.
- **Cards remain `h-full`.** Considered natural-height cards but decided the card must visually represent the full time allocation since activity times don't always align with block boundaries.
- **DEFAULT_GRID_END could be trimmed** from 16:00 to 15:00 since most schedules end ~14:20. Filed as a future admin-configurable setting rather than a hardcode change.

---

## 14.3 — Action Button Design Exploration

Explored three approaches for how students interact with activity cards:

### Approach 1: Tappable Card → Action Buttons
Card itself is the tap target, revealing floating action buttons. **Rejected** — tapping an agenda card universally means "show more detail about this event" (calendar app convention). The teacher roster interaction fits this pattern because a roster *is* more detail. But student actions are things you *do*, not things you *learn*.

### Approach 2: Single Action Button (Hexagon)
One edge-overlapping hexagon button (`TbHexagonPlus`) that opens a floating action menu. Explored in detail with mockups comparing three icon candidates (hexagon plus, circle fading plus, minimal plus→check) and three states (inactive, available, complete). **Partially rejected** — the "complete" state was ambiguous since status updates have no clear completion, and visual feedback for wave/check-in would be lost behind the single button.

### Approach 3: Individual Action Buttons on Card Edge (Selected)
Up to two action buttons floating on the right edge of the card, each half-overlapping the card border with white fill. Each button manages its own state independently. Wave and check-in are expected to be mutually exclusive per activity (GitHub issue filed), so max two buttons: primary action (wave or check-in) + status update.

**Key advantages:** No intermediate menu step, each button's state is always visible, no ambiguous "aggregate complete" state, visual feedback for individual actions persists on the card.

**White fill decided** for button backgrounds — makes buttons opaque against block overlay bands. `padding-right: 28px` on card content prevents text overlap with the button zone.

---

## 14.4 — Interaction Flow Design

Mapped out all four student interaction flows:

- **Presence Wave:** Single tap, immediate record, button state change + streak update. No modal.
- **Standalone Status Update:** Tap → modal with prompt "What're you up to?", type defaults to `reflection`.
- **Check-In:** Multi-step: tap → geofence check (if needed) → create record → freeform tagging (if needed) → status modal with "What're your plans?" → save completes check-in. Cancel at status step rolls back the check-in.
- **Check-Out:** Tap → status modal with "What'd you accomplish?" → save writes `checked_out_at`. Cancel leaves check-in intact for retry.

**Tone decision:** Status prompts are conversational — "What're you up to?", "What're your plans?", "What'd you accomplish?" — matching the friendly vibe of the app. Avoided overly vague prompts ("How'd it go?") that would invite one-word answers.

**Streak indicator:** Lives bottom-right of card content area (always visible), not on the action button. Exploring `GiFallingStar` or similar icon — distinctive without being the overused flame.

---

## 14.5 — Spec Written

Wrote `docs/user-flows/student-actions-build-spec.md` covering:

1. Card & grid redesign (PX_PER_HOUR, layout, overflow fixes)
2. Action button placement and per-button states
3. Streak indicator design and data optimization
4. All four interaction flows with step-by-step sequences and API signatures
5. Status update modal (shared across flows)
6. Freeform tag selector for check-in flow
7. Geofence utilities (Haversine, browser location)
8. Time window availability functions
9. Data layer (two new hooks, all API functions, query invalidation map)
10. Instance upsert fix (re-add `ensureActivityInstances` to TodayView)
11. Build sequence (8 ordered steps)

---

## Decisions

| Decision | Rationale |
|----------|-----------|
| PX_PER_HOUR = 100 | 75px for 45-min blocks prevents text clipping while keeping grid height reasonable |
| Cut property icons | Not rendering, info available elsewhere, saves vertical space |
| Keep h-full on cards | Cards must represent full time allocation since times ≠ block boundaries |
| Individual edge-overlapping buttons over single action button | Each button's state visible at all times, no ambiguous aggregate state |
| White fill on button backgrounds | Opacity against block overlay bands |
| Conversational status prompts | Friendly app tone, specific enough to elicit useful responses |
| Status type pre-set in check-in/check-out flows | Reduces friction — students don't need to think about type classification |
| Cancel during check-in status step = rollback | Status update is a required part of the check-in flow |

## Issues Filed

- Admin-configurable agenda view start/end times (replacing hardcoded DEFAULT_GRID_END)
- Mutual exclusivity enforcement for `allows_presence_wave` and `requires_checkin` on activities

## Follow-Up

- Daniel updating STATUS.md to reflect teacher agenda build completion and current state
- Student actions build (from the new spec) is the next implementation task for Claude Code
- After student actions: return to teacher view to surface student interactions (waves, check-ins, status updates)
