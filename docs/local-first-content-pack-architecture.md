# Sutra Local-First Content Pack and Updater Architecture

> **Status**: Technical Design  
> **Version**: 1.0  
> **Last Updated**: March 2026

---

## 1. Executive Summary

This document outlines the technical architecture for Sutra's post-beta local-first model. The system enables:

- **Bundled free knowledge packs** — Offline-capable tools with versioned data
- **Signed pro updates** — Cryptographically verified content updates
- **Entitlement-aware sync** — Graceful degradation when connectivity is limited
- **Offline-tolerant operation** — Full functionality during network disruptions

---

## 2. Design Goals

| Goal | Description |
|------|-------------|
| **Offline-first** | Core features work without network connectivity |
| **Secure updates** | All content updates are signed and verified |
| **Entitlement respect** | Pro content only accessible to entitled users |
| **Rollback capability** | Automatic recovery to last known good state |
| **Minimal attack surface** | No execution of untrusted code |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUTRA CLIENT                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Pack      │  │  Updater    │  │    Entitlement          │  │
│  │   Manager   │  │   Service   │  │    Manager              │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                │
│  ┌──────▼────────────────▼─────────────────────▼─────────────┐  │
│  │                    Storage Layer                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │  │
│  │  │  Bundled   │  │   Cache     │  │   Manifests     │   │  │
│  │  │   Packs    │  │   Store     │  │   Store         │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MAHAKALP SERVICES                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Pack      │  │ Entitlement │  │    Update               │  │
│  │   Registry  │  │   Service   │  │    Signer               │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Knowledge Pack System

### 4.1 Pack Structure

A **knowledge pack** is a versioned, self-contained unit of content:

```
packs/
├── free/
│   ├── constraints/
│   │   ├── manifest.json
│   │   ├── data/
│   │   │   ├── limits.json
│   │   │   └── rules.json
│   │   └── signatures/
│   │       └── manifest.sig
│   └── releases/
│       ├── manifest.json
│       ├── data/
│       │   └── metadata.json
│       └── signatures/
│           └── manifest.sig
└── pro/
    ├── rules/
    │   ├── manifest.json
    │   ├── data/
    │   │   └── rules.json
    │   └── signatures/
    │       └── manifest.sig
    ├── patterns/
    │   └── ...
    └── decision-guides/
        └── ...
```

### 4.2 Pack Manifest Schema

```typescript
interface PackManifest {
  pack_id: string;           // e.g., "free.constraints.v1"
  version: string;           // Semantic version: "1.2.3"
  pack_type: "free" | "pro";
  content_type: string;      // e.g., "constraints", "releases"
  created_at: string;        // ISO 8601 timestamp
  expires_at?: string;       // Optional expiration for time-sensitive content
  min_client_version: string; // Minimum Sutra version required
  content_hash: string;      // SHA-256 of packed content
  file_count: number;
  total_size_bytes: number;
  dependencies?: string[];   // Other pack IDs this depends on
}
```

### 4.3 Version Resolution

| Scenario | Behavior |
|----------|----------|
| Client has no pack | Download latest from registry |
| Client version < pack min_client_version | Block update, require client upgrade |
| Client version >= pack version | Skip update |
| Client version > pack version (future) | Warn about potential incompatibility |

---

## 5. Update Manifest and Signing

### 5.1 Update Manifest

The **update manifest** lists available packs and their metadata:

```typescript
interface UpdateManifest {
  manifest_version: string;  // "1.0.0"
  generated_at: string;      // ISO 8601
  ttl_seconds: number;       // Time-to-live (e.g., 3600)
  signature: string;         // Ed25519 signature of manifest content
  packs: {
    [packId: string]: {
      version: string;
      download_url: string;
      content_hash: string;
      signature: string;
    };
  };
}
```

### 5.2 Signing Strategy

| Aspect | Approach |
|--------|----------|
| **Algorithm** | Ed25519 (EdDSA) |
| **Key Management** | Server-side secret key, client-side public key bundled |
| **What gets signed** | Individual pack manifests + update manifest |
| **Why Ed25519** | Fast verification, small signatures (64 bytes), modern standard |

### 5.3 Signature Verification Flow

```
1. Client fetches update manifest from registry
2. Client verifies manifest signature using bundled public key
3. For each pack:
   a. Download pack manifest
   b. Verify manifest signature
   c. Download pack content
   d. Verify content hash matches manifest
```

### 5.4 Public Key Bundling

The Ed25519 public key is bundled in the Sutra binary:

```typescript
// src/constants.ts
export const SIGNATURE_PUBLIC_KEY = 'mahakalp-sutra-ed25519-2026';
export const SIGNATURE_KEY_BYTES = Uint8Array.from([
  0x00, 0x01, 0x02, /* ... 32 bytes total ... */
]);
```

---

## 6. Entitlement-Aware Sync

### 6.1 Entitlement States

| State | Free Tools | Pro Tools | Network Required |
|-------|------------|-----------|------------------|
| `active` | Yes | Yes | No (cached) |
| `trialing` | Yes | Yes | No (cached) |
| `past_due` | Yes | No | Yes |
| `canceled` | Yes | Yes (until expires_at) | No (cached) |
| `deleted` | Yes | No | No (cached) |
| `unknown` | Yes | Last known | Yes |

### 6.2 Caching Strategy

```
┌────────────────────────────────────────────────────────────┐
│                   ENTITLEMENT CACHE                        │
├────────────────────────────────────────────────────────────┤
│  last_valid_state: EntitlementState                        │
│  last_verified_at: ISO timestamp                           │
│  expires_at: ISO timestamp (grace period end)              │
│  grace_period_minutes: number (default: 10)                │
└────────────────────────────────────────────────────────────┘
```

### 6.3 Sync Behavior

| Condition | Behavior |
|-----------|----------|
| Network available | Fetch fresh entitlement, update cache |
| Network unavailable | Use cached entitlement if not expired |
| Cache expired | Fall back to last known valid state |
| No valid cache | Default to free tier |

### 6.4 Pro Pack Access Control

```typescript
class EntitlementManager {
  canAccessProPack(packId: string): boolean {
    const entitlement = this.getCurrentEntitlement();
    if (!entitlement) return false;
    
    const activeStates = ['active', 'trialing'];
    const withinGracePeriod = this.isWithinGracePeriod(entitlement);
    
    return activeStates.includes(entitlement.status) || withinGracePeriod;
  }
  
  private isWithinGracePeriod(entitlement: EntitlementState): boolean {
    if (entitlement.status !== 'canceled') return false;
    return new Date(entitlement.expires_at) > new Date();
  }
}
```

---

## 7. Offline-Tolerant Operation

### 7.1 Boot Sequence

```
1. Load bundled (default) packs from disk
2. Load cached packs from storage
3. Load cached entitlement state
4. If network available and cache stale:
   a. Refresh entitlement
   b. Check for pack updates
   c. Download new packs if available
5. Start server with available packs
```

### 7.2 Offline Behavior by Feature

| Feature | Online | Offline |
|---------|--------|---------|
| `mahakalp_sf_constraints` | Latest from cache | Bundled v1 |
| `mahakalp_sf_releases` | Latest from cache | Bundled v1 |
| `mahakalp_sf_doc_search` | Live API | Error (graceful) |
| `mahakalp_sf_rules` | Latest + API | Cached only |
| `mahakalp_sf_patterns` | Latest + API | Cached only |
| `mahakalp_sf_decision_guides` | Latest + API | Cached only |

### 7.3 Update Availability Detection

```typescript
interface UpdateCheckResult {
  available: boolean;
  updates: {
    packId: string;
    currentVersion: string;
    newVersion: string;
    size_bytes: number;
  }[];
  requires_network: boolean;
}
```

---

## 8. Rollback Mechanism

### 8.1 Last Known Good (LKG) State

The system maintains a **rollback point** — the last verified working state:

```
storage/
├── packs/
│   ├── current/          # Active packs
│   │   ├── free.constraints.v1.2.0/
│   │   └── pro.rules.v2.1.0/
│   └── lkg/              # Last Known Good (rollback target)
│       ├── free.constraints.v1.1.0/
│       └── pro.rules.v2.0.0/
└── metadata/
    ├── current_manifest.json
    └── lkg_manifest.json
```

### 8.2 Rollback Trigger Conditions

| Trigger | Action |
|---------|--------|
| Pack verification fails (hash mismatch) | Rollback to LKG |
| Signature verification fails | Rollback to LKG |
| Pack corrupted/missing | Rollback to LKG |
| Client downgrade | Auto-migrate to compatible pack |

### 8.3 Rollback Flow

```
1. Pack verification fails
2. Log error with details
3. Delete corrupted pack
4. Copy LKG pack to current
5. Update current manifest
6. Notify user (if applicable)
7. Continue operation with rolled-back pack
```

---

## 9. Storage Layout

### 9.1 Directory Structure

```
~/.mahakalp/sutra/
├── config.json           # User configuration
├── cache/
│   ├── entitlements.json # Cached entitlement state
│   ├── manifests/
│   │   ├── update.json   # Latest update manifest
│   │   └── *.json        # Individual pack manifests
│   └── packs/            # Downloaded pack content
│       ├── current/      # Active packs
│       └── lkg/          # Rollback copies
├── logs/
│   └── sutra.log         # Rotating log files
└── tmp/                  # Temporary download location
```

### 9.2 Configuration Schema

```typescript
interface SutraConfig {
  // Update settings
  auto_update: boolean;
  update_check_interval_hours: number;
  max_cache_size_mb: number;
  
  // Entitlement settings
  entitlement_refresh_interval_minutes: number;
  entitlement_grace_period_minutes: number;
  
  // Network settings
  network_timeout_ms: number;
  network_retry_count: number;
  
  // Debug settings
  log_level: "error" | "warn" | "info" | "debug";
  verbose: boolean;
}
```

---

## 10. API Endpoints (Registry)

### 10.1 Required Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/manifest` | GET | Fetch update manifest |
| `/api/v1/packs/{packId}/download` | GET | Download pack archive |
| `/api/v1/packs/{packId}/manifest` | GET | Fetch pack manifest |
| `/api/v1/entitlement/verify` | POST | Verify entitlement token |

### 10.2 Manifest Endpoint Response

```json
{
  "manifest_version": "1.0.0",
  "generated_at": "2026-03-06T12:00:00Z",
  "ttl_seconds": 3600,
  "signature": "ed25519:abc123...",
  "packs": {
    "free.constraints.v1.2.0": {
      "version": "1.2.0",
      "download_url": "https://cdn.mahakalp.dev/packs/free.constraints.v1.2.0.tar.zst",
      "content_hash": "sha256:def456...",
      "signature": "ed25519:xyz789..."
    }
  }
}
```

---

## 11. Security Considerations

### 11.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Man-in-the-middle attacks | HTTPS only |
| Tampered content | Ed25519 signatures + SHA-256 hashes |
| Replay attacks | Timestamps + TTL in manifests |
| Privilege escalation | Entitlement checks before Pro pack access |
| Storage tampering | File permissions + integrity verification |

### 11.2 Content Security

- **No code execution**: Packs contain only data (JSON), never executable code
- **Verification required**: All content verified before use
- **Minimal privileges**: Process runs with lowest necessary permissions

---

## 12. Future Considerations (Out of Scope)

The following are noted for future implementation but are **not** part of this design:

| Item | Description |
|------|-------------|
| Delta updates | Only full pack downloads for v1 |
| P2P distribution | CDN-only for v1 |
| Custom user packs | Server-bundled only for v1 |
| Multi-device sync | Single-instance for v1 |

---

## 13. Implementation Roadmap

### Phase 1: Foundation
- [ ] Pack manifest schema and validation
- [ ] Pack storage and loading
- [ ] Basic update check

### Phase 2: Security
- [ ] Ed25519 signing infrastructure
- [ ] Signature verification
- [ ] Content hash validation

### Phase 3: Entitlements
- [ ] Entitlement caching
- [ ] Grace period handling
- [ ] Pro pack access control

### Phase 4: Resilience
- [ ] LKG storage and management
- [ ] Rollback mechanism
- [ ] Error recovery

---

## 14. Appendix: Glossary

| Term | Definition |
|------|------------|
| **Pack** | A versioned, self-contained unit of knowledge content |
| **Manifest** | Metadata file describing available packs and their versions |
| **LKG** | Last Known Good — the last verified working state for rollback |
| **Entitlement** | User's subscription status (free/trial/pro) |
| **Registry** | Mahakalp service that hosts pack metadata and downloads |
| **Bundle** | Packs shipped with the Sutra binary |

---

## 15. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-03-06 | Nishant | Initial design |
