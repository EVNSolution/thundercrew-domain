# 모바일 백엔드 프록시 (라이더 앱 → prod 백엔드) Design

**Date:** 2026-07-06
**Branch:** `cc-mobile-backend-proxy` (off `dev`)
**Status:** Approved (design)
**대상:** `development/frontend` (프록시 라우트 + 미들웨어) + `development/app` (base URL)

---

## 1. 배경 / 문제

라이더 앱이 prod 백엔드에 닿을 **공개 네트워크 경로가 없다**. 검증(2026-07-06):
- `POST https://thcr.cleversystem.ai/api/v1/rider-auth/login` → **307 → /login**. `thcr.cleversystem.ai`는 Next.js 프론트이고, 미들웨어(matcher가 정적자산 외 전부)가 세션 쿠키 없는 `/api/*`를 전부 `/login`으로 리다이렉트. 예외는 `/api/otoplug/`뿐.
- Spring 백엔드(:8080)는 nginx가 프록시 안 함(프론트 127.0.0.1:3000만). `:8080` 직접·`api.` 서브도메인 모두 미노출.
- → 폰 로그인은 백엔드를 prod 배포해도 "HTTP unknown"으로 실패.

백엔드는 **역할 기반 JWT**로 잠겨 있어(`SecurityConfig`: permitAll=login/refresh/register/telemetry, `/api/v1/rider/**`=RIDER, 나머지=ADMIN) **공개해도 안전**. 네트워크 격리가 아니라 인증으로 보호됨.

## 2. 목표 / 비목표

**목표:** 라이더 앱이 prod 백엔드의 rider-auth·rider 엔드포인트를 호출할 수 있게, 프론트에 얇은 프록시 경로를 추가한다(otoplug 우회 선례 그대로). 앱은 base URL만 바꾼다.

**비목표:**
- admin 엔드포인트 노출(allowlist로 rider 전용만) — 비목표.
- nginx/서브도메인 신설(서버 SSH 필요) — 이번엔 프론트 프록시로. 후속 최적화로 남김.
- 앱 클라이언트 로직 변경 — base URL 교체로 충분(경로 조립은 그대로).

## 3. 설계

### 3-1. 프록시 라우트 (신규)
`development/frontend/app/mobile-api/[...path]/route.ts`
- `export const dynamic = "force-dynamic";`
- 단일 `handler(req, context)`를 GET/POST/PATCH/PUT/DELETE로 export.
- **allowlist:** `path.join("/")`가 `api/v1/rider-auth/` 또는 `api/v1/rider/`로 시작할 때만 통과. 아니면 404. (admin 경로 엣지 차단.)
- 타깃: `${SERVICE_OPS_API_BASE_URL(끝슬래시제거)}/${joined}` + 원본 쿼리스트링(`new URL(req.url).search`).
- 전달 헤더: `Authorization`(Bearer JWT)·`Content-Type`만. 프론트 세션 쿠키는 **전달 안 함**.
- body: GET/HEAD 외엔 `req.arrayBuffer()`로 그대로 전달.
- `fetch(target, { method, headers, body, cache: "no-store", redirect: "manual" })`.
- 응답: 백엔드 status + body(arrayBuffer) + `Content-Type` 헤더를 그대로 반환. upstream 연결 실패 시 502.

### 3-2. 미들웨어 우회
`development/frontend/middleware.ts` — otoplug 우회 직후에 추가:
```ts
if (pathname.startsWith("/mobile-api/")) {
  return NextResponse.next();
}
```
없으면 `/mobile-api/*`도 `/login`으로 307됨.

### 3-3. 앱 base URL
`EXPO_PUBLIC_THUNDERCREW_SERVICE_OPS_BASE_URL`:
`https://thcr.cleversystem.ai` → **`https://thcr.cleversystem.ai/mobile-api`**
- `development/app/.env`(사용자 로컬, gitignore) + `development/app/.env.example`(커밋).
- 클라이언트가 `${base}/api/v1/rider-auth/login` = `/mobile-api/api/v1/rider-auth/login` 조립 → 라우트 `[...path]`=`api/v1/rider-auth/login` → allowed → 백엔드 `…/api/v1/rider-auth/login`.
- dev-client는 **Metro 재시작**으로 새 값 반영(EXPO_PUBLIC은 번들타임 인라인). 네이티브 재빌드 불필요.

## 4. 보안

- 백엔드가 역할 JWT로 인증 → 프록시는 dumb pass-through. permitAll(login/refresh)만 무인증 통과, rider 엔드포인트는 앱이 보낸 JWT 필요.
- allowlist가 `api/v1/rider-auth/`·`api/v1/rider/` 외(=admin) 전부 404로 차단 → 노출면 최소.
- 세션 쿠키 미전달 → 프론트 관리자 세션이 백엔드로 새지 않음.
- 네이티브 앱이라 CORS 불필요.

## 5. 손대는 파일

| 파일 | 변경 |
|------|------|
| `frontend/app/mobile-api/[...path]/route.ts` | 신규 프록시(allowlist + pass-through) |
| `frontend/middleware.ts` | `/mobile-api/` 우회 1줄 |
| `app/.env.example` | base URL `/mobile-api` 예시 |
| `app/.env` (사용자 로컬) | base URL `/mobile-api` (커밋 안 함) |

## 6. 검증 계획

- **로컬:** 프론트 `tsc`/lint/`next build` green(라우트·미들웨어 컴파일 확인). 로컬은 실 백엔드 없어 E2E 불가(프론트 SERVICE_OPS_API_BASE_URL=localhost:8080).
- **prod 배포 후(dev→main, 사용자 게이트):** `curl -X POST …/mobile-api/api/v1/rider-auth/login -d '{가짜}'` → **401**(백엔드 도달, 307/404 아님) 확인. rider 엔드포인트는 토큰 없이 401/403.
- **폰:** 앱 `.env` base URL 교체 + Metro 재시작 + 실 라이더 전화+이름으로 로그인 → 배차 목록까지.

## 7. 트레이드오프

모바일 트래픽이 Next.js를 한 홉 경유(라이더 앱엔 무해). 엔드포인트가 늘면 allowlist만 확장. 장기적으로 트래픽이 커지면 nginx 직결(서브도메인)로 이전 가능(백엔드가 이미 안전하게 공개 가능하므로 언제든).
