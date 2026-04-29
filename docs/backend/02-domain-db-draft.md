# Domain and DB draft

## 0. Design frame

### Stored data vs computed information

DB stores source data:

- admin-entered operation data
- timestamps
- coordinates
- speed
- battery percentage
- ignition status
- device identifiers
- battery station current counts
- raw telemetry payload summaries

API/DTO computes information:

- rider app link display state
- rider-bike connection state
- contract status
- equipment status
- driving status
- connection status
- battery status
- station availability label and capacity percentage

Important distinction:

- `bikes.operation_status` is stored because it is operator-entered operation data.
- `driving_status`, `connection_status`, and `battery_status` are not stored because they are derived from telemetry and time.

### Reference and FK policy

Default rule:

- Cross-domain references store UUID values without DB FK constraints.
- Same-table and local aggregate invariants use DB checks/partial unique indexes.
- Service layer validates reference existence and soft-delete eligibility before write.

Reference categories:

| Reference | Category | DB FK? | Required compensation |
|---|---|---:|---|
| audit `created_by/updated_by/deleted_by` → admin | cross-domain audit ref | No | actor existence best-effort; keep historical UUID even if admin is deleted |
| `rider_bike_contracts.rider_id` → rider | cross-domain business ref | No | service existence + active/not-deleted validation; integrity scan |
| `rider_bike_contracts.bike_id` → bike | cross-domain business ref | No | service existence + active/not-deleted validation; overlap validation |
| `rider_bike_contracts.contract_template_id` → template | same bounded area but separate aggregate | No in MVP | service validation; system template protected |
| `rider_insurances.rider_id` → rider | cross-domain business ref | No | service validation; duplicate active link partial unique |
| `rider_insurances.insurance_item_id` → insurance item | same bounded area | No in MVP | service validation |
| `bike_equipments.bike_id` → bike | cross-domain business ref | No | service validation; active equipment indexes |
| `bike_equipments.equipment_type_id` → equipment type | same bounded area | No in MVP | service validation |
| `bike_device_installations.bike_id` → bike | cross-domain business ref | No | service validation; active 1:1 partial unique |
| `bike_device_installations.device_id` → device | same device bounded area | No in MVP | service validation; active 1:1 partial unique |
| telemetry `device_id/bike_id` | historical observation ref | No | resolve at ingestion time; keep historical association |
| station log → station | same bounded area | No in MVP | service validation; append-only audit |

Soft-delete reference policy:

- New writes must not reference `deleted_at is not null` rows.
- Historical rows retain UUID references after the target is soft-deleted.
- List/detail APIs should render historical references as snapshot/unknown/deleted labels rather than hiding history.
- Regular integrity scan reports missing or deleted references for operational repair.

### Global table conventions

Major mutable business tables use:

- `id uuid primary key`
- `idx bigserial not null unique` or equivalent table-local sequence
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz null`
- `created_by uuid null`
- `updated_by uuid null`
- `deleted_by uuid null`

Unique policy:

- Human/business identifiers use active partial unique indexes with `WHERE deleted_at IS NULL`.
- This permits reuse after soft delete unless a table explicitly states otherwise.
- Historical references still use UUID, not display `idx`.

Timezone:

- Store timestamps as `timestamptz`.
- API/business calculation baseline is Asia/Seoul unless an implementation issue explicitly changes it.

## 1. Auth

### `admin_users`

- `id`, `idx`, audit columns
- `login_id varchar(100) not null`
- `email varchar(255) null`
- `password_hash varchar(255) not null`
- `display_name varchar(100) not null`
- `enabled boolean not null default true`
- `last_login_at timestamptz null`

Indexes/checks:

```sql
CREATE UNIQUE INDEX ux_admin_users_login_id_active
ON admin_users(login_id)
WHERE deleted_at IS NULL;
```

Policy:

- No role table in phase 1.
- JWT claim can include `adminUserId`, `loginId`, `role=ADMIN`.
- Password hashing must be BCrypt/Argon2 class; no plaintext or reversible encryption.
- Bootstrap admin secret must come from environment/ops secret, not committed seed data.

## 2. Rider

### `riders`

- `id`, `idx`, audit columns
- `name varchar(100) not null`
- `phone_number varchar(30) not null`
- `team_name varchar(100) null`
- `area_name varchar(100) null`
- `app_account_linked boolean not null default false`
- `app_account_id uuid null`
- `app_linked_at timestamptz null`
- `memo text null`

Indexes/checks:

```sql
CREATE UNIQUE INDEX ux_riders_phone_number_active
ON riders(phone_number)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_riders_app_account_id_active
ON riders(app_account_id)
WHERE app_account_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX ix_riders_team_area_active
ON riders(team_name, area_name)
WHERE deleted_at IS NULL;

ALTER TABLE riders ADD CONSTRAINT ck_riders_app_link_consistency CHECK (
  (app_account_linked = false AND app_account_id IS NULL AND app_linked_at IS NULL)
  OR
  (app_account_linked = true AND app_account_id IS NOT NULL AND app_linked_at IS NOT NULL)
);
```

Computed DTO information:

- `appLinkStatus`: `LINKED` / `NOT_LINKED`.
- `bikeConnectionStatus`: from active contract query.

No rider status enum is stored.

## 3. Bike

### `bikes`

- `id`, `idx`, audit columns
- `plate_number varchar(50) not null`
- `vin varchar(100) not null`
- `model_name varchar(100) null`
- `operation_status varchar(40) not null`
- `memo text null`

Allowed `operation_status` values:

- `READY`
- `IN_SERVICE`
- `REPAIRING`
- `INSPECTION_REQUIRED`

Indexes/checks:

```sql
ALTER TABLE bikes ADD CONSTRAINT ck_bikes_operation_status
CHECK (operation_status IN ('READY', 'IN_SERVICE', 'REPAIRING', 'INSPECTION_REQUIRED'));

CREATE UNIQUE INDEX ux_bikes_plate_number_active
ON bikes(plate_number)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_bikes_vin_active
ON bikes(vin)
WHERE deleted_at IS NULL;

CREATE INDEX ix_bikes_operation_status_active
ON bikes(operation_status)
WHERE deleted_at IS NULL;
```

### `bike_operation_status_histories`

- `id`, `idx`, audit columns
- `bike_id uuid not null`
- `operation_status varchar(40) not null`
- `started_at timestamptz not null`
- `ended_at timestamptz null`
- `reason text null`
- `memo text null`
- `changed_by uuid null`

Invariant:

- Service closes previous open history row before opening a new one.
- DB enforces at most one open status history per bike.

```sql
CREATE UNIQUE INDEX ux_bike_operation_status_histories_open_bike
ON bike_operation_status_histories(bike_id)
WHERE ended_at IS NULL AND deleted_at IS NULL;

CREATE INDEX ix_bike_operation_status_histories_bike_started
ON bike_operation_status_histories(bike_id, started_at DESC)
WHERE deleted_at IS NULL;
```

## 4. Contract

### `contract_templates`

- `id`, `idx`, audit columns
- `name varchar(100) not null`
- `duration_minutes integer null`
- `description text null`
- `enabled boolean not null default true`
- `system_template boolean not null default false`

Seed:

- `무제한 계약`
- `duration_minutes = null`
- `system_template = true`

Rules:

- `duration_minutes IS NULL` is the single source for unlimited/open-ended template.
- `system_template = true` rows cannot be deleted or core-edited by normal admin APIs.
- Name is active-unique.

```sql
ALTER TABLE contract_templates ADD CONSTRAINT ck_contract_templates_duration
CHECK (duration_minutes IS NULL OR duration_minutes > 0);

CREATE UNIQUE INDEX ux_contract_templates_name_active
ON contract_templates(name)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX ux_contract_templates_single_system_default
ON contract_templates(system_template)
WHERE system_template = true AND deleted_at IS NULL;
```

### `rider_bike_contracts`

- `id`, `idx`, audit columns
- `rider_id uuid not null`
- `bike_id uuid not null`
- `contract_template_id uuid not null`
- `start_at timestamptz not null`
- `end_at timestamptz null`
- `terminated_at timestamptz null`
- `terminated_reason text null`
- `memo text null`

Computed status:

| Status | Rule |
|---|---|
| `TERMINATED` | `terminated_at` exists |
| `SCHEDULED` | not terminated and `now < start_at` |
| `ACTIVE` | not terminated and `start_at <= now` and (`end_at is null` or `now < end_at`) |
| `EXPIRED` | not terminated and `end_at is not null` and `now >= end_at` |

Checks/indexes:

```sql
ALTER TABLE rider_bike_contracts ADD CONSTRAINT ck_contracts_end_after_start
CHECK (end_at IS NULL OR end_at > start_at);

ALTER TABLE rider_bike_contracts ADD CONSTRAINT ck_contracts_terminated_after_start
CHECK (terminated_at IS NULL OR terminated_at >= start_at);

CREATE INDEX ix_contracts_rider_period_active
ON rider_bike_contracts(rider_id, start_at, end_at)
WHERE deleted_at IS NULL;

CREATE INDEX ix_contracts_bike_period_active
ON rider_bike_contracts(bike_id, start_at, end_at)
WHERE deleted_at IS NULL;
```

Overlap invariant:

- Same rider cannot have overlapping non-deleted, non-terminated scheduled/active intervals.
- Same bike cannot have overlapping non-deleted, non-terminated scheduled/active intervals.
- Service layer must validate overlap inside a transaction.
- Implementation should use transaction + lock strategy; if PostgreSQL exclusion constraints are adopted later, document why they do not violate the no cross-domain FK policy.

## 5. Insurance

### `insurance_items`

- `id`, `idx`, audit columns
- `name varchar(100) not null`
- `description text null`
- `enabled boolean not null default true`

```sql
CREATE UNIQUE INDEX ux_insurance_items_name_active
ON insurance_items(name)
WHERE deleted_at IS NULL;
```

### `rider_insurances`

- `id`, `idx`, audit columns
- `rider_id uuid not null`
- `insurance_item_id uuid not null`
- `memo text null`
- `enabled boolean not null default true`

```sql
CREATE UNIQUE INDEX ux_rider_insurances_active_pair
ON rider_insurances(rider_id, insurance_item_id)
WHERE deleted_at IS NULL;

CREATE INDEX ix_rider_insurances_item_active
ON rider_insurances(insurance_item_id)
WHERE deleted_at IS NULL;
```

Phase 1 excludes period, policy number, provider details, claim, and expiration.

## 6. Equipment

### `equipment_types`

- `id`, `idx`, audit columns
- `name varchar(100) not null`
- `description text null`
- `enabled boolean not null default true`

```sql
CREATE UNIQUE INDEX ux_equipment_types_name_active
ON equipment_types(name)
WHERE deleted_at IS NULL;
```

### `bike_equipments`

- `id`, `idx`, audit columns
- `bike_id uuid not null`
- `equipment_type_id uuid not null`
- `equipment_label varchar(100) null`
- `model_name varchar(100) null`
- `serial_number varchar(100) null`
- `installed_at timestamptz not null`
- `removed_at timestamptz null`
- `management_due_date date not null`
- `management_note text null`
- `memo text null`

```sql
ALTER TABLE bike_equipments ADD CONSTRAINT ck_bike_equipments_removed_after_install
CHECK (removed_at IS NULL OR removed_at >= installed_at);

CREATE INDEX ix_bike_equipments_bike_active
ON bike_equipments(bike_id)
WHERE removed_at IS NULL AND deleted_at IS NULL;

CREATE INDEX ix_bike_equipments_due_active
ON bike_equipments(management_due_date)
WHERE removed_at IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX ux_bike_equipments_serial_active
ON bike_equipments(serial_number)
WHERE serial_number IS NOT NULL AND removed_at IS NULL AND deleted_at IS NULL;
```

Computed equipment status, Asia/Seoul local date:

- `OVERDUE`: `management_due_date < today`
- `DUE_SOON`: `today <= management_due_date <= today + 7 days`
- `NORMAL`: otherwise

No active unique constraint on `(bike_id, equipment_type_id)` in phase 1 because one bike may have multiple objects of the same equipment type.

## 7. Device

### `devices`

- `id`, `idx`, audit columns
- `device_uid varchar(100) not null`
- `manufacturer varchar(100) null`
- `model_name varchar(100) null`
- `enabled boolean not null default true`
- `memo text null`

```sql
CREATE UNIQUE INDEX ux_devices_device_uid_active
ON devices(device_uid)
WHERE deleted_at IS NULL;
```

Policy:

- `devices` does not store `bike_id`; current installation is derived from `bike_device_installations`.
- Reinstalling the same device later is allowed after the previous active installation is closed.

### `bike_device_installations`

- `id`, `idx`, audit columns
- `bike_id uuid not null`
- `device_id uuid not null`
- `installed_at timestamptz not null`
- `removed_at timestamptz null`
- `memo text null`

```sql
ALTER TABLE bike_device_installations ADD CONSTRAINT ck_device_install_removed_after_install
CHECK (removed_at IS NULL OR removed_at >= installed_at);

CREATE UNIQUE INDEX ux_bike_device_installations_active_bike
ON bike_device_installations(bike_id)
WHERE removed_at IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX ux_bike_device_installations_active_device
ON bike_device_installations(device_id)
WHERE removed_at IS NULL AND deleted_at IS NULL;

CREATE INDEX ix_bike_device_installations_bike_history
ON bike_device_installations(bike_id, installed_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX ix_bike_device_installations_device_history
ON bike_device_installations(device_id, installed_at DESC)
WHERE deleted_at IS NULL;
```

API transaction rule:

- Install/replace closes existing active row first, then inserts the new row in the same transaction.
- Service validates both bike and device are active/not deleted.

## 8. Telemetry

### `device_telemetry_logs`

Raw time-series log; TimescaleDB hypertable candidate.

- `id uuid not null`
- `idx bigserial`
- `device_id uuid null`
- `device_uid varchar(100) not null`
- `bike_id uuid null`
- `vendor_event_id varchar(200) null`
- `payload_hash varchar(128) null`
- `received_at timestamptz not null`
- `device_reported_at timestamptz null`
- `latitude numeric(10,7) null`
- `longitude numeric(10,7) null`
- `speed_kph numeric(8,2) null`
- `battery_percent numeric(5,2) null`
- `ignition_status varchar(20) not null`
- `telemetry_source varchar(20) not null`
- `raw_payload jsonb null`
- `created_at timestamptz not null`

No `driving_status`, `connection_status`, or `battery_status` stored.

Checks:

```sql
CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
CHECK (battery_percent IS NULL OR (battery_percent >= 0 AND battery_percent <= 100));
CHECK (ignition_status IN ('UNKNOWN', 'ON', 'OFF'));
CHECK (telemetry_source IN ('POLLING', 'WEBHOOK'));
```

Idempotency:

- Preferred key: `device_uid + vendor_event_id` when vendor event ID exists.
- Fallback key: `device_uid + received_at + telemetry_source + payload_hash`.
- TimescaleDB implementation must ensure unique indexes include the time partition column if required.

### `bike_recent_states`

Recent normalized state history retained for about 7 days.

- `id`, `idx`
- `bike_id uuid not null`
- `device_id uuid null`
- `telemetry_log_id uuid null`
- `received_at timestamptz not null`
- `latitude numeric(10,7) null`
- `longitude numeric(10,7) null`
- `speed_kph numeric(8,2) null`
- `battery_percent numeric(5,2) null`
- `ignition_status varchar(20) not null`
- `telemetry_source varchar(20) not null`
- `created_at timestamptz not null`

Indexes:

```sql
CREATE INDEX ix_bike_recent_states_bike_received
ON bike_recent_states(bike_id, received_at DESC);

CREATE INDEX ix_bike_recent_states_cleanup
ON bike_recent_states(received_at);
```

Retention:

- Keep short operational window, default 7 days.
- Purge by scheduled job.
- If scheduler fails, cleanup can be rerun idempotently.

### `bike_current_states`

Latest cache for map/dashboard. Bike has at most one row.

- `bike_id uuid not null primary key`
- `device_id uuid null`
- `telemetry_log_id uuid null`
- `last_received_at timestamptz not null`
- `latitude numeric(10,7) null`
- `longitude numeric(10,7) null`
- `speed_kph numeric(8,2) null`
- `battery_percent numeric(5,2) null`
- `ignition_status varchar(20) not null`
- `telemetry_source varchar(20) not null`
- `updated_at timestamptz not null`

Update rule:

- Upsert only when `incoming.received_at > current.last_received_at`.
- Out-of-order telemetry remains in raw/recent history but does not replace current state.
- Current state is rebuildable from recent/raw logs if needed.

### Telemetry write path

1. Resolve `device_uid` to active device.
2. Resolve active bike installation at the telemetry time where possible.
3. Insert raw `device_telemetry_logs` with idempotency protection.
4. Insert normalized `bike_recent_states` when bike association exists.
5. Upsert `bike_current_states` only if newer than current state.
6. Record failure in `device_api_sync_logs` or ingestion error log if any downstream step fails.

Failure policy:

- Raw log is the primary durable input.
- Recent/current can be rebuilt from raw log and installation history.
- Partial failures must be retryable by idempotency key.
- If TimescaleDB is unavailable, start with PostgreSQL native partitioning/indexes and keep the same logical model.

Computed DTO information:

| Value | Rule |
|---|---|
| `driving_status = UNKNOWN` | `ignition_status = UNKNOWN` |
| `driving_status = PARKED` | `ignition_status = OFF` |
| `driving_status = DRIVING` | `ignition_status = ON` and `speed_kph >= 3` |
| `driving_status = STOPPED` | `ignition_status = ON` and `speed_kph < 3` |
| `connection_status = ONLINE` | `now - last_received_at <= 10 minutes` |
| `connection_status = SIGNAL_LOST` | stale over 10 minutes and `ignition_status = ON` |
| `connection_status = PARKED_OFFLINE_NORMAL` | stale over 10 minutes and `ignition_status = OFF` |
| `connection_status = STALE_UNKNOWN` | stale over 10 minutes and `ignition_status = UNKNOWN` |
| `battery_status = UNKNOWN` | battery is null |
| `battery_status = CRITICAL` | battery < 20 |
| `battery_status = LOW` | battery >= 20 and battery < 50 |
| `battery_status = NORMAL` | battery >= 50 |

### `device_api_sync_logs`

External device API polling/webhook request-response evidence. This is for API call/sync trace,
not for every normalized telemetry processing failure.

- `id`, `idx`
- `device_id uuid null`
- `device_uid varchar(100) null`
- `sync_type varchar(50) not null`
- `request_started_at timestamptz not null`
- `request_finished_at timestamptz null`
- `success boolean not null`
- `http_status integer null`
- `external_trace_id varchar(200) null`
- `error_code varchar(100) null`
- `error_message text null`
- `request_summary jsonb null`
- `response_summary jsonb null`
- `created_at timestamptz not null`

Payload policy:

- Store summaries/redacted payload only.
- Never store credentials or full secret-bearing payloads.

### `telemetry_ingestion_error_logs`

Telemetry processing failure evidence for retry/repair. This table records failures after or
around raw ingest, especially when recent/current state updates fail or telemetry cannot be
associated with a valid bike/device.

- `id`, `idx`
- `telemetry_log_id uuid null`
- `device_uid varchar(100) null`
- `bike_id uuid null`
- `received_at timestamptz null`
- `ingestion_stage varchar(50) not null`
- `retryable boolean not null default true`
- `resolved_at timestamptz null`
- `error_code varchar(100) not null`
- `error_message text null`
- `context_summary jsonb null`
- `created_at timestamptz not null`

Rules:

- Store redacted context only.
- Retry jobs use idempotency keys from raw telemetry; retries must not duplicate raw/recent/current rows.
- If the error is caused by missing device/bike installation, resolution can be manual data repair plus replay.

## 9. Battery station

### `battery_stations`

- `id`, `idx`, audit columns
- `name varchar(100) not null`
- `address varchar(255) not null`
- `latitude numeric(10,7) not null`
- `longitude numeric(10,7) not null`
- `status varchar(30) not null`
- `max_battery_capacity integer not null`
- `current_battery_count integer not null`
- `available_battery_count integer not null`
- `memo text null`

Policy:

- `current_battery_count` and `available_battery_count` are operator-maintained stored data.
- Change logs are audit, not the source of truth.
- API computes `isAvailable` and `capacityUsagePercent`.

Checks/indexes:

```sql
CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'INACTIVE'));
CHECK (latitude >= -90 AND latitude <= 90);
CHECK (longitude >= -180 AND longitude <= 180);
CHECK (max_battery_capacity >= 0);
CHECK (current_battery_count >= 0);
CHECK (available_battery_count >= 0);
CHECK (current_battery_count <= max_battery_capacity);
CHECK (available_battery_count <= current_battery_count);

CREATE UNIQUE INDEX ux_battery_stations_name_active
ON battery_stations(name)
WHERE deleted_at IS NULL;

CREATE INDEX ix_battery_stations_location_active
ON battery_stations(latitude, longitude)
WHERE deleted_at IS NULL;
```

### `station_battery_count_logs`

- `id`, `idx`, audit columns
- `station_id uuid not null`
- `before_max_battery_capacity integer not null`
- `after_max_battery_capacity integer not null`
- `before_current_battery_count integer not null`
- `after_current_battery_count integer not null`
- `before_available_battery_count integer not null`
- `after_available_battery_count integer not null`
- `reason varchar(100) null`
- `memo text null`
- `changed_at timestamptz not null`
- `changed_by uuid null`

```sql
CREATE INDEX ix_station_battery_count_logs_station_changed
ON station_battery_count_logs(station_id, changed_at DESC);
```

## 10. Invariant matrix

| Area | Invariant | DB control | Service/test control |
|---|---|---|---|
| Common | `idx` table-local display sequence only | unique sequence | never accept user-supplied `idx` as identity |
| Soft delete unique | active phone/plate/vin/device_uid/name unique | partial unique indexes | restore/reuse behavior tests |
| Rider app link | linked fields consistent | check constraint | link/unlink service tests |
| Bike status | one open status row per bike | partial unique open-row index | status-change transaction tests |
| Contract | no rider interval overlap | indexes for lookup | transaction + overlap validation tests |
| Contract | no bike interval overlap | indexes for lookup | transaction + overlap validation tests |
| Insurance | no duplicate active rider-insurance pair | partial unique pair | service validation |
| Equipment | removed after installed | check constraint | install/remove tests |
| Device install | one active device per bike | partial unique active bike | replace transaction test |
| Device install | one active bike per device | partial unique active device | replace transaction test |
| Telemetry | duplicate event ignored/retried safely | unique/idempotency index | ingestion idempotency tests |
| Telemetry | current state only moves forward | bike PK/unique | newer-only upsert tests |
| Telemetry | processing failure is replayable | ingestion error log | retry/rebuild tests |
| Station | count bounds | check constraints | update transaction/log tests |

## 11. Integrity scan and error contract

Because cross-domain FK is intentionally avoided, the backend must include an integrity check path before production hardening.

Minimum integrity scan targets:

- contracts referencing missing/deleted rider, bike, or template
- rider insurance links referencing missing/deleted rider or insurance item
- bike equipment referencing missing/deleted bike or equipment type
- device installation referencing missing/deleted bike or device
- telemetry current/recent states referencing missing bike/device
- station logs referencing missing/deleted station

Minimum API error categories:

- `REFERENCE_NOT_FOUND`
- `REFERENCE_DELETED`
- `DUPLICATE_ACTIVE_RELATION`
- `PERIOD_OVERLAP`
- `INVALID_STATE_TRANSITION`
- `STALE_TELEMETRY_IGNORED`
- `IDEMPOTENT_REPLAY`
