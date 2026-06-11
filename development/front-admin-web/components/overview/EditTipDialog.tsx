"use client";

import { useEffect, useRef, useState } from "react";

import { updateTipAction } from "@/app/tips/actions";
import { useScrollLockedDialog } from "@/lib/hooks/use-scroll-locked-dialog";
import { loadNcpMapsSdk } from "@/lib/maps/load-ncp-sdk";
import type { ServiceOpsTip } from "@/lib/services/service-ops-api";
import type { NaverLatLng, NaverMapInstance, NaverMarkerInstance } from "@/types/naver-maps";

interface EditTipDialogProps {
  tip: ServiceOpsTip;
  onClose: () => void;
  onSaved: () => void;
}

const MINI_MAP_ZOOM = 14;

/** NCP 지도 `click` 이벤트 payload — 클릭 좌표를 `coord` 로 노출. */
type NaverMapClickEvent = { coord: NaverLatLng };

/**
 * 운영 팁 편집 다이얼로그. CreateTipDialog 와 동일한 폼/미니맵 패턴이되 기존
 * `tip` 으로 사전 입력하고 초기 핀을 그 좌표에 찍어둔다. 클릭으로 핀(좌표)을
 * 이동할 수 있다. server action 결과는 `{ ok }` 판별 결과로 받아 분기한다.
 */
export function EditTipDialog({ tip, onClose, onSaved }: EditTipDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<NaverMapInstance | null>(null);
  const pinMarkerRef = useRef<NaverMarkerInstance | null>(null);

  const [address, setAddress] = useState(tip.address);
  const [content, setContent] = useState(tip.content);
  const [lat, setLat] = useState<number>(tip.latitude);
  const [lng, setLng] = useState<number>(tip.longitude);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useScrollLockedDialog(dialogRef, true);

  // tip 의 lat/lng 는 mount 시점 값을 기준으로 한 번만 미니맵을 초기화한다.
  // 부모는 행마다 다른 EditTipDialog 를 key 로 새로 마운트하므로 초기 좌표가
  // 매번 새로 잡힌다.
  const initialLat = tip.latitude;
  const initialLng = tip.longitude;
  useEffect(() => {
    let cancelled = false;
    loadNcpMapsSdk()
      .then(() => {
        if (cancelled) return;
        const naver = window.naver;
        const container = mapContainerRef.current;
        if (!naver?.maps?.Map || !container || mapRef.current) return;
        const map = new naver.maps.Map(container, {
          center: new naver.maps.LatLng(initialLat, initialLng),
          zoom: MINI_MAP_ZOOM,
        });
        mapRef.current = map;
        // 기존 좌표에 초기 핀 표시.
        pinMarkerRef.current = new naver.maps.Marker({
          position: new naver.maps.LatLng(initialLat, initialLng),
          map,
        });
        if (!naver.maps.Event) return;
        naver.maps.Event.addListener(map, "click", (event: unknown) => {
          const coord = (event as NaverMapClickEvent).coord;
          if (!coord) return;
          setLat(coord.lat());
          setLng(coord.lng());
          pinMarkerRef.current?.setMap(null);
          pinMarkerRef.current = new naver.maps.Marker({ position: coord, map });
        });
      })
      .catch(() => {
        if (!cancelled) setError("지도를 불러오지 못했습니다.");
      });
    return () => {
      cancelled = true;
      pinMarkerRef.current?.setMap(null);
      pinMarkerRef.current = null;
      mapRef.current = null;
    };
  }, [initialLat, initialLng]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
        <span className="tip-coords">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </span>
        {error ? (
          <p role="alert" className="panel-error-banner tip-dialog-error">
            {error}
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
