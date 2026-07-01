# Spring Boot backend PRD / scope

## Purpose

`thundercrew-domain` backend is the Spring Boot operating API for an electric two-wheeler
control and operations management service.

The first backend goal is not a physically split MSA. The goal is to build a modular
monolith slice that can later be separated into MSA runtime slices when ownership,
workload, and deployment boundaries become real.

Initial runtime slice:

```text
development/backend
```

The API lets an admin/operator manage riders, bikes, devices, contracts, insurance,
equipment, telemetry-derived control state, and battery stations.

## Non-goals for this backend phase

- Do not create multiple independently deployed Spring Boot services yet.
- Do not implement the full Rider app backend.
- Do not implement social login, OIDC, or external IAM integration.
- Do not implement multi-role admin/RBAC beyond one admin/operator role.
- Do not implement contract document generation, e-signature, billing, or settlement.
- Do not expand insurance into insurer, policy number, period, claim, or coverage management.
- Do not implement manual telemetry correction.
- Do not finalize actual device vendor payload fields.
- Do not require cross-domain DB FK constraints as the coupling mechanism.
- Do not create a rider-bike assignment table separate from contracts.
- Do not add more frontend relocation or UI feature work in backend-only issues.

## Target repository shape

Long-term target shape follows the workspace/umbrella direction, but only as a guide.
The template must not be treated as more authoritative than the current domain needs.

```text
thundercrew-domain/
├── WORKSPACE.md
├── repo-map.md
├── docs/
│   ├── goals/
│   ├── boundaries/
│   ├── mappings/
│   ├── contracts/
│   ├── decisions/
│   └── backend/
├── development/
│   ├── front-admin-web/
│   └── service-ops-api/
└── clever-agent-workspace/
```

The original backend design issue documented this target shape before scaffold work.
Frontend relocation and the first `service-ops-api` scaffold now exist as separate
trace issues. The current canonical workspace shape is enforced by `WORKSPACE.md`,
`repo-map.md`, and `npm run check:workspace`.

## Runtime slice choice

1차 backend는 `development/backend` 하나로 둔다.

Reasons:

- Current requirements form one admin operations responsibility group.
- Domain count is high, but separate deployment ownership and failure isolation are not yet proven.
- Early physical MSA would add operational complexity before the business boundary is stable.
- Future separation remains possible by keeping package boundaries, API contracts, data ownership, and no cross-domain FK coupling.

## Actors

### Admin / Operator

Initial only user role.

Responsibilities:

- rider CRUD and app-account link review
- bike CRUD and operation status management
- rider-bike contract management
- contract template management
- insurance item and rider-insurance link management
- equipment type and bike equipment management
- device registration and bike installation management
- telemetry/control-state lookup
- battery station location, status, and count management

### Rider

Operational target, not an admin user.

- Has name and phone number.
- May be linked to a rider app account.
- Has no separate rider status enum in backend phase 1.
- Bike connection state is derived from contracts.

### External Device / Telemetry Source

System input source, not a manual user.

- Polling can fetch device state.
- Webhook can receive device state.
- Raw telemetry creates raw log data.
- Raw telemetry also feeds recent state and current map/dashboard state.

## Main capabilities

### 1. Admin auth

- Spring Security.
- Own admin JWT.
- One admin/operator role in MVP.
- Token expiry, refresh, revocation, bootstrap admin creation, and password hashing are owned by the backend auth boundary; the current baseline covers JWT access tokens, refresh-token rotation, session revocation, seed account creation, and BCrypt password hashing.

### 2. Rider management

- Internal UUID PK.
- Table-local `idx` display sequence.
- Phone number active-unique.
- App-account linkage fields.
- No rider status enum.
- Soft delete and audit columns.

### 3. Bike management

- Internal UUID PK.
- Table-local `idx` display sequence.
- `plate_number` and `vin` active-unique.
- `operation_status` is stored DB data entered/changed by the operator.
- Operation status history is retained.
- Telemetry-driven `drivingStatus`, `connectionStatus`, and `batteryStatus` are DTO/API information, not bike table data.

### 4. Rider-bike contracts

- Rider-bike connection is represented by contract.
- No separate assignment table.
- Contract template is admin-managed.
- Seeded `무제한 계약` is protected.
- `duration_minutes = null` means unlimited/open-ended template.
- Concrete rider-bike contract stores `start_at`, nullable `end_at`, and nullable `terminated_at`.
- Contract status is computed, not stored.
- `terminated_at` is the effective lifecycle end for overlap checks while preserving the historical contract row.
- A rider cannot have overlapping bike contracts.
- A bike cannot have overlapping rider contracts.
- Future reservations are allowed if they do not overlap the effective interval `[start_at, coalesce(terminated_at, end_at, infinity))`.

### 5. Insurance

- Admin-managed insurance item name list.
- Rider-insurance link table.
- No period/policy/provider details in phase 1.
- Duplicate active rider-insurance link is blocked.

### 6. Equipment

- Admin-managed equipment type.
- Bike-specific attached equipment object is the operational object.
- Attached equipment has one `management_due_date`.
- Equipment status is computed: `NORMAL`, `DUE_SOON`, `OVERDUE`.
- Multiple equipment objects of the same type on one bike are allowed unless the implementation issue later narrows this.

### 7. Device and telemetry

- Device has unique `device_uid` supplied by the device itself.
- Device and bike current installation is 1:1.
- Installation history is preserved.
- Telemetry source is only `POLLING` or `WEBHOOK`; no manual source in phase 1.
- Raw telemetry, recent state, and current state are separated by responsibility.
- API sync log records device API interactions without storing sensitive full payloads.

### 8. Battery station

- Stores name, address, latitude, longitude.
- Stores max/current/available battery counts as operator-maintained data.
- Count changes are logged.
- DTO may compute availability labels and capacity percentage.
- Map API is expected later, so pin-ready coordinates are phase-1 data.

## Accepted design principles

- DB stores source data.
- API/DTO derives information from source data.
- `operation_status` is stored because it is operator-entered operation data.
- telemetry-derived statuses are not stored because they are information calculated from latest observed telemetry.
- Cross-domain FK constraints are avoided to preserve future slice separation.
- Same-table and local invariants use DB constraints/indexes where useful.
- Service layer validates reference existence, soft-delete eligibility, overlap, and authorization.
- Spring tests must cover validation that DB FKs intentionally do not enforce.
- Current-value tables are caches/read models, not the canonical raw source.

## Risks and controls

| Risk | Control |
|---|---|
| No-FK design can create orphan references | service validation, repository tests, read-only integrity scan endpoint, and explicit error contract |
| `service-ops-api` can become too broad | package boundaries, module facades, ArchUnit dependency tests |
| Contract-as-assignment can drift | overlap validation and transaction/lock strategy |
| Telemetry raw/recent/current can diverge | idempotency key, current upsert rule, retry/rebuild policy |
| Soft delete + unique can conflict | active partial unique indexes per table |
| Station count current/log can become dual truth | current count is source data; log is audit only |
| Existing Supabase schema differs | treat existing Supabase migration as legacy MVP evidence; new backend Flyway baseline is separate |

## Open questions

Implementation-blocking:

- Gradle Kotlin DSL or Groovy DSL.
- Long-term external IAM/Supabase auth bridge decision.
- Admin bootstrap account and secret handling.
- TimescaleDB availability; if unavailable, native partition/retention fallback.
- Estimated telemetry device count and write volume.

Not blocking this design PR:

- Exact vendor payload shape.
- Exact frontend/backend API integration timing.
- Long-term analytics/read-model tables.
- Insurance period expansion.
