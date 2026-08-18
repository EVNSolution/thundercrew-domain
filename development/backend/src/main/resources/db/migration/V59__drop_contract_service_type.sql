-- 계약의 배차 방식(service_type) 제거 — 용도 축 단일화의 마지막 조각.
--
-- 이력: V25 가 용도를 bikes.service_type 에 넣었고, V36 이 값을 배차 방식으로
-- 재브랜드했고, V50 이 계약으로 옮겼고, V51 이 용도를 bikes.purpose 로 복원했다.
-- 그 결과 "청소냐 배송이냐" 가 두 곳(bikes.purpose, 계약.service_type)에 저장됐다.
--
-- 두 축은 같은 축이다 (사용자 확정 2026-08-18): 배송 = 콜 방식, 클리닝 = 시간 기반
-- 순차. 운영 실측으로 활성 계약의 방식↔용도가 완전 일치함을 확인했다
-- (SINGLE↔DELIVERY 7건, SEQUENTIAL↔CLEANING 3건, 그 외 값 0건) — 정보 손실 없음.
-- 이후 판정은 전부 bikes.purpose 하나로 한다.
drop index if exists ix_rbc_service_type_active;
alter table rider_bike_contracts drop constraint if exists ck_rider_bike_contracts_service_type;
alter table rider_bike_contracts drop column service_type;
