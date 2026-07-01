"use client";

import { useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";

/**
 * 차량번호 등록용 3-칸 입력기. 한국 번호판 구조 (앞 숫자 2~3 / 가운데 한글 1 /
 * 뒤 숫자 4) 그대로 분리해 받는다. 분리 입력의 장점:
 *
 *  - 정규식 검증 없이도 형식이 자연스럽게 강제됨
 *  - 운영자가 손가락을 안 옮기고 빠르게 입력 가능 (칸이 차면 다음 칸으로 자동 포커스)
 *  - 옛 번호판(`12가3456`) / 신형(`123가4567`) 둘 다 같은 위젯으로 처리
 *
 * 폼 제출 시에는 hidden 입력 (`name="plateNumber"`) 에 세 칸을 공백 없이
 * 이어붙인 문자열을 담아 보낸다. 이미 존재하는 server action 시그니처
 * (`plateNumber` 단일 필드) 가 그대로 동작하도록 한 의도된 선택.
 */
export interface PlateNumberInputProps {
  /** Combined form field name; defaults to "plateNumber". */
  name?: string;
  /** Whether all three sub-inputs are required. */
  required?: boolean;
  /** Pre-fill the three sub-inputs from a combined plate string (e.g. "12가3456"). */
  defaultValue?: string;
}

// 합쳐진 번호판 문자열을 (앞 숫자 / 한글 / 뒤 숫자) 세 토막으로 분리. 형식이
// 안 맞으면 (`null` 등) 모두 빈 문자열을 돌려준다. 공백·하이픈은 무시한다.
function splitPlate(raw: string): { front: string; letter: string; back: string } {
  if (!raw) return { front: "", letter: "", back: "" };
  const cleaned = raw.replace(/[\s-]+/g, "");
  const match = cleaned.match(/^(\d{2,3})([가-힣])(\d{4})$/);
  if (!match) return { front: "", letter: "", back: "" };
  return { front: match[1], letter: match[2], back: match[3] };
}

export function PlateNumberInput({
  name = "plateNumber",
  required = false,
  defaultValue = ""
}: PlateNumberInputProps) {
  const initial = splitPlate(defaultValue);
  const [front, setFront] = useState(initial.front);
  const [letter, setLetter] = useState(initial.letter);
  const [back, setBack] = useState(initial.back);

  const letterRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const combined = `${front}${letter}${back}`;

  const handleFrontChange = (event: ChangeEvent<HTMLInputElement>) => {
    // 숫자만 통과. 한글 IME / 영문 등은 즉시 폐기.
    const digits = event.target.value.replace(/[^0-9]/g, "").slice(0, 3);
    setFront(digits);
    if (digits.length >= 2) {
      // 2자리만 채워도 옛 번호판 (12가) 형식이라 다음 칸으로 넘긴다.
      // 3자리까지 더 입력하고 싶으면 다시 클릭해서 돌아오면 됨.
      if (digits.length === 3) {
        letterRef.current?.focus();
      }
    }
  };

  const handleFrontKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // 2자리 채운 상태에서 스페이스/엔터 누르면 가운데 칸으로 (옛 번호판 빠른 입력).
    if (event.key === " " || event.key === "Enter") {
      if (front.length >= 2) {
        event.preventDefault();
        letterRef.current?.focus();
      }
    }
  };

  const handleLetterChange = (event: ChangeEvent<HTMLInputElement>) => {
    // 한글 한 글자만 통과. 자모(ㄱ, ㅏ) 단계의 부분 입력은 무시되고
    // IME 가 완성한 음절 (가-힣) 1글자만 보존.
    const hangul = event.target.value.replace(/[^가-힣]/g, "").slice(0, 1);
    setLetter(hangul);
    if (hangul.length === 1) {
      backRef.current?.focus();
    }
  };

  const handleBackChange = (event: ChangeEvent<HTMLInputElement>) => {
    const digits = event.target.value.replace(/[^0-9]/g, "").slice(0, 4);
    setBack(digits);
  };

  // 운영자가 완성된 번호판을 통째로 붙여넣을 수 있도록 첫 칸에서 paste 를 가로채
  // 세 부분으로 나눠 채워준다. 예: "12가3456" / "123 가 4567" / "12가 3456" 모두 처리.
  const handlePasteIntoFront = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text").replace(/\s+/g, "");
    const match = text.match(/^(\d{2,3})([가-힣])(\d{4})$/);
    if (!match) {
      return; // 형식이 아니면 기본 paste 동작에 맡김 (첫 칸이 숫자만 거름)
    }
    event.preventDefault();
    setFront(match[1]);
    setLetter(match[2]);
    setBack(match[3]);
    backRef.current?.focus();
  };

  return (
    <div className="plate-number-input">
      <input
        type="text"
        inputMode="numeric"
        pattern="\d{2,3}"
        maxLength={3}
        value={front}
        onChange={handleFrontChange}
        onKeyDown={handleFrontKey}
        onPaste={handlePasteIntoFront}
        placeholder="123"
        aria-label="차량번호 앞 숫자"
        required={required}
      />
      <input
        ref={letterRef}
        type="text"
        pattern="[가-힣]"
        maxLength={1}
        value={letter}
        onChange={handleLetterChange}
        placeholder="가"
        aria-label="차량번호 한글"
        // 브라우저가 한/영 IME 를 강제 전환할 수 없어서, 영문 IME 상태로
        // 타이핑하면 onChange 필터가 입력을 묵음 처리한다. 그때 운영자가
        // 왜 안 들어가는지 알 수 있도록 title 안내 + 패턴 미스매치 시
        // 브라우저 기본 툴팁에 같은 문장이 표시되게 lang/title 을 명시.
        lang="ko"
        title="한글 칸입니다. 한/영 키로 한글 입력 모드로 바꾼 뒤 한 글자를 입력하세요. (예: 가, 나, 다, 허)"
        required={required}
        style={{ textAlign: "center" }}
      />
      <input
        ref={backRef}
        type="text"
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        value={back}
        onChange={handleBackChange}
        placeholder="4567"
        aria-label="차량번호 뒤 숫자"
        required={required}
      />
      <input type="hidden" name={name} value={combined} />
      {/* 다이얼로그 안에서 한 줄로 보이는 도움말. 한글 IME 가 켜져 있어야
          가운데 칸이 채워진다는 점을 운영자가 미리 알 수 있도록 항상 표시. */}
      <p className="plate-number-input-helper" aria-hidden="true">
        가운데 칸은 한글 입력 모드(한/영 키)로 전환 후 한 글자를 입력하세요.
      </p>
    </div>
  );
}
