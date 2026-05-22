"use client";

import { useCallback, useRef, useState } from "react";

import { createMaintenanceItemAction } from "@/app/actions";
import type { ServiceOpsMaintenanceItem } from "@/lib/services/service-ops-api";

/**
 * 정비 카탈로그 신규 품목 추가 다이얼로그. "정비" 탭 우측 상단 버튼이 열고,
 * appliesTo 기본값은 ELECTRIC. 운영자가 새 ICE / BOTH 품목을 만들 땐 select
 * 에서 직접 골라야 한다.
 *
 * cycle 세 필드(km / months / label) 중 최소 한 값이 필요 — backend check
 * 제약과 일치. 폼은 그 검증을 client-side 에서 하지 않고 server action 에서
 * 처리(silent redirect with status param). 운영자가 비워 보내면 안내 메시지.
 */
export function CreateMaintenanceItemDialog({
  parentOptions
}: {
  parentOptions: ReadonlyArray<ServiceOpsMaintenanceItem>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [resetKey, setResetKey] = useState(0);

  const handleReset = useCallback(() => {
    formRef.current?.reset();
    setResetKey((k) => k + 1);
  }, []);

  // 그룹 부모로 쓸 수 있는 후보 — 부모 자체가 다시 부모인 케이스(2단 계층)
  // 는 backend 제약은 없지만 UI 상 1-depth 그룹만 노출해 단순화.
  const eligibleParents = parentOptions.filter((option) => option.parentItemId === null);

  return (
    <>
      <button
        className="button-primary"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        정비 품목 추가
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
        <form ref={formRef} action={createMaintenanceItemAction} key={`create-form-${resetKey}`}>
          <h3>정비 품목 추가</h3>
          <label>
            품목
            <input name="name" required maxLength={100} placeholder="예: 엔진오일" />
          </label>
          <label>
            적용
            <select name="appliesTo" defaultValue="ELECTRIC">
              <option value="ELECTRIC">전기</option>
              <option value="ICE">내연</option>
              <option value="BOTH">공통</option>
            </select>
          </label>
          <label>
            교환주기 (km)
            <input name="cycleKm" type="number" min={0} placeholder="비우면 km 기준 없음" />
          </label>
          <label>
            교환주기 (개월)
            <input name="cycleMonths" type="number" min={0} placeholder="비우면 개월 기준 없음" />
          </label>
          <label>
            라벨 (자유 텍스트)
            <input name="cycleLabel" maxLength={50} placeholder="예: 6~7개월 / 12개월 이상" />
          </label>
          <label>
            그룹 부모
            <select name="parentItemId" defaultValue="">
              <option value="">없음</option>
              {eligibleParents.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            정렬
            <input name="displayOrder" type="number" min={0} defaultValue={0} />
          </label>
          <div className="overview-create-dialog-actions">
            <button type="button" className="button-neutral" onClick={() => dialogRef.current?.close()}>
              취소
            </button>
            <button className="button-primary" type="submit">
              추가
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
