"use client";

import {
  useCallback,
  useMemo,
  useState,
  type DragEvent,
  type ChangeEvent
} from "react";

import { createContractFromOverviewAction } from "@/app/overview/actions";

/**
 * 차량-라이더 신규 매칭 등록을 위한 인라인 폼. 이전엔 모달 다이얼로그였지만
 * 사용자 요청 — 양식과 시작일만 직접 입력하고, 라이더 / 차량은 검색 입력으로
 * 추리거나 위의 라이더 패널 / 차량 패널 행을 그대로 드래그해서 슬롯에 떨어뜨려
 * 채울 수 있다.
 *
 * 슬롯은 빈 상태에선 검색 인풋 + 드롭 가능 영역으로 보이고, 한 번 선택되면
 * "이름 (전화) ×" 칩 형태로 잠긴다. ×를 누르면 다시 빈 슬롯으로 돌아간다.
 */
export interface ContractMatchingOption {
  id: string;
  label: string;
}

/** 드래그 시 dataTransfer 에 실어 보내는 타입 식별자. */
export const RIDER_DRAG_TYPE = "application/x-thundercrew-rider-id";
export const VEHICLE_DRAG_TYPE = "application/x-thundercrew-vehicle-id";

export interface ContractMatchingFormProps {
  riderOptions: ReadonlyArray<ContractMatchingOption>;
  vehicleOptions: ReadonlyArray<ContractMatchingOption>;
  templateOptions: ReadonlyArray<ContractMatchingOption>;
  /**
   * `/overview?status=...` 쿼리 파라미터. server action 이 실패 후 silent
   * redirect 로 붙여 넣은 값. `contract-create-error` 일 때 폼 상단에
   * 안내문을 띄운다 — 대부분 차량 또는 라이더가 이미 다른 매칭에 묶여있는
   * 경우(`PeriodOverlapException`) 이므로 그 가설을 메시지에 담는다.
   */
  statusParam?: string | null;
}

/** server action 의 silent redirect 결과를 사용자 안내문으로 변환. */
function noticeFor(statusParam: string | null | undefined): string | null {
  if (statusParam === "contract-create-error") {
    return "매칭을 등록하지 못했습니다. 같은 기간에 이미 매칭된 차량 또는 라이더가 있는지 확인해 주세요.";
  }
  if (statusParam === "contract-terminate-error") {
    return "계약을 종료하지 못했습니다. 이미 종료되었거나 계약 기간이 만료된 매칭일 수 있어요.";
  }
  return null;
}

export function ContractMatchingForm({
  riderOptions,
  vehicleOptions,
  templateOptions,
  statusParam
}: ContractMatchingFormProps) {
  const notice = noticeFor(statusParam);
  const today = new Date().toISOString().slice(0, 10);
  const [riderId, setRiderId] = useState("");
  const [vehicleId, setVehicleId] = useState("");

  const riderById = useMemo(() => {
    const map = new Map<string, ContractMatchingOption>();
    for (const option of riderOptions) map.set(option.id, option);
    return map;
  }, [riderOptions]);

  const vehicleById = useMemo(() => {
    const map = new Map<string, ContractMatchingOption>();
    for (const option of vehicleOptions) map.set(option.id, option);
    return map;
  }, [vehicleOptions]);

  const selectedRider = riderId ? riderById.get(riderId) ?? null : null;
  const selectedVehicle = vehicleId ? vehicleById.get(vehicleId) ?? null : null;

  // 폼이 비어있거나 양식·날짜 미선택 상태에서는 등록 버튼 비활성.
  // 백엔드 호출 전 클라이언트 단에서 잘못된 신청을 미리 거른다.
  const canSubmit = Boolean(selectedRider && selectedVehicle);

  return (
    <form action={createContractFromOverviewAction} className="contract-matching-form">
      <h3 className="contract-matching-form-heading">신규 매칭</h3>
      {notice ? (
        <p className="contract-matching-form-notice" role="alert">
          {notice}
        </p>
      ) : null}
      <div className="contract-matching-form-grid">
        {/* 차량/라이더 컬럼 순서는 /overview 상단 탭 순서(차량 → 라이더 → BSS)와
            맞춰 차량을 먼저 두고 라이더가 뒤. 운영자 시선 흐름이 일관되게 흐른다. */}
        <ContractMatchingSlot
          label="차량"
          dragType={VEHICLE_DRAG_TYPE}
          options={vehicleOptions}
          selected={selectedVehicle}
          onPick={setVehicleId}
          onClear={() => setVehicleId("")}
        />
        <ContractMatchingSlot
          label="라이더"
          dragType={RIDER_DRAG_TYPE}
          options={riderOptions}
          selected={selectedRider}
          onPick={setRiderId}
          onClear={() => setRiderId("")}
        />
        <label>
          계약 양식
          <select name="contractTemplateId" defaultValue="" required>
            <option value="" disabled>
              양식을 선택하세요
            </option>
            {templateOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          시작일
          <input name="startAt" type="date" defaultValue={today} required />
        </label>
      </div>
      {/* server action 으로 보낼 실제 id 값. 슬롯 state 에서 동기화. */}
      <input type="hidden" name="riderId" value={riderId} />
      <input type="hidden" name="bikeId" value={vehicleId} />
      <div className="contract-matching-form-actions">
        <button type="submit" className="button-primary" disabled={!canSubmit}>
          등록
        </button>
      </div>
    </form>
  );
}

function ContractMatchingSlot({
  label,
  dragType,
  options,
  selected,
  onPick,
  onClear
}: {
  label: string;
  dragType: string;
  options: ReadonlyArray<ContractMatchingOption>;
  selected: ContractMatchingOption | null;
  onPick: (id: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [isDropTarget, setIsDropTarget] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options.filter((option) => option.label.toLowerCase().includes(q)).slice(0, 8);
  }, [options, query]);

  const handleQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, []);

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      // dataTransfer.types 에 우리가 보낸 타입이 있을 때만 drop 허용. 다른
      // 곳에서 드래그된 텍스트/파일은 무시한다.
      if (event.dataTransfer.types.includes(dragType)) {
        event.preventDefault();
        setIsDropTarget(true);
      }
    },
    [dragType]
  );

  const handleDragLeave = useCallback(() => {
    setIsDropTarget(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const id = event.dataTransfer.getData(dragType);
      if (!id) return;
      event.preventDefault();
      setIsDropTarget(false);
      // 드래그된 id 가 옵션 목록에 있는지 확인 후 적용. 없으면 무시 (다른
      // 탭의 옛 row 일 수 있어 방어적으로 체크).
      if (options.some((option) => option.id === id)) {
        onPick(id);
        setQuery("");
      }
    },
    [dragType, options, onPick]
  );

  if (selected) {
    return (
      <div className="contract-matching-slot is-filled">
        <span className="contract-matching-slot-label">{label}</span>
        <div className="contract-matching-chip">
          <span>{selected.label}</span>
          <button type="button" className="contract-matching-chip-clear" aria-label={`${label} 선택 해제`} onClick={onClear}>
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`contract-matching-slot${isDropTarget ? " is-drop-target" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span className="contract-matching-slot-label">{label}</span>
      <input
        type="text"
        value={query}
        onChange={handleQueryChange}
        placeholder={`${label} 검색 또는 드래그`}
        className="contract-matching-slot-input"
      />
      {query.trim() && filtered.length === 0 ? (
        <p className="contract-matching-slot-empty">검색 결과 없음</p>
      ) : null}
      {query.trim() && filtered.length > 0 ? (
        <ul className="contract-matching-slot-results" role="listbox">
          {filtered.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(option.id);
                  setQuery("");
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
