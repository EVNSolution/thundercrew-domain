# 새 관리자 웹(Vite SPA) QA 프리뷰 배포

- 작성일: 2026-08-10
- 상태: Active
- 대상: `development/web` (`@thundercrew/web`)
- 참고 규약: `clever-dsv-web` `docs/runbooks/dsv-production-deploy.md` (릴리스 디렉터리 · 심링크 교체)

## 1. 왜 별도 경로인가

새 관리자 웹은 기존 운영 콘솔을 **대체하기 전에 QA**해야 합니다.
운영 콘솔(`development/frontend`, Next.js)은 살아 있는 관제 도구라 갈아엎을 수 없습니다.

그래서 같은 EC2 호스트에 **포트만 다르게** 병행합니다. 같은 DB, 같은 백엔드를 봅니다.

| 항목 | 운영 콘솔 | QA 프리뷰 |
| --- | --- | --- |
| 소스 | `development/frontend` (Next.js SSR) | `development/web` (Vite SPA) |
| 프로세스 | systemd `thundercrew-front-admin-web` → `127.0.0.1:3000` | 없음. nginx 가 정적 파일 서빙 |
| 배포 트리거 | `main` push → `aws-ec2-deploy.yml` | 수동 dispatch → `aws-ec2-web-preview-deploy.yml` |
| 공개 주소 | `https://thcr.cleversystem.ai` | `http://3.35.123.221:8090/` |

**프리뷰 workflow 는 `main` push 로 트리거되지 않습니다.** 운영 배포 경로와 완전히 분리돼 있고,
운영 콘솔·백엔드·DB를 변경하지 않습니다.

## 2. 포트

| 포트 | 쓰는 것 |
| --- | --- |
| 80 / 443 | nginx (운영) |
| 3000 | Next.js 운영 콘솔 (localhost bind) |
| 5432 | PostgreSQL |
| 8080 | service-ops-api |
| **8090** | **새 관리자 웹 QA 프리뷰** |

8090 은 위 목록에서 비어 있어 골랐습니다. EC2 security group 에서 8090 inbound 를
QA 대상 IP로 열어야 접근됩니다 — 전체 공개(`0.0.0.0/0`)로 열지 않습니다.

## 3. 릴리스 경로

DSV 규약을 따릅니다.

```
/srv/thundercrew-web/releases/<release-id>/   릴리스 디렉터리
/srv/thundercrew-web/current -> releases/<release-id>
```

`release-id` 는 `<UTC timestamp>-<commit 12자>` 입니다. 이름순 정렬이 시간순이 됩니다.

교체는 원자적입니다. 완전한 릴리스를 먼저 만들고 심링크만 `mv -Tf` 로 바꿉니다.
반쯤 복사된 상태가 서빙되지 않습니다. 최근 5개를 보관하고 나머지는 지웁니다.

## 4. 배포

GitHub Actions → `AWS EC2 admin web preview deploy` → Run workflow.

| 입력 | 값 |
| --- | --- |
| Branch | QA할 브랜치 (`cc-...` 작업 브랜치 그대로 가능) |
| `api_mode` | `mock` 또는 `remote` |

workflow 가 하는 일:

1. `npm ci` → `typecheck:web` → `build --workspace @thundercrew/web`
2. `dist/` 를 tar 로 묶어 호스트 `/tmp` 로 전송
3. nginx server block 설치 + `sites-enabled` 심링크
4. `release-admin-web.sh <release-id> <staging>` 실행 — 릴리스 디렉터리 생성 + 심링크 교체 + `nginx -t` + reload
5. `http://127.0.0.1:8090/` 이 200 인지 확인
6. 운영 서비스(`thundercrew-front-admin-web`, `thundercrew-service-ops-api`)가 살아 있는지 확인

## 5. remote 모드는 아직 막혀 있습니다

`api_mode=remote` 로 실행하면 workflow 가 **의도적으로 실패**합니다.

이유: 인증이 httpOnly 쿠키인데, 백엔드가 `Secure` 쿠키를 내려주면
평문 HTTP 프리뷰(8090)에서 브라우저가 쿠키를 보내지 않습니다. 로그인이 안 됩니다.

remote QA 를 하려면 먼저 둘 중 하나를 해야 합니다.

- **프리뷰 포트에 TLS 를 붙인다** — 운영이 쓰는 `thcr.cleversystem.ai` 인증서를 8443 같은 포트에 재사용
- **운영 HTTPS 아래 경로로 옮긴다** — `https://.../next/` 같은 prefix. 쿠키가 같은 오리진이 되어 가장 단순하지만 운영 server block 을 건드려야 함

슬라이스 1(셸·진입·화면 껍데기)은 `mock` 으로 충분합니다. 백엔드를 호출하지 않습니다.

## 6. 롤백

릴리스 스크립트는 호스트 고정 경로에 설치됩니다 — `/srv/thundercrew-web/bin/release-admin-web.sh`.

직전 릴리스로 되돌리기:

```bash
/srv/thundercrew-web/bin/release-admin-web.sh rollback
```

보관 중인 릴리스와 현재 릴리스 확인:

```bash
/srv/thundercrew-web/bin/release-admin-web.sh list
```

## 7. 호스트 사전 조건

첫 배포 전에 호스트에 한 번 준비돼야 하는 것들입니다.

- `sudo` 무암호 실행 권한 (기존 운영 workflow 와 동일한 전제)
- nginx `sites-available` / `sites-enabled` 구조 사용
- `/srv` 쓰기 가능 (스크립트가 `sudo mkdir` 로 만들고 소유권을 배포 사용자에게 넘김)
- security group 8090 inbound 허용 (QA 대상 IP 한정)

## 8. 미결

| # | 항목 |
| --- | --- |
| 1 | remote QA 를 위한 TLS 방식 — 별도 포트 TLS vs 운영 HTTPS 경로 prefix (§5) |
| 2 | 백엔드 `AuthController` 에 `Set-Cookie` 추가 — SPA 가 쿠키 세션을 쓰려면 필요 |
| 3 | 운영 전환(cutover) 시점과 방법. 프리뷰가 승인되면 운영 server block 을 새 SPA 로 바꿀지, 아니면 Next.js 를 계속 둘지 |
| 4 | 프리뷰 접근 통제 — 지금은 security group IP 제한뿐. basic auth 를 붙일지 |
