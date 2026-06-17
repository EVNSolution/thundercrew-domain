# 라이더 앱 서브도메인 분리 — 설계

## 목표
라이더 웹앱을 관리자 콘솔과 **별도 호스트(`rider.thcr.cleversystem.ai`)** 로 분리한다. 코드베이스는 단일 `front-admin-web` 그대로 두고(공유 타입·서버액션·배포 1개 유지), **호스트네임으로 동작을 분기**한다. 목적: 쿠키 격리, 모바일 PWA 정체성, 라이더가 관리자 도메인의 존재를 모르게.

현재 상태(이미 prod): 단일 Next 앱이 `thcr.cleversystem.ai`(EC2 systemd `thundercrew-front-admin-web` + nginx)에서 admin + `/rider/*`를 함께 서빙. 인증은 이미 분리됨(admin 쿠키 `thundercrew_ops_*`/role=ADMIN vs 라이더 쿠키 `thundercrew_rider_*`/role=RIDER, 로그인 페이지 별도).

## 아키텍처
하나의 Next 프로세스(127.0.0.1:3000)가 두 호스트를 서빙하고 nginx가 호스트별로 같은 업스트림에 프록시한다.
- `thcr.cleversystem.ai` → 관리자 (기존 그대로)
- `rider.thcr.cleversystem.ai` → 라이더 앱

라이더 경로는 `/rider/*`를 **유지**한다(예: `rider.thcr.cleversystem.ai/rider/login`). 프리픽스를 숨겨 `/login`으로 만드는 건 다수 내부 링크 수정이 필요해 이번 범위에서 제외(YAGNI).

## ① 코드 변경 — 호스트 인지 미들웨어 (`development/front-admin-web/middleware.ts`)

호스트 판정 헬퍼: 요청 호스트의 첫 라벨이 `rider`이면 라이더 호스트로 본다.
```ts
function isRiderHost(request: NextRequest): boolean {
  const host = (request.headers.get("host") ?? request.nextUrl.hostname).toLowerCase();
  const label = host.split(":")[0].split(".")[0];
  return label === "rider";
}
```
(환경변수 불필요. `rider.*` 어떤 호스트에도 동작. 로컬 `localhost`는 라이더 호스트가 아니므로 기존 경로 기반 동작 유지 → 로컬 개발 영향 없음.)

`middleware()` 분기 규칙:
- **라이더 호스트일 때**:
  - `pathname`이 `/rider`/`/rider/*` → 기존 `riderGate(request, pathname)` 그대로 적용.
  - `pathname === "/"` → `/rider/login`으로 redirect (라이더 진입점).
  - 그 외 비-`/rider` 경로(예: `/login`, `/management`, admin 경로) → `/rider`로 redirect. (라이더 호스트에 관리자 경로 노출 안 함.)
- **관리자 호스트일 때**(현행 + 가드 추가):
  - `pathname`이 `/rider`/`/rider/*` → admin 호스트엔 라이더 경로가 없으므로 `/`로 **redirect**(이후 기존 admin 게이트가 미인증 시 `/login`으로 보냄). 미들웨어 404의 soft-200 모호함을 피하려 redirect로 통일.
  - 그 외 → 기존 admin 게이트 로직 그대로.

라우팅 정적 자산 매처(`config.matcher`)는 현행 유지(정적/`_next` 제외).

**쿠키 격리**: 라이더 쿠키는 Domain 속성 없이(host-only) 설정 중이므로, 라이더 서브도메인에서 발급되면 자동으로 admin 도메인과 분리된다. 코드 변경 불필요. `secure`는 prod(NODE_ENV=production)에서 이미 true.

## ② 인프라 (EC2/DNS — 레포 밖, 코드 아님)
레포에 nginx 설정이 없고 EC2 박스에 있으므로, 아래는 **사용자가 EC2/DNS에 적용**한다. 적용에 필요한 설정 블록·명령은 구현 산출물로 함께 제공한다(문서/스니펫). 배포 워크플로(`aws-ec2-deploy.yml`)는 같은 앱이라 변경 없음.

1. **DNS**: `rider.thcr.cleversystem.ai` A 레코드 → `3.35.123.221`.
2. **nginx**: 기존 admin server block을 복제한 라이더 호스트 server block 추가 — `server_name rider.thcr.cleversystem.ai;`, 동일하게 `proxy_pass http://127.0.0.1:3000;`(같은 업스트림). admin과 동일 프록시 헤더(Host/X-Forwarded-*).
3. **TLS**: `sudo certbot --nginx -d rider.thcr.cleversystem.ai`로 인증서 발급/자동 갱신.

> 주의: nginx가 `Host` 헤더를 업스트림에 그대로 전달해야(`proxy_set_header Host $host;`) 미들웨어의 호스트 판정이 동작한다. admin 블록이 이미 그렇게 설정돼 있을 것이므로 동일 패턴 복제.

## 검증
- **코드(로컬/CI 빌드)**: `typecheck`/`lint`/`build`. 로컬에서 host 헤더로 분기 동작 단위 확인 가능(`curl -H "Host: rider.thcr.cleversystem.ai" localhost:3000/` 등은 EC2 적용 후).
- **prod(인프라 적용 후, 사용자)**:
  - `https://rider.thcr.cleversystem.ai/` → `/rider/login`(200, 로그인 폼)
  - `https://rider.thcr.cleversystem.ai/management` → `/rider`로 redirect (관리자 경로 차단)
  - `https://thcr.cleversystem.ai/rider/login` → `/`로 redirect → (미인증 시) `/login` (admin 호스트에선 라이더 경로 차단)
  - `https://thcr.cleversystem.ai/login` → 기존 관리자 로그인 정상
  - 라이더 로그인 후 발급된 쿠키가 admin 도메인 요청에 실리지 않음(host-only).

## 범위 밖
- PWA manifest/Service Worker (P3)
- 프리픽스 숨김(`rider.../login`) — 후속 폴리시
- `thundercrew-domain.vercel.app` 잔재 폐기 — 별도
- nginx 설정의 레포 편입(infra-as-code) — 현행 on-box 유지
