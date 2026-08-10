import { createContext, useContext, useMemo, useState } from 'react';
import { ZONES } from '../../mock/delivery-control';
import {
  activeContractsOfVehicle,
  clearFleetMessage,
  contractsForPurpose,
  ENGINE_LABEL,
  moveRiderRole,
  moveVehiclePurpose,
  OPERATION_TYPE_LABEL,
  PURPOSE_LABEL,
  removeEquipment,
  RETURN_TYPE_LABEL,
  ridersByRole,
  riderMoveBlockers,
  ROLE_LABEL,
  SKILL_LABEL,
  STATUS_LABEL,
  terminateContract,
  updateRider,
  updateVehicle,
  vehicleMoveBlockers,
  vehiclesByPurpose,
  WHEEL_LABEL,
  type EngineType,
  type MoveBlocker,
  type OperationStatus,
  type Purpose,
  type Rider,
  type RiderRole,
  type SkillLevel,
  type Vehicle,
  type WheelType,
} from '../../mock/fleet-store';
import { useFleetStore } from '../../mock/useFleetStore';
import { useOrderStore } from '../../mock/useOrderStore';

/**
 * 관리 화면은 배송용·클린차량이 구조가 같고 대상만 다르다 (§10).
 * 그래서 한 컴포넌트를 용도로 파라미터화한다. 화면을 두 벌 만들면
 * 한쪽만 고쳐지는 드리프트가 반드시 생긴다.
 */
interface PurposeContext {
  readonly purpose: Purpose;
  readonly other: Purpose;
  readonly role: RiderRole;
  /** 인력 탭 이름. 배송용은 "라이더", 클리닝은 "클리너". */
  readonly peopleLabel: string;
  /** 이 용도 전용 장비. 배송용은 함체, 클리닝은 없다. */
  readonly exclusiveEquipment: string | null;
  readonly operationsLabel: string;
}

const CONTEXTS: Record<Purpose, PurposeContext> = {
  DELIVERY: {
    purpose: 'DELIVERY',
    other: 'CLEANING',
    role: 'RIDER',
    peopleLabel: '라이더',
    exclusiveEquipment: '함체',
    operationsLabel: '배송',
  },
  CLEANING: {
    purpose: 'CLEANING',
    other: 'DELIVERY',
    role: 'CLEANER',
    peopleLabel: '클리너',
    exclusiveEquipment: null,
    operationsLabel: '클리닝',
  },
};

const PurposeCtx = createContext<PurposeContext>(CONTEXTS.DELIVERY);
const usePurposeCtx = () => useContext(PurposeCtx);

type TargetId = 'vehicles' | 'riders' | 'contracts' | 'insurance' | 'stations' | 'equipment' | 'devices' | 'zones';

const TARGETS: ReadonlyArray<{ id: TargetId; label: string; shared: boolean }> = [
  { id: 'vehicles', label: '차량', shared: false },
  { id: 'riders', label: '인력', shared: false },  // 렌더 시 ctx.peopleLabel 로 바꾼다
  { id: 'contracts', label: '계약', shared: false },
  { id: 'insurance', label: '보험', shared: false },
  { id: 'stations', label: '스테이션', shared: true },
  { id: 'equipment', label: '장비', shared: true },
  { id: 'devices', label: '단말', shared: true },
  { id: 'zones', label: '권역', shared: true },
];

function zoneName(zoneId: string | null): string {
  if (zoneId === null) return '미지정';
  return ZONES.find((zone) => zone.id === zoneId)?.name ?? '미지정';
}

/**
 * 배송용 관리 — 기준정보.
 *
 * 여기서 만든 것을 관제·배차가 쓴다. 사용자가 ID/FK 를 직접 입력하지 않는다.
 * 용도와 직무는 읽기 전용이고 변경은 "이동"이다 (§5.3) — 이동하면 그 대상이
 * 이 목록에서 사라지는 것이 올바른 동작이므로, 무엇이 끊기는지 먼저 밝힌다.
 */
export function MasterDataPage({ purpose }: { purpose: Purpose }) {
  const ctx = CONTEXTS[purpose];
  const fleet = useFleetStore();
  const [target, setTarget] = useState<TargetId>('vehicles');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);

  const vehicles = useMemo(
    () => vehiclesByPurpose(fleet.vehicles, ctx.purpose),
    [fleet.vehicles, ctx.purpose],
  );
  const riders = useMemo(() => ridersByRole(fleet.riders, ctx.role), [fleet.riders, ctx.role]);
  const contracts = useMemo(
    () => contractsForPurpose(fleet.contracts, fleet.vehicles, ctx.purpose),
    [fleet.contracts, fleet.vehicles, ctx.purpose],
  );

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? vehicles[0] ?? null;
  const selectedRider = riders.find((rider) => rider.id === selectedRiderId) ?? riders[0] ?? null;

  return (
    <PurposeCtx.Provider value={ctx}>
    <main className="page-content">
      <div className="page-hero">
        <div className="hero-titles">
          <h1>관리</h1>
          <p>{ctx.operationsLabel} 운영이 쓰는 기준정보를 관리합니다.</p>
        </div>
        <div className="hero-tools">
          <span className={`scope-tag${ctx.purpose === 'CLEANING' ? ' is-clean' : ''}`}>
            {PURPOSE_LABEL[ctx.purpose]}
          </span>
          <button className="btn is-primary" type="button">
            차량 등록
          </button>
        </div>
      </div>

      {fleet.lastMessage && (
        <p
          className={fleet.lastMessage.kind === 'rejected' ? 'error-state' : 'inline-warn'}
          role="status"
          style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}
        >
          <span aria-hidden="true">{fleet.lastMessage.kind === 'rejected' ? '✕' : '✓'}</span>
          {fleet.lastMessage.text}
          <button
            className="btn is-small"
            type="button"
            onClick={clearFleetMessage}
            style={{ marginLeft: 'auto' }}
          >
            닫기
          </button>
        </p>
      )}

      <div className="master-tabs" role="group" aria-label="관리 대상">
        {TARGETS.map((entry) => (
          <button
            key={entry.id}
            className={`master-tab${entry.shared ? ' is-shared' : ''}`}
            type="button"
            aria-pressed={target === entry.id}
            onClick={() => setTarget(entry.id)}
          >
            {entry.id === 'riders' ? ctx.peopleLabel : entry.label}
          </button>
        ))}
      </div>
      <p className="sub" style={{ margin: '-6px 0 var(--space-3)' }}>
        "공유" 표시된 대상은 {PURPOSE_LABEL[ctx.other]} 관리와 같은 데이터입니다. 어느 쪽에서
        고쳐도 양쪽에 반영됩니다.
      </p>

      {target === 'vehicles' && (
        <div className="master-detail-grid">
          <VehicleList
            vehicles={vehicles}
            selectedId={selectedVehicle?.id ?? null}
            onSelect={setSelectedVehicleId}
          />
          <section className="page-panel">
            {selectedVehicle ? (
              <VehicleEditor vehicle={selectedVehicle} />
            ) : (
              <div className="empty-state">
                <b>{PURPOSE_LABEL[ctx.purpose]} 차량이 없습니다</b>
                차량을 등록하거나 {PURPOSE_LABEL[ctx.other]} 관리에서 이동해 오세요.
              </div>
            )}
          </section>
        </div>
      )}

      {target === 'riders' && (
        <div className="master-detail-grid">
          <RiderList
            riders={riders}
            selectedId={selectedRider?.id ?? null}
            onSelect={setSelectedRiderId}
          />
          <section className="page-panel">
            {selectedRider ? (
              <RiderEditor rider={selectedRider} />
            ) : (
              <div className="empty-state">
                <b>{ctx.peopleLabel}가 없습니다</b>
                {ctx.peopleLabel}를 등록하거나 다른 직무에서 바꿔 오세요.
              </div>
            )}
          </section>
        </div>
      )}

      {target === 'contracts' && (
        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">계약</div>
              <p className="panel-sub">
                {PURPOSE_LABEL[ctx.purpose]} 차량 계약 {contracts.filter((c) => !c.terminated).length}건 활성
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="page-table" style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th scope="col">라이더</th>
                  <th scope="col">차량</th>
                  <th scope="col">양식</th>
                  <th scope="col">기간</th>
                  <th scope="col">인수방식</th>
                  <th scope="col">상태</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => {
                  const rider = fleet.riders.find((r) => r.id === contract.riderId);
                  const vehicle = fleet.vehicles.find((v) => v.id === contract.bikeId);
                  return (
                    <tr key={contract.id}>
                      <td>{rider?.name ?? '—'}</td>
                      <td className="plate">{vehicle?.plateNumber ?? '—'}</td>
                      <td>{contract.templateName}</td>
                      <td className="num sub">
                        {contract.startedOn} ~ {contract.endsOn}
                      </td>
                      <td>
                        {contract.returnType ? (
                          <span className="chip is-mini is-blue">
                            {RETURN_TYPE_LABEL[contract.returnType]}
                          </span>
                        ) : contract.operationType ? (
                          <span className="chip is-mini is-gray">
                            {OPERATION_TYPE_LABEL[contract.operationType]}
                          </span>
                        ) : (
                          <span className="sub">미설정</span>
                        )}
                      </td>
                      <td>
                        <span className={`chip is-mini ${contract.terminated ? 'is-gray' : 'is-green'}`}>
                          {contract.terminated ? '종료' : '활성'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {!contract.terminated && (
                          <button
                            className="btn is-small"
                            type="button"
                            onClick={() => terminateContract(contract.id)}
                          >
                            종료
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="sub" style={{ marginTop: 10 }}>
            {ctx.purpose === 'DELIVERY'
              ? '배송용 계약의 인수방식은 인수 / 반납입니다. 클리닝은 직영 / 협력이라, 차량을 이동하면 이 값이 맞지 않게 됩니다.'
              : '클리닝 계약의 운영방식은 직영 / 협력입니다. 배송용은 인수 / 반납이라, 차량을 이동하면 이 값이 맞지 않게 됩니다.'}{' '}
            그래서 활성 계약이 이동을 막습니다.
          </p>
        </section>
      )}

      {target !== 'vehicles' && target !== 'riders' && target !== 'contracts' && (
        <NotBuiltYet target={target} />
      )}
    </main>
    </PurposeCtx.Provider>
  );
}

function VehicleList({
  vehicles,
  selectedId,
  onSelect,
}: {
  vehicles: readonly Vehicle[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const ctx = usePurposeCtx();
  const [query, setQuery] = useState('');
  const filtered = vehicles.filter((vehicle) =>
    vehicle.plateNumber.replace(/\s/g, '').includes(query.replace(/\s/g, '')),
  );

  return (
    <section className="page-panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">차량</div>
          <p className="panel-sub">
            {PURPOSE_LABEL[ctx.purpose]} {vehicles.length}대
          </p>
        </div>
        <input
          className="control"
          style={{ width: 140 }}
          placeholder="차량번호 검색"
          aria-label="차량번호 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">
          <b>검색 결과가 없습니다</b>
          차량번호를 다시 확인하세요.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="page-table" style={{ minWidth: 400 }}>
            <thead>
              <tr>
                <th scope="col">차량번호</th>
                <th scope="col">모델</th>
                <th scope="col">엔진</th>
                <th scope="col">권역</th>
                <th scope="col">상태</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((vehicle) => (
                <tr
                  key={vehicle.id}
                  className="is-selectable"
                  aria-selected={vehicle.id === selectedId}
                  onClick={() => onSelect(vehicle.id)}
                >
                  <td className="plate">{vehicle.plateNumber}</td>
                  <td>{vehicle.modelName}</td>
                  <td>{ENGINE_LABEL[vehicle.engineType]}</td>
                  <td>{zoneName(vehicle.zoneId)}</td>
                  <td>
                    <span
                      className={`chip is-mini ${vehicle.operationStatus === 'IN_SERVICE' ? 'is-green' : 'is-gray'}`}
                    >
                      {STATUS_LABEL[vehicle.operationStatus]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function VehicleEditor({ vehicle }: { vehicle: Vehicle }) {
  const ctx = usePurposeCtx();
  const { orders } = useOrderStore();
  const fleet = useFleetStore();
  const blockers = vehicleMoveBlockers(vehicle, orders, fleet.contracts);
  const contracts = activeContractsOfVehicle(fleet.contracts, vehicle.id);

  return (
    <>
      <div className="panel-head">
        <div>
          <div className="panel-title">{vehicle.plateNumber}</div>
          <p className="panel-sub">등록 {vehicle.registeredAt}</p>
        </div>
        <span
          className={`chip ${vehicle.operationStatus === 'IN_SERVICE' ? 'is-green' : 'is-gray'}`}
        >
          {STATUS_LABEL[vehicle.operationStatus]}
        </span>
      </div>

      <MoveField
        label="용도"
        current={PURPOSE_LABEL[vehicle.purpose]}
        actionLabel={`${PURPOSE_LABEL[ctx.other]}으로 이동`}
        blockers={blockers}
        onMove={() => moveVehiclePurpose(vehicle.id, orders)}
      />

      <div className="form-grid" style={{ marginTop: 'var(--space-4)' }}>
        <div className="field">
          <label htmlFor="v-plate">차량번호</label>
          <input
            className="control"
            id="v-plate"
            value={vehicle.plateNumber}
            onChange={(event) => updateVehicle(vehicle.id, { plateNumber: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="v-vin">VIN</label>
          <input
            className="control"
            id="v-vin"
            value={vehicle.vin}
            onChange={(event) => updateVehicle(vehicle.id, { vin: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="v-model">모델</label>
          <input
            className="control"
            id="v-model"
            value={vehicle.modelName}
            onChange={(event) => updateVehicle(vehicle.id, { modelName: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="v-engine">엔진</label>
          <select
            className="control"
            id="v-engine"
            value={vehicle.engineType}
            onChange={(event) =>
              updateVehicle(vehicle.id, { engineType: event.target.value as EngineType })
            }
          >
            {(Object.keys(ENGINE_LABEL) as EngineType[]).map((key) => (
              <option key={key} value={key}>
                {ENGINE_LABEL[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="v-wheel">휠</label>
          <select
            className="control"
            id="v-wheel"
            value={vehicle.wheelType}
            onChange={(event) =>
              updateVehicle(vehicle.id, { wheelType: event.target.value as WheelType })
            }
          >
            {(Object.keys(WHEEL_LABEL) as WheelType[]).map((key) => (
              <option key={key} value={key}>
                {WHEEL_LABEL[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="v-zone">권역</label>
          <select
            className="control"
            id="v-zone"
            value={vehicle.zoneId ?? ''}
            onChange={(event) =>
              updateVehicle(vehicle.id, { zoneId: event.target.value || null })
            }
          >
            <option value="">미지정</option>
            {ZONES.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="v-status">차체 상태</label>
          <select
            className="control"
            id="v-status"
            value={vehicle.operationStatus}
            onChange={(event) =>
              updateVehicle(vehicle.id, {
                operationStatus: event.target.value as OperationStatus,
              })
            }
          >
            {(Object.keys(STATUS_LABEL) as OperationStatus[]).map((key) => (
              <option key={key} value={key}>
                {STATUS_LABEL[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="field is-wide">
          <label htmlFor="v-memo">메모</label>
          <input
            className="control"
            id="v-memo"
            placeholder="특이사항"
            value={vehicle.memo}
            onChange={(event) => updateVehicle(vehicle.id, { memo: event.target.value })}
          />
        </div>
      </div>

      {/* 장비 — 배송용은 함체가 붙는다 */}
      <div className="panel-head" style={{ margin: 'var(--space-5) 0 8px' }}>
        <span className="panel-title">장비</span>
        <button className="btn is-small" type="button">
          장비 추가
        </button>
      </div>
      {vehicle.equipment.length === 0 && vehicle.deviceUid === null ? (
        <div className="empty-state">
          <b>붙어 있는 장비가 없습니다</b>
          {ctx.exclusiveEquipment
            ? `${PURPOSE_LABEL[ctx.purpose]} 차량에는 ${ctx.exclusiveEquipment}를 붙일 수 있습니다.`
            : `${ctx.exclusiveEquipment ?? '전용 장비'}는 없습니다. 공통 장비만 붙습니다.`}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="page-table" style={{ minWidth: 380 }}>
            <thead>
              <tr>
                <th scope="col">종류</th>
                <th scope="col">고유번호</th>
                <th scope="col">설치</th>
                <th scope="col">점검 예정</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {vehicle.equipment.map((item) => (
                <tr key={item.id}>
                  <td>{item.typeName}</td>
                  <td className="num">{item.serialNumber}</td>
                  <td className="num">{item.installedAt}</td>
                  <td className="num">{item.managementDueDate ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn is-small"
                      type="button"
                      onClick={() => removeEquipment(vehicle.id, item.id)}
                    >
                      탈거
                    </button>
                  </td>
                </tr>
              ))}
              {vehicle.deviceUid && (
                <tr>
                  <td>단말</td>
                  <td className="num">{vehicle.deviceUid}</td>
                  <td className="num">{vehicle.registeredAt}</td>
                  <td>—</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn is-small"
                      type="button"
                      onClick={() => updateVehicle(vehicle.id, { deviceUid: null })}
                    >
                      해제
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {contracts.length > 0 && (
        <>
          <div className="panel-head" style={{ margin: 'var(--space-5) 0 8px' }}>
            <span className="panel-title">활성 계약</span>
            <span className="chip is-gray is-mini">{contracts.length}건</span>
          </div>
          <div className="table-wrap">
            <table className="page-table" style={{ minWidth: 300 }}>
              <thead>
                <tr>
                  <th scope="col">양식</th>
                  <th scope="col">인수방식</th>
                  <th scope="col">종료일</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr key={contract.id}>
                    <td>{contract.templateName}</td>
                    <td>
                      {contract.returnType ? RETURN_TYPE_LABEL[contract.returnType] : '—'}
                    </td>
                    <td className="num">{contract.endsOn}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 차체 상태 이력 — 자산 맥락이라 여기 둔다 (§1.2) */}
      <div className="panel-head" style={{ margin: 'var(--space-5) 0 8px' }}>
        <span className="panel-title">차체 상태 이력</span>
      </div>
      {vehicle.statusHistory.length === 0 ? (
        <div className="empty-state">
          <b>기록이 없습니다</b>
          운행/대기 전환이 생기면 여기에 쌓입니다.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="page-table" style={{ minWidth: 280 }}>
            <thead>
              <tr>
                <th scope="col">시각</th>
                <th scope="col">변경</th>
                <th scope="col">행위자</th>
              </tr>
            </thead>
            <tbody>
              {vehicle.statusHistory.map((entry, index) => (
                <tr key={`${entry.at}-${index}`}>
                  <td className="num">{entry.at}</td>
                  <td>
                    {STATUS_LABEL[entry.from]} → {STATUS_LABEL[entry.to]}
                  </td>
                  <td>{entry.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="form-actions">
        <button className="btn is-danger" type="button">
          비활성
        </button>
      </div>
      <p className="sub" style={{ marginTop: 6, textAlign: 'right' }}>
        입력은 즉시 반영됩니다. mock 이라 별도 저장 버튼을 두지 않았습니다.
      </p>
    </>
  );
}

function RiderList({
  riders,
  selectedId,
  onSelect,
}: {
  riders: readonly Rider[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="page-panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">라이더</div>
          <p className="panel-sub">{riders.length}명</p>
        </div>
      </div>
      <div className="table-wrap">
        <table className="page-table" style={{ minWidth: 400 }}>
          <thead>
            <tr>
              <th scope="col">이름</th>
              <th scope="col">소속</th>
              <th scope="col">숙련도</th>
              <th scope="col">권역</th>
              <th scope="col">앱</th>
            </tr>
          </thead>
          <tbody>
            {riders.map((rider) => (
              <tr
                key={rider.id}
                className="is-selectable"
                aria-selected={rider.id === selectedId}
                onClick={() => onSelect(rider.id)}
              >
                <td style={{ fontWeight: 800 }}>{rider.name}</td>
                <td>{rider.teamName}</td>
                <td>{rider.skillLevel ? SKILL_LABEL[rider.skillLevel] : '—'}</td>
                <td>{zoneName(rider.zoneId)}</td>
                <td>
                  <span className={`chip is-mini ${rider.appAccountLinked ? 'is-green' : 'is-gray'}`}>
                    {rider.appAccountLinked ? '연결' : '미연결'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RiderEditor({ rider }: { rider: Rider }) {
  const { orders } = useOrderStore();
  const fleet = useFleetStore();
  const blockers = riderMoveBlockers(rider, orders, fleet.vehicles, fleet.contracts);

  return (
    <>
      <div className="panel-head">
        <div>
          <div className="panel-title">{rider.name}</div>
          <p className="panel-sub">{rider.phone}</p>
        </div>
        <span className={`chip ${rider.appAccountLinked ? 'is-green' : 'is-gray'}`}>
          앱 {rider.appAccountLinked ? '연결' : '미연결'}
        </span>
      </div>

      <MoveField
        label="직무"
        current={ROLE_LABEL[rider.role]}
        actionLabel={`${ROLE_LABEL[rider.role === 'RIDER' ? 'CLEANER' : 'RIDER']}로 변경`}
        blockers={blockers}
        onMove={() => moveRiderRole(rider.id, orders)}
      />

      <div className="form-grid" style={{ marginTop: 'var(--space-4)' }}>
        <div className="field">
          <label htmlFor="r-name">이름</label>
          <input
            className="control"
            id="r-name"
            value={rider.name}
            onChange={(event) => updateRider(rider.id, { name: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="r-phone">연락처</label>
          <input
            className="control num"
            id="r-phone"
            value={rider.phone}
            onChange={(event) => updateRider(rider.id, { phone: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="r-team">소속</label>
          <input
            className="control"
            id="r-team"
            value={rider.teamName}
            onChange={(event) => updateRider(rider.id, { teamName: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="r-skill">숙련도</label>
          <select
            className="control"
            id="r-skill"
            value={rider.skillLevel ?? ''}
            onChange={(event) =>
              updateRider(rider.id, {
                skillLevel: (event.target.value || null) as SkillLevel | null,
              })
            }
          >
            <option value="">미설정</option>
            {(Object.keys(SKILL_LABEL) as SkillLevel[]).map((key) => (
              <option key={key} value={key}>
                {SKILL_LABEL[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="r-zone">권역</label>
          <select
            className="control"
            id="r-zone"
            value={rider.zoneId ?? ''}
            onChange={(event) => updateRider(rider.id, { zoneId: event.target.value || null })}
          >
            <option value="">미지정</option>
            {ZONES.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="r-training">교육 상태</label>
          <select
            className="control"
            id="r-training"
            value={rider.trainingStatus}
            onChange={(event) =>
              updateRider(rider.id, {
                trainingStatus: event.target.value as Rider['trainingStatus'],
              })
            }
          >
            <option value="ONLINE">온라인 이수</option>
            <option value="OFFLINE">오프라인 이수</option>
            <option value="INCOMPLETE">미이수</option>
          </select>
        </div>
        <div className="field is-wide">
          <label htmlFor="r-memo">메모</label>
          <input
            className="control"
            id="r-memo"
            value={rider.memo}
            onChange={(event) => updateRider(rider.id, { memo: event.target.value })}
          />
        </div>
      </div>

      <p className="sub" style={{ marginTop: 12 }}>
        교육 상태는 숙련도와 다른 축입니다. 교육은 이수 여부이고 숙련도는 실력입니다.
      </p>
    </>
  );
}

/**
 * 용도·직무 필드. select 가 아니라 읽기 전용 값 + 이동 버튼이다.
 * 막는 것이 있으면 버튼을 비활성하고 무엇을 먼저 해결해야 하는지 나열한다.
 */
function MoveField({
  label,
  current,
  actionLabel,
  blockers,
  onMove,
}: {
  label: string;
  current: string;
  actionLabel: string;
  blockers: readonly MoveBlocker[];
  onMove: () => void;
}) {
  const blocked = blockers.length > 0;

  return (
    <div className="field is-wide">
      <label>{label}</label>
      <div className="readonly-value">
        {current}
        <button
          className={`btn is-small${blocked ? '' : ' is-primary'}`}
          type="button"
          disabled={blocked}
          title={blocked ? '먼저 해결해야 하는 것이 있습니다' : undefined}
          onClick={onMove}
        >
          {actionLabel}
        </button>
      </div>
      {blocked && (
        <ul style={{ display: 'grid', gap: 6, marginTop: 6 }}>
          {blockers.map((blocker, index) => (
            <li
              key={`${blocker.kind}-${index}`}
              className="inline-warn"
              style={{ marginTop: 0, alignItems: 'flex-start' }}
            >
              <span aria-hidden="true">⚠</span>
              {blocker.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotBuiltYet({ target }: { target: TargetId }) {
  const entry = TARGETS.find((candidate) => candidate.id === target);
  const plans: Partial<Record<TargetId, string>> = {
    insurance: '라이더 보험 연결과 보험 항목 카탈로그. 항목은 하위 영역으로 둔다.',
    stations: '이름·주소·좌표·운영 상태·배터리 재고. 재고 변경 이력은 상세 패널에.',
    equipment: '장비 종류 카탈로그. 적용 용도 필드로 함체가 배송용에만 노출된다.',
    devices: '단말 UID·제조사·모델·상태. 차량 설치는 차량 상세에서 한다.',
    zones: '권역명·색상·표시 순서. 경계 폴리곤은 후속.',
  };

  return (
    <section className="page-panel">
      <div className="panel-head">
        <div>
          <div className="panel-title">{entry?.label}</div>
          <p className="panel-sub">{entry?.shared ? '배송용·클린차량 공유 데이터' : '배송용 전용'}</p>
        </div>
        <span className="chip is-gray">아직</span>
      </div>
      <div className="empty-state">
        <b>이 대상은 아직 만들지 않았습니다</b>
        {plans[target] ?? '설계는 03-screen-feature-map.md §5 에 있습니다.'}
      </div>
    </section>
  );
}
