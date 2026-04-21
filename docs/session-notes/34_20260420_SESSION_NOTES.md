# Session 34 — April 20, 2026

## 34.1 — Staff conversation debrief and epic creation (Teacher UI & staff model redesign)

**What happened:** Multi-day asynchronous planning conversation triggered by an in-person staff conversation at City View. No code written. Outcome: the set of overlapping issues around staff assignment, monitoring, and teacher agenda display was restructured into an epic with phased sub-issues, one new independent issue, and two supporting documentation updates.

### Starting point

Before this session, several related issues existed in GitHub: #69 (multiple blocks per activity), #70 (multi-staff `activity_staff` junction table), #77 (substitute role), #78 (bulk staff assignment), #79 (monitor UI for "elsewhere" students), #80 (attendance Realtime), #81 (substitute scheduling automation). They referenced each other but had no structural grouping, and some of their scopes were outdated by subsequent conversations and evolving staff feedback.

### The triggering staff conversation (April 2026)

Three threads surfaced from the conversation with staff:

1. **Teacher-vs-monitor semantics.** Currently the teacher/monitor distinction implied that monitored activities had an assigned staff member. Staff wanted the ability for some activities — typically open/independent blocks — to be visible to *all* staff, not just a specific monitor. This was described as a cultural fit: City View is essentially one big room, and collective awareness of where students are is the default state.
2. **Students arriving mid-block.** Two students who have Iowa BIG every morning are consistently "late" to their next block because they're traveling back to the building. They're not actually late — they just aren't scheduled to be there yet. There's currently no way to distinguish this from real tardiness.
3. **Implicit block-coupling in the teacher agenda.** A test activity with Block 0 times but labeled Block 1 produced an aggregate card that spanned both block windows. Investigation confirmed that the teacher agenda groups activities by block number and positions aggregate cards using min/max times across the group — coupling block (a reporting label) to layout (a scheduling concern). The agenda also has no layout resolution for overlapping activities in different blocks; they stack on top of each other.

### Key decisions

**"Show to all teachers" is an explicit property, not absence of staff.** Initial exploration considered making "no staff assigned" the trigger for all-teacher visibility. Rejected because it creates empty agendas for staff who would otherwise be assigned, and because no-nominal-owner attendance isn't desirable. Instead: a new `visible_to_all_staff` boolean on `activities`, independent of staff assignments.

**Blocks are reporting labels, not scheduling units.** Articulated as an architectural principle that had drifted in the teacher UI. Codified in CLAUDE.md (under Key Architectural Decisions) and in `docs/business-logic/01-schedule-and-calendar.md` (new "What Blocks Are" section). Admin attendance rollup is the one place where blocks correctly drive structure, because rollup *is* reporting.

**Teacher agenda layout rewrite is warranted.** Given no one is using the app in production yet (district is still reviewing data privacy documentation), now is the right time to do structural work. The agenda will move from block-based grouping to time-based grouping with overlap resolution.

**Concepting phase precedes the rewrite.** Multiple defensible design directions exist for the teacher agenda (aggregate-first, calendar-style-by-default, hybrid-with-overlay, split-surface, density-aware). Rather than picking one in advance, the plan is to produce HTML mockups of several approaches, show them to City View staff with real scenarios, and let feedback drive the spec.

**Multi-block activities: one attendance state per instance, reported under each block in rollup.** Per-block differentiation (student present for Block 4 but absent for Block 5 of a two-block activity) is deferred — real but rare, handleable via post-hoc edit.

**Early arrivals modeled as per-enrollment time override.** A nullable `start_time_override` on enrollments, displayed on teacher rosters as "arrives X:XX" next to the student's name. Attendance controls remain unchanged — the override is informational, not a constraint.

### Issue restructure

**New issues created:**

| # | Title | Role |
|---|-------|------|
| #84 | Teacher UI & staff model redesign | Epic tracking issue |
| #85 | Pre-phase 1 — Teacher UI concepting & feedback | HTML mockups + teacher feedback sessions |
| #86 | Phase 1 — Teacher agenda layout rewrite | Time-based layout, overlap resolution |
| #87 | Per-enrollment arrival time override | Independent, small (not in epic) |

**Existing issues updated:**

- **#69** — Narrowed to data model only. UI layout questions absorbed into #86. Added attendance behavior decision (one state per instance, rolled up per block).
- **#70** — Expanded to include `visible_to_all_staff` flag. Teacher-view UI implications deferred to #79. Added phase reference to the epic.
- **#77, #78, #80, #81** — Added epic reference at top of body. No other scope changes. #77 had a stale cross-reference (pointed to #79 for bulk staff; corrected to #78).
- **#79** — Reframed from two-category (teacher vs monitor) to three-category (teacher / monitor / shared) display. Added explicit Phase 3 dependencies on #86 and #70.

### Documentation updates

**CLAUDE.md** — New entry under Key Architectural Decisions: "Blocks are reporting labels, not scheduling units." Short, declarative, matches the voice of surrounding entries.

**`docs/business-logic/01-schedule-and-calendar.md`** — New "What Blocks Are" section at top of file. Defines blocks as reporting labels, distinguishes from scheduling, notes the teacher UI consequence.

### What's next

Work on this epic will unfold in chunks, not a single push. The natural first step is #85 (concepting) because it unblocks both #86 and #79 and is the lowest-risk, highest-information piece.

**#85 and data re-entry are expected to run together.** Concepting needs real scheduling scenarios to stress-test the mockups against — including "odd" cases like the Iowa BIG late arrivers — and surfacing those scenarios is the same work that data re-entry depends on. The teachers likely don't have all the schedule nuance documented in the spreadsheet, so some of it may need to be gathered through student surveys or staff conversations during concepting. Expect these two threads to interleave.

---

# Session 35 — April 21, 2026

## 35.1 — Architecture docs accuracy pass

**What happened:** Documentation-only session. Three files in `docs/architecture/` were audited against the actual codebase and corrected — no code changes.

- `01-tech-stack-and-structure.md` — Replaced stale `src/` directory tree with the actual current layout. Fixed icon library (`react-icons` → `@phosphor-icons/react`), added variable fonts, removed references to nonexistent `preferencesStore`, `router.jsx`, and `styles/` directory.
- `04-realtime-and-notifications.md` — Replaced fabricated realtime and notification system descriptions with accurate statements (neither is implemented; realtime planned in #80). Removed `date-fns-tz` (not a dependency); timezone handling now correctly points to `src/lib/scheduleUtils.js` using `Intl.DateTimeFormat`.
- `05-ui-and-styling.md` — Replaced aspirational component hierarchy (compound `BlockCard`, `TodayViewPresenter`, `BottomNav`, `NotificationCenter`, etc.) with the actual component tree derived from real files. Added the DaisyUI v5 CSS variable format warning. Corrected the responsive/navigation section.

All three files received a "Last updated: April 2026 (session 35)" header note.
