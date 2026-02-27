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
  /** Maximum retry attempts for transient failures (default: 3) */
  maxRetries?: number;
  /** Delay between retries in ms (default: 1000) */
  retryDelay?: number;
}

// ---------------------------------------------------------------------------
// Tier
// ---------------------------------------------------------------------------

export type ToolTier = 'free' | 'pro' | 'enterprise';

/**
 * Entitlement status states per entitlement-sync contract v2026.02.01
 * - active: Subscription is current and in good standing
 * - trialing: User is in trial period
 * - past_due: Payment failed, subscription paused
 * - canceled: Subscription canceled, access until period end (grace period)
 * - deleted: Subscription fully terminated
 */
export type EntitlementStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'deleted';

/**
 * Feature flags from entitlement claims
 */
export interface EntitlementFeatures {
  advanced_analytics?: boolean;
  team_collaboration?: boolean;
  api_access?: boolean;
  [key: string]: boolean | undefined;
}

/**
 * Full entitlement object from Yantra API (derived from Firebase claims)
 */
export interface Entitlement {
  /** Subscription ID */
  sub_id: string;
  /** Organization ID */
  org_id: string;
  /** Plan tier */
  tier: ToolTier;
  /** Licensed seat count */
  seats: number;
  /** Unix timestamp of subscription period end */
  expires_at: number;
  /** Current entitlement status */
  status: EntitlementStatus;
  /** Feature flags from claims */
  features: EntitlementFeatures;
}

/**
 * Response from /api/auth/tier endpoint
 * Returns available tools based on entitlement
 */
export interface TierResponse {
  tier: ToolTier;
  tools: string[];
  limits: { requests_per_day: number };
  key_prefix?: string;
  warning?: string;
  /** Full entitlement object (when requesting full details) */
  entitlement?: Entitlement;
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
// Rules (Pro)
// ---------------------------------------------------------------------------

export interface Rule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  context: string;
  code_example?: string;
  confidence?: number;
}

// ---------------------------------------------------------------------------
// Patterns (Pro)
// ---------------------------------------------------------------------------

export interface Pattern {
  id: string;
  name: string;
  description: string;
  category: string;
  context: string;
  code_example?: string;
  similarity?: number;
}

// ---------------------------------------------------------------------------
// Decision Guides (Pro)
// ---------------------------------------------------------------------------

export interface DecisionGuide {
  id: string;
  name: string;
  description: string;
  category: string;
  context: string;
  recommendation?: string;
  similarity?: number;
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

// The generic T is used by extending interfaces for type safety
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

export interface RulesResponse extends ApiResponse<Rule[]> {
  rules: Rule[];
  count: number;
}

export interface PatternsResponse extends ApiResponse<Pattern[]> {
  patterns: Pattern[];
  count: number;
  query: string;
}

export interface DecisionGuidesResponse extends ApiResponse<DecisionGuide[]> {
  guides: DecisionGuide[];
  count: number;
  query: string;
}
