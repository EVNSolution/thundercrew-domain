-- rider_bike_contracts 에 service_type 추가 (nullable 로 시작 → 백필 → NOT NULL + CHECK)
alter table rider_bike_contracts add column service_type varchar(20);

-- 각 계약을 그 차량의 현재 serviceType 으로 백필. 차량이 없는 고아 계약은 OTHER.
update rider_bike_contracts c
   set service_type = coalesce((select b.service_type from bikes b where b.id = c.bike_id), 'OTHER');

alter table rider_bike_contracts alter column service_type set default 'OTHER';
alter table rider_bike_contracts alter column service_type set not null;
alter table rider_bike_contracts add constraint ck_rider_bike_contracts_service_type
    check (service_type in ('CALL', 'SINGLE', 'SEQUENTIAL', 'ROUND', 'OTHER'));
create index ix_rbc_service_type_active
    on rider_bike_contracts(service_type)
    where terminated_at is null and deleted_at is null;

-- bikes 에서 service_type 제거 (제약·인덱스 먼저)
alter table bikes drop constraint if exists ck_bikes_service_type;
drop index if exists ix_bikes_service_type_active;
alter table bikes drop column service_type;
