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
  const [sequence, setSequence] = useState<string>(String(order.sequence));
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
      sequence: sequence.trim() === "" ? null : Number(sequence)
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
        <label>
          순번
          <input
            type="number"
            min={1}
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
          />
        </label>
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
