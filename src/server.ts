/**
 * Sutra — MCP Server
 *
 * Registers ecosystem knowledge tools and handles MCP protocol via stdio.
 *
 * At startup, fetches entitlement from Yantra API to determine tool access:
 *   - Canonical entitlement is derived from Firebase claims (per entitlement-sync contract)
 *   - No direct billing logic — read-only consumer
 *   - Handles states: active, trialing, past_due, canceled (grace), deleted
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { YantraClient } from './client.js';
import { getToolDefinitions, handleToolCall } from './tools.js';
import type { SutraConfig } from './types.js';

export async function startServer(config: Partial<SutraConfig> = {}): Promise<void> {
  const client = new YantraClient(config);

  // Startup health check
  const isHealthy = await client.healthCheck();
  if (!isHealthy) {
    log('Warning: Could not reach Yantra API. Server starting with limited functionality.');
  }

  // Fetch entitlement from Yantra API (canonical path from Firebase claims)
  // This is the read-only consumer pattern - no direct billing mutation
  const entitlement = await client.getEntitlement();
  const allowedToolNames = new Set(client.getAllowedTools(entitlement));
  const toolDefs = getToolDefinitions(Array.from(allowedToolNames));

  // Log entitlement state for debugging
  if (entitlement) {
    log(
      `Entitlement: org=${entitlement.org_id}, tier=${entitlement.tier}, status=${entitlement.status}`
    );
  } else {
    log('Entitlement: None (using free tier)');
  }

  const server = new Server(
    { name: '@mahakalp/salesforce-mcp', version: '0.2.0' },
    { capabilities: { tools: {} } }
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
      allowedToolNames
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

  const tierLabel = entitlement ? `${entitlement.tier} (${entitlement.status})` : 'free';
  log('Mahakalp Salesforce MCP server started');
  log(`API: ${config.apiBaseUrl ?? 'https://yantra.mahakalp.dev'}`);
  log(`Tier: ${tierLabel}`);
  log(`Tools: ${toolDefs.map((t) => t.name).join(', ')}`);
}

/** Log to stderr (stdout is reserved for MCP JSON-RPC) */
function log(message: string): void {
  process.stderr.write(`[sutra] ${message}\n`);
}
