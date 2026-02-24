import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { YantraClient } from './client.js';
import { getToolDefinitions, handleToolCall } from './tools.js';

describe('tools', () => {
  describe('getToolDefinitions', () => {
    it('returns only allowed tools', () => {
      const allowed = ['mahakalp_sf_constraints', 'mahakalp_sf_doc_search'];
      const tools = getToolDefinitions(allowed);
      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).toContain('mahakalp_sf_constraints');
    });

    it('returns empty array when no tools allowed', () => {
      const tools = getToolDefinitions([]);
      expect(tools).toHaveLength(0);
    });

    it('filters out disallowed tools', () => {
      const allowed = ['mahakalp_sf_constraints'];
      const tools = getToolDefinitions(allowed);
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('mahakalp_sf_constraints');
    });

    it('includes all free tier tools', () => {
      const freeTools = ['mahakalp_sf_constraints', 'mahakalp_sf_doc_search', 'mahakalp_sf_releases'];
      const tools = getToolDefinitions(freeTools);
      expect(tools).toHaveLength(3);
    });

    it('includes pro tier tools when allowed', () => {
      const allTools = [
        'mahakalp_sf_constraints', 'mahakalp_sf_doc_search', 'mahakalp_sf_releases',
        'mahakalp_sf_rules', 'mahakalp_sf_patterns', 'mahakalp_sf_decision_guides'
      ];
      const tools = getToolDefinitions(allTools);
      expect(tools).toHaveLength(6);
    });
  });

  describe('handleToolCall', () => {
    let mockClient: YantraClient;

    beforeEach(() => {
      mockClient = {
        getConstraints: vi.fn().mockResolvedValue({ success: true, constraints: [], count: 0 }),
        searchDocs: vi.fn().mockResolvedValue({ success: true, results: [], count: 0, query: '' }),
        getReleases: vi.fn().mockResolvedValue({ success: true, releases: [], count: 0 }),
        queryRules: vi.fn().mockResolvedValue({ success: true, rules: [], count: 0 }),
        searchPatterns: vi.fn().mockResolvedValue({ success: true, patterns: [], count: 0, query: '' }),
        searchDecisionGuides: vi.fn().mockResolvedValue({ success: true, guides: [], count: 0, query: '' }),
      } as unknown as YantraClient;
    });

    it('returns null for disallowed tools', async () => {
      const allowedTools = new Set(['mahakalp_sf_constraints']);
      const result = await handleToolCall('mahakalp_sf_rules', { query: 'test' }, mockClient, allowedTools);
      expect(result).toBeNull();
    });

    it('calls getConstraints for mahakalp_sf_constraints', async () => {
      const allowedTools = new Set(['mahakalp_sf_constraints']);
      await handleToolCall('mahakalp_sf_constraints', { release_id: 'spring-26' }, mockClient, allowedTools);
      expect(mockClient.getConstraints).toHaveBeenCalledWith({ releaseId: 'spring-26' });
    });

    it('calls searchDocs for mahakalp_sf_doc_search', async () => {
      const allowedTools = new Set(['mahakalp_sf_doc_search']);
      await handleToolCall('mahakalp_sf_doc_search', { query: 'apex' }, mockClient, allowedTools);
      expect(mockClient.searchDocs).toHaveBeenCalledWith({ query: 'apex' });
    });

    it('calls getReleases for mahakalp_sf_releases', async () => {
      const allowedTools = new Set(['mahakalp_sf_releases']);
      await handleToolCall('mahakalp_sf_releases', { list_all: true }, mockClient, allowedTools);
      expect(mockClient.getReleases).toHaveBeenCalledWith({ listAll: true });
    });

    it('validates required query param for doc_search', async () => {
      const allowedTools = new Set(['mahakalp_sf_doc_search']);
      const result = await handleToolCall('mahakalp_sf_doc_search', {}, mockClient, allowedTools);
      expect(result?.isError).toBe(true);
      const textContent = result?.content.find((c: { type: string }) => c.type === 'text');
      expect((textContent as { text: string })?.text).toContain('query is required');
    });

    it('validates required query param for rules', async () => {
      const allowedTools = new Set(['mahakalp_sf_rules']);
      const result = await handleToolCall('mahakalp_sf_rules', {}, mockClient, allowedTools);
      expect(result?.isError).toBe(true);
      const textContent = result?.content.find((c: { type: string }) => c.type === 'text');
      expect((textContent as { text: string })?.text).toContain('query is required');
    });

    it('validates required query param for patterns', async () => {
      const allowedTools = new Set(['mahakalp_sf_patterns']);
      const result = await handleToolCall('mahakalp_sf_patterns', {}, mockClient, allowedTools);
      expect(result?.isError).toBe(true);
      const textContent = result?.content.find((c: { type: string }) => c.type === 'text');
      expect((textContent as { text: string })?.text).toContain('query is required');
    });

    it('validates required query param for decision_guides', async () => {
      const allowedTools = new Set(['mahakalp_sf_decision_guides']);
      const result = await handleToolCall('mahakalp_sf_decision_guides', {}, mockClient, allowedTools);
      expect(result?.isError).toBe(true);
      const textContent = result?.content.find((c: { type: string }) => c.type === 'text');
      expect((textContent as { text: string })?.text).toContain('query is required');
    });

    it('calls queryRules for mahakalp_sf_rules', async () => {
      const allowedTools = new Set(['mahakalp_sf_rules']);
      await handleToolCall('mahakalp_sf_rules', { query: 'security' }, mockClient, allowedTools);
      expect(mockClient.queryRules).toHaveBeenCalledWith({ query: 'security' });
    });

    it('calls searchPatterns for mahakalp_sf_patterns', async () => {
      const allowedTools = new Set(['mahakalp_sf_patterns']);
      await handleToolCall('mahakalp_sf_patterns', { query: 'batch' }, mockClient, allowedTools);
      expect(mockClient.searchPatterns).toHaveBeenCalledWith({ query: 'batch' });
    });

    it('calls searchDecisionGuides for mahakalp_sf_decision_guides', async () => {
      const allowedTools = new Set(['mahakalp_sf_decision_guides']);
      await handleToolCall('mahakalp_sf_decision_guides', { query: 'architecture' }, mockClient, allowedTools);
      expect(mockClient.searchDecisionGuides).toHaveBeenCalledWith({ query: 'architecture' });
    });

    it('returns null for unknown tools', async () => {
      const allowedTools = new Set(['mahakalp_sf_constraints']);
      const result = await handleToolCall('unknown_tool', {}, mockClient, allowedTools);
      expect(result).toBeNull();
    });
  });
});
