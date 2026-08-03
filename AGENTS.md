# Project Working Agreement

These instructions are the authoritative workflow for coding agents working in this repository.

## Session Start

Before changing files:

1. Read `AGENTS.md` and `MEMORY.md`.
2. Read the newest relevant file in `chatlog/`.
3. Check `git status`, the current branch, and recent commits.
4. Restate the current objective and identify any unresolved decisions.
5. Create or switch to a focused work branch before implementation. Do not work directly on `main`.

## During A Session

- Preserve existing user changes and keep work scoped to the current objective.
- Record durable facts, decisions, constraints, conventions, and architecture discoveries in `MEMORY.md` as they become clear.
- Keep implementation notes out of memory unless they will matter in a future session.
- Verify changes in proportion to risk. For behavior changes, test the actual user path or the closest executable equivalent.
- Never store secrets, credentials, tokens, personal data, or irrelevant conversation in tracked files.

## Session End

Before declaring a work session complete:

1. Review the diff and run the relevant checks.
2. Update `MEMORY.md` with durable knowledge and the current project state.
3. Add a concise entry to `chatlog/YYYY-MM-DD.md` covering decisions, changes, verification, and open follow-ups.
4. Report the current branch, changed files, verification results, and remaining work.
5. Ask for explicit authorization before staging, committing, or creating a pull request. The user has granted standing authorization to push the current non-`main` work branch at the end of each run.

## GitHub Workflow

- Use one focused branch per task. Suggested names: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, or `chore/<topic>`.
- Never commit or push directly to `main` except for the explicitly approved one-time repository bootstrap.
- Never merge into `main` unless the user explicitly requests that exact action.
- Keep commits focused and use an imperative summary that explains the outcome.
- Push the current non-`main` work branch automatically at the end of each run when it contains unpublished commits. This standing authorization does not apply to `main`, force pushes, tags, or other branches.
- Prefer a draft pull request for reviewable work unless the user requests a ready-for-review pull request.
- A local change is not considered published until its branch exists on GitHub.

## Memory Rules

- `MEMORY.md` is the concise, current source of truth. Revise stale facts instead of endlessly appending history.
- `chatlog/` is the chronological record. Append factual session summaries; do not paste full conversations.
- If the two disagree, investigate the latest code and decisions, then correct `MEMORY.md`.
- When resuming work, use memory as orientation but verify important assumptions against the repository.
