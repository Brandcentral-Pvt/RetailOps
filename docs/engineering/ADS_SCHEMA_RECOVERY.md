# Ads deployment recovery

Browser logs show 503 from canonical-options, canonical-targets and canonical-report, and 400 from ads-validate. These do not prove an exact server exception. The existing startup migration runner stops at the first failure; previously GMS had independent additive repair but Ads did not. Docker also omitted the contracts directory. The shared Axios JSON default can transform FormData into JSON; the Ads modal now explicitly removes it for uploads.

## Deployment checks

1. Deploy this patch. Check GET /api/health/ads on the actual production origin. HTTP 200 ready confirms the canonical fact table's required columns, type/scale/nullability, primary key and SQL compatibility >=130; it is not a check of all target/catalog dependencies.
2. The primary worker independently creates the missing table using migration 098 if startup migrations are permitted. It does not alter incompatible existing tables, skip the operator's opt-out, or change legacy AdsPerformance. No DDL in requests.
3. If health remains 503, inspect the primary worker log for "Ads schema is not ready" / "Ads schema startup failed". Check DB compatibility, Sellers schema/FK types, and migration permissions. Do not drop tables or fake empty responses.
4. Retry the three report requests and upload validation. A valid empty fact table returns empty results. A seller must be authorized and have verified marketplace/currency and matching catalog products.
5. Confirm uploads remain separately gated by ADS_CANONICAL_IMPORT_ENABLED=true. Keep disabled until production acceptance.

No production DB or deployment access was used to verify these hypotheses. The actual API response body and SQL error logs are required if the failure persists.
