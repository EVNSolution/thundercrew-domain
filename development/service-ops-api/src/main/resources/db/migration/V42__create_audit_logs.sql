create table audit_logs (
    id uuid primary key,
    idx bigserial not null unique,
    entity_type text not null,
    entity_id uuid not null,
    field text not null,
    old_value text,
    new_value text,
    actor text,
    occurred_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid
);
create index idx_audit_logs_entity on audit_logs (entity_type, entity_id);
create index idx_audit_logs_occurred_at on audit_logs (occurred_at desc);
