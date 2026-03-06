# Sutra Setup Guide

Sutra is an MCP server that provides Salesforce platform knowledge to AI assistants. This guide covers the current beta installation and configuration flow.

## Beta Notice

Sutra Pro is currently in **beta**. During this period:
- All Pro tools are available at no cost
- Feature set may evolve based on feedback
- We'd love your feedback at [hello@mahakalp.dev](mailto:hello@mahakalp.dev)

## Prerequisites

- Node.js 18+ 
- Bun (recommended) or npm
- An AI assistant that supports MCP (Claude Code, Cursor, VS Code Copilot, Windsurf)

## Installation

### Option 1: Using npx (recommended for quick setup)

```bash
npx @mahakalp/salesforce-mcp
```

### Option 2: Install globally with npm

```bash
npm install -g @mahakalp/salesforce-mcp
```

### Option 3: Build from source

```bash
git clone https://github.com/Mahakalp/Sutra.git
cd Sutra
bun install
bun run build
```

## Configuration

### Free Tier (no API key required)

The following tools are available without any authentication:

| Tool | Description |
|------|-------------|
| `mahakalp_sf_constraints` | Governor limits, platform rules, and best practices |
| `mahakalp_sf_doc_search` | Semantic search over Salesforce documentation |
| `mahakalp_sf_releases` | Release metadata and dates |

Simply add the server to your AI tool's MCP configuration (see below).

### Pro Tier (Beta - Free during beta)

For access to Pro tools (currently free during beta), set the `MAHAKALP_API_KEY` environment variable:

```bash
# Linux/macOS
export MAHAKALP_API_KEY="your-api-key"

# Windows (PowerShell)
$env:MAHAKALP_API_KEY="your-api-key"
```

Or pass it directly in your MCP configuration:

```bash
claude mcp add salesforce-mcp -- npx @mahakalp/salesforce-mcp --env MAHAKALP_API_KEY=your-api-key
```

**Pro tools include:**

| Tool | Description |
|------|-------------|
| `mahakalp_sf_rules` | Best practice rules and coding standards |
| `mahakalp_sf_patterns` | Reusable code patterns and templates |
| `mahakalp_sf_decision_guides` | Architectural decision guides |

### Custom Yantra URL (optional)

If using a self-hosted Yantra instance:

```bash
export MAHAKALP_API_URL="https://your-yantra-instance.com"
```

## Adding to Your AI Tool

### Claude Code

```bash
claude mcp add salesforce-mcp -- npx @mahakalp/salesforce-mcp
```

For Pro tools:

```bash
claude mcp add salesforce-mcp -- npx @mahakalp/salesforce-mcp --env MAHAKALP_API_KEY=your-api-key
```

### Cursor

Create or edit `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "salesforce-mcp": {
      "command": "npx",
      "args": ["@mahakalp/salesforce-mcp"]
    }
  }
}
```

For Pro tools with API key, use a wrapper script:

```bash
# Create a wrapper script
cat > ~/sutra-mcp.sh << 'EOF'
#!/bin/bash
export MAHAKALP_API_KEY="your-api-key"
exec npx @mahakalp/salesforce-mcp "$@"
EOF
chmod +x ~/sutra-mcp.sh
```

Then update `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "salesforce-mcp": {
      "command": "~/sutra-mcp.sh"
    }
  }
}
```

### VS Code / Copilot

Create or edit `.vscode/mcp.json`:

```json
{
  "servers": {
    "salesforce-mcp": {
      "command": "npx",
      "args": ["@mahakalp/salesforce-mcp"]
    }
  }
}
```

### Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "salesforce-mcp": {
      "command": "npx",
      "args": ["@mahakalp/salesforce-mcp"]
    }
  }
}
```

## Verifying Installation

After adding Sutra to your AI tool, verify it's working:

1. Restart your AI assistant
2. Ask: "What are the SOQL governor limits in Apex triggers?"
3. You should receive a structured response with limit values

For Pro tier verification, check the server logs. You should see:
```
Tier: pro (active)
```

## Troubleshooting

### "Could not reach Yantra API" warning

This is normal on first startup or when the API is temporarily unavailable. The server will start with free tier tools available.

### Degraded Mode (Entitlement Unavailable)

If Sutra cannot reach the entitlement service:
- **Free tier users**: No impact — free tools work as normal
- **Pro tier users**: You'll see a warning in logs, but previously cached entitlement may still allow Pro access for a short period

When entitlement sync fails completely:
- Server defaults to free tier automatically
- Pro tools become unavailable until connection is restored
- A warning is logged indicating which tier is active

This graceful degradation ensures the server remains functional even when external services are unavailable.

### Pro tools not appearing

- Verify your API key is set correctly
- Check that your subscription is active
- Ensure the environment variable is passed to the MCP process

### Connection timeout

Increase timeout by setting `MAHAKALP_TIMEOUT` (in milliseconds):

```bash
export MAHAKALP_TIMEOUT=30000
```
