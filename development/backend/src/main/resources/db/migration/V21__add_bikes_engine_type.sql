-- Tag each bike with the engine family it belongs to so downstream features
-- (정비 스케줄 catalog 매칭, 필터) can branch on ICE vs ELECTRIC without
-- relying on the free-form model_name string. Default is ELECTRIC because
-- the current operating fleet is all electric two-wheelers; ICE rows can be
-- created/edited explicitly by the operator.
alter table bikes
    add column engine_type varchar(20) not null default 'ELECTRIC';

-- Existing rows are all electric by domain assumption — pinning the column
-- value explicitly so future schema dumps don't depend on the default.
update bikes set engine_type = 'ELECTRIC' where engine_type is null;

alter table bikes
    add constraint ck_bikes_engine_type
        check (engine_type in ('ELECTRIC', 'ICE'));

create index ix_bikes_engine_type_active
    on bikes(engine_type)
    where deleted_at is null;
