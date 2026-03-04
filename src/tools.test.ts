import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { YantraClient } from './client.js';
import { getToolDefinitions, handleToolCall, validateInput } from './tools.js';

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

  describe('validateInput', () => {
    it('returns no errors for valid input', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const },
          max_results: { type: 'number' as const },
        },
        required: ['query'],
      };
      const errors = validateInput(schema, { query: 'test', max_results: 10 });
      expect(errors).toHaveLength(0);
    });

    it('returns error for missing required field', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const },
        },
        required: ['query'],
      };
      const errors = validateInput(schema, {});
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('query');
    });

    it('returns error for wrong type', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const },
        },
        required: [],
      };
      const errors = validateInput(schema, { query: 123 });
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('must be a string');
    });

    it('returns error for invalid enum value', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          constraint_type: { type: 'string' as const, enum: ['governor_limit', 'platform_rule'] },
        },
        required: [],
      };
      const errors = validateInput(schema, { constraint_type: 'invalid' });
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('must be one of');
    });

    it('returns no errors for valid enum value', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          constraint_type: { type: 'string' as const, enum: ['governor_limit', 'platform_rule'] },
        },
        required: [],
      };
      const errors = validateInput(schema, { constraint_type: 'governor_limit' });
      expect(errors).toHaveLength(0);
    });

    it('validates array type', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          topics: { type: 'array' as const, items: { type: 'string' } },
        },
        required: [],
      };
      const errors = validateInput(schema, { topics: 'not-array' });
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('must be an array');
    });

    it('validates boolean type', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          include_archived: { type: 'boolean' as const },
        },
        required: [],
      };
      const errors = validateInput(schema, { include_archived: 'true' });
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('must be a boolean');
    });

    it('returns multiple errors for multiple issues', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const },
          max_results: { type: 'number' as const },
        },
        required: ['query'],
      };
      const errors = validateInput(schema, { query: 123, max_results: 'ten' });
      expect(errors).toHaveLength(2);
    });

    it('rejects non-object args', () => {
      const schema = {
        type: 'object' as const,
        properties: { query: { type: 'string' as const } },
        required: ['query'],
      };
      expect(validateInput(schema, null)).toHaveLength(1);
      expect(validateInput(schema, undefined)).toHaveLength(1);
      expect(validateInput(schema, 'string')).toHaveLength(1);
      expect(validateInput(schema, 123)).toHaveLength(1);
      expect(validateInput(schema, [])).toHaveLength(1);
    });

    it('rejects unknown fields', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const },
        },
        required: [],
      };
      const errors = validateInput(schema, { query: 'test', unknown_field: 'bad' });
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('unknown_field');
      expect(errors[0].message).toContain('Unknown field');
    });

    it('rejects multiple unknown fields', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const },
        },
        required: [],
      };
      const errors = validateInput(schema, { query: 'test', foo: 'bar', baz: 123 });
      expect(errors).toHaveLength(2);
      expect(errors.map(e => e.field).sort()).toEqual(['baz', 'foo']);
    });

    it('validates array item types - string items', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          topics: { type: 'array' as const, items: { type: 'string' as const } },
        },
        required: [],
      };
      const errors = validateInput(schema, { topics: ['valid', 'array'] });
      expect(errors).toHaveLength(0);
    });

    it('rejects array with wrong item types', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          topics: { type: 'array' as const, items: { type: 'string' as const } },
        },
        required: [],
      };
      const errors = validateInput(schema, { topics: ['valid', 123, 'also valid'] });
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('topics[1] must be a string');
    });

    it('rejects array with wrong item types for multiple items', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          constraint_ids: { type: 'array' as const, items: { type: 'string' as const } },
        },
        required: [],
      };
      const errors = validateInput(schema, { constraint_ids: [1, 2, 3] });
      expect(errors).toHaveLength(3);
      expect(errors[0].message).toContain('constraint_ids[0] must be a string');
      expect(errors[1].message).toContain('constraint_ids[1] must be a string');
      expect(errors[2].message).toContain('constraint_ids[2] must be a string');
    });

    it('validates array with number items', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          numbers: { type: 'array' as const, items: { type: 'number' as const } },
        },
        required: [],
      };
      const errors = validateInput(schema, { numbers: [1, 2, 3] });
      expect(errors).toHaveLength(0);
    });

    it('rejects array with wrong number item types', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          numbers: { type: 'array' as const, items: { type: 'number' as const } },
        },
        required: [],
      };
      const errors = validateInput(schema, { numbers: ['not', 'numbers'] });
      expect(errors).toHaveLength(2);
    });

    it('validates array with boolean items', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          flags: { type: 'array' as const, items: { type: 'boolean' as const } },
        },
        required: [],
      };
      const errors = validateInput(schema, { flags: [true, false, true] });
      expect(errors).toHaveLength(0);
    });

    it('rejects array with wrong boolean item types', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          flags: { type: 'array' as const, items: { type: 'boolean' as const } },
        },
        required: [],
      };
      const errors = validateInput(schema, { flags: [true, 'false', 1] });
      expect(errors).toHaveLength(2);
    });

    it('returns error for unknown field and wrong type together', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const },
        },
        required: ['query'],
      };
      const errors = validateInput(schema, { query: 123, unknown: 'bad' });
      expect(errors).toHaveLength(2);
      const fields = errors.map(e => e.field).sort();
      expect(fields).toEqual(['query', 'unknown']);
    });

    it('handles empty object with no required fields', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const },
        },
        required: [],
      };
      const errors = validateInput(schema, {});
      expect(errors).toHaveLength(0);
    });

    it('handles empty object with required fields missing', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          query: { type: 'string' as const },
        },
        required: ['query'],
      };
      const errors = validateInput(schema, {});
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('query');
    });
  });

  describe('strict MCP schema negative-path coverage', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        query: { type: 'string' as const },
        release_id: { type: 'string' as const },
        max_results: { type: 'number' as const, minimum: 1, maximum: 100 },
        constraint_type: { type: 'string' as const, enum: ['governor_limit', 'platform_rule'] },
        include_archived: { type: 'boolean' as const },
      },
      required: ['query'],
    };

    it('rejects empty string for required field', () => {
      const errors = validateInput(schema, { query: '' });
      expect(errors.some(e => e.field === 'query')).toBe(true);
    });

    it('rejects whitespace-only string', () => {
      const errors = validateInput(schema, { query: '   ' });
      expect(errors.some(e => e.field === 'query')).toBe(true);
    });

    it('rejects string with null bytes', () => {
      const errors = validateInput(schema, { query: 'test\x00injection' });
      expect(errors.some(e => e.field === 'query' && e.message.includes('null bytes'))).toBe(true);
    });

    it('rejects string with unicode control characters', () => {
      const errors = validateInput(schema, { query: 'test\u0000\u001f\u007f' });
      expect(errors.some(e => e.field === 'query' && e.message.includes('control characters'))).toBe(true);
    });

    it('rejects extremely long string (DoS prevention)', () => {
      const longString = 'a'.repeat(1_000_000);
      const errors = validateInput(schema, { query: longString });
      expect(errors.some(e => e.field === 'query' && e.message.includes('too long'))).toBe(true);
    });

    it('rejects deeply nested object', () => {
      const nested: Record<string, unknown> = { query: 'test' };
      let current = nested;
      for (let i = 0; i < 50; i++) {
        current.nested = {};
        current = current.nested as Record<string, unknown>;
      }
      const errors = validateInput(schema, nested);
      expect(errors.some(e => e.message.includes('too deep'))).toBe(true);
    });

    it('rejects number below minimum', () => {
      const errors = validateInput(schema, { query: 'test', max_results: 0 });
      expect(errors.some(e => e.field === 'max_results')).toBe(true);
    });

    it('rejects number above maximum', () => {
      const errors = validateInput(schema, { query: 'test', max_results: 999 });
      expect(errors.some(e => e.field === 'max_results')).toBe(true);
    });

    it('rejects negative number where positive expected', () => {
      const errors = validateInput(schema, { query: 'test', max_results: -1 });
      expect(errors.some(e => e.field === 'max_results')).toBe(true);
    });

    it('rejects NaN as number', () => {
      const errors = validateInput(schema, { query: 'test', max_results: NaN });
      expect(errors.some(e => e.field === 'max_results' && e.message.includes('NaN'))).toBe(true);
    });

    it('rejects Infinity as number', () => {
      const errors = validateInput(schema, { query: 'test', max_results: Infinity });
      expect(errors.some(e => e.field === 'max_results' && e.message.includes('finite'))).toBe(true);
    });

    it('rejects SQL injection attempt in string', () => {
      const errors = validateInput(schema, { query: "'; DROP TABLE users; --" });
      expect(errors).toHaveLength(0);
    });

    it('rejects XSS attempt in string', () => {
      const errors = validateInput(schema, { query: '<script>alert(1)</script>' });
      expect(errors).toHaveLength(0);
    });

    it('rejects path traversal attempt', () => {
      const errors = validateInput(schema, { query: '../../../etc/passwd' });
      expect(errors).toHaveLength(0);
    });

    it('rejects template literal injection', () => {
      const errors = validateInput(schema, { query: '${process.env.MAHAKALP_API_KEY}' });
      expect(errors).toHaveLength(0);
    });

    it('rejects nested object where string expected', () => {
      const errors = validateInput(schema, { query: { nested: 'value' } });
      expect(errors.some(e => e.field === 'query')).toBe(true);
    });

    it('rejects array where object expected', () => {
      const errors = validateInput(schema, { query: ['item1', 'item2'] });
      expect(errors.some(e => e.field === 'query')).toBe(true);
    });

    it('rejects number where string expected', () => {
      const errors = validateInput(schema, { query: 12345 });
      expect(errors.some(e => e.field === 'query')).toBe(true);
    });

    it('rejects boolean where string expected', () => {
      const errors = validateInput(schema, { query: true });
      expect(errors.some(e => e.field === 'query')).toBe(true);
    });

    it('rejects all JSON primitive types in object field', () => {
      expect(validateInput(schema, { query: null }).length).toBeGreaterThan(0);
      expect(validateInput(schema, { query: undefined }).length).toBeGreaterThan(0);
    });

    it('validates maximum depth even with valid nested structure', () => {
      const deepObj: Record<string, unknown> = { query: 'test' };
      let current: Record<string, unknown> = deepObj;
      for (let i = 0; i < 20; i++) {
        current.level = { query: 'test' };
        current = current.level as Record<string, unknown>;
      }
      const errors = validateInput(schema, deepObj);
      expect(errors.some(e => e.message.includes('too deep'))).toBe(true);
    });
  });
});
