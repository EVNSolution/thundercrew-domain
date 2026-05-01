create table riders (
    id uuid primary key,
    idx bigserial not null unique,
    name varchar(100) not null,
    phone_number varchar(30) not null,
    team_name varchar(100),
    area_name varchar(100),
    app_account_linked boolean not null default false,
    app_account_id uuid,
    app_linked_at timestamptz,
    memo text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    constraint ck_riders_app_link_consistency check (
        (app_account_linked = false and app_account_id is null and app_linked_at is null)
        or
        (app_account_linked = true and app_account_id is not null and app_linked_at is not null)
    )
);

create unique index ux_riders_phone_number_active
    on riders(phone_number)
    where deleted_at is null;

create unique index ux_riders_app_account_id_active
    on riders(app_account_id)
    where app_account_id is not null and deleted_at is null;

create index ix_riders_team_area_active
    on riders(team_name, area_name)
    where deleted_at is null;

create table bikes (
    id uuid primary key,
    idx bigserial not null unique,
    plate_number varchar(50) not null,
    vin varchar(100) not null,
    model_name varchar(100),
    operation_status varchar(40) not null,
    memo text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    constraint ck_bikes_operation_status check (
        operation_status in ('READY', 'IN_SERVICE', 'REPAIRING', 'INSPECTION_REQUIRED')
    )
);

create unique index ux_bikes_plate_number_active
    on bikes(plate_number)
    where deleted_at is null;

create unique index ux_bikes_vin_active
    on bikes(vin)
    where deleted_at is null;

create index ix_bikes_operation_status_active
    on bikes(operation_status)
    where deleted_at is null;

create table bike_operation_status_histories (
    id uuid primary key,
    idx bigserial not null unique,
    bike_id uuid not null,
    operation_status varchar(40) not null,
    started_at timestamptz not null,
    ended_at timestamptz,
    reason text,
    memo text,
    changed_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    constraint ck_bike_status_histories_operation_status check (
        operation_status in ('READY', 'IN_SERVICE', 'REPAIRING', 'INSPECTION_REQUIRED')
    ),
    constraint ck_bike_status_histories_ended_after_started check (
        ended_at is null or ended_at >= started_at
    )
);

create unique index ux_bike_operation_status_histories_open_bike
    on bike_operation_status_histories(bike_id)
    where ended_at is null and deleted_at is null;

create index ix_bike_operation_status_histories_bike_started
    on bike_operation_status_histories(bike_id, started_at desc)
    where deleted_at is null;

create table rider_bike_contracts (
    id uuid primary key,
    idx bigserial not null unique,
    rider_id uuid not null,
    bike_id uuid not null,
    contract_template_id uuid not null,
    start_at timestamptz not null,
    end_at timestamptz,
    terminated_at timestamptz,
    terminated_reason text,
    memo text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    constraint ck_contracts_end_after_start check (end_at is null or end_at > start_at),
    constraint ck_contracts_terminated_after_start check (terminated_at is null or terminated_at >= start_at)
);

create index ix_contracts_rider_period_active
    on rider_bike_contracts(rider_id, start_at, end_at)
    where deleted_at is null;

create index ix_contracts_bike_period_active
    on rider_bike_contracts(bike_id, start_at, end_at)
    where deleted_at is null;

create table insurance_items (
    id uuid primary key,
    idx bigserial not null unique,
    name varchar(100) not null,
    description text,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

create unique index ux_insurance_items_name_active
    on insurance_items(name)
    where deleted_at is null;

create table rider_insurances (
    id uuid primary key,
    idx bigserial not null unique,
    rider_id uuid not null,
    insurance_item_id uuid not null,
    memo text,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

create unique index ux_rider_insurances_active_pair
    on rider_insurances(rider_id, insurance_item_id)
    where deleted_at is null;

create index ix_rider_insurances_item_active
    on rider_insurances(insurance_item_id)
    where deleted_at is null;

create table equipment_types (
    id uuid primary key,
    idx bigserial not null unique,
    name varchar(100) not null,
    description text,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

create unique index ux_equipment_types_name_active
    on equipment_types(name)
    where deleted_at is null;

create table bike_equipments (
    id uuid primary key,
    idx bigserial not null unique,
    bike_id uuid not null,
    equipment_type_id uuid not null,
    equipment_label varchar(100),
    model_name varchar(100),
    serial_number varchar(100),
    installed_at timestamptz not null,
    removed_at timestamptz,
    management_due_date date not null,
    management_note text,
    memo text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    constraint ck_bike_equipments_removed_after_install check (removed_at is null or removed_at >= installed_at)
);

create index ix_bike_equipments_bike_active
    on bike_equipments(bike_id)
    where removed_at is null and deleted_at is null;

create index ix_bike_equipments_due_active
    on bike_equipments(management_due_date)
    where removed_at is null and deleted_at is null;

create unique index ux_bike_equipments_serial_active
    on bike_equipments(serial_number)
    where serial_number is not null and removed_at is null and deleted_at is null;

create table devices (
    id uuid primary key,
    idx bigserial not null unique,
    device_uid varchar(100) not null,
    manufacturer varchar(100),
    model_name varchar(100),
    enabled boolean not null default true,
    memo text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

create unique index ux_devices_device_uid_active
    on devices(device_uid)
    where deleted_at is null;

create table bike_device_installations (
    id uuid primary key,
    idx bigserial not null unique,
    bike_id uuid not null,
    device_id uuid not null,
    installed_at timestamptz not null,
    removed_at timestamptz,
    memo text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    constraint ck_device_install_removed_after_install check (removed_at is null or removed_at >= installed_at)
);

create unique index ux_bike_device_installations_active_bike
    on bike_device_installations(bike_id)
    where removed_at is null and deleted_at is null;

create unique index ux_bike_device_installations_active_device
    on bike_device_installations(device_id)
    where removed_at is null and deleted_at is null;

create index ix_bike_device_installations_bike_history
    on bike_device_installations(bike_id, installed_at desc)
    where deleted_at is null;

create index ix_bike_device_installations_device_history
    on bike_device_installations(device_id, installed_at desc)
    where deleted_at is null;

create table battery_stations (
    id uuid primary key,
    idx bigserial not null unique,
    name varchar(100) not null,
    address varchar(255) not null,
    latitude numeric(10,7) not null,
    longitude numeric(10,7) not null,
    status varchar(30) not null,
    max_battery_capacity integer not null,
    current_battery_count integer not null,
    available_battery_count integer not null,
    memo text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    constraint ck_battery_stations_status check (status in ('ACTIVE', 'MAINTENANCE', 'INACTIVE')),
    constraint ck_battery_stations_latitude check (latitude >= -90 and latitude <= 90),
    constraint ck_battery_stations_longitude check (longitude >= -180 and longitude <= 180),
    constraint ck_battery_stations_max_capacity check (max_battery_capacity >= 0),
    constraint ck_battery_stations_current_count check (current_battery_count >= 0),
    constraint ck_battery_stations_available_count check (available_battery_count >= 0),
    constraint ck_battery_stations_current_within_max check (current_battery_count <= max_battery_capacity),
    constraint ck_battery_stations_available_within_current check (available_battery_count <= current_battery_count)
);

create unique index ux_battery_stations_name_active
    on battery_stations(name)
    where deleted_at is null;

create index ix_battery_stations_location_active
    on battery_stations(latitude, longitude)
    where deleted_at is null;

create table station_battery_count_logs (
    id uuid primary key,
    idx bigserial not null unique,
    station_id uuid not null,
    before_max_battery_capacity integer not null,
    after_max_battery_capacity integer not null,
    before_current_battery_count integer not null,
    after_current_battery_count integer not null,
    before_available_battery_count integer not null,
    after_available_battery_count integer not null,
    reason varchar(100),
    memo text,
    changed_at timestamptz not null,
    changed_by uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    constraint ck_station_count_logs_before_max_nonnegative check (before_max_battery_capacity >= 0),
    constraint ck_station_count_logs_after_max_nonnegative check (after_max_battery_capacity >= 0),
    constraint ck_station_count_logs_before_current_nonnegative check (before_current_battery_count >= 0),
    constraint ck_station_count_logs_after_current_nonnegative check (after_current_battery_count >= 0),
    constraint ck_station_count_logs_before_available_nonnegative check (before_available_battery_count >= 0),
    constraint ck_station_count_logs_after_available_nonnegative check (after_available_battery_count >= 0),
    constraint ck_station_count_logs_before_current_within_max check (before_current_battery_count <= before_max_battery_capacity),
    constraint ck_station_count_logs_after_current_within_max check (after_current_battery_count <= after_max_battery_capacity),
    constraint ck_station_count_logs_before_available_within_current check (before_available_battery_count <= before_current_battery_count),
    constraint ck_station_count_logs_after_available_within_current check (after_available_battery_count <= after_current_battery_count)
);

create index ix_station_battery_count_logs_station_changed
    on station_battery_count_logs(station_id, changed_at desc);
