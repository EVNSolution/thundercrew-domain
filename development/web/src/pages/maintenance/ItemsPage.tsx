import { useMemo, useState } from 'react';
import { useFleetStore } from '../../mock/useFleetStore';
import {
  ALL_CATEGORIES,
  CATEGORY_LABEL,
  categoryOf,
  clearMaintenanceMessage,
  NEW_CATEGORIES,
  toggleItemCategory,
  updateItem,
  vehicleCountForItem,
  type MaintenanceItem,
} from '../../mock/maintenance-store';
import { useMaintenanceStore } from '../../mock/useMaintenanceStore';

/**
 * 품목 — 정비 품목과 주기 카탈로그.
 *
 * 이 카탈로그의 **편집 주인이 여기로 확정**된다. 앞 설계에서는 배송용·클린차량
 * 양쪽 관리 화면에 걸린 공유 데이터여서 누가 고치는지 불분명했다 (§11).
 */
export function MaintenanceItemsPage() {
  const fleet = useFleetStore();
  const { items, lastMessage } = useMaintenanceStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      items.map((item) => ({
        item,
        vehicleCount: vehicleCountForItem(item, fleet.vehicles),
      })),
    [items, fleet.vehicles],
  );

  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  return (
    <main className="page-content">
      <div className="page-hero">
        <div className="hero-titles">
          <h1>품목</h1>
          <p>정비 품목과 주기를 관리합니다.</p>
        </div>
        <div className="hero-tools">
          <span className="scope-tag is-neutral">전역 카탈로그</span>
          <button className="btn is-primary" type="button">
            품목 추가
          </button>
        </div>
      </div>

      {lastMessage && (
        <p
          className={lastMessage.kind === 'rejected' ? 'error-state' : 'inline-warn'}
          role="status"
          style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}
        >
          <span aria-hidden="true">{lastMessage.kind === 'rejected' ? '✕' : '✓'}</span>
          {lastMessage.text}
          <button
            className="btn is-small"
            type="button"
            onClick={clearMaintenanceMessage}
            style={{ marginLeft: 'auto' }}
          >
            닫기
          </button>
        </p>
      )}

      <div className="master-detail-grid">
        <section className="page-panel">
          <div className="panel-head">
            <div>
              <div className="panel-title">품목</div>
              <p className="panel-sub">사용 중 {items.filter((item) => item.enabled).length}개</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="page-table" style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th scope="col">품목</th>
                  <th scope="col">적용 분류</th>
                  <th scope="col">주기</th>
                  <th scope="col">적용 차량</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ item, vehicleCount }) => (
                  <tr
                    key={item.id}
                    className="is-selectable"
                    aria-selected={item.id === selected?.id}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <td style={{ fontWeight: 750 }}>{item.name}</td>
                    <td className="sub">
                      {item.categories.length === ALL_CATEGORIES.length
                        ? '6분류 전체'
                        : `${item.categories.length}분류`}
                    </td>
                    <td className="num">
                      {item.cycleKm !== null
                        ? `${item.cycleKm.toLocaleString('ko-KR')} km`
                        : `${item.cycleMonths}개월`}
                    </td>
                    <td className="num">{vehicleCount}대</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="page-panel">
          {selected ? <ItemEditor item={selected} /> : (
            <div className="empty-state">
              <b>품목이 없습니다</b>
              품목을 추가하면 차량 체크리스트에 나타납니다.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ItemEditor({ item }: { item: MaintenanceItem }) {
  const fleet = useFleetStore();
  const vehicleCount = vehicleCountForItem(item, fleet.vehicles);

  /** 분류별 차량 수. 분류를 켤 때 영향 범위를 미리 보여준다. */
  const countByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const vehicle of fleet.vehicles) {
      const key = categoryOf(vehicle.wheelType, vehicle.engineType);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [fleet.vehicles]);

  const hasNewCategory = item.categories.some((category) =>
    NEW_CATEGORIES.includes(category),
  );
  const iceOnlyWithoutLpg =
    item.categories.some((category) => category.endsWith('_ICE')) && !hasNewCategory;

  return (
    <>
      <div className="panel-head">
        <div>
          <div className="panel-title">{item.name}</div>
          <p className="panel-sub">적용 차량 {vehicleCount}대</p>
        </div>
        <span className={`chip ${item.enabled ? 'is-green' : 'is-gray'}`}>
          {item.enabled ? '사용' : '미사용'}
        </span>
      </div>

      <div className="form-grid">
        <div className="field is-wide">
          <label htmlFor="mi-name">품목명</label>
          <input
            className="control"
            id="mi-name"
            value={item.name}
            onChange={(event) => updateItem(item.id, { name: event.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="mi-km">주기 (km)</label>
          <input
            className="control num"
            id="mi-km"
            type="number"
            placeholder="미사용"
            value={item.cycleKm ?? ''}
            onChange={(event) =>
              updateItem(item.id, {
                cycleKm: event.target.value ? Number.parseInt(event.target.value, 10) : null,
              })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="mi-months">주기 (개월)</label>
          <input
            className="control num"
            id="mi-months"
            type="number"
            placeholder="미사용"
            value={item.cycleMonths ?? ''}
            onChange={(event) =>
              updateItem(item.id, {
                cycleMonths: event.target.value ? Number.parseInt(event.target.value, 10) : null,
              })
            }
          />
        </div>
        <div className="field">
          <label htmlFor="mi-threshold">알림 임계 (%)</label>
          <input
            className="control num"
            id="mi-threshold"
            type="number"
            value={item.alertThresholdPercent}
            onChange={(event) =>
              updateItem(item.id, {
                alertThresholdPercent: Number.parseInt(event.target.value, 10) || 85,
              })
            }
          />
        </div>
      </div>

      {item.cycleKm !== null && item.cycleMonths !== null && (
        <p className="inline-warn">
          <span aria-hidden="true">⚠</span>
          km 과 개월이 모두 설정돼 있습니다. **먼저 닿는 쪽**을 기준으로 판정합니다.
        </p>
      )}

      <div className="panel-head" style={{ margin: 'var(--space-5) 0 8px' }}>
        <span className="panel-title">적용 분류</span>
        <span className="sub">휠 × 엔진 6분류 · 다중 선택</span>
      </div>
      <div className="check-list">
        {ALL_CATEGORIES.map((category) => {
          const on = item.categories.includes(category);
          const isNew = NEW_CATEGORIES.includes(category);
          return (
            <div
              className={`check-row${on ? ' checked' : ''}`}
              key={category}
              role="checkbox"
              aria-checked={on}
              tabIndex={0}
              onClick={() => toggleItemCategory(item.id, category)}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault();
                  toggleItemCategory(item.id, category);
                }
              }}
            >
              <span className="check-box" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <div>
                <div className="check-name">{CATEGORY_LABEL[category]}</div>
                <div className="check-meta">
                  {countByCategory.get(category) ?? 0}대
                  {isNew && ' · 260804 신규'}
                </div>
              </div>
              <span className="chip is-gray is-mini num">{countByCategory.get(category) ?? 0}</span>
            </div>
          );
        })}
      </div>

      {iceOnlyWithoutLpg && (
        <p className="inline-warn">
          <span aria-hidden="true">⚠</span>
          내연 분류에는 적용되는데 LPG 분류에는 빠져 있습니다. 260804 미팅으로 LPG 2분류가
          신규 추가됐으니 이 품목이 LPG 차량에도 필요한지 검수하세요.
        </p>
      )}

      {item.requiresEquipment && (
        <p className="sub" style={{ marginTop: 12 }}>
          이 품목은 <b>{item.requiresEquipment}</b>가 붙어 있는 차량에만 체크리스트에 나타납니다.
          분류가 맞아도 장비가 없으면 뜨지 않습니다.
        </p>
      )}

      <div className="form-actions">
        <button
          className="btn is-danger"
          type="button"
          onClick={() => updateItem(item.id, { enabled: !item.enabled })}
        >
          {item.enabled ? '비활성' : '다시 사용'}
        </button>
      </div>
    </>
  );
}
