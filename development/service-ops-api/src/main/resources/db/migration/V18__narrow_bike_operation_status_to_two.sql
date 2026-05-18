-- 차량 운영 상태를 (READY, IN_SERVICE) 두 값으로 축소한다. 운영팀 요청 —
-- 어드민에서 "수리"/"점검 필요"는 별도 워크플로우(향후 정비 모듈) 로 옮길
-- 예정이라 등록 다이얼로그에 노출할 필요가 없어졌고, 백엔드 enum/CHECK 도
-- 같이 좁혀서 잘못된 상태가 들어오지 못하게 한다. 현재 DB 에 deprecated
-- 값(REPAIRING / INSPECTION_REQUIRED)이 한 행도 없는 상태에서만 안전하므로,
-- migration 실행 전 데이터 정리가 선행되어 있다고 가정한다.

alter table bikes
    drop constraint if exists ck_bikes_operation_status;

alter table bikes
    add constraint ck_bikes_operation_status
        check (operation_status in ('READY', 'IN_SERVICE'));

alter table bike_operation_status_histories
    drop constraint if exists ck_bike_status_histories_operation_status;

alter table bike_operation_status_histories
    add constraint ck_bike_status_histories_operation_status
        check (operation_status in ('READY', 'IN_SERVICE'));
