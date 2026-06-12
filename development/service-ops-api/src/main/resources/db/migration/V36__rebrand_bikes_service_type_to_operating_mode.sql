-- 구 CHECK 제약을 먼저 제거한다.
-- (구 제약은 'DELIVERY'/'CLEANING'/'OTHER' 만 허용하므로, 제거 전에 신규 값으로 UPDATE 하면
--  제약 위반(SQLSTATE 23514)으로 마이그레이션이 실패한다. 반드시 DROP → UPDATE → ADD 순서여야 한다.)
alter table bikes drop constraint if exists ck_bikes_service_type;

-- 기존 분류 → 운영 방식 매핑 (OTHER 는 유지)
update bikes set service_type = 'SINGLE'     where service_type = 'DELIVERY';
update bikes set service_type = 'SEQUENTIAL' where service_type = 'CLEANING';

-- 신규 운영 방식 값으로 CHECK 제약 재생성
alter table bikes add constraint ck_bikes_service_type
    check (service_type in ('CALL', 'SINGLE', 'SEQUENTIAL', 'ROUND', 'OTHER'));

-- 컬럼 기본값 변경 (기존 default 'DELIVERY')
alter table bikes alter column service_type set default 'SINGLE';
