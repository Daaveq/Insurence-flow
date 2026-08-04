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
4. Stage only the files created or modified for the current objective, preserving unrelated user changes.
5. Commit the scoped changes on the current non-`main` task branch with a focused, imperative commit message. Do this automatically at the end of every run that changed tracked project state; do not create empty commits.
6. Push that task branch to GitHub automatically so every completed run is recoverable remotely.
7. Report the current branch, commit, changed files, verification results, and remaining work.

## GitHub Workflow

- Use one focused branch per task. Suggested names: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, or `chore/<topic>`.
- Never commit or push directly to `main` except for the explicitly approved one-time repository bootstrap.
- Never merge into `main` unless the user explicitly requests that exact action.
- Keep commits focused and use an imperative summary that explains the outcome.
- The user grants standing authorization to stage the current run's scoped files, commit them on the active non-`main` task branch, and push that branch at the end of every run. Do not ask again for those three actions.
- This standing authorization does not cover unrelated worktree changes, empty commits, `main`, force pushes, tags, branch deletion, pull-request creation, or merging.
- Ask for explicit authorization before creating a pull request. Prefer a draft pull request unless the user requests ready-for-review.
- A local change is not considered published until its branch exists on GitHub.

## Memory Rules

- `MEMORY.md` is the concise, current source of truth. Revise stale facts instead of endlessly appending history.
- `chatlog/` is the chronological record. Append factual session summaries; do not paste full conversations.
- If the two disagree, investigate the latest code and decisions, then correct `MEMORY.md`.
- When resuming work, use memory as orientation but verify important assumptions against the repository.

## Project-Specific Rules

- This is a Next.js 16 application. Read relevant local documentation under `node_modules/next/dist/docs/` when changing framework behavior.
- Use `npm run lint`, `npx tsc --noEmit`, and `npm run build` for normal validation.
- Use `npm run test:e2e` for static browser checks. Use `LIVE_CODEX=1 npm run test:e2e -- --grep "runs Codex"` only when a real authenticated CLI run is intended.
- Preserve the fixed-source, read-only, schema-constrained design in `src/app/api/analyze/route.ts`.
- Never accept an arbitrary browser prompt, command, working directory, schema path, or source path in the Codex route.
- Do not weaken the no-approval, no-denial, no-pricing, and human-approval guardrails.
