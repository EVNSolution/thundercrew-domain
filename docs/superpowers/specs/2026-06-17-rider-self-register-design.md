# 라이더 자가 회원가입 — 설계

## 목표
라이더가 **이름 + 전화번호 + 비밀번호**로 직접 가입한다. 서버는 입력한 이름·전화번호가 **사전 등록된 Rider 레코드와 일치**하고 **아직 미가입**일 때만 자격증명을 생성하고 즉시 로그인시킨다. 별도 SMS/OTP 인증은 없음. 관리자 비번 발급 흐름(P0의 `PATCH /riders/{id}/credential`)은 재설정 용도로 유지(UI는 후속).

이게 라이더 온보딩의 1차 경로가 되며, P1 QA(라이더 로그인)도 이걸로 풀린다.

## 보안 메모(정직)
이름+전화는 알려질 수 있는 정보 → 검증 강도 낮음(아는 사람이 선점 가능). **닫힌 조직 + 선착순 1회 가입** 전제로 MVP 수용. 후속에 SMS 인증을 끼울 수 있게 흐름을 단순 유지.

## 흐름
1. 관리자가 라이더(이름·전화) 사전 등록(기존 라이더 관리).
2. 라이더가 `/rider/register`에서 이름·전화·비번 입력.
3. 서버:
   - 전화번호로 Rider 조회(`findByPhoneNumberAndDeletedAtIsNull`). 없으면 거부.
   - `rider.name`이 입력 이름과 일치(trim 후 equals)하는지 확인. 불일치 거부.
   - 해당 riderId에 이미 credential 있으면 거부(중복 가입).
   - 통과 시 credential 생성 + 즉시 로그인 토큰 발급.
4. 성공 → 세션 쿠키 설정 + `/rider`. 실패 → 사유별 메시지.

## 백엔드
### `POST /api/v1/rider-auth/register` (공개)
- 요청 DTO `RiderRegisterRequest`: `@NotBlank name`, `@NotBlank phoneNumber`, `@NotBlank @Size(min=8,max=100) password`.
- `RiderAuthService.register(RiderRegisterRequest)`:
  - `riderRepository.findByPhoneNumberAndDeletedAtIsNull(phone)` → 없거나 `!rider.getName().trim().equals(name.trim())` → `throw new RiderAuthenticationException()` (401, "일치하는 라이더 없음" — not-found와 이름불일치를 합쳐 라이더 존재 여부 미노출).
  - `riderCredentialRepository.findByRiderId(riderId).isPresent()` → `throw new RiderAlreadyRegisteredException()` (409).
  - 아니면 `riderCredentialRepository.save(RiderCredential.create(riderId, passwordEncoder.encode(password)))` + `issueTokens(rider)` 반환(`RiderLoginResponse`).
- `RiderAuthController`에 `@PostMapping("/register")` 추가 → `RiderLoginResponse`. (arch allow-list: `isRiderAuthCommand`가 owner-class 매칭이라 자동 커버.)
- 신규 예외 `RiderAlreadyRegisteredException`(riderauth.service) + `RiderAuthExceptionHandler`에 핸들러 추가 → 409 + ApiErrorResponse(ErrorCode 적절값; 없으면 CONFLICT 계열/기존 코드 재사용).
- `SecurityConfig`: permitAll 목록에 `"/api/v1/rider-auth/register"` 추가.
- 비번 약함(@Size 위반) → 기존 검증 핸들러가 400 반환.

### 계약 테스트 (`RiderRegisterApiContractTests` 또는 기존 RiderAuth 테스트에 추가)
- 사전등록 라이더(이름·전화) 시드, credential 없음 → register 200 + accessToken + `/rider/me` 200.
- 이름 불일치 → 401.
- 미등록 전화 → 401.
- 이미 credential 있는 라이더 → register 409.
- 비번 7자 → 400.

## 프론트엔드
- `lib/services/rider-api.ts`: `riderRegister(name, phoneNumber, password): Promise<RiderAuthResponse>` → POST `/rider-auth/register`. (RiderApiError status로 프론트가 메시지 분기.)
- `app/rider/register/register-action.ts` ("use server"): 입력 검증(빈값/비번확인 불일치) → `riderRegister` → `setRiderSession` → `redirect("/rider")`. 실패 시 `{error}`:
  - 401 → "이름·전화번호가 일치하는 라이더가 없습니다. 관리자에게 문의하세요."
  - 409 → "이미 가입된 계정입니다. 로그인하세요."
  - 400 → "비밀번호는 8자 이상이어야 합니다."
  - 기타 → 일반 오류.
- `app/rider/register/page.tsx` ("use client"): 이름·전화·비밀번호·비밀번호확인 입력 + 제출(useTransition, login 페이지 패턴). 비번≠확인 시 클라이언트 검증.
- `app/rider/login/page.tsx`: 하단에 "회원가입" 링크(`/rider/register`).
- `middleware.ts`: 라이더 게이트의 공개 경로에 `/rider/register` 추가(현재 `/rider/login`만 공개). 로그인 상태로 register 접근 시 `/rider`로.

## 검증
- 백엔드: compileJava/compileTestJava + 계약 테스트(5종). ArchUnit 신규 위반 0(RiderAuthController는 이미 allow-list).
- 프론트: typecheck/lint/build, `/rider/register` 라우트 생성.
- prod(배포 후): `/rider/register`에서 실제 라이더 이름·전화로 가입 → `/rider` 진입. → **이걸로 P1 QA도 수행 가능**.

## 범위 밖(후속)
- 라이더 본인 비번 변경 UI
- 관리자 비번 재설정 UI(현재 API만)
- SMS/OTP 인증
- 분실 시 재설정 셀프 플로우
