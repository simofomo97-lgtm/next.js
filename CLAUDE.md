# Next.js Development Guide

## Git Workflow

**Use Graphite for all git operations** instead of raw git commands:

- `gt create <branch-name> -m "message"` - Create a new branch with commit
- `gt modify -a --no-edit` - Stage all and amend current branch's commit
- `gt checkout <branch>` - Switch branches (use instead of `git checkout`)
- `gt sync` - Sync and restack all branches
- `gt submit --no-edit` - Push and create/update PRs (use `--no-edit` to avoid interactive prompts)
- `gt log short` - View stack status

**Note**: `gt submit` runs in interactive mode by default and won't push in automated contexts. Always use `gt submit --no-edit` or `gt submit -q` when running from Claude.

**Graphite Stack Safety Rules:**

- Graphite force-pushes everything - old commits only recoverable via reflog
- Never have uncommitted changes when switching branches
- Never use `git stash` with Graphite - causes conflicts when `gt modify` restacks
- Never use `git checkout HEAD -- <file>` after editing - silently restores unfixed version
- Always use `gt checkout` (not `git checkout`) to switch branches

**Safe multi-branch fix workflow:**

```bash
gt checkout parent-branch
# make edits
gt modify -a --no-edit        # Stage all, amend, restack children
git show HEAD -- <files>      # VERIFY fix is in commit
gt submit --no-edit           # Push immediately

gt checkout child-branch      # Already restacked from gt modify
# make edits
gt modify -a --no-edit
git show HEAD -- <files>      # VERIFY
gt submit --no-edit
```

## Build Commands

```bash
# Build the Next.js package (dev server only - faster)
pnpm --filter=next build:dev-server

# Build everything
pnpm build

# Run specific task
pnpm --filter=next taskfile <task>
```

## Testing

```bash
# Run specific test file
pnpm jest test/path/to/test.test.ts

# Run tests matching pattern
pnpm jest -t "pattern"

# Run development tests
pnpm testheadless test/development/
```

## Investigating CI Test Failures

**Quick triage:**

```bash
# List failed jobs for a PR
gh pr checks <pr-number> | grep fail

# Get failed job names
gh run view <run-id> --json jobs --jq '.jobs[] | select(.conclusion == "failure") | .name'

# Search job logs for errors
gh run view <run-id> --job <job-id> --log 2>&1 | grep -E "FAIL|Error|error:" | head -30
```

**Common failure patterns:**

- `rust check / build` → Run `cargo fmt -- --check` locally, fix with `cargo fmt`
- `lint / build` → Run `pnpm prettier --write <file>` for prettier errors
- Test failures → Run the specific test locally with `NEXT_TEST_MODE=dev pnpm jest <test-path>`

**Run tests in the right mode:**

```bash
# Dev mode (Turbopack)
NEXT_TEST_MODE=dev pnpm jest test/path/to/test.ts

# Prod mode
NEXT_TEST_MODE=start pnpm jest test/path/to/test.ts
```

## Key Directories

- `packages/next/src/` - Main Next.js source code
  - `server/` - Server runtime (dev server, router, rendering)
  - `client/` - Client-side code
  - `build/` - Build tooling (webpack, turbopack configs)
  - `cli/` - CLI entry points
- `packages/next/dist/` - Compiled output
- `turbopack/` - Turbopack bundler (Rust)
- `test/` - Test suites
  - `development/` - Dev server tests
  - `production/` - Production build tests
  - `e2e/` - End-to-end tests

## Development Tips

- The dev server entry point is `packages/next/src/cli/next-dev.ts`
- Router server: `packages/next/src/server/lib/router-server.ts`
- Use `DEBUG=next:*` for debug logging
- Use `NEXT_TELEMETRY_DISABLED=1` when testing locally

## Commit and PR Style

- Do NOT add "Generated with Claude Code" or co-author footers to commits or PRs
- Keep commit messages concise and descriptive
- PR descriptions should focus on what changed and why
