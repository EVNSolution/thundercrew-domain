# 썬더크루 라이더 앱 MVP-1 (배차 수행 루프) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 썬더크루 라이더가 앱에서 로그인 → 내 배차/대기 콜(2탭) 확인 → 목적지(네이버 지도+딥링크) → 사진 첨부 완료까지 수행하고, 그 완료가 #4 웹 모니터에 반영되게 한다.

**Architecture:** `development/app`(Expo 54/RN 0.81)을 썬더크루-first로 재구성한다. 데이터 계층(`riderAuthClient`/`riderDispatchClient`/`riderProfileClient`)·카메라·시큐어스토어는 이미 존재하므로 **재사용**하고, 신규는 (1) 썬더크루-first 런타임 config, (2) 세션/토큰, (3) `RiderAppRoot` 상태 머신 + 4개 화면, (4) 네이티브 네이버 지도 컴포넌트 + 딥링크다. react-native-maps는 제거하고 네이버 지도 SDK를 도입한다. delivery-server 플로우는 호출하지 않는다(잔존).

**Tech Stack:** Expo 54, React Native 0.81(new arch), TypeScript, expo-secure-store, expo-camera/expo-image-picker, 네이버 지도 RN SDK.

> **환경 주의:** 워크트리 `C:\Users\user\.config\superpowers\worktrees\thundercrew-domain\cc-rider-app-dispatch-mvp`, branch `cc-rider-app-dispatch-mvp`(off dev). 작업 루트 `development/app`. Bash=git-bash. Docker 무관(모바일). **경쟁 서버·Metro 무단 상시 실행 금지**(검증용 단발 빌드만). 네이티브 빌드는 `ANDROID_HOME=$HOME/AppData/Local/Android/Sdk` 필요.

> **참고 사실(준수):**
> - 데이터 계층 이미 존재: `src/api/thundercrew/riderAuthClient.ts`(`createRiderAuthService({baseUrl})` → `login({phoneNumber,password})`/`refresh`), `riderDispatchClient.ts`(`createRiderDispatchService({baseUrl,accessToken})` → `listAssigned()`/`listCompleted()`/`listOfferedCalls()`/`acceptOfferedCall(orderId)`/`completeDelivery(orderId,{uri,name,type})`; 타입 `RiderDispatchOrder`), `riderProfileClient.ts`.
> - 토큰 저장: `src/platform/expo/secureStore/expoSecureDriverAccessTokenStore.ts` → `createExpoSecureDriverAccessTokenStore(): DriverAccessTokenStore`(도메인 `src/domain/driver/driverAccessTokenStore.ts`).
> - 카메라: `src/domain/proof/proofPhotoCapture.ts`(`ProofPhotoCaptureService`, `ProofPhotoCaptureResult`) + `src/platform/expo/camera/expoProofPhotoCaptureService.ts`.
> - 테스트: 콜로케이트 `*.test.ts`, `npm run test`(`scripts/run-tests.mjs`). `npm run typecheck`(tsc --noEmit), `npm run lint`(expo lint).
> - 현재 `App.tsx` = `import AppRoot from './src/app/AppRoot'; export default AppRoot;`.
> - 백엔드 라이더 엔드포인트(dev, 이미 배포): `/api/v1/rider-auth/login|refresh`, `/api/v1/rider/me/dispatch-orders|/completed|/offered-calls`, `POST /me/offered-calls/{id}/accept`, `POST /me/dispatch-orders/{id}/complete`(multipart photo). 콜은 내 차량이 CALL 유형일 때만 비어있지 않음.

---

## File Structure

**신규**
- `src/app/config/riderRuntimeConfig.ts` — 썬더크루-first 런타임 config + 서비스 팩토리.
- `src/domain/session/riderSession.ts` — 로그인/토큰 저장·복원·로그아웃 순수 로직 (+ `.test.ts`).
- `src/app/RiderAppRoot.tsx` — 앱 루트 상태 머신(loading/login/list/detail/completing).
- `src/ui/screens/LoginScreen.tsx`, `DispatchListScreen.tsx`(2탭), `OrderDetailScreen.tsx`.
- `src/ui/components/NaverDestinationMap.tsx` — 네이버 지도(목적지 핀).
- `src/domain/nav/naverDeepLink.ts` — 네이버 지도앱 길안내 딥링크 URL 생성 (+ `.test.ts`).

**수정**
- `app.json` — react-native-maps plugin + googleMaps config 제거, 네이버 지도 plugin 추가, 위치 권한 정리.
- `package.json` — react-native-maps 제거, 네이버 지도 SDK 추가.
- `App.tsx` — `RiderAppRoot` 렌더.
- `.env.example` — `EXPO_PUBLIC_THUNDERCREW_SERVICE_OPS_BASE_URL`, `EXPO_PUBLIC_NCP_MAP_CLIENT_ID` 문서화.

**재사용(수정 안 함)**: `src/api/thundercrew/*`, `src/platform/expo/secureStore/*`, `src/platform/expo/camera/*`, `src/domain/proof/*`, `src/domain/driver/driverAccessTokenStore.ts`.

---

## Task 1: 네이버 지도 SDK 도입 + react-native-maps 제거 + prebuild green (de-risk 먼저)

> 이 태스크가 가장 리스크가 크다(네이티브 SDK/Expo 호환). 먼저 초록 네이티브 프로젝트를 확보한 뒤 나머지 UI를 얹는다.

**Files:** `app.json`, `package.json`

- [ ] **Step 1: 네이버 지도 RN SDK 후보 설치**

Run(작업 루트 `development/app`):
```bash
cd development/app && npm install @mj-studio/react-native-naver-map
```
(설치 실패/미유지보수면 대안 `react-native-nmap` 시도. 둘 다 Expo config plugin·new-arch 비호환이면 **폴백: 이 태스크를 WebView 방식으로 전환**하고 그 사실을 커밋 메시지·플랜 실행 노트에 남긴다. 결정 후 진행.)

- [ ] **Step 2: `app.json` 수정 — 구글 지도 제거, 네이버 plugin 추가, 위치 권한 정리**

`plugins`에서 `"react-native-maps"` 제거, `android.config.googleMaps` 제거. 네이버 SDK config plugin 추가(패키지 문서 형식대로; `@mj-studio/react-native-naver-map`의 경우 대략):
```json
[
  "@mj-studio/react-native-naver-map",
  {
    "client_id": "$EXPO_PUBLIC_NCP_MAP_CLIENT_ID",
    "android": { "ACCESS_FINE_LOCATION": false },
    "ios": {}
  }
]
```
`expo-location`/`expo-image-picker`/`expo-camera` plugin 중 **위치 관련은 MVP 미사용** → `expo-location` plugin 항목 제거(카메라·이미지피커는 유지). 정확한 plugin 옵션 키는 설치한 패키지 문서를 따른다(값이 다르면 문서 기준으로 맞춘다).

> 클라이언트 ID는 하드코딩 금지. `app.json`에서 `$EXPO_PUBLIC_NCP_MAP_CLIENT_ID` 치환 또는 `app.config.ts`로 전환해 env 주입(패키지가 정적 문자열만 받으면 `app.config.ts`로 바꿔 `process.env` 주입). 실제 값은 사용자가 `.env`에 넣음.

- [ ] **Step 3: prebuild + 컴파일 검증**

Run:
```bash
cd development/app && export ANDROID_HOME="$HOME/AppData/Local/Android/Sdk" && export ANDROID_SDK_ROOT="$ANDROID_HOME" && export EXPO_PUBLIC_NCP_MAP_CLIENT_ID=dummy-build-check && npx expo prebuild -p android --clean
```
Expected: `✔ Finished prebuild` (config plugin 로드 성공, react-native-maps 오류 없음). 이어서 typecheck:
```bash
cd development/app && npm run typecheck
```
Expected: 통과.

> (선택, 시간 되면) `npx expo run:android`로 실기기 설치까지 확인 — 필수는 Task 9. Task 1은 prebuild green이 게이트.

- [ ] **Step 4: 커밋**
```bash
cd development/app && git add app.json package.json package-lock.json
git commit -m "build(app): 네이버 지도 SDK 도입 + react-native-maps/구글지도 제거 + 위치 plugin 정리"
```

---

## Task 2: 썬더크루-first 런타임 config + 서비스 팩토리

**Files:** Create `src/app/config/riderRuntimeConfig.ts`, `src/app/config/riderRuntimeConfig.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`riderRuntimeConfig.test.ts`:
```ts
import { readRiderRuntimeConfig } from './riderRuntimeConfig';

describe('readRiderRuntimeConfig', () => {
  it('썬더크루 URL 없으면 mock 모드', () => {
    expect(readRiderRuntimeConfig({})).toEqual({ mode: 'mock' });
  });
  it('썬더크루 URL 있으면 live 모드 + baseUrl', () => {
    expect(
      readRiderRuntimeConfig({ EXPO_PUBLIC_THUNDERCREW_SERVICE_OPS_BASE_URL: 'https://api.example' })
    ).toEqual({ mode: 'live', thundercrewBaseUrl: 'https://api.example' });
  });
  it('공백 URL은 mock', () => {
    expect(readRiderRuntimeConfig({ EXPO_PUBLIC_THUNDERCREW_SERVICE_OPS_BASE_URL: '  ' })).toEqual({ mode: 'mock' });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd development/app && npm run test`
Expected: FAIL (`readRiderRuntimeConfig` 없음). (러너 형식은 기존 `*.test.ts` 관례를 따른다 — 기존 테스트 파일 하나를 열어 `describe/it`/assert 스타일을 맞춘다.)

- [ ] **Step 3: 구현**

`riderRuntimeConfig.ts`:
```ts
import { createRiderAuthService, type RiderAuthService } from '../../api/thundercrew/riderAuthClient';
import { createRiderDispatchService, type RiderDispatchService } from '../../api/thundercrew/riderDispatchClient';

export type RiderRuntimeConfig =
  | { mode: 'mock' }
  | { mode: 'live'; thundercrewBaseUrl: string };

export function readRiderRuntimeConfig(
  env: Partial<Record<'EXPO_PUBLIC_THUNDERCREW_SERVICE_OPS_BASE_URL', string>>,
): RiderRuntimeConfig {
  const base = env.EXPO_PUBLIC_THUNDERCREW_SERVICE_OPS_BASE_URL?.trim();
  if (!base) return { mode: 'mock' };
  return { mode: 'live', thundercrewBaseUrl: base };
}

/** live 모드에서 auth 서비스(로그인 전) 생성. */
export function createAuthService(config: RiderRuntimeConfig): RiderAuthService | null {
  if (config.mode !== 'live') return null;
  return createRiderAuthService({ baseUrl: config.thundercrewBaseUrl });
}

/** 로그인 후 accessToken으로 dispatch 서비스 생성. */
export function createDispatchService(config: RiderRuntimeConfig, accessToken: string): RiderDispatchService | null {
  if (config.mode !== 'live') return null;
  return createRiderDispatchService({ baseUrl: config.thundercrewBaseUrl, accessToken });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd development/app && npm run test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: 커밋**
```bash
cd development/app && git add src/app/config/riderRuntimeConfig.ts src/app/config/riderRuntimeConfig.test.ts
git commit -m "feat(app): 썬더크루-first 런타임 config + auth/dispatch 서비스 팩토리"
```

---

## Task 3: 세션(로그인/토큰 저장·복원)

**Files:** Create `src/domain/session/riderSession.ts`, `src/domain/session/riderSession.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`riderSession.test.ts` — `loginAndPersist`가 auth.login 호출 후 토큰 저장, `restoreSession`이 저장된 accessToken 반환, `logout`이 삭제하는지. auth 서비스·토큰 스토어는 목으로 주입:
```ts
import { loginAndPersist, restoreSession, logoutSession } from './riderSession';

const tokens = { tokenType: 'Bearer', accessToken: 'at', expiresAt: '', refreshToken: 'rt', refreshExpiresAt: '', rider: {} };

it('로그인 성공 시 accessToken 저장', async () => {
  const saved: Record<string, string> = {};
  const auth = { login: async () => tokens, refresh: async () => tokens };
  const store = { save: async (t: string) => { saved.at = t; }, read: async () => saved.at ?? null, clear: async () => { delete saved.at; } };
  const result = await loginAndPersist({ auth, store }, { phoneNumber: '010', password: 'pw' });
  expect(result.accessToken).toBe('at');
  expect(await store.read()).toBe('at');
});
```
(스토어 인터페이스는 `DriverAccessTokenStore`의 실제 메서드명에 맞춘다 — `src/domain/driver/driverAccessTokenStore.ts`를 열어 `save/read/clear` 실제 이름 확인 후 반영.)

- [ ] **Step 2: 실패 확인** — `cd development/app && npm run test` → FAIL.

- [ ] **Step 3: 구현** — `riderSession.ts`: `loginAndPersist({auth, store}, credentials)` → `auth.login` → `store.save(accessToken)`(+refresh 별도 저장 필요시 스토어 확장) → 반환. `restoreSession(store)` → `store.read()`. `logoutSession(store)` → `store.clear()`. 타입은 `RiderAuthService`·`DriverAccessTokenStore` 재사용.

- [ ] **Step 4: 통과 확인** — `npm run test && npm run typecheck` → PASS.

- [ ] **Step 5: 커밋**
```bash
cd development/app && git add src/domain/session/
git commit -m "feat(app): 라이더 세션(로그인·토큰 저장/복원/로그아웃) 도메인"
```

---

## Task 4: RiderAppRoot 상태 머신 + App.tsx 배선

**Files:** Create `src/app/RiderAppRoot.tsx`; Modify `App.tsx`

- [ ] **Step 1: RiderAppRoot 구현**

상태: `{ phase: 'loading' | 'login' | 'list' | 'detail'; selectedOrder?: RiderDispatchOrder }`. 마운트 시 `readRiderRuntimeConfig(process.env)` + `restoreSession(store)`로 자동 로그인 시도 → 있으면 list, 없으면 login. dispatch 서비스는 accessToken 확보 후 `createDispatchService`로 생성해 화면들에 prop 주입. mock 모드면 목 데이터 서비스(간단 인메모리)로 화면 흐름만.

```tsx
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native';
import { readRiderRuntimeConfig, createAuthService, createDispatchService } from './config/riderRuntimeConfig';
import { createExpoSecureDriverAccessTokenStore } from '../platform/expo/secureStore/expoSecureDriverAccessTokenStore';
import { restoreSession } from '../domain/session/riderSession';
import { LoginScreen } from '../ui/screens/LoginScreen';
import { DispatchListScreen } from '../ui/screens/DispatchListScreen';
import { OrderDetailScreen } from '../ui/screens/OrderDetailScreen';
import type { RiderDispatchOrder } from '../api/thundercrew/riderDispatchClient';

export default function RiderAppRoot() {
  const config = useMemo(() => readRiderRuntimeConfig(process.env as Record<string, string>), []);
  const store = useMemo(() => createExpoSecureDriverAccessTokenStore(), []);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [phase, setPhase] = useState<'loading' | 'login' | 'list' | 'detail'>('loading');
  const [selected, setSelected] = useState<RiderDispatchOrder | null>(null);

  useEffect(() => {
    restoreSession(store).then((t) => { if (t) { setAccessToken(t); setPhase('list'); } else setPhase('login'); });
  }, [store]);

  const dispatch = useMemo(
    () => (accessToken ? createDispatchService(config, accessToken) : null),
    [config, accessToken],
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {phase === 'loading' ? null : null}
      {phase === 'login' ? (
        <LoginScreen config={config} store={store} onLoggedIn={(t) => { setAccessToken(t); setPhase('list'); }} />
      ) : null}
      {phase === 'list' && dispatch ? (
        <DispatchListScreen dispatch={dispatch} onOpen={(o) => { setSelected(o); setPhase('detail'); }} />
      ) : null}
      {phase === 'detail' && dispatch && selected ? (
        <OrderDetailScreen dispatch={dispatch} order={selected} onBack={() => setPhase('list')} onCompleted={() => setPhase('list')} />
      ) : null}
    </SafeAreaView>
  );
}
```
(mock 모드 처리: `dispatch`가 null이면 목 서비스 주입 — 최소 인메모리 구현을 config 팩토리에 추가하거나, MVP는 live 전제로 두고 mock은 후속. YAGNI — live 전제로 두고, 미인증+mock이면 login 화면 유지.)

- [ ] **Step 2: `App.tsx` 교체**
```tsx
import RiderAppRoot from './src/app/RiderAppRoot';
export default RiderAppRoot;
```

- [ ] **Step 3: 검증** — `cd development/app && npm run typecheck` → 통과(화면 컴포넌트는 Task 5-7에서 생성하므로 이 시점 typecheck는 그 파일들과 함께 통과시킨다. 구현자는 Task 5-7을 이어서 완료 후 typecheck).

- [ ] **Step 4: 커밋**
```bash
cd development/app && git add src/app/RiderAppRoot.tsx App.tsx
git commit -m "feat(app): RiderAppRoot 상태 머신 + 엔트리 배선"
```

---

## Task 5: 로그인 화면

**Files:** Create `src/ui/screens/LoginScreen.tsx`

- [ ] **Step 1: 구현** — 전화번호·비밀번호 입력 + 로그인 버튼. 제출 시 `createAuthService(config)` → `loginAndPersist({auth, store}, {phoneNumber, password})` → 성공 시 `onLoggedIn(accessToken)`. 실패 시 에러 텍스트. 기존 UI 컴포넌트(`src/ui/components/TransientToast.tsx`)·RN 기본 컴포넌트 사용, 스타일은 기존 화면 톤 참고.

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { createAuthService, type RiderRuntimeConfig } from '../../app/config/riderRuntimeConfig';
import { loginAndPersist } from '../../domain/session/riderSession';
import type { DriverAccessTokenStore } from '../../domain/driver/driverAccessTokenStore';

export function LoginScreen({ config, store, onLoggedIn }: {
  config: RiderRuntimeConfig; store: DriverAccessTokenStore; onLoggedIn: (accessToken: string) => void;
}) {
  const [phoneNumber, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const auth = createAuthService(config);
    if (!auth) { setError('서버 설정이 없습니다.'); return; }
    setBusy(true); setError(null);
    try {
      const tokens = await loginAndPersist({ auth, store }, { phoneNumber, password });
      onLoggedIn(tokens.accessToken);
    } catch {
      setError('로그인 실패. 전화번호·비밀번호를 확인하세요.');
    } finally { setBusy(false); }
  }
  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '600' }}>썬더크루 라이더</Text>
      <TextInput placeholder="전화번호" keyboardType="phone-pad" value={phoneNumber} onChangeText={setPhone} />
      <TextInput placeholder="비밀번호" secureTextEntry value={password} onChangeText={setPassword} />
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
      <Pressable onPress={submit} disabled={busy}><Text>{busy ? '로그인 중…' : '로그인'}</Text></Pressable>
    </View>
  );
}
```

- [ ] **Step 2: 검증** — `npm run typecheck && npm run lint`.
- [ ] **Step 3: 커밋** — `git add src/ui/screens/LoginScreen.tsx && git commit -m "feat(app): 로그인 화면"`.

---

## Task 6: 배차 목록 화면 (2탭 + 콜 수락)

**Files:** Create `src/ui/screens/DispatchListScreen.tsx`

- [ ] **Step 1: 구현** — 상단 탭 토글("내 배차" | "대기 콜"). "내 배차" → `dispatch.listAssigned()`, "대기 콜" → `dispatch.listOfferedCalls()`(빈 배열이면 "콜 배차 차량이 아닙니다" 안내). 당겨서 새로고침. 내 배차 카드 탭 → `onOpen(order)`. 대기 콜 카드 "수락" → `dispatch.acceptOfferedCall(order.id)` → 성공 시 "내 배차" 탭으로 전환 + 재조회.

```tsx
import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import type { RiderDispatchService, RiderDispatchOrder } from '../../api/thundercrew/riderDispatchClient';

type Tab = 'assigned' | 'offered';

export function DispatchListScreen({ dispatch, onOpen }: {
  dispatch: RiderDispatchService; onOpen: (order: RiderDispatchOrder) => void;
}) {
  const [tab, setTab] = useState<Tab>('assigned');
  const [orders, setOrders] = useState<RiderDispatchOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (which: Tab) => {
    setLoading(true); setError(null);
    try {
      setOrders(which === 'assigned' ? await dispatch.listAssigned() : await dispatch.listOfferedCalls());
    } catch { setError('불러오기 실패'); } finally { setLoading(false); }
  }, [dispatch]);

  useEffect(() => { load(tab); }, [tab, load]);

  async function accept(order: RiderDispatchOrder) {
    try { await dispatch.acceptOfferedCall(order.id); setTab('assigned'); }
    catch { setError('수락 실패'); }
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row' }}>
        <Pressable onPress={() => setTab('assigned')}><Text style={{ fontWeight: tab==='assigned'?'700':'400', padding: 12 }}>내 배차</Text></Pressable>
        <Pressable onPress={() => setTab('offered')}><Text style={{ fontWeight: tab==='offered'?'700':'400', padding: 12 }}>대기 콜</Text></Pressable>
      </View>
      {error ? <Text style={{ color: 'red', padding: 8 }}>{error}</Text> : null}
      {tab === 'offered' && !loading && orders.length === 0 ? (
        <Text style={{ padding: 16, color: '#666' }}>대기 중인 콜이 없습니다. (콜 배차 차량만 표시됩니다)</Text>
      ) : null}
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(tab)} />}
        renderItem={({ item }) => (
          <View style={{ padding: 16, borderBottomWidth: 1, borderColor: '#eee' }}>
            <Text style={{ fontWeight: '600' }}>{item.customerName}</Text>
            <Text style={{ color: '#555' }}>{item.address}</Text>
            {tab === 'assigned'
              ? <Pressable onPress={() => onOpen(item)}><Text style={{ color: '#0a58ca', marginTop: 6 }}>상세 보기</Text></Pressable>
              : <Pressable onPress={() => accept(item)}><Text style={{ color: '#198754', marginTop: 6 }}>수락</Text></Pressable>}
          </View>
        )}
      />
    </View>
  );
}
```

- [ ] **Step 2: 검증** — `npm run typecheck && npm run lint`.
- [ ] **Step 3: 커밋** — `git add src/ui/screens/DispatchListScreen.tsx && git commit -m "feat(app): 배차 목록 2탭(내 배차/대기 콜) + 콜 수락"`.

---

## Task 7: 주문 상세 화면 + 네이버 지도 + 딥링크

**Files:** Create `src/ui/screens/OrderDetailScreen.tsx`, `src/ui/components/NaverDestinationMap.tsx`, `src/domain/nav/naverDeepLink.ts` (+ `.test.ts`)

- [ ] **Step 1: 딥링크 유틸 + 실패 테스트**

`naverDeepLink.test.ts`:
```ts
import { buildNaverRouteUrl } from './naverDeepLink';
it('좌표+이름으로 네이버 길안내 URL', () => {
  const url = buildNaverRouteUrl({ latitude: 37.5, longitude: 127.0, name: '고객' });
  expect(url).toContain('nmap://');
  expect(url).toContain('37.5');
  expect(url).toContain('127');
});
```
`naverDeepLink.ts`:
```ts
export function buildNaverRouteUrl(dest: { latitude: number; longitude: number; name: string }): string {
  const p = encodeURIComponent(dest.name);
  return `nmap://route/car?dlat=${dest.latitude}&dlng=${dest.longitude}&dname=${p}&appname=com.evns.cleverdriverapp`;
}
```
Run: `npm run test` → PASS.

- [ ] **Step 2: 네이버 지도 컴포넌트** — `NaverDestinationMap.tsx`: 설치한 네이버 지도 SDK로 `latitude/longitude` 중심 + 목적지 마커 1개. (패키지 실제 컴포넌트/props명은 설치 문서 기준. `@mj-studio/react-native-naver-map`이면 `<NaverMapView>` + `<NaverMapMarkerOverlay>` 형태.) 지도 로드 실패/미지원 환경 폴백: 좌표 텍스트 표시.

- [ ] **Step 3: 주문 상세 화면** — 고객·연락처·주소 + `<NaverDestinationMap>` + "길안내"(`Linking.openURL(buildNaverRouteUrl(...))`, 실패 시 웹 fallback URL) + "완료"(→ Task 8 완료 플로우 호출). `onBack`으로 목록 복귀.

```tsx
import { View, Text, Pressable, Linking } from 'react-native';
import { NaverDestinationMap } from '../components/NaverDestinationMap';
import { buildNaverRouteUrl } from '../../domain/nav/naverDeepLink';
import { completeOrderWithPhoto } from '../../domain/session/completeOrder'; // Task 8
import type { RiderDispatchService, RiderDispatchOrder } from '../../api/thundercrew/riderDispatchClient';

export function OrderDetailScreen({ dispatch, order, onBack, onCompleted }: {
  dispatch: RiderDispatchService; order: RiderDispatchOrder; onBack: () => void; onCompleted: () => void;
}) {
  async function navigate() {
    const url = buildNaverRouteUrl({ latitude: order.latitude, longitude: order.longitude, name: order.customerName });
    const ok = await Linking.canOpenURL(url);
    await Linking.openURL(ok ? url : `https://map.naver.com/v5/directions/-/-/-/car?c=${order.longitude},${order.latitude},15`);
  }
  async function complete() {
    const result = await completeOrderWithPhoto(dispatch, order.id);
    if (result.ok) onCompleted();
  }
  return (
    <View style={{ flex: 1 }}>
      <Pressable onPress={onBack}><Text style={{ padding: 12 }}>← 목록</Text></Pressable>
      <View style={{ padding: 16, gap: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: '600' }}>{order.customerName}</Text>
        <Text>{order.customerPhone}</Text>
        <Text style={{ color: '#555' }}>{order.address}</Text>
      </View>
      <View style={{ height: 240 }}><NaverDestinationMap latitude={order.latitude} longitude={order.longitude} label={order.customerName} /></View>
      <View style={{ flexDirection: 'row', gap: 12, padding: 16 }}>
        <Pressable onPress={navigate}><Text style={{ color: '#0a58ca' }}>길안내</Text></Pressable>
        <Pressable onPress={complete}><Text style={{ color: '#198754' }}>완료(사진)</Text></Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: 검증** — `npm run test && npm run typecheck && npm run lint`.
- [ ] **Step 5: 커밋** — `git add src/ui/screens/OrderDetailScreen.tsx src/ui/components/NaverDestinationMap.tsx src/domain/nav/ && git commit -m "feat(app): 주문 상세 + 네이버 지도 핀 + 길안내 딥링크"`.

---

## Task 8: 사진 완료 플로우

**Files:** Create `src/domain/session/completeOrder.ts` (+ `.test.ts`)

- [ ] **Step 1: 실패 테스트** — `completeOrderWithPhoto(dispatch, orderId)`가 카메라로 사진 캡처 후 `dispatch.completeDelivery(orderId, {uri,name,type})` 호출, 취소 시 `{ ok: false, reason: 'cancelled' }`. 카메라 서비스·dispatch는 목 주입.

- [ ] **Step 2: 실패 확인** — `npm run test` → FAIL.

- [ ] **Step 3: 구현** — `expoProofPhotoCaptureService`(기존)로 사진 캡처 → 결과의 uri/type → `{ uri, name: 'proof.jpg', type }` → `dispatch.completeDelivery(orderId, photo)`. 캡처 취소/거부 시 `{ ok:false }`. (카메라 서비스 인터페이스·결과 필드명은 `src/domain/proof/proofPhotoCapture.ts` 실제 타입에 맞춘다.)

```ts
import { captureProofPhoto } from '../proof/proofPhotoCapture';
import { createExpoProofPhotoCaptureService } from '../../platform/expo/camera/expoProofPhotoCaptureService';
import type { RiderDispatchService } from '../../api/thundercrew/riderDispatchClient';

export async function completeOrderWithPhoto(
  dispatch: RiderDispatchService, orderId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const camera = createExpoProofPhotoCaptureService();
  const shot = await captureProofPhoto(camera, 'camera'); // 실제 시그니처에 맞춰 인자 조정
  if (shot.kind !== 'captured') return { ok: false, reason: shot.kind };
  await dispatch.completeDelivery(orderId, { uri: shot.uri, name: 'proof.jpg', type: shot.mimeType ?? 'image/jpeg' });
  return { ok: true };
}
```
(위 필드명 `shot.kind/uri/mimeType`은 `ProofPhotoCaptureResult` 실제 정의에 맞춰 확정. 파일 열어 확인 후 반영.)

- [ ] **Step 4: 통과 확인** — `npm run test && npm run typecheck`.
- [ ] **Step 5: 커밋** — `git add src/domain/session/completeOrder.ts src/domain/session/completeOrder.test.ts && git commit -m "feat(app): 사진 촬영→배차 완료 플로우"`.

---

## Task 9: 최종 검증 + prebuild/네이티브 빌드 + PR(→dev)

**Files:** `.env.example`(문서화)

- [ ] **Step 1: `.env.example` 갱신** — 두 env 키 문서화:
```
# 썬더크루 rider API 오리진(미설정 시 mock)
# EXPO_PUBLIC_THUNDERCREW_SERVICE_OPS_BASE_URL=https://thcr.cleversystem.ai
# NCP Maps client ID(웹과 동일 애플리케이션, 콘솔에 앱 패키지 com.evns.cleverdriverapp 등록)
# EXPO_PUBLIC_NCP_MAP_CLIENT_ID=<ncp-mobile-map-client-id>
```

- [ ] **Step 2: 전체 검증**

Run:
```bash
cd development/app && npm run typecheck && npm run lint && npm run test
```
Expected: 모두 통과.

- [ ] **Step 3: 네이티브 빌드 게이트**

Run:
```bash
cd development/app && export ANDROID_HOME="$HOME/AppData/Local/Android/Sdk" && export ANDROID_SDK_ROOT="$ANDROID_HOME" && export EXPO_PUBLIC_NCP_MAP_CLIENT_ID=dummy-build-check && npx expo prebuild -p android --clean && echo PREBUILD_OK
```
Expected: `PREBUILD_OK`(config plugin·지도 SDK 포함 prebuild 성공). 실기기 설치·로그인·목록·완료 스모크는 사용자(실 NCP client ID + 썬더크루 URL 필요).

- [ ] **Step 4: 커밋 + 푸시 + PR**

```bash
cd development/app && git add .env.example
git commit -m "docs(app): .env.example — 썬더크루 URL + NCP 지도 client ID"
cd "C:/Users/user/.config/superpowers/worktrees/thundercrew-domain/cc-rider-app-dispatch-mvp" && git push -u origin cc-rider-app-dispatch-mvp
```
그 후 `gh pr create --base dev`(제목 `feat(app): 라이더 앱 MVP-1 배차 수행 루프(2탭+네이버지도+사진완료)`). 본문에 검증 상태(typecheck/lint/test + prebuild green; 실기기 스모크는 NCP 등록·키 필요로 사용자), 필요한 사용자 액션(NCP 콘솔 모바일 등록, `.env` 값) 명시. 그다음 **superpowers:finishing-a-development-branch**로 마무리(dev 자가 병합 가능, dev→main 사용자 게이트).

---

## Self-Review 결과

- **스펙 커버리지:** 런타임 config(§3)=T2, 세션/토큰(§7)=T3, 로그인(§4.1)=T5, 2탭 목록+콜수락(§4.2)=T6, 상세+지도+딥링크(§4.3,§5)=T7, 사진완료(§4.4)=T8, 지도 SDK/react-native-maps 제거(§5,§8)=T1, env/시크릿(§9)=T9, 검증(§12)=T9. 전부 매핑.
- **플레이스홀더:** 코드 단계마다 구체 코드 제공. 단 네이버 SDK·카메라·토큰스토어의 **실제 API명은 "파일 열어 확인 후 맞춘다"** 로 명시(외부/기존 패키지 시그니처라 플랜에서 단정 대신 검증 지시) — 구현자가 반드시 해당 파일을 읽고 맞출 것.
- **타입 일관성:** `RiderDispatchOrder`/`RiderDispatchService`(riderDispatchClient), `RiderRuntimeConfig`(T2), `completeOrderWithPhoto`(T8) 명칭이 T4/T6/T7에서 일관. `readRiderRuntimeConfig`/`createAuthService`/`createDispatchService` 일관.
- **리스크:** T1 네이버 SDK 호환이 최대 미지수 → T1에서 검증·폴백(webview) 지시. 이후 태스크는 T1 green 전제.
