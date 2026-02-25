/**
 * Sutra — HTTP client for Yantra ecosystem API
 *
 * Thin client that calls Yantra REST endpoints for ecosystem knowledge.
 * Free tools require no API key. Paid tools require one.
 */

import type {
  SutraConfig,
  TierResponse,
  ConstraintsResponse,
  DocSearchResponse,
  ReleasesResponse,
  RulesResponse,
  PatternsResponse,
  DecisionGuidesResponse,
} from './types.js';

const DEFAULT_API_URL = 'https://yantra.mahakalp.dev';
const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1_000;
const USER_AGENT = '@mahakalp/salesforce-mcp';

export class YantraClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor(config: Partial<SutraConfig> = {}) {
    this.baseUrl = (config.apiBaseUrl ?? DEFAULT_API_URL).replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelay = config.retryDelay ?? DEFAULT_RETRY_DELAY;
  }

  // -------------------------------------------------------------------------
  // Tier check
  // -------------------------------------------------------------------------

  /**
   * Check tier at startup. Returns available tools based on API key.
   * Never throws — returns free tier on any error.
   */
  async getTier(): Promise<TierResponse> {
    const FREE_FALLBACK: TierResponse = {
      tier: 'free',
      tools: [
        'mahakalp_sf_constraints',
        'mahakalp_sf_doc_search',
        'mahakalp_sf_releases',
      ],
      limits: { requests_per_day: 100 },
    };

    try {
      return await this.get<TierResponse>('/api/auth/tier');
    } catch {
      return FREE_FALLBACK;
    }
  }

  /**
   * Health check - verifies API connectivity.
   * Returns true if API is reachable, false otherwise.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.get<{ status: string }>('/api/health');
      return true;
    } catch {
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Free tier endpoints
  // -------------------------------------------------------------------------

  async getConstraints(params: {
    releaseId?: string;
    constraintType?: string;
    constraintIds?: string[];
    context?: string;
    maxResults?: number;
  }): Promise<ConstraintsResponse> {
    const query = new URLSearchParams();
    if (params.releaseId) query.set('release_id', params.releaseId);
    if (params.constraintType) query.set('constraint_type', params.constraintType);
    if (params.constraintIds?.length) query.set('constraint_ids', params.constraintIds.join(','));
    if (params.context) query.set('context', params.context);
    if (params.maxResults) query.set('max_results', String(params.maxResults));

    return this.get<ConstraintsResponse>(`/api/public/ecosystem/constraints?${query}`);
  }

  async searchDocs(params: {
    query: string;
    releaseId?: string;
    topics?: string[];
    maxResults?: number;
  }): Promise<DocSearchResponse> {
    return this.post<DocSearchResponse>('/api/public/ecosystem/docs/search', {
      query: params.query,
      release_id: params.releaseId,
      topics: params.topics,
      max_results: params.maxResults ?? 5,
    });
  }

  async getReleases(params: {
    releaseId?: string;
    includeArchived?: boolean;
    listAll?: boolean;
  }): Promise<ReleasesResponse> {
    const query = new URLSearchParams();
    if (params.releaseId) query.set('release_id', params.releaseId);
    if (params.includeArchived) query.set('include_archived', 'true');
    if (params.listAll) query.set('list_all', 'true');

    return this.get<ReleasesResponse>(`/api/public/ecosystem/releases?${query}`);
  }

  // -------------------------------------------------------------------------
  // Pro tier endpoints
  // -------------------------------------------------------------------------

  async queryRules(params: {
    query: string;
    category?: string;
    severity?: string;
    context?: string;
    maxResults?: number;
  }): Promise<RulesResponse> {
    return this.post<RulesResponse>('/api/public/ecosystem/rules/query', {
      query: params.query,
      category: params.category,
      severity: params.severity,
      context: params.context,
      max_results: params.maxResults ?? 10,
    });
  }

  async searchPatterns(params: {
    query: string;
    category?: string;
    context?: string;
    maxResults?: number;
  }): Promise<PatternsResponse> {
    return this.post<PatternsResponse>('/api/public/ecosystem/patterns/search', {
      query: params.query,
      category: params.category,
      context: params.context,
      max_results: params.maxResults ?? 5,
    });
  }

  async searchDecisionGuides(params: {
    query: string;
    category?: string;
    context?: string;
    maxResults?: number;
  }): Promise<DecisionGuidesResponse> {
    return this.post<DecisionGuidesResponse>('/api/public/ecosystem/decision-guides/search', {
      query: params.query,
      category: params.category,
      context: params.context,
      max_results: params.maxResults ?? 5,
    });
  }

  // -------------------------------------------------------------------------
  // HTTP helpers
  // -------------------------------------------------------------------------

  private async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private async request<T>(path: string, init: RequestInit, attempt = 0): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      ...(init.headers as Record<string, string>),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Yantra API error ${response.status}: ${text || response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Yantra API request timed out after ${this.timeout}ms`, { cause: error });
      }

      const isRetryable = this.isRetryableError(error);
      if (isRetryable && attempt < this.maxRetries) {
        await this.delay(this.retryDelay * (attempt + 1));
        return this.request<T>(path, init, attempt + 1);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const retryableMessages = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'];
      return retryableMessages.some((msg) => error.message.includes(msg)) || error.name === 'AbortError';
    }
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
