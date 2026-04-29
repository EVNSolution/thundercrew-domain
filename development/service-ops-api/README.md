# service-ops-api

Spring Boot operations API baseline for ThunderCrew domain management.

## Scope

This module currently provides the backend scaffold, non-telemetry core persistence baseline, read-only API/DTO contract baseline, and admin JWT login/access-token baseline:

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
- `POST /api/v1/auth/login` for admin access-token issuance
- Existing protected read APIs accept `Authorization: Bearer <token>`
- `AUTHENTICATION_FAILED` 401 JSON error contract for invalid/missing/expired tokens

Out of scope for the current auth/read API baseline:

- Create/update/delete command endpoints and request DTOs
- computed business DTOs that depend on telemetry, dashboard, map, or multi-table/time logic
- telemetry tables and ingestion write paths
- refresh token, logout/revocation, password reset, RBAC expansion, or admin-management UI
- frontend relocation
- TimescaleDB setup
- contract overlap locking implementation
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

- Create/update/delete service/controller slices for rider, bike, contract, insurance, equipment, device, and station resources
- Refresh/revocation/password reset/RBAC expansion
- Telemetry schema and raw/recent/current ingestion
- Dashboard/map read API
- Contract overlap locking implementation
- Integrity scan implementation
