create table device_telemetry_logs (
    id uuid primary key,
    idx bigserial not null unique,
    device_id uuid,
    device_uid varchar(100) not null,
    bike_id uuid,
    vendor_event_id varchar(200),
    payload_hash varchar(128) not null,
    received_at timestamptz not null,
    device_reported_at timestamptz,
    latitude numeric(10,7),
    longitude numeric(10,7),
    speed_kph numeric(8,2),
    battery_percent numeric(5,2),
    ignition_status varchar(20) not null,
    telemetry_source varchar(20) not null,
    raw_payload jsonb,
    created_at timestamptz not null default now(),
    constraint ck_device_telemetry_logs_latitude check (latitude is null or (latitude >= -90 and latitude <= 90)),
    constraint ck_device_telemetry_logs_longitude check (longitude is null or (longitude >= -180 and longitude <= 180)),
    constraint ck_device_telemetry_logs_speed check (speed_kph is null or speed_kph >= 0),
    constraint ck_device_telemetry_logs_battery check (battery_percent is null or (battery_percent >= 0 and battery_percent <= 100)),
    constraint ck_device_telemetry_logs_ignition check (ignition_status in ('UNKNOWN', 'ON', 'OFF')),
    constraint ck_device_telemetry_logs_source check (telemetry_source in ('POLLING', 'WEBHOOK'))
);

create unique index ux_device_telemetry_logs_vendor_event
    on device_telemetry_logs(device_uid, vendor_event_id)
    where vendor_event_id is not null;

create unique index ux_device_telemetry_logs_fallback_event
    on device_telemetry_logs(device_uid, received_at, telemetry_source, payload_hash)
    where vendor_event_id is null;

create index ix_device_telemetry_logs_device_received
    on device_telemetry_logs(device_uid, received_at desc);

create table bike_recent_states (
    id uuid primary key,
    idx bigserial not null unique,
    bike_id uuid not null,
    device_id uuid,
    telemetry_log_id uuid,
    received_at timestamptz not null,
    latitude numeric(10,7),
    longitude numeric(10,7),
    speed_kph numeric(8,2),
    battery_percent numeric(5,2),
    ignition_status varchar(20) not null,
    telemetry_source varchar(20) not null,
    created_at timestamptz not null default now(),
    constraint ck_bike_recent_states_latitude check (latitude is null or (latitude >= -90 and latitude <= 90)),
    constraint ck_bike_recent_states_longitude check (longitude is null or (longitude >= -180 and longitude <= 180)),
    constraint ck_bike_recent_states_speed check (speed_kph is null or speed_kph >= 0),
    constraint ck_bike_recent_states_battery check (battery_percent is null or (battery_percent >= 0 and battery_percent <= 100)),
    constraint ck_bike_recent_states_ignition check (ignition_status in ('UNKNOWN', 'ON', 'OFF')),
    constraint ck_bike_recent_states_source check (telemetry_source in ('POLLING', 'WEBHOOK'))
);

create index ix_bike_recent_states_bike_received
    on bike_recent_states(bike_id, received_at desc);

create index ix_bike_recent_states_cleanup
    on bike_recent_states(received_at);

create table bike_current_states (
    bike_id uuid primary key,
    device_id uuid,
    telemetry_log_id uuid,
    last_received_at timestamptz not null,
    latitude numeric(10,7),
    longitude numeric(10,7),
    speed_kph numeric(8,2),
    battery_percent numeric(5,2),
    ignition_status varchar(20) not null,
    telemetry_source varchar(20) not null,
    updated_at timestamptz not null default now(),
    constraint ck_bike_current_states_latitude check (latitude is null or (latitude >= -90 and latitude <= 90)),
    constraint ck_bike_current_states_longitude check (longitude is null or (longitude >= -180 and longitude <= 180)),
    constraint ck_bike_current_states_speed check (speed_kph is null or speed_kph >= 0),
    constraint ck_bike_current_states_battery check (battery_percent is null or (battery_percent >= 0 and battery_percent <= 100)),
    constraint ck_bike_current_states_ignition check (ignition_status in ('UNKNOWN', 'ON', 'OFF')),
    constraint ck_bike_current_states_source check (telemetry_source in ('POLLING', 'WEBHOOK'))
);

create index ix_bike_current_states_last_received
    on bike_current_states(last_received_at desc);

create table telemetry_ingestion_error_logs (
    id uuid primary key,
    idx bigserial not null unique,
    telemetry_log_id uuid,
    device_uid varchar(100),
    bike_id uuid,
    received_at timestamptz,
    ingestion_stage varchar(50) not null,
    retryable boolean not null default true,
    resolved_at timestamptz,
    error_code varchar(100) not null,
    error_message text,
    context_summary jsonb,
    created_at timestamptz not null default now(),
    constraint ck_telemetry_ingestion_error_logs_stage check (
        ingestion_stage in ('DEVICE_RESOLUTION', 'BIKE_ASSOCIATION', 'CURRENT_STATE')
    )
);

create index ix_telemetry_ingestion_errors_retryable
    on telemetry_ingestion_error_logs(retryable, created_at)
    where resolved_at is null;

create index ix_telemetry_ingestion_errors_device_received
    on telemetry_ingestion_error_logs(device_uid, received_at desc);
