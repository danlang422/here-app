# Session 16 - March 24, 2026

## Focus
User feedback system, bug reporting, and GitHub Issue access for Claude/LLM. 

## Context
Prior to releasing the app for testing with users, we want to implement bug reporting and other feedback mechanisms for staff and student users. 

## What Happened

### Claude GitHub Issue Access > Linear App

Session 11 (`11_20260310_SESSION_NOTES.md`) resulted in a shift from documenting bug reports, enhancements, and tech-debt related documentation in `STATUS.md` to GitHub issues. Claude is generally able to fetch from https://github.com/danlang422/here-app/issues - but has had difficulty fetching beyond the first page. 

In order to provide more consistent access for Claude/any LM development assistant, GitHub issues have been synced (2-way) with Linear, and the Linear MCP integration has been enabled in Claude Desktop. This will allow Claude consistent access to issues related to the app when accessed through the chat interface in the Claude Desktop app. Claude Code should still be able to access GitHub issues through Claude Code GitHub Actions. 

### User Feedback & Bug Reporting

We discussed the need for in-app bug reporting, which will be vital as users begin to use and test the app. Given the particular nature of the app, it would also be beneficial if students could report issues related to their schedule (e.g. an activity has incorrect times), as well as an option for all users to offer overall feedback on the app. The key concepts and decisions discussed are as follows: 

- **Location of Bug Reporting UI** Instead of adding a button for reporting directly to the nav, we're placing it in a new nav item/page that will serve as a "Help Center." The eventual plan is to create help pages, tutorials, and FAQs in this location; at this point this page will only contain the reporting button and modal. 
- **Multiple Types of User Report** The user report functionality should allow for bug reports (something's not working), feedback (I have a suggestion), and schedule issues (my first block actually ends at 8:55). 
- **Screenshots** Despite complicating the process a bit, it will be extremely useful if users can submit screenshots along with their bug reports. We discussed the possibility of automatically capturing the screen at the time of reporting, but decided that a file picker and the abiility to "attach" screenshots is sufficient at this time. Student users are generally proficient in capturing screenshots when experiencing technical issues. 
- **Linear for Report Management** We decided to design the reporting system to utilize Linear's API versus GitHub, which purportedly handles inline image attachments more gracefully than GitHub.
- **Local Storage for Reports** Reports will also be stored locally in Supabase. This will provide a stable history and allow for future features, like a user's report history or an in-app view of this data. 

With these decisons in mind, Claude wrote our build spec `user-feedback-system-build-spec.md` 

### User Feedback System Build Spec

The primary deliverable. After considering adding the reporting function/button directly to the nav, we decided to enclose it in a Help page, which will have additional content and functionality in the future. 

### Spec details

- Claude usually summarizes/recaps key points from the build spec here, but I figure we can just look at the build spec itself. 

## Artifacts

- `docs/user-flows/user-feedback-system-build-spec.md` — Build spec (status: ready to build)

## Next Steps (from 3/24)

- Add `user-bug`, `schedule-issue`, and `user-feedback` labels to Linear (done)
- Extract, save, and run migration to create `feedback-reports` table in Supabase (done - migration file: `supabase/migrations/20260324000000_feedback_reports.sql`)
- Create personal API key in Linear (done)
- Add Supabase Secrets: 
    - `LINEAR_API_KEY` (done)
    - `LINEAR_TEAM_ID` (done)
    - `LINEAR_LABEL_BUG` (done)
    - `LINEAR_LABEL_SCHEDULE` (done)
    - `LINEAR_LABEL_FEEDBACK` (done)

---