-- 기존 분류 → 운영 방식 매핑 (OTHER 는 유지)
update bikes set service_type = 'SINGLE'     where service_type = 'DELIVERY';
update bikes set service_type = 'SEQUENTIAL' where service_type = 'CLEANING';
-- check 제약 재생성
alter table bikes drop constraint ck_bikes_service_type;
alter table bikes add constraint ck_bikes_service_type
    check (service_type in ('CALL', 'SINGLE', 'SEQUENTIAL', 'ROUND', 'OTHER'));
-- 컬럼 기본값 변경 (기존 default 'DELIVERY')
alter table bikes alter column service_type set default 'SINGLE';
