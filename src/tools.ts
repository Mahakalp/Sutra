/**
 * Sutra — MCP tool definitions and handlers
 *
 * Free tier:  sf_constraints, sf_doc_search, sf_releases
 * Pro tier:   + sf_rules, sf_patterns, sf_decision_guides
 *
 * All tools call Yantra API endpoints. No direct database access.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { YantraClient } from './client.js';

// =============================================================================
// Tool Definition Type
// =============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  tier: 'free' | 'pro';
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

// =============================================================================
// All Tool Definitions (keyed by name for filtering)
// =============================================================================

const ALL_TOOLS: Record<string, ToolDefinition> = {
  // ---------------------------------------------------------------------------
  // Free tier
  // ---------------------------------------------------------------------------

  mahakalp_sf_constraints: {
    name: 'mahakalp_sf_constraints',
    tier: 'free',
    description:
      'Get Salesforce platform constraints including governor limits, platform rules, and best practices. Returns structured data with limit values, context, workarounds, and code examples. Powered by Mahakalp.dev',
    inputSchema: {
      type: 'object',
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

  mahakalp_sf_doc_search: {
    name: 'mahakalp_sf_doc_search',
    tier: 'free',
    description:
      'Search Salesforce official documentation using semantic search. Returns relevant documentation chunks for RAG context. Useful for answering questions about Apex, LWC, SOQL, or any Salesforce platform feature. Powered by Mahakalp.dev',
    inputSchema: {
      type: 'object',
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

  mahakalp_sf_releases: {
    name: 'mahakalp_sf_releases',
    tier: 'free',
    description:
      'Get information about Salesforce releases. Returns release metadata including API version, status, and release dates. Powered by Mahakalp.dev',
    inputSchema: {
      type: 'object',
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

  // ---------------------------------------------------------------------------
  // Pro tier
  // ---------------------------------------------------------------------------

  mahakalp_sf_rules: {
    name: 'mahakalp_sf_rules',
    tier: 'pro',
    description:
      'Query Salesforce best practice rules and coding standards. Returns rules with severity, category, and code examples. Use this to validate code against platform best practices. Requires Sutra Pro. Powered by Mahakalp.dev',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query describing the rule or coding pattern to look up',
        },
        category: {
          type: 'string',
          description: 'Filter by rule category (e.g., "security", "performance", "maintainability")',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'warning', 'info'],
          description: 'Filter by severity level',
        },
        context: {
          type: 'string',
          description: 'Filter by context (e.g., "apex", "lwc", "soql", "triggers")',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of rules to return (default: 10)',
        },
      },
      required: ['query'],
    },
  },

  mahakalp_sf_patterns: {
    name: 'mahakalp_sf_patterns',
    tier: 'pro',
    description:
      'Search reusable Salesforce code patterns and implementation templates using semantic search. Returns patterns with code examples and context. Requires Sutra Pro. Powered by Mahakalp.dev',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query describing the pattern or implementation to find',
        },
        category: {
          type: 'string',
          description: 'Filter by pattern category (e.g., "trigger", "batch", "integration")',
        },
        context: {
          type: 'string',
          description: 'Filter by context (e.g., "apex", "lwc", "aura")',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of patterns to return (default: 5)',
        },
      },
      required: ['query'],
    },
  },

  mahakalp_sf_decision_guides: {
    name: 'mahakalp_sf_decision_guides',
    tier: 'pro',
    description:
      'Search Salesforce architectural decision guides — when to use X vs Y, trade-off analysis, and implementation recommendations. Requires Sutra Pro. Powered by Mahakalp.dev',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query describing the decision or architectural question',
        },
        category: {
          type: 'string',
          description: 'Filter by category (e.g., "architecture", "data-model", "integration")',
        },
        context: {
          type: 'string',
          description: 'Filter by context (e.g., "apex", "flows", "platform-events")',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of guides to return (default: 5)',
        },
      },
      required: ['query'],
    },
  },
};

// =============================================================================
// Tool filtering
// =============================================================================

/**
 * Get tool definitions filtered by the tier endpoint response.
 * Only includes tools whose names are in the allowed list.
 */
export function getToolDefinitions(allowedToolNames: string[]): ToolDefinition[] {
  const allowed = new Set(allowedToolNames);
  return Object.values(ALL_TOOLS).filter((t) => allowed.has(t.name));
}

/**
 * Get tool names for a specific tier.
 * Single source of truth for tool tier membership.
 */
export function getToolNamesByTier(tier: 'free' | 'pro'): string[] {
  return Object.values(ALL_TOOLS)
    .filter((t) => t.tier === tier)
    .map((t) => t.name);
}

// =============================================================================
// Tool Dispatch
// =============================================================================

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  client: YantraClient,
  allowedToolNames: Set<string>,
): Promise<CallToolResult | null> {
  // Defense in depth — reject calls to tools not in the allowed set
  if (!allowedToolNames.has(name)) {
    return null;
  }

  const toolDef = ALL_TOOLS[name];
  if (toolDef) {
    const validationErrors = validateInput(toolDef.inputSchema, args);
    if (validationErrors.length > 0) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: false, error: 'Validation failed', details: validationErrors })
        }],
        isError: true,
      };
    }
  }

  switch (name) {
    // Free
    case 'mahakalp_sf_constraints':
      return handleConstraints(args, client);
    case 'mahakalp_sf_doc_search':
      return handleDocSearch(args, client);
    case 'mahakalp_sf_releases':
      return handleReleases(args, client);
    // Pro
    case 'mahakalp_sf_rules':
      return handleRules(args, client);
    case 'mahakalp_sf_patterns':
      return handlePatterns(args, client);
    case 'mahakalp_sf_decision_guides':
      return handleDecisionGuides(args, client);
    default:
      return null;
  }
}

// =============================================================================
// Free Tool Handlers
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
  try {
    const response = await client.searchDocs({
      query: args.query as string,
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
// Pro Tool Handlers
// =============================================================================

async function handleRules(
  args: Record<string, unknown>,
  client: YantraClient,
): Promise<CallToolResult> {
  try {
    const response = await client.queryRules({
      query: args.query as string,
      category: args.category as string | undefined,
      severity: args.severity as string | undefined,
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

async function handlePatterns(
  args: Record<string, unknown>,
  client: YantraClient,
): Promise<CallToolResult> {
  try {
    const response = await client.searchPatterns({
      query: args.query as string,
      category: args.category as string | undefined,
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

async function handleDecisionGuides(
  args: Record<string, unknown>,
  client: YantraClient,
): Promise<CallToolResult> {
  try {
    const response = await client.searchDecisionGuides({
      query: args.query as string,
      category: args.category as string | undefined,
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

// =============================================================================
// Schema Validation
// =============================================================================

export interface ValidationError {
  field: string;
  message: string;
}

export function validateInput(
  schema: ToolDefinition['inputSchema'],
  args: unknown
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    errors.push({ field: '', message: 'Input must be a non-null, non-array object' });
    return errors;
  }

  const MAX_STRING_LENGTH = 100_000;
  const MAX_DEPTH = 10;
  const MAX_PROPERTY_COUNT = 100;

  const argsRecord = args as Record<string, unknown>;

  if (Object.keys(argsRecord).length > MAX_PROPERTY_COUNT) {
    errors.push({ field: '', message: `Too many properties (max ${MAX_PROPERTY_COUNT})` });
    return errors;
  }

  const knownFields = new Set(Object.keys(schema.properties));
  for (const field of Object.keys(argsRecord)) {
    if (!knownFields.has(field)) {
      errors.push({ field, message: `Unknown field: ${field}` });
    }
  }

  for (const field of schema.required) {
    if (!(field in argsRecord) || argsRecord[field] === undefined || argsRecord[field] === null || argsRecord[field] === '') {
      errors.push({ field, message: `${field} is required` });
    }
  }

  function validateObjectDepth(obj: unknown, depth: number, path: string): void {
    if (depth > MAX_DEPTH) {
      errors.push({ field: path, message: 'Object nesting too deep' });
      return;
    }
    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        validateObjectDepth(value, depth + 1, path ? `${path}.${key}` : key);
      }
    }
  }
  validateObjectDepth(argsRecord, 0, '');

  for (const [field, schemaValue] of Object.entries(schema.properties)) {
    const value = argsRecord[field];
    if (value === undefined || value === null) continue;

    const propSchema = schemaValue as Record<string, unknown>;
    
    if (propSchema.type === 'string') {
      if (typeof value !== 'string') {
        errors.push({ field, message: `${field} must be a string` });
      } else {
        if (value.length === 0) {
          errors.push({ field, message: `${field} cannot be empty` });
        }
        if (value.length > MAX_STRING_LENGTH) {
          errors.push({ field, message: `${field} is too long (max ${MAX_STRING_LENGTH} characters)` });
        }
        if (/^\s+$/.test(value)) {
          errors.push({ field, message: `${field} cannot be whitespace only` });
        }
        if (value.includes('\x00')) {
          errors.push({ field, message: `${field} contains null bytes` });
        }
        if (/[\u0000-\u001f\u007f]/.test(value)) {
          errors.push({ field, message: `${field} contains control characters` });
        }
      }
    }

    if (propSchema.type === 'number') {
      if (typeof value !== 'number') {
        errors.push({ field, message: `${field} must be a number` });
      } else {
        if (Number.isNaN(value)) {
          errors.push({ field, message: `${field} cannot be NaN` });
        }
        if (!Number.isFinite(value)) {
          errors.push({ field, message: `${field} must be finite` });
        }
        const minimum = propSchema.minimum as number | undefined;
        if (minimum !== undefined && value < minimum) {
          errors.push({ field, message: `${field} must be at least ${minimum}` });
        }
        const maximum = propSchema.maximum as number | undefined;
        if (maximum !== undefined && value > maximum) {
          errors.push({ field, message: `${field} must be at most ${maximum}` });
        }
      }
    }

    if (propSchema.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push({ field, message: `${field} must be a boolean` });
      }
    }

    if (propSchema.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push({ field, message: `${field} must be an array` });
      } else {
        const itemSchema = propSchema.items as Record<string, unknown> | undefined;
        if (itemSchema) {
          const itemType = itemSchema.type as string | undefined;
          value.forEach((item, index) => {
            if (itemType === 'string' && typeof item !== 'string') {
              errors.push({ field, message: `${field}[${index}] must be a string` });
            }
            if (itemType === 'number' && typeof item !== 'number') {
              errors.push({ field, message: `${field}[${index}] must be a number` });
            }
            if (itemType === 'boolean' && typeof item !== 'boolean') {
              errors.push({ field, message: `${field}[${index}] must be a boolean` });
            }
          });
        }
      }
    }

    const enumValue = propSchema.enum as unknown[] | undefined;
    if (enumValue && Array.isArray(enumValue) && !enumValue.includes(value)) {
      errors.push({ field, message: `${field} must be one of: ${enumValue.join(', ')}` });
    }
  }

  return errors;
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
