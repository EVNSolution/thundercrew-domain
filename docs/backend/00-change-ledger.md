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
