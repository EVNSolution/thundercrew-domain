# 엑셀 일괄 삭제 (관리구분 열) 설계

**작성일:** 2026-06-23

## 목표

기존 엑셀 일괄 업로드(라이더/차량/매칭)에 **삭제** 기능을 추가한다. 별도 파일이나
시트로 분리하지 않고, 각 템플릿 끝에 `관리구분` 열을 추가해 행 단위로 삭제를 표시한다.
빈 값은 기존처럼 신규/수정(upsert), `삭제`는 그 행의 엔티티를 삭제한다.

## 비목표 (YAGNI)

- 통합 단일 워크북(시트 3개) — 분리 구조 유지.
- "시트에 없는 행은 전부 삭제"식 전체 동기화 — 위험하므로 채택 안 함.
- 자동 연쇄 삭제 — 활성 매칭이 걸린 라이더/차량 삭제 시 **차단(에러)** 으로 처리.

## 데이터 모델 / 공용 인프라

### BulkRowStatus
`UNCHANGED | UPDATE | NEW | ERROR` → **`DELETE` 추가**.

### BulkRowResult
팩토리 추가:
```java
public static BulkRowResult delete(int rowNumber, String key) {
    return new BulkRowResult(rowNumber, BulkRowStatus.DELETE, key, List.of(), null);
}
```

### BulkSummary
`unchanged / update / newRows("new") / error / total` 에 **`delete` 카운트 추가**.
`of(...)` 에서 `DELETE` 상태 집계.

### BulkApplyResponse
기존 `applied / skipped` 유지. 삭제도 성공 시 `applied`, 실패 시 `skipped` 로 집계
(별도 필드 추가 없이 단순 유지).

## 관리구분 열 규약

- 각 템플릿 **맨 끝 열**에 `관리구분` 헤더 추가.
- 값 해석(앞뒤 공백 trim 후):
  - 빈 값 / 미입력 → upsert (기존 동작, 하위호환)
  - `삭제` → 삭제 처리
  - 그 외 값 → 에러 행("관리구분 값 오류: <값>")
- 열 인덱스:
  - 라이더: col 4 (이름0, 연락처1, 교육이수2, 팀3, **관리구분4**)
  - 차량: col 5 (차량번호0, 차종1, 동력2, IMEI3, 터미널ID4, **관리구분5**)
  - 매칭: col 9 (차량번호0 … 검증결과8, **관리구분9**)

## 엔티티별 동작

공통: `apply()` 와 `evaluateRow()` 모두 먼저 `관리구분` 값을 읽어 분기한다.
삭제 분기이면 upsert 검증/실행을 타지 않는다.

### 라이더 (RiderBulkService)
- 조회 키: 연락처(`findByPhoneNumberAndDeletedAtIsNull(phone)`)
- preview:
  - 대상 없음 → `error(row, key, "삭제 대상 없음")`
  - 활성 매칭/보험 존재(`existsActiveContractReference` / `existsActiveInsuranceReference`) → `error(row, key, "삭제불가: 활성 매칭/보험 존재")`
  - 그 외 → `delete(row, key)`
- apply:
  - 대상 있으면 `riderCommandService.softDelete(riderId)` 호출.
  - `softDelete` 가 던지는 예외(미존재/활성참조)는 catch → `skipped++`.

### 차량 (BikeBulkService)
- 조회 키: 차량번호(`findByPlateNumberAndDeletedAtIsNull(plate)`)
- preview:
  - 대상 없음 → `error(row, key, "삭제 대상 없음")`
  - 활성 매칭/장비/단말 존재(`existsActiveContractReference` / `existsActiveEquipmentReference` / `existsActiveDeviceInstallationReference`) → `error(row, key, "삭제불가: 활성 매칭/장비/단말 존재")`
  - 그 외 → `delete(row, key)`
- apply: `bikeCommandService.softDelete(bikeId)` 호출, 예외 catch → `skipped++`.

### 매칭 (ContractBulkService)
- 매칭은 삭제 개념이 없으므로 `삭제` = **종료(terminate)**.
- 조회 키: 차량번호 + 연락처 → 활성(미종료) 계약 조회.
- preview:
  - 활성 계약 없음 → `error(row, key, "종료 대상 계약 없음")`
  - 있으면 → `delete(row, key)` (UI 라벨은 "삭제/종료")
- apply: `contractCommandService.terminate(contractId, new RiderBikeContractTerminateRequest(now, OPERATOR_TERMINATE))`.
  - `now` 는 서비스에 주입된 `Clock` 사용(서비스 시그니처상 요청에 담아 전달).

## 엑셀 템플릿

- 바이너리 `.xlsx` 3종에 `관리구분` 헤더 셀을 추가한다.
- 추가 방법: POI 기반 일회성 유틸(테스트 또는 main)로 각 템플릿을 열어 헤더 행 끝에
  `관리구분 (삭제 시 '삭제' 입력)` 셀을 쓰고 저장 → 수정된 바이너리를 커밋.
- export() 시 기존 행의 관리구분 열은 빈 문자열로 채운다(삭제 아님).

## 프론트엔드

- 타입: `BulkRowStatus` 에 `'DELETE'` 추가, `summary` 에 `delete: number` 추가.
- `BulkPreviewModal`:
  - 상태 라벨 스위치에 `DELETE` → "삭제"(빨강) 추가.
  - 요약 바에 삭제 카운트 추가.
  - 필터(현재 `UNCHANGED` 숨김)는 그대로 — `DELETE` 는 노출.
- 서버 액션/ API 클라이언트: 기존 preview/apply 엔드포인트 재사용 — **변경 없음**
  (삭제는 같은 파일 업로드 경로를 그대로 탐).

## 에러 처리

- 삭제 분기에서 발생하는 모든 실패는 미리보기에서 `ERROR` 행으로 표시되고, apply 시엔
  per-row try/catch 로 `skipped` 집계 — 한 행 실패가 전체 트랜잭션을 막지 않음(기존 패턴).

## 테스트

각 BulkService 테스트에 케이스 추가:
- 관리구분=`삭제` + 대상 존재 + 참조 없음 → preview DELETE, apply 후 소프트삭제/종료됨.
- 관리구분=`삭제` + 대상 없음 → ERROR.
- 라이더/차량: 관리구분=`삭제` + 활성 매칭 존재 → preview ERROR, apply skipped.
- 관리구분 빈 값 → 기존 upsert 동작 그대로(회귀 방지).
- 관리구분 잘못된 값 → ERROR.
