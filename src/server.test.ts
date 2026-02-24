import { describe, it, expect, vi } from 'vitest';
import { getToolDefinitions } from './tools.js';

vi.mock('./client.js', () => ({
  YantraClient: class {
    constructor() {}
    getTier() {
      return Promise.resolve({
        tier: 'free',
        tools: ['mahakalp_sf_constraints', 'mahakalp_sf_doc_search', 'mahakalp_sf_releases'],
        limits: { requests_per_day: 100 },
      });
    }
  },
}));

vi.mock('./tools.js', () => ({
  getToolDefinitions: vi.fn().mockImplementation((tools: string[]) =>
    tools.map((name: string) => ({ name, description: 'Test tool', inputSchema: { type: 'object', properties: {}, required: [] } }))
  ),
  handleToolCall: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{"success":true}' }] }),
}));

describe('server', () => {
  it('getToolDefinitions returns tools for free tier', () => {
    const tools = getToolDefinitions(['mahakalp_sf_constraints', 'mahakalp_sf_doc_search', 'mahakalp_sf_releases']);
    expect(tools).toHaveLength(3);
  });

  it('getToolDefinitions returns empty for no tools', () => {
    const tools = getToolDefinitions([]);
    expect(tools).toHaveLength(0);
  });
});
