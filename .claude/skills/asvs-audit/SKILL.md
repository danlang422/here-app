---
name: asvs-audit
description: >
  Run one chapter of the Here app's OWASP ASVS v5.0.0 Level 1 security audit as a
  guided, conversational walkthrough — not an automated fill-in-the-table pass.
  Reads the chapter's rows from docs/architecture/here-asvs-l1-checklist.md and the
  full requirement text from the ASVS reference docs, explains each requirement in
  plain language for this app's stack (React/Supabase/RLS), gathers evidence, and
  only records a row's Status/Evidence/Applicability once Daniel has confirmed real
  understanding of it — not just watched output happen. Use when the user says
  "let's work on ASVS chapter V6", "audit the authentication chapter", "continue
  the ASVS audit", or names an ASVS chapter/requirement ID.
metadata:
  type: project-skill
---

# ASVS L1 Audit

You are walking Daniel through one chapter of the Here app's OWASP ASVS v5.0.0
Level 1 audit. The end goal is not a filled-in table — it's Daniel being able to
tell the school district "Here passes standard X because ___" in his own words,
since this audit gates whether students and staff can start testing the app next
school year. **A checklist row is not done when evidence exists. It's done when
Daniel understands it and agrees.**

## Reference material

- **Checklist:** `docs/architecture/here-asvs-l1-checklist.md` — the working table,
  one row per L1 requirement, grouped by chapter (V1–V15). This is what gets
  updated.
- **Full ASVS text:** `C:\Users\dansl\Files\Reference\ASVS-5.0.0-en\` — the actual
  OWASP source, far more detail than the checklist's shortened requirement text
  (rationale, context, related requirements). Always read the matching chapter
  file here before explaining a requirement — don't explain from the checklist
  row alone.
- **Chapter → file mapping:** `0x10`→V1, `0x11`→V2, `0x12`→V3, `0x13`→V4, `0x14`→V5,
  `0x15`→V6, `0x16`→V7, `0x17`→V8, `0x18`→V9, `0x19`→V10, `0x20`→V11, `0x21`→V12,
  `0x22`→V13, `0x23`→V14, `0x24`→V15. (V16/V17 exist in Reference but are out of
  scope — the checklist only covers V1–V15.)
- **Policy doc:** `docs/architecture/here-security-decisions.md` — where
  Documentation-type requirements' actual policies get written. ASVS's own model
  (see `0x03-What-is-the-ASVS.md`, "Documented security decisions") is that these
  requirements exist because app-specific rules can't be prescribed generically —
  the org writes the policy down first, and the paired Implementation-type row is
  then checked *against that written policy*. Treat drafting/updating this doc as
  part of working a Documentation row, not an afterthought.

## The loop, per chapter

Pick up the chapter named in the invocation (e.g. `/asvs-audit V6`), or ask which
chapter if none was given — check the checklist for chapters still `not started`
or `in progress` first.

1. **Setup.** Read that chapter's rows from the checklist and the full chapter
   text from Reference.
2. **Explain, one requirement (or small related batch) at a time.** Plain
   language, grounded in the full ASVS text, tailored to what it actually means
   for *this* app — not a generic restatement. Include a reasoned applicability
   call: why it's in scope, or why it isn't.
   > **Checkpoint A — do not proceed past this requirement until Daniel confirms
   > he understands what's being asked and why (or agrees with an n/a call).**
   > If he's unsure, slow down and explain differently — don't move on because
   > *you* understand it.
3. **Gather evidence for in-scope rows.** Match the method to the chapter:
   - Mechanical/code-verifiable chapters (V11 crypto, V12 TLS, V1 encoding, etc.)
     — fine to delegate the grep/read legwork to a fork, or to use installed
     security tooling (gitleaks, dependency/SCA scanners, and similar). Install
     what's actually useful for the requirement at hand — don't route around a
     missing tool, add it.
   - Business-logic/access-control chapters (V2, V8 especially) — reason through
     it directly in conversation. Per ASVS's own guidance (`0x04-Assessment_and_
     Certification.md`), these resist pure automation; a fork silently grepping
     and marking things verified is not sufficient evidence here.
   - Evidence must be concrete either way — file/line reference, a manual test
     actually performed, or a policy doc section — never just a pass/fail label.
4. **If a gap is found, propose a fix** (don't implement yet).
   > **Checkpoint B — Daniel confirms he understands the fix and agrees with the
   > approach before it's implemented.**
5. **Implement the fix, then re-verify it.**
   > **Checkpoint C — Daniel confirms he understands the verification and feels
   > confident the requirement is now actually met.** Where it's natural, have
   > him state it back ("Here passes X because...") rather than just saying yes —
   > that's the actual bar, not evidence existing somewhere.
6. **Only after the relevant checkpoint(s) pass:** write Status/Evidence/
   Applicability into the checklist row. For Documentation-type rows, make sure
   `here-security-decisions.md`'s matching section is drafted/current first. If a
   row is marked `n/a`, the Applicability column must contain an actual rationale
   — never a silent skip (ASVS's own reporting guidance requires this).
7. Commit normally, per-requirement is fine. At the end of the working session
   (or another natural stopping point — not necessarily after every single row),
   invoke the `doc-updater` agent yourself for STATUS.md and the session note,
   covering everything done since the last doc-updater pass. **Do this
   proactively — don't wait to be asked.** Check whether `.claude/doc-hook-enabled`
   exists first (`scripts/check-docs-updated.sh` explains what it does if you need
   the context): if it doesn't, the post-commit hook is dry-run-only and will
   never do this for you, so it's on you. Either way, review `doc-updater`'s diff
   yourself before committing it — don't take its output on faith. (See
   `docs/session-notes/53_20260712_SESSION_NOTES.md`, section 53.4: invoked
   headlessly/unreviewed, it once fabricated a claim about tooling state that
   nobody had told it and it never checked. The fix landed in
   `doc-updater-agent.md`, but treat review as the real safeguard, not the fix
   alone.)

## It's fine to stop mid-chapter

If a requirement needs more back-and-forth than expected, or Daniel isn't at
Checkpoint A/B/C yet, leave the row as `in progress` and pick it back up next
session. A row moving to `not started` → `in progress` without a real checkpoint
behind it is worse than leaving it visibly unresolved.
