create table admin_auth_sessions (
    id uuid primary key,
    idx bigserial not null unique,
    admin_user_id uuid not null,
    access_token_jti varchar(100) not null,
    access_token_expires_at timestamptz not null,
    refresh_token_hash varchar(128) not null,
    refresh_token_expires_at timestamptz not null,
    issued_at timestamptz not null,
    last_used_at timestamptz,
    revoked_at timestamptz,
    revoked_reason varchar(100),
    replaced_by_session_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index ux_admin_auth_sessions_refresh_hash_active
    on admin_auth_sessions(refresh_token_hash)
    where revoked_at is null;

create unique index ux_admin_auth_sessions_access_jti_active
    on admin_auth_sessions(access_token_jti)
    where revoked_at is null;

create index ix_admin_auth_sessions_admin_user
    on admin_auth_sessions(admin_user_id);

create index ix_admin_auth_sessions_refresh_expiry_active
    on admin_auth_sessions(refresh_token_expires_at)
    where revoked_at is null;
