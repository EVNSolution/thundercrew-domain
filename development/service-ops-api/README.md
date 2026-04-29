# service-ops-api

Spring Boot operations API baseline for ThunderCrew domain management.

## Scope

This module currently provides the backend scaffold plus the non-telemetry core persistence baseline:

- Spring Boot 3.x / Java 21
- Gradle Kotlin DSL
- PostgreSQL + Flyway
- Spring Data JPA baseline
- Spring Security + BCrypt password hashing
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

Out of scope for the current persistence baseline:

- REST CRUD controllers/endpoints
- API request/response DTO contract layer
- computed business DTOs that depend on multi-table or time logic
- telemetry tables and ingestion write paths
- JWT login/refresh/revocation implementation
- frontend relocation
- TimescaleDB setup
- contract overlap locking implementation
- integrity scan/repair job

## Local environment

Copy placeholders and provide local secrets outside git:

```bash
cp .env.example .env.local
```

Required DB variables for local runtime:

```bash
SERVICE_OPS_DB_URL=jdbc:postgresql://localhost:5432/service_ops_api
SERVICE_OPS_DB_USERNAME=service_ops
SERVICE_OPS_DB_PASSWORD=<local-db-password>
```

Optional admin seed variables. If any required value is missing, seeding is skipped.

```bash
THUNDERCREW_ADMIN_SEED_LOGIN_ID=<admin-login-id>
THUNDERCREW_ADMIN_SEED_PASSWORD=<admin-password>
THUNDERCREW_ADMIN_SEED_DISPLAY_NAME=<admin-display-name>
THUNDERCREW_ADMIN_SEED_EMAIL=<admin-email>
```

Do not commit real passwords, JWT secrets, or service credentials.

## Commands

```bash
./gradlew test
./gradlew build
./gradlew bootRun
```

Tests use Testcontainers PostgreSQL when Docker is available. On Colima, Gradle sets `DOCKER_HOST` to `~/.colima/default/docker.sock` when that socket exists.

## Follow-up implementation issues

- CRUD service/controller for rider, bike, contract, insurance, equipment, device, and station slices
- JWT login/refresh/revocation
- Telemetry schema and raw/recent/current ingestion
- Dashboard/map read API
- Contract overlap locking implementation
- Integrity scan implementation
