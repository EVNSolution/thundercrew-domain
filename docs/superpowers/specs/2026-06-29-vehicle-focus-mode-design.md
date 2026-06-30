# 차량 포커스 모드 (Vehicle focus mode)

**Date:** 2026-06-29
**Status:** Design (approved)

## 배경 / 목표

오버뷰 지도에서 차량을 선택하면 현재는 그 차량을 **따라가며** 오른쪽에 차량 상세(VehicleDetailDialog)가 뜬다. 이를 **포커스 모드**로 바꾼다: 선택한 차량 한 대와 그 차량의 **배송지**에 집중해 운영자가 배송 현황을 한눈에 보게 한다.

## 동작

### 진입 — 차량 선택 시
- **지도 마커**
  - 선택 차량 1대만 표시(다른 차량 핀 숨김)
  - station·tip 마커는 **그대로 유지**
  - 선택 차량의 **배송지 마커를 새로 표시**(MapShell의 4번째 마커 레이어). 진행 중/완료를 시각 구분(진행 중=컬러+순번, 완료=회색+체크). 순차배차(SEQUENTIAL)는 순번 표기.
- **fitBounds**: 진입(선택 변경) 시 "선택 차량 + 모든 배송지"가 한 화면에 보이도록 **1회** 맞춘다. 그 후 **자동 따라가기는 끈다** — 운영자가 자유롭게 팬/줌. 폴링으로 차량 위치가 갱신돼도 마커만 움직이고 지도 재중심은 하지 않는다.
- **오른쪽 패널**: 기존 VehicleDetailDialog (변경 없음).
- **왼쪽 패널(신규)**: "현재 배송 리스트" — 진행 중 + 완료 배송을 **상태 구분**해 보여준다. 행 클릭 시 해당 배송지로 지도 이동(팬).
- **하단 BottomMapPanel**: 포커스 모드에선 접는다(지도 가운데 공간 확보).

### 해제 — 선택 해제(빈 지도 클릭 / 패널 닫기)
- 전체 차량 마커 복원, 배송지 마커 제거, 왼쪽 배송 리스트 닫힘, 자동 따라가기 원복.
- 선택 차량이 폴링 중 사라지면(매칭 종료 등) 포커스 자동 해제.

## 데이터

- **배송 리스트/배송지**: 실차량은 `listDispatchOrders(bikeId)`(진행 중) + `listCompletedDispatchOrders(bikeId)`(완료)로 합쳐 상태 구분. 각 주문의 latitude/longitude가 배송지 마커. 좌표 없음/`0,0`은 마커 스킵.
- **순서**: 순차배차는 `sequence` 순. 단일/콜은 무순서(들어온 순).
- **시뮬 차량(IMEI "-")**: 배차가 client-synthesized라 `listDispatchOrders`에 없음 → 핀의 `currentDispatch*`(현재 1건)만 배송지로 표시, 완료 이력 없음. 실차량은 전체 리스트.

## 컴포넌트 영향

- `components/dashboard/MapShell.tsx`: 배송지(destination) 마커 레이어 추가(prop `dispatchMarkers` 등 + 렌더/캐시/정리/HTML). 포커스 모드용 1회 fitBounds 트리거 + 기존 follow 비활성화 분기.
- `components/overview/FullscreenMapHost.tsx`: 포커스 상태(선택 차량) 기반으로 (1) MapShell에 넘기는 bikePins를 선택 1대로 필터, (2) 배송지 마커 데이터 계산/전달, (3) 왼쪽 패널 마운트, (4) 하단 패널 접기, (5) 진입 시 fit / follow off.
- 신규 `components/overview/DeliveryListPanel.tsx`(가칭): 왼쪽 배송 리스트 UI.
- 데이터 fetch: 선택 시 dispatch 주문 조회(기존 `listDispatchOrdersAction` / `listCompletedDispatchOrdersAction` 재사용).
- CSS: 왼쪽 패널 레이아웃 + 배송지 마커 스타일.

## 비목표 (YAGNI)
- 배송지 마커에서의 편집/배차 변경(읽기 전용 표시).
- 시뮬 차량의 완료 이력(소스 없음).
- 다중 차량 동시 포커스.

## 미해결 / 후속
- 배송지 마커 클릭 ↔ 리스트 행 하이라이트 연동(있으면 좋지만 1차는 단방향: 행→지도).
- 좁은 화면에서 좌/우 패널 + 지도 폭 — 1차는 데스크톱 기준.
