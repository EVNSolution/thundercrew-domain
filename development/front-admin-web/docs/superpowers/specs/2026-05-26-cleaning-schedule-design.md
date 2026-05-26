# Cleaning Schedule (클리닝 일정) Implementation Design

## Goal

관리자가 클리닝 차량에 일정(날짜·시간·주소)을 직접 등록하고, 콜 발송 시 웹 UI의 벨 알림으로 확인할 수 있게 한다. 실제 차량 앱이 없으므로 알림은 관리자 웹 내 시뮬레이션으로 처리한다.

## Architecture

백엔드(`service-ops-api`)에 `cleaning_schedules` 테이블과 REST API 2개를 추가하고, 프론트엔드(`front-admin-web`)에서 차량 탭 우측 패널로 일정을 관리하며, 콜 발송 성공 시 헤더 벨 아이콘에 즉각 반영한다. 알림은 React state 세션으로만 유지(DB 저장 없음). 일정 상태 추적은 없음 — 등록·삭제만.

## Tech Stack

- Backend: Java 17, Spring Boot, JPA, Flyway (service-ops-api)
- Frontend: Next.js 14 App Router, TypeScript, React (front-admin-web)

---

## Backend Changes (service-ops-api)

### New: DB Migration `V26__add_cleaning_schedules.sql`

```
path: src/main/resources/db/migration/V26__add_cleaning_schedules.sql
```

```sql
create table cleaning_schedules (
    id           bigserial primary key,
    bike_id      bigint not null references bikes(id),
    scheduled_at timestamp not null,
    address      varchar(255) not null,
    memo         varchar(500),
    created_at   timestamp not null default now(),
    updated_at   timestamp not null default now(),
    created_by   varchar(100),
    updated_by   varchar(100)
);

create index ix_cleaning_schedules_bike_id
    on cleaning_schedules(bike_id);

create index ix_cleaning_schedules_scheduled_at
    on cleaning_schedules(scheduled_at);
```

삭제는 hard delete (soft delete 없음).

### New: `CleaningSchedule.java`

```
path: src/main/java/com/thundercrew/opsapi/cleaningschedule/domain/CleaningSchedule.java
```

```java
package com.thundercrew.opsapi.cleaningschedule.domain;

@Entity
@Table(name = "cleaning_schedules")
public class CleaningSchedule extends AuditableEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bike_id", nullable = false)
    private Bike bike;

    @Column(name = "scheduled_at", nullable = false)
    private LocalDateTime scheduledAt;

    @Column(name = "address", nullable = false, length = 255)
    private String address;

    @Column(name = "memo", length = 500)
    private String memo;

    public static CleaningSchedule create(Bike bike, LocalDateTime scheduledAt, String address, String memo) {
        CleaningSchedule s = new CleaningSchedule();
        s.bike = bike;
        s.scheduledAt = scheduledAt;
        s.address = address;
        s.memo = memo;
        return s;
    }

    public Bike getBike() { return bike; }
    public LocalDateTime getScheduledAt() { return scheduledAt; }
    public String getAddress() { return address; }
    public String getMemo() { return memo; }
}
```

### New: `CleaningScheduleCreateRequest.java`

```
path: src/main/java/com/thundercrew/opsapi/cleaningschedule/dto/CleaningScheduleCreateRequest.java
```

```java
package com.thundercrew.opsapi.cleaningschedule.dto;

public record CleaningScheduleCreateRequest(
    Long bikeId,
    LocalDateTime scheduledAt,   // ISO-8601: "2026-05-27T10:00:00"
    String address,
    String memo                  // nullable
) {}
```

### New: `CleaningScheduleReadResponse.java`

```
path: src/main/java/com/thundercrew/opsapi/cleaningschedule/dto/CleaningScheduleReadResponse.java
```

```java
package com.thundercrew.opsapi.cleaningschedule.dto;

public record CleaningScheduleReadResponse(
    Long id,
    Long bikeId,
    String bikePlateNumber,
    LocalDateTime scheduledAt,
    String address,
    String memo
) {
    public static CleaningScheduleReadResponse from(CleaningSchedule s) {
        return new CleaningScheduleReadResponse(
            s.getId(),
            s.getBike().getId(),
            s.getBike().getPlateNumber(),
            s.getScheduledAt(),
            s.getAddress(),
            s.getMemo()
        );
    }
}
```

### New: `CleaningScheduleRepository.java`

```
path: src/main/java/com/thundercrew/opsapi/cleaningschedule/domain/CleaningScheduleRepository.java
```

```java
package com.thundercrew.opsapi.cleaningschedule.domain;

public interface CleaningScheduleRepository extends JpaRepository<CleaningSchedule, Long> {
    List<CleaningSchedule> findByBikeIdOrderByScheduledAtAsc(Long bikeId);
    List<CleaningSchedule> findAllByOrderByScheduledAtAsc();
}
```

### New: `CleaningScheduleCommandService.java`

```
path: src/main/java/com/thundercrew/opsapi/cleaningschedule/service/CleaningScheduleCommandService.java
```

```java
package com.thundercrew.opsapi.cleaningschedule.service;

@Service
@Transactional
public class CleaningScheduleCommandService {

    private final CleaningScheduleRepository scheduleRepo;
    private final BikeRepository bikeRepo;

    public CleaningScheduleReadResponse create(CleaningScheduleCreateRequest request) {
        Bike bike = bikeRepo.findById(request.bikeId())
            .orElseThrow(() -> new EntityNotFoundException("Bike not found: " + request.bikeId()));
        if (bike.getServiceType() != BikeServiceType.CLEANING) {
            throw new IllegalArgumentException("Bike is not a CLEANING service type");
        }
        CleaningSchedule schedule = CleaningSchedule.create(
            bike, request.scheduledAt(), request.address(), request.memo()
        );
        return CleaningScheduleReadResponse.from(scheduleRepo.save(schedule));
    }
}
```

### New: `CleaningScheduleQueryService.java`

```
path: src/main/java/com/thundercrew/opsapi/cleaningschedule/service/CleaningScheduleQueryService.java
```

```java
package com.thundercrew.opsapi.cleaningschedule.service;

@Service
@Transactional(readOnly = true)
public class CleaningScheduleQueryService {

    private final CleaningScheduleRepository scheduleRepo;

    public List<CleaningScheduleReadResponse> findByBikeId(Long bikeId) {
        return scheduleRepo.findByBikeIdOrderByScheduledAtAsc(bikeId)
            .stream().map(CleaningScheduleReadResponse::from).toList();
    }

    public List<CleaningScheduleReadResponse> findAll() {
        return scheduleRepo.findAllByOrderByScheduledAtAsc()
            .stream().map(CleaningScheduleReadResponse::from).toList();
    }
}
```

### New: `CleaningScheduleCommandController.java`

```
path: src/main/java/com/thundercrew/opsapi/cleaningschedule/CleaningScheduleCommandController.java
```

```java
@RestController
@RequestMapping("/api/v1/cleaning-schedules")
public class CleaningScheduleCommandController {

    private final CleaningScheduleCommandService commandService;

    @PostMapping
    public ResponseEntity<CleaningScheduleReadResponse> create(
        @RequestBody CleaningScheduleCreateRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED).body(commandService.create(request));
    }
}
```

### New: `CleaningScheduleReadController.java`

```
path: src/main/java/com/thundercrew/opsapi/cleaningschedule/CleaningScheduleReadController.java
```

```java
@RestController
@RequestMapping("/api/v1/cleaning-schedules")
public class CleaningScheduleReadController {

    private final CleaningScheduleQueryService queryService;

    @GetMapping
    public List<CleaningScheduleReadResponse> list(
        @RequestParam(required = false) Long bikeId
    ) {
        if (bikeId != null) return queryService.findByBikeId(bikeId);
        return queryService.findAll();
    }
}
```

---

## Frontend Changes (front-admin-web)

### New: `lib/services/cleaning-schedule-api.ts`

```
path: lib/services/cleaning-schedule-api.ts
```

```ts
export interface CleaningSchedule {
  id: number;
  bikeId: number;
  bikePlateNumber: string;
  scheduledAt: string;  // ISO-8601
  address: string;
  memo?: string;
}

export interface CleaningScheduleCreateInput {
  bikeId: number;
  scheduledAt: string;  // ISO-8601
  address: string;
  memo?: string;
}

export async function createCleaningSchedule(input: CleaningScheduleCreateInput): Promise<CleaningSchedule> {
  const res = await fetch("/api/v1/cleaning-schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to create cleaning schedule: ${res.status}`);
  return res.json();
}

export async function fetchCleaningSchedules(bikeId?: number): Promise<CleaningSchedule[]> {
  const url = bikeId
    ? `/api/v1/cleaning-schedules?bikeId=${bikeId}`
    : "/api/v1/cleaning-schedules";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch cleaning schedules: ${res.status}`);
  return res.json();
}
```

### New: `components/layout/NotificationContext.tsx`

```
path: components/layout/NotificationContext.tsx
```

```tsx
"use client";

export interface AppNotification {
  id: string;
  bikePlateNumber: string;
  scheduledAt: string;
  address: string;
  createdAt: number;  // Date.now()
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (n: Omit<AppNotification, "id" | "createdAt">) => void;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [readCount, setReadCount] = useState(0);

  const addNotification = useCallback((n: Omit<AppNotification, "id" | "createdAt">) => {
    setNotifications((prev) => [
      { ...n, id: crypto.randomUUID(), createdAt: Date.now() },
      ...prev,
    ]);
  }, []);

  const markAllRead = useCallback(() => {
    setReadCount(notifications.length);
  }, [notifications.length]);

  const unreadCount = notifications.length - readCount;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
```

### New: `components/layout/NotificationBell.tsx`

```
path: components/layout/NotificationBell.tsx
```

```tsx
"use client";

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) markAllRead();
  };

  return (
    <div className="notif-bell-wrap">
      <button type="button" className="notif-bell-btn" onClick={handleOpen} aria-label="알림">
        🔔
        {unreadCount > 0 && (
          <span className="notif-bell-badge">{unreadCount}</span>
        )}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">알림</div>
          {notifications.length === 0 ? (
            <div className="notif-empty">알림 없음</div>
          ) : (
            notifications.slice(0, 20).map((n) => (
              <div key={n.id} className="notif-item">
                <div className="notif-item-title">🔔 콜 발송됨</div>
                <div className="notif-item-body">{n.bikePlateNumber} → {n.address}</div>
                <div className="notif-item-time">
                  {new Date(n.scheduledAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

### New: `components/management/CleaningSchedulePanel.tsx`

```
path: components/management/CleaningSchedulePanel.tsx
```

차량 탭에서 클리닝 필터 선택 시 우측에 렌더되는 패널. `bikeId` prop을 받아 해당 차량의 일정 목록을 보여주고, 신규 일정 입력 폼을 인라인으로 펼친다.

```tsx
"use client";

interface CleaningSchedulePanelProps {
  bikeId: number;
  bikePlateNumber: string;
}

export function CleaningSchedulePanel({ bikeId, bikePlateNumber }: CleaningSchedulePanelProps) {
  const { addNotification } = useNotifications();
  const [schedules, setSchedules] = useState<CleaningSchedule[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCleaningSchedules(bikeId).then(setSchedules).catch(console.error);
  }, [bikeId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = String(fd.get("date") ?? "");
    const time = String(fd.get("time") ?? "");
    const address = String(fd.get("address") ?? "").trim();
    const memo = String(fd.get("memo") ?? "").trim() || undefined;
    if (!date || !time || !address) return;

    const scheduledAt = `${date}T${time}:00`;
    setSubmitting(true);
    try {
      const created = await createCleaningSchedule({ bikeId, scheduledAt, address, memo });
      setSchedules((prev) => [...prev, created].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)));
      addNotification({ bikePlateNumber, scheduledAt, address });
      setFormOpen(false);
      (e.target as HTMLFormElement).reset();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="cleaning-schedule-panel">
      <div className="cleaning-schedule-panel-header">
        <span className="cleaning-schedule-panel-title">📅 클리닝 일정</span>
        <span className="cleaning-schedule-panel-plate">{bikePlateNumber}</span>
        <button type="button" className="cleaning-schedule-add-btn" onClick={() => setFormOpen((v) => !v)}>
          {formOpen ? "취소" : "+ 일정 추가"}
        </button>
      </div>

      {formOpen && (
        <form className="cleaning-schedule-form" onSubmit={handleSubmit}>
          <div className="cleaning-schedule-form-row">
            <input type="date" name="date" required className="cleaning-schedule-input" />
            <input type="time" name="time" required className="cleaning-schedule-input" />
          </div>
          <input type="text" name="address" placeholder="주소" required className="cleaning-schedule-input cleaning-schedule-input--full" />
          <input type="text" name="memo" placeholder="메모 (선택)" className="cleaning-schedule-input cleaning-schedule-input--full" />
          <button type="submit" className="cleaning-schedule-submit-btn" disabled={submitting}>
            {submitting ? "발송 중..." : "콜 발송"}
          </button>
        </form>
      )}

      <div className="cleaning-schedule-list">
        {schedules.length === 0 ? (
          <div className="cleaning-schedule-empty">등록된 일정 없음</div>
        ) : (
          schedules.map((s) => (
            <div key={s.id} className="cleaning-schedule-item">
              <div className="cleaning-schedule-item-time">
                {new Date(s.scheduledAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="cleaning-schedule-item-address">{s.address}</div>
              {s.memo && <div className="cleaning-schedule-item-memo">{s.memo}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

### Modified: `components/management/VehiclesPanel.tsx`

클리닝 필터(`serviceTypeFilter === "CLEANING"`)이고 차량이 1개 선택된 상태일 때 `CleaningSchedulePanel`을 우측에 렌더. 차량 목록 row 클릭 시 `selectedCleaningVehicleId` state 세팅(string). 패널에 넘길 때 `parseInt`로 변환.

`FrontendVehicle.id`는 `string`이고 백엔드 `bikeId`는 `number(Long)` — 경계에서 `parseInt(id, 10)` 변환.

```tsx
const [selectedCleaningVehicleId, setSelectedCleaningVehicleId] = useState<string | null>(null);

// vehicleById: Map<string, FrontendVehicle> — id(string) 키
const selectedCleaningVehicle = selectedCleaningVehicleId
  ? vehicleById.get(selectedCleaningVehicleId) ?? null
  : null;

// 클리닝 탭 + 차량 선택 시 패널 표시
{serviceTypeFilter === "CLEANING" && selectedCleaningVehicle != null && (
  <CleaningSchedulePanel
    bikeId={parseInt(selectedCleaningVehicle.id!, 10)}
    bikePlateNumber={selectedCleaningVehicle.plateNumber ?? ""}
  />
)}
```

차량 목록 행을 클릭하면 `setSelectedCleaningVehicleId(vehicle.id ?? null)` 호출. 클리닝 탭이 아닌 경우 `selectedCleaningVehicleId`를 `null`로 리셋.

### Modified: `app/page.tsx`

`NotificationProvider`로 앱 감싸기 + 헤더 영역에 `NotificationBell` 추가.

```tsx
<NotificationProvider>
  {/* 기존 헤더/탭 */}
  <header className="...">
    ...
    <NotificationBell />
  </header>
  {/* 기존 콘텐츠 */}
</NotificationProvider>
```

### Modified: `app/globals.css`

벨 알림 및 클리닝 패널 스타일 추가. 기존 `.service-type-tab` 패턴 일관성 유지.

```css
/* 벨 알림 */
.notif-bell-wrap { position: relative; }
.notif-bell-btn { position: relative; background: transparent; border: none; font-size: 18px; cursor: pointer; padding: 4px; line-height: 1; }
.notif-bell-badge { position: absolute; top: -2px; right: -2px; background: #ef4444; color: #fff; border-radius: 999px; font-size: 10px; font-weight: 700; padding: 1px 5px; min-width: 16px; text-align: center; }
.notif-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 280px; background: #fff; border-radius: 10px; box-shadow: var(--shadow-panel); border: 1px solid var(--color-border); z-index: 200; overflow: hidden; }
.notif-dropdown-header { padding: 10px 14px; font-weight: 700; font-size: 13px; border-bottom: 1px solid var(--color-divider); }
.notif-item { padding: 10px 14px; border-bottom: 1px solid var(--color-divider); }
.notif-item-title { font-weight: 600; font-size: 12px; margin-bottom: 2px; color: var(--color-text-primary); }
.notif-item-body { font-size: 12px; color: var(--color-text-secondary); }
.notif-item-time { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
.notif-empty { padding: 16px 14px; font-size: 12px; color: var(--color-text-muted); text-align: center; }

/* 클리닝 일정 패널 */
.cleaning-schedule-panel { width: 280px; flex-shrink: 0; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px; display: flex; flex-direction: column; overflow: hidden; }
.cleaning-schedule-panel-header { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--color-divider); }
.cleaning-schedule-panel-title { font-size: 13px; font-weight: 700; color: var(--color-text-primary); }
.cleaning-schedule-panel-plate { font-size: 12px; color: var(--color-text-muted); flex: 1; }
.cleaning-schedule-add-btn { font-size: 12px; font-weight: 600; color: var(--baemin-mint); background: transparent; border: none; cursor: pointer; white-space: nowrap; }
.cleaning-schedule-form { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-bottom: 1px solid var(--color-divider); background: var(--color-bg-soft); }
.cleaning-schedule-form-row { display: flex; gap: 6px; }
.cleaning-schedule-input { border: 1px solid var(--color-border); border-radius: 6px; padding: 5px 8px; font-size: 12px; color: var(--color-text-primary); background: var(--color-surface); width: 100%; box-sizing: border-box; }
.cleaning-schedule-input--full { width: 100%; }
.cleaning-schedule-submit-btn { background: var(--baemin-mint); color: #fff; border: none; border-radius: 6px; padding: 6px; font-size: 12px; font-weight: 700; cursor: pointer; }
.cleaning-schedule-submit-btn:disabled { opacity: .6; cursor: not-allowed; }
.cleaning-schedule-list { flex: 1; overflow-y: auto; }
.cleaning-schedule-item { padding: 8px 12px; border-bottom: 1px solid var(--color-divider); }
.cleaning-schedule-item-time { font-size: 12px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 2px; }
.cleaning-schedule-item-address { font-size: 12px; color: var(--color-text-secondary); }
.cleaning-schedule-item-memo { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
.cleaning-schedule-empty { padding: 16px 12px; font-size: 12px; color: var(--color-text-muted); text-align: center; }
```

---

## Data Flow

```
관리자: 클리닝 탭 클릭 → 차량 행 클릭 → CleaningSchedulePanel 마운트
  → fetchCleaningSchedules(bikeId) → GET /api/v1/cleaning-schedules?bikeId=N
  → 기존 일정 목록 표시

관리자: "일정 추가" → 날짜·시간·주소 입력 → "콜 발송"
  → createCleaningSchedule() → POST /api/v1/cleaning-schedules
  → 서비스 레이어: bike.serviceType == CLEANING 검증
  → DB 저장 → 201 응답
  → 로컬 목록 갱신 + addNotification()
  → 헤더 벨 뱃지 +1
  → 드롭다운에 "콜 발송됨 · 서울12가3456 → 강남구 역삼동" 항목 추가
```

---

## Out of Scope

- 일정 상태 추적 (발송 후 진행·완료 없음)
- 실제 SMS / 카카오 / 앱 푸시 연동
- 알림 DB 저장 (세션 동안만 유지)
- 일정 수정 (삭제 후 재등록)
- 반복 일정 (주기적 템플릿)
