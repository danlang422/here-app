# Session 11 — March 10, 2026

---

## 11.1 — Workflow Review, Sub-Agents, and Development Practices

No code changes this session. Focus was on workflow optimization, Claude Code features, development tooling, and project management practices.

### Workflow Analysis

Reviewed the current two-environment workflow (Claude.ai for design/planning, Claude Code for implementation) and identified areas for improvement:

- **Sub-agents in Claude Code.** Researched how sub-agents work: specialized agents with isolated context windows, defined as markdown files in `.claude/agents/`. Built-in agents (Explore, Plan, general-purpose) already handle some delegation automatically. Custom agents are defined with YAML frontmatter specifying name, description, tools, and system prompt.
- **Doc-updater sub-agent drafted.** Created a project-level sub-agent definition (`doc-updater-agent.md`) designed to update STATUS.md, session notes, and CLAUDE.md after implementation sessions. Not yet installed — file needs to be placed in `.claude/agents/`.
- **Planning mode vs. chat planning.** Decided that chat-based planning (current approach) is better for design/architecture work, but Claude Code's planning mode could be useful for *implementation* planning — breaking a build spec into ordered file changes before writing code.
- **Self-review before commit.** Claude Code can diff its changes against the original spec and flag deviations, reducing round-trips back to chat for verification.

### Calendar Management Build Spec — Revised

Two changes to `calendar-management-build-spec.md`:

**1. Two-column settings page layout.** Instead of inserting the calendar between settings cards in a single column, the Org Settings page is restructured into a responsive two-column grid: settings cards stacked on the left, calendar pinned (sticky) on the right. On narrower screens, collapses to single column. This makes better use of horizontal space and creates a live feedback loop — term saves on the left immediately populate the calendar on the right. Replaces the `max-w-3xl` single-column wrapper with a `grid grid-cols-1 lg:grid-cols-[minmax(0,_2fr)_minmax(0,_3fr)]` layout.

**2. Mark Range moved into day popover.** The separate "Mark Range" header button and grid-level click-state selection mode are removed. Instead, the day-click popover now includes a "Mark range starting here" action alongside single-day actions. Uses an end-date picker within the popover. Eliminates the `MarkRangeForm.jsx` as a separate component — range UI lives in `DayPopover.jsx`.

Build order updated: layout restructure is now step 1 (prerequisite), and the old MarkRangeForm step is folded into the DayPopover step.

### Development Practices — GitHub Issues and PR Workflow

Discussed adopting team-style development practices as a solo developer, both for learning and portfolio presentation:

**GitHub Issues for task tracking.** Next steps, bugs, and tech debt moved from STATUS.md's bullet list to GitHub Issues. Created labels: `bug`, `feature`, `enhancement`, `tech-debt`, `needs-spec`, `ready-to-build`, `deferred`. The `needs-spec` → `ready-to-build` label transition maps to the existing workflow: design in chat, then flip the label when spec is done. STATUS.md retains the current state snapshot and active decisions but no longer maintains a detailed task list.

**10 issues created** covering all items from the previous Next Steps list plus tech debt items from Known Issues. Calendar management is `ready-to-build`; most features are `needs-spec`; tech debt items are labeled accordingly.

**PR-based workflow adopted.** Feature branches + PRs add review checkpoints and make the repo's Git history more portfolio-ready. Lightweight approach: branch for anything with a build spec or issue, commit to main for small fixes. Claude Code creates branches and opens PRs. Squash and merge is the default merge strategy — collapses branch commits into a single clean commit on main.

**GitHub CLI confirmed working.** `gh` is installed and authenticated (`danlang422` account, SSH protocol, full repo scope). Issues were created through the web interface after CLI text editor had trouble rendering markdown checkboxes.

### Tooling Discussion

Surveyed developer tools relevant to the project:

- **Linear** — project management tool; GitHub Issues + project boards likely sufficient for now as a solo developer.
- **Storybook** — component library browser; potentially useful for Here app's DaisyUI components, deferred.
- **GitHub Actions** — CI/CD; even basic build-check automation would be a portfolio plus. Worth setting up.
- **GitHub Projects** — built-in kanban board pulling from issues. Free, no extra tooling.

### Tools and Environment Notes

- Discussed how Claude.ai's filesystem tools work (Filesystem tools for Daniel's machine vs. computer tools for Claude's virtual environment) and the occasional mismatch where Claude uses the wrong one. May add a user preference nudge to mitigate.
- Clarified that Claude.ai's DOCX/PPTX skills are part of the Cowork feature set and not relevant to this project's markdown-based documentation workflow.
- Discussed Claude Code skills vs. CLAUDE.md — for this project, CLAUDE.md and the docs folder are already serving the role that skills would fill.

---

## 11.2 — Calendar Management Implementation and First PR

Calendar management feature built by Claude Code and merged via the project's first pull request.

### What Was Built

Claude Code implemented the full calendar management build spec (`calendar-management-build-spec.md`) in a single session on the `feature/calendar-management` branch. PR #11 was opened with a detailed summary, file tables, and a test plan checklist.

**Implementation matches spec.** Two-column settings layout, CalendarGrid with weekday-only month view, DayPopover with single-day and range exception marking, school day auto-generation on term save, per-reason rotation algorithm, rotation recalculation on exception changes, and API cleanup (duplicate term functions removed from `calendar.js`).

See PR #11 description for full details on new and modified files.

### First PR Workflow

Successfully ran the full PR-based workflow for the first time:

1. Claude Code created `feature/calendar-management` branch from main
2. Implementation work committed to the branch
3. Claude Code opened PR #11 with summary, file tables, and test plan checklist
4. Daniel reviewed by running through the test plan checklist locally
5. Added `Closes #1` to the PR description to auto-close the calendar management issue
6. Squash-merged via GitHub web UI
7. Deleted the remote branch, pulled main locally

### Bug Found During Testing

Cross-month date ranges fail when marking exceptions. Filing a range from Dec 22 – Jan 2 (or any range crossing a month boundary) throws a Postgres error: `null value in column "id" of relation "school_days" violates not-null constraint`. The range-marking logic is likely trying to upsert days outside the current term's generated school days without assigning UUIDs. Filed as issue #12 with `bug` label. Does not block the PR — the feature works correctly for same-month ranges.

### Next Up

- Fix cross-month range bug (#12)
- Install doc-updater sub-agent in `.claude/agents/`
- Next feature: agenda view filter/zoom fix (#3) or agenda view polish (#4)
