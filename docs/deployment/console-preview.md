# 운영 콘솔 프리뷰 (8090)

- 작성일: 2026-08-13
- 상태: Active
- 대체 대상: `admin-web-spa-preview.md` (Vite SPA 정적 프리뷰) — 같은 8090 을 쓴다

## 1. 무엇인가

운영 콘솔(`development/frontend`, Next.js)과 **같은 코드**를 별도 프로세스로 띄워
머지 전에 변경을 눌러보는 환경이다.

운영과 다른 것은 **데이터뿐**이다.

```
브라우저 → :8090 nginx → 127.0.0.1:3100 (Next.js 프리뷰)
                       → 127.0.0.1:8081 (백엔드 프리뷰) → thundercrew_preview DB
```

운영은 그대로다.

```
브라우저 → :443 nginx → 127.0.0.1:3000 (Next.js 운영)
                      → 127.0.0.1:8080 (백엔드 운영) → thundercrew DB
```

## 2. 왜 DB 를 분리하는가

프리뷰가 운영 백엔드를 보게 하면 **QA 에서 만든 차량·주문·계약이 운영 데이터에 남는다.**
읽기만 하도록 강제할 방법이 없다 — 화면이 쓰기 버튼을 그대로 갖고 있다.

그래서 프리뷰는 자기 DB 를 본다. Flyway 가 빈 DB 에 V1 부터 적용하므로 스키마는 운영과
같고, 데이터는 비어 있다. **마이그레이션이 운영에 나가기 전에 실제로 실행되는 곳**이
하나 더 생기는 셈이다.

같은 Postgres 인스턴스 안의 **별도 데이터베이스**를 쓴다. 인스턴스를 하나 더 띄우지
않는 이유는 비용과 메모리다(§5). 격리는 데이터베이스 단위이고, 인스턴스 단위가 아니다 —
프리뷰의 무거운 쿼리가 운영 Postgres 의 CPU·I/O 를 잠식할 수 있다는 뜻이다. QA 트래픽
규모에서는 감당 가능하다고 봤지만, 부하 시험을 프리뷰에서 돌리면 안 된다.

## 3. 배포

GitHub Actions → **AWS EC2 console preview deploy** → Run workflow.

| 입력 | 값 |
| --- | --- |
| `ref` | QA 할 브랜치·태그. 비우면 워크플로를 실행한 ref |

워크플로가 하는 일:

1. 백엔드 `bootJar`, 콘솔 `typecheck` + `build` — 깨진 코드를 호스트에 올리지 않는다
2. 실행에 필요한 것만 tar 로 묶어 전송 (소스 전체를 올리지 않는다)
3. **Preflight** — 메모리 여유, 환경 파일, 프리뷰 DB 존재 확인. 여기서 멈추면 호스트는
   아무것도 바뀌지 않는다
4. systemd 유닛·nginx 블록 설치, 릴리스 디렉터리 생성 후 심링크 원자 교체, 두 유닛 재시작
5. `:8090` 응답 확인, **`/api` 가 프리뷰 포트로 노출되지 않았는지** 확인
6. 운영 유닛 4개(`nginx`, 운영 백엔드, 운영 콘솔, `postgresql`)가 살아 있는지 확인

운영 경로(`aws-ec2-deploy.yml`, `main` push)와 분리돼 있다. 운영 유닛·server block·DB 를
건드리지 않는다.

## 3.1 로컬에서 직접 배포

QA 반복이 잦으면 워크플로 큐를 기다릴 이유가 없다. 같은 일을 로컬에서 한다.

```bash
export TC_SSH_KEY=~/.ssh/thundercrew-2026-08
export TC_HOST=3.35.123.221
./deploy/scripts/deploy-console-preview-local.sh
```

| 옵션 | 뜻 |
| --- | --- |
| `--skip-build` | 직전 빌드 산출물 재사용. 배포 스크립트만 다시 돌릴 때 |
| `--rollback` | 직전 릴리스로 되돌린다 |

워크플로와 같은 일을 한다 — 빌드, preflight, 원자적 릴리스 교체, 확인, 운영 유닛 생존
확인. 다른 것은 당신의 SSH 키로 당신의 PC 에서 돈다는 점뿐이다.

**커밋되지 않은 변경도 배포된다.** 그게 로컬 배포의 목적이지만, 호스트에 무엇이 올라갔는지
알 수 없으면 QA 결과를 해석할 수 없다. 그래서 release-id 에 커밋 해시와 `-dirty` 를 남긴다.

```
20260813T121500Z-4faf8c8e91a2-dirty
```

**운영은 이 경로로 배포하지 않는다.** 이 스크립트는 프리뷰 유닛·nginx 블록·DB 만 다루고
운영 것을 건드리지 않는다. 운영 배포는 `main` push → `aws-ec2-deploy.yml` 을 그대로 쓴다 —
그쪽은 PR CI 게이트(테스트 355개 + 아키텍처 규칙)를 지나야 하기 때문이다. 프리뷰는 게이트
없이 빠르게, 운영은 게이트를 지나서. 그 구분이 이 두 경로가 따로 있는 이유다.

전제: 로컬에 JDK 21 과 Node 22, 그리고 호스트 `authorized_keys` 에 등록된 개인키.
등록은 Actions 의 **AWS EC2 authorize SSH key** 로 한 번만 하면 된다.

## 4. 호스트 사전 조건

첫 배포 전에 호스트에서 한 번 해야 한다. **워크플로가 이것들을 확인하고 없으면 멈춘다.**

### 4.1 프리뷰 데이터베이스

```bash
sudo -u postgres createdb thundercrew_preview
sudo -u postgres psql -c "create user thundercrew_preview with password '<새 비밀번호>'"
sudo -u postgres psql -c "grant all privileges on database thundercrew_preview to thundercrew_preview"
sudo -u postgres psql -d thundercrew_preview -c "grant all on schema public to thundercrew_preview"
```

**운영 DB 자격증명을 재사용하지 않는다.** 프리뷰 프로세스가 운영 데이터에 닿을 경로를
아예 만들지 않는 것이 이 환경의 목적이다.

### 4.2 환경 파일

`/etc/thundercrew/service-ops-api-preview.env`

> **키 이름은 `application.properties` 가 읽는 것과 정확히 같아야 합니다.** 짐작해서 쓰면
> 백엔드가 부팅에 실패하는데, 유닛은 `active` 로 보이고(systemd 가 재시작을 반복합니다)
> 로그를 봐야 드러납니다. 실제로 `THUNDERCREW_JWT_SECRET` 으로 썼다가
> `thundercrew.auth.jwt.secret must be provided with at least 32 bytes` 로 죽었습니다.
> 대조 대상: `development/backend/src/main/resources/application.properties`,
> 그리고 운영의 `/etc/thundercrew/service-ops-api.env` 키 이름.

```
SERVER_PORT=8081
PREVIEW_DB_NAME=thundercrew_preview
SERVICE_OPS_DB_URL=jdbc:postgresql://127.0.0.1:5432/thundercrew_preview
SERVICE_OPS_DB_USERNAME=thundercrew_preview
SERVICE_OPS_DB_PASSWORD=<4.1 에서 만든 비밀번호>
THUNDERCREW_AUTH_JWT_SECRET=<운영과 다른 새 값>
THUNDERCREW_ADMIN_SEED_LOGIN_ID=<프리뷰 관리자 ID>
THUNDERCREW_ADMIN_SEED_PASSWORD=<프리뷰 관리자 비밀번호>
THUNDERCREW_ADMIN_SEED_DISPLAY_NAME=Preview Admin
```

`/etc/thundercrew/front-admin-web-preview.env`

```
PORT=3100
SERVICE_OPS_API_BASE_URL=http://127.0.0.1:8081
NEXT_PUBLIC_NCP_MAP_CLIENT_ID=<운영과 같은 값 가능>
...(운영 front-admin-web.env 의 NEXT_PUBLIC_* 항목을 참고)
```

두 파일 모두 `chmod 600`, 소유자 `ubuntu`. **저장소에 커밋하지 않는다.**

관리자 계정은 시드 속성으로 첫 부팅에 만들어진다(`AdminSeedRunner`). 이미 있으면
아무것도 하지 않는다 — 프리뷰에서 비밀번호를 바꿔도 재배포 때 초기화되지 않는다.

### 4.3 보안 그룹

8090 inbound 를 **QA 대상 IP 한정**으로 열어야 접근된다. `0.0.0.0/0` 으로 열지 않는다.
운영과 화면이 같아서 주소만으로 구분이 어렵고, 프리뷰라도 관리자 로그인 화면이다.

응답 헤더에 `X-Thundercrew-Environment: preview` 를 붙여 두었다. 혼동될 때 확인할 수 있다.

## 5. 메모리

**이 환경의 가장 큰 제약이다.** 인스턴스가 `t3.medium`(4 GiB)이고 이미 이렇게 올라가 있다.

| 프로세스 | 대략 |
| --- | --- |
| 운영 백엔드 (Spring Boot, 기본 힙 = RAM/4) | ~1 GiB |
| 운영 콘솔 (Next.js) | ~250 MiB |
| PostgreSQL | ~300 MiB |
| nginx + OS | ~300 MiB |

프리뷰가 기본값을 쓰면 합계가 물리 메모리를 넘는다. 그래서 유닛에서 힙을 명시적으로
묶었다 — 백엔드 `-Xmx384m`, Node `--max-old-space-size=256`.

그리고 두 프리뷰 유닛에 `OOMScoreAdjust=500` 을 뒀다. 메모리가 모자라면 커널이
**프리뷰를 먼저 죽인다.** 운영이 먼저 죽는 것보다 낫다.

워크플로의 preflight 가 `MemAvailable` 을 확인하고 **900 MiB 미만이면 배포하지 않는다.**
그 경우 선택지는 둘이다.

- 인스턴스를 키운다 (`t3.medium` → `t3.large`)
- 운영 백엔드 힙을 명시적으로 줄인다 (기본값이 RAM 의 1/4 이라 실제 필요보다 클 수 있다)

## 6. 롤백

```bash
/opt/thundercrew-preview/bin/release-console-preview.sh rollback
```

보관 중인 릴리스 확인:

```bash
/opt/thundercrew-preview/bin/release-console-preview.sh list
```

최근 3개를 보관한다. 운영(5개)보다 적게 둔 이유는 디스크다 — 릴리스마다 `node_modules`
가 들어간다.

## 7. 예전 SPA 프리뷰는 내려간다

같은 8090 을 쓰던 `thundercrew-web-preview.conf`(Vite SPA 정적 서빙) server block 은
이 워크플로가 설치될 때 `sites-enabled` 에서 제거된다.

그 블록은 `/api/` 를 백엔드로 프록시했는데, 그것이 **인증 없는 텔레메트리 주입 경로**를
열어뒀다 — `POST /api/v1/telemetry/device-events` 는 permitAll 이고, 공개 콜백을 Next.js
가 채널토큰으로 검증하고 localhost 로만 부른다는 전제이기 때문이다. 새 블록은 `/api/` 를
프록시하지 않고, 워크플로가 매 배포마다 그 경로가 노출되지 않았는지 확인한다.

새 관리자 웹(Vite SPA)의 QA 가 다시 필요해지면 별도 포트로 분리해야 한다.

## 8. 미결

| # | 항목 |
| --- | --- |
| 1 | 프리뷰 DB 시드. 지금은 빈 DB + 관리자 하나뿐이다. 화면을 눌러보려면 차량·라이더·계약이 필요한데 매번 손으로 만들어야 한다. 운영 스냅샷의 **비식별 사본**을 넣는 절차가 있으면 좋다 |
| 2 | 프리뷰에 TLS. 지금은 평문 HTTP 라 관리자 로그인이 평문으로 흐른다. 보안 그룹이 IP 를 제한하지만 그것으로 충분하지 않다 |
| 3 | 같은 Postgres 인스턴스 공유. 프리뷰의 무거운 쿼리가 운영 성능에 영향을 줄 수 있다 (§2) |
| 4 | 메모리 여유가 얇다 (§5). 인스턴스 크기 결정이 필요하다 |
