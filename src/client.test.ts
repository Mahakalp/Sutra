import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YantraClient } from './client.js';
import type { Entitlement } from './types.js';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const FREE_TOOLS = ['mahakalp_sf_constraints', 'mahakalp_sf_doc_search', 'mahakalp_sf_releases'];

const PRO_TOOLS = [
  'mahakalp_sf_constraints',
  'mahakalp_sf_doc_search',
  'mahakalp_sf_releases',
  'mahakalp_sf_rules',
  'mahakalp_sf_patterns',
  'mahakalp_sf_decision_guides',
];

describe('YantraClient', () => {
  let client: YantraClient;

  beforeEach(() => {
    mockFetch.mockClear();
    client = new YantraClient({ apiBaseUrl: 'https://test.mahakalp.dev', apiKey: 'test-key' });
  });

  describe('constructor', () => {
    it('uses default API URL when not provided', () => {
      const defaultClient = new YantraClient();
      expect(defaultClient).toBeDefined();
    });

    it('uses custom API URL when provided', () => {
      const customClient = new YantraClient({ apiBaseUrl: 'https://custom.api' });
      expect(customClient).toBeDefined();
    });

    it('strips trailing slashes from URL', () => {
      const client = new YantraClient({ apiBaseUrl: 'https://test.api///' });
      expect(client).toBeDefined();
    });

    it('uses custom timeout when provided', () => {
      const client = new YantraClient({ timeout: 5000 });
      expect(client).toBeDefined();
    });
  });

  describe('getTier', () => {
    it('returns free tier fallback on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const result = await client.getTier();
      expect(result.tier).toBe('free');
      expect(result.tools).toContain('mahakalp_sf_constraints');
    });

    it('returns tier info on success', async () => {
      const tierResponse = {
        tier: 'pro',
        tools: ['mahakalp_sf_constraints', 'mahakalp_sf_rules'],
        limits: { requests_per_day: 1000 },
      };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(tierResponse) });
      const result = await client.getTier();
      expect(result.tier).toBe('pro');
      expect(result.tools).toContain('mahakalp_sf_rules');
    });
  });

  describe('getConstraints', () => {
    it('builds query string from params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, constraints: [], count: 0 }),
      });
      await client.getConstraints({
        releaseId: 'spring-26',
        constraintType: 'governor_limit',
        maxResults: 10,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.mahakalp.dev/api/public/ecosystem/constraints?release_id=spring-26&constraint_type=governor_limit&max_results=10',
        expect.any(Object)
      );
    });

    it('handles empty params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, constraints: [], count: 0 }),
      });
      await client.getConstraints({});
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('searchDocs', () => {
    it('sends POST request with query', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, results: [], count: 0, query: 'test' }),
      });
      await client.searchDocs({ query: 'apex triggers' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.mahakalp.dev/api/public/ecosystem/docs/search',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ query: 'apex triggers', max_results: 5 }),
        })
      );
    });
  });

  describe('getReleases', () => {
    it('builds query string with boolean params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, releases: [], count: 0 }),
      });
      await client.getReleases({ includeArchived: true, listAll: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.mahakalp.dev/api/public/ecosystem/releases?include_archived=true&list_all=true',
        expect.any(Object)
      );
    });
  });

  describe('request timeout', () => {
    it('throws timeout error when request exceeds timeout', async () => {
      const slowClient = new YantraClient({ timeout: 10 });
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      mockFetch.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(abortError), 20))
      );

      await expect(slowClient.searchDocs({ query: 'test' })).rejects.toThrow('timed out');
    });
  });

  describe('API error handling', () => {
    it('throws error with status code on non-ok response when not using fallback', async () => {
      const customClient = new YantraClient({ apiBaseUrl: 'https://test.mahakalp.dev' });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve(''),
      });

      await expect(customClient.searchDocs({ query: 'test' })).rejects.toThrow(
        'Yantra API error 401'
      );
    });
  });

  describe('retry logic', () => {
    it('retries on transient errors', async () => {
      const retryClient = new YantraClient({
        apiBaseUrl: 'https://test.mahakalp.dev',
        maxRetries: 3,
        retryDelay: 10,
      });
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('ECONNRESET'));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, results: [], count: 0, query: 'test' }),
        });
      });

      const result = await retryClient.searchDocs({ query: 'test' });
      expect(callCount).toBe(3);
      expect(result.success).toBe(true);
    });

    it('does not retry on max retries exceeded', async () => {
      const retryClient = new YantraClient({
        apiBaseUrl: 'https://test.mahakalp.dev',
        maxRetries: 2,
        retryDelay: 10,
      });
      mockFetch.mockRejectedValue(new Error('ECONNRESET'));

      await expect(retryClient.searchDocs({ query: 'test' })).rejects.toThrow('ECONNRESET');
    });
  });

  describe('healthCheck', () => {
    it('returns true when API is reachable', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'ok' }) });

      const result = await client.healthCheck();
      expect(result).toBe(true);
    });

    it('returns false when API is unreachable', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('getEntitlement', () => {
    const validEntitlement: Entitlement = {
      sub_id: 'sub_abc123',
      org_id: 'org_xyz789',
      tier: 'pro',
      seats: 5,
      expires_at: Math.floor(Date.now() / 1000) + 86400,
      status: 'active',
      features: { api_access: true },
    };

    it('returns entitlement on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ entitlement: validEntitlement }),
      });
      const result = await client.getEntitlement();
      expect(result).toEqual(validEntitlement);
    });

    it('returns null on API error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const result = await client.getEntitlement();
      expect(result).toBeNull();
    });

    it('returns null when entitlement is missing from response', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      const result = await client.getEntitlement();
      expect(result).toBeNull();
    });
  });

  describe('isEntitlementValid', () => {
    const futureExpiry = Math.floor(Date.now() / 1000) + 86400;
    const pastExpiry = Math.floor(Date.now() / 1000) - 86400;

    it('returns false for null entitlement', () => {
      expect(client.isEntitlementValid(null)).toBe(false);
    });

    it('returns true for active status', () => {
      const entitlement: Entitlement = {
        sub_id: 'sub_1',
        org_id: 'org_1',
        tier: 'pro',
        seats: 1,
        expires_at: futureExpiry,
        status: 'active',
        features: {},
      };
      expect(client.isEntitlementValid(entitlement)).toBe(true);
    });

    it('returns true for trialing status', () => {
      const entitlement: Entitlement = {
        sub_id: 'sub_1',
        org_id: 'org_1',
        tier: 'pro',
        seats: 1,
        expires_at: futureExpiry,
        status: 'trialing',
        features: {},
      };
      expect(client.isEntitlementValid(entitlement)).toBe(true);
    });

    it('returns false for past_due status', () => {
      const entitlement: Entitlement = {
        sub_id: 'sub_1',
        org_id: 'org_1',
        tier: 'pro',
        seats: 1,
        expires_at: futureExpiry,
        status: 'past_due',
        features: {},
      };
      expect(client.isEntitlementValid(entitlement)).toBe(false);
    });

    it('returns false for deleted status', () => {
      const entitlement: Entitlement = {
        sub_id: 'sub_1',
        org_id: 'org_1',
        tier: 'pro',
        seats: 1,
        expires_at: futureExpiry,
        status: 'deleted',
        features: {},
      };
      expect(client.isEntitlementValid(entitlement)).toBe(false);
    });

    it('returns true for canceled status with future expiry (grace period)', () => {
      const entitlement: Entitlement = {
        sub_id: 'sub_1',
        org_id: 'org_1',
        tier: 'pro',
        seats: 1,
        expires_at: futureExpiry,
        status: 'canceled',
        features: {},
      };
      expect(client.isEntitlementValid(entitlement)).toBe(true);
    });

    it('returns false for canceled status with past expiry (grace period expired)', () => {
      const entitlement: Entitlement = {
        sub_id: 'sub_1',
        org_id: 'org_1',
        tier: 'pro',
        seats: 1,
        expires_at: pastExpiry,
        status: 'canceled',
        features: {},
      };
      expect(client.isEntitlementValid(entitlement)).toBe(false);
    });
  });

  describe('getAllowedTools', () => {
    it('returns free tools for null entitlement', () => {
      const tools = client.getAllowedTools(null);
      expect(tools).toEqual(FREE_TOOLS);
    });

    it('returns free tools for free tier', () => {
      const entitlement: Entitlement = {
        sub_id: 'sub_1',
        org_id: 'org_1',
        tier: 'free',
        seats: 1,
        expires_at: 0,
        status: 'active',
        features: {},
      };
      const tools = client.getAllowedTools(entitlement);
      expect(tools).toEqual(FREE_TOOLS);
    });

    it('returns pro tools for active entitlement', () => {
      const entitlement: Entitlement = {
        sub_id: 'sub_1',
        org_id: 'org_1',
        tier: 'pro',
        seats: 1,
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        status: 'active',
        features: {},
      };
      const tools = client.getAllowedTools(entitlement);
      expect(tools).toEqual(PRO_TOOLS);
    });

    it('returns pro tools for trialing entitlement', () => {
      const entitlement: Entitlement = {
        sub_id: 'sub_1',
        org_id: 'org_1',
        tier: 'pro',
        seats: 1,
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        status: 'trialing',
        features: {},
      };
      const tools = client.getAllowedTools(entitlement);
      expect(tools).toEqual(PRO_TOOLS);
    });

    it('returns free tools for past_due entitlement (downgrade)', () => {
      const entitlement: Entitlement = {
        sub_id: 'sub_1',
        org_id: 'org_1',
        tier: 'pro',
        seats: 1,
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        status: 'past_due',
        features: {},
      };
      const tools = client.getAllowedTools(entitlement);
      expect(tools).toEqual(FREE_TOOLS);
    });

    it('returns free tools for deleted entitlement', () => {
      const entitlement: Entitlement = {
        sub_id: 'sub_1',
        org_id: 'org_1',
        tier: 'pro',
        seats: 1,
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        status: 'deleted',
        features: {},
      };
      const tools = client.getAllowedTools(entitlement);
      expect(tools).toEqual(FREE_TOOLS);
    });

    it('returns pro tools for canceled entitlement within grace period', () => {
      const entitlement: Entitlement = {
        sub_id: 'sub_1',
        org_id: 'org_1',
        tier: 'pro',
        seats: 1,
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        status: 'canceled',
        features: {},
      };
      const tools = client.getAllowedTools(entitlement);
      expect(tools).toEqual(PRO_TOOLS);
    });

    it('returns free tools for canceled entitlement after grace period', () => {
      const entitlement: Entitlement = {
        sub_id: 'sub_1',
        org_id: 'org_1',
        tier: 'pro',
        seats: 1,
        expires_at: Math.floor(Date.now() / 1000) - 86400,
        status: 'canceled',
        features: {},
      };
      const tools = client.getAllowedTools(entitlement);
      expect(tools).toEqual(FREE_TOOLS);
    });

    it('returns pro tools for enterprise tier when valid', () => {
      const entitlement: Entitlement = {
        sub_id: 'sub_1',
        org_id: 'org_1',
        tier: 'enterprise',
        seats: 10,
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        status: 'active',
        features: {},
      };
      const tools = client.getAllowedTools(entitlement);
      expect(tools).toEqual(PRO_TOOLS);
    });
  });
});
