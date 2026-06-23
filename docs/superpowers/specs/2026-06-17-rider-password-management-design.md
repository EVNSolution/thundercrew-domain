# 라이더 비밀번호 변경/재설정 — 설계 (계정관리 마무리)

## 목표
- **A. 라이더 본인 비번 변경**: 로그인한 라이더가 `/rider`에서 현재 비번 확인 후 새 비번으로 변경.
- **B. 관리자 비번 재설정 UI**: 관리자가 라이더 관리(라이더 상세)에서 비번을 재설정 — 기존 `PATCH /api/v1/riders/{id}/credential`(P0) 연결만, 백엔드 무변경.

자가가입(이전)으로 온보딩은 됐지만 분실/변경 경로가 없던 갭을 메운다.

## A. 라이더 본인 비번 변경

### 백엔드 (신규 write 엔드포인트)
- `POST /api/v1/rider/me/password` (RIDER 인증) — body `{currentPassword, newPassword}`.
- `RiderAuthService.changePassword(UUID riderId, String current, String newPassword)`:
  - `riderCredentialRepository.findByRiderId(riderId)` → 현재 비번 `passwordEncoder.matches(current, hash)` 검증. 없거나 불일치 → `RiderAuthenticationException`(401).
  - `credential.updatePasswordHash(passwordEncoder.encode(newPassword))` + save.
- DTO `RiderPasswordChangeRequest` `{@NotBlank currentPassword, @NotBlank @Size(min=8,max=100) newPassword}`.
- 신규 컨트롤러 `rider/controller/RiderSelfCommandController` `@RequestMapping("/api/v1/rider")`, `POST /me/password` → riderId from JWT → 서비스 호출 → 204. (write라 read 컨트롤러와 분리.)
- 보안: `/api/v1/rider/**` 는 이미 `hasRole("RIDER")` → 변경 없음.
- **ArchUnit**: `isRiderSelfCommand`(owner=RiderSelfCommandController) predicate 추가 + 두 allow 체인에 등록(POST write route).
- **예외 매핑**: `RiderAuthExceptionHandler`의 `@RestControllerAdvice(assignableTypes=...)`에 `RiderSelfCommandController` 추가 → 현재 비번 불일치 시 401 응답(기존 핸들러 재사용). (전역 핸들러가 RiderAuthenticationException을 이미 매핑하면 그걸 따른다 — 구현 시 확인.)
- 계약 테스트: 정상 변경(새 비번으로 재로그인 성공) / 현재 비번 틀림 401 / 새 비번 7자 400 / 미인증 401.

### 프론트
- `lib/services/rider-api.ts`: `riderChangePassword(token, current, newPassword): Promise<void>` → POST `/rider/me/password`(204).
- `app/rider/password/password-action.ts` ("use server"): 검증(빈값/새≠확인/8자) → `riderChangePassword` → 성공 시 `/rider`로(성공 표시). 401 → "현재 비밀번호가 올바르지 않습니다", 400 → "새 비밀번호는 8자 이상".
- `app/rider/password/page.tsx` ("use client", login 패턴): 현재·새·새확인 + 제출.
- `/rider` 홈: "비밀번호 변경" 링크(`/rider/password`).
- 미들웨어: `/rider/password`는 `/rider/*` 게이트 적용(인증 필요) — 변경 없음(공개 경로 아님).

## B. 관리자 비번 재설정 UI (백엔드 무변경)
- admin 클라이언트(`lib/services/service-ops-api.ts`): `setRiderCredential(id, newPassword)` → `PATCH /api/v1/riders/{id}/credential` body `{newPassword}`. ServiceOpsApiClient 인터페이스 + 구현에 추가.
- `app/management/riders/actions.ts`: `resetRiderCredentialAction(riderId, newPassword)` — 인증 admin 클라이언트로 호출, 성공/실패 반환.
- `components/management/RiderDetailDialog.tsx`: **"비밀번호 재설정"** 섹션/버튼 → 새 비번 입력(8자+) → 액션 호출 → 성공/오류 피드백. (관리자가 새 비번 타이핑 → 라이더에게 전달, 라이더는 A로 변경 가능.)
  - 기존 다이얼로그 패턴(편집/액션) 따라 구현. RiderDetailDialog가 받는 rider id 사용.

## 검증
- 백엔드: compileJava/compileTestJava + 계약 테스트(위 4종), ArchUnit 신규 위반 0(RiderSelfCommandController allow-list 등록).
- 프론트: typecheck/lint/build, `/rider/password` 라우트 생성.
- prod(배포 후): 라이더가 `/rider`에서 비번 변경 → 새 비번 재로그인 / 관리자가 라이더 상세에서 재설정 → 라이더 새 비번 로그인.

## 범위 밖
- 비번 분실 시 자가 재설정(SMS/이메일), 재설정=credential 삭제 후 재가입 대안, 비번 정책 강화(복잡도).
