# Sutra Degraded-Mode Behavior

This document describes the expected user-facing behavior when Sutra operates in degraded mode due to sync failures, entitlement verification issues, or when only bundled/static knowledge is available.

---

## Overview

Sutra operates in degraded mode when it cannot reach the Yantra API or verify user entitlements. The server is designed to fail gracefully, providing the best available experience rather than crashing or returning errors.

**Key principle**: Free tier tools are always available, even when the API is unreachable.

---

## Degraded Mode Scenarios

### 1. Yantra API Unreachable (Startup)

**Trigger**: Health check fails at startup (`/api/health` returns error or times out)

**User-facing behavior**:
- Server starts successfully
- Warning logged to stderr: `Warning: Could not reach Yantra API. Server starting with limited functionality.`
- All free tier tools remain available (constraints, doc_search, releases)
- Pro tier tools (rules, patterns, decision_guides) are unavailable
- Default rate limit of 100 requests/day applies

**Server logs**:
```
[sutra] Warning: Could not reach Yantra API. Server starting with limited functionality.
[sutra] Mahakalp Salesforce MCP server started
[sutra] API: https://yantra.mahakalp.dev
[sutra] Tier: free
[sutra] Tools: mahakalp_sf_constraints, mahakalp_sf_doc_search, mahakalp_sf_releases
```

---

### 2. Entitlement Verification Fails (Startup)

**Trigger**: `/api/auth/entitlement` endpoint returns an error or is unreachable

**User-facing behavior**:
- Server starts with free tier access
- Pro tools are hidden/unavailable
- No explicit error shown to end users (MCP clients only see available tools)

**Server logs**:
```
[sutra] Mahakalp Salesforce MCP server started
[sutra] API: https://yantra.mahakalp.dev
[sutra] Tier: free
[sutra] Tools: mahakalp_sf_constraints, mahakalp_sf_doc_search, mahakalp_sf_releases
[sutra] Entitlement refresh: None (using free tier)
```

---

### 3. Entitlement Status: `past_due`

**Trigger**: User's subscription payment failed

**User-facing behavior**:
- Pro tools are immediately hidden
- User loses access to rules, patterns, and decision_guides
- Only free tier tools remain available

**Server logs**:
```
[sutra] Entitlement refreshed: org=<org_id>, tier=pro, status=past_due
```

---

### 4. Entitlement Status: `canceled` (Grace Period)

**Trigger**: User canceled subscription but still within billing period

**User-facing behavior**:
- Pro tools remain available until subscription period expires
- Based on `expires_at` timestamp in entitlement

**Valid grace period check**:
```typescript
const graceStates: EntitlementStatus[] = ['canceled'];
if (graceStates.includes(entitlement.status)) {
  return entitlement.expires_at > Math.floor(Date.now() / 1000);
}
```

---

### 5. Entitlement Status: `deleted`

**Trigger**: Subscription fully terminated

**User-facing behavior**:
- Pro tools are immediately hidden
- Falls back to free tier

---

### 6. Periodic Refresh Failure

**Trigger**: Entitlement refresh fails during runtime (every 5 minutes by default)

**User-facing behavior**:
- If `lastKnownGoodEntitlement` exists and is not stale (within 10 minutes), it's preserved
- Pro tools remain available if cached entitlement is valid
- If stale and no valid entitlement, falls back to free tier

**Server logs** (when refresh fails but cached available):
```
[sutra] Refreshing entitlement...
[sutra] Entitlement refresh failed: <error_message>
[sutra] Entitlement refresh failed, preserving last known good entitlement
```

**Server logs** (when stale threshold exceeded):
```
[sutra] Refreshing entitlement...
[sutra] Entitlement refresh failed: <error_message>
[sutra] Stale threshold exceeded with no valid entitlement - using last known good
```

---

### 7. All API Endpoints Fail (Runtime)

**Trigger**: All Yantra API calls fail (network outage, API downtime)

**User-facing behavior**:
- Tool calls to free tier endpoints return errors
- Error message: `An internal error occurred. Please try again later.`
- Pro tool calls are rejected (not visible to user)

**Error response format**:
```json
{
  "success": false,
  "error": "An internal error occurred. Please try again later."
}
```

---

## Tool Availability Matrix

| Scenario | Free Tools Available | Pro Tools Available |
|----------|---------------------|---------------------|
| Normal operation (API key valid) | Yes | Yes |
| API unreachable | Yes | No |
| Entitlement null | Yes | No |
| Entitlement status: `active` | Yes | Yes |
| Entitlement status: `trialing` | Yes | Yes |
| Entitlement status: `past_due` | Yes | No |
| Entitlement status: `canceled` (in grace period) | Yes | Yes |
| Entitlement status: `canceled` (grace expired) | Yes | No |
| Entitlement status: `deleted` | Yes | No |

---

## Free Tier Tools (Always Bundled)

These tools are built into Sutra and available even when API is unreachable:

1. `mahakalp_sf_constraints` - Governor limits, platform rules, best practices
2. `mahakalp_sf_doc_search` - Salesforce documentation semantic search
3. `mahakalp_sf_releases` - Release metadata

---

## Pro Tier Tools (Require Valid Entitlement)

These tools require a valid entitlement with status `active`, `trialing`, or `canceled` (within grace period):

1. `mahakalp_sf_rules` - Best practice rules and coding standards
2. `mahakalp_sf_patterns` - Reusable code patterns and templates
3. `mahakalp_sf_decision_guides` - Architectural decision guides

---

## Rate Limits

| Tier | Requests/Day |
|------|--------------|
| Free | 100 |
| Pro | Defined by entitlement (`limits.requests_per_day`) |

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MAHAKALP_API_URL` | Yantra API base URL | `https://yantra.mahakalp.dev` |
| `MAHAKALP_API_KEY` | API key for Pro tier | (none) |

### Refresh Intervals

| Setting | Default | Configurable |
|---------|---------|---------------|
| Entitlement refresh interval | 5 minutes (300,000ms) | Yes (`entitlementRefreshInterval`) |
| Stale threshold | 10 minutes (600,000ms) | Yes (`entitlementStaleThreshold`) |

---

## Error Sanitization

Internal errors are sanitized to prevent leaking system details to users. The following errors are replaced with a generic message:

- Network errors (ECONNRESET, ECONNREFUSED, ETIMEDOUT, ENOTFOUND, ENETUNREACH)
- HTTP 5xx errors from Yantra API

**Sanitized message**: `An internal error occurred. Please try again later.`

---

## Debugging Degraded Mode

Check server logs for:
- `[sutra] Warning: Could not reach Yantra API` - API unreachable
- `[sutra] Entitlement refreshed: None` - No entitlement found
- `[sutra] Entitlement refreshed: org=<org_id>, tier=<tier>, status=<status>` - Current entitlement state
- `[sutra] Entitlement refresh failed` - Refresh error

---

## Version

This document describes behavior for Sutra v0.2.0.
