"use client";

import { useEffect, useRef, useState } from "react";
import { updateDispatchOrderAction } from "@/app/dispatch/actions";
import type { ServiceOpsDispatchOrder } from "@/lib/services/service-ops-api";

type ReassignVehicle = { id: string; plateNumber: string };

export function DispatchOrderEditDialog({
  order,
  vehicles,
  onClose,
  onSaved
}: {
  order: ServiceOpsDispatchOrder;
  vehicles: ReassignVehicle[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [customerName, setCustomerName] = useState(order.customerName);
  const [customerPhone, setCustomerPhone] = useState(order.customerPhone);
  const [address, setAddress] = useState(order.address);
  const [bikeId, setBikeId] = useState(order.bikeId ?? "");
  // 시간 배차(클리닝) 주문의 예정 시각 — datetime-local 은 타임존이 없으므로
  // KST 로 변환해 표시하고, 제출 시 KST 해석으로 되돌린다.
  const [scheduledAtLocal, setScheduledAtLocal] = useState<string>(() =>
    order.scheduledAt ? toKstLocalInput(order.scheduledAt) : ""
  );
  const isTimeDispatch = Boolean(order.scheduledAt);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await updateDispatchOrderAction(order.id, {
      bikeId,
      customerName,
      customerPhone,
      address,
      sequence: null,
      scheduledAt:
        isTimeDispatch && scheduledAtLocal ? fromKstLocalInput(scheduledAtLocal) : null
    });
    setSubmitting(false);
    if (result.ok) {
      dialogRef.current?.close();
      onSaved();
    } else {
      setError(result.error);
    }
  }

  function handleClose() {
    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog ref={dialogRef} className="overview-create-dialog" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h3>배차 주문 수정</h3>
        <label>
          고객명
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
          />
        </label>
        <label>
          연락처
          <input
            type="text"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            required
          />
        </label>
        <label>
          배송지주소
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
        </label>
        <label>
          배정 차량
          <select
            value={bikeId}
            onChange={(e) => setBikeId(e.target.value)}
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plateNumber}
              </option>
            ))}
          </select>
        </label>
        {isTimeDispatch ? (
          <label>
            예정 시각
            <input
              type="datetime-local"
              value={scheduledAtLocal}
              onChange={(e) => setScheduledAtLocal(e.target.value)}
              required
            />
          </label>
        ) : null}
        {error ? (
          <p className="baemin-call-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="overview-create-dialog-actions">
          <button
            type="button"
            className="button-neutral"
            onClick={handleClose}
            disabled={submitting}
          >
            취소
          </button>
          <button type="submit" className="button-primary" disabled={submitting}>
            {submitting ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/** ISO instant → datetime-local 입력값 (KST 표기, "yyyy-MM-ddTHH:mm"). */
function toKstLocalInput(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms + 9 * 3600_000).toISOString().slice(0, 16);
}

/** datetime-local 입력값(KST 해석) → ISO instant. */
function fromKstLocalInput(local: string): string {
  return new Date(local + ":00+09:00").toISOString();
}
