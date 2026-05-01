create table device_api_sync_runs (
    id uuid primary key,
    idx bigserial not null unique,
    sync_type varchar(50) not null,
    status varchar(30) not null,
    external_trace_id varchar(200),
    requested_by_admin_id uuid,
    started_at timestamptz not null,
    finished_at timestamptz,
    total_count integer not null default 0,
    success_count integer not null default 0,
    failure_count integer not null default 0,
    request_summary jsonb,
    response_summary jsonb,
    error_code varchar(100),
    error_message text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint ck_device_api_sync_runs_type check (sync_type in ('POLLING', 'WEBHOOK_RECONCILIATION', 'MANUAL_AUDIT')),
    constraint ck_device_api_sync_runs_status check (status in ('RUNNING', 'SUCCESS', 'PARTIAL_FAILURE', 'FAILED')),
    constraint ck_device_api_sync_runs_finished_after_started check (finished_at is null or finished_at >= started_at),
    constraint ck_device_api_sync_runs_counts_nonnegative check (total_count >= 0 and success_count >= 0 and failure_count >= 0),
    constraint ck_device_api_sync_runs_counts_within_total check (success_count + failure_count <= total_count)
);

create index ix_device_api_sync_runs_status_started
    on device_api_sync_runs(status, started_at desc);

create index ix_device_api_sync_runs_external_trace
    on device_api_sync_runs(external_trace_id)
    where external_trace_id is not null;

create table device_api_sync_results (
    id uuid primary key,
    idx bigserial not null unique,
    run_id uuid not null,
    device_uid varchar(100) not null,
    device_id uuid,
    status varchar(30) not null,
    http_status integer,
    external_event_id varchar(200),
    request_summary jsonb,
    response_summary jsonb,
    error_code varchar(100),
    error_message text,
    created_at timestamptz not null default now(),
    constraint ck_device_api_sync_results_status check (
        status in ('SUCCESS', 'FAILED', 'DEVICE_UNKNOWN', 'DEVICE_DISABLED', 'SKIPPED')
    ),
    constraint ck_device_api_sync_results_http_status check (http_status is null or (http_status >= 100 and http_status <= 599))
);

create index ix_device_api_sync_results_run_idx
    on device_api_sync_results(run_id, idx asc);

create index ix_device_api_sync_results_device_uid
    on device_api_sync_results(device_uid, created_at desc);
