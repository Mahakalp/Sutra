/**
 * Sutra — Shared types for Yantra API responses
 */

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

export interface SutraConfig {
  /** Yantra API base URL */
  apiBaseUrl: string;
  /** API key for paid tier (optional for free tools) */
  apiKey?: string;
  /** Request timeout in ms (default: 10000) */
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------

export type ConstraintType = 'governor_limit' | 'platform_rule' | 'best_practice';

export interface Constraint {
  id: string;
  type: ConstraintType;
  name: string;
  description: string;
  context: string;
  limit_values?: Record<string, number | string>;
  limit_unit?: string;
  constraint_logic?: string;
  workarounds?: string[];
  code_example?: string;
  confidence?: number;
  change_type?: string;
}

// ---------------------------------------------------------------------------
// Documentation
// ---------------------------------------------------------------------------

export interface DocSearchResult {
  content: string;
  section: string;
  topics: string[];
  chunk_type: string;
  similarity: number;
  page_number?: number;
}

// ---------------------------------------------------------------------------
// Releases
// ---------------------------------------------------------------------------

export interface Release {
  id: string;
  display_name: string;
  full_name: string;
  api_version: string;
  status: string;
  is_default: boolean;
  release_date?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// API Responses
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  error?: string;
  release?: {
    id: string;
    display_name: string;
    api_version: string;
    status?: string;
  };
  processing_time_ms?: number;
}

export interface ConstraintsResponse extends ApiResponse<Constraint[]> {
  constraints: Constraint[];
  count: number;
}

export interface DocSearchResponse extends ApiResponse<DocSearchResult[]> {
  results: DocSearchResult[];
  count: number;
  query: string;
}

export interface ReleasesResponse extends ApiResponse<Release[]> {
  releases: Release[];
  count: number;
}
