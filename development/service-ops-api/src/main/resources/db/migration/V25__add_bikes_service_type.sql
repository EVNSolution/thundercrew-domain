-- 차량의 서비스 유형을 저장하는 컬럼. engineType(동력)과 직교하는 분류.
-- 기존 행은 모두 배송 차량으로 간주해 DELIVERY 기본값으로 초기화.
alter table bikes
    add column service_type varchar(20) not null default 'DELIVERY';

update bikes set service_type = 'DELIVERY' where service_type is null;

alter table bikes
    add constraint ck_bikes_service_type
        check (service_type in ('DELIVERY', 'CLEANING', 'OTHER'));

create index ix_bikes_service_type_active
    on bikes(service_type)
    where deleted_at is null;
