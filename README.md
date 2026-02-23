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

## Roadmap

Coming soon with Sutra Pro:

| Tool | Description |
|------|-------------|
| Best Practice Rules | Coding standards with severity, category, and code examples |
| Code Patterns | Reusable implementation templates — trigger, batch, integration patterns |
| Decision Guides | Architectural decision guides — when to use X vs Y, trade-off analysis |
| Apex Class Library | Full method signatures, parameters, return types, and governor limit implications |
| Standard Object Schema | Standard fields, relationships, and FLS patterns |
| LWC Component Reference | Attributes, events, wire adapters, and Apex integration patterns |
| Tribal Knowledge | Community-sourced patterns, anti-patterns, and hard-won lessons |

Follow [Nishant](https://linkedin.com/in/goswami-nishant) or [Mahakalp](https://linkedin.com/company/mahakalp) for updates.

## Configuration

| Environment variable | Description | Default |
|---------------------|-------------|---------|
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
