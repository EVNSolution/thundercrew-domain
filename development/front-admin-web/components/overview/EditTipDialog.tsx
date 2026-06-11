"use client";

import { useRef, useState } from "react";

import { useTipMiniMap } from "@/components/overview/use-tip-mini-map";
import { updateTipAction } from "@/app/tips/actions";
import { useScrollLockedDialog } from "@/lib/hooks/use-scroll-locked-dialog";
import type { ServiceOpsTip } from "@/lib/services/service-ops-api";

interface EditTipDialogProps {
  tip: ServiceOpsTip;
  onClose: () => void;
  onSaved: () => void;
}

const MINI_MAP_ZOOM = 14;

/**
 * 운영 팁 편집 다이얼로그. CreateTipDialog 와 동일한 폼/미니맵 패턴이되 기존
 * `tip` 으로 사전 입력하고 초기 핀을 그 좌표에 찍어둔다. 클릭으로 핀(좌표)을
 * 이동할 수 있다. server action 결과는 `{ ok }` 판별 결과로 받아 분기한다.
 */
export function EditTipDialog({ tip, onClose, onSaved }: EditTipDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [address, setAddress] = useState(tip.address);
  const [content, setContent] = useState(tip.content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useScrollLockedDialog(dialogRef, true);

  // 미니맵 라이프사이클(SDK 로드 / map 생성 / 클릭 핀 / 정리) 은 공용 훅이 소유.
  // tip 좌표를 중심 + 초기 핀으로 씨딩하므로 lat/lng 는 핀 좌표로 시작하고
  // 클릭 시 갱신된다. 부모는 행마다 다른 EditTipDialog 를 key 로 새로 마운트해
  // 초기 좌표가 매번 새로 잡힌다.
  const { lat, lng, mapError } = useTipMiniMap({
    containerRef: mapContainerRef,
    initialCenter: { lat: tip.latitude, lng: tip.longitude },
    initialPin: { lat: tip.latitude, lng: tip.longitude },
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
    const result = await updateTipAction(tip.id, {
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
      <h3>팁 편집</h3>
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
          위치 <span className="tip-dialog-hint">(클릭으로 핀 이동)</span>
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
