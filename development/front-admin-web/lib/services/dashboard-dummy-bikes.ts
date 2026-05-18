import type { FrontendDashboardBikePin } from "@/lib/services/service-ops-api";

/**
 * 운영자가 실제 차량/텔레메트리가 아직 안 붙은 상태에서 지도 UI 가 제대로
 * 동작하는지(아이콘, 클릭, 패널) 시연·확인할 수 있게 더미 오토바이 핀을
 * 끼워 넣는 헬퍼. `loadDashboardMapState` 가 env(`SHOW_DUMMY_BIKES=1`) 가
 * 켜져 있을 때만 호출한다 — 실제 차량이 텔레메트리를 흘리기 시작하면
 * env 만 빼서 끄면 된다.
 *
 * 데이터는 결정적(deterministic) 이라 폴링이 돌아도 위치가 안 바뀐다 —
 * "지도가 매번 흔들리는 것처럼 보임" 같은 시각적 노이즈를 방지한다. 실제
 * 동선 데모가 필요하면 별도 함수로 시간 기반 보간을 추가하면 된다.
 *
 * 좌표 범위: 서울 시내. 강남·종로·홍대·강북 근방에 흩뿌렸다.
 */

interface DummyBikeSeed {
  id: string;
  plate: string;
  model: string;
  lat: number;
  lng: number;
  // "운행중" 시각화 vs "대기" 시각화를 골고루 보여주려고 둘 다 섞는다.
  driving: "DRIVING" | "PARKED";
  battery: number;
  rider: string | null;
}

const DUMMY_SEEDS: ReadonlyArray<DummyBikeSeed> = [
  {
    id: "dummy-bike-01",
    plate: "12가1001",
    model: "Honda PCX",
    lat: 37.498095,
    lng: 127.02761,
    driving: "DRIVING",
    battery: 87,
    rider: "김라이더"
  },
  {
    id: "dummy-bike-02",
    plate: "34나1002",
    model: "Honda PCX",
    lat: 37.514575,
    lng: 127.0495,
    driving: "PARKED",
    battery: 62,
    rider: null
  },
  {
    id: "dummy-bike-03",
    plate: "56다1003",
    model: "Yamaha NMAX",
    lat: 37.5704,
    lng: 126.9821,
    driving: "DRIVING",
    battery: 41,
    rider: "박배달"
  },
  {
    id: "dummy-bike-04",
    plate: "78라1004",
    model: "Yamaha NMAX",
    lat: 37.5535,
    lng: 126.9224,
    driving: "PARKED",
    battery: 18,
    rider: null
  },
  {
    id: "dummy-bike-05",
    plate: "90마1005",
    model: "KYMCO Like",
    lat: 37.541,
    lng: 127.0696,
    driving: "DRIVING",
    battery: 73,
    rider: "이배송"
  },
  {
    id: "dummy-bike-06",
    plate: "12바1006",
    model: "KYMCO Like",
    lat: 37.6396,
    lng: 127.0257,
    driving: "PARKED",
    battery: 55,
    rider: null
  },
  {
    id: "dummy-bike-07",
    plate: "34사1007",
    model: "Honda PCX",
    lat: 37.485,
    lng: 126.918,
    driving: "DRIVING",
    battery: 92,
    rider: "최운송"
  },
  {
    id: "dummy-bike-08",
    plate: "56아1008",
    model: "Yamaha NMAX",
    lat: 37.5219,
    lng: 127.04,
    driving: "PARKED",
    battery: 8,
    rider: null
  }
];

/**
 * 더미 핀 N 개. count 가 seed 배열 길이보다 크면 seed 만큼만 돌려준다 —
 * 운영자에게 시드 단위로 안정적인 동일성을 보장하기 위함.
 */
export function generateDummyBikePins(count: number = DUMMY_SEEDS.length): FrontendDashboardBikePin[] {
  const slice = DUMMY_SEEDS.slice(0, Math.min(count, DUMMY_SEEDS.length));
  const generatedAt = new Date().toISOString();

  return slice.map((seed) => {
    const isDriving = seed.driving === "DRIVING";
    const batteryStatus =
      seed.battery <= 20 ? "LOW" : seed.battery <= 50 ? "MEDIUM" : "HEALTHY";

    return {
      bikeId: seed.id,
      slug: seed.id,
      bikeIdx: null,
      plateNumber: seed.plate,
      modelName: seed.model,
      // /overview 의 운영 상태 narrow set(READY / IN_SERVICE) 과 일치.
      operationStatus: isDriving ? "IN_SERVICE" : "READY",
      activeRiderLabel: seed.rider,
      deviceId: null,
      lastReceivedAt: generatedAt,
      latitude: seed.lat,
      longitude: seed.lng,
      speedKph: isDriving ? 38 : 0,
      batteryPercent: seed.battery,
      ignitionStatus: isDriving ? "ON" : "OFF",
      // 텔레메트리 소스를 "DUMMY" 로 명시해서 운영자가 패널 열었을 때
      // "이건 진짜가 아니구나" 라고 즉시 식별할 수 있게 한다.
      telemetrySource: "DUMMY",
      drivingStatus: isDriving ? "DRIVING" : "PARKED",
      connectionStatus: "ONLINE",
      batteryStatus,
      pinLabel: `${seed.plate} (더미)`
    };
  });
}

export function dummyBikesEnabled(): boolean {
  // "1" / "true" / "yes" 같은 흔한 truthy 표기를 다 받아준다. 다른 값은
  // 안전하게 off 로 친다.
  const raw = (process.env.SHOW_DUMMY_BIKES ?? "").toLowerCase().trim();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
