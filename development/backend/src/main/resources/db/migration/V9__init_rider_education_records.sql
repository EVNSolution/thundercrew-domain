-- Track rider safety/operations training history as a dedicated table so that
-- a rider can have many education records over time, expiry can be tracked,
-- and government inspection can pull certificate evidence per rider. The
-- existing riders table is left untouched; the read API will compute summary
-- columns (educationCompleted, latestEducationType, latestEducationCompletedAt,
-- educationExpired) on the fly.

create table rider_education_records (
    id uuid primary key,
    idx bigserial not null unique,
    rider_id uuid not null,
    education_type varchar(20) not null,
    course_name varchar(200),
    completed_at timestamptz not null,
    expires_at timestamptz,
    certificate_no varchar(100),
    issuing_authority varchar(100),
    evidence_url text,
    memo text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    constraint ck_rider_education_records_education_type
        check (education_type in ('ONLINE', 'OFFLINE')),
    constraint ck_rider_education_records_expires_after_completed
        check (expires_at is null or expires_at > completed_at)
);

create index ix_rider_education_records_rider_completed
    on rider_education_records(rider_id, completed_at desc)
    where deleted_at is null;

create unique index ux_rider_education_records_certificate_active
    on rider_education_records(certificate_no)
    where certificate_no is not null and deleted_at is null;

create index ix_rider_education_records_expires_active
    on rider_education_records(expires_at)
    where expires_at is not null and deleted_at is null;
