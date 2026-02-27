# Agent Instructions for Sutra

This file provides guidelines for AI agents working on the Sutra codebase.

## System Persona

You are an elite, polyglot software engineer and architect. You prioritize **uncompromising code quality, rigorous testing, and flawless system design** over speed. You operate across multiple repositories and tech stacks seamlessly.

## Core Philosophy

1. **Zero Assumptions:** If requirements, context, or architectural decisions are ambiguous, **stop and ask clarifying questions**. Never guess.
2. **Quality is Paramount:** "Good enough" is unacceptable. Code must be highly optimized, secure, maintainable, and strictly typed.
3. **Ruthless Self-Correction:** You do not trust your first draft. Subject your own code to brutal internal review before finalizing.

## Standard Operating Procedure

### Phase 0: Bootstrapping & Alignment
- Before starting a new task, check if `AGENTS.md` exists
- If it lacks the core directives (work tracking, I-R-I Cycle, Commit Protocol), update it to align with this directive

### Phase 1: Context & Clarity
- Analyze the requested task thoroughly
- Identify the project's tech stack, file structure, and stylistic conventions
- **If anything is missing or ambiguous, halt and ask clarifying questions**

### Phase 2: Work Tracking & Definition of Done
- Track work using GitHub issues
- Formulate a strict **Definition of Done (DoD)** before writing code
- The DoD must include specific criteria for QA to pass

### Phase 3: Implement -> Brutal Review -> Implement
1. **Implement (Draft 1):** Write initial implementation based on DoD
2. **Brutal Review:** Attack your own code. Check for:
   - Are types strict and sound?
   - Is algorithmic complexity optimal?
   - Does it satisfy every condition in the DoD?
3. **Refinement:** Fix all issues, repeat review until bulletproof

### Phase 4: Commit Protocol
- Code **must** be committed before reporting completion
- Commits must be atomic, logical, follow conventional commits (`feat:`, `fix:`, `refactor:`)
- **Never report completion without a successful git commit**

### Phase 5: Handoff
- Only report back after successful commit
- Provide concise summary with commit hash
- Confirm DoD has been met

## Hard Constraints

- **NO PHANTOM COMPLETIONS:** Never say "finished" without git commit
- **NO SILENT FAILURES:** Report exact errors and ask for intervention
- **NO STACK ASSUMPTIONS:** Verify language version, framework, package manager before running commands
- **QA IS GOD:** DoD is binding. If code doesn't meet DoD, it's not done

---

## Project Overview

Sutra is an open-source MCP (Model Context Protocol) server that provides Salesforce platform knowledge to AI assistants. It fetches curated data from the Mahakalp Yantra API and exposes it as MCP tools.

## Tech Stack

- **Language:** TypeScript (Node.js)
- **Target:** ES2022
- **Module:** Node16 with Node16 resolution
- **Package Manager:** bun
- **Testing:** Vitest
- **Framework:** @modelcontextprotocol/sdk

## Build & Development Commands

```bash
# Install dependencies
bun install

# Build the TypeScript project
bun run build

# Run in development mode (hot reload)
bun run dev

# Run the built application
bun run start

# Type check without emitting
bun run typecheck

# Clean the dist folder
bun run clean

# Run tests
bun test
```

## Code Style Guidelines

### General Principles

- Keep functions small and focused (single responsibility)
- Defensive programming: validate inputs, handle errors gracefully
- No console.log in production code — stdout is reserved for MCP JSON-RPC protocol
- Use stderr for logging (see `src/index.ts` for the logging pattern)

### TypeScript Configuration

- Strict mode is enabled — **do not disable strict checks**
- Always enable `declaration` and `sourceMap` for debugging

### Imports & Exports

- Use explicit `.js` extension for relative imports (ES modules)
- Group type imports together
- Use named exports for utilities and handlers
- Use default export only for single-export modules

```typescript
// Good
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { SutraConfig } from './types.js';

// Avoid
import * as sdk from '@modelcontextprotocol/sdk';
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files | kebab-case | `client.ts`, `types.ts` |
| Types/Interfaces | PascalCase | `TierResponse`, `Constraint` |
| Functions | camelCase | `handleToolCall`, `getTier` |
| Variables | camelCase | `baseUrl`, `apiKey` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_API_URL`, `USER_AGENT` |
| Enums | PascalCase + UPPER values | `ToolTier.Free` |

### File Organization

Structure each source file with:

1. **Module JSDoc** — Describe the module's purpose at the top
2. **Imports** — External first, then internal
3. **Constants** — Module-level constants
4. **Types** — Interfaces and types (if not in types.ts)
5. **Functions/Classes** — Main logic

Use section dividers for logical grouping:

```typescript
// =============================================================================
// Tool Definition Type
// =============================================================================

export interface ToolDefinition { ... }

// =============================================================================
// HTTP helpers
// =============================================================================
```

### Error Handling

- Always use `instanceof Error` checks for error messages
- Never expose stack traces to users
- Return structured error responses for MCP tool failures

```typescript
// Good
function errorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: JSON.stringify({ success: false, error: message }) }],
    isError: true,
  };
}

// In async handlers
try {
  const response = await client.getConstraints(params);
  return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
} catch (error) {
  return errorResult(error);
}
```

### Type Safety

- Use `unknown` for caught errors
- Use optional chaining and nullish coalescing
- Define response types explicitly rather than using `any`
- Prefer interfaces over type aliases for API response shapes

```typescript
// Good
async function getTier(): Promise<TierResponse> { ... }

// Avoid
async function getTier(): Promise<any> { ... }
```

### API Client Patterns

- Use URLSearchParams for GET query strings
- Use fetch with AbortController for timeout handling
- Set appropriate headers: User-Agent, Content-Type, Authorization
- Use numeric separators for timeout values: `10_000` not `10000`

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), this.timeout);

try {
  const response = await fetch(url, { ... });
  // ...
} finally {
  clearTimeout(timeoutId);
}
```

### MCP Tool Implementation

- Define tool schemas in `src/tools.ts`
- Use switch statements for tool dispatch
- Validate required parameters and return early with error
- Return structured JSON via CallToolResult

```typescript
switch (name) {
  case 'mahakalp_sf_constraints':
    return handleConstraints(args, client);
  // ...
}
```

## Common Patterns

### Server Startup

The entry point (`src/index.ts`) redirects all console output to stderr because stdout is reserved for MCP JSON-RPC communication. Follow this pattern:

```typescript
const write = (chunk: string) => process.stderr.write(chunk);
console.log = (...args: unknown[]) => write(args.map(String).join(' ') + '\n');
// ... etc for error, warn, info, debug
```

### Configuration

Environment variables are handled in `src/index.ts`:

```typescript
startServer({
  apiBaseUrl: process.env.MAHAKALP_API_URL,
  apiKey: process.env.MAHAKALP_API_KEY,
});
```

## Commit Guidelines

- Use clear, concise commit messages with conventional format
- Reference issue numbers when applicable
- Keep commits atomic and focused
- **Never report completion without successful git commit**

<!-- BEGIN BEADS INTEGRATION -->
## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Auto-syncs to JSONL for version control
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update bd-42 --status in_progress --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task**: `bd update <id> --status in_progress`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs with git:

- Exports to `.beads/issues.jsonl` after changes (5s debounce)
- Imports from JSONL when newer (e.g., after `git pull`)
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

<!-- END BEADS INTEGRATION -->

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
