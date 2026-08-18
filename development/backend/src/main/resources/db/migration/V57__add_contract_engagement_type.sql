-- 클리닝 계약의 운영 형태 — 직영(DIRECT) / 협력(PARTNER).
--
-- 계약 형태 축은 용도별로 갈린다: 배송(오토바이) 계약은 인수형/반납형(return_type),
-- 클리닝 계약은 직영/협력(이 컬럼). 같은 클리너가 직영→협력으로 바뀌는 것은
-- 계약 갱신으로 이력화한다 — 그래서 사람이 아니라 계약의 속성이다.
--
-- 용도↔형태 교차 검증(클리닝 계약에만 필수, 배송 계약에는 금지)은 용도가 bikes
-- 테이블에 있어 CHECK 로 못 건다 — 서비스 레이어에서 강제한다.
alter table rider_bike_contracts
    add column engagement_type varchar(20);

alter table rider_bike_contracts
    add constraint ck_rider_bike_contracts_engagement_type
        check (engagement_type is null or engagement_type in ('DIRECT', 'PARTNER'));
