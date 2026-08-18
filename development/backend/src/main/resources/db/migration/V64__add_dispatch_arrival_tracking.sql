-- 완료 자동 추정(3단계)의 도착 감지 상태 저장.
--
-- 판정은 스케줄러가 주기적으로 하는데, "정지 3분 유지" 와 "도착 후 이탈" 은
-- 틱 사이에 상태를 이어가야 해서 주문 행에 기록한다.
--
--   arrival_stop_since   목적지 반경 안에서 정지 상태가 처음 관측된 시각.
--                        이동이 감지되거나 반경을 벗어나면 다시 null.
--   arrival_detected_at  정지 유지 시간이 채워져 "도착 감지" 로 확정된 시각.
--                        이후 반경 이탈 시 COMPLETED(source=AUTO) 로 넘어간다.
--
-- 두 값 모두 완료 되돌리기 시 함께 초기화된다 (재판정 가능해야 하므로).
alter table dispatch_orders
    add column arrival_stop_since timestamptz,
    add column arrival_detected_at timestamptz;
