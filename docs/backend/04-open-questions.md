# Backend open questions ledger

## Must resolve before scaffold implementation

1. Gradle DSL preference: Kotlin DSL or Groovy DSL.
2. Admin seed account creation method and secret handling.
3. Whether TimescaleDB extension is available in the target Postgres environment.
4. Expected telemetry device count, polling cadence, webhook volume, and daily write volume.
5. Initial Flyway migration granularity and whether to use PostgreSQL extensions such as `pgcrypto`.

## Resolved in this design branch

1. Runtime slice starts as `development/backend` modular monolith.
2. DB FK policy: no cross-domain FK by default; compensate with service validation, tests, and integrity scan.
3. Same-table/local invariants can use DB checks and partial unique indexes.
4. Soft-deleted business identifiers can be reused through active partial unique indexes unless a later issue narrows a specific table.
5. Historical rows keep UUID references even if the target is later soft-deleted.
6. `bikes.operation_status` is stored data; telemetry statuses are computed information.
7. Contract is the rider-bike relationship source of truth; no assignment table.
8. `duration_minutes = null` is the unlimited/open-ended contract template signal.
9. Station `current_battery_count` and `available_battery_count` are stored operator-managed data; logs are audit.
10. Telemetry current state updates only when incoming telemetry is newer.
11. Contract overlap concurrency uses deterministic PostgreSQL advisory transaction locks on rider/bike assignment keys plus service overlap queries; PostgreSQL exclusion constraints are deferred.
12. Root `WORKSPACE.md` and `repo-map.md` were introduced as the workspace operating/map documents.
13. The admin frontend was relocated under `development/frontend`; future backend issues should not carry frontend relocation as an open decision.
14. Admin auth uses Spring Security resource-server JWT validation with HS256, configurable issuer/access-token TTL, BCrypt password hashing, opaque refresh-token rotation, and `admin_auth_sessions` server-side revocation.

## Can resolve during implementation

1. Exact numeric precision changes for coordinates and speed if vendor requires.
2. Whether audit `*_by` stores admin UUID only or also system actor strings.
3. Exact common API error response JSON shape.
4. Pagination/sorting/filtering request conventions.
5. Whether `bike_current_states` is rebuilt by explicit admin job or background job.
6. Exact ArchUnit package rule syntax.

## Deferred until vendor/API details

1. Actual device payload schema.
2. Polling authentication and webhook signature verification.
3. Timescale compression and raw telemetry long-term retention periods.
4. Long-term analytics or daily summary tables.
5. Whether telemetry ingestion becomes a separate worker/runtime slice.
