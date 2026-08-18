-- 왕복 배차 제거. 운영 사용 실측 0건 — dispatch_batch 0행, kind=PICKUP 주문 0건
-- (2026-08-18 확인). 코드까지 걷는 확정 결정이므로 스키마도 정리한다.
--
--   kind      PICKUP/DELIVERY 2치였는데 PICKUP 이 사라지므로 컬럼째 제거.
--   batch_id  왕복 배치 소속 표시였으므로 제거.
drop index if exists ix_dispatch_orders_batch;
alter table dispatch_orders drop constraint if exists ck_dispatch_orders_kind;
alter table dispatch_orders drop column kind;
alter table dispatch_orders drop column batch_id;
drop table if exists dispatch_batch;
