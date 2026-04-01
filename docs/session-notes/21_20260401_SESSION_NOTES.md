# Session 21 — April 1, 2026

## 21.1 — Planning: Iteration 4 Scope + Issue Triage

**What happened:** No code written. Full planning session covering app state, data entry friction, and the path to real user testing. A batch of new issues was created and the issue queue was organized around iteration 4 goals.

---

### Decisions made

#### Floating panel enrollment redesign (#51)

The `FloatingPanel` + `EnrollmentPanel` enrollment flow is being retired. The original vision — multiple free-floating panels, drag-and-drop from a HUD-style enrollment surface — isn't close to being built, and without that context the floating panel feels disconnected and awkward.

**Decision:** Enrollment moves inline into `ActivityDetail` as a permanently-resident section at the bottom of the modal.

Key design choices:
- Enrollment section is **always active** for existing activities — independent of whether the activity's fields are in edit mode. Two separate operations, not coupled.
- For new activities being created: section renders disabled with "Save activity to enroll students" hint; activates automatically after save (modal stays open).
- Layout changes from top/bottom split to **side-by-side columns** — Enrolled left, Available right, both independently scrollable at fixed height. Click to move students between columns. This matches the click-to-move interaction model better than vertical stacking (which was designed for drag-and-drop).
- `FloatingPanel.jsx` stays in the codebase (clean, may be useful later) but stops being used.
- `EnrollmentPanel.jsx` stays dormant until Entry B / student-centric enrollment (#7) is built.
- Resolves #25 as a side effect (enroll button during creation no longer exists as a separate trigger).

#### Password reset (#56)

Required before real handoff to teachers and students. All users currently have email-as-password. Approach: Resend as SMTP provider (configured in Supabase dashboard), plus three new routes: `/forgot-password`, `/reset-password`, `/account`. Resend's shared sending domain is acceptable for initial testing — custom domain is a post-launch concern.

#### Recurrence conflict detection — root cause identified

The every-other-week enrollment conflict was traced to a missing field in `getOrgEnrollments`. The conflict validator (`couldMeetOnSameDay`) correctly handles alternating-week phase checking, but `recurrence_interval` and `recurrence_anchor_date` aren't in the enrollment query's select list. Both fields come back as `undefined`, the `?? 1` fallback treats everything as weekly, and the enrollment is blocked. Fix is one line in `src/api/enrollments.js` (#52).

#### Calendar sidebar toggle reactivity (#53)

Calendar toggles update the store correctly but don't trigger re-render in `CalendarView` because `isCalendarVisible` is a function reference — not reactive to store changes. Fix: subscribe to `calendarVisibility` map directly as a `useMemo` dependency.

#### Recurrence UI simplification (#54)

The `recurrence_anchor_date` date picker is confusing because it's not the same as the activity start date and the relationship isn't obvious. Replace with a "Starting Week" selector (Week 1, Week 2, etc.) — the system computes the anchor date as `start_date + (week - 1) × 7 days`. This makes the alternating-week setup (College course = Week 1, Advisory = Week 2, both starting 1/12) intuitive and explicit.

---

### Issues created this session

| # | Title | Type |
|---|-------|------|
| #51 | Floating panel roundup — inline enrollment in activity detail | Feature/Enhancement (updated with full spec) |
| #52 | getOrgEnrollments missing recurrence fields | Bug |
| #53 | Calendar sidebar toggles require page refresh | Bug |
| #54 | Recurrence UI: replace anchor date picker with "starting week" selector | Enhancement |
| #55 | Bulk calendar assignment for activities | Feature |
| #56 | Password reset + change password flow | Feature |

#25 (Enroll button cancels activity creation) closed — resolved as side effect of #51.

---

### Iteration 4 priority order

**Blockers / data entry friction (do first):**
1. #52 — getOrgEnrollments missing recurrence fields (one-line fix, unblocks enrollment)
2. #53 — Calendar sidebar toggle reactivity (two-line fix, makes calendars usable)
3. #35 — Teacher activities not populating in feedback modal (small bug)
4. #54 — Recurrence UI: starting week selector (data entry friction)
5. #55 — Bulk calendar assignment (needed before sidebar filtering is meaningful)

**Core features before handoff:**
6. #56 — Password reset + change password (hard blocker for real users)
7. #51 — Inline enrollment in activity detail (improves data entry workflow significantly)
8. #37 — Aggregate card overflow + scroll (admin usability)
9. #21 — Customizable agenda start/end times (visual waste at 7am–4pm for City View)

**Still needs an issue:** Visual polish pass — app is functional but lacks personality; needed before real handoff.

**Deferred:** #16, #26, #9, #8, #4
