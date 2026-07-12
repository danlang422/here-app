# Here — Security Decisions

This is the substance behind the "Documentation" requirements in `here-asvs-l1-checklist.md`. Each ASVS documentation requirement asks whether a written policy exists for a given area — this file is where that policy actually lives. The checklist tracks whether a section here is written and whether the code matches it; this file holds the actual decision.

Per ASVS's own framing: these are organizational decisions communicated to (in this case, future) developers, not ad hoc choices made per line of code. Each section should be specific enough that "does the implementation match this?" is a yes/no question, not a judgment call.

Sections below are stubs, filled in as we work each chapter. Each should reference the ASVS requirement ID it satisfies.

---

## Input Validation Policy
*Satisfies: V2.1.1*

*(Not yet written — fill in when we work V2.)*

## Authentication & Anti-Automation Policy
*Satisfies: V6.1.1*

*(Not yet written — fill in when we work V6. Should cover: rate limiting approach, what "credential stuffing" defense looks like given Supabase Auth's built-in behavior, and how account lockout is prevented from becoming a DoS vector against your own users.)*

## Authorization Policy
*Satisfies: V8.1.1*

*(Not yet written — fill in when we work V8. Likely the fastest section to write, since the actual rules already exist as RLS policies from the prior audit — this is mostly a matter of writing down in plain language what those policies enforce, e.g. who can see/edit which activities, enrollments, and staff records.)*

## Third-Party Component Update Policy
*Satisfies: V15.1.1*

*(Not yet written — fill in when we work V15. Should define a remediation time frame for dependencies with known vulnerabilities — e.g. "critical CVEs patched within N days" — realistic for a solo maintainer, not aspirational.)*
