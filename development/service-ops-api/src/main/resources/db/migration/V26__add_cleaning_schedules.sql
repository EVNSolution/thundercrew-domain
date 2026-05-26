create table cleaning_schedules (
    id           uuid primary key default gen_random_uuid(),
    bike_id      uuid not null,
    scheduled_at timestamp not null,
    address      varchar(255) not null,
    memo         varchar(500),
    created_at   timestamp not null,
    updated_at   timestamp not null,
    created_by   uuid,
    updated_by   uuid
);

create index ix_cleaning_schedules_bike_id
    on cleaning_schedules(bike_id);

create index ix_cleaning_schedules_scheduled_at
    on cleaning_schedules(scheduled_at);
