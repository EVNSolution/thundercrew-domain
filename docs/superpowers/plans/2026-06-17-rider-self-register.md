# 라이더 자가 회원가입 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** 라이더가 이름+전화+비번으로 자가 가입(사전등록 Rider 매칭, 미가입 확인) 후 즉시 로그인.

**Architecture:** P0 riderauth 슬라이스에 register 추가. 프론트는 /rider/register + 미들웨어 공개 경로 + login 링크. login 흐름과 대칭.

스펙: `docs/superpowers/specs/2026-06-17-rider-self-register-design.md`.

---

## Task 1 — 백엔드 register

**Files (development/service-ops-api/src/main/java/com/thundercrew/opsapi):**
- Create: `riderauth/dto/RiderRegisterRequest.java`
- Create: `riderauth/service/RiderAlreadyRegisteredException.java`
- Modify: `riderauth/service/RiderAuthService.java` (register 메서드)
- Modify: `riderauth/controller/RiderAuthController.java` (POST /register)
- Modify: `riderauth/controller/RiderAuthExceptionHandler.java` (409 핸들러)
- Modify: `auth/config/SecurityConfig.java` (permit /register)
- Modify: 기존 `src/test/java/com/thundercrew/opsapi/RiderAuthApiContractTests.java` (register 시나리오 추가) 또는 새 테스트

### Step 1: `RiderRegisterRequest`
```java
package com.thundercrew.opsapi.riderauth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RiderRegisterRequest(
        @NotBlank String name,
        @NotBlank String phoneNumber,
        @NotBlank @Size(min = 8, max = 100) String password
) {
}
```

### Step 2: `RiderAlreadyRegisteredException`
```java
package com.thundercrew.opsapi.riderauth.service;

public class RiderAlreadyRegisteredException extends RuntimeException {
    public RiderAlreadyRegisteredException() {
        super("Rider account already registered.");
    }
}
```

### Step 3: `RiderAuthService.register`
기존 필드(riderRepository, riderCredentialRepository, passwordEncoder, riderTokenService) 재사용. 기존 `issueTokens(Rider)` private 메서드 재사용. 추가:
```java
@Transactional
public RiderLoginResponse register(RiderRegisterRequest request) {
    Rider rider = riderRepository.findByPhoneNumberAndDeletedAtIsNull(request.phoneNumber())
            .filter(r -> r.getName() != null && r.getName().trim().equals(request.name().trim()))
            .orElseThrow(RiderAuthenticationException::new);
    if (riderCredentialRepository.findByRiderId(rider.getId()).isPresent()) {
        throw new RiderAlreadyRegisteredException();
    }
    riderCredentialRepository.save(
            RiderCredential.create(rider.getId(), passwordEncoder.encode(request.password())));
    return issueTokens(rider);
}
```
import 추가: RiderRegisterRequest.

### Step 4: `RiderAuthController` — POST /register
```java
@PostMapping("/register")
RiderLoginResponse register(@Valid @RequestBody RiderRegisterRequest request) {
    return riderAuthService.register(request);
}
```
import: RiderRegisterRequest.

### Step 5: `RiderAuthExceptionHandler` — 409 핸들러 추가
기존 클래스에 메서드 추가. ErrorCode는 `common/api/ErrorCode`를 READ해서 conflict/duplicate 성격의 값이 있으면 사용, 없으면 가장 근접한 값 사용(HTTP 상태는 반드시 409 CONFLICT):
```java
@ExceptionHandler(RiderAlreadyRegisteredException.class)
ResponseEntity<ApiErrorResponse> handleAlreadyRegistered(
        RiderAlreadyRegisteredException exception, HttpServletRequest request) {
    ApiErrorResponse body = ApiErrorResponse.of(
            ErrorCode.<CONFLICT_OR_CLOSEST>, exception.getMessage(),
            request.getRequestURI(), Instant.now(clock));
    return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
}
```
> ErrorCode 실제 값 확인 필수. import RiderAlreadyRegisteredException.

### Step 6: `SecurityConfig` — permit register
`requestMatchers(...).permitAll()` 목록(현재 `/api/v1/rider-auth/login`, `/api/v1/rider-auth/refresh` 포함)에 `"/api/v1/rider-auth/register"` 추가.

### Step 7: 계약 테스트 (기존 RiderAuthApiContractTests에 추가 메서드)
시드 패턴은 기존 파일 그대로. 추가 시나리오:
- 사전등록 라이더(이름="라이더1", 전화=RIDER_PHONE), credential 미발급 상태에서 → `POST /api/v1/rider-auth/register {name,phoneNumber,password}` → 200 + accessToken 추출 → `/rider/me` 200, id 일치.
- 이름 불일치(전화 맞음) → 401 AUTHENTICATION_FAILED.
- 미등록 전화 → 401.
- 이미 credential 발급된 라이더(기존 issueRiderCredential 후) register → 409.
- 비번 7자 → 400.
> 주의: 기존 테스트의 @BeforeEach가 admin+rider 시드하고 일부 테스트가 credential을 발급함. register "정상" 테스트는 credential 미발급 상태에서 시작해야 하니, 테스트 시작 시 rider_credentials가 비어있는지 확인(@BeforeEach가 `delete from rider_credentials` 하므로 OK).

### Step 8: 빌드 + 테스트
`cd development/service-ops-api`
`./gradlew compileJava compileTestJava -q` 통과
`./gradlew test --tests "*RiderAuthApiContractTests" --tests "*ArchitectureBoundaryTests" -q` (Docker 없으면 계약테스트 initializationError=환경문제로 보고; ArchUnit 신규 위반 0 — RiderAuthController는 이미 allow-list).

### Step 9: 커밋
`git add -A && git commit -m "feat(rider): self-register endpoint (name+phone match)"`

---

## Task 2 — 프론트 회원가입

**Files (development/front-admin-web):**
- Modify: `lib/services/rider-api.ts` (riderRegister)
- Create: `app/rider/register/register-action.ts`
- Create: `app/rider/register/page.tsx`
- Modify: `app/rider/login/page.tsx` (회원가입 링크)
- Modify: `middleware.ts` (riderGate 공개 경로에 /rider/register)

### Step 1: `rider-api.ts`
```ts
export function riderRegister(
  name: string, phoneNumber: string, password: string
): Promise<RiderAuthResponse> {
  return call<RiderAuthResponse>("/rider-auth/register", {
    method: "POST",
    body: JSON.stringify({ name, phoneNumber, password })
  });
}
```

### Step 2: `register-action.ts` ("use server")
login-action.ts 패턴. confirm 불일치/빈값 클라이언트 검증은 page에서, 여기선 서버 검증 + 상태별 메시지:
```ts
"use server";
import { redirect } from "next/navigation";
import { RiderApiError, riderApiConfigured, riderRegister } from "@/lib/services/rider-api";
import { setRiderSession } from "@/lib/services/rider-session";

export async function registerRiderAction(formData: FormData): Promise<{ error: string } | void> {
  const name = String(formData.get("name") ?? "").trim();
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!name || !phoneNumber || !password) return { error: "이름·전화번호·비밀번호를 모두 입력하세요." };
  if (password.length < 8) return { error: "비밀번호는 8자 이상이어야 합니다." };
  if (!riderApiConfigured()) return { error: "서버가 구성되지 않았습니다." };
  try {
    const auth = await riderRegister(name, phoneNumber, password);
    await setRiderSession(auth);
  } catch (e) {
    if (e instanceof RiderApiError) {
      if (e.status === 409) return { error: "이미 가입된 계정입니다. 로그인하세요." };
      if (e.status === 401 || e.status === 404) return { error: "이름·전화번호가 일치하는 라이더가 없습니다. 관리자에게 문의하세요." };
      if (e.status === 400) return { error: "비밀번호는 8자 이상이어야 합니다." };
    }
    return { error: "가입에 실패했습니다. 잠시 후 다시 시도하세요." };
  }
  redirect("/rider");
}
```

### Step 3: `register/page.tsx` ("use client")
login/page.tsx 패턴(useState/useTransition, form action). 필드: 이름, 전화번호(tel), 비밀번호, 비밀번호 확인. 제출 전 클라이언트 검증: 빈값/비번≠확인 → setError. 통과 시 startTransition(registerRiderAction(formData)). 하단에 "로그인" 링크(`/rider/login`). 스타일은 login 페이지와 동일 톤(maxWidth 360 등).

### Step 4: `login/page.tsx` — 회원가입 링크
폼 하단에 `<a href="/rider/register">회원가입</a>` 추가(간단 스타일). 기존 로직 변경 없음.

### Step 5: `middleware.ts` — register 공개
`riderGate` 안의 공개 경로 처리. 현재:
```ts
if (pathname === "/rider/login") {
  if (accessToken || refreshToken) {
    return NextResponse.redirect(new URL("/rider", request.url));
  }
  return NextResponse.next();
}
```
를 다음으로 확장:
```ts
if (pathname === "/rider/login" || pathname === "/rider/register") {
  if (accessToken || refreshToken) {
    return NextResponse.redirect(new URL("/rider", request.url));
  }
  return NextResponse.next();
}
```
(나머지 riderGate 로직 불변.)

### Step 6: 검증
`cd development/front-admin-web && npm run typecheck && npm run lint && npm run build`
통과 + `/rider/register` 라우트 생성. 경쟁 dev 서버 금지.

### Step 7: 커밋
`git add -A && git commit -m "feat(rider): self-register page + login link"`

---

## Self-Review
- 스펙 커버: register 엔드포인트+검증(T1), 페이지+미들웨어 공개+링크(T2). 일치.
- 타입 일관성: 백엔드 RiderRegisterRequest(name,phoneNumber,password) ↔ 프론트 riderRegister 인자. 응답 RiderLoginResponse ↔ RiderAuthResponse(기존).
- 상태코드 매핑: 401/404(불일치), 409(중복), 400(약한비번) ↔ 프론트 메시지. 일치.
- Placeholder: ErrorCode 409 값은 "실제 enum 확인" 표기 — 구현 시 결정.
