create table reignition_notifications (
    id uuid primary key,
    idx bigserial not null unique,
    bike_id uuid not null,
    plate_number text not null,
    occurred_at timestamptz not null,
    next_customer_name text,
    next_address text,
    next_latitude double precision,
    next_longitude double precision,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);
create index idx_reignition_notifications_occurred_at on reignition_notifications (occurred_at desc);
