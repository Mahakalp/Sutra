/**
 * Sutra — MCP Server
 *
 * Registers ecosystem knowledge tools and handles MCP protocol via stdio.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { YantraClient } from './client.js';
import { TOOL_DEFINITIONS, handleToolCall } from './tools.js';
import type { SutraConfig } from './types.js';

export async function startServer(config: Partial<SutraConfig> = {}): Promise<void> {
  const client = new YantraClient(config);

  const server = new Server(
    { name: '@mahakalp/salesforce-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOL_DEFINITIONS };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const result = await handleToolCall(
      name,
      (args ?? {}) as Record<string, unknown>,
      client,
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
  log(`Tools: ${TOOL_DEFINITIONS.map((t) => t.name).join(', ')}`);
}

/** Log to stderr (stdout is reserved for MCP JSON-RPC) */
function log(message: string): void {
  process.stderr.write(`[sutra] ${message}\n`);
}
