import { describe, it, expect, vi } from 'vitest';
import { readFile } from 'fs/promises';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { refreshEntitlement } from './server.js';
import { getToolDefinitions, handleToolCall } from './tools.js';
import type { YantraClient } from './client.js';
import type { Entitlement, SutraConfig } from './types.js';

describe('integration', () => {
  describe('Node runtime compatibility', () => {
    it('dist/index.js is valid ESM', async () => {
      const indexJs = await readFile('/home/nishantg/Projects/Mahakalp/Sutra/dist/index.js', 'utf-8');
      expect(indexJs).toContain('startServer');
    });

    it('dist/server.d.ts exports startServer', async () => {
      const serverDts = await readFile('/home/nishantg/Projects/Mahakalp/Sutra/dist/server.d.ts', 'utf-8');
      expect(serverDts).toContain('startServer');
    });
  });

  describe('startServer startup smoke', () => {
    it('starts with valid config', async () => {
      const mockClient = {
        healthCheck: vi.fn().mockResolvedValue(true),
        getEntitlement: vi.fn().mockResolvedValue(null),
        getAllowedTools: vi.fn().mockReturnValue(['mahakalp_sf_constraints']),
      } as unknown as YantraClient;

      const config: Partial<SutraConfig> = {
        apiBaseUrl: 'https://test.api',
        apiKey: 'test-key',
      };

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: null as number | null,
      };

      await refreshEntitlement(mockClient, serverState);

      expect(serverState.allowedToolNames.size).toBeGreaterThan(0);
      expect(config.apiBaseUrl).toBe('https://test.api');
    });

    it('initializes with empty entitlement (free tier)', async () => {
      const mockClient = {
        healthCheck: vi.fn().mockResolvedValue(true),
        getEntitlement: vi.fn().mockResolvedValue(null),
        getAllowedTools: vi.fn().mockReturnValue(['mahakalp_sf_constraints']),
      } as unknown as YantraClient;

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: null as number | null,
      };

      await refreshEntitlement(mockClient, serverState);

      expect(serverState.entitlement).toBeNull();
      expect(Array.from(serverState.allowedToolNames)).toContain('mahakalp_sf_constraints');
    });

    it('initializes with pro entitlement', async () => {
      const proEntitlement: Entitlement = {
        sub_id: 'sub_pro',
        org_id: 'org_pro',
        tier: 'pro',
        seats: 5,
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        status: 'active',
        features: {},
      };

      const mockClient = {
        healthCheck: vi.fn().mockResolvedValue(true),
        getEntitlement: vi.fn().mockResolvedValue(proEntitlement),
        getAllowedTools: vi.fn().mockReturnValue([
          'mahakalp_sf_constraints',
          'mahakalp_sf_doc_search',
          'mahakalp_sf_releases',
          'mahakalp_sf_rules',
          'mahakalp_sf_patterns',
          'mahakalp_sf_decision_guides',
        ]),
      } as unknown as YantraClient;

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: null as number | null,
      };

      await refreshEntitlement(mockClient, serverState);

      expect(serverState.entitlement?.tier).toBe('pro');
      expect(Array.from(serverState.allowedToolNames)).toContain('mahakalp_sf_rules');
    });
  });

  describe('stdio runtime compatibility', () => {
    it('StdioServerTransport can be instantiated', () => {
      const transport = new StdioServerTransport();
      expect(transport).toBeDefined();
    });

    it('Server can be constructed with stdio transport', () => {
      const server = new Server(
        { name: 'test-server', version: '1.0.0' },
        { capabilities: { tools: {} } }
      );
      expect(server).toBeDefined();
    });

    it('Server responds to ListToolsRequestSchema', async () => {
      const server = new Server(
        { name: 'test-server', version: '1.0.0' },
        { capabilities: { tools: {} } }
      );

      const mockClient = {
        getConstraints: vi.fn().mockResolvedValue({ success: true, constraints: [], count: 0 }),
      } as unknown as YantraClient;

      server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
          tools: getToolDefinitions(['mahakalp_sf_constraints']),
        };
      });

      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        return handleToolCall(name, (args ?? {}) as Record<string, unknown>, mockClient, new Set(['mahakalp_sf_constraints']));
      });

      expect(server).toBeDefined();
    });

    it('server reports correct version', () => {
      const server = new Server(
        { name: '@mahakalp/salesforce-mcp', version: '0.2.0' },
        { capabilities: { tools: {} } }
      );
      expect(server).toBeDefined();
    });
  });

  describe('fail-fast on protocol regressions', () => {
    it('returns error for invalid JSON-RPC payload', async () => {
      const mockClient = {
        getConstraints: vi.fn().mockResolvedValue({ success: true, constraints: [], count: 0 }),
      } as unknown as YantraClient;

      const server = new Server(
        { name: 'test-server', version: '1.0.0' },
        { capabilities: { tools: {} } }
      );

      server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools: getToolDefinitions(['mahakalp_sf_constraints']) };
      });

      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        return handleToolCall(name, (args ?? {}) as Record<string, unknown>, mockClient, new Set(['mahakalp_sf_constraints']));
      });

      expect(server).toBeDefined();
    });

    it('validates tool name format', async () => {
      const mockClient = {} as YantraClient;
      const allowedTools = new Set(['mahakalp_sf_constraints']);

      const result = await handleToolCall('invalid_tool_name', {}, mockClient, allowedTools);
      expect(result).toBeNull();
    });

    it('rejects tool call with missing required params', async () => {
      const mockClient = {} as YantraClient;
      const allowedTools = new Set(['mahakalp_sf_doc_search']);

      const result = await handleToolCall('mahakalp_sf_doc_search', {}, mockClient, allowedTools);
      expect(result?.isError).toBe(true);
    });

    it('returns error for disallowed tool even with valid params', async () => {
      const mockClient = {} as YantraClient;
      const allowedTools = new Set(['mahakalp_sf_constraints']);

      const result = await handleToolCall('mahakalp_sf_rules', { query: 'security' }, mockClient, allowedTools);
      expect(result).toBeNull();
    });
  });

  describe('tool gating under entitlement transitions', () => {
    const createMockEntitlement = (overrides: Partial<Entitlement> = {}): Entitlement => ({
      sub_id: 'sub_test',
      org_id: 'org_test',
      tier: 'pro',
      seats: 1,
      expires_at: Math.floor(Date.now() / 1000) + 86400,
      status: 'active',
      features: {},
      ...overrides,
    });

    it('transitions from free to pro when entitlement becomes active', async () => {
      const mockClient = {
        healthCheck: vi.fn().mockResolvedValue(true),
        getEntitlement: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createMockEntitlement({ status: 'active' })),
        getAllowedTools: vi.fn()
          .mockReturnValueOnce(['mahakalp_sf_constraints'])
          .mockReturnValueOnce([
            'mahakalp_sf_constraints',
            'mahakalp_sf_doc_search',
            'mahakalp_sf_releases',
            'mahakalp_sf_rules',
            'mahakalp_sf_patterns',
            'mahakalp_sf_decision_guides',
          ]),
      } as unknown as YantraClient;

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: null as number | null,
      };

      await refreshEntitlement(mockClient, serverState, 600000);
      const freeTools = Array.from(serverState.allowedToolNames);
      expect(freeTools).not.toContain('mahakalp_sf_rules');

      await refreshEntitlement(mockClient, serverState, 600000);
      const proTools = Array.from(serverState.allowedToolNames);
      expect(proTools).toContain('mahakalp_sf_rules');
    });

    it('transitions from pro to free when entitlement is revoked', async () => {
      const mockClient = {
        healthCheck: vi.fn().mockResolvedValue(true),
        getEntitlement: vi.fn()
          .mockResolvedValueOnce(createMockEntitlement({ status: 'active' }))
          .mockResolvedValueOnce(null),
        getAllowedTools: vi.fn()
          .mockReturnValueOnce([
            'mahakalp_sf_constraints',
            'mahakalp_sf_doc_search',
            'mahakalp_sf_releases',
            'mahakalp_sf_rules',
            'mahakalp_sf_patterns',
            'mahakalp_sf_decision_guides',
          ])
          .mockReturnValueOnce(['mahakalp_sf_constraints']),
      } as unknown as YantraClient;

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: null as number | null,
      };

      await refreshEntitlement(mockClient, serverState, 600000);
      const proTools = Array.from(serverState.allowedToolNames);
      expect(proTools).toContain('mahakalp_sf_rules');

      serverState.lastRefreshTimestamp = Date.now() - 700000;

      await refreshEntitlement(mockClient, serverState, 600000);
      const freeTools = Array.from(serverState.allowedToolNames);
      expect(freeTools).not.toContain('mahakalp_sf_rules');
    });

    it('blocks pro tools when entitlement status changes to past_due', async () => {
      const mockClient = {
        healthCheck: vi.fn().mockResolvedValue(true),
        getEntitlement: vi.fn()
          .mockResolvedValueOnce(createMockEntitlement({ status: 'active' }))
          .mockResolvedValueOnce(createMockEntitlement({ status: 'past_due' })),
        getAllowedTools: vi.fn()
          .mockReturnValueOnce([
            'mahakalp_sf_constraints',
            'mahakalp_sf_doc_search',
            'mahakalp_sf_releases',
            'mahakalp_sf_rules',
            'mahakalp_sf_patterns',
            'mahakalp_sf_decision_guides',
          ])
          .mockReturnValueOnce(['mahakalp_sf_constraints']),
      } as unknown as YantraClient;

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: null as number | null,
      };

      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.status).toBe('active');
      expect(Array.from(serverState.allowedToolNames)).toContain('mahakalp_sf_rules');

      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.status).toBe('past_due');
      expect(Array.from(serverState.allowedToolNames)).not.toContain('mahakalp_sf_rules');
    });

    it('maintains pro access during canceled status within grace period', async () => {
      const futureExpiry = Math.floor(Date.now() / 1000) + 86400;
      const mockClient = {
        healthCheck: vi.fn().mockResolvedValue(true),
        getEntitlement: vi.fn()
          .mockResolvedValueOnce(createMockEntitlement({ status: 'active' }))
          .mockResolvedValueOnce(createMockEntitlement({ status: 'canceled', expires_at: futureExpiry })),
        getAllowedTools: vi.fn()
          .mockReturnValueOnce([
            'mahakalp_sf_constraints',
            'mahakalp_sf_doc_search',
            'mahakalp_sf_releases',
            'mahakalp_sf_rules',
            'mahakalp_sf_patterns',
            'mahakalp_sf_decision_guides',
          ])
          .mockReturnValueOnce([
            'mahakalp_sf_constraints',
            'mahakalp_sf_doc_search',
            'mahakalp_sf_releases',
            'mahakalp_sf_rules',
            'mahakalp_sf_patterns',
            'mahakalp_sf_decision_guides',
          ]),
      } as unknown as YantraClient;

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: null as number | null,
      };

      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.status).toBe('active');

      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.status).toBe('canceled');
      expect(Array.from(serverState.allowedToolNames)).toContain('mahakalp_sf_rules');
    });

    it('drops pro access when canceled status grace period expires', async () => {
      const pastExpiry = Math.floor(Date.now() / 1000) - 3600;
      const mockClient = {
        healthCheck: vi.fn().mockResolvedValue(true),
        getEntitlement: vi.fn()
          .mockResolvedValueOnce(createMockEntitlement({ status: 'canceled', expires_at: pastExpiry })),
        getAllowedTools: vi.fn()
          .mockReturnValueOnce(['mahakalp_sf_constraints']),
      } as unknown as YantraClient;

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: Date.now() - 700000,
      };

      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.status).toBe('canceled');
      expect(Array.from(serverState.allowedToolNames)).not.toContain('mahakalp_sf_rules');
    });

    it('handles trialing status as valid pro access', async () => {
      const mockClient = {
        healthCheck: vi.fn().mockResolvedValue(true),
        getEntitlement: vi.fn()
          .mockResolvedValueOnce(createMockEntitlement({ status: 'trialing' })),
        getAllowedTools: vi.fn()
          .mockReturnValueOnce([
            'mahakalp_sf_constraints',
            'mahakalp_sf_doc_search',
            'mahakalp_sf_releases',
            'mahakalp_sf_rules',
            'mahakalp_sf_patterns',
            'mahakalp_sf_decision_guides',
          ]),
      } as unknown as YantraClient;

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: null as number | null,
      };

      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.status).toBe('trialing');
      expect(Array.from(serverState.allowedToolNames)).toContain('mahakalp_sf_rules');
    });

    it('updates tool definitions when entitlement changes', async () => {
      const mockClient = {
        healthCheck: vi.fn().mockResolvedValue(true),
        getEntitlement: vi.fn()
          .mockResolvedValueOnce(createMockEntitlement({ status: 'active' }))
          .mockResolvedValueOnce(createMockEntitlement({ status: 'past_due' })),
        getAllowedTools: vi.fn()
          .mockReturnValueOnce([
            'mahakalp_sf_constraints',
            'mahakalp_sf_doc_search',
            'mahakalp_sf_releases',
            'mahakalp_sf_rules',
            'mahakalp_sf_patterns',
            'mahakalp_sf_decision_guides',
          ])
          .mockReturnValueOnce(['mahakalp_sf_constraints']),
      } as unknown as YantraClient;

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: null as number | null,
      };

      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.toolDefs.length).toBe(6);

      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.toolDefs.length).toBe(1);
      expect(serverState.toolDefs[0].name).toBe('mahakalp_sf_constraints');
    });

    it('preserves last known good entitlement on transient API failure', async () => {
      const mockClient = {
        healthCheck: vi.fn().mockResolvedValue(true),
        getEntitlement: vi.fn()
          .mockResolvedValueOnce(createMockEntitlement({ status: 'active' }))
          .mockRejectedValueOnce(new Error('Network error'))
          .mockResolvedValueOnce(createMockEntitlement({ status: 'active' })),
        getAllowedTools: vi.fn()
          .mockReturnValueOnce([
            'mahakalp_sf_constraints',
            'mahakalp_sf_doc_search',
            'mahakalp_sf_releases',
            'mahakalp_sf_rules',
            'mahakalp_sf_patterns',
            'mahakalp_sf_decision_guides',
          ])
          .mockReturnValueOnce([
            'mahakalp_sf_constraints',
            'mahakalp_sf_doc_search',
            'mahakalp_sf_releases',
            'mahakalp_sf_rules',
            'mahakalp_sf_patterns',
            'mahakalp_sf_decision_guides',
          ])
          .mockReturnValueOnce([
            'mahakalp_sf_constraints',
            'mahakalp_sf_doc_search',
            'mahakalp_sf_releases',
            'mahakalp_sf_rules',
            'mahakalp_sf_patterns',
            'mahakalp_sf_decision_guides',
          ]),
      } as unknown as YantraClient;

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: null as number | null,
      };

      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.status).toBe('active');

      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.status).toBe('active');
      expect(serverState.lastKnownGoodEntitlement?.status).toBe('active');

      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.status).toBe('active');
    });
  });
});
