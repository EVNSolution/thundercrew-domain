# OTOPLUG RR (Request/Response) API 정리

실제 테스트(`test_rr.py`, `webhook_listener.py`)를 기반으로 정리한 RR 요청/응답 흐름.

---

## 인증 (2단계)

```
GET  /ccgf/v1/common.auth/?clientID={clientID}&securedCode={securedCode}&sessionID={uuid}
  → { "authorizeCode": "..." }

POST /ccgf/v1/common.auth.token
  Body: { "clientID": "...", "authorizeCode": "...", "redirectURI": null }
  → { "token": "Bearer 토큰" }
```

- 토큰 유효시간: 60분
- `GET → POST` 사이 간격이 짧아야 함 (3~10초 이내 권장)
- 이후 모든 요청: `Authorization: Bearer {token}` 헤더 필수

---

## RR API 목록

| keyword | API | 설명 |
|---------|-----|------|
| `device` | `csi.terminal.query.info.device` | 디바이스 현재 정보 조회 |
| `driving` | `csi.terminal.query.driving.currentStatus` | 현재 주행 상태 조회 |

---

## RR 요청

```
POST /ccgf/v1/{api}/{clientID}
Headers:
  Content-Type: application/json;charset=utf-8
  Authorization: Bearer {token}
Body:
  {
    "terminalID":  "<디바이스 terminalID>",
    "callbackURI": "https://your-server.com/callback-path"
  }
Response:
  {
    "result":         0,     ← 0 = 성공, 그 외 = 실패
    "sequenceNumber": 12345
  }
```

**흐름**: 요청 → 즉시 `result` + `sequenceNumber` 응답 → 수초 후 `callbackURI`로 실제 데이터 POST

---

## 주요 에러 코드

| result | 의미 | 조치 |
|--------|------|------|
| 0 | 성공 | — |
| 8000011 | Cool Time 위반 | 3~180초 후 재시도 |
| 8000100 | Terminal Not Connected | 디바이스 연결 상태 확인 |

---

## 콜백 수신

RR 요청 성공 후 수초 내 `callbackURI`로 데이터가 POST로 들어옴.

```
POST {callbackURI}
Body:
  {
    "result": 0,
    "sequenceNumber": 12345,
    "data": { ... }    ← API별 실제 데이터
  }
```

`test_rr.py`는 콜백을 `/tmp/webhook.log`에서 30초간 폴링해서 수신 즉시 출력.

---

## 테스트 스크립트

| 파일 | 역할 |
|------|------|
| `test_rr.py` | RR 요청 발송 + 콜백 수신 대기 CLI |
| `webhook_listener.py` | 콜백 수신 HTTP 서버 (포트 8888) |

**환경변수**

```bash
export SERVER_URL=https://otoplug.kt.com
export CLIENT_ID=발급받은_client_id
export SECURED_CODE=발급받은_secured_code
```

**사용 예시**

```bash
# 서버 먼저 백그라운드 실행
nohup python3 webhook_listener.py &

# RR 요청
python3 test_rr.py device    # 디바이스 정보 조회
python3 test_rr.py driving   # 현재 주행 상태 조회
```

**콜백 로그**: `/tmp/webhook.log` (RR은 NT와 달리 단일 파일에 기록)
