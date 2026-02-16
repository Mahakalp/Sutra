/**
 * Sutra — MCP Server
 *
 * Registers ecosystem knowledge tools and handles MCP protocol via stdio.
 *
 * At startup, calls GET /api/auth/tier to determine which tools to register:
 *   - No API key / invalid key → free tier (3 tools)
 *   - Valid Pro key → pro tier (6 tools)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { YantraClient } from './client.js';
import { getToolDefinitions, handleToolCall } from './tools.js';
import type { SutraConfig } from './types.js';

export async function startServer(config: Partial<SutraConfig> = {}): Promise<void> {
  const client = new YantraClient(config);

  // Determine tier and available tools at startup
  const tierInfo = await client.getTier();
  const toolDefs = getToolDefinitions(tierInfo.tools);
  const allowedToolNames = new Set(tierInfo.tools);

  if (tierInfo.warning) {
    log(`Warning: ${tierInfo.warning}`);
  }

  const server = new Server(
    { name: '@mahakalp/salesforce-mcp', version: '0.2.0' },
    { capabilities: { tools: {} } },
  );

  // List available tools — filtered by tier
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: toolDefs };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const result = await handleToolCall(
      name,
      (args ?? {}) as Record<string, unknown>,
      client,
      allowedToolNames,
    );

    if (!result) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    return result;
  });

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  log('Mahakalp Salesforce MCP server started');
  log(`API: ${config.apiBaseUrl ?? 'https://yantra.mahakalp.dev'}`);
  log(`Tier: ${tierInfo.tier} (${tierInfo.limits.requests_per_day} req/day)`);
  log(`Tools: ${toolDefs.map((t) => t.name).join(', ')}`);
}

/** Log to stderr (stdout is reserved for MCP JSON-RPC) */
function log(message: string): void {
  process.stderr.write(`[sutra] ${message}\n`);
}
