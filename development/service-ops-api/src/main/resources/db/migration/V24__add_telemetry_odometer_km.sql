-- 텔레메트리 페이로드의 "총 주행거리(km)" 를 세 단계 (raw log / recent history /
-- current state) 에 모두 보존한다. 차량 정비 cycle_km 품목 (브레이크 패드,
-- 타이어, 모터오일 등) 의 상태 분류와 표시에 직접 쓰인다.
--
-- 값은 벤더가 보내는 누적 주행거리 정수 km. 정밀도가 미세하지 않아 integer 로
-- 충분 — V22 의 `vehicle_maintenance_records.serviced_at_odometer_km` 와 동일한
-- 타입을 맞춰 비교 / 차분 계산 코드를 단순화한다.
--
-- 기존 행에는 null 로 채워지고, 다음 텔레메트리 수신 시점부터 자연스럽게
-- 값이 채워진다. nullable 유지 — 벤더가 일시적으로 odometer 필드를 빠뜨려도
-- 다른 필드 (위치 / 시동) 는 정상 적재되어야 하기 때문.

alter table device_telemetry_logs
    add column odometer_km integer;

alter table device_telemetry_logs
    add constraint ck_device_telemetry_logs_odometer
    check (odometer_km is null or odometer_km >= 0);

alter table bike_recent_states
    add column odometer_km integer;

alter table bike_recent_states
    add constraint ck_bike_recent_states_odometer
    check (odometer_km is null or odometer_km >= 0);

alter table bike_current_states
    add column odometer_km integer;

alter table bike_current_states
    add constraint ck_bike_current_states_odometer
    check (odometer_km is null or odometer_km >= 0);
