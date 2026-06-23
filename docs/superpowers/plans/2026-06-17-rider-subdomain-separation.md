# 라이더 서브도메인 분리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 단일 `front-admin-web` 앱이 호스트네임으로 admin/rider를 분기하도록 미들웨어를 호스트 인지로 바꾸고, 라이더 서브도메인용 nginx/DNS/TLS 적용 절차를 문서화한다.

**Architecture:** 코드 변경은 `middleware.ts` 1파일(호스트 판정 + 분기). 인증 게이트(`riderGate`/admin gate)·쿠키·헬퍼는 그대로 재사용. nginx/DNS/certbot은 EC2/외부 적용이라 레포엔 적용 절차 문서만 추가.

**Tech Stack:** Next.js(미들웨어, Edge), nginx, certbot.

---

### Task 1: 호스트 인지 미들웨어

**Files:**
- Modify: `development/front-admin-web/middleware.ts`

설계 규칙(스펙 `docs/superpowers/specs/2026-06-17-rider-subdomain-separation-design.md`):
- `isRiderHost`: 요청 호스트 첫 라벨이 `rider`이면 true. `localhost` 등은 false → 로컬 경로 기반 동작 유지.
- 라이더 호스트: `/rider*`→`riderGate`; `/`→`/rider`로 redirect; 그 외→`/rider`로 redirect.
- 관리자 호스트: `/rider*`→`/`로 redirect; 그 외→기존 admin 게이트.

- [ ] **Step 1: `isRiderHost` 헬퍼 추가** (`middleware.ts`, 헬퍼 영역)

```ts
function isRiderHost(request: NextRequest): boolean {
  const host = (request.headers.get("host") ?? request.nextUrl.hostname).toLowerCase();
  const label = host.split(":")[0].split(".")[0];
  return label === "rider";
}
```

- [ ] **Step 2: `middleware()` 진입부를 호스트 분기로 교체**

기존:
```ts
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 라이더 앱 경로는 운영자 게이트와 완전히 분리해서 처리한다.
  if (pathname === "/rider" || pathname.startsWith("/rider/")) {
    return riderGate(request, pathname);
  }

  const accessToken = request.cookies.get(SERVICE_OPS_ACCESS_TOKEN_COOKIE)?.value;
```
교체 후:
```ts
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const riderHost = isRiderHost(request);
  const isRiderPath = pathname === "/rider" || pathname.startsWith("/rider/");

  // 라이더 서브도메인(rider.*): 이 호스트는 라이더 앱 전용.
  if (riderHost) {
    if (isRiderPath) {
      return riderGate(request, pathname);
    }
    // 비-/rider 경로(루트·관리자 경로 등)는 라이더 앱으로 흡수.
    return NextResponse.redirect(new URL("/rider", request.url));
  }

  // 관리자 호스트: 라이더 경로는 이 호스트에 존재하지 않음 → 루트로.
  if (isRiderPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const accessToken = request.cookies.get(SERVICE_OPS_ACCESS_TOKEN_COOKIE)?.value;
```
(이후 admin 게이트 로직은 기존 그대로 유지. `riderGate`/`refreshRiderAccessToken`/`clearRiderCookiesAndRedirect`/admin 헬퍼 모두 변경 없음.)

- [ ] **Step 3: 빌드 검증**

Run (`development/front-admin-web`): `npm run typecheck && npm run lint && npm run build`
Expected: 통과. `/rider`·`/rider/login` 라우트 여전히 생성. 미들웨어(Proxy) 빌드 OK.

- [ ] **Step 4: 동작 검증 (로컬, 선택)** — `next start` 후 Host 헤더로 분기 확인

```
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "Host: rider.thcr.cleversystem.ai" http://localhost:3000/        # → 307 .../rider
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "Host: rider.thcr.cleversystem.ai" http://localhost:3000/rider   # → 307 .../rider/login (미인증)
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "Host: thcr.cleversystem.ai"       http://localhost:3000/rider/login  # → 307 .../  (admin 호스트)
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "Host: thcr.cleversystem.ai"       http://localhost:3000/login   # → 200/정상 admin
```
(사용자가 자체 dev 서버를 돌리므로, 경쟁 서버를 띄우지 말 것. 빌드 통과로 1차 확인하고 prod에서 최종 검증.)

- [ ] **Step 5: 커밋**

```
git add development/front-admin-web/middleware.ts
git commit -m "feat(rider): host-aware middleware for rider subdomain"
```

---

### Task 2: nginx / DNS / TLS 적용 절차 문서

**Files:**
- Create: `docs/deploy/rider-subdomain-setup.md`

- [ ] **Step 1: 문서 작성** — 아래 내용 그대로

```markdown
# rider.thcr.cleversystem.ai 서브도메인 셋업 (EC2)

라이더 웹앱을 별도 호스트로 노출. 코드(미들웨어)는 host로 분기하므로 같은
Next 업스트림(127.0.0.1:3000)에 프록시하면 된다. admin server block을 복제.

## 1) DNS
`rider.thcr.cleversystem.ai` A 레코드 → `3.35.123.221`

## 2) nginx server block (admin 블록 복제, server_name만 변경)
/etc/nginx/sites-available/ 의 기존 admin 블록을 복사해 새 파일 생성:

    server {
        server_name rider.thcr.cleversystem.ai;
        location / {
            proxy_pass http://127.0.0.1:3000;
            proxy_http_version 1.1;
            proxy_set_header Host $host;            # 미들웨어 호스트 판정에 필수
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }

(기존 admin 블록의 proxy_set_header 세트를 그대로 따르되 server_name만 교체.
proxy_set_header Host $host 가 빠지면 미들웨어가 라이더 호스트를 인식 못 함.)

활성화: `sudo ln -s ../sites-available/<file> /etc/nginx/sites-enabled/ && sudo nginx -t`

## 3) TLS
`sudo certbot --nginx -d rider.thcr.cleversystem.ai`
(certbot이 443 server block + 인증서 + 자동 갱신을 구성)

## 4) reload
`sudo systemctl reload nginx`

## 5) 검증
- https://rider.thcr.cleversystem.ai/         → 307 → /rider/login → 200(로그인 폼)
- https://rider.thcr.cleversystem.ai/management → 307 → /rider
- https://thcr.cleversystem.ai/rider/login    → 307 → / → (미인증) /login
- https://thcr.cleversystem.ai/login          → 정상(admin)
```

- [ ] **Step 2: 커밋**

```
git add docs/deploy/rider-subdomain-setup.md
git commit -m "docs: rider subdomain nginx/DNS/TLS setup steps"
```

---

## Self-Review
- 스펙 커버: 호스트 분기(Task1), 인프라 절차(Task2). 쿠키 격리는 host-only로 자동(코드 변경 없음) — 스펙과 일치.
- 타입 일관성: `isRiderHost(request: NextRequest)`, `riderGate(request, pathname)` 기존 시그니처 재사용.
- Placeholder 없음. 실제 호스트(`rider.thcr.cleversystem.ai`)·IP(`3.35.123.221`) 명시.
