# Admin Navigation Grouping Plan

## Goal
Reduce the admin sidebar from a flat operations list into four management areas while keeping existing routes intact.

## Grouping
- 차량 관리
  - 차량
  - 차량 등록
  - 장비
  - 장비 종류
  - 단말
  - 단말 설치
- 라이더 관리
  - 라이더
  - 라이더 등록
  - 보험 연결
  - 보험 항목
- 계약 관리
  - 계약
  - 계약 등록
  - 계약 양식
- 스테이션 관리
  - 스테이션
  - 스테이션 등록

## Implementation sequence
1. Centralize management navigation data.
2. Replace the sidebar operations list with the four top-level groups.
3. Add compact group sub-navigation to grouped list pages.
4. Keep create/detail/edit routes unchanged.
5. Verify locally, merge through PR, then redeploy the frontend to Vercel.

## Out of scope
- Backend/API/schema changes.
- Real map provider integration.
- Telemetry/current-state work.
