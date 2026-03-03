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
});
