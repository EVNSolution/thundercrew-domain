# 라이더 비번 변경/재설정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** 라이더 본인 비번 변경(신규 엔드포인트+UI) + 관리자 비번 재설정 UI(기존 PATCH 연결).

**Architecture:** 백엔드는 riderauth/rider 슬라이스에 changePassword + RiderSelfCommandController 추가. 프론트는 라이더 비번변경 페이지 + admin RiderDetailDialog 재설정 버튼.

스펙: `docs/superpowers/specs/2026-06-17-rider-password-management-design.md`.

---

## Task 1 — 백엔드 라이더 본인 비번 변경

**Files (development/service-ops-api/src/main/java/com/thundercrew/opsapi):**
- Modify: `riderauth/service/RiderAuthService.java` (changePassword)
- Create: `rider/dto/RiderPasswordChangeRequest.java`
- Create: `rider/controller/RiderSelfCommandController.java`
- Modify: `riderauth/controller/RiderAuthExceptionHandler.java` (advice 대상에 새 컨트롤러 추가)
- Modify: `src/test/java/com/thundercrew/opsapi/ArchitectureBoundaryTests.java` (allow-list)
- Test: 기존 `RiderAuthApiContractTests`에 추가 또는 신규

### Step 1: `RiderAuthService.changePassword`
기존 필드(riderCredentialRepository, passwordEncoder) 재사용. READ the file first for exact field names.
```java
@Transactional
public void changePassword(java.util.UUID riderId, String currentPassword, String newPassword) {
    RiderCredential credential = riderCredentialRepository.findByRiderId(riderId)
            .filter(c -> passwordEncoder.matches(currentPassword, c.getPasswordHash()))
            .orElseThrow(RiderAuthenticationException::new);
    credential.updatePasswordHash(passwordEncoder.encode(newPassword));
    riderCredentialRepository.save(credential);
}
```
(RiderCredential.getPasswordHash()/updatePasswordHash() 존재 확인됨 — P0.)

### Step 2: `RiderPasswordChangeRequest` (rider/dto)
```java
package com.thundercrew.opsapi.rider.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RiderPasswordChangeRequest(
        @NotBlank String currentPassword,
        @NotBlank @Size(min = 8, max = 100) String newPassword
) {
}
```

### Step 3: `RiderSelfCommandController` (rider/controller)
```java
package com.thundercrew.opsapi.rider.controller;

import com.thundercrew.opsapi.rider.dto.RiderPasswordChangeRequest;
import com.thundercrew.opsapi.riderauth.service.RiderAuthService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rider")
public class RiderSelfCommandController {

    private final RiderAuthService riderAuthService;

    public RiderSelfCommandController(RiderAuthService riderAuthService) {
        this.riderAuthService = riderAuthService;
    }

    @PostMapping("/me/password")
    ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody RiderPasswordChangeRequest request
    ) {
        UUID riderId = UUID.fromString(jwt.getClaimAsString("riderId"));
        riderAuthService.changePassword(riderId, request.currentPassword(), request.newPassword());
        return ResponseEntity.noContent().build();
    }
}
```

### Step 4: 예외 매핑
READ `riderauth/controller/RiderAuthExceptionHandler.java`. 그 `@RestControllerAdvice(assignableTypes = {...})` 목록에 `com.thundercrew.opsapi.rider.controller.RiderSelfCommandController.class` 추가(import). 이러면 현재 비번 불일치 시 RiderAuthenticationException → 401.
> 만약 전역 핸들러가 이미 RiderAuthenticationException → 401을 매핑한다면 이 단계 불필요 — 먼저 확인. 계약 테스트로 401 나오는지 검증할 것.

### Step 5: ArchUnit allow-list
`ArchitectureBoundaryTests.java`: predicate 추가
```java
    private static boolean isRiderSelfCommand(JavaMethod method) {
        return method.getOwner().getName()
                .equals("com.thundercrew.opsapi.rider.controller.RiderSelfCommandController");
    }
```
그리고 두 체인에 등록: `onlyAllowedAuthCommandsMayUseWriteRouteMappings`의 `|| ...` 에 `|| isRiderSelfCommand(method)`, `onlyAllowedAuthCommandsMayHaveRequestBodyParameters`의 `&& !...` 에 `&& !isRiderSelfCommand(method)`.

### Step 6: 계약 테스트
`RiderAuthApiContractTests` 패턴(라이더 시드+credential 발급+로그인). 시나리오: 로그인→`POST /api/v1/rider/me/password {current,new}`→204→새 비번 재로그인 200; 현재 비번 틀림→401; 새 비번 7자→400; 미인증→401.

### Step 7: 빌드 + 커밋
`cd development/service-ops-api && ./gradlew compileJava compileTestJava -q` 통과 + ArchUnit 신규 위반 0(RiderSelfCommandController allow-list됨). (Docker 없으면 계약테스트 env 실패=정상 보고.)
`git add -A && git commit -m "feat(rider): self password-change endpoint"`

---

## Task 2 — 프론트 (라이더 변경 + 관리자 재설정)

**Files (development/front-admin-web):**
- Modify: `lib/services/rider-api.ts` (riderChangePassword)
- Create: `app/rider/password/password-action.ts`, `app/rider/password/page.tsx`
- Modify: `app/rider/page.tsx` (비번변경 링크)
- Modify: `lib/services/service-ops-api.ts` (admin: setRiderCredential)
- Modify: `app/management/riders/actions.ts` (resetRiderCredentialAction)
- Modify: `components/management/RiderDetailDialog.tsx` (재설정 UI)

### Step 1: rider-api.ts
```ts
export function riderChangePassword(
  accessToken: string, currentPassword: string, newPassword: string
): Promise<void> {
  return call<void>("/rider/me/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword })
  }, accessToken);
}
```

### Step 2: app/rider/password/password-action.ts ("use server")
login-action 패턴. 입력 검증(빈값/new!==confirm/8자) → getRiderAccessToken → riderChangePassword → 성공 시 redirect("/rider"). 실패: RiderApiError 401 → "현재 비밀번호가 올바르지 않습니다", 400 → "새 비밀번호는 8자 이상", 기타 일반.

### Step 3: app/rider/password/page.tsx ("use client")
login/page 패턴(useState/useTransition). 필드: 현재 비밀번호, 새 비밀번호, 새 비밀번호 확인. 제출 전 new!==confirm 클라이언트 검증. 하단 "← 홈으로"(`/rider`) 링크.

### Step 4: app/rider/page.tsx
프로필 헤더 영역 또는 로그아웃 근처에 "비밀번호 변경" 링크(`/rider/password`) 추가. 기존 로직 변경 최소.

### Step 5: service-ops-api.ts (admin client)
READ the file for the client structure (interface ServiceOpsApiClient + createServiceOpsApiClient request() helper). 추가:
- 인터페이스에 `setRiderCredential(id: string, newPassword: string): Promise<void>;`
- 구현에 `setRiderCredential: (id, newPassword) => request<void>(\`/riders/\${id}/credential\`, { method: "PATCH", body: JSON.stringify({ newPassword }) })` (실제 request 헬퍼 시그니처에 맞춰 조정; 204 응답 처리 방식은 기존 PATCH/DELETE 메서드 따라).

### Step 6: app/management/riders/actions.ts
기존 액션 패턴(인증 admin 클라이언트 생성) 따라:
```ts
export async function resetRiderCredentialAction(riderId: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: string }> {
  // createAuthenticatedServiceOpsApiClient() → client.setRiderCredential(riderId, newPassword)
  // 성공 { ok: true }, 실패 시 메시지
}
```
(기존 actions.ts의 다른 rider 액션 시그니처/에러 처리 패턴을 그대로 따를 것 — READ first.)

### Step 7: components/management/RiderDetailDialog.tsx
READ first. 다이얼로그 내 적절한 위치에 "비밀번호 재설정" 섹션 추가: 새 비번 input(8자+) + 버튼 → resetRiderCredentialAction(riderId, pw) 호출(useTransition) → 성공/오류 메시지. 기존 다이얼로그의 상태/스타일 패턴 따름.

### Step 8: 검증 + 커밋
`cd development/front-admin-web && npm run typecheck && npm run lint && npm run build` 통과 + `/rider/password` 라우트 생성. 경쟁 dev 서버 금지.
`git add -A && git commit -m "feat(rider): password-change page + admin reset UI"`

---

## Self-Review
- 스펙 커버: A(엔드포인트+페이지), B(admin 재설정 UI). 일치.
- 타입: RiderPasswordChangeRequest(current,new) ↔ riderChangePassword 인자. setRiderCredential ↔ PATCH {newPassword}.
- 보안/arch: /rider/** RIDER 게이트(변경 없음), RiderSelfCommandController allow-list 추가.
- Placeholder: 일부 프론트 식별자(request 헬퍼·actions 패턴·다이얼로그 구조)는 "READ first"로 표기 — 구현 시 실제에 맞춤.
