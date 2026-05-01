# Spring Boot scaffold plan

## Target path

```text
development/service-ops-api/
```

This issue documents the plan only. Scaffold generation should happen in a follow-up
implementation issue/branch unless explicitly approved.

## Build/runtime stack

- Java 21
- Spring Boot 3.x
- Gradle; DSL choice still open
- Spring Web
- Spring Validation
- Spring Data JPA for CRUD domains
- JDBC batch/native SQL path for telemetry ingestion if volume requires it
- PostgreSQL Driver
- Flyway
- Spring Security
- JWT library to be selected during implementation
- Testcontainers for repository/integration tests where feasible
- ArchUnit for package dependency rules

## Package boundary draft

```text
com.thundercrew.opsapi
├── auth
├── rider
├── bike
├── contract
├── insurance
├── equipment
├── device
├── telemetry
├── station
├── dashboard
└── common
```

## Boundary enforcement

Package names alone are not enough. Implementation must add boundary checks.

Rules:

- Controllers call only their own package service/facade or an explicit cross-domain facade.
- Repositories are private to their bounded package.
- Direct repository import across bounded packages is forbidden.
- Cross-domain writes go through the owning package service/facade.
- DTO calculation helpers that are cross-domain neutral live in `common`; business rules stay in owner packages.
- Telemetry ingestion can remain in the same app, but its write path must be isolated behind `telemetry` services/adapters.
- Dashboard can read through package facades/read services, not direct arbitrary repositories.

Verification:

- Add ArchUnit tests for forbidden imports.
- Add service tests for no-FK compensation rules.
- Add repository/integration tests for DB check/partial unique constraints.

## Layer convention

Each bounded package may contain:

```text
controller
service
domain
repository
dto
```

`common` owns:

- audit base entity
- soft delete helpers
- exception handling
- API response/error model
- time/clock utilities
- neutral calculated-status helpers only when not domain-owned

## Flyway migration plan

Draft split:

- `V1__init_admin_and_common.sql`
- `V2__init_rider_bike_contract.sql`
- `V3__init_insurance_equipment_device.sql`
- `V4__init_telemetry_current_state.sql`
- `V5__seed_system_contract_template.sql`

Implementation may adjust split, but must keep these review gates:

- all active unique indexes are present
- all status check constraints are present
- all active installation/status-history partial unique indexes are present
- station count checks are present
- telemetry ingestion error evidence exists
- seed for `무제한 계약` is protected by service policy

## Telemetry implementation path

Minimum safe path:

1. Resolve device and active bike installation.
2. Insert raw telemetry idempotently.
3. Insert recent state if bike association exists.
4. Upsert current state only for newer telemetry.
5. Record telemetry processing failures in `telemetry_ingestion_error_logs` with redacted context and retryability.
6. Keep `device_api_sync_runs` / `device_api_sync_results` as the external-device API evidence boundary; real vendor polling/schedulers remain separate from the raw/recent/current telemetry baseline.

Fallback if TimescaleDB is unavailable:

- Use normal PostgreSQL table first.
- Add indexes matching query patterns.
- Add scheduled retention cleanup for recent states.
- Introduce native partitioning or TimescaleDB in a later performance issue.

## Implementation guardrails

- Do not expose UUID/FK text inputs directly in user-facing forms.
- API may accept selected resource IDs from UI selection results, but UI should present labels/search/idx/phone/plate/device UID.
- Validate cross-domain references in service layer.
- Keep DTO calculated information separate from DB stored data.
- Keep telemetry ingestion idempotent and retryable.
- Record any intentional partial failure/rebuild behavior in code comments and tests.
- Do not hardcode secrets in code, migrations, docs, or seed files.

## Review gates before coding

- Domain/DB draft reviewed by architect and critic.
- Critic REJECT items resolved or explicitly deferred.
- Open-question ledger acknowledged.
- Target issue updated with accepted scope.
- Implementation issue/branch created for scaffold work.
