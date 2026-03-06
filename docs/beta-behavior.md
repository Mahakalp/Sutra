# Sutra Beta Behavior — Free vs Pro

> **Beta Notice**: Sutra Pro is currently in beta and free to use. We'd love your feedback at [hello@mahakalp.dev](mailto:hello@mahakalp.dev).

This document is the **source of truth** for Sutra beta behavior. It defines free vs pro tier behavior, entitlement checks, open-source vs proprietary boundaries, and what content/backend capabilities remain proprietary. This document is sufficient for engineering, docs, and support to act without ambiguity.

---

## 1. Tier Overview

| Aspect | Free | Pro |
|--------|------|-----|
| **API Key Required** | No | Yes |
| **Entitlement Check** | None | Required |
| **Rate Limit** | 100 requests/day | Defined by entitlement |
| **Tools Available** | 3 | 6 |
| **Support** | Community | Priority email |

---

## 2. Available Tools

### Free Tier Tools

These tools are available without registration or API key:

| Tool | Description | Works Offline | Yantra API Required |
|------|-------------|---------------|---------------------|
| `mahakalp_sf_constraints` | Governor limits, platform rules, best practices with values, workarounds, and code examples | Yes (bundled) | No |
| `mahakalp_sf_doc_search` | Semantic search over official Salesforce documentation | No | Yes |
| `mahakalp_sf_releases` | Release metadata including API versions, status, and dates | Yes (bundled) | No |

### Pro Tier Tools

These tools require a valid `MAHAKALP_API_KEY` and active subscription:

| Tool | Description | Works Offline | Yantra API Required |
|------|-------------|---------------|---------------------|
| `mahakalp_sf_rules` | Best practice rules and coding standards with severity and code examples | No | Yes |
| `mahakalp_sf_patterns` | Reusable code patterns and implementation templates | No | Yes |
| `mahakalp_sf_decision_guides` | Architectural decision guides and trade-off analysis | No | Yes |

**Note**: Pro tools include all free tools.

---

## 3. Open Source vs Proprietary Boundaries

### Open Source (MIT License)

All source code in the Sutra MCP server is open source:

| Component | Description |
|-----------|-------------|
| `src/index.ts` | Entry point, CLI argument handling |
| `src/server.ts` | MCP protocol handler, tool registration |
| `src/client.ts` | HTTP client for Yantra API |
| `src/tools.ts` | Tool definitions and handlers |
| `src/types.ts` | TypeScript type definitions |
| Tests | Unit and integration tests |

### Proprietary Components

| Component | Description |
|-----------|-------------|
| **Pro Tier Tools** | `mahakalp_sf_rules`, `mahakalp_sf_patterns`, `mahakalp_sf_decision_guides` |
| **Content Knowledge Base** | Rules database, pattern library, decision guides, tribal knowledge |
| **Backend Services** | Yantra API, entitlement service, vector database, content management |
| **Entitlement System** | Subscription verification, API key generation, rate limit enforcement |

---

## 4. Entitlement Checks

### Entitlement Flow

1. Server starts and checks for `MAHAKALP_API_KEY`
2. If no API key: tier is `free`, only free tools available
3. If API key present: server calls `/api/auth/entitlement`
4. On success: tier set to `pro` with status from entitlement
5. On failure: server falls back to `free` tier

### Entitlement Refresh

- **Interval**: Every 5 minutes (configurable via `entitlementRefreshInterval`)
- **Stale threshold**: 10 minutes (configurable via `entitlementStaleThreshold`)
- If refresh fails but cached entitlement is valid: preserve current tier
- If stale and no valid entitlement: fall back to free tier

### Entitlement Statuses

| Status | Pro Tools Available | Grace Period |
|--------|---------------------|--------------|
| `active` | Yes | None |
| `trialing` | Yes | None |
| `past_due` | No | None |
| `canceled` | Yes (if within period) | Until `expires_at` |
| `deleted` | No | None |

### Grace Period Logic

When subscription is `canceled`, Pro tools remain available until `expires_at`:

```typescript
if (entitlement.status === 'canceled') {
  const now = Math.floor(Date.now() / 1000);
  return entitlement.expires_at > now;
}
```

---

## 5. Degraded Mode Behavior

When proprietary services are unavailable:

| Scenario | Free Tier | Pro Tier |
|----------|-----------|----------|
| Yantra API unreachable at startup | Works normally | Falls back to free tier |
| Entitlement verification fails | Works normally | Falls back to free tier |
| Periodic refresh fails (cache valid) | Works normally | Continues with cached entitlement |
| Periodic refresh fails (cache stale) | Works normally | Falls back to free tier |
| Subscription status: `past_due` | Works normally | Falls back to free tier |
| Subscription status: `deleted` | Works normally | Falls back to free tier |

**Key principle**: Free tier tools are **always** available, even when API is unreachable.

---

## 6. Rate Limits

| Tier | Requests/Day | Where Enforced |
|------|--------------|----------------|
| Free | 100 | Yantra API |
| Pro | Defined by entitlement (`limits.requests_per_day`) | Yantra API |

---

## 7. Offline Behavior

### Bundled (Offline-Capable) Tools

These tools work without any network connectivity:

- `mahakalp_sf_constraints` — Governor limits and platform rules
- `mahakalp_sf_releases` — Release metadata

### Network-Dependent Tools

These require Yantra API connectivity:

- `mahakalp_sf_doc_search` — Requires API for semantic search
- `mahakalp_sf_rules` — Requires Pro entitlement
- `mahakalp_sf_patterns` — Requires Pro entitlement
- `mahakalp_sf_decision_guides` — Requires Pro entitlement

---

## 8. Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAHAKALP_API_KEY` | No | (none) | API key for Pro tier |
| `MAHAKALP_API_URL` | No | `https://yantra.mahakalp.dev` | Yantra API base URL |
| `MAHAKALP_TIMEOUT` | No | `10000` | Request timeout (ms) |

---

## 9. Error Handling

### Error Sanitization

Internal errors are sanitized to prevent leaking system details. Network errors and 5xx responses are replaced with:

```
An internal error occurred. Please try again later.
```

### Logging

Server logs go to stderr (stdout is reserved for MCP protocol):

- `[sutra] Warning: Could not reach Yantra API` - API unreachable
- `[sutra] Entitlement refreshed: org=<org_id>, tier=<tier>, status=<status>` - Entitlement state
- `[sutra] Entitlement refresh failed` - Refresh error

---

## 10. Quick Reference

```
+------------------------------------------+
|           SUTRA BETA BEHAVIOR            |
+------------------------------------------+
| FREE (No API Key)                        |
| - constraints (bundled, works offline)  |
| - doc_search (requires API)              |
| - releases (bundled, works offline)     |
| - Rate limit: 100/day                   |
| - Open source: Yes                      |
+------------------------------------------+
| PRO (API Key Required)                   |
| - All free tools                         |
| - rules (requires API + entitlement)    |
| - patterns (requires API + entitlement) |
| - decision_guides (requires API + ent.) |
| - Rate limit: entitlement-defined       |
| - Open source: Server code only         |
+------------------------------------------+
| OFFLINE BEHAVIOR                         |
| - Free: constraints + releases work     |
| - Pro: falls back to free tier          |
+------------------------------------------+
| ENTITLEMENT STATUSES                     |
| - active, trialing: Full access         |
| - past_due, deleted: Free tier only     |
| - canceled: Access until expires_at     |
+------------------------------------------+
```

---

## 11. Future Considerations

The following are planned for future releases:

| Feature | Expected Tier |
|---------|---------------|
| Apex Class Library | Pro |
| Standard Object Schema | Free/Pro |
| LWC Component Reference | Pro |
| Tribal Knowledge | Pro |

---

## Version

This document describes behavior for **Sutra v0.2.0 (Beta)**.

Last updated: March 2026
