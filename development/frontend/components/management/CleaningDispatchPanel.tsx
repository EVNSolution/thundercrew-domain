"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  applySequentialDispatchAction,
  createCleaningDispatchAction,
  listCleaningScheduleAction,
  previewSequentialDispatchAction,
  type DispatchPreviewRow
} from "@/app/dispatch/actions";
import { AddressSearchInput } from "@/components/management/AddressSearchInput";
import { PhoneNumberInput } from "@/components/management/PhoneNumberInput";
import type {
  DispatchBulkApplyRow,
  DispatchBulkSummary,
  ServiceOpsDispatchOrder
} from "@/lib/services/service-ops-api";
import "./BulkPreviewModal.css";

/**
 * 클리닝 배차 — 시간 기반 순차 배차 (3단계, 구 "순차 배차" 섹션 대체).
 *
 * 구성:
 *   1) 시간 할당 폼 — 클린차량·고객·주소·서비스 예정 시각·소요시간. 같은
 *      차량의 시간 겹침은 백엔드가 400 으로 거부한다. 순번은 손으로 매기지
 *      않고 예정 시각순이 곧 배차 순서다.
 *   2) 일별 일정표 — 날짜를 고르면 클린차량별 행에 시간축(07~22시)으로 배차
 *      블록을 그린다. 예상 도착 = 예정 시각과 앞선 건들의 소요 누적 중 늦은
 *      쪽. 예정 종료를 넘긴 미완료 건은 지연으로 표시한다.
 *   3) 엑셀 업로드/내려받기 — 기존 순차 배차 플로우 유지.
 */

// 일정표 시간창 (KST 벽시계 기준).
const AXIS_START_HOUR = 7;
const AXIS_END_HOUR = 22;
const AXIS_HOURS = AXIS_END_HOUR - AXIS_START_HOUR;
const DEFAULT_SERVICE_MINUTES = 60;

type CleaningVehicleOption = { id: string; plateNumber: string };

interface DispatchPreviewState {
  rows: DispatchPreviewRow[];
  summary: DispatchBulkSummary;
}

/** KST 벽시계의 "그 날 자정 이후 경과 분". 축 배치와 표시가 함께 쓴다. */
function kstMinutesOfDay(iso: string): number {
  const utc = new Date(iso);
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

function kstClock(iso: string): string {
  const m = kstMinutesOfDay(iso);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** 운영 시간대는 KST 고정 — 브라우저 시간대와 무관하게 KST 달력 날짜. */
function todayLocalDate(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 지금 시각의 KST 분-of-day. */
function kstNowMinutes(): number {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.getUTCHours() * 60 + kst.getUTCMinutes();
}

type ScheduleBlock = {
  order: ServiceOpsDispatchOrder;
  startMin: number; // KST minutes-of-day (예정)
  minutes: number;
  /** 예정 시각과 앞선 건 종료 누적 중 늦은 쪽 — 분 단위. */
  expectedStartMin: number;
  expectedEndMin: number;
  delayed: boolean;
};

export function CleaningDispatchPanel({
  exportUrl,
  cleaningVehicles,
  cleanerNameByBikeId
}: {
  exportUrl: string;
  cleaningVehicles: CleaningVehicleOption[];
  /** bikeId → 활성 매칭 클리너 이름. 일정표 행·폼 셀렉트에 표시. */
  cleanerNameByBikeId: Record<string, string>;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<DispatchPreviewState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // ── 일정표 상태 ──────────────────────────────────────────────────
  const [date, setDate] = useState(() => todayLocalDate());
  const [schedule, setSchedule] = useState<ServiceOpsDispatchOrder[] | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  // 지연 표시는 시계가 흘러야 갱신된다 — 1분마다 재계산 트리거.
  const [clockTick, setClockTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setClockTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    listCleaningScheduleAction(date)
      .then((rows) => { if (!cancelled) setSchedule(rows); })
      .catch(() => { if (!cancelled) setSchedule([]); });
    return () => { cancelled = true; };
  }, [date, reloadTick]);

  // 차량별 블록 + 예상 도착(앞선 건 소요 누적) 계산.
  const blocksByBike = useMemo(() => {
    const map = new Map<string, ScheduleBlock[]>();
    if (!schedule) return map;
    // clockTick 이 의존성에 있어 1분마다 지연 판정이 갱신된다.
    void clockTick;
    const nowMin = date === todayLocalDate() ? kstNowMinutes() : null;
    const byBike = new Map<string, ServiceOpsDispatchOrder[]>();
    for (const order of schedule) {
      if (!order.bikeId || !order.scheduledAt) continue;
      const arr = byBike.get(order.bikeId) ?? [];
      arr.push(order);
      byBike.set(order.bikeId, arr);
    }
    for (const [bikeId, orders] of byBike) {
      orders.sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1));
      let prevExpectedEnd = 0;
      const blocks: ScheduleBlock[] = orders.map((order) => {
        const startMin = kstMinutesOfDay(order.scheduledAt!);
        const minutes = order.serviceMinutes ?? DEFAULT_SERVICE_MINUTES;
        const expectedStartMin = Math.max(startMin, prevExpectedEnd);
        const expectedEndMin = expectedStartMin + minutes;
        prevExpectedEnd = expectedEndMin;
        return {
          order,
          startMin,
          minutes,
          expectedStartMin,
          expectedEndMin,
          delayed:
            order.status === "ASSIGNED" && nowMin !== null && nowMin > startMin + minutes
        };
      });
      map.set(bikeId, blocks);
    }
    return map;
  }, [schedule, date, clockTick]);

  const refreshSchedule = useCallback(() => {
    setReloadTick((t) => t + 1);
  }, []);

  // ── 시간 할당 폼 상태 ────────────────────────────────────────────
  const [formBikeId, setFormBikeId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  // PhoneNumberInput 은 내부 상태형이라 defaultValue 만으로는 리셋되지 않는다 —
  // 등록 성공 시 key 를 바꿔 리마운트로 비운다.
  const [phoneResetKey, setPhoneResetKey] = useState(0);
  const [address, setAddress] = useState("");
  const [addressCoords, setAddressCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [serviceMinutes, setServiceMinutes] = useState(String(DEFAULT_SERVICE_MINUTES));
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBikeId || !scheduledTime) return;
    setFormError(null);
    setNotice(null);
    startSubmit(async () => {
      const res = await createCleaningDispatchAction({
        bikeId: formBikeId,
        customerName,
        customerPhone,
        address,
        scheduledAtLocal: `${date}T${scheduledTime}`,
        serviceMinutes: Number.parseInt(serviceMinutes, 10) || DEFAULT_SERVICE_MINUTES,
        latitude: addressCoords?.latitude ?? null,
        longitude: addressCoords?.longitude ?? null
      });
      if (res.ok) {
        setCustomerName("");
        setCustomerPhone("");
        setPhoneResetKey((k) => k + 1);
        setAddress("");
        setAddressCoords(null);
        setNotice("클리닝 배차를 등록했습니다.");
        refreshSchedule();
        router.refresh();
      } else {
        setFormError(res.message ?? "등록 실패");
      }
    });
  };

  // ── 엑셀 업로드 (기존 순차 배차 플로우 유지) ────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await previewSequentialDispatchAction(fd);
      if (result.ok) {
        setPreview({ rows: result.rows, summary: result.summary });
      } else {
        setError(result.error);
      }
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    const applyRows: DispatchBulkApplyRow[] = preview.rows
      .filter(
        (r): r is DispatchPreviewRow & { bikeId: string; latitude: number; longitude: number } =>
          r.status === "NEW" &&
          r.bikeId != null &&
          r.latitude != null &&
          r.longitude != null
      )
      .map((r) => ({
        bikeId: r.bikeId,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        address: r.address,
        latitude: r.latitude,
        longitude: r.longitude,
        originAddress: r.originAddress ?? null,
        originLatitude: r.originLatitude ?? null,
        originLongitude: r.originLongitude ?? null,
        // 시간 배차 축 — 백엔드가 예정 시각 없는 행을 skip 하므로 반드시 전달.
        scheduledAt: r.scheduledAt ?? null,
        serviceMinutes: r.serviceMinutes ?? null
      }));

    setLoading(true);
    try {
      const result = await applySequentialDispatchAction(applyRows);
      if (result.ok) {
        setPreview(null);
        setNotice(`배차 ${result.applied}건 적용 완료`);
        refreshSchedule();
        router.refresh();
      } else {
        setError(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="management-panel">
      <div className="mgmt-panel-header">
        <div className="mgmt-panel-header-left">
          <span className="mgmt-panel-title">클리닝 배차</span>
        </div>
        <div className="mgmt-panel-header-actions">
          <input
            type="date"
            className="cleaning-date-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="일정 날짜"
          />
          <a href={exportUrl} target="_blank" rel="noreferrer">
            <button type="button" className="button-secondary">내려받기</button>
          </a>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="button-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            {loading ? "처리 중..." : "업로드"}
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" style={{ color: "red", marginBottom: 8 }}>{error}</p>
      ) : null}
      {notice ? (
        <p role="status" style={{ color: "#166534", marginBottom: 8 }}>{notice}</p>
      ) : null}

      {/* ── 시간 할당 폼 ── */}
      <form className="cleaning-form" onSubmit={handleCreate}>
        <select
          value={formBikeId}
          onChange={(e) => setFormBikeId(e.target.value)}
          required
          aria-label="클린차량"
        >
          <option value="">차량 선택</option>
          {cleaningVehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plateNumber}
              {cleanerNameByBikeId[v.id] ? ` · ${cleanerNameByBikeId[v.id]}` : " · 매칭 없음"}
            </option>
          ))}
        </select>
        <input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="고객명"
          required
          aria-label="고객명"
        />
        <PhoneNumberInput
          key={phoneResetKey}
          name="customerPhone"
          defaultValue=""
          required
          aria-label="연락처"
          onValueChange={setCustomerPhone}
        />
        <div className="cleaning-form-address">
          <AddressSearchInput
            value={address}
            onChange={(addr, coords) => {
              setAddress(addr);
              setAddressCoords(coords);
            }}
            placeholder="서비스 주소 검색"
            ariaLabel="서비스 주소"
            required
          />
        </div>
        <input
          type="time"
          value={scheduledTime}
          onChange={(e) => setScheduledTime(e.target.value)}
          required
          aria-label="서비스 예정 시각"
        />
        <input
          type="number"
          min={5}
          max={1440}
          value={serviceMinutes}
          onChange={(e) => setServiceMinutes(e.target.value)}
          aria-label="소요시간(분)"
          className="cleaning-form-minutes"
        />
        <button type="submit" className="button-primary" disabled={isSubmitting}>
          {isSubmitting ? "등록 중…" : "시간 할당"}
        </button>
      </form>
      {formError ? (
        <p role="alert" style={{ color: "red", marginBottom: 8 }}>{formError}</p>
      ) : null}

      {/* ── 일별 일정표 ── */}
      <div className="cleaning-schedule">
        <div className="cleaning-schedule-axis">
          <span className="cleaning-schedule-plate" />
          <div className="cleaning-schedule-hours">
            {Array.from({ length: AXIS_HOURS + 1 }, (_, i) => (
              <span key={i} className="cleaning-schedule-hour">
                {AXIS_START_HOUR + i}
              </span>
            ))}
          </div>
        </div>
        {schedule === null ? (
          <p className="muted">불러오는 중…</p>
        ) : cleaningVehicles.length === 0 ? (
          <p className="muted">클린차량이 없습니다.</p>
        ) : (
          cleaningVehicles.map((v) => {
            const blocks = blocksByBike.get(v.id) ?? [];
            return (
              <div key={v.id} className="cleaning-schedule-row">
                <span className="cleaning-schedule-plate">
                  {v.plateNumber}
                  <span className="muted"> {cleanerNameByBikeId[v.id] ?? ""}</span>
                </span>
                <div className="cleaning-schedule-track">
                  {blocks.map((b) => {
                    const axisStart = AXIS_START_HOUR * 60;
                    const axisSpan = AXIS_HOURS * 60;
                    // 축(07~22시) 밖 예정도 트랙 안에 고정한다 — 시각은 라벨이
                    // 말해주므로 위치는 가장자리 클램프로 충분하다.
                    const left = Math.min(97, Math.max(0, ((b.startMin - axisStart) / axisSpan) * 100));
                    const width = Math.max(
                      2,
                      Math.min(100 - left, (b.minutes / axisSpan) * 100)
                    );
                    const completed = b.order.status === "COMPLETED";
                    const cls = completed
                      ? "cleaning-block cleaning-block--done"
                      : b.delayed
                        ? "cleaning-block cleaning-block--delayed"
                        : "cleaning-block";
                    const etaMin = b.expectedStartMin % 1440;
                    const etaNextDay = b.expectedStartMin >= 1440 ? " (+1일)" : "";
                    const eta = `${String(Math.floor(etaMin / 60)).padStart(2, "0")}:${String(etaMin % 60).padStart(2, "0")}${etaNextDay}`;
                    return (
                      <div
                        key={b.order.id}
                        className={cls}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${b.order.customerName} · ${b.order.address}\n예정 ${kstClock(b.order.scheduledAt!)} · ${b.minutes}분 · 예상 도착 ${eta}${completed ? `\n완료(${b.order.completedSource === "AUTO" ? "자동" : "수동"})` : b.delayed ? "\n지연" : ""}`}
                      >
                        {kstClock(b.order.scheduledAt!)} {b.order.customerName}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
      <p className="muted cleaning-schedule-hint">
        블록에 마우스를 올리면 고객·예상 도착·지연 여부가 표시됩니다. 순번은 예정
        시각순으로 자동 결정되고, 같은 차량의 시간 겹침은 등록이 거부됩니다.
        업로드 엑셀 열: 차량번호 / 고객명 / 연락처 / 주소 / 예정 시각(yyyy-MM-dd
        HH:mm) / 소요분(선택) / 출발지(선택).
      </p>

      {preview ? (
        <div className="bulk-preview-overlay">
          <div className="bulk-preview-modal">
            <h2 className="bulk-preview-title">클리닝 배차 업로드 미리보기</h2>

            <div className="bulk-preview-summary">
              <span className="bulk-preview-summary-new">신규 {preview.summary.new}</span>
              <span className="bulk-preview-summary-error">오류 {preview.summary.error}</span>
              <span className="bulk-preview-summary-total">합계 {preview.summary.total}</span>
            </div>

            <div className="bulk-preview-table-wrapper">
              <table className="bulk-preview-table">
                <thead>
                  <tr>
                    <th>행</th>
                    <th>상태</th>
                    <th>차량번호</th>
                    <th>고객명</th>
                    <th>연락처</th>
                    <th>주소</th>
                    <th>예정 시각</th>
                    <th>소요분</th>
                    <th>좌표</th>
                    <th>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.rowNumber} className={`bulk-preview-row-${row.status}`}>
                      <td>{row.rowNumber}</td>
                      <td>{row.status === "NEW" ? "신규" : "오류"}</td>
                      <td>{row.plateNumber}</td>
                      <td>{row.customerName}</td>
                      <td>{row.customerPhone}</td>
                      <td>{row.address}</td>
                      <td>{row.scheduledAt ? kstClock(row.scheduledAt) : "—"}</td>
                      <td>{row.serviceMinutes ?? "—"}</td>
                      <td>
                        {row.latitude != null && row.longitude != null
                          ? `${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`
                          : ""}
                      </td>
                      <td>{row.message ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bulk-preview-actions">
              <button onClick={() => { setPreview(null); setError(null); }} disabled={loading} className="button-neutral">
                취소
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading || preview.rows.filter((r) => r.status === "NEW").length === 0}
                className="button-primary"
              >
                {loading ? "저장 중..." : `${preview.rows.filter((r) => r.status === "NEW").length}건 적용`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
