# 라이더 웹앱(PWA) — 설계

대형 앱 프로젝트 #1+#2. 플랫폼 = 웹앱(PWA). 위치 = 기존 front-admin-web 의 `/rider/*` 라우트. 인증 = 전화번호+비밀번호(JWT role=RIDER, 최초 비밀번호 관리자 발급).

## 단계
- **P0 기반(이번)**: 라이더 인증(전화+비밀번호, JWT role=RIDER) + 라이더-스코프 read API(내 프로필/계약/차량·내 업무·내 위치·내 알림) + 프론트 인증 스캐폴드(/rider/login, /rider, 미들웨어, 라이더 세션/클라이언트).
- **P1 코어 UI**: 내 업무(배차 목록) + 매칭 차량 위치(지도) + 주행거리.
- **P2**: 팁 제출(핀+로그), 알림 수신(정비/재시동), 배송 완료(사진).
- **P3**: PWA(manifest/서비스워커/설치형).

## P0 백엔드
- V46: `rider_credentials`(rider_id uuid unique, password_hash text, + base audit).
- `riderauth` 슬라이스: RiderCredential 엔티티/repo; RiderAuthService(인증: phone→Rider→verify→JWT; 관리자 set/reset 비밀번호); RiderAuthController `POST /api/v1/rider-auth/login|refresh|logout`. JWT role=RIDER, subject=riderId(JwtTokenService 확장 or 별도 발급).
- 관리자: `PATCH /api/v1/riders/{id}/credential`(비밀번호 발급/재설정) — admin command + arch allow-list.
- Security: /api/v1/rider/** 와 /api/v1/rider-auth/** 는 RIDER 토큰 허용; 기존 admin 경로는 그대로. (SecurityFilterChain/JWT 필터 확장.)
- 라이더-스코프 read(인증된 riderId 기준): `GET /api/v1/rider/me`(프로필+활성계약+bikeId+plate), `/rider/me/dispatch-orders`, `/rider/me/vehicle`(위치·주행거리), `/rider/me/notifications`(refRiderId=me). RiderBikeContractRepository.findActiveByRiderId 신규.
- 팁 제출: 기존 `/tips/submissions` 를 라이더용으로 래핑(`POST /rider/me/tips`)해 riderId를 인증에서 도출.

## P0 프론트(스캐폴드)
- 미들웨어: /rider/** 는 라이더 세션(별도 쿠키 thundercrew_rider_*)로 게이트 + /rider/login 리다이렉트. admin 경로 무영향.
- 라이더 세션 모듈 + 라이더 api 클라이언트(/api/v1/rider/**).
- `/rider/login`(전화+비밀번호), `/rider`(랜딩 최소).

## 범위/원칙
- 관리자가 라이더 비밀번호 발급(자가 가입 없음, MVP).
- 팁/알림 라이더 전달은 P0 API + P2 UI로 완성.
