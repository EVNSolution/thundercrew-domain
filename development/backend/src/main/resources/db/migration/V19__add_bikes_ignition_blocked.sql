-- "시동 방지" 플래그. 운영자가 라이더 상세 다이얼로그에서 토글하면 이 컬럼이
-- true 로 바뀌고, 추후 vendor telemetry adapter 가 ON 일 때만 시동 가능하도록
-- 차량 측에 명령을 내려보낸다 (실제 명령 전달은 V19 범위 밖, 별도 슬라이스).
-- 운영자 의도(intent) 를 영속화하는 게 1차 목적.

alter table bikes
    add column ignition_blocked boolean not null default false;
