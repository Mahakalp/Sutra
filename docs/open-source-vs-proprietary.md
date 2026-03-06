# Sutra Open-Source vs Proprietary Boundaries

This document defines what remains open source (MIT licensed) versus what is proprietary in the Sutra MCP server for the beta release.

---

## Summary

| Category | Open Source | Proprietary |
|----------|-------------|-------------|
| MCP Server Code | ✅ | - |
| Free Tier Tools | ✅ | - |
| Pro Tier Tools | - | ✅ |
| Content Knowledge Base | - | ✅ |
| Backend Services | - | ✅ |
| Entitlement/Subscription | - | ✅ |

---

## Open Source Components

### MCP Server (`src/` directory)

All source code in the Sutra MCP server is open source under the MIT license:

| File | Description |
|------|-------------|
| `src/index.ts` | Entry point, CLI argument handling |
| `src/server.ts` | MCP protocol handler, tool registration |
| `src/client.ts` | HTTP client for Yantra API |
| `src/tools.ts` | Tool definitions and handlers |
| `src/types.ts` | TypeScript type definitions |
| `src/tools.test.ts` | Unit tests |
| `src/client.test.ts` | Client tests |
| `src/server.test.ts` | Server tests |
| `src/integration.test.ts` | Integration tests |

### Free Tier Tools

These tools are available without an API key and are included in the open-source release:

| Tool | Description | API Endpoint |
|------|-------------|--------------|
| `mahakalp_sf_constraints` | Governor limits, platform rules, best practices | `/api/public/ecosystem/constraints` |
| `mahakalp_sf_doc_search` | Semantic search over official Salesforce documentation | `/api/public/ecosystem/docs/search` |
| `mahakalp_sf_releases` | Release metadata (API versions, dates, status) | `/api/public/ecosystem/releases` |

### Free Tier Behavior

- **No API key required**: Users can use these tools without registration
- **No entitlement check**: The server operates in free tier mode by default
- **Rate limit**: 100 requests/day
- **Offline fallback**: Tools require Yantra API connectivity but graceful degradation is supported

---

## Proprietary Components

### Pro Tier Tools

These tools require a valid `MAHAKALP_API_KEY` and active subscription:

| Tool | Description | API Endpoint |
|------|-------------|--------------|
| `mahakalp_sf_rules` | Best practice rules and coding standards with severity and code examples | `/api/public/ecosystem/rules/query` |
| `mahakalp_sf_patterns` | Reusable code patterns and implementation templates | `/api/public/ecosystem/patterns/search` |
| `mahakalp_sf_decision_guides` | Architectural decision guides and trade-off analysis | `/api/public/ecosystem/decision-guides/search` |

### Content Packs

The curated knowledge base powering Pro tier tools is proprietary:

- **Rules Database**: Best practice rules, coding standards, security guidelines
- **Pattern Library**: Reusable code templates for common Salesforce implementations
- **Decision Guides**: Architectural recommendations and trade-off analysis
- **Tribal Knowledge**: Community-sourced patterns and anti-patterns (future)

### Backend Services

All backend infrastructure is proprietary:

| Service | Purpose |
|---------|---------|
| **Yantra API** | REST API serving tool responses (`yantra.mahakalp.dev`) |
| **Entitlement Service** | Subscription verification via Firebase claims |
| **Content Management** | Curation system for knowledge base updates |
| **Vector Database** | Semantic search infrastructure for documentation |

### Entitlement Sync

The subscription and access control system is proprietary:

- Firebase Authentication integration
- Subscription status management (`active`, `trialing`, `past_due`, `canceled`, `deleted`)
- API key generation and validation
- Rate limit enforcement
- Grace period handling for canceled subscriptions

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        OPEN SOURCE (MIT)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐   │
│   │  AI Client  │──────▶│    Sutra    │──────▶│  Yantra     │   │
│   │ (Claude,    │ stdio │   MCP       │  HTTPS│   API       │   │
│   │  Cursor,   │      │  Server     │      │ (public)    │   │
│   │  etc.)     │      │ (open src)  │      └─────────────┘   │
│   └─────────────┘      └─────────────┘           │           │
│                                │                   │           │
│                                │                   ▼           │
│                         ┌──────┴──────┐    ┌─────────────┐    │
│                         │ Free Tools  │    │   Content   │    │
│                         │ - constraints│    │   Database  │    │
│                         │ - doc_search │    │ (proprietary)    │
│                         │ - releases  │    └─────────────┘    │
│                         └─────────────┘            │           │
│                                                    │           │
└────────────────────────────────────────────────────┼───────────┘
                                                     │
                    ┌────────────────────────────────┼───────────┐
                    │           PROPRIETARY          │           │
                    ├────────────────────────────────┼───────────┤
                    │                                │           │
                    │  ┌─────────────┐              │           │
                    │  │ Pro Tools   │◀─────────────┘           │
                    │  │ - rules     │                           │
                    │  │ - patterns  │    ┌─────────────────┐   │
                    │  │ - decision  │    │   Entitlement   │   │
                    │  └─────────────┘    │     Service     │   │
                    │                     │  (Firebase)     │   │
                    │                     └─────────────────┘   │
                    │                                                │
                    │  ┌─────────────┐  ┌─────────────────────┐   │
                    │  │  Rate       │  │   Billing           │   │
                    │  │  Limits     │  │   (Lekha)           │   │
                    │  └─────────────┘  └─────────────────────┘   │
                    │                                                │
                    └──────────────────────────────────────────────┘
```

---

## API Endpoint Summary

### Public Endpoints (No Auth Required)

| Endpoint | Tier | Description |
|----------|------|-------------|
| `GET /api/health` | - | Health check |
| `GET /api/auth/tier` | - | Tier determination |
| `GET /api/public/ecosystem/constraints` | Free | Governor limits, platform rules |
| `POST /api/public/ecosystem/docs/search` | Free | Documentation search |
| `GET /api/public/ecosystem/releases` | Free | Release metadata |

### Authenticated Endpoints (API Key Required)

| Endpoint | Tier | Description |
|----------|------|-------------|
| `GET /api/auth/entitlement` | - | Full entitlement details |
| `POST /api/public/ecosystem/rules/query` | Pro | Best practice rules |
| `POST /api/public/ecosystem/patterns/search` | Pro | Code pattern search |
| `POST /api/public/ecosystem/decision-guides/search` | Pro | Decision guides |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MAHAKALP_API_URL` | No | Custom Yantra API URL (default: `https://yantra.mahakalp.dev`) |
| `MAHAKALP_API_KEY` | No | API key for Pro tier access |
| `MAHAKALP_TIMEOUT` | No | Request timeout in ms (default: 10000) |

---

## Degraded Mode Behavior

When proprietary services are unavailable:

- **Free tier users**: No impact — free tools work as normal
- **Pro tier users**: Automatic fallback to free tier with warning logged

See [degraded-mode.md](./degraded-mode.md) for detailed behavior.

---

## Future Considerations

The following are currently planned but not implemented. When added, they will be evaluated for open-source or proprietary status:

| Feature | Status | Expected Tier |
|---------|--------|---------------|
| Apex Class Library | Planned | Pro |
| Standard Object Schema | Planned | Free/Pro |
| LWC Component Reference | Planned | Pro |
| Tribal Knowledge | Planned | Pro |

---

## Version

This document describes boundaries for **Sutra v0.2.0 (Beta)**.
