"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";

import { PhoneNumberInput } from "@/components/management/PhoneNumberInput";
import { PlateNumberInput } from "@/components/management/PlateNumberInput";
import {
  createContractAction,
  createResourceRiderAction,
  createResourceVehicleAction
} from "@/app/management/resources/actions";
import { useScrollLockedDialog } from "@/lib/hooks/use-scroll-locked-dialog";
import type { FrontendRider, FrontendVehicle } from "@/lib/services/service-ops-api";

/**
 * 자원 관리의 단건 등록 다이얼로그 3종 — 차량·라이더/클리너·매칭. 모두 client-submit
 * (결과 객체 반환) 으로 처리하고, 성공 시 `onCreated` 를 불러 부모가
 * `router.refresh()` 로 목록을 갱신한다.
 *
 * 매칭 생성은 용도가 폼 구성을 가른다:
 *   배송용 차량 → 구독/렌탈 + 인수형/반납형 (계약 템플릿 축)
 *   클린차량   → 직영/협력 (engagement_type, V57) + CUSTOM 템플릿 자동
 * 여기서의 분기는 화면 편의고, 용도↔직무↔형태 교차 검증의 최종 심판은
 * 백엔드다 (400 VALIDATION_FAILED).
 */

function useDialog(open: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useScrollLockedDialog(dialogRef, open);
  return dialogRef;
}

// ── 차량 등록 ───────────────────────────────────────────────────────

export function VehicleCreateDialog({
  open,
  onClose,
  onCreated
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (notice?: string) => void;
}) {
  const dialogRef = useDialog(open);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClose = useCallback(() => {
    setMessage(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="overview-create-dialog maintenance-dialog"
      onClose={handleClose}
      onCancel={handleClose}
    >
      <button
        type="button"
        className="overview-create-dialog-reset"
        aria-label="닫기"
        onClick={handleClose}
      >
        ×
      </button>
      <h3>차량 등록</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const fd = new FormData(event.currentTarget);
          setMessage(null);
          startTransition(async () => {
            const res = await createResourceVehicleAction({
              plateNumber: String(fd.get("plateNumber") ?? "").trim(),
              purpose: fd.get("purpose") === "CLEANING" ? "CLEANING" : "DELIVERY",
              wheelType: fd.get("wheelType") === "FOUR_WHEEL" ? "FOUR_WHEEL" : "TWO_WHEEL",
              engineType: parseEngine(fd.get("engineType")),
              modelName: String(fd.get("modelName") ?? "").trim() || null,
              operationStatus: fd.get("operationStatus") === "IN_SERVICE" ? "IN_SERVICE" : "READY",
              imei: String(fd.get("imei") ?? "").trim() || null,
              terminalId: String(fd.get("terminalId") ?? "").trim() || null
            });
            if (res.ok) {
              onCreated(res.message);
              handleClose();
            } else {
              setMessage(res.message ?? "차량 등록 실패");
            }
          });
        }}
      >
        <label>
          차량번호
          <PlateNumberInput name="plateNumber" required />
        </label>
        <label>
          용도
          <select name="purpose" defaultValue="DELIVERY">
            <option value="DELIVERY">배송용</option>
            <option value="CLEANING">클린차량</option>
          </select>
        </label>
        <label>
          구분
          <select name="wheelType" defaultValue="TWO_WHEEL">
            <option value="TWO_WHEEL">2륜</option>
            <option value="FOUR_WHEEL">4륜</option>
          </select>
        </label>
        <label>
          엔진
          <select name="engineType" defaultValue="ELECTRIC">
            <option value="ELECTRIC">전기</option>
            <option value="ICE">내연기관</option>
            <option value="LPG">LPG</option>
          </select>
        </label>
        <label>
          모델명
          <input name="modelName" placeholder="선택" />
        </label>
        <label>
          운영 상태
          <select name="operationStatus" defaultValue="READY">
            <option value="READY">대기</option>
            <option value="IN_SERVICE">운행</option>
          </select>
        </label>
        <label>
          IMEI
          <input name="imei" placeholder="입력 시 단말기 자동 연동" />
        </label>
        <label>
          단말기 ID
          <input name="terminalId" placeholder="선택" />
        </label>
        {message ? <p role="alert" style={{ color: "red" }}>{message}</p> : null}
        <div className="overview-create-dialog-actions">
          <button type="button" className="button-neutral" onClick={handleClose}>
            취소
          </button>
          <button type="submit" className="button-primary" disabled={isPending}>
            {isPending ? "등록 중…" : "등록"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function parseEngine(value: FormDataEntryValue | null): "ELECTRIC" | "ICE" | "LPG" {
  const text = String(value ?? "");
  if (text === "ICE" || text === "LPG") return text;
  return "ELECTRIC";
}

// ── 라이더/클리너 등록 ─────────────────────────────────────────────────────

export function RiderCreateDialog({
  open,
  onClose,
  onCreated
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (notice?: string) => void;
}) {
  const dialogRef = useDialog(open);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClose = useCallback(() => {
    setMessage(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="overview-create-dialog maintenance-dialog"
      onClose={handleClose}
      onCancel={handleClose}
    >
      <button
        type="button"
        className="overview-create-dialog-reset"
        aria-label="닫기"
        onClick={handleClose}
      >
        ×
      </button>
      <h3>라이더/클리너 등록</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const fd = new FormData(event.currentTarget);
          const education = String(fd.get("initialEducationType") ?? "");
          setMessage(null);
          startTransition(async () => {
            const res = await createResourceRiderAction({
              name: String(fd.get("name") ?? "").trim(),
              phoneNumber: String(fd.get("phoneNumber") ?? "").trim(),
              role: fd.get("role") === "CLEANER" ? "CLEANER" : "RIDER",
              teamName: String(fd.get("teamName") ?? "").trim() || null,
              initialEducationType:
                education === "ONLINE" || education === "OFFLINE" ? education : null
            });
            if (res.ok) {
              onCreated(res.message);
              handleClose();
            } else {
              setMessage(res.message ?? "라이더/클리너 등록 실패");
            }
          });
        }}
      >
        <label>
          이름
          <input name="name" required />
        </label>
        <label>
          연락처
          <PhoneNumberInput name="phoneNumber" required />
        </label>
        <label>
          직무
          <select name="role" defaultValue="RIDER">
            <option value="RIDER">라이더</option>
            <option value="CLEANER">클리너</option>
          </select>
        </label>
        <label>
          팀
          <input name="teamName" placeholder="선택" />
        </label>
        <label>
          교육 여부
          <select name="initialEducationType" defaultValue="">
            <option value="">미이수</option>
            <option value="ONLINE">온라인</option>
            <option value="OFFLINE">오프라인</option>
          </select>
        </label>
        {message ? <p role="alert" style={{ color: "red" }}>{message}</p> : null}
        <div className="overview-create-dialog-actions">
          <button type="button" className="button-neutral" onClick={handleClose}>
            취소
          </button>
          <button type="submit" className="button-primary" disabled={isPending}>
            {isPending ? "등록 중…" : "등록"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

// ── 매칭 등록 ───────────────────────────────────────────────────────

export function MatchingCreateDialog({
  open,
  onClose,
  onCreated,
  vehicles,
  riders
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  vehicles: ReadonlyArray<FrontendVehicle>;
  riders: ReadonlyArray<FrontendRider>;
}) {
  const dialogRef = useDialog(open);
  const [message, setMessage] = useState<string | null>(null);
  const [bikeId, setBikeId] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => (v.id ?? v.slug) === bikeId) ?? null,
    [vehicles, bikeId]
  );
  const cleaning = selectedVehicle?.purpose === "CLEANING";

  // 용도↔직무 교차 검증과 짝을 맞춰 라이더/클리너 목록을 미리 걸러 준다 —
  // 클린차량이면 클리너만, 배송용이면 라이더(또는 직무 미지정)만.
  const eligibleRiders = useMemo(() => {
    if (!selectedVehicle) return riders;
    return riders.filter((r) => (cleaning ? r.role === "CLEANER" : r.role !== "CLEANER"));
  }, [riders, selectedVehicle, cleaning]);

  const handleClose = useCallback(() => {
    setMessage(null);
    setBikeId("");
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="overview-create-dialog maintenance-dialog"
      onClose={handleClose}
      onCancel={handleClose}
    >
      <button
        type="button"
        className="overview-create-dialog-reset"
        aria-label="닫기"
        onClick={handleClose}
      >
        ×
      </button>
      <h3>매칭 등록</h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const fd = new FormData(event.currentTarget);
          const startDate = String(fd.get("startAt") ?? "").trim();
          if (!bikeId || !startDate) return;
          setMessage(null);
          startTransition(async () => {
            const res = await createContractAction({
              riderId: String(fd.get("riderId") ?? ""),
              bikeId,
              // 달력 날짜는 UTC 자정 고정 — 로컬 해석 시 KST 에서 하루 밀린다.
              startAt: startDate + "T00:00:00Z",
              ...(cleaning
                ? { engagementType: fd.get("engagementType") === "PARTNER" ? "PARTNER" : "DIRECT" }
                : {
                    category: fd.get("category") === "RENTAL" ? "RENTAL" : "SUBSCRIPTION",
                    returnType: fd.get("returnType") === "RETURN" ? "RETURN" : "TAKEOVER"
                  })
            });
            if (res.ok) {
              onCreated();
              handleClose();
            } else {
              setMessage(res.message ?? "매칭 생성 실패");
            }
          });
        }}
      >
        <label>
          차량
          <select value={bikeId} onChange={(e) => setBikeId(e.target.value)} required>
            <option value="">차량 선택</option>
            {vehicles.map((v) => (
              <option key={v.slug} value={v.id ?? v.slug}>
                {v.plateNumber} · {v.purpose === "CLEANING" ? "클린차량" : "배송용"}
              </option>
            ))}
          </select>
        </label>
        <label>
          라이더/클리너
          <select name="riderId" required defaultValue="">
            <option value="">라이더/클리너 선택</option>
            {eligibleRiders.map((r) => (
              <option key={r.slug} value={r.id ?? r.slug}>
                {r.name} · {r.role === "CLEANER" ? "클리너" : "라이더"} · {r.phone}
              </option>
            ))}
          </select>
        </label>
        {cleaning ? (
          <label>
            계약 형태
            <select name="engagementType" defaultValue="DIRECT">
              <option value="DIRECT">직영</option>
              <option value="PARTNER">협력</option>
            </select>
          </label>
        ) : (
          <>
            <label>
              계약형태
              <select name="category" defaultValue="SUBSCRIPTION">
                <option value="SUBSCRIPTION">구독</option>
                <option value="RENTAL">렌탈</option>
              </select>
            </label>
            <label>
              인수방식
              <select name="returnType" defaultValue="TAKEOVER">
                <option value="TAKEOVER">인수형</option>
                <option value="RETURN">반납형</option>
              </select>
            </label>
          </>
        )}
        <label>
          시작일
          <input type="date" name="startAt" required />
        </label>
        {message ? <p role="alert" style={{ color: "red" }}>{message}</p> : null}
        <div className="overview-create-dialog-actions">
          <button type="button" className="button-neutral" onClick={handleClose}>
            취소
          </button>
          <button type="submit" className="button-primary" disabled={isPending || !bikeId}>
            {isPending ? "생성 중…" : "생성"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
