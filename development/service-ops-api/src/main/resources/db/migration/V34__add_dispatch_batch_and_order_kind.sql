alter table dispatch_orders add column kind varchar(20) not null default 'DELIVERY';
alter table dispatch_orders add constraint ck_dispatch_orders_kind check (kind in ('PICKUP', 'DELIVERY'));
alter table dispatch_orders add column batch_id uuid;
create index ix_dispatch_orders_batch on dispatch_orders (batch_id, kind, status) where deleted_at is null;

create table dispatch_batch (
    id uuid primary key,
    idx bigserial not null unique,
    status varchar(20) not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    created_by uuid,
    updated_by uuid,
    deleted_by uuid,
    constraint ck_dispatch_batch_status check (status in ('COLLECTING', 'DELIVERING', 'DONE'))
);
