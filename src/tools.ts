/**
 * Sutra — MCP tool definitions and handlers
 *
 * Free tier: sf_constraints, sf_doc_search, sf_releases
 * All tools call Yantra API endpoints. No direct database access.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { YantraClient } from './client.js';

// =============================================================================
// Tool Definitions
// =============================================================================

export const TOOL_DEFINITIONS = [
  {
    name: 'mahakalp_sf_constraints',
    description:
      'Get Salesforce platform constraints including governor limits, platform rules, and best practices. Returns structured data with limit values, context, workarounds, and code examples. Powered by Mahakalp.dev',
    inputSchema: {
      type: 'object' as const,
      properties: {
        release_id: {
          type: 'string',
          description:
            'Release identifier (e.g., "spring-26"). If not provided, uses the current release.',
        },
        constraint_type: {
          type: 'string',
          enum: ['governor_limit', 'platform_rule', 'best_practice'],
          description: 'Filter by constraint type. If not provided, returns all types.',
        },
        constraint_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific constraint IDs to fetch. If not provided, returns all.',
        },
        context: {
          type: 'string',
          description: 'Filter by context (e.g., "apex", "soql", "dml", "triggers").',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of constraints to return (default: 100)',
        },
      },
      required: [],
    },
  },
  {
    name: 'mahakalp_sf_doc_search',
    description:
      'Search Salesforce official documentation using semantic search. Returns relevant documentation chunks for RAG context. Useful for answering questions about Apex, LWC, SOQL, or any Salesforce platform feature. Powered by Mahakalp.dev',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query',
        },
        release_id: {
          type: 'string',
          description:
            'Release identifier (e.g., "spring-26"). If not provided, uses the current release.',
        },
        topics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Topic filters (e.g., ["soql", "triggers", "bulkification"])',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results (default: 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'mahakalp_sf_releases',
    description:
      'Get information about Salesforce releases. Returns release metadata including API version, status, and release dates. Powered by Mahakalp.dev',
    inputSchema: {
      type: 'object' as const,
      properties: {
        release_id: {
          type: 'string',
          description: 'Specific release ID to get details for. If not provided, returns the current release.',
        },
        include_archived: {
          type: 'boolean',
          description: 'Include archived releases when listing all (default: false)',
        },
        list_all: {
          type: 'boolean',
          description: 'List all releases instead of just the current one',
        },
      },
      required: [],
    },
  },
];

// =============================================================================
// Tool Dispatch
// =============================================================================

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  client: YantraClient,
): Promise<CallToolResult | null> {
  switch (name) {
    case 'mahakalp_sf_constraints':
      return handleConstraints(args, client);
    case 'mahakalp_sf_doc_search':
      return handleDocSearch(args, client);
    case 'mahakalp_sf_releases':
      return handleReleases(args, client);
    default:
      return null;
  }
}

// =============================================================================
// Tool Handlers
// =============================================================================

async function handleConstraints(
  args: Record<string, unknown>,
  client: YantraClient,
): Promise<CallToolResult> {
  try {
    const response = await client.getConstraints({
      releaseId: args.release_id as string | undefined,
      constraintType: args.constraint_type as string | undefined,
      constraintIds: args.constraint_ids as string[] | undefined,
      context: args.context as string | undefined,
      maxResults: args.max_results as number | undefined,
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
    };
  } catch (error) {
    return errorResult(error);
  }
}

async function handleDocSearch(
  args: Record<string, unknown>,
  client: YantraClient,
): Promise<CallToolResult> {
  const query = args.query as string;
  if (!query) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'query is required' }) }],
      isError: true,
    };
  }

  try {
    const response = await client.searchDocs({
      query,
      releaseId: args.release_id as string | undefined,
      topics: args.topics as string[] | undefined,
      maxResults: args.max_results as number | undefined,
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
    };
  } catch (error) {
    return errorResult(error);
  }
}

async function handleReleases(
  args: Record<string, unknown>,
  client: YantraClient,
): Promise<CallToolResult> {
  try {
    const response = await client.getReleases({
      releaseId: args.release_id as string | undefined,
      includeArchived: args.include_archived as boolean | undefined,
      listAll: args.list_all as boolean | undefined,
    });

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
    };
  } catch (error) {
    return errorResult(error);
  }
}

// =============================================================================
// Helpers
// =============================================================================

function errorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: JSON.stringify({ success: false, error: message }) }],
    isError: true,
  };
}
