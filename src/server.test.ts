import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getToolDefinitions, handleToolCall, validateInput } from './tools.js';
import type { Entitlement } from './types.js';
import type { YantraClient } from './client.js';

vi.mock('./client.js', () => ({
  YantraClient: class {
    constructor() {}
    healthCheck() { return Promise.resolve(true); }
    getEntitlement() { return Promise.resolve(null); }
    getAllowedTools(e: Entitlement | null) { 
      if (!e) return ['mahakalp_sf_constraints'];
      return ['mahakalp_sf_constraints', 'mahakalp_sf_doc_search', 'mahakalp_sf_releases', 'mahakalp_sf_rules', 'mahakalp_sf_patterns', 'mahakalp_sf_decision_guides'];
    }
  },
}));

describe('server', () => {
  describe('getToolDefinitions', () => {
    it('returns tools for free tier', () => {
      const tools = getToolDefinitions(['mahakalp_sf_constraints', 'mahakalp_sf_doc_search', 'mahakalp_sf_releases']);
      expect(tools).toHaveLength(3);
    });

    it('returns empty for no tools', () => {
      const tools = getToolDefinitions([]);
      expect(tools).toHaveLength(0);
    });
  });

  describe('tool gating', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('blocks pro tools for free tier', async () => {
      const allowedTools = new Set(['mahakalp_sf_constraints']);
      const result = await handleToolCall('mahakalp_sf_rules', { query: 'test' }, {} as unknown as YantraClient, allowedTools);
      expect(result).toBeNull();
    });

    it('allows free tools for free tier', async () => {
      const mockClient: YantraClient = {
        getConstraints: vi.fn().mockResolvedValue({ success: true, constraints: [], count: 0 }),
      } as unknown as YantraClient;
      const allowedTools = new Set(['mahakalp_sf_constraints']);
      const result = await handleToolCall('mahakalp_sf_constraints', { release_id: 'spring-26' }, mockClient, allowedTools);
      expect(result).toBeDefined();
    });

    it('allows all tools for pro tier', async () => {
      const allowedTools = new Set([
        'mahakalp_sf_constraints',
        'mahakalp_sf_doc_search',
        'mahakalp_sf_releases',
        'mahakalp_sf_rules',
        'mahakalp_sf_patterns',
        'mahakalp_sf_decision_guides',
      ]);
      const result = await handleToolCall('mahakalp_sf_rules', { query: 'security' }, {} as unknown as YantraClient, allowedTools);
      expect(result).not.toBeNull();
    });
  });

  describe('entitlement refresh', () => {
    it('client fetches entitlement', async () => {
      const { YantraClient } = await import('./client.js');
      const client = new YantraClient({ apiBaseUrl: 'https://test.api' });
      const entitlement = await client.getEntitlement();
      expect(entitlement).toBeDefined();
    });

    it('client allows pro tools when entitlement is active', async () => {
      const { YantraClient } = await import('./client.js');
      const client = new YantraClient({ apiBaseUrl: 'https://test.api' });
      const entitlement: Entitlement = {
        sub_id: 'sub_test',
        org_id: 'org_test',
        tier: 'pro',
        seats: 1,
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        status: 'active',
        features: {},
      };
      const allowedTools = client.getAllowedTools(entitlement);
      expect(allowedTools).toContain('mahakalp_sf_rules');
    });

    it('client returns only free tools for null entitlement', async () => {
      const { YantraClient } = await import('./client.js');
      const client = new YantraClient({ apiBaseUrl: 'https://test.api' });
      const allowedTools = client.getAllowedTools(null);
      expect(allowedTools).not.toContain('mahakalp_sf_rules');
    });
  });

  describe('runtime schema validation', () => {
    it('validateInput returns errors for missing required fields', () => {
      const schema = {
        type: 'object' as const,
        properties: { query: { type: 'string' as const } },
        required: ['query'],
      };
      const errors = validateInput(schema, {});
      expect(errors.length).toBeGreaterThan(0);
    });

    it('validateInput returns no errors for valid input', () => {
      const schema = {
        type: 'object' as const,
        properties: { query: { type: 'string' as const } },
        required: ['query'],
      };
      const errors = validateInput(schema, { query: 'test' });
      expect(errors).toHaveLength(0);
    });

    it('handleToolCall returns error for missing required params', async () => {
      const allowedTools = new Set(['mahakalp_sf_doc_search']);
      const result = await handleToolCall('mahakalp_sf_doc_search', {}, {} as unknown as YantraClient, allowedTools);
      expect(result?.isError).toBe(true);
    });
  });

  describe('entitlement refresh lifecycle', () => {
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

    it('preserves last known good entitlement on transient API failure', async () => {
      const { YantraClient } = await import('./client.js');
      
      let callCount = 0;
      const mockClient = new YantraClient({ apiBaseUrl: 'https://test.api' });
      
      vi.spyOn(mockClient, 'getEntitlement').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return createMockEntitlement();
        }
        throw new Error('ECONNRESET');
      });

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: null as number | null,
      };

      const { refreshEntitlement } = await import('./server.js');
      
      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement).not.toBeNull();
      expect(serverState.lastKnownGoodEntitlement).not.toBeNull();
      
      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement).not.toBeNull();
      expect(serverState.lastKnownGoodEntitlement?.tier).toBe('pro');
    });

    it('uses last known good entitlement when API returns null but not stale', async () => {
      const { YantraClient } = await import('./client.js');
      
      const mockClient = new YantraClient({ apiBaseUrl: 'https://test.api' });
      const proEntitlement = createMockEntitlement();
      
      vi.spyOn(mockClient, 'getEntitlement')
        .mockResolvedValueOnce(proEntitlement)
        .mockResolvedValueOnce(null);

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: null as number | null,
      };

      const { refreshEntitlement } = await import('./server.js');
      
      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.tier).toBe('pro');
      
      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.tier).toBe('pro');
    });

    it('uses last known good when stale threshold exceeded but entitlement exists', async () => {
      const { YantraClient } = await import('./client.js');
      
      const mockClient = new YantraClient({ apiBaseUrl: 'https://test.api' });
      const proEntitlement = createMockEntitlement();
      
      vi.spyOn(mockClient, 'getEntitlement')
        .mockResolvedValueOnce(proEntitlement)
        .mockResolvedValueOnce(null);

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: null as number | null,
      };

      const { refreshEntitlement } = await import('./server.js');
      
      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.tier).toBe('pro');
      
      serverState.lastRefreshTimestamp = Date.now() - 700000;
      
      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.tier).toBe('pro');
    });

    it('falls back to free tier when no cached entitlement and API fails', async () => {
      const { YantraClient } = await import('./client.js');
      
      const mockClient = new YantraClient({ apiBaseUrl: 'https://test.api' });
      
      vi.spyOn(mockClient, 'getEntitlement').mockRejectedValue(new Error('Network error'));
      vi.spyOn(mockClient, 'getAllowedTools').mockImplementation((entitlement) => {
        if (!entitlement) return ['mahakalp_sf_constraints'];
        return ['mahakalp_sf_constraints', 'mahakalp_sf_doc_search', 'mahakalp_sf_releases', 'mahakalp_sf_rules', 'mahakalp_sf_patterns', 'mahakalp_sf_decision_guides'];
      });

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: null as number | null,
      };

      const { refreshEntitlement } = await import('./server.js');
      
      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement).toBeNull();
      expect(Array.from(serverState.allowedToolNames)).toContain('mahakalp_sf_constraints');
    });

    it('does not downgrade to free tier on API blip when entitlement was pro', async () => {
      const { YantraClient } = await import('./client.js');
      
      const mockClient = new YantraClient({ apiBaseUrl: 'https://test.api' });
      const proEntitlement = createMockEntitlement({ status: 'active' });
      
      vi.spyOn(mockClient, 'getEntitlement')
        .mockResolvedValueOnce(proEntitlement)
        .mockRejectedValueOnce(new Error('ETIMEDOUT'));

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: null as number | null,
      };

      const { refreshEntitlement } = await import('./server.js');
      
      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.tier).toBe('pro');
      
      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.tier).toBe('pro');
      
      const allowedTools = Array.from(serverState.allowedToolNames);
      expect(allowedTools).toContain('mahakalp_sf_rules');
    });

    it('correctly handles entitlement status change from active to past_due', async () => {
      const { YantraClient } = await import('./client.js');
      
      const mockClient = new YantraClient({ apiBaseUrl: 'https://test.api' });
      const activeEntitlement = createMockEntitlement({ status: 'active' });
      const pastDueEntitlement = createMockEntitlement({ status: 'past_due' });
      
      vi.spyOn(mockClient, 'getEntitlement')
        .mockResolvedValueOnce(activeEntitlement)
        .mockResolvedValueOnce(pastDueEntitlement);

      const getToolNamesByTierModule = await import('./tools.js');
      const FREE_TOOLS = getToolNamesByTierModule.getToolNamesByTier('free');
      const PRO_TOOLS = getToolNamesByTierModule.getToolNamesByTier('pro');

      vi.spyOn(mockClient, 'getAllowedTools').mockImplementation((ent) => {
        if (!ent) return FREE_TOOLS;
        if (ent.status === 'active' || ent.status === 'trialing') return PRO_TOOLS;
        return FREE_TOOLS;
      });

      const serverState = {
        allowedToolNames: new Set<string>(),
        toolDefs: [] as ReturnType<typeof getToolDefinitions>,
        entitlement: null as Entitlement | null,
        lastKnownGoodEntitlement: null as Entitlement | null,
        lastRefreshTimestamp: null as number | null,
      };

      const { refreshEntitlement } = await import('./server.js');
      
      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.status).toBe('active');
      
      await refreshEntitlement(mockClient, serverState, 600000);
      expect(serverState.entitlement?.status).toBe('past_due');
      
      const allowedTools = Array.from(serverState.allowedToolNames);
      expect(allowedTools).not.toContain('mahakalp_sf_rules');
    });
  });
});
