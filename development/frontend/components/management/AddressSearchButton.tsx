"use client";

import { useCallback, useState } from "react";

/**
 * 다음 우편번호 (Kakao Postcode) 팝업을 띄우는 작은 버튼. 키 발급 없이
 * 무료로 사용 가능한 공개 스크립트(postcode.v2.js) 를 lazy-load 한다.
 *
 * 운영자가 버튼을 누르면 카카오가 제공하는 검색 팝업이 떠서 도로명/지번
 * 주소를 찾고, 선택하면 `onSelect` 콜백으로 정제된 주소 문자열을 넘긴다.
 * 좌표 정보는 이 팝업에서 제공되지 않으므로(별도 지오코딩 호출 필요)
 * 호출 측에서는 좌표를 따로 다루지 않는다.
 */
const POSTCODE_SCRIPT_SRC =
  "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

interface DaumPostcodeData {
  // 사용자가 도로명/지번 토글에서 어느 쪽을 선택했는지에 따라 채워지는 단일 필드.
  address: string;
  /** 도로명 주소. 후보가 없으면 빈 문자열. */
  roadAddress: string;
  /** 지번(법정동) 주소. 후보가 없으면 빈 문자열. */
  jibunAddress: string;
  /** 신우편번호(5자리). */
  zonecode: string;
  /** 시도 (예: "서울") — 필요 시 별도 컬럼에 분리 저장할 때 활용. */
  sido: string;
  /** 시군구. */
  sigungu: string;
  /** 법정동 이름. */
  bname: string;
}

interface DaumPostcodeOptions {
  oncomplete: (data: DaumPostcodeData) => void;
  onclose?: () => void;
}

interface DaumPostcodeInstance {
  open(): void;
}

interface DaumNamespace {
  Postcode: new (options: DaumPostcodeOptions) => DaumPostcodeInstance;
}

declare global {
  interface Window {
    daum?: DaumNamespace;
  }
}

async function ensurePostcodeScriptLoaded(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.daum?.Postcode) return;

  const existing = document.querySelector<HTMLScriptElement>(
    `script[src="${POSTCODE_SCRIPT_SRC}"]`,
  );
  if (existing) {
    if (window.daum?.Postcode) return;
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("postcode 스크립트 로드 실패")),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = POSTCODE_SCRIPT_SRC;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("postcode 스크립트 로드 실패")),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

export interface AddressSearchButtonProps {
  /** 운영자가 팝업에서 주소를 고르면 호출. 도로명 우선, 없으면 지번. */
  onSelect: (address: string) => void;
}

export function AddressSearchButton({ onSelect }: AddressSearchButtonProps) {
  // 첫 클릭 시 스크립트가 받아져 올 때까지 잠깐 시간이 걸릴 수 있어
  // 로딩 상태를 표시한다. 한 번 로드되면 캐시되어 두 번째부터는 즉시 열림.
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      await ensurePostcodeScriptLoaded();
      const Postcode = window.daum?.Postcode;
      if (!Postcode) return;
      new Postcode({
        oncomplete: (data) => {
          const picked = data.roadAddress || data.jibunAddress || data.address;
          onSelect(picked);
        },
      }).open();
    } finally {
      setLoading(false);
    }
  }, [loading, onSelect]);

  return (
    <button
      type="button"
      className="button-neutral"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? "불러오는 중…" : "주소 검색"}
    </button>
  );
}
