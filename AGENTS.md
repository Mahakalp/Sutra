# Agent Instructions for Sutra

This file provides guidelines for AI agents working on the Sutra codebase.

## Project Overview

Sutra is an open-source MCP (Model Context Protocol) server that provides Salesforce platform knowledge to AI assistants. It fetches curated data from the Mahakalp Yantra API and exposes it as MCP tools.

## Build & Development Commands

```bash
# Build the TypeScript project
npm run build

# Run in development mode (hot reload)
npm run dev

# Run the built application
npm run start

# Type check without emitting
npm run typecheck

# Clean the dist folder
npm run clean
```

**Note:** No test framework is currently configured. Tests should use the Vitest framework if added.

## Code Style Guidelines

### General Principles

- Keep functions small and focused (single responsibility)
- Defensive programming: validate inputs, handle errors gracefully
- No console.log in production code — stdout is reserved for MCP JSON-RPC protocol
- Use stderr for logging (see `src/index.ts` for the logging pattern)

### TypeScript Configuration

- Target: ES2022
- Module: Node16 with Node16 resolution
- Strict mode is enabled — do not disable strict checks
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

### Code Examples (for tool descriptions)

When writing tool descriptions with examples:

```typescript
description: 'Get Salesforce platform constraints. ' +
  'Example: Get SOQL query limits in Apex triggers.',
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

## Dependencies

- `@modelcontextprotocol/sdk` — MCP protocol implementation
- `typescript` — Type checking and compilation
- `tsx` — TypeScript executor for development

## Commit Guidelines

- Use clear, concise commit messages
- Reference issue numbers when applicable
- Keep commits atomic and focused
