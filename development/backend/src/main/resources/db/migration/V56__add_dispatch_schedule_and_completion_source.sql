-- 클리닝 시간 기반 배차 + 완료 자동 추정의 기반 컬럼 (핵심 기능 재편 1단계).
--
--   scheduled_at     클리닝 배차의 서비스 예정 시각. 배송 배차는 null.
--                    순번은 손으로 매기지 않고 예정 시각순으로 정렬한다.
--   service_minutes  건별 소요시간(분). null 이면 설정의 기본값 사용.
--   completed_source 완료가 어떻게 기록됐는가 — AUTO(텔레메트리 추정) / MANUAL(운영자).
--                    COMPLETED 이전에는 null. 오판 정정·감사에 필요하다.
alter table dispatch_orders
    add column scheduled_at timestamptz,
    add column service_minutes integer,
    add column completed_source varchar(10);

alter table dispatch_orders
    add constraint ck_dispatch_orders_completed_source
        check (completed_source is null or completed_source in ('AUTO', 'MANUAL'));

-- 클리닝 일정표·충돌 검사가 "차량별 예정 시각순" 으로 읽는다.
create index ix_dispatch_orders_bike_scheduled
    on dispatch_orders(bike_id, scheduled_at)
    where deleted_at is null and scheduled_at is not null;
