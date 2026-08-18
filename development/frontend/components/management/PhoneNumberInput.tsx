"use client";

import { useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { AsYouType } from "libphonenumber-js";

/**
 * Controlled phone-number input that auto-inserts hyphens as the operator
 * types. Uses libphonenumber-js `AsYouType('KR')` so every Korean format
 * (010 휴대폰 / 02 서울 유선 / 031·032·... 지방 유선 / 070 인터넷전화 /
 * 1588·1577 대표번호 등) is laid out with the correct hyphen positions
 * without us hard-coding rules.
 *
 * Behaviour:
 *  - Operator types digits → hyphens appear automatically at the right spots.
 *  - Operator types a hyphen themselves → AsYouType strips and re-applies,
 *    so duplicates never accumulate.
 *  - Paste of any mix of digits / hyphens / spaces → normalised on the spot.
 *
 * The component sends its current formatted value to the surrounding form
 * via `name` (HTML form semantics), so the server action receives the
 * hyphenated string directly. Backend just stores the trimmed string —
 * `RiderCreateRequest.phoneNumber` only validates @NotBlank @Size(max=30).
 */
export interface PhoneNumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  defaultValue?: string;
  /** client-submit 폼용 — 포맷된 값이 바뀔 때마다 알려준다. form 제출 폼은 name 만으로 충분. */
  onValueChange?: (value: string) => void;
}

export function PhoneNumberInput({ defaultValue = "", onValueChange, ...rest }: PhoneNumberInputProps) {
  const [value, setValue] = useState(() => formatKoreanPhone(defaultValue));

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = formatKoreanPhone(event.target.value);
    setValue(next);
    onValueChange?.(next);
  };

  return (
    <input
      {...rest}
      type="tel"
      inputMode="numeric"
      value={value}
      onChange={handleChange}
    />
  );
}

function formatKoreanPhone(raw: string): string {
  // AsYouType keeps internal state across `input()` calls; recreating it
  // each call gives us a pure function and avoids stale-cursor bugs on
  // controlled inputs (where the user can edit middle of the string).
  return new AsYouType("KR").input(raw);
}
