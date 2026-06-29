create table otoplug_observers (
    id uuid primary key,
    idx bigserial not null unique,
    api varchar(100) not null,
    observer_id varchar(100) not null,
    channel_token varchar(200) not null,
    callback_url text not null,
    registered_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);
create unique index ux_otoplug_observers_active_api on otoplug_observers(api);
