# 라이더 로그인 국가선택 전화 + 이름 매칭 인증 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 라이더 앱 로그인을 전화번호+비밀번호에서 **국가선택 전화번호 + 이름 매칭**으로 바꾼다(비밀번호 대체).

**Architecture:** 백엔드 `rider-auth/login`을 `{phoneNumber, name}`로 바꿔 rider.name과 매칭(register와 동일 규칙), 전화는 `+82`↔`010` 동치가 되도록 canonical(national significant) 정규화. 앱 LoginScreen은 기존 `phoneEntry`/`countrySelectorBehavior` 인프라로 국가선택+로컬번호→E.164 조합, 비밀번호 필드를 이름 필드로 교체.

**Tech Stack:** Spring Boot/Java 21 (JPA native query), Expo 54/RN 0.81/TS.

> **환경:** 메인 체크아웃 `C:\Users\user\repositories\clever\thundercrew-domain`, branch `cc-rider-login-name-auth`(off dev). Bash=git-bash. 백엔드 검증 `./gradlew.bat compileJava compileTestJava`(Docker 없어 계약테스트 실행 불가 → compile 게이트). 앱 `cd development/app && npm run typecheck && npm run lint`, 테스트는 래퍼 깨져 `npx tsx --test $(find src -name "*.test.ts")`. **Metro가 이 체크아웃을 감시 중이라 앱 파일 수정 시 폰 핫리로드.** 경쟁 dev서버 금지(백엔드/프론트). 앱 실제 로그인 성공은 백엔드 prod 배포 후.

> **참고 사실:**
> - 현재 `RiderLoginRequest` = `{ @NotBlank phoneNumber, @NotBlank password }`.
> - `RiderAuthService.login`: `findActiveByNormalizedPhone(normalizePhone(phone))` → credential/password 검증 → `issueTokens`. `normalizePhone = replaceAll("[^0-9]","")`.
> - `RiderAuthService.register`: `findActiveByNormalizedPhone(...)` → `.filter(r -> r.getName()!=null && r.getName().trim().equals(request.name().trim()))` → credential 생성. **이 name 매칭을 login으로 옮긴다.**
> - repo: `findActiveByNormalizedPhone` = `select * from riders where regexp_replace(phone_number,'[^0-9]','','g') = :digits and deleted_at is null limit 1`.
> - 앱: `src/domain/phone/phoneEntry.ts` → `normalizeDriverPhoneEntry(input)` returns `{ok:true, countryIso2, phoneE164} | {ok:false, reason}`; `DRIVER_PHONE_COUNTRIES`(KR 포함), `findDriverPhoneCountry(iso2)`. `src/ui/components/countrySelectorBehavior.ts` → `getSelectedCountryCardText`, `getCountrySelectorRowText`, `COUNTRY_SELECTOR_OVERLAY_BEHAVIOR`.
> - `RiderAuthTokens` unchanged. `loginRider`/`loginAndPersist` 반환 계약 동일(입력만 password→name).

---

## File Structure

**백엔드**
- `riderauth/dto/RiderLoginRequest.java` — `{phoneNumber, name}`.
- `riderauth/service/RiderAuthService.java` — `login` name 매칭 + `canonicalizePhone` 헬퍼.
- `rider/repository/RiderRepository.java` — canonical 매칭 쿼리(신규 메서드 또는 기존 교체).
- 테스트: `RiderDriverApiContractTests.java`(존재 시) 또는 riderauth 계약테스트 파일.

**앱**
- `src/api/thundercrew/riderAuthClient.ts` — `login({phoneNumber, name})`.
- `src/domain/riderAuth/riderAuth.ts` (+`.test.ts`) — `loginRider` name.
- `src/domain/session/riderSession.ts` (+`.test.ts`) — `{phoneNumber, name}`.
- `src/ui/screens/LoginScreen.tsx` — 국가선택 + 이름.

---

## Task 1: 백엔드 — 로그인 DTO + name 매칭 + 전화 canonical 정규화

**Files:** `riderauth/dto/RiderLoginRequest.java`, `riderauth/service/RiderAuthService.java`, `rider/repository/RiderRepository.java`

- [ ] **Step 1: DTO 교체**

`RiderLoginRequest.java` 전체:
```java
package com.thundercrew.opsapi.riderauth.dto;

import jakarta.validation.constraints.NotBlank;

public record RiderLoginRequest(
        @NotBlank String phoneNumber,
        @NotBlank String name
) {
}
```

- [ ] **Step 2: repo에 canonical 매칭 쿼리 추가**

`RiderRepository.java` — `findActiveByNormalizedPhone` 아래에 추가(import 기존 `@Query`/`@Param` 사용). 저장 전화를 입력과 동일 규칙(숫자만 → 선행 `82` 제거 → 선행 `0` 제거)으로 정규화해 비교:
```java
    /**
     * 전화번호를 한국 national significant number 로 정규화해 비교한다: 숫자만 추출 → 선행 국가코드 82 제거
     * → 선행 0 제거. E.164(+82…)와 로컬(010…)이 같은 rider 로 매칭되도록.
     */
    @Query(value = "select * from riders where "
            + "regexp_replace(regexp_replace(regexp_replace(phone_number, '[^0-9]', '', 'g'), '^82', ''), '^0', '') = :canonical "
            + "and deleted_at is null limit 1", nativeQuery = true)
    Optional<Rider> findActiveByCanonicalPhone(@Param("canonical") String canonical);
```

- [ ] **Step 3: 서비스 login을 name 매칭 + canonical 정규화로 교체**

`RiderAuthService.java`:
- `normalizePhone` 옆에 canonical 헬퍼 추가:
```java
    /** 숫자만 → 선행 국가코드 82 제거 → 선행 0 제거 (repo 쿼리와 동일 규칙). */
    private static String canonicalizePhone(String phoneNumber) {
        if (phoneNumber == null) {
            return "";
        }
        String digits = phoneNumber.replaceAll("[^0-9]", "");
        if (digits.startsWith("82")) {
            digits = digits.substring(2);
        }
        if (digits.startsWith("0")) {
            digits = digits.substring(1);
        }
        return digits;
    }
```
- `login` 교체(password/credential 조회 제거, name 매칭):
```java
    @Transactional(readOnly = true)
    public RiderLoginResponse login(RiderLoginRequest request) {
        Rider rider = riderRepository.findActiveByCanonicalPhone(canonicalizePhone(request.phoneNumber()))
                .filter(r -> r.getName() != null && r.getName().trim().equals(request.name().trim()))
                .orElseThrow(RiderAuthenticationException::new);
        return issueTokens(rider);
    }
```
- (register/changePassword/credential은 그대로 둔다 — 이번엔 미사용이지만 삭제 안 함. `passwordEncoder`/`riderCredentialRepository` 필드가 login에서 안 쓰여도 register 등에서 여전히 쓰이므로 제거하지 말 것.)

- [ ] **Step 4: 컴파일 검증**

Run: `cd development/backend && ./gradlew.bat compileJava`
Expected: `BUILD SUCCESSFUL`. (`RiderLoginRequest.password()` 참조가 login에서 사라졌으므로 다른 참조 없어야 함 — 있으면 그 호출부도 name으로 정리.)

- [ ] **Step 5: 커밋**
```bash
cd development/backend && git add src/main/java/com/thundercrew/opsapi/riderauth/dto/RiderLoginRequest.java src/main/java/com/thundercrew/opsapi/riderauth/service/RiderAuthService.java src/main/java/com/thundercrew/opsapi/rider/repository/RiderRepository.java
git commit -m "feat(riderauth): 로그인을 전화+이름 매칭으로 전환 + 전화 canonical(+82↔010) 정규화"
```

---

## Task 2: 백엔드 — 로그인 계약테스트 갱신

**Files:** 로그인을 테스트하는 계약테스트 파일. **착수 전** `grep -rl "rider-auth/login" development/backend/src/test` 로 파일을 찾고, 없으면 riderauth 관련 `*ContractTests.java`(예: `RiderDriverApiContractTests`)를 연다. 기존 login 테스트(전화+비번)를 전화+이름으로 교체하고 아래 케이스 추가.

- [ ] **Step 1: 테스트 케이스 작성/갱신**

시드된 rider(이름·전화 있는 레코드; 기존 테스트의 시드 헬퍼 재사용)에 대해:
```java
// 전화(E.164) + 이름 일치 → 200 + accessToken
mockMvc.perform(post("/api/v1/rider-auth/login")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"phoneNumber\":\"+821012345678\",\"name\":\"홍길동\"}"))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.accessToken").isString());

// 같은 rider 를 로컬 형식(010…)으로도 매칭 → 200
mockMvc.perform(post("/api/v1/rider-auth/login")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"phoneNumber\":\"010-1234-5678\",\"name\":\"홍길동\"}"))
    .andExpect(status().isOk());

// 이름 불일치 → 401
mockMvc.perform(post("/api/v1/rider-auth/login")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"phoneNumber\":\"+821012345678\",\"name\":\"다른이름\"}"))
    .andExpect(status().isUnauthorized());

// 미등록 전화 → 401
mockMvc.perform(post("/api/v1/rider-auth/login")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"phoneNumber\":\"+821099999999\",\"name\":\"홍길동\"}"))
    .andExpect(status().isUnauthorized());
```
(시드 rider의 전화/이름을 위 값에 맞추거나, 위 값을 시드에 맞춘다. 시드 rider가 로컬 `010-1234-5678` 저장이면 두 케이스 모두 매칭돼야 한다 — canonical 정규화 검증.)

- [ ] **Step 2: 컴파일 게이트**

Run: `cd development/backend && ./gradlew.bat compileTestJava`
Expected: `BUILD SUCCESSFUL`. (실행은 Docker 필요 → 로컬/배포 후 QA.)

- [ ] **Step 3: 커밋**
```bash
cd development/backend && git add src/test/java/com/thundercrew/opsapi/
git commit -m "test(riderauth): 로그인 전화+이름 매칭 + E.164↔로컬 동치 계약테스트"
```

---

## Task 3: 앱 — 클라이언트/도메인/세션 배선 (password → name)

**Files:** `src/api/thundercrew/riderAuthClient.ts`, `src/domain/riderAuth/riderAuth.ts` (+`.test.ts`), `src/domain/session/riderSession.ts` (+`.test.ts`)

- [ ] **Step 1: 클라이언트 login 시그니처 교체**

`riderAuthClient.ts`의 `RiderAuthService.login` 타입과 구현을 `{ phoneNumber, name }`로:
```ts
// 타입
login(input: { phoneNumber: string; name: string }): Promise<RiderAuthTokens>
// 구현 (request 본문)
login: (input) => request('/api/v1/rider-auth/login', input),
```
(`request`가 body를 그대로 JSON 직렬화하므로 `{phoneNumber, name}` 전달. `refresh`는 불변.)

- [ ] **Step 2: `loginRider` name 검증으로 교체**

`src/domain/riderAuth/riderAuth.ts` `loginRider`: 입력 `{ phoneNumber: string; name: string }`. 전화 E.164 검증(기존 `normalizeDriverPhoneEntry`/`tryAcceptE164`)은 유지, **password 검증부 → name 필수 검증**으로:
```ts
export async function loginRider(
  input: { phoneNumber: string; name: string },
  service: RiderAuthService,
): Promise<RiderAuthLoginResult> {
  // ...기존 phoneNumber 정규화/E.164 확보 로직 유지...
  if (phoneNumber === null) {
    return { kind: 'error', message: 'Enter a valid phone number including country code.' }
  }
  if (input.name.trim().length === 0) {
    return { kind: 'error', message: 'Name is required.' }
  }
  try {
    const tokens = await service.login({ phoneNumber, name: input.name.trim() })
    return { kind: 'success', tokens }
  } catch (err) {
    if (isDriverApiUnauthorizedError(err)) {
      return { kind: 'invalid_credentials' }
    }
    return { kind: 'error', message: err instanceof Error ? err.message : 'Login failed. Please try again.' }
  }
}
```
`riderAuth.test.ts`의 password 관련 케이스를 name으로 갱신(빈 name → error, 성공 시 service.login에 name 전달).

- [ ] **Step 3: 세션 loginAndPersist 입력 교체**

`src/domain/session/riderSession.ts` `loginAndPersist` 입력을 `{ phoneNumber, name }`로, `loginRider(credentials, deps.auth)` 호출 인자만 바꾼다(나머지 저장 로직 동일). `riderSession.test.ts`의 `{phoneNumber, password}` → `{phoneNumber, name}`.

- [ ] **Step 4: 검증**

Run: `cd development/app && npm run typecheck && npx tsx --test $(find src -name "*.test.ts")`
Expected: typecheck 통과, 테스트 전부 pass. (LoginScreen은 Task 4에서 password→name 바꾸므로 이 시점 typecheck에서 LoginScreen이 `password` 참조로 깨질 수 있음 — Task 4까지 이어서 완료 후 최종 typecheck. 구현자 판단으로 Task 3·4를 연속 완료.)

- [ ] **Step 5: 커밋**
```bash
cd development/app && git add src/api/thundercrew/riderAuthClient.ts src/domain/riderAuth/ src/domain/session/
git commit -m "feat(app): 라이더 로그인 클라이언트/도메인/세션 password→name 배선"
```

---

## Task 4: 앱 — LoginScreen 국가선택 전화 + 이름

**Files:** `src/ui/screens/LoginScreen.tsx`

> 착수 전 읽기: `src/domain/phone/phoneEntry.ts`(`normalizeDriverPhoneEntry` 입력 필드명 = `{countryIso2, nationalPhoneInput}` 확인), `src/ui/components/countrySelectorBehavior.ts`(`getSelectedCountryCardText`/`getCountrySelectorRowText`), 그리고 **기존 `src/app/AppRoot.tsx`의 국가선택 UI(Country + calling code 버튼 + 국가 리스트 모달)** 를 열어 그 컴포넌트/스타일 패턴을 참고·재사용(가능하면 그 phone-entry 서브컴포넌트를 추출해 공용화).

- [ ] **Step 1: LoginScreen 구현**

상태: `countryIso2`(기본 `'KR'`), `nationalPhoneInput`, `name`, `error`, `busy`, 국가선택 모달 open 여부. 제출 시:
```ts
const normalized = normalizeDriverPhoneEntry({ countryIso2, nationalPhoneInput })
if (!normalized.ok) { setError('전화번호를 확인해주세요.'); return }
const result = await loginAndPersist({ auth, store }, { phoneNumber: normalized.phoneE164, name })
```
- UI: 상단 "썬더크루 라이더", **국가 선택 버튼**(선택된 국가의 calling code 표시 — `getSelectedCountryCardText`/`findDriverPhoneCountry(countryIso2)`), **로컬 전화 입력**(`keyboardType="phone-pad"`), **이름 입력**(비밀번호 필드 대체, `secureTextEntry` 제거), 에러, 로그인 버튼.
- 국가 선택: `DRIVER_PHONE_COUNTRIES`를 모달/리스트로(간단히 RN `Modal` + `FlatList`, 행 텍스트 `getCountrySelectorRowText`), 선택 시 `setCountryIso2`. (기존 AppRoot 국가선택 컴포넌트를 추출해 쓰면 가장 좋음.)
- 결과 처리: `invalid_credentials` → "전화번호 또는 이름이 일치하지 않습니다.", 기타 → `result.message`. 성공 → `onLoggedIn(tokens.accessToken)`.

기존 LoginScreen의 password 관련(state·TextInput·에러문구) 전부 제거.

- [ ] **Step 2: 검증**

Run: `cd development/app && npm run typecheck && npm run lint && npx tsx --test $(find src -name "*.test.ts")`
Expected: 모두 통과.

- [ ] **Step 3: 폰 UI 확인(핫리로드)**

Metro가 이 체크아웃을 감시 중이므로 저장 시 폰에 반영. `adb exec-out screencap -p > <scratchpad>/login.png`로 캡처해 **국가선택(기본 KR/+82) + 이름 필드**가 뜨는지 육안 확인. (실제 로그인 성공은 백엔드 prod 배포 후.)

- [ ] **Step 4: 커밋**
```bash
cd development/app && git add src/ui/screens/LoginScreen.tsx
git commit -m "feat(app): LoginScreen 국가선택 전화 + 이름 입력"
```

---

## Task 5: 최종 검증 + PR(→dev)

- [ ] **Step 1: 백엔드 컴파일 게이트** — `cd development/backend && ./gradlew.bat compileJava compileTestJava` → BUILD SUCCESSFUL.
- [ ] **Step 2: 앱 게이트** — `cd development/app && npm run typecheck && npm run lint && npx tsx --test $(find src -name "*.test.ts")` → 모두 통과.
- [ ] **Step 3: 폰 스모크(핫리로드)** — 로그인 화면 국가선택+이름 UI 캡처 확인. 실제 매칭 로그인은 백엔드 prod 반영 후 별도.
- [ ] **Step 4: 푸시 + PR** —
```bash
cd "C:/Users/user/repositories/clever/thundercrew-domain" && git push -u origin cc-rider-login-name-auth
```
`gh pr create --base dev`(제목 `feat(riderauth+app): 라이더 로그인 전화+이름 매칭`). 본문: 검증 상태(compile green, 계약테스트 Docker/배포 QA, 앱 typecheck/lint/test 통과, 폰 UI 핫리로드 확인), 보안 메모(phone+name 약한 인증·승인됨), **백엔드 prod 배포 후에야 실제 로그인 가능** 명시. 그다음 **superpowers:finishing-a-development-branch**.

---

## Self-Review 결과

- **스펙 커버리지:** DTO(§3)=T1, login name 매칭+정규화(§3)=T1, repo 쿼리(§3)=T1, 계약테스트(§3)=T2, 앱 클라이언트/도메인/세션(§5)=T3, LoginScreen 국가선택+이름(§4)=T4, 검증(§8)=T5. 전부 매핑.
- **플레이스홀더:** 백엔드 코드 전량 구체. 앱 LoginScreen·loginRider는 기존 파일 구조에 맞춰 "파일 열어 확인 후 반영" 지시(외부/기존 시그니처 — `normalizeDriverPhoneEntry` 입력 필드명, AppRoot 국가선택 패턴). 구현자가 반드시 해당 파일 확인.
- **타입 일관성:** `RiderLoginRequest{phoneNumber,name}`(백)↔`login({phoneNumber,name})`(앱 클라)↔`loginRider({phoneNumber,name})`↔`loginAndPersist({phoneNumber,name})` 일관. `canonicalizePhone`(Java)와 repo 쿼리 정규화 규칙(숫자만→^82→^0) 동일.
