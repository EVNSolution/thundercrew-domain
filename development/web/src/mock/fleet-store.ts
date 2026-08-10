import { heldOrderOf, type Order } from './order-store';

/**
 * 차량·인력·계약 mock 스토어.
 *
 * 관리 화면이 쓴다. 주문은 order-store 가 소유하고, 이 스토어는 자산과 계약을
 * 소유한다. 용도 이동 제약을 검증할 때만 order-store 를 읽는다.
 *
 * 규칙은 docs/frontend/03-screen-feature-map.md §5 를 따른다.
 *   - 사용자가 ID/FK 를 직접 입력하지 않는다
 *   - 용도·직무는 읽기 전용이고 변경은 "이동"이다 (§5.3)
 *   - 이동은 진행 중 배차·활성 계약·함체 장비에 걸린다
 */

export type Purpose = 'DELIVERY' | 'CLEANING';
export type EngineType = 'ELECTRIC' | 'ICE' | 'LPG';
export type WheelType = 'TWO_WHEEL' | 'FOUR_WHEEL';
export type OperationStatus = 'READY' | 'IN_SERVICE';
export type RiderRole = 'RIDER' | 'CLEANER';
export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'EXPERT';
/** 배송용 계약의 처분 방식. */
export type ReturnType = 'TAKEOVER' | 'RETURN';
/** 클리닝 계약의 운영 방식. */
export type OperationType = 'DIRECT' | 'PARTNER';

export const PURPOSE_LABEL: Record<Purpose, string> = {
  DELIVERY: '배송용',
  CLEANING: '클린차량',
};
export const ENGINE_LABEL: Record<EngineType, string> = {
  ELECTRIC: '전기',
  ICE: '내연',
  LPG: 'LPG',
};
export const WHEEL_LABEL: Record<WheelType, string> = {
  TWO_WHEEL: '2륜',
  FOUR_WHEEL: '4륜',
};
export const STATUS_LABEL: Record<OperationStatus, string> = {
  READY: '대기',
  IN_SERVICE: '운행',
};
export const ROLE_LABEL: Record<RiderRole, string> = {
  RIDER: '라이더',
  CLEANER: '클리너',
};
export const SKILL_LABEL: Record<SkillLevel, string> = {
  BEGINNER: '초보',
  INTERMEDIATE: '중급',
  EXPERT: '고수',
};
export const RETURN_TYPE_LABEL: Record<ReturnType, string> = {
  TAKEOVER: '인수',
  RETURN: '반납',
};
export const OPERATION_TYPE_LABEL: Record<OperationType, string> = {
  DIRECT: '직영',
  PARTNER: '협력',
};

export interface Equipment {
  readonly id: string;
  /** 장비 종류명. "함체" 는 배송용 차량에만 붙는다. */
  readonly typeName: string;
  readonly serialNumber: string;
  readonly installedAt: string;
  readonly managementDueDate: string | null;
}

export interface StatusHistoryEntry {
  readonly at: string;
  readonly from: OperationStatus;
  readonly to: OperationStatus;
  readonly actor: string;
}

export interface Vehicle {
  readonly id: string;
  readonly plateNumber: string;
  readonly vin: string;
  readonly modelName: string;
  /** 용도. 읽기 전용이고 변경은 이동이다. */
  readonly purpose: Purpose;
  readonly engineType: EngineType;
  readonly wheelType: WheelType;
  readonly operationStatus: OperationStatus;
  readonly zoneId: string | null;
  readonly memo: string;
  readonly registeredAt: string;
  readonly equipment: readonly Equipment[];
  readonly deviceUid: string | null;
  readonly statusHistory: readonly StatusHistoryEntry[];
}

export interface Rider {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly teamName: string;
  /** 직무. 읽기 전용이고 변경은 이동이다. */
  readonly role: RiderRole;
  readonly skillLevel: SkillLevel | null;
  readonly zoneId: string | null;
  readonly trainingStatus: 'ONLINE' | 'OFFLINE' | 'INCOMPLETE';
  readonly appAccountLinked: boolean;
  readonly memo: string;
}

export interface Contract {
  readonly id: string;
  readonly riderId: string;
  readonly bikeId: string;
  readonly templateName: string;
  readonly startedOn: string;
  readonly endsOn: string;
  /** 배송용 계약만 값이 있다. */
  readonly returnType: ReturnType | null;
  /** 클리닝 계약만 값이 있다. */
  readonly operationType: OperationType | null;
  readonly terminated: boolean;
}

export interface FleetState {
  readonly vehicles: readonly Vehicle[];
  readonly riders: readonly Rider[];
  readonly contracts: readonly Contract[];
  readonly lastMessage: { kind: 'ok' | 'rejected'; text: string } | null;
}

function seedVehicles(): Vehicle[] {
  return [
    {
      id: 'bike-1',
      plateNumber: '12가 3456',
      vin: 'KMHXX00XXXX000001',
      modelName: '대창 EV-3',
      purpose: 'DELIVERY',
      engineType: 'ELECTRIC',
      wheelType: 'TWO_WHEEL',
      operationStatus: 'IN_SERVICE',
      zoneId: 'gangnam',
      memo: '',
      registeredAt: '2026-03-14',
      equipment: [
        {
          id: 'eq-1',
          typeName: '함체',
          serialNumber: 'BX-00412',
          installedAt: '2026-03-14',
          managementDueDate: '2026-09-14',
        },
      ],
      deviceUid: 'OTP-77120',
      statusHistory: [
        { at: '08-10 09:02', from: 'READY', to: 'IN_SERVICE', actor: '김도현' },
        { at: '08-09 19:40', from: 'IN_SERVICE', to: 'READY', actor: '시스템' },
      ],
    },
    {
      id: 'bike-2',
      plateNumber: '34나 7788',
      vin: 'KMHXX00XXXX000002',
      modelName: '혼다 PCX',
      purpose: 'DELIVERY',
      engineType: 'ICE',
      wheelType: 'TWO_WHEEL',
      operationStatus: 'READY',
      zoneId: 'mapo',
      memo: '',
      registeredAt: '2026-04-02',
      equipment: [
        {
          id: 'eq-2',
          typeName: '함체',
          serialNumber: 'BX-00518',
          installedAt: '2026-04-02',
          managementDueDate: '2026-10-02',
        },
      ],
      deviceUid: 'OTP-77340',
      statusHistory: [{ at: '08-10 07:15', from: 'IN_SERVICE', to: 'READY', actor: '이수민' }],
    },
    {
      id: 'bike-3',
      plateNumber: '78라 9900',
      vin: 'KMHXX00XXXX000003',
      modelName: '대창 EV-3',
      purpose: 'DELIVERY',
      engineType: 'ELECTRIC',
      wheelType: 'TWO_WHEEL',
      operationStatus: 'IN_SERVICE',
      zoneId: null,
      memo: '텔레메트리 미수신 확인 필요',
      registeredAt: '2026-05-21',
      equipment: [],
      deviceUid: 'OTP-78901',
      statusHistory: [],
    },
    {
      id: 'bike-4',
      plateNumber: '56다 1122',
      vin: 'KNCSXX00XXX000004',
      modelName: '기아 봉고 LPG',
      purpose: 'CLEANING',
      engineType: 'LPG',
      wheelType: 'FOUR_WHEEL',
      operationStatus: 'IN_SERVICE',
      zoneId: 'songpa',
      memo: '',
      registeredAt: '2026-04-02',
      equipment: [
        {
          id: 'eq-3',
          typeName: '고압 세척기',
          serialNumber: 'WS-0071',
          installedAt: '2026-04-02',
          managementDueDate: '2026-10-02',
        },
      ],
      deviceUid: 'OTP-81044',
      statusHistory: [],
    },
    {
      id: 'bike-5',
      plateNumber: '90마 3344',
      vin: 'KMHPXX00XXX000005',
      modelName: '현대 포터 LPG',
      purpose: 'CLEANING',
      engineType: 'LPG',
      wheelType: 'FOUR_WHEEL',
      operationStatus: 'IN_SERVICE',
      zoneId: 'mapo',
      memo: '',
      registeredAt: '2026-05-08',
      equipment: [
        {
          id: 'eq-4',
          typeName: '고압 세척기',
          serialNumber: 'WS-0088',
          installedAt: '2026-05-08',
          managementDueDate: '2026-11-08',
        },
      ],
      deviceUid: 'OTP-82551',
      statusHistory: [],
    },
    {
      id: 'bike-6',
      plateNumber: '12나 5566',
      vin: 'KMHXX00XXXX000006',
      modelName: '대창 EV-3',
      purpose: 'CLEANING',
      engineType: 'ELECTRIC',
      wheelType: 'TWO_WHEEL',
      operationStatus: 'READY',
      zoneId: 'gangnam',
      memo: '',
      registeredAt: '2026-06-19',
      equipment: [],
      deviceUid: 'OTP-83107',
      statusHistory: [],
    },
  ];
}

function seedRiders(): Rider[] {
  return [
    {
      id: 'rider-1',
      name: '김도현',
      phone: '010-1111-2222',
      teamName: '강남1팀',
      role: 'RIDER',
      skillLevel: 'EXPERT',
      zoneId: 'gangnam',
      trainingStatus: 'OFFLINE',
      appAccountLinked: true,
      memo: '',
    },
    {
      id: 'rider-2',
      name: '이수민',
      phone: '010-3333-4444',
      teamName: '마포1팀',
      role: 'RIDER',
      skillLevel: 'BEGINNER',
      zoneId: 'mapo',
      trainingStatus: 'ONLINE',
      appAccountLinked: true,
      memo: '',
    },
    {
      id: 'rider-3',
      name: '정민아',
      phone: '010-5555-6666',
      teamName: '강남1팀',
      role: 'RIDER',
      skillLevel: 'INTERMEDIATE',
      zoneId: 'gangnam',
      trainingStatus: 'INCOMPLETE',
      appAccountLinked: false,
      memo: '교육 미이수',
    },
    {
      id: 'rider-5',
      name: '한소희',
      phone: '010-2020-3030',
      teamName: '마포클린',
      role: 'CLEANER',
      skillLevel: 'EXPERT',
      zoneId: 'mapo',
      trainingStatus: 'OFFLINE',
      appAccountLinked: true,
      memo: '',
    },
    {
      id: 'rider-6',
      name: '박지호',
      phone: '010-4040-5050',
      teamName: '강남클린',
      role: 'CLEANER',
      skillLevel: 'EXPERT',
      zoneId: 'gangnam',
      trainingStatus: 'OFFLINE',
      appAccountLinked: true,
      memo: '',
    },
    {
      id: 'rider-4',
      name: '최유진',
      phone: '010-7777-8888',
      teamName: '송파클린',
      role: 'CLEANER',
      skillLevel: 'INTERMEDIATE',
      zoneId: 'songpa',
      trainingStatus: 'OFFLINE',
      appAccountLinked: true,
      memo: '',
    },
  ];
}

function seedContracts(): Contract[] {
  return [
    {
      id: 'ct-1',
      riderId: 'rider-1',
      bikeId: 'bike-1',
      templateName: '12개월 구독',
      startedOn: '2026-03-14',
      endsOn: '2027-03-13',
      returnType: 'RETURN',
      operationType: null,
      terminated: false,
    },
    {
      id: 'ct-2',
      riderId: 'rider-2',
      bikeId: 'bike-2',
      templateName: '3개월 렌탈',
      startedOn: '2026-06-01',
      endsOn: '2026-08-31',
      returnType: 'TAKEOVER',
      operationType: null,
      terminated: false,
    },
    {
      id: 'ct-3',
      riderId: 'rider-4',
      bikeId: 'bike-4',
      templateName: '클리닝 협력 계약',
      startedOn: '2026-04-02',
      endsOn: '2027-04-01',
      returnType: null,
      operationType: 'PARTNER',
      terminated: false,
    },
  ];
}

let state: FleetState = {
  vehicles: seedVehicles(),
  riders: seedRiders(),
  contracts: seedContracts(),
  lastMessage: null,
};
const listeners = new Set<() => void>();

function emit(next: FleetState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function subscribeFleet(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getFleetSnapshot(): FleetState {
  return state;
}

// ---------- 조회 ----------

export function vehiclesByPurpose(
  vehicles: readonly Vehicle[],
  purpose: Purpose,
): readonly Vehicle[] {
  return vehicles.filter((vehicle) => vehicle.purpose === purpose);
}

export function ridersByRole(riders: readonly Rider[], role: RiderRole): readonly Rider[] {
  return riders.filter((rider) => rider.role === role);
}

export function activeContractsOfVehicle(
  contracts: readonly Contract[],
  bikeId: string,
): readonly Contract[] {
  return contracts.filter((contract) => contract.bikeId === bikeId && !contract.terminated);
}

export function activeContractsOfRider(
  contracts: readonly Contract[],
  riderId: string,
): readonly Contract[] {
  return contracts.filter((contract) => contract.riderId === riderId && !contract.terminated);
}

export function contractsForPurpose(
  contracts: readonly Contract[],
  vehicles: readonly Vehicle[],
  purpose: Purpose,
): readonly Contract[] {
  const ids = new Set(vehiclesByPurpose(vehicles, purpose).map((vehicle) => vehicle.id));
  return contracts.filter((contract) => ids.has(contract.bikeId));
}

// ---------- 용도 이동 ----------

export interface MoveBlocker {
  readonly kind: 'dispatch' | 'contract' | 'equipment';
  readonly text: string;
  /** 사용자가 지금 화면에서 해결할 수 있는지. 아니면 다른 화면으로 가야 한다. */
  readonly resolvableHere: boolean;
}

/**
 * 차량 용도 이동을 막는 것들.
 *
 * 이동은 편집이 아니라 소속 변경이다. 이동하면 그 차량이 현재 목록에서
 * 사라지는 것이 올바른 동작이므로, 무엇이 함께 끊기는지 먼저 밝혀야 한다.
 */
export function vehicleMoveBlockers(
  vehicle: Vehicle,
  orders: readonly Order[],
  contracts: readonly Contract[],
): readonly MoveBlocker[] {
  const blockers: MoveBlocker[] = [];

  const held = heldOrderOf(orders, vehicle.id);
  if (held) {
    blockers.push({
      kind: 'dispatch',
      text: `진행 중 배차가 있습니다 — ${held.address}. 완료하거나 반납한 뒤 이동하세요.`,
      resolvableHere: false,
    });
  }

  const active = activeContractsOfVehicle(contracts, vehicle.id);
  for (const contract of active) {
    const current =
      vehicle.purpose === 'DELIVERY'
        ? `인수방식 ${contract.returnType ? RETURN_TYPE_LABEL[contract.returnType] : '미설정'}`
        : `운영방식 ${contract.operationType ? OPERATION_TYPE_LABEL[contract.operationType] : '미설정'}`;
    const next = vehicle.purpose === 'DELIVERY' ? '직영/협력' : '인수/반납';
    blockers.push({
      kind: 'contract',
      text: `활성 계약 "${contract.templateName}" 의 ${current} 은 이동 후 ${next} 로 바뀌어야 합니다. 계약을 종료하거나 인수방식을 다시 고르세요.`,
      resolvableHere: false,
    });
  }

  // 함체는 배송용 전용 장비다. 클린차량으로 가면 탈거해야 한다.
  if (vehicle.purpose === 'DELIVERY') {
    for (const item of vehicle.equipment) {
      if (item.typeName === '함체') {
        blockers.push({
          kind: 'equipment',
          text: `함체(${item.serialNumber})는 배송용 전용입니다. 탈거한 뒤 이동하세요.`,
          resolvableHere: true,
        });
      }
    }
  }

  return blockers;
}

export function riderMoveBlockers(
  rider: Rider,
  orders: readonly Order[],
  vehicles: readonly Vehicle[],
  contracts: readonly Contract[],
): readonly MoveBlocker[] {
  const blockers: MoveBlocker[] = [];

  // 이 인력이 배정된 차량에 진행 중 배차가 있으면 막는다.
  const bikeIds = contracts
    .filter((contract) => contract.riderId === rider.id && !contract.terminated)
    .map((contract) => contract.bikeId);
  for (const bikeId of bikeIds) {
    const held = heldOrderOf(orders, bikeId);
    if (held) {
      const plate = vehicles.find((vehicle) => vehicle.id === bikeId)?.plateNumber ?? bikeId;
      blockers.push({
        kind: 'dispatch',
        text: `${plate} 에 진행 중 배차가 있습니다 — ${held.address}.`,
        resolvableHere: false,
      });
    }
  }

  const active = activeContractsOfRider(contracts, rider.id);
  if (active.length > 0) {
    blockers.push({
      kind: 'contract',
      text: `활성 계약 ${active.length}건이 있습니다. 직무를 바꾸면 계약의 인수방식 축이 달라집니다.`,
      resolvableHere: false,
    });
  }

  return blockers;
}

// ---------- 동작 ----------

export function updateVehicle(id: string, changes: Partial<Vehicle>): void {
  const vehicle = state.vehicles.find((candidate) => candidate.id === id);
  if (!vehicle) return;
  // 용도는 이 경로로 바꾸지 않는다. 이동만이 유일한 경로다.
  const { purpose: _ignored, ...safe } = changes;
  emit({
    ...state,
    vehicles: state.vehicles.map((candidate) =>
      candidate.id === id ? { ...candidate, ...safe } : candidate,
    ),
    lastMessage: { kind: 'ok', text: `${vehicle.plateNumber} 을 저장했습니다.` },
  });
}

export function removeEquipment(vehicleId: string, equipmentId: string): void {
  const vehicle = state.vehicles.find((candidate) => candidate.id === vehicleId);
  const item = vehicle?.equipment.find((candidate) => candidate.id === equipmentId);
  if (!vehicle || !item) return;
  emit({
    ...state,
    vehicles: state.vehicles.map((candidate) =>
      candidate.id === vehicleId
        ? {
            ...candidate,
            equipment: candidate.equipment.filter((entry) => entry.id !== equipmentId),
          }
        : candidate,
    ),
    lastMessage: { kind: 'ok', text: `${item.typeName}(${item.serialNumber})를 탈거했습니다.` },
  });
}

export function terminateContract(contractId: string): void {
  const contract = state.contracts.find((candidate) => candidate.id === contractId);
  if (!contract || contract.terminated) return;
  emit({
    ...state,
    contracts: state.contracts.map((candidate) =>
      candidate.id === contractId ? { ...candidate, terminated: true } : candidate,
    ),
    lastMessage: { kind: 'ok', text: `계약 "${contract.templateName}" 을 종료했습니다.` },
  });
}

/**
 * 차량 용도 이동. 막는 것이 하나라도 있으면 거부하고 이유를 그대로 돌려준다.
 * 이동 후 그 차량은 현재 목록에서 사라진다 — 의도된 결과다.
 */
export function moveVehiclePurpose(id: string, orders: readonly Order[]): void {
  const vehicle = state.vehicles.find((candidate) => candidate.id === id);
  if (!vehicle) return;

  const blockers = vehicleMoveBlockers(vehicle, orders, state.contracts);
  if (blockers.length > 0) {
    emit({
      ...state,
      lastMessage: {
        kind: 'rejected',
        text: `${vehicle.plateNumber} 을 이동할 수 없습니다. ${blockers.length}건이 먼저 해결돼야 합니다.`,
      },
    });
    return;
  }

  const next: Purpose = vehicle.purpose === 'DELIVERY' ? 'CLEANING' : 'DELIVERY';
  emit({
    ...state,
    vehicles: state.vehicles.map((candidate) =>
      candidate.id === id ? { ...candidate, purpose: next } : candidate,
    ),
    lastMessage: {
      kind: 'ok',
      text: `${vehicle.plateNumber} 을 ${PURPOSE_LABEL[next]} 으로 이동했습니다. 이 목록에서는 사라지고 ${PURPOSE_LABEL[next]} 관리에서 보입니다.`,
    },
  });
}

export function moveRiderRole(id: string, orders: readonly Order[]): void {
  const rider = state.riders.find((candidate) => candidate.id === id);
  if (!rider) return;

  const blockers = riderMoveBlockers(rider, orders, state.vehicles, state.contracts);
  if (blockers.length > 0) {
    emit({
      ...state,
      lastMessage: {
        kind: 'rejected',
        text: `${rider.name} 의 직무를 바꿀 수 없습니다. ${blockers.length}건이 먼저 해결돼야 합니다.`,
      },
    });
    return;
  }

  const next: RiderRole = rider.role === 'RIDER' ? 'CLEANER' : 'RIDER';
  emit({
    ...state,
    riders: state.riders.map((candidate) =>
      candidate.id === id ? { ...candidate, role: next } : candidate,
    ),
    lastMessage: {
      kind: 'ok',
      text: `${rider.name} 의 직무를 ${ROLE_LABEL[next]} 로 바꿨습니다.`,
    },
  });
}

export function updateRider(id: string, changes: Partial<Rider>): void {
  const rider = state.riders.find((candidate) => candidate.id === id);
  if (!rider) return;
  const { role: _ignored, ...safe } = changes;
  emit({
    ...state,
    riders: state.riders.map((candidate) =>
      candidate.id === id ? { ...candidate, ...safe } : candidate,
    ),
    lastMessage: { kind: 'ok', text: `${rider.name} 을 저장했습니다.` },
  });
}

export function clearFleetMessage(): void {
  if (state.lastMessage === null) return;
  emit({ ...state, lastMessage: null });
}
