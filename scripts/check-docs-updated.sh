#!/usr/bin/env bash
# Runs from .husky/post-commit after every `git commit`, regardless of whether
# the commit was made by Daniel directly or by Claude Code's Bash tool.
#
# Deterministic gate (no LLM call, no cost) — only if it trips do we shell out
# to a headless Claude Code run. Must never fail or block the commit that
# already happened: always exit 0.
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 0

LOG_DIR=".git/hook-logs"
mkdir -p "$LOG_DIR" 2>/dev/null
LOG_FILE="$LOG_DIR/check-docs-updated.log"
log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >>"$LOG_FILE"; }

SHA="$(git rev-parse HEAD)"

# Skip merge commits — nothing useful to diff against a single "what changed" set.
PARENT_COUNT="$(git show -s --format=%P HEAD | wc -w)"
if [ "$PARENT_COUNT" -gt 1 ]; then
  log "skip $SHA: merge commit"
  exit 0
fi

CHANGED_FILES="$(git diff-tree --no-commit-id --name-only -r HEAD)"

is_substantive=false
has_doc_update=false

while IFS= read -r f; do
  [ -z "$f" ] && continue
  case "$f" in
    src/*|supabase/migrations/*|docs/design-and-specs/*|docs/architecture/here-asvs-l1-checklist.md|docs/architecture/here-security-decisions.md)
      is_substantive=true
      ;;
  esac
  case "$f" in
    STATUS.md|docs/session-notes/*)
      has_doc_update=true
      ;;
  esac
done <<EOF
$CHANGED_FILES
EOF

if [ "$is_substantive" != true ] || [ "$has_doc_update" = true ]; then
  log "skip $SHA: substantive=$is_substantive has_doc_update=$has_doc_update"
  exit 0
fi

# Dry-run gate: until this flag file exists locally, we only log what we
# would have done. No headless Claude call, no auto-commit. Create the file
# (`touch .claude/doc-hook-enabled`) once you've watched the log for a while
# and trust the "substantive vs. doc" heuristic above.
ENABLE_FLAG=".claude/doc-hook-enabled"
if [ ! -f "$ENABLE_FLAG" ]; then
  log "DRY-RUN: would flag $SHA (substantive change, no doc update) — create $ENABLE_FLAG to enable auto-invoke"
  exit 0
fi

if ! command -v claude >/dev/null 2>&1; then
  log "skip $SHA: substantive change with no doc update, but 'claude' CLI not found on PATH"
  exit 0
fi

log "flagged $SHA: substantive change with no doc update — launching headless doc-updater"

PROMPT="Commit $SHA on branch $(git rev-parse --abbrev-ref HEAD) changed source/schema/design-doc files but did not touch STATUS.md or docs/session-notes/. Run 'git show $SHA' to see what changed, then invoke the doc-updater agent (.claude/agents/doc-updater-agent.md) to update STATUS.md and today's session note to reflect it — get its diff from git show/git log rather than expecting one pasted in, since this is an automated run. Stage and commit only the doc files you changed, using the repo's normal commit message conventions (including the Co-Authored-By trailer). Do not amend $SHA and do not use --no-verify."

# Backgrounded + detached so `git commit` returns immediately; the doc commit
# lands a little later as its own commit. Permissions are intentionally scoped
# to just what doc-updater needs — tune --allowedTools if doc-updater's needs change.
nohup claude -p "$PROMPT" \
  --allowedTools "Read,Write,Edit,Glob,Grep,Bash(git show:*),Bash(git log:*),Bash(git diff:*),Bash(git add:*),Bash(git commit:*),Bash(git status:*)" \
  >>"$LOG_FILE" 2>&1 &
disown 2>/dev/null || true

exit 0
