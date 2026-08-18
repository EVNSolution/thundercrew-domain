"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { PhoneNumberInput } from "@/components/management/PhoneNumberInput";
import { updateRiderFromOverviewAction } from "@/app/actions";
import {
  addEducationRecordAction,
  deleteEducationRecordAction,
  listEducationRecordsAction
} from "@/app/management/resources/actions";
import { useScrollLockedDialog } from "@/lib/hooks/use-scroll-locked-dialog";
import type {
  FrontendRider,
  ServiceOpsRiderEducationRecord
} from "@/lib/services/service-ops-api";

/**
 * 이용자(라이더/클리너) 상세 다이얼로그 — 자원 관리의 행 클릭으로 연다.
 * 다른 detail dialog 들과 같은 modal 패턴 (centered, scroll-locked).
 *
 * view 모드: 기본 정보 + 교육 기록 목록(추가/삭제).
 * edit 모드: 이름/연락처/직무/팀/등급/보험 텍스트를 한 폼으로 저장 —
 * `updateRiderFromOverviewAction` 이 redirect(returnTo) 로 목록을 갱신한다.
 *
 * 등급은 초보/고수 2단계 (V58). "미판정" 선택은 서버 액션에서 clearSkillLevel
 * 플래그로 변환된다 — JSON null 은 "무변경" 과 구분되지 않기 때문.
 */
export function RiderDetailDialog({
  rider,
  onClose,
  returnTo = "/management/resources"
}: {
  rider: FrontendRider | null;
  onClose: () => void;
  returnTo?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = rider !== null;
  const [mode, setMode] = useState<"view" | "edit">("view");

  useScrollLockedDialog(dialogRef, open);

  const handleClose = useCallback(() => {
    setMode("view");
    onClose();
  }, [onClose]);

  if (!rider) return null;
  const riderId = rider.id ?? rider.slug;
  const boundUpdate = updateRiderFromOverviewAction.bind(null, riderId, returnTo);

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
      <h3>이용자 상세</h3>

      {mode === "view" ? (
        <div>
          <div className="detail-row-grid">
            <DetailField label="이름" value={rider.name} />
            <DetailField label="연락처" value={rider.phone} />
            <DetailField label="직무" value={roleLabel(rider.role)} />
            <DetailField label="팀" value={rider.team || "—"} />
            <DetailField label="등급" value={skillLabel(rider.skillLevel)} />
            <DetailField label="기본 보험" value={rider.primaryInsurance || "—"} />
            <DetailField label="추가 보험" value={rider.addonInsurance || "—"} />
          </div>
          <EducationSection riderId={riderId} />
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
          <label>
            이름
            <input name="name" defaultValue={rider.name} required />
          </label>
          <label>
            연락처
            <PhoneNumberInput name="phoneNumber" defaultValue={rider.phone} required />
          </label>
          <label>
            직무
            <select name="role" defaultValue={rider.role ?? "RIDER"}>
              <option value="RIDER">라이더</option>
              <option value="CLEANER">클리너</option>
            </select>
          </label>
          <label>
            팀
            <input name="teamName" defaultValue={rider.team ?? ""} />
          </label>
          <label>
            등급
            <select name="skillLevel" defaultValue={rider.skillLevel ?? "NONE"}>
              <option value="NONE">미판정</option>
              <option value="BEGINNER">초보</option>
              <option value="EXPERT">고수</option>
            </select>
          </label>
          <label>
            기본 보험
            <input
              name="primaryInsurance"
              defaultValue={rider.primaryInsurance ?? ""}
              placeholder="예: 시간제 보험 (빈 칸 = 없음)"
            />
          </label>
          <label>
            추가 보험
            <input
              name="addonInsurance"
              defaultValue={rider.addonInsurance ?? ""}
              placeholder="예: 유상운송 특약 (빈 칸 = 없음)"
            />
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

function roleLabel(role?: FrontendRider["role"]): string {
  if (role === "CLEANER") return "클리너";
  if (role === "RIDER") return "라이더";
  return "—";
}

function skillLabel(skill?: FrontendRider["skillLevel"]): string {
  if (skill === "BEGINNER") return "초보";
  if (skill === "EXPERT") return "고수";
  return "미판정";
}

// ============================================================================
// 교육 기록 섹션
// ============================================================================

/**
 * 교육 기록 목록 + 추가/삭제. client-submit — 결과 객체를 받아 목록만 다시
 * 불러온다 (다이얼로그 컨텍스트 유지).
 */
function EducationSection({ riderId }: { riderId: string }) {
  const [records, setRecords] = useState<ServiceOpsRiderEducationRecord[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [newType, setNewType] = useState<"ONLINE" | "OFFLINE">("ONLINE");
  const [newDate, setNewDate] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    listEducationRecordsAction(riderId)
      .then((items) => { if (!cancelled) setRecords(items); })
      .catch(() => { if (!cancelled) setRecords([]); });
    return () => { cancelled = true; };
  }, [riderId, reloadTick]);

  return (
    <section className="maintenance-section">
      <h4>교육 기록</h4>
      {records === null ? (
        <p className="muted">불러오는 중…</p>
      ) : records.length === 0 ? (
        <p className="muted">교육 기록 없음</p>
      ) : (
        <ul className="education-record-list">
          {records.map((r) => (
            <li key={r.id} className="education-record-row">
              <span>{r.educationType === "ONLINE" ? "온라인" : "오프라인"}</span>
              <span>{r.completedAt.slice(0, 10)}</span>
              <button
                type="button"
                className="button-neutral"
                disabled={isPending}
                onClick={() => {
                  if (!window.confirm("교육 기록을 삭제하시겠습니까?")) return;
                  setMessage(null);
                  startTransition(async () => {
                    const res = await deleteEducationRecordAction(r.id);
                    if (!res.ok) setMessage(res.message ?? "삭제 실패");
                    setReloadTick((t) => t + 1);
                  });
                }}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="education-record-add">
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as "ONLINE" | "OFFLINE")}
          aria-label="교육 유형"
        >
          <option value="ONLINE">온라인</option>
          <option value="OFFLINE">오프라인</option>
        </select>
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          aria-label="이수일"
        />
        <button
          type="button"
          className="button-secondary"
          disabled={isPending || !newDate}
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              // date input 은 달력 날짜만 준다. 로컬 자정으로 해석하면
              // KST→UTC 변환에서 하루 밀리므로 UTC 자정으로 고정해, 고른
              // 날짜가 저장·표시(slice(0,10))에서 그대로 보이게 한다.
              const res = await addEducationRecordAction(riderId, newType, newDate + "T00:00:00Z");
              if (!res.ok) setMessage(res.message ?? "추가 실패");
              setNewDate("");
              setReloadTick((t) => t + 1);
            });
          }}
        >
          추가
        </button>
      </div>
      {message ? <p role="alert" style={{ color: "red" }}>{message}</p> : null}
    </section>
  );
}
