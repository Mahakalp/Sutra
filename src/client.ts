/**
 * Sutra — HTTP client for Yantra ecosystem API
 *
 * Thin client that calls Yantra REST endpoints for ecosystem knowledge.
 * Free tools require no API key. Paid tools require one.
 */

import type {
  SutraConfig,
  ConstraintsResponse,
  DocSearchResponse,
  ReleasesResponse,
} from './types.js';

const DEFAULT_API_URL = 'https://yantra.mahakalp.dev';
const DEFAULT_TIMEOUT = 10_000;
const USER_AGENT = '@mahakalp/salesforce-mcp';

export class YantraClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;

  constructor(config: Partial<SutraConfig> = {}) {
    this.baseUrl = (config.apiBaseUrl ?? DEFAULT_API_URL).replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
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

    return this.get<ConstraintsResponse>(`/api/ecosystem/constraints?${query}`);
  }

  async searchDocs(params: {
    query: string;
    releaseId?: string;
    topics?: string[];
    maxResults?: number;
  }): Promise<DocSearchResponse> {
    return this.post<DocSearchResponse>('/api/ecosystem/docs/search', {
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

    return this.get<ReleasesResponse>(`/api/ecosystem/releases?${query}`);
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

  private async request<T>(path: string, init: RequestInit): Promise<T> {
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
        throw new Error(`Yantra API request timed out after ${this.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
