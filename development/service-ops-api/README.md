# service-ops-api

Spring Boot operations API baseline for ThunderCrew domain management.

## Scope

This module currently provides the backend scaffold, non-telemetry core persistence baseline, read-only API/DTO contract baseline, admin JWT login/access-token baseline, and initial operation command slices:

- Spring Boot 3.x / Java 21
- Gradle Kotlin DSL
- PostgreSQL + Flyway
- Spring Data JPA baseline
- Spring Security + BCrypt password hashing + stateless Bearer JWT access tokens
- bounded package skeleton
- ArchUnit boundary tests
- common API error/audit/soft-delete/time baseline
- Flyway baseline for `admin_users`, `contract_templates`, and the system `무제한 계약` seed
- Flyway + JPA entity mappings for non-telemetry core operations:
  - riders
  - bikes and operation status history
  - rider-bike contracts
  - insurance items and rider-insurance links
  - equipment types and bike equipment
  - devices and bike-device installation history
  - battery stations and station count logs

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
- `POST /api/v1/auth/login` for admin access-token issuance
- Existing protected read APIs accept `Authorization: Bearer <token>`
- `AUTHENTICATION_FAILED` 401 JSON error contract for invalid/missing/expired tokens

Out of scope for the current backend baseline:

- Create/update/delete command endpoints and request DTOs outside delivered command slices
- computed business DTOs that depend on telemetry, dashboard, map, or multi-table/time logic
- telemetry tables and ingestion write paths
- refresh token, logout/revocation, password reset, RBAC expansion, or admin-management UI
- frontend relocation
- TimescaleDB setup
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

## Device registry command API

The device registry slice is limited to operator-managed registry fields. The server owns IDs, display sequence, audit columns, deleted state, installation relationships, and telemetry/system state. Clients should present human-readable device UID choices rather than asking operators to type raw database IDs.

```bash
curl -X POST http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer <access-token>" \
  -H 'Content-Type: application/json' \
  -d '{"deviceUid":"DEV-SEOUL-001","manufacturer":"ThunderDevice","modelName":"TD-100","enabled":true}'
```

Duplicate active device UIDs return `409 DUPLICATE_ACTIVE_RESOURCE`; soft-deleted UIDs may be reused. Device deletion is a soft delete and returns `409 INVALID_STATE_TRANSITION` when an active bike-device installation still references the device.

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

- Create/update/delete service/controller slices for insurance, equipment, and station resources
- Rider app-account link/unlink and rider relationship assignment commands
- Refresh/revocation/password reset/RBAC expansion
- Telemetry schema and raw/recent/current ingestion
- Dashboard/map read API
- Contract overlap locking implementation
- Integrity scan implementation
