"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AddressSearchButton } from "@/components/management/AddressSearchButton";
import { updateStationFromOverviewAction } from "@/app/actions";
import type { BatteryStation } from "@/types/domain";

/**
 * 스테이션 상세 + 편집 다이얼로그. 주소는 다음 우편번호 팝업으로만 수정 가능
 * (직접 타이핑 차단) — 등록 다이얼로그와 동일한 정책. 잔여/총 도 잔여 ≤ 총
 * HTML5 제약을 같이 강제. server action 이 주소 변경 + count 변경을 각각의
 * 백엔드 endpoint 로 분리 호출한다.
 */
export interface StationDetailRow {
  station: BatteryStation;
  available: number;
  max: number;
}

export function StationDetailDialog({
  row,
  onClose
}: {
  row: StationDetailRow | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  // 입력 컨트롤드 state 는 mount 시점의 row 값을 기준으로 한 번만 초기화.
  // 부모가 다른 행을 선택하면 key 변경으로 컴포넌트 자체가 새로 마운트되어
  // 이 초기값이 다시 잡힌다 (react-hooks/set-state-in-effect 회피).
  const [address, setAddress] = useState(row?.station.address ?? "");
  const [maxValue, setMaxValue] = useState(row ? String(row.max) : "");
  const [availableValue, setAvailableValue] = useState(row ? String(row.available) : "");

  useEffect(() => {
    if (row) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [row]);

  const handleClose = useCallback(() => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  if (!row) return null;

  const stationId = row.station.id ?? row.station.slug;
  const boundUpdate = updateStationFromOverviewAction.bind(null, stationId);

  return (
    <dialog
      ref={dialogRef}
      className="overview-create-dialog"
      onClose={onClose}
      onCancel={onClose}
    >
      <h3>스테이션 상세</h3>
      {mode === "view" ? (
        <div className="detail-row-grid">
          <DetailField label="주소" value={row.station.address ?? "—"} />
          <DetailField label="잔여/총" value={`${row.available} / ${row.max}`} />
          <div className="overview-create-dialog-actions">
            <button type="button" className="button-neutral" onClick={handleClose}>
              닫기
            </button>
            <button type="button" className="button-primary" onClick={() => setMode("edit")}>
              수정
            </button>
          </div>
        </div>
      ) : (
        <form action={boundUpdate}>
          {/* server action 이 count 변경 여부를 비교할 때 쓰는 현재 값. */}
          <input type="hidden" name="currentMaxBatteryCapacity" value={row.max} />
          <input type="hidden" name="currentAvailableBatteryCount" value={row.available} />
          <label>
            주소
            <div className="station-address-field">
              <input
                name="address"
                maxLength={200}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="주소 검색 버튼을 눌러 주소를 선택하세요"
                readOnly
                required
              />
              <AddressSearchButton onSelect={setAddress} />
            </div>
          </label>
          <label className="station-battery-count-field">
            잔여/총
            <div className="station-battery-count-inputs">
              <input
                name="availableBatteryCount"
                type="number"
                min={0}
                max={maxValue || undefined}
                value={availableValue}
                onChange={(event) => setAvailableValue(event.target.value)}
                placeholder="0"
                aria-label="잔여 수량"
                title="잔여 수량은 총 수량을 넘을 수 없습니다."
                required
              />
              <span className="station-battery-count-separator" aria-hidden="true">/</span>
              <input
                name="maxBatteryCapacity"
                type="number"
                min={0}
                value={maxValue}
                onChange={(event) => setMaxValue(event.target.value)}
                placeholder="0"
                aria-label="총 수량"
                required
              />
            </div>
          </label>
          <div className="overview-create-dialog-actions">
            <button type="button" className="button-neutral" onClick={() => setMode("view")}>
              취소
            </button>
            <button type="submit" className="button-primary">
              저장
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-field">
      <span className="detail-field-label">{label}</span>
      <span className="detail-field-value">{value}</span>
    </div>
  );
}
