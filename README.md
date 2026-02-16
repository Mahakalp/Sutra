# @mahakalp/salesforce-mcp

Open-source MCP server that makes any AI assistant a Salesforce expert.

Governor limits, platform constraints, documentation search, and release metadata — available to Claude Code, Cursor, VS Code Copilot, and any MCP-compatible client.

## What it does

Sutra gives your AI assistant accurate, structured Salesforce platform knowledge. Instead of hallucinating governor limits or outdated API references, your assistant queries real data curated by [Mahakalp](https://mahakalp.dev).

No Salesforce org connection required. No authentication needed for free tools.

## Installation

### npm / npx (recommended)

```bash
# Run directly without installing
npx @mahakalp/salesforce-mcp

# Or install globally
npm install -g @mahakalp/salesforce-mcp
```

### From source

```bash
git clone https://github.com/Mahakalp/Sutra.git
cd Sutra
npm install
npm run build
node dist/index.js
```

## Quick start

Add the server to your AI tool's MCP configuration:

### Claude Code

```bash
claude mcp add salesforce-mcp -- npx @mahakalp/salesforce-mcp
```

### Cursor

Add to `.cursor/mcp.json`:

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

### VS Code / Copilot

Add to `.vscode/mcp.json`:

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

Add to `~/.codeium/windsurf/mcp_config.json`:

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

## Available tools

These tools are free and require no API key:

| Tool | Description |
|------|-------------|
| `mahakalp_sf_constraints` | Governor limits, platform rules, and best practices with values, workarounds, and code examples |
| `mahakalp_sf_doc_search` | Semantic search over official Salesforce documentation |
| `mahakalp_sf_releases` | Release metadata including API versions, status, and dates |

### Example usage

Once configured, your AI assistant can answer questions like:

- "What are the SOQL governor limits in Apex triggers?"
- "Search the Salesforce docs for bulk API best practices"
- "What API version does the Spring '26 release use?"

## Paid tools

An API key unlocks additional tools for deeper Salesforce expertise:

| Tool | Description |
|------|-------------|
| Apex Class Library | Full method signatures, parameters, return types, and governor limit implications |
| Standard Object Schema | Standard fields, relationships, and FLS patterns |
| LWC Component Reference | Attributes, events, wire adapters, and Apex integration patterns |
| Tribal Knowledge | Community-sourced patterns, anti-patterns, and hard-won lessons |
| SOQL Optimizer | Query selectivity analysis, governor limit risk, and indexing recommendations |
| Code Pattern Analyzer | Governor limit risk detection and bulkification suggestions |
| Trigger Context Advisor | Context variables, execution order, and common pitfalls |

To unlock paid tools:

```bash
# Set your API key as an environment variable
export MAHAKALP_API_KEY=your_api_key_here
```

Or in your MCP configuration:

```json
{
  "mcpServers": {
    "salesforce-mcp": {
      "command": "npx",
      "args": ["@mahakalp/salesforce-mcp"],
      "env": {
        "MAHAKALP_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Get an API key at [mahakalp.dev](https://mahakalp.dev).

## Configuration

| Environment variable | Description | Default |
|---------------------|-------------|---------|
| `MAHAKALP_API_KEY` | API key for paid tools (optional for free tools) | — |
| `MAHAKALP_API_URL` | API endpoint override (for development) | `https://yantra.mahakalp.dev` |

## How it works

Sutra runs locally on your machine as an MCP server over stdio. When your AI assistant calls a tool, Sutra sends a request to the Mahakalp API, which returns curated Salesforce platform knowledge. No code, schema, or org data ever leaves your machine — Sutra only fetches public platform knowledge.

```
Your AI assistant <--stdio--> Sutra (local) <--HTTPS--> Mahakalp API
```

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

```bash
git clone https://github.com/Mahakalp/Sutra.git
cd Sutra
npm install
npm run dev    # Run with hot reload
npm run build  # Build for production
```

## License

[MIT](LICENSE)
