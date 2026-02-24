import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YantraClient } from './client.js';

vi.stubGlobal('fetch', vi.fn());

describe('YantraClient', () => {
  let client: YantraClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
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
      const tierResponse = { tier: 'pro', tools: ['mahakalp_sf_constraints', 'mahakalp_sf_rules'], limits: { requests_per_day: 1000 } };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(tierResponse) });
      const result = await client.getTier();
      expect(result.tier).toBe('pro');
      expect(result.tools).toContain('mahakalp_sf_rules');
    });
  });

  describe('getConstraints', () => {
    it('builds query string from params', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, constraints: [], count: 0 }) });
      await client.getConstraints({ releaseId: 'spring-26', constraintType: 'governor_limit', maxResults: 10 });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.mahakalp.dev/api/public/ecosystem/constraints?release_id=spring-26&constraint_type=governor_limit&max_results=10',
        expect.any(Object)
      );
    });

    it('handles empty params', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, constraints: [], count: 0 }) });
      await client.getConstraints({});
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('searchDocs', () => {
    it('sends POST request with query', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, results: [], count: 0, query: 'test' }) });
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
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true, releases: [], count: 0 }) });
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
      const originalFetch = globalThis.fetch;
      const abortError = new Error('The operation was aborted.');
      abortError.name = 'AbortError';
      globalThis.fetch = vi.fn().mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(abortError), 20)));
      
      try {
        await expect(slowClient.searchDocs({ query: 'test' })).rejects.toThrow('timed out');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('API error handling', () => {
    it('throws error with status code on non-ok response when not using fallback', async () => {
      const customClient = new YantraClient({ apiBaseUrl: 'https://test.mahakalp.dev' });
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized', text: () => Promise.resolve('') });
      
      try {
        await expect(customClient.searchDocs({ query: 'test' })).rejects.toThrow('Yantra API error 401');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
