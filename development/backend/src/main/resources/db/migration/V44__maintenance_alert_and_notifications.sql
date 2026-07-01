alter table maintenance_items add column alert_threshold_percent integer;

create table notifications (
    id uuid primary key,
    idx bigserial not null unique,
    type varchar(40) not null,
    title text not null,
    body text,
    ref_bike_id uuid,
    ref_entity_id uuid,
    ref_rider_id uuid,
    occurred_at timestamptz not null,
    acknowledged_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid, updated_by uuid, deleted_by uuid
);
create index idx_notifications_occurred_at on notifications (occurred_at desc);
create index idx_notifications_ack on notifications (acknowledged_at);
create index idx_notifications_bike_entity on notifications (ref_bike_id, ref_entity_id);
