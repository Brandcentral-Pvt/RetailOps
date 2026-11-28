# Ads confirm 400 and temporary session gateway failures

Baseline b49818b. The Ads confirm UI sent null using Axios with a default application/json header. Express strict JSON rejects literal JSON null before the controller, producing 400. Confirm/cancel now send {} (bodyless calls remain valid). Do not disable strict JSON parsing. Malformed JSON returns a safe INVALID_JSON response without raw body logging. A transient confirmation failure triggers one scoped job status read; a COMPLETED result is authoritative, otherwise history remains available for retry. Owner, seller, permissions and transactional reconciliation remain unchanged.

The reported /api/auth/me 502 is an upstream availability error, not proof of invalid credentials. Session restoration now retries a bounded number of read-only transient failures and distinguishes 401 from service unavailable. The protected route offers a retry on persistent outage without trusting localStorage or granting access. Public login remains available. No production PM2, proxy or database settings changed. Deployment uses PM2 restart, which may cause temporary gateway failure, but actual cause needs production logs.

## Acceptance

Merge after Ads CI passes. Reopen the existing READY job and confirm; no reupload unless expired. Check /api/health/liveness, /api/health/readiness, /api/health/ads and /api/health/ads-imports. If 502 persists, inspect the actual API process status and logs plus reverse-proxy error logs. Capture sanitized API response code/message for any remaining 400. Tests cover Express strict JSON, valid empty object/bodyless action, permission checks, exact browser request and lost-response reconciliation, and retry/401 session behavior.
