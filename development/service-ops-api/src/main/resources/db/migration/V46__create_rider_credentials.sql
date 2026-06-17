create table rider_credentials (
    id uuid primary key,
    rider_id uuid not null unique,
    password_hash text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    created_by uuid,
    updated_by uuid
);
