"use client";

import { useRef, useState } from "react";

import { useTipMiniMap } from "@/components/overview/use-tip-mini-map";
import { createTipAction } from "@/app/tips/actions";
import { useScrollLockedDialog } from "@/lib/hooks/use-scroll-locked-dialog";

interface CreateTipDialogProps {
  onClose: () => void;
  onSaved: () => void;
}

const SEOUL_DEFAULT_CENTER = { lat: 37.5666103, lng: 126.9783882 };
const MINI_MAP_ZOOM = 12;

/**
 * 운영 팁 생성 다이얼로그. 주소/내용 텍스트 + 미니 NCP 지도(클릭으로 lat/lng
 * 핀 지정). 기존 `overview-create-dialog` (native `<dialog>` + showModal) 패턴을
 * 그대로 따른다 — 클래스/버튼/스크롤락 훅 모두 스테이션 다이얼로그와 통일.
 *
 * server action 은 throw 가 아니라 `{ ok }` 판별 결과를 돌려주므로 try/catch
 * 대신 `result.ok` 로 분기해 backend 검증 메시지를 그대로 표면화한다.
 */
export function CreateTipDialog({ onClose, onSaved }: CreateTipDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [address, setAddress] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // native `<dialog>` 를 모달로 열고, 자동 포커스로 인한 스크롤 점프를 막는다.
  useScrollLockedDialog(dialogRef, true);

  // 미니맵 라이프사이클(SDK 로드 / map 생성 / 클릭 핀 / 정리) 은 공용 훅이 소유.
  // Create 는 초기 핀 없이 서울 중심에서 시작한다.
  const { lat, lng, mapError } = useTipMiniMap({
    containerRef: mapContainerRef,
    initialCenter: SEOUL_DEFAULT_CENTER,
    initialPin: null,
    zoom: MINI_MAP_ZOOM,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lat === null || lng === null) {
      setError("지도에서 위치를 클릭해 주세요.");
      return;
    }
    if (!address.trim()) {
      setError("주소를 입력해 주세요.");
      return;
    }
    if (!content.trim()) {
      setError("내용을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await createTipAction({
      address: address.trim(),
      content: content.trim(),
      latitude: lat,
      longitude: lng,
    });
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    onSaved();
  };

  return (
    <dialog ref={dialogRef} className="overview-create-dialog" onClose={onClose} onCancel={onClose}>
      <h3>팁 추가</h3>
      <form onSubmit={handleSubmit}>
        <label>
          주소
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="도로명 주소 직접 입력"
            maxLength={200}
          />
        </label>
        <label>
          내용
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="팁 내용을 입력하세요"
            rows={3}
          />
        </label>
        <label>
          위치 <span className="tip-dialog-hint">(지도를 클릭해 핀 설정)</span>
          <div ref={mapContainerRef} className="tip-mini-map" />
        </label>
        {lat !== null && lng !== null ? (
          <span className="tip-coords">
            {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        ) : null}
        {error || mapError ? (
          <p role="alert" className="panel-error-banner tip-dialog-error">
            {error ?? mapError}
          </p>
        ) : null}
        <div className="overview-create-dialog-actions">
          <button type="button" className="button-neutral" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="button-primary" disabled={saving}>
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
