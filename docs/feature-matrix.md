# Sutra Beta — Free vs Pro Feature Matrix

> **Beta Notice**: Sutra Pro is currently in beta and free to use. We'd love your feedback at [hello@mahakalp.dev](mailto:hello@mahakalp.dev).

---

## 1. Feature Comparison

| Feature | Free | Pro |
|---------|------|-----|
| **Tools Available** | 3 | 6 |
| **Rate Limit (requests/day)** | 100 | Defined by entitlement |
| **API Key Required** | No | Yes |
| **Entitlement Check** | None | Required |

### Free Tier Tools

| Tool | Description | Yantra Sync Required |
|------|-------------|---------------------|
| `mahakalp_sf_constraints` | Governor limits, platform rules, best practices | No (bundled) |
| `mahakalp_sf_doc_search` | Semantic search over Salesforce documentation | Yes |
| `mahakalp_sf_releases` | Release metadata (API versions, dates, status) | No (bundled) |

### Pro Tier Tools

| Tool | Description | Yantra Sync Required |
|------|-------------|---------------------|
| `mahakalp_sf_rules` | Best practice rules and coding standards | Yes |
| `mahakalp_sf_patterns` | Reusable code patterns and templates | Yes |
| `mahakalp_sf_decision_guides` | Architectural decision guides and trade-off analysis | Yes |

---

## 2. Update Cadence

| Component | Update Frequency | Trigger |
|-----------|-----------------|---------|
| **Tool definitions** | Static (bundled at build) | Server restart / rebuild |
| **Entitlement** | Every 5 minutes (configurable) | Periodic background refresh |
| **Yantra API data** | Real-time from API | On each tool call |
| **Bundled static data** | At server release | Rebuild required |

---

## 3. Offline Behavior

### Free Tier

| Scenario | Behavior | Available |
|----------|----------|-----------|
| Yantra API unreachable | Uses bundled data | `mahakalp_sf_constraints`, `mahakalp_sf_releases` |
| Network failure | Uses bundled data | `mahakalp_sf_constraints`, `mahakalp_sf_releases` |
| Startup with no network | Uses bundled data | `mahakalp_sf_constraints`, `mahakalp_sf_releases` |

### Pro Tier

| Scenario | Behavior | Available |
|----------|----------|-----------|
| Yantra API unreachable | Falls back to free tier | Free tools only |
| Entitlement verification fails | Uses last cached entitlement (up to 10 min) | Depends on cache validity |
| Cache stale | Falls back to free tier | Free tools only |
| Subscription expired | Falls back to free tier | Free tools only |

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

## 4. Yantra-Backed Sync Dependencies

### What Requires Yantra Connectivity

| Feature | Sync Type | Fails Gracefully |
|---------|-----------|-------------------|
| **Pro tool access** | Entitlement check | Falls back to free tier |
| **Rate limiting** | Per-request limit validation | Unknown — defaults apply |
| **Tool availability** | Tool list from `/api/auth/tier` | Uses cached tool list |
| **Semantic search** (`mahakalp_sf_doc_search`) | Real-time API call | Returns error |
| **Rules/Patterns/Decision Guides** | Real-time API call | Returns error |

### What Does NOT Require Yantra

| Feature | Data Source |
|---------|-------------|
| Free tool definitions | Bundled in server binary |
| Governor limits | Bundled in server binary |
| Release metadata | Bundled in server binary |
| Server startup | Can start without API |

### Entitlement Sync Behavior

| Status | Pro Tools Available | Grace Period |
|--------|---------------------|--------------|
| `active` | Yes | None |
| `trialing` | Yes | None |
| `past_due` | No | None |
| `canceled` | Yes (if within period) | Until `expires_at` |
| `deleted` | No | None |

---

## 5. Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAHAKALP_API_KEY` | No | (none) | API key for Pro tier |
| `MAHAKALP_API_URL` | No | `https://yantra.mahakalp.dev` | Yantra API base URL |
| `MAHAKALP_TIMEOUT` | No | `10000` | Request timeout (ms) |

### Refresh Intervals

| Setting | Default | Configurable |
|---------|---------|---------------|
| Entitlement refresh | 5 minutes | Yes (`entitlementRefreshInterval`) |
| Stale threshold | 10 minutes | Yes (`entitlementStaleThreshold`) |

---

## 6. Quick Reference

```
+------------------------------------------+
|           SUTRA BETA MATRIX              |
+------------------------------------------+
| FREE (No API Key)                        |
| - constraints (bundled, works offline)   |
| - doc_search (requires API)              |
| - releases (bundled, works offline)       |
| - Rate limit: 100/day                    |
+------------------------------------------+
| PRO (API Key Required)                   |
| - All free tools                          |
| - rules (requires API + entitlement)     |
| - patterns (requires API + entitlement)  |
| - decision_guides (requires API + ent.)  |
| - Rate limit: entitlement-defined        |
+------------------------------------------+
| OFFLINE BEHAVIOR                         |
| - Free: constraints + releases work      |
| - Pro: falls back to free tier           |
+------------------------------------------+
```

---

## Version

This matrix describes behavior for Sutra beta.

Last updated: March 2026
