"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { searchAddressAction } from "@/app/dispatch/actions";
import type { AddressSearchResult } from "@/lib/services/vworld-geocoder";

/**
 * VWorld 주소 검색 입력 — 다음(카카오) 우편번호 팝업을 대체한다 (배차 폼).
 *
 * 입력 → 400ms 디바운스 서버 검색(도로명 우선) → 드롭다운에서 선택.
 * 검색 결과에 좌표가 함께 실려 오므로 선택 즉시 주소+좌표가 확정된다 —
 * 서버 액션은 이 좌표를 그대로 쓰고 지오코딩을 생략한다 (이중 호출 제거,
 * 검색 결과와 저장 좌표의 불일치 원천 차단).
 *
 * 직접 타이핑만 하고 목록에서 고르지 않으면 좌표 없이 주소 문자열만
 * 남는다 — 그 경우 서버가 지오코딩으로 보완한다 (기존 경로 유지).
 */
export function AddressSearchInput({
  value,
  onChange,
  placeholder = "주소 검색 (도로명 또는 지번)",
  required,
  ariaLabel = "주소"
}: {
  value: string;
  /** 주소 문자열 + (목록 선택 시) 좌표. 직접 입력이면 좌표 null. */
  onChange: (address: string, coords: { latitude: number; longitude: number } | null) => void;
  placeholder?: string;
  required?: boolean;
  ariaLabel?: string;
}) {
  const [results, setResults] = useState<AddressSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭으로 드롭다운 닫기.
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const runSearch = (query: string) => {
    startTransition(async () => {
      const res = await searchAddressAction(query);
      if (!res.ok) {
        setMessage(res.message ?? "주소 검색 실패");
        setResults([]);
        setOpen(true);
        return;
      }
      setMessage(res.results.length === 0 ? "검색 결과가 없습니다." : null);
      setResults(res.results);
      setOpen(true);
    });
  };

  const handleInput = (next: string) => {
    onChange(next, null);
    setMessage(null);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (next.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = window.setTimeout(() => runSearch(next), 400);
  };

  return (
    <div className="address-search" ref={wrapperRef}>
      <input
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        placeholder={placeholder}
        required={required}
        aria-label={ariaLabel}
        autoComplete="off"
      />
      {isPending ? <span className="address-search-spinner">…</span> : null}
      {open && (results.length > 0 || message) ? (
        <ul className="address-search-results" role="listbox">
          {message ? <li className="address-search-empty">{message}</li> : null}
          {results.map((r) => (
            <li key={`${r.address}-${r.longitude}`}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                className="address-search-result"
                onClick={() => {
                  onChange(r.address, { latitude: r.latitude, longitude: r.longitude });
                  setResults([]);
                  setOpen(false);
                }}
              >
                <span className="address-search-road">{r.address}</span>
                {r.parcelAddress && r.roadAddress ? (
                  <span className="address-search-parcel muted">{r.parcelAddress}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
