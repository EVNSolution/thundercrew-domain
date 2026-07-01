# Backend review integration notes

## Review participants

- `Copernicus` / architect: PRD and scope review.
- `Confucius` / architect: domain and DB table draft review.
- `Laplace` / critic: risk and contradiction review.

## Main review conclusions

### Accepted

- Start with modular monolith `development/backend`.
- Keep future MSA separation possible through data ownership and package boundaries.
- Use UUID PK plus table-local `idx` display sequence.
- Avoid direct user-entered IDs/FKs in UI.
- Contract is the rider-bike relationship source of truth.
- Device installation history is the device-bike relationship source of truth.
- Raw/recent/current telemetry split is directionally correct.
- Station count current values plus audit logs are acceptable if current values are declared source data.

### Rejected until fixed

The critic rejected the initial docs before commit for these reasons:

1. No-FK strategy lacked concrete compensation.
2. Telemetry raw/recent/current write path lacked idempotency and out-of-order rules.
3. Core invariants were partly deferred to implementation.
4. `service-ops-api` boundary enforcement was too weak for a broad modular monolith.

## Integrated fixes

| Review issue | Fix |
|---|---|
| No-FK compensation unclear | Added reference/FK policy, soft-delete reference policy, integrity scan, and error categories in `02-domain-db-draft.md`. |
| Telemetry write path risky | Added idempotency keys, raw-first rule, current newer-only upsert, rebuild/retry policy, and Timescale fallback. |
| Invariants too implicit | Added invariant matrix with DB and service/test controls. |
| `service-ops-api` too broad | Added package boundary, facade, no cross-repository import, and ArchUnit test plan in `03-scaffold-plan.md`. |
| Existing Supabase schema transition missing | Added transition policy in `00-change-ledger.md`. |
| Stored data vs computed information blurry | Added explicit data/information split in `01-prd-scope.md` and `02-domain-db-draft.md`. |

## Remaining implementation gate

The design branch can be reviewed/merged as a backend design artifact. Spring Boot scaffold should wait until the open questions marked “Must resolve before scaffold implementation” are answered or explicitly accepted as implementation-time decisions.
