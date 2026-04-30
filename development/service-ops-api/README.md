# service-ops-api

Spring Boot operations API baseline for ThunderCrew domain management.

## Scope

This module currently provides the backend scaffold, core persistence baseline, read-only API/DTO contract baseline, admin JWT login/access-token baseline, telemetry current-state baseline, and initial operation command slices:

- Spring Boot 3.x / Java 21
- Gradle Kotlin DSL
- PostgreSQL + Flyway
- Spring Data JPA baseline
- Spring Security + BCrypt password hashing + stateless Bearer JWT access tokens
- bounded package skeleton
- ArchUnit boundary tests
- common API error/audit/soft-delete/time baseline
- Flyway baseline for `admin_users`, `contract_templates`, and the system `무제한 계약` seed
- Flyway + JPA entity mappings for core operations:
  - riders
  - bikes and operation status history
  - rider-bike contracts
  - insurance items and rider-insurance links
  - equipment types and bike equipment
  - devices and bike-device installation history
  - battery stations and station count logs
  - telemetry raw logs, bike recent states, bike current states, and telemetry ingestion error logs

- Read-only `GET /api/v1/**` list/detail endpoints and response DTOs for:
  - riders
  - bikes and bike operation status histories
  - contract templates and rider-bike contracts
  - insurance items and rider-insurance links
  - equipment types and bike equipment
  - devices and bike-device installation history
  - battery stations and station count logs
- Shared `PageResponse` page contract and `RESOURCE_NOT_FOUND` error contract
- Rider basic profile command endpoints:
  - `POST /api/v1/riders`
  - `PATCH /api/v1/riders/{id}`
  - `PATCH /api/v1/riders/{id}/app-account/link`
  - `PATCH /api/v1/riders/{id}/app-account/unlink`
  - `DELETE /api/v1/riders/{id}`
- Bike command endpoints:
  - `POST /api/v1/bikes`
  - `PATCH /api/v1/bikes/{id}`
  - `PATCH /api/v1/bikes/{id}/operation-status`
  - `DELETE /api/v1/bikes/{id}`
- Contract command endpoints:
  - `POST /api/v1/contract-templates`
  - `PATCH /api/v1/contract-templates/{id}`
  - `DELETE /api/v1/contract-templates/{id}`
  - `POST /api/v1/rider-bike-contracts`
- Device registry command endpoints:
  - `POST /api/v1/devices`
  - `PATCH /api/v1/devices/{id}`
  - `DELETE /api/v1/devices/{id}`
- Bike-device installation command endpoints:
  - `POST /api/v1/bike-device-installations`
  - `PATCH /api/v1/bike-device-installations/{id}/remove`
- Equipment type registry command endpoints:
  - `POST /api/v1/equipment-types`
  - `PATCH /api/v1/equipment-types/{id}`
  - `DELETE /api/v1/equipment-types/{id}`
- Bike equipment lifecycle command endpoints:
  - `POST /api/v1/bike-equipments`
  - `PATCH /api/v1/bike-equipments/{id}`
  - `PATCH /api/v1/bike-equipments/{id}/remove`
- Insurance item registry command endpoints:
  - `POST /api/v1/insurance-items`
  - `PATCH /api/v1/insurance-items/{id}`
  - `DELETE /api/v1/insurance-items/{id}`
- Rider-insurance link command endpoints:
  - `POST /api/v1/rider-insurances`
  - `PATCH /api/v1/rider-insurances/{id}`
  - `DELETE /api/v1/rider-insurances/{id}`
- Battery station command endpoints:
  - `POST /api/v1/battery-stations`
  - `PATCH /api/v1/battery-stations/{id}`
  - `PATCH /api/v1/battery-stations/{id}/battery-counts`
  - `DELETE /api/v1/battery-stations/{id}`
- Telemetry ingestion/current-state endpoints:
  - `POST /api/v1/telemetry/device-events`
  - `GET /api/v1/telemetry/bike-current-states`
  - `GET /api/v1/telemetry/bikes/{bikeId}/current-state`
- Dashboard/map aggregate endpoint:
  - `GET /api/v1/dashboard/map-state`
- `POST /api/v1/auth/login` for admin access-token issuance
- Existing protected read APIs accept `Authorization: Bearer <token>`
- `AUTHENTICATION_FAILED` 401 JSON error contract for invalid/missing/expired tokens

Out of scope for the current backend baseline:

- Create/update/delete command endpoints and request DTOs outside delivered command slices
- frontend map integration
- external device API polling/sync-log implementation, TimescaleDB hypertables, telemetry retention schedulers, and bulk archival jobs
- refresh token, logout/revocation, password reset, RBAC expansion, or admin-management UI
- frontend relocation
- integrity scan/repair job

## Local environment

Copy placeholders and provide local secrets outside git:

```bash
cp .env.example .env.local
```

Required DB and JWT variables for local runtime:

```bash
SERVICE_OPS_DB_URL=jdbc:postgresql://localhost:5432/service_ops_api
SERVICE_OPS_DB_USERNAME=service_ops
SERVICE_OPS_DB_PASSWORD=<local-db-password>
THUNDERCREW_AUTH_JWT_SECRET=<at-least-32-byte-jwt-secret>
THUNDERCREW_AUTH_JWT_ISSUER=thundercrew-domain
THUNDERCREW_AUTH_JWT_ACCESS_TOKEN_TTL=PT30M
```

Optional admin seed variables. If any required value is missing, seeding is skipped.

```bash
THUNDERCREW_ADMIN_SEED_LOGIN_ID=<admin-login-id>
THUNDERCREW_ADMIN_SEED_PASSWORD=<admin-password>
THUNDERCREW_ADMIN_SEED_DISPLAY_NAME=<admin-display-name>
THUNDERCREW_ADMIN_SEED_EMAIL=<admin-email>
```

Do not commit real passwords, JWT secrets, or service credentials.

## Rider command API

The first write-command slice is limited to rider basic profile fields. The client sends only human-entered fields; the server owns IDs, display sequence, audit columns, deleted state, and app-account linkage fields.

```bash
curl -X POST http://localhost:8080/api/v1/riders \
  -H "Authorization: Bearer <access-token>" \
  -H 'Content-Type: application/json' \
  -d '{"name":"신규 라이더","phoneNumber":"010-3000-4000","teamName":"서초팀","areaName":"서울 서초"}'
```

Duplicate active phone numbers return `409 DUPLICATE_ACTIVE_RESOURCE`; soft-deleted phone numbers may be reused. Rider deletion is a soft delete and returns `409 INVALID_STATE_TRANSITION` when active bike-contract or rider-insurance references still exist.

## Rider app-account link command API

The rider app-account slice manages whether an operations rider is linked to a rider-app account. UI forms should choose an app account by human-readable rider-app context such as phone/email/account summary; operators must not type raw database IDs. The backend accepts the selector-produced `appAccountId` and owns the linked timestamp.

```bash
curl -X PATCH http://localhost:8080/api/v1/riders/<rider-id>/app-account/link \
  -H "Authorization: Bearer <access-token>" \
  -H 'Content-Type: application/json' \
  -d '{"appAccountId":"<selected-app-account-id>"}'
```

Linking sets `appAccountLinked=true`, stores the selected `appAccountId`, and sets `appLinkedAt` from server time. Re-linking the same app account is idempotent; linking a different account requires unlinking first. Duplicate active `appAccountId` values return `409 DUPLICATE_ACTIVE_RESOURCE`.

```bash
curl -X PATCH http://localhost:8080/api/v1/riders/<rider-id>/app-account/unlink \
  -H "Authorization: Bearer <access-token>"
```

Unlinking clears `appAccountLinked`, `appAccountId`, and `appLinkedAt` while preserving the rider row.

## Device registry command API

The device registry slice is limited to operator-managed registry fields. The server owns IDs, display sequence, audit columns, deleted state, installation relationships, and telemetry/system state. Clients should present human-readable device UID choices rather than asking operators to type raw database IDs.

```bash
curl -X POST http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer <access-token>" \
  -H 'Content-Type: application/json' \
  -d '{"deviceUid":"DEV-SEOUL-001","manufacturer":"ThunderDevice","modelName":"TD-100","enabled":true}'
```

Duplicate active device UIDs return `409 DUPLICATE_ACTIVE_RESOURCE`; soft-deleted UIDs may be reused. Device deletion is a soft delete and returns `409 INVALID_STATE_TRANSITION` when an active bike-device installation still references the device.

## Equipment type registry command API

The equipment type registry slice is limited to operator-managed type fields. The server owns IDs, display sequence, audit columns, deleted state, and bike-equipment relationships. UI forms should collect a human-readable type name/description and enabled state only; operators must not type raw database IDs.

```bash
curl -X POST http://localhost:8080/api/v1/equipment-types \
  -H "Authorization: Bearer <access-token>" \
  -H 'Content-Type: application/json' \
  -d '{"name":"브레이크 패드","description":"소모품","enabled":true}'
```

Duplicate active equipment type names return `409 DUPLICATE_ACTIVE_RESOURCE`; soft-deleted names may be reused. Equipment type deletion is a soft delete that disables the type and returns `409 INVALID_STATE_TRANSITION` while active bike-equipment rows still reference it. Removed historical bike-equipment rows do not block the registry type soft delete.

## Bike equipment lifecycle command API

The bike equipment lifecycle slice manages equipment objects attached to a bike. UI forms should choose bikes by plate/VIN and equipment types by name; operators must not type raw database IDs. Transfer to another bike or type reclassification is out of scope for generic update and should be modeled as remove + create or a future dedicated correction workflow.

```bash
curl -X POST http://localhost:8080/api/v1/bike-equipments \
  -H "Authorization: Bearer <access-token>" \
  -H 'Content-Type: application/json' \
  -d '{"bikeId":"<selected-bike-id>","equipmentTypeId":"<selected-type-id>","equipmentLabel":"전륜 브레이크","serialNumber":"SER-001","installedAt":"2026-04-30T00:00:00Z","managementDueDate":"2026-05-30"}'
```

Multiple active equipment rows of the same type may exist on one bike. Active `serialNumber` values are unique and may be reused after removal. The read DTO computes `managementStatus` from the Asia/Seoul local date and `managementDueDate`: `OVERDUE`, `DUE_SOON`, or `NORMAL`. Removal preserves history by setting `removedAt`:

```bash
curl -X PATCH http://localhost:8080/api/v1/bike-equipments/<equipment-id>/remove \
  -H "Authorization: Bearer <access-token>" \
  -H 'Content-Type: application/json' \
  -d '{"removedAt":"2026-05-01T00:00:00Z","memo":"장비 탈거"}'
```

## Insurance item registry command API

The insurance item registry slice manages the operator-created list of insurance names that can be attached to riders. UI forms should collect a human-readable insurance name/description and enabled state only; operators must not type raw database IDs.

```bash
curl -X POST http://localhost:8080/api/v1/insurance-items \
  -H "Authorization: Bearer <access-token>" \
  -H 'Content-Type: application/json' \
  -d '{"name":"유상운송 보험","description":"라이더 운영 보험","enabled":true}'
```

Duplicate active insurance item names return `409 DUPLICATE_ACTIVE_RESOURCE`; soft-deleted names may be reused. Insurance item deletion is a soft delete that disables the item and returns `409 INVALID_STATE_TRANSITION` while enabled rider-insurance links still reference it.

## Rider-insurance link command API

The rider-insurance slice links riders to selected insurance items. The backend accepts selector-produced UUID references from a UI that chooses riders by name/phone and insurance items by name; users must not type raw FK IDs. Generic update is limited to link memo/enabled state. Moving a link to another rider or insurance item should be modeled as delete + create or a future correction workflow.

```bash
curl -X POST http://localhost:8080/api/v1/rider-insurances \
  -H "Authorization: Bearer <access-token>" \
  -H 'Content-Type: application/json' \
  -d '{"riderId":"<selected-rider-id>","insuranceItemId":"<selected-insurance-item-id>","memo":"상담 후 연결","enabled":true}'
```

Missing/deleted riders and missing/deleted/disabled insurance items are rejected with the shared reference/invalid-state error contracts. Duplicate active rider-insurance pairs return `409 DUPLICATE_ACTIVE_RESOURCE`; deleting a link soft-deletes and disables it so the same pair can be created again while preserving the historical row.

## Battery station command API

The battery station slice manages operator-visible station metadata and battery-count snapshots. UI forms should collect station name, address, map coordinates, status, and count fields; operators must not type generated database IDs. Count-log rows remain read-only from direct API writes and are created by the station battery-count update command.

```bash
curl -X POST http://localhost:8080/api/v1/battery-stations \
  -H "Authorization: Bearer <access-token>" \
  -H 'Content-Type: application/json' \
  -d '{"name":"강남 스테이션","address":"서울 강남구 테헤란로 1","latitude":37.5010000,"longitude":127.0396000,"status":"ACTIVE","maxBatteryCapacity":12,"currentBatteryCount":7,"availableBatteryCount":5}'
```

Duplicate active station names return `409 DUPLICATE_ACTIVE_RESOURCE`; soft-deleted names may be reused. Count values must satisfy `maxBatteryCapacity >= currentBatteryCount >= availableBatteryCount >= 0`.

```bash
curl -X PATCH http://localhost:8080/api/v1/battery-stations/<station-id>/battery-counts \
  -H "Authorization: Bearer <access-token>" \
  -H 'Content-Type: application/json' \
  -d '{"maxBatteryCapacity":12,"currentBatteryCount":7,"availableBatteryCount":5,"reason":"현장 재고 조정","memo":"오전 실사 반영"}'
```

Station deletion is a soft delete that marks the station inactive while preserving station battery-count log history for audit/read purposes.

## Telemetry ingestion and current-state API

The telemetry baseline stores raw device events, preserves short-window recent state rows, and upserts a map-ready bike current-state projection. Ingestion is authenticated and uses the registered `deviceUid`; the backend resolves the active bike-device installation at the event `receivedAt` timestamp. Operators and device integrations must not provide bike IDs or database IDs as user-entered input.

```bash
curl -X POST http://localhost:8080/api/v1/telemetry/device-events \
  -H "Authorization: Bearer <access-token>" \
  -H 'Content-Type: application/json' \
  -d '{"deviceUid":"DEV-SEOUL-001","vendorEventId":"evt-001","receivedAt":"2026-04-30T00:00:00Z","latitude":37.5010000,"longitude":127.0396000,"speedKph":12.3,"batteryPercent":76,"ignitionStatus":"ON","telemetrySource":"POLLING","rawPayload":{"vendor":"example"}}'
```

Duplicate vendor events return `ingestionStatus=IDEMPOTENT_REPLAY` without creating another raw/recent/current row; idempotency is enforced with database `ON CONFLICT DO NOTHING`. Out-of-order events are kept in raw/recent history but do not regress `bike_current_states`; the current-state projection uses a conditional PostgreSQL upsert and the response reports `STALE_TELEMETRY_IGNORED`. Unknown, disabled, or unassigned devices still produce raw/error evidence but do not create bike state.

Current-state reads expose calculated information derived from latest telemetry: `drivingStatus`, `connectionStatus`, and `batteryStatus`. Connection status uses a 10-minute freshness threshold and distinguishes an expected parked/offline bike from signal loss when ignition was still on.

```bash
curl http://localhost:8080/api/v1/telemetry/bike-current-states \
  -H "Authorization: Bearer <access-token>"

curl http://localhost:8080/api/v1/telemetry/bikes/<bike-id>/current-state \
  -H "Authorization: Bearer <access-token>"
```

## Dashboard map aggregate API

The dashboard map slice exposes a read-only, map-ready aggregate for the control screen. It combines current bike telemetry with active rider labels and battery station pin data. It omits rider phone numbers/raw rider IDs from the map response and does not accept user-entered IDs and does not perform writes. Future frontend selectors should display the returned human-readable labels such as plate number, rider name, and station name.

```bash
curl http://localhost:8080/api/v1/dashboard/map-state \
  -H "Authorization: Bearer <access-token>"
```

The response includes:

- `summary`: total active bikes, bike pins, connection/battery status counts, station counts, and available battery sum.
- `bikePins`: coordinate-ready bike/rider pins derived from `bike_current_states` and active rider-bike contracts.
- `stationPins`: coordinate-ready station pins with label format `name available/max`, for example `강남 스테이션 5/12`.

External map provider integration, frontend consumption, and telemetry retention remain separate issue scopes.

## Bike-device installation command API

The installation slice is the bike-device relationship source of truth. The UI should select bikes by plate/VIN and devices by device UID; the backend accepts only selector-produced UUID references and operator lifecycle fields, never raw ID text inputs from users.

```bash
curl -X POST http://localhost:8080/api/v1/bike-device-installations \
  -H "Authorization: Bearer <access-token>" \
  -H 'Content-Type: application/json' \
  -d '{"bikeId":"<selected-bike-id>","deviceId":"<selected-device-id>","installedAt":"2026-04-30T00:00:00Z","memo":"차량 단말 설치"}'
```

Installing closes any previous active row for the selected bike and/or selected device, then inserts the new active row in the same transaction. Disabled/deleted/missing devices and deleted/missing bikes are rejected. Removal preserves history by setting `removedAt`:

```bash
curl -X PATCH http://localhost:8080/api/v1/bike-device-installations/<installation-id>/remove \
  -H "Authorization: Bearer <access-token>" \
  -H 'Content-Type: application/json' \
  -d '{"removedAt":"2026-05-01T00:00:00Z","memo":"현장 탈거"}'
```

## Auth API

Login with a seeded/enabled admin user:

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"loginId":"<admin-login-id>","password":"<admin-password>"}'
```

Use the returned access token for protected read APIs:

```bash
curl http://localhost:8080/api/v1/riders \
  -H "Authorization: Bearer <access-token>"
```

Do not commit real JWT secrets or admin passwords.

## Commands

```bash
./gradlew test
./gradlew build
./gradlew bootRun
```

Tests use Testcontainers PostgreSQL when Docker is available. On Colima, Gradle sets `DOCKER_HOST` to `~/.colima/default/docker.sock` when that socket exists.

## Follow-up implementation issues

- Rider relationship assignment commands
- Refresh/revocation/password reset/RBAC expansion
- Frontend map integration
- External device API polling/sync-log implementation
- TimescaleDB hypertables, telemetry retention schedulers, and bulk archival jobs
- Contract overlap locking implementation
- Integrity scan implementation
