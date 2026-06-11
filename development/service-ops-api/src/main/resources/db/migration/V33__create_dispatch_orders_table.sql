create table dispatch_orders (
    id uuid primary key,
    idx bigserial not null unique,
    bike_id uuid not null,
    customer_name text not null,
    customer_phone text not null,
    address text not null,
    latitude double precision not null,
    longitude double precision not null,
    sequence bigint not null,
    status varchar(20) not null,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    constraint ck_dispatch_orders_status check (status in ('ASSIGNED', 'COMPLETED')),
    constraint ck_dispatch_orders_latitude check (latitude >= -90 and latitude <= 90),
    constraint ck_dispatch_orders_longitude check (longitude >= -180 and longitude <= 180)
);
create index ix_dispatch_orders_bike_queue on dispatch_orders (bike_id, status, sequence) where deleted_at is null;
