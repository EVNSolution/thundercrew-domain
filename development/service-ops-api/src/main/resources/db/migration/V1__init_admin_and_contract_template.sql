create table admin_users (
    id uuid primary key,
    idx bigserial not null unique,
    login_id varchar(100) not null,
    email varchar(255),
    password_hash varchar(255) not null,
    display_name varchar(100) not null,
    enabled boolean not null default true,
    last_login_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);

create unique index ux_admin_users_login_id_active
    on admin_users(login_id)
    where deleted_at is null;

create unique index ux_admin_users_email_active
    on admin_users(email)
    where email is not null and deleted_at is null;

create table contract_templates (
    id uuid primary key,
    idx bigserial not null unique,
    name varchar(100) not null,
    duration_minutes integer,
    description text,
    enabled boolean not null default true,
    system_template boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    constraint ck_contract_templates_duration_minutes
        check (duration_minutes is null or duration_minutes > 0)
);

create unique index ux_contract_templates_name_active
    on contract_templates(name)
    where deleted_at is null;

create unique index ux_contract_templates_single_system_template
    on contract_templates(system_template)
    where system_template = true and deleted_at is null;

update contract_templates
set system_template = false,
    updated_at = now()
where system_template = true
  and deleted_at is null
  and name <> '무제한 계약';

insert into contract_templates (
    id,
    name,
    duration_minutes,
    description,
    enabled,
    system_template,
    created_at,
    updated_at
) values (
    '00000000-0000-0000-0000-000000000001',
    '무제한 계약',
    null,
    'System protected open-ended contract template.',
    true,
    true,
    now(),
    now()
)
on conflict (name) where deleted_at is null do update
set duration_minutes = excluded.duration_minutes,
    description = excluded.description,
    enabled = excluded.enabled,
    system_template = excluded.system_template,
    updated_at = now();
