/**
 * Sutra — MCP Server
 *
 * Registers ecosystem knowledge tools and handles MCP protocol via stdio.
 *
 * At startup, fetches entitlement from Yantra API to determine tool access:
 *   - Canonical entitlement is derived from Firebase claims (per entitlement-sync contract)
 *   - No direct billing logic — read-only consumer
 *   - Handles states: active, trialing, past_due, canceled (grace), deleted
 * 
 * Entitlements are refreshed periodically during runtime to handle status changes.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { YantraClient } from './client.js';
import { getToolDefinitions, handleToolCall } from './tools.js';
import type { SutraConfig, Entitlement } from './types.js';

const DEFAULT_ENTITLEMENT_REFRESH_INTERVAL = 300_000; // 5 minutes
const DEFAULT_STALE_THRESHOLD = 600_000; // 10 minutes

interface ServerState {
  allowedToolNames: Set<string>;
  toolDefs: ReturnType<typeof getToolDefinitions>;
  entitlement: Entitlement | null;
  lastKnownGoodEntitlement: Entitlement | null;
  lastRefreshTimestamp: number | null;
  refreshIntervalId?: ReturnType<typeof setInterval>;
}

export async function startServer(config: Partial<SutraConfig> = {}): Promise<void> {
  const client = new YantraClient(config);

  // Startup health check
  const isHealthy = await client.healthCheck();
  if (!isHealthy) {
    log('Warning: Could not reach Yantra API. Server starting with limited functionality.');
  }

  const serverState: ServerState = {
    allowedToolNames: new Set(),
    toolDefs: [],
    entitlement: null,
    lastKnownGoodEntitlement: null,
    lastRefreshTimestamp: null,
  };

  // Initial entitlement fetch
  await refreshEntitlement(client, serverState);

  const server = new Server(
    { name: '@mahakalp/salesforce-mcp', version: '0.2.0' },
    { capabilities: { tools: {} } }
  );

  // List available tools — filtered by tier
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: serverState.toolDefs };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const result = await handleToolCall(
      name,
      (args ?? {}) as Record<string, unknown>,
      client,
      serverState.allowedToolNames
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

  // Start periodic entitlement refresh
  const refreshInterval = config.entitlementRefreshInterval ?? DEFAULT_ENTITLEMENT_REFRESH_INTERVAL;
  const staleThreshold = config.entitlementStaleThreshold ?? DEFAULT_STALE_THRESHOLD;
  serverState.refreshIntervalId = setInterval(async () => {
    log('Refreshing entitlement...');
    await refreshEntitlement(client, serverState, staleThreshold);
  }, refreshInterval);

  const tierLabel = serverState.entitlement ? `${serverState.entitlement.tier} (${serverState.entitlement.status})` : 'free';
  log('Mahakalp Salesforce MCP server started');
  log(`API: ${config.apiBaseUrl ?? 'https://yantra.mahakalp.dev'}`);
  log(`Tier: ${tierLabel}`);
  log(`Tools: ${serverState.toolDefs.map((t) => t.name).join(', ')}`);
  log(`Entitlement refresh interval: ${refreshInterval}ms`);
}

async function refreshEntitlement(
  client: YantraClient,
  serverState: ServerState,
  staleThreshold: number = DEFAULT_STALE_THRESHOLD
): Promise<void> {
  const now = Date.now();
  const isStale = serverState.lastRefreshTimestamp !== null && 
    (now - serverState.lastRefreshTimestamp) > staleThreshold;

  try {
    const entitlement = await client.getEntitlement();
    
    if (entitlement) {
      serverState.entitlement = entitlement;
      serverState.lastKnownGoodEntitlement = entitlement;
      serverState.lastRefreshTimestamp = now;
    } else if (isStale && serverState.lastKnownGoodEntitlement) {
      serverState.entitlement = serverState.lastKnownGoodEntitlement;
      log('Entitlement refresh returned null, but cached entitlement is still valid');
    } else if (serverState.lastKnownGoodEntitlement && !isStale) {
      serverState.entitlement = serverState.lastKnownGoodEntitlement;
      log('Entitlement refresh failed, preserving last known good entitlement');
    } else {
      serverState.entitlement = null;
    }
    
    serverState.allowedToolNames = new Set(client.getAllowedTools(serverState.entitlement));
    serverState.toolDefs = getToolDefinitions(Array.from(serverState.allowedToolNames));

    if (serverState.entitlement) {
      log(
        `Entitlement refreshed: org=${serverState.entitlement.org_id}, tier=${serverState.entitlement.tier}, status=${serverState.entitlement.status}`
      );
    } else {
      log('Entitlement refreshed: None (using free tier)');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Entitlement refresh failed: ${errorMessage}`);
    
    if (serverState.lastKnownGoodEntitlement) {
      if (isStale) {
        log('Stale threshold exceeded with no valid entitlement - using last known good');
      }
      serverState.entitlement = serverState.lastKnownGoodEntitlement;
    } else {
      serverState.entitlement = null;
      log('Entitlement refresh failed with no cached entitlement - using free tier');
    }
    
    serverState.allowedToolNames = new Set(client.getAllowedTools(serverState.entitlement));
    serverState.toolDefs = getToolDefinitions(Array.from(serverState.allowedToolNames));
  }
}

export { refreshEntitlement };

/** Log to stderr (stdout is reserved for MCP JSON-RPC) */
function log(message: string): void {
  process.stderr.write(`[sutra] ${message}\n`);
}
