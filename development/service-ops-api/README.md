# service-ops-api

Spring Boot scaffold baseline for ThunderCrew operations API.

## Scope

This module is intentionally narrow. It provides the backend scaffold only:

- Spring Boot 3.x / Java 21
- Gradle Kotlin DSL
- PostgreSQL + Flyway
- Spring Data JPA baseline
- Spring Security + BCrypt password hashing
- bounded package skeleton
- ArchUnit boundary smoke test
- common API error/audit/soft-delete/time baseline
- minimal Flyway baseline for `admin_users`, `contract_templates`, and the system `무제한 계약` seed

Out of scope for this scaffold issue:

- full domain CRUD
- telemetry ingestion
- JWT login/refresh/revocation implementation
- frontend relocation
- TimescaleDB setup
- contract overlap implementation

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

- Domain CRUD/schema beyond admin/template baseline
- JWT login/refresh/revocation
- Telemetry raw/recent/current ingestion
- Contract overlap locking implementation
- Integrity scan implementation
