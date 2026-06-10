# OTOPLUG Notification (NT) API 정리

실제 테스트(`test_nt.py`, `webhook_listener.py`)를 기반으로 정리한 NT 등록/해제/수신 흐름.

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

## NT API 목록

| API | 설명 | 발생 조건 |
|-----|------|-----------|
| `csi.terminal.status.data.driving` | 주행 상태 (주기적) | 주행 중 약 60초 간격 |
| `csi.terminal.result.data.driving` | 트립 종료 요약 | 트립 종료 시 1회 |
| `csi.terminal.status.info.device` | 디바이스 정보 | 디바이스 부팅 시 1회 |
| `csi.terminal.status.data.drivingDetail` | FMS 실시간 데이터 | RR interval 설정 필요 (5초/30초/1분) |

---

## NT 등록

```
POST /ccgf/v1/{api}/{clientID}/observer
Headers:
  Content-Type: application/json;charset=utf-8
  Authorization: Bearer {token}
Body:
  {
    "id":             "<observer UUID>",
    "type":           "otoplug-api@notification",
    "address":        "https://your-server.com/callback-path",
    "token":          "<channel UUID>",
    "expiration":     "-1",
    "dataOutputType": "simple"   ← "simple" | "full" (default: full)
  }
Response:
  {
    "result": 0,          ← 0 = 성공, 그 외 = 실패
    "id":          "...",
    "token":       "...",
    "type":        "otoplug-api@notification",
    "expiration":  "-1",
    "resourceURI": "http://..."
  }
```

**`dataOutputType`**
- `simple`: 디바이스에서 실제로 전달된 필드만 포함 → 분석에 용이
- `full` (기본값): 미전달 필드도 초기값(0, null, -9999)으로 채워서 전달 → 실제 데이터 구분 어려움

**주의**: HTTP 200이어도 `result != 0`이면 등록 실패. 반드시 `result` 값 확인.

---

## NT 해제

```
POST /ccgf/v1/{api}/{clientID}/ignore
Headers:
  Content-Type: application/json;charset=utf-8
  Authorization: Bearer {token}
Body:
  {
    "id":    "<등록 시 반환된 id>",
    "type":  "otoplug-api@notification",
    "token": "<등록 시 반환된 token>"
  }
Response:
  { "result": 0 }
```

**주의**: body에 `id`, `type`, `token` 3개만 보내야 함. 추가 필드(`address`, `expiration` 등) 포함 시 `result: 8000016` (parameter invalid) 오류 발생.

---

## 주요 에러 코드

| result | 의미 |
|--------|------|
| 0 | 성공 |
| 8000011 | Cool Time 위반 (재요청 간격 너무 짧음) |
| 8000016 | Parameter invalid (잘못된 파라미터) |
| 8000100 | Terminal not connected |

---

## Webhook 콜백 헤더

NT 수신 시 서버로 오는 헤더:

```
OTOPLUG-Channel-ID:         <등록한 observer id>
OTOPLUG-Channel-Token:      <등록한 token>
OTOPLUG-Channel-Expiration: -1
OTOPLUG-Resource-URI:       http://.../ccgf/v1/{api}/{clientID}
```

---

## drivingDetail 페이로드 구조

1분 간격으로 묶인 10초 단위 배치(`tripData` 배열)로 전달됨.

```json
{
  "result": 0,
  "sequenceNumber": 0,
  "data": {
    "imei": "867953065266555",
    "terminalID": "c972b646ef89aa271e63bc918636aa42",
    "msgDate": "20260610155630",
    "tripData": [
      {
        "timeOfOccurrence":    "20260610155540",
        "timeOfOccurrenceMsec":"20260610155540.000",
        "latitude":  "37.269453333",
        "longitude": "127.091058333",
        "speed":     0,
        "gpsSpeed":  "0",
        "gpsHeading":"0",
        "gpsHDOP":   0.0,
        "gpsSatelliteCount": 0,
        "rpm":       0,
        "maxRPM":    0,
        "maxSpeed":  0,
        "averageSpeed": 0,
        "accStatus": 0,
        "driveTime": 0,
        "driveDistance": 0,
        "totalTravelDist": 0,
        "totalFuelConsumption": 0,
        "fuelConsumption": 0,
        "fuelType": 0,
        "deviceTemp": 0,
        "suddenStopCount": 0,
        "rapidTurnCount": 0,
        "quickStartCount": 0,
        "incOverSpeed": 0,
        "decOverSpeed": 0,
        "failureDiagCodes": []
        // EV 관련 필드: -9999 = 미지원
        // null 필드: 디바이스 미전송
      }
      // ... 배치 내 나머지 10초 단위 레코드
    ]
  }
}
```

**특이사항**
- `tripData`는 배열 — 한 번의 콜백에 여러 시점 데이터가 묶여서 전달됨 (위 예시: 155540~155630, 6개 레코드)
- EV 미지원 필드: `-9999` (int) 또는 `-9999.0` (float)
- 미전송 필드: `null`
- `simple` 모드에서도 0값 필드 다수 포함 → 차량이 정지 중이거나 해당 센서 미지원인 경우

---

## 테스트 스크립트

| 파일 | 역할 |
|------|------|
| `test_nt.py` | NT 등록/해제/목록/로그 모니터링 CLI |
| `webhook_listener.py` | 콜백 수신 HTTP 서버 (포트 8888) |

**콜백 엔드포인트 → 로그 파일 매핑**

| 엔드포인트 | 로그 파일 |
|-----------|----------|
| `/otoplug-test/driving` | `/tmp/nt_driving.log` |
| `/otoplug-test/driving-result` | `/tmp/nt_driving_result.log` |
| `/otoplug-test/device` | `/tmp/nt_device.log` |
| `/otoplug-test/driving-detail` | `/tmp/nt_driving_detail.log` |
| 그 외 (RR 등) | `/tmp/webhook.log` |

**환경변수**

```bash
export SERVER_URL=https://otoplug.kt.com
export CLIENT_ID=발급받은_client_id
export SECURED_CODE=발급받은_secured_code
```

**사용 예시**

```bash
python3 test_nt.py register                          # 전체 NT 등록
python3 test_nt.py register csi.terminal.status.data.driving  # 특정 1개 등록
python3 test_nt.py list                              # 등록 목록 확인
python3 test_nt.py watch driving-detail              # drivingDetail 로그 실시간 출력
python3 test_nt.py unregister device                 # device NT 해제
python3 test_nt.py unregister-all                    # 전체 해제

nohup python3 webhook_listener.py &                  # 콜백 서버 백그라운드 실행
```
