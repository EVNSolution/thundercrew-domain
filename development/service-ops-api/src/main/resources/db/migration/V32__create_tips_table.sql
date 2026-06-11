create table tips (
    id uuid primary key,
    idx bigserial not null unique,
    address text not null,
    content text not null,
    latitude double precision not null,
    longitude double precision not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    constraint ck_tips_latitude check (latitude >= -90 and latitude <= 90),
    constraint ck_tips_longitude check (longitude >= -180 and longitude <= 180)
);
