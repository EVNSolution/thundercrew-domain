# 라이더 로그인: 국가선택 전화 + 이름 매칭 인증 Design

**Date:** 2026-07-02
**Branch:** `cc-rider-login-name-auth` (off `dev`)
**Status:** Approved (design), pending spec review
**대상:** `development/backend` riderauth + `development/app` LoginScreen

---

## 1. 배경 / 결정

라이더 앱 MVP-1 로그인이 현재 **전화번호 + 비밀번호**다. 실기기 QA에서 두 문제 확인:
1. 전화 입력이 E.164(`+82…`) 강제라 한국 라이더가 `010…`을 치면 거부됨(국가 선택 UI 없음).
2. 라이더는 운영자가 사전 등록(matching/excel)하는 내부 사용자라 비밀번호 설정 단계가 번거로움.

**결정(사용자 승인):** 로그인을 **국가 선택 전화 + 이름 매칭**으로 바꾼다. 비밀번호를 **이름(rider.name) 매칭으로 완전 대체**한다(약한 인증 = 내부 라이더 본인 식별 용도, 승인됨).

기존 백엔드에 이미 매칭 패턴 존재: `RiderAuthService.register`가 `findActiveByNormalizedPhone(phone)` → `.filter(r → r.getName().trim().equals(name.trim()))` 로 전화+이름을 맞춘다. 이 검증을 login에 재사용한다.

---

## 2. 목표 / 비목표

**목표**
- 앱 로그인: **국가 선택(기본 KR/+82) + 로컬 전화번호 + 이름** → 전화+이름이 DB rider와 일치하면 JWT 발급.
- 전화 정규화가 **E.164(`+82…`)와 로컬(`010…`)을 동치**로 매칭.

**비목표**
- 비밀번호 인프라(`RiderCredential`/`register`/`changePassword`/`POST /me/password`) 물리 삭제 — 이번엔 **고아로 남김**(정리는 후속). login만 name 매칭으로 전환.
- 국가 선택 다국가 지원 확장 — 인프라(`DRIVER_PHONE_COUNTRIES`)는 이미 다국가지만 기본/주 사용은 KR.
- 강한 인증(OTP·비번) — 범위 밖(요청이 이름 매칭).

---

## 3. 백엔드 (riderauth)

**접근안:** (A·채택) 기존 `POST /api/v1/rider-auth/login` 을 name 매칭으로 **재활용**. 앱이 유일 소비자라 새 엔드포인트 없이 깔끔. (B) `/login-by-name` 신설은 엔드포인트만 늘어 기각.

- **`RiderLoginRequest`**: `{ phoneNumber, name }` (기존 `password` 제거). `@NotBlank` phoneNumber·name.
- **`RiderAuthService.login(request)`**:
  ```
  Rider rider = riderRepository.findActiveByNormalizedPhone(canonicalizePhone(request.phoneNumber()))
      .filter(r -> r.getName() != null && r.getName().trim().equals(request.name().trim()))
      .orElseThrow(RiderAuthenticationException::new);
  return issueTokens(rider);
  ```
  (password/credential 조회 제거. register의 매칭과 동일 규칙 — trim 후 정확 일치.)
- **전화 정규화 보강 (핵심)**: 현재 `normalizePhone = replaceAll("[^0-9]","")` 는 `+82…`(`8210…`)와 로컬 `010…` 을 다르게 만든다. **양쪽을 한국 national significant number 로 정규화**해 매칭:
  - 규칙: 숫자만 추출 → 선행 국가코드 `82` 제거 → 선행 `0` 제거. 예: `+821041775801`→`1041775801`, `010-4177-5801`→`1041775801` (일치).
  - 구현: 저장측/입력측 동일 정규화. 저장측은 repo 쿼리에서 정규화(예: `right(digits,10)` 비교 또는 canonical 컬럼식) — **입력·저장 모두 canonical(national significant) 로 비교**. KR 외 번호는 국가코드 길이가 달라 완전 일반화는 후속; MVP는 KR 규칙 + 안전 폴백(정규화 실패 시 digits-only 동등 비교).
- **계약테스트**(`RiderDriverApiContractTests` 또는 riderauth 테스트): (a) 전화+이름 일치 → 200 + 토큰, (b) 이름 불일치 → 401, (c) 전화가 E.164(`+82…`)든 로컬(`010…`)든 같은 rider 매칭, (d) 미등록 전화 → 401.

## 4. 앱 (`development/app` LoginScreen)

- **전화 입력 = 국가 선택 + 로컬번호**: 기존 `src/domain/phone/phoneEntry.ts`(`normalizeDriverPhoneEntry({countryIso2, nationalPhoneInput})` → `{ok, phoneE164}`) + `src/ui/components/countrySelectorBehavior.ts` + `DRIVER_PHONE_COUNTRIES` 재사용. **기본 국가 KR(+82)**. 국가 선택 버튼(캘링코드 표시) + 로컬번호 입력 → E.164 조합.
- **비밀번호 필드 → 이름 필드**로 교체.
- 제출: `phoneE164`(정규화 성공 시) + `name` → `login({ phoneNumber, name })`. 정규화 실패(빈/형식오류) 시 인라인 에러.
- 상태/에러: 로딩·실패(401 → "전화번호 또는 이름이 일치하지 않습니다") 처리.

## 5. 앱 클라이언트/도메인 배선

- `src/api/thundercrew/riderAuthClient.ts`: `login({ phoneNumber, name })` (기존 `{phoneNumber, password}` → name). `RiderAuthTokens` 반환 동일.
- `src/domain/riderAuth/riderAuth.ts` `loginRider`: 입력 `{phoneNumber, name}`. 전화 E.164 검증 유지, **password 검증 제거 → name 필수 검증**. 401 → `invalid_credentials`.
- `src/domain/session/riderSession.ts` `loginAndPersist`: 입력 `{phoneNumber, name}`. 나머지 동일(토큰 저장).
- 관련 `*.test.ts` 갱신(password→name).

## 6. 보안 메모

phone+name은 **약한 인증**(이름은 비밀이 아님). 내부 라이더 앱(운영자 사전 등록, 배포 대상 한정)에서 **본인 식별** 용도로 사용자 승인. 강한 인증이 필요해지면 OTP/비번을 후속 도입(비번 인프라는 남겨둠).

## 7. 손대는 파일 요약

| 파일 | 변경 |
|------|------|
| `riderauth/dto/RiderLoginRequest.java` | `{phoneNumber, name}` (password 제거) |
| `riderauth/service/RiderAuthService.java` | `login` name 매칭 + 전화 canonical 정규화 |
| `rider/repository/RiderRepository.java` | 전화 매칭 쿼리 canonical(national) 비교 |
| `RiderDriverApiContractTests` (해당 테스트) | login name 매칭·전화 동치 검증 |
| 앱 `src/ui/screens/LoginScreen.tsx` | 국가선택 전화 + 이름 필드 |
| 앱 `src/api/thundercrew/riderAuthClient.ts` | `login({phoneNumber, name})` |
| 앱 `src/domain/riderAuth/riderAuth.ts` (+test) | name 검증 |
| 앱 `src/domain/session/riderSession.ts` (+test) | `{phoneNumber, name}` |

## 8. 검증 계획

- 백엔드: `./gradlew.bat compileJava compileTestJava` + (Docker 있으면) riderauth 계약테스트. ⚠️ 계약테스트는 Docker 필요 → 로컬/배포 후. 백엔드 변경은 **prod 배포(dev→main) 후에야 앱이 실제 매칭 로그인 가능**.
- 앱: `npm run typecheck` + `npm run lint` + `npx tsx --test`. Metro 핫리로드로 실기기에서 **국가선택+이름 UI 즉시 확인**(로그인 성공은 백엔드 prod 반영 후).
