"use client";

import { useEffect, useState, useTransition } from "react";

import type { ServiceOpsDispatchOrder } from "@/lib/services/service-ops-api";
import {
  createSystemCallAction,
  createOfferedCallAction,
  acceptCallAction,
  listOfferedCallsAction
} from "@/app/dispatch/actions";
import { AddressSearchButton } from "@/components/management/AddressSearchButton";

type DeliveryVehicleOption = { id: string; plateNumber: string };

export function BaeminCallPanel({
  initialOffered,
  deliveryVehicles
}: {
  initialOffered: ServiceOpsDispatchOrder[];
  deliveryVehicles: DeliveryVehicleOption[];
}) {
  // ── call form state ──────────────────────────────────────────────────────
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [address, setAddress] = useState("");
  const [mode, setMode] = useState<"system" | "offer">("system");
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  // ── offered list state ───────────────────────────────────────────────────
  const [offered, setOffered] = useState<ServiceOpsDispatchOrder[]>(initialOffered);
  // per-card selected bikeId; keyed by order id
  const [selectedBike, setSelectedBike] = useState<Record<string, string>>({});
  // per-card accept error; keyed by order id
  const [acceptErrors, setAcceptErrors] = useState<Record<string, string>>({});
  // 선택 차량의 텔레메트리 연결 상태 — OFFLINE 이면 완료 자동 추정 불가 경고.
  const [offlineWarn, setOfflineWarn] = useState<Record<string, boolean>>({});
  const [isAccepting, startAccept] = useTransition();

  // 카드에서 고른 차량의 연결 상태를 조회해 "자동 추정 불가" 경고를 띄운다.
  // 완료 자동 추정은 텔레메트리가 있어야 동작한다 (3단계).
  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(selectedBike).filter(([, bikeId]) => bikeId);
    for (const [orderId, bikeId] of entries) {
      fetch(`/api/overview/vehicle-maintenance/${encodeURIComponent(bikeId)}`, {
        cache: "no-store",
        credentials: "same-origin"
      })
        .then(async (r) => (r.ok ? await r.json() : null))
        .then((bundle) => {
          if (cancelled) return;
          const online = bundle?.currentState?.connectionStatus === "ONLINE";
          setOfflineWarn((prev) => ({ ...prev, [orderId]: !online }));
        })
        .catch(() => {
          if (!cancelled) setOfflineWarn((prev) => ({ ...prev, [orderId]: true }));
        });
    }
    return () => { cancelled = true; };
  }, [selectedBike]);

  const reloadOffered = async () => {
    const next = await listOfferedCallsAction();
    setOffered(next);
  };

  const clearForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setAddress("");
    setMode("system");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);
    startSubmit(async () => {
      const fd = new FormData();
      fd.append("customerName", customerName);
      fd.append("customerPhone", customerPhone);
      fd.append("address", address);
      const result =
        mode === "system"
          ? await createSystemCallAction(fd)
          : await createOfferedCallAction(fd);
      if (result.ok) {
        clearForm();
        setFormNotice("콜이 등록되었습니다.");
        await reloadOffered();
      } else {
        setFormError(result.error);
      }
    });
  };

  const handleAccept = (order: ServiceOpsDispatchOrder) => {
    const bikeId = selectedBike[order.id] ?? (deliveryVehicles[0]?.id ?? "");
    if (!bikeId) return;
    setAcceptErrors((prev) => ({ ...prev, [order.id]: "" }));
    startAccept(async () => {
      const result = await acceptCallAction(order.id, bikeId);
      if (result.ok) {
        await reloadOffered();
      } else {
        setAcceptErrors((prev) => ({ ...prev, [order.id]: result.error }));
      }
    });
  };

  const noVehicles = deliveryVehicles.length === 0;

  return (
    <div className="management-panel">
      {/* ── header ─────────────────────────────────────────────────────── */}
      <div className="mgmt-panel-header">
        <div className="mgmt-panel-header-left">
          <span className="mgmt-panel-title">콜 배차</span>
          {offered.length > 0 && (
            <span className="mgmt-panel-count">{offered.length}</span>
          )}
        </div>
      </div>

      {/* ── call registration form ──────────────────────────────────────── */}
      <form className="baemin-call-form" onSubmit={handleSubmit}>
        <div className="baemin-call-form-row">
          <label className="baemin-call-form-label" htmlFor="bc-customerName">
            고객명
          </label>
          <input
            id="bc-customerName"
            className="baemin-call-form-input"
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="홍길동"
            required
          />
        </div>

        <div className="baemin-call-form-row">
          <label className="baemin-call-form-label" htmlFor="bc-customerPhone">
            연락처
          </label>
          <input
            id="bc-customerPhone"
            className="baemin-call-form-input"
            type="text"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="010-0000-0000"
            required
          />
        </div>

        <div className="baemin-call-form-row">
          <label className="baemin-call-form-label" htmlFor="bc-address">
            배달지
          </label>
          <div className="baemin-call-address-row">
            <input
              id="bc-address"
              className="baemin-call-form-input"
              type="text"
              value={address}
              readOnly
              placeholder="주소 검색 버튼을 눌러주세요"
              required
            />
            <AddressSearchButton onSelect={(addr) => setAddress(addr)} />
          </div>
        </div>

        <div className="baemin-call-mode-row">
          <span className="baemin-call-form-label">배차 방식</span>
          <label className="baemin-call-mode-option">
            <input
              type="radio"
              name="bc-mode"
              value="system"
              checked={mode === "system"}
              onChange={() => setMode("system")}
            />
            시스템 자동 배차
          </label>
          <label className="baemin-call-mode-option">
            <input
              type="radio"
              name="bc-mode"
              value="offer"
              checked={mode === "offer"}
              onChange={() => setMode("offer")}
            />
            라이더 수락
          </label>
        </div>

        {formError ? (
          <p role="alert" className="baemin-call-error">
            {formError}
          </p>
        ) : null}
        {formNotice ? (
          <p role="status" className="baemin-call-notice">
            {formNotice}
          </p>
        ) : null}

        <div className="baemin-call-form-actions">
          <button
            type="submit"
            className="button-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "등록 중..." : "콜 등록"}
          </button>
        </div>
      </form>

      {/* ── OFFERED list ───────────────────────────────────────────────── */}
      {offered.length > 0 ? (
        <div className="baemin-call-offered-list">
          <p className="baemin-call-offered-heading">수락 대기 중인 콜</p>
          {offered.map((order) => {
            const cardBikeId =
              selectedBike[order.id] ?? (deliveryVehicles[0]?.id ?? "");
            const cardError = acceptErrors[order.id];
            return (
              <div key={order.id} className="baemin-call-card">
                <div className="baemin-call-card-info">
                  <span className="baemin-call-card-name">{order.customerName}</span>
                  <span className="baemin-call-card-sep">·</span>
                  <span className="baemin-call-card-phone">{order.customerPhone}</span>
                  <span className="baemin-call-card-sep">·</span>
                  <span className="baemin-call-card-address">{order.address}</span>
                </div>
                <div className="baemin-call-accept-row">
                  <select
                    className="baemin-call-vehicle-select"
                    value={cardBikeId}
                    onChange={(e) =>
                      setSelectedBike((prev) => ({
                        ...prev,
                        [order.id]: e.target.value
                      }))
                    }
                    disabled={noVehicles || isAccepting}
                  >
                    {noVehicles ? (
                      <option value="">배송 차량 없음</option>
                    ) : (
                      deliveryVehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.plateNumber}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => handleAccept(order)}
                    disabled={noVehicles || isAccepting}
                    title={
                      noVehicles
                        ? "배송 서비스 유형 차량이 없습니다."
                        : undefined
                    }
                  >
                    수락
                  </button>
                </div>
                {offlineWarn[order.id] ? (
                  <p className="baemin-call-warn" role="status">
                    이 차량은 텔레메트리 미연결 상태입니다 — 완료 자동 추정이 불가하며, 모니터에서 수동 완료해야 합니다.
                  </p>
                ) : null}
                {noVehicles ? (
                  <span className="baemin-call-hint">
                    배송 차량이 없어 수락할 수 없습니다.
                  </span>
                ) : null}
                {cardError ? (
                  <p role="alert" className="baemin-call-error">
                    {cardError}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
