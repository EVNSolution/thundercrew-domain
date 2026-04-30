# Backend redesign change ledger

## Trace

- Project start: EVNSolution/clever-change-control#45
- Change request: EVNSolution/clever-change-control#48
- Target issue: EVNSolution/thundercrew-domain#8
- Branch: `cc-48-backend-domain-design`
- Phase: backend PRD/domain/DB design only; Spring Boot scaffold is a follow-up scope.

## Intent

`thundercrew-domain` 백엔드는 기존 mock/front-first 구현을 전제로 이어가지 않고,
Spring Boot 기반 운영 API를 처음부터 다시 설계한다.

이번 변경은 구현보다 변화관리와 설계 검토가 핵심이다. PRD, domain, DB, DTO,
scaffold 계획을 먼저 문서화하고, implementation은 별도 후속 issue/branch에서 진행한다.

## Confirmed decisions

- MSA umbrella monorepo template은 참고하되 맹신하지 않는다.
- 1차 backend runtime은 `development/service-ops-api` modular monolith로 시작한다.
- 미래 MSA 분리를 고려해 bounded context와 문서 경계를 먼저 잡는다.
- Spring Boot 3.x, Java 21, Gradle.
- PostgreSQL, Spring Data JPA/Hibernate, Flyway.
- Spring Security + 자체 관리자 JWT.
- 운영자는 1차에서 단일 관리자 권한이다.
- DB는 data를 저장하고, DTO/API에서 information을 계산한다.
- 주요 테이블은 UUID PK와 테이블별 표시 순번 `idx`를 가진다.
- 주요 테이블은 soft delete와 full audit columns를 가진다.
- cross-domain DB FK constraint는 기본 사용하지 않는다.
- 같은 table 내부 invariant는 DB check/unique/partial unique index로 보강한다.
- 도메인 간 참조 존재 여부, soft delete 참조 차단, overlap 검증은 service layer와 테스트로 보상한다.

## Review model and outcome

- PRD/scope review: architect subagent `Copernicus`.
- Domain/DB draft review: architect subagent `Confucius`.
- Risk critique: critic subagent `Laplace`.

Review result:

- PRD/scope 방향은 accepted.
- Domain/DB 초안 방향은 accepted with required clarifications.
- Critic review initially returned **REJECT before commit** because no-FK compensation,
  telemetry write path, invariant matrix, and module-boundary enforcement were not concrete enough.

Integrated fixes in this branch:

- Added same-domain vs cross-domain reference policy.
- Added soft delete + unique/reference policy.
- Added invariant matrix and required DB constraints.
- Added telemetry raw/recent/current write-path rules, idempotency, out-of-order handling, and fallback.
- Added package-boundary enforcement plan with ArchUnit/module facade rules.
- Added Supabase MVP schema transition policy.
- Added review integration notes.

## Existing Supabase MVP schema transition

The existing Supabase frontend-first migration remains historical MVP evidence only.
It is not the canonical backend schema for the Spring Boot redesign.

Decision for the backend design phase:

- Treat the Spring Boot schema as a new backend baseline.
- Do not mutate production Supabase data or assume data migration in this issue.
- If a real backend database already contains MVP data later, create a separate migration/reset issue before applying Flyway.
- Keep old Supabase migration files untouched in this design branch to avoid mixing frontend MVP cleanup with backend design.

## Branch/merge policy

The user authorized branch-of-branch work and internal merges for this change-management-heavy phase.
This branch remains the trace branch for #48/#8 until a PR is opened into `dev`.

## Core persistence baseline implementation

Trace:

- Change request: EVNSolution/clever-change-control#50
- Target issue: EVNSolution/thundercrew-domain#12
- Branch: `cc-50-core-persistence-baseline`

Scope decision:

- Implement the non-telemetry core relational schema and JPA entity/enums only.
- Keep CRUD controllers, API DTO contracts, JWT, telemetry tables/write path, dashboard/map API, and frontend relocation out of this issue.
- Cross-domain references remain UUID scalar columns without DB foreign-key constraints.
- JPA mappings intentionally avoid cross-domain relationship annotations such as `@ManyToOne`.


## Read-only API contract baseline implementation

Trace:

- Change request: EVNSolution/clever-change-control#51
- Target issue: EVNSolution/thundercrew-domain#14
- Branch: `cc-51-api-read-contracts`

Issue-size decision:

- Full CRUD plus API DTOs across all domains is too broad for one review unit.
- This slice only adds read-only `GET` API contracts, DTOs, read services, and read repositories for the non-telemetry core resources.
- Contract templates are included as a selector/read dependency for rider-bike contracts because they already exist in the V1 backend schema.
- Write commands, JWT/auth endpoints, telemetry, dashboard/map APIs, and frontend relocation remain follow-up issue scopes.

Boundary decision:

- Controllers are allowed from this issue forward, but `POST`, `PUT`, `PATCH`, `DELETE`, and `@RequestBody` remain forbidden by architecture tests for this baseline.
- Operation data remains protected by the existing authenticated scaffold; JWT implementation is still deferred.
- Read repositories intentionally expose only derived read methods rather than `save`/`delete` repository methods.

## Admin JWT auth baseline implementation

Trace:

- Change request: EVNSolution/clever-change-control#52
- Target issue: EVNSolution/thundercrew-domain#16
- Branch: `cc-52-admin-jwt-auth-baseline`

Issue-size decision:

- Write-command APIs are intentionally deferred until a real admin principal/authentication baseline exists.
- This slice only adds admin login/access-token issuance and Bearer authentication for the existing read APIs.
- Operation `POST`, `PUT`, `PATCH`, `DELETE`, refresh/revocation, RBAC expansion, admin UI, telemetry, dashboard/map APIs, TimescaleDB, and frontend relocation remain follow-up issue scopes.

Boundary decision:

- `POST` and `@RequestBody` are allowed only for `AuthController.login`.
- Operation controllers remain read-only and architecture tests continue to block write mappings outside auth.
- JWT secret is environment/config driven and must not be committed.

## Rider write-command baseline implementation

Trace:

- Change request: EVNSolution/clever-change-control#53
- Target issue: EVNSolution/thundercrew-domain#18
- Branch: `cc-53-rider-command-baseline`

Issue-size decision:

- Full write CRUD across all operation domains is too broad for one review unit.
- This slice only adds rider basic profile create/update/soft-delete because rider has no cross-domain reference selection, overlap locking, device/station side effects, or telemetry dependency.
- Bike, contract, insurance, equipment, device, station, rider app-account link, contract assignment, telemetry, frontend integration, hard delete/restore, bulk import/export, and advanced search remain follow-up issue scopes.

Boundary decision:

- Client request DTOs expose only human-entered rider fields: name, phone number, team, area, memo.
- Server-generated id, idx, audit fields, deleted fields, app-account fields, and relationship/FK IDs remain non-client inputs.
- Architecture tests allow operation write mappings and request bodies only for `RiderCommandController` in this issue; other operation domains remain read-only.

## Frontend workspace relocation implementation

Trace:

- Change request: EVNSolution/clever-change-control#54
- Target issue: EVNSolution/thundercrew-domain#20
- Branch: `cc-54-frontend-workspace-relocation`

Issue-size decision:

- This slice is structural only and is appropriate as one review unit.
- It moves the existing Next.js admin web app into `development/front-admin-web` to match the documented workspace target shape.
- UI feature work, backend API/domain changes, Supabase schema semantics, real Vercel project setting changes, and frontend-to-backend integration remain follow-up scopes.

Boundary decision:

- Repository root becomes the workspace orchestration layer.
- Product runtime source lives under `development/front-admin-web` and `development/service-ops-api`.
- Root npm scripts delegate to the frontend workspace so existing local verification commands remain stable.

## Bike write-command baseline implementation

Trace:

- Change request: EVNSolution/clever-change-control#55
- Target issue: EVNSolution/thundercrew-domain#22
- Branch: `cc-55-bike-command-baseline`

Issue-size decision:

- This slice adds only the Bike aggregate command baseline after the Rider command baseline.
- Included operations are bike create/update/soft-delete and a dedicated operation-status change endpoint that closes/appends status history.
- The current schema fields are `plateNumber`, `vin`, `modelName`, `operationStatus`, and `memo`; `manufacturer` and `manufacturedYear` are deferred to a future schema extension issue.
- Rider-bike contract assignment, device installation commands, equipment commands, telemetry, dashboard/map APIs, frontend integration, hard delete/restore, bulk import/export, and advanced search remain follow-up scopes.

Boundary decision:

- Generic bike PATCH is profile-only and does not accept `operationStatus` as a mutable field.
- Operation status remains operator-entered DB data and changes only through `/api/v1/bikes/{id}/operation-status` so history transitions are transactional.
- Client request DTOs ignore IDs, idx, audit/deleted fields, telemetry/system values, and FK-like relationship fields.
- Soft delete blocks active rider-bike contract, active bike equipment, and active device installation references.
- Architecture tests allow operation write mappings/request bodies only for auth login, rider commands, and bike commands at this stage.

## Contract template write-command baseline implementation

Trace:

- Change request: EVNSolution/clever-change-control#56
- Target issue: EVNSolution/thundercrew-domain#24
- Branch: `cc-56-contract-template-command`

Issue-size decision:

- This slice adds only the ContractTemplate aggregate command baseline after the Rider and Bike command baselines.
- Included operations are authenticated contract-template create/update/soft-delete for operator-managed templates.
- Rider-bike contract assignment, overlap locking, termination, billing, e-signature, frontend integration, hard delete/restore, bulk import/export, and advanced search remain follow-up scopes.

Boundary decision:

- Client request DTOs expose only operator-managed fields: name, durationMinutes, description, enabled.
- Server-generated id, idx, audit/deleted fields, and systemTemplate remain non-client inputs and are ignored when sent.
- `durationMinutes = null` means an unlimited template; positive integer values represent fixed durations; zero/negative values are invalid.
- `PATCH enabled=false` disables selection while keeping the template readable; `DELETE` soft-deletes and removes the template from active read APIs.
- Seeded system templates such as `무제한 계약` are protected from update, disable, and delete.
- Duplicate active names are blocked by service precheck plus the database partial unique index.
- Architecture tests allow operation write mappings/request bodies only for auth login, rider commands, bike commands, and contract-template commands at this stage.

## Rider-bike contract assignment / overlap baseline implementation

Trace:

- Change request: EVNSolution/clever-change-control#57
- Target issue: EVNSolution/thundercrew-domain#26
- Branch: `cc-57-rider-bike-contract-command`

Issue-size decision:

- This slice adds only create-time rider-bike contract assignment because the contract is the rider-bike relationship source of truth.
- Included operation is authenticated `POST /api/v1/rider-bike-contracts` with selected rider, bike, contract-template references, `startAt`, and optional memo.
- Contract update/reassignment, termination, delete/soft-delete, billing, e-signature, documents, rider app integration, frontend selectors, hard delete/restore, bulk import/export, and advanced search remain follow-up scopes.

Boundary decision:

- UI must not expose raw ID text inputs, but this backend command accepts UUID references produced by selector/search choices.
- `endAt` is derived from the selected contract template: fixed `durationMinutes` adds minutes to `startAt`; `durationMinutes = null` keeps an open-ended contract.
- Contract status remains computed from period and termination data; no stored status enum is introduced in this slice.
- Rider and bike references are validated by service-layer table checks rather than DB foreign keys, preserving the no cross-domain FK policy.
- Contract template references are validated as existing, not soft-deleted, and enabled.
- Overlap uses half-open intervals `[startAt, endAt)`: adjacent reservations are valid, but overlapping non-deleted and non-terminated contracts are rejected for both rider and bike.
- Open-ended contracts use the same overlap rule with an operational far-future bound, so they block later assignments until a future termination lifecycle issue exists.
- Concurrency strategy is deterministic PostgreSQL advisory transaction locks on the rider/bike assignment keys before overlap checks and insert; exclusion constraints are deferred.
- Architecture tests allow operation write mappings/request bodies only for auth login, rider commands, bike commands, contract-template commands, and rider-bike contract create at this stage.

## Device registry command baseline implementation

Trace:

- Change request: EVNSolution/clever-change-control#58
- Target issue: EVNSolution/thundercrew-domain#28
- Branch: `cc-58-device-registry-command`

Issue-size decision:

- This slice adds only the Device registry command baseline before bike-device installation commands.
- Included operations are authenticated `POST /api/v1/devices`, `PATCH /api/v1/devices/{id}`, and `DELETE /api/v1/devices/{id}` as soft-delete.
- Bike-device installation create/replace/remove, telemetry ingestion/current state, device API sync logs, dashboard/map APIs, frontend selectors, hard delete/restore, bulk import/export, and advanced search remain follow-up scopes.

Boundary decision:

- Client request DTOs expose only operator-managed registry fields: `deviceUid`, `manufacturer`, `modelName`, `enabled`, and `memo`.
- Server-generated id, idx, audit/deleted fields, relationship fields such as bike/installation IDs, and telemetry/system fields remain non-client inputs and are ignored when sent.
- `deviceUid` is the device-supplied business identifier and is unique among active, non-deleted devices.
- Soft-deleted device UIDs may be reused through the existing active partial unique index.
- Device soft-delete disables the device and blocks deletion while an active `bike_device_installations` row references it.
- Architecture tests allow operation write mappings/request bodies only for auth login, rider commands, bike commands, contract-template commands, rider-bike contract create, and device registry commands at this stage.

## Bike-device installation command baseline implementation

Trace:

- Change request: EVNSolution/clever-change-control#59
- Target issue: EVNSolution/thundercrew-domain#30
- Branch: `cc-59-bike-device-installation-command`

Issue-size decision:

- This slice adds only the bike-device installation lifecycle command baseline after the device registry command baseline.
- Included operations are authenticated `POST /api/v1/bike-device-installations` for install/replace and `PATCH /api/v1/bike-device-installations/{id}/remove` for lifecycle removal.
- Device registry commands, telemetry ingestion/current state, device API sync logs, dashboard/map APIs, frontend selectors, hard delete/restore, bulk import/export, and advanced search remain follow-up scopes.

Boundary decision:

- Client request DTOs expose only selector-produced references and operator lifecycle fields: `bikeId`, `deviceId`, `installedAt`, optional `memo`, and remove `removedAt`/`memo`.
- Server-generated id, idx, audit/deleted fields, telemetry fields, and relationship/system state outside the lifecycle endpoints remain non-client inputs and are ignored when sent.
- Bike and device references are validated in the service layer without DB foreign keys or JPA relationships.
- Disabled devices cannot be installed.
- Install/replace uses deterministic PostgreSQL advisory transaction locks on bike/device keys, closes existing active bike/device rows, flushes, then inserts the replacement row in one transaction.
- Remove sets `removedAt` and preserves history; it does not soft-delete the installation row.
- Architecture tests allow operation write mappings/request bodies only for auth login, prior command slices, and bike-device installation create/remove at this stage.

## Equipment type registry command baseline implementation

Trace:

- Change request: EVNSolution/clever-change-control#60
- Target issue: EVNSolution/thundercrew-domain#32
- Branch: `cc-60-equipment-type-command`

Issue-size decision:

- This slice adds only the equipment type registry command baseline after the device and bike-device command slices.
- Included operations are authenticated `POST /api/v1/equipment-types`, `PATCH /api/v1/equipment-types/{id}`, and `DELETE /api/v1/equipment-types/{id}` as soft-delete.
- Bike equipment attach/update/remove lifecycle commands, computed equipment due-status, frontend selectors, dashboard/map APIs, hard delete/restore, bulk import/export, and advanced search remain follow-up scopes.

Boundary decision:

- Client request DTOs expose only operator-managed registry fields: `name`, `description`, and `enabled`.
- Server-generated id, idx, audit/deleted fields, bike-equipment relationships, and lifecycle/system fields remain non-client inputs and are ignored when sent.
- `name` is unique among active, non-deleted equipment types; soft-deleted names may be reused through the existing active partial unique index.
- Equipment type soft-delete disables the type and blocks deletion while active `bike_equipments` rows reference it.
- Removed/historical bike-equipment rows do not block type soft-delete, preserving history by UUID reference without JPA relationships.
- Architecture tests allow operation write mappings/request bodies only for auth login, prior command slices, and equipment type registry commands at this stage.

## Bike equipment lifecycle command baseline implementation

Trace:

- Change request: EVNSolution/clever-change-control#61
- Target issue: EVNSolution/thundercrew-domain#34
- Branch: `cc-61-bike-equipment-lifecycle-command`

Issue-size decision:

- This slice adds only the bike equipment lifecycle command baseline after the equipment type registry command baseline.
- Included operations are authenticated `POST /api/v1/bike-equipments`, `PATCH /api/v1/bike-equipments/{id}`, and `PATCH /api/v1/bike-equipments/{id}/remove`.
- Equipment type registry, frontend selectors/forms, telemetry/current-state ingestion, dashboard/map APIs, job scheduling, hard delete/restore, bulk import/export, and integrity scan implementation remain follow-up scopes.

Boundary decision:

- Client request DTOs expose only selector-produced references plus operator-managed equipment fields; UI must choose bikes by plate/VIN and equipment types by name instead of asking users to type raw database IDs.
- Generic update keeps `bikeId`, `equipmentTypeId`, `installedAt`, id, idx, deleted/audit fields, and removed lifecycle fields server-owned/out of scope. Transfer or type reclassification requires remove + create or a future dedicated correction workflow.
- Bike and equipment type references are validated in the service layer without DB foreign keys or JPA relationships.
- Deleted/missing bike references and missing/deleted/disabled equipment types are rejected through the existing reference/invalid-state error contracts.
- Active `serialNumber` is unique and can be reused after removal.
- Removal preserves history by setting `removedAt`; it does not soft-delete the row.
- Read DTOs compute `managementStatus` from `managementDueDate` using Asia/Seoul local date: `OVERDUE`, `DUE_SOON`, `NORMAL`.
- Architecture tests allow operation write mappings/request bodies only for auth login, prior command slices, and bike equipment lifecycle commands at this stage.

## Workspace cleanup and duplicate-removal pass

Trace:

- Change request: EVNSolution/clever-change-control#62
- Target issue: EVNSolution/thundercrew-domain#36
- Branch: `cc-62-workspace-cleanup-dedup`

Issue-size decision:

- This slice is a behavior-preserving workspace hygiene pass.
- Runtime behavior, API contracts, database schema, package dependencies, secrets, Vercel/Supabase settings, and product UI changes are out of scope.
- Safe local cleanup is limited to ignored generated/OS artifacts that make the repository root look like the old frontend app root.

Boundary decision:

- Repository root remains the workspace orchestration layer, not a Next.js runtime root.
- Root-level stale frontend generated artifacts such as `.next/`, `next-env.d.ts`, and `tsconfig.tsbuildinfo` are treated as cleanup failures by `npm run check:workspace`.
- Active runtime caches under `development/front-admin-web` and `development/service-ops-api` may be recreated by verification commands and are not product source.
- Backend design docs should not continue to list the completed frontend relocation or workspace-map introduction as unresolved decisions.

## Insurance command baseline implementation

Trace:

- Change request: EVNSolution/clever-change-control#64
- Target issue: EVNSolution/thundercrew-domain#40
- Branch: `cc-64-insurance-command-baseline`

Issue-size decision:

- This slice adds only the insurance item registry and rider-insurance link command baseline after the equipment lifecycle command slice.
- Included operations are authenticated `POST /api/v1/insurance-items`, `PATCH /api/v1/insurance-items/{id}`, `DELETE /api/v1/insurance-items/{id}`, `POST /api/v1/rider-insurances`, `PATCH /api/v1/rider-insurances/{id}`, and `DELETE /api/v1/rider-insurances/{id}`.
- Insurance provider/policy/period expansion, frontend selectors/forms, station commands, rider app-account link/unlink, telemetry/current state, dashboard/map APIs, hard delete/restore, bulk import/export, and advanced search remain follow-up scopes.

Boundary decision:

- Client request DTOs expose only operator-managed insurance item fields or selector-produced rider/insurance references plus link memo/enabled state; UI must choose riders by name/phone and insurance items by name instead of asking users to type raw database IDs.
- Server-generated id, idx, audit/deleted fields, and relationship/system fields remain non-client inputs and are ignored when sent.
- Insurance item `name` is unique among active, non-deleted items; soft-deleted names may be reused through the existing active partial unique index.
- Insurance item soft-delete disables the item and blocks deletion while enabled rider-insurance links reference it.
- Rider and insurance item references are validated in the service layer without DB foreign keys or JPA relationships.
- Generic rider-insurance update keeps `riderId` and `insuranceItemId` immutable. Moving a link requires delete + create or a future correction workflow.
- Re-enabling a disabled rider-insurance link revalidates the existing rider and insurance item references before changing state.
- Rider-insurance delete soft-deletes and disables the link, preserving history while allowing the same pair to be created again.
- Architecture tests allow operation write mappings/request bodies only for auth login, prior command slices, and the insurance command controllers at this stage.

## Battery station command baseline implementation

Trace:

- Change request: EVNSolution/clever-change-control#65
- Target issue: EVNSolution/thundercrew-domain#42
- Branch: `cc-65-station-command-baseline`

Issue-size decision:

- This slice adds only the battery station command baseline after the insurance command slice.
- Included operations are authenticated `POST /api/v1/battery-stations`, `PATCH /api/v1/battery-stations/{id}`, `PATCH /api/v1/battery-stations/{id}/battery-counts`, and `DELETE /api/v1/battery-stations/{id}`.
- Direct command endpoints for `station_battery_count_logs`, map API integration, frontend selectors/forms, dashboard/map read API expansion, telemetry/current state, hard delete/restore, bulk import/export, and advanced search remain follow-up scopes.

Boundary decision:

- Client request DTOs expose only operator-managed station metadata and count values: name, address, coordinates, status, max/current/available counts, reason, and memo.
- Server-generated id, idx, audit/deleted fields, computed read labels, and count-log system fields remain non-client inputs and are ignored when sent.
- Station `name` is unique among active, non-deleted rows; soft-deleted names may be reused through the existing active partial unique index.
- Count updates must satisfy `maxBatteryCapacity >= currentBatteryCount >= availableBatteryCount >= 0` and create station battery-count log history in the same transaction.
- Station soft-delete marks the station inactive while preserving count-log history as read-only audit data.
- Architecture tests allow operation write mappings/request bodies only for auth login, prior command slices, and the station command controller at this stage.
