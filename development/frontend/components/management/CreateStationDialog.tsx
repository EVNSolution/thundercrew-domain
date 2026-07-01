"use client";

import { useCallback, useRef, useState } from "react";

import { AddressSearchButton } from "@/components/management/AddressSearchButton";
import { createStationFromOverviewAction } from "@/app/actions";

/**
 * Floating create dialog for the root page stations tab. Operator only
 * fills in the four fields the day-to-day register flow needs - the
 * remaining backend-required fields (name / lat / lng / status /
 * currentBatteryCount) get sensible defaults from the server action
 * so the operator can fill / correct them later if needed.
 *
 * 잔여/총 인비라이언트는 백엔드(DB CHECK + 서비스) 가 거부하지만 운영자에게는
 * `?status=create-error` 묵음 처리로만 보였다. 여기서는 HTML5 max 속성으로
 * 브라우저가 submit 자체를 막아 1차 방어선을 친다 — 총 input 값을 state
 * 로 들고 잔여 input 에 동적으로 바인딩.
 *
 * 주소는 `AddressSearchButton` (다음 우편번호 팝업) 으로만 채울 수 있게
 * input 을 readOnly 로 잠가둔다 — 운영자가 자유 텍스트로 오타나 비표준
 * 주소를 흘려넣는 경로를 차단해 DB 의 주소 일관성(우편번호 표준 도로명)
 * 을 강제한다. 동/호수 같은 추가 정보가 필요해지면 별도 컬럼/필드를 따로
 * 둘 예정.
 */
export function CreateStationDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [address, setAddress] = useState("");
  const [maxBatteryCapacity, setMaxBatteryCapacity] = useState("");

  // 상단 우측 ↻ 버튼: 모든 입력 초기화. 컨트롤드 state 두 개를 직접 비우고,
  // uncontrolled 입력(잔여 수량 등) 은 form.reset() 으로 함께 정리한다.
  const handleReset = useCallback(() => {
    setAddress("");
    setMaxBatteryCapacity("");
    formRef.current?.reset();
  }, []);

  return (
    <>
      <button
        className="button-primary"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        스테이션 등록
      </button>
      <dialog ref={dialogRef} className="overview-create-dialog">
        <button
          type="button"
          className="overview-create-dialog-reset"
          onClick={handleReset}
          aria-label="입력 초기화"
          title="입력 초기화"
        >
          ↻
        </button>
        <form ref={formRef} action={createStationFromOverviewAction}>
          <h3>스테이션 등록</h3>
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
          {/* 패널의 "잔여/총" 표시 순서와 라벨을 통일. 한 묶음 안에 잔여와 총을
              슬래시로 묶어 시각적으로 같은 단위(배터리 슬롯 수)임을 드러낸다. */}
          <label className="station-battery-count-field">
            잔여/총
            <div className="station-battery-count-inputs">
              <input
                name="availableBatteryCount"
                type="number"
                min={0}
                // 총이 비어있을 때는 max 제약 해제 — 운영자가 잔여를 먼저 입력하는
                // 순서도 허용. 총 입력 직후엔 브라우저가 잔여 > 총 인 입력을
                // submit 시점에 거부하고 빨간 툴팁("값은 N 이하여야 합니다") 표시.
                max={maxBatteryCapacity || undefined}
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
                value={maxBatteryCapacity}
                onChange={(event) => setMaxBatteryCapacity(event.target.value)}
                placeholder="0"
                aria-label="총 수량"
                required
              />
            </div>
          </label>
          <div className="overview-create-dialog-actions">
            <button type="button" className="button-neutral" onClick={() => dialogRef.current?.close()}>
              취소
            </button>
            <button className="button-primary" type="submit">
              등록
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
