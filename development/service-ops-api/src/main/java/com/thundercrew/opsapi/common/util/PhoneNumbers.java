package com.thundercrew.opsapi.common.util;

public final class PhoneNumbers {
    private PhoneNumbers() {}

    /**
     * 한국 전화번호를 대시 포맷으로 정규화한다. 숫자만 추출 후:
     *  - 11자리: XXX-XXXX-XXXX (휴대폰)
     *  - 10자리: XXX-XXX-XXXX
     *  - 그 외: 원본을 trim 해서 그대로 반환(알 수 없는 형식은 건드리지 않음).
     * null/blank 는 그대로 반환.
     */
    public static String format(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) return trimmed;
        String digits = trimmed.replaceAll("[^0-9]", "");
        if (digits.length() == 11) {
            return digits.substring(0, 3) + "-" + digits.substring(3, 7) + "-" + digits.substring(7);
        }
        if (digits.length() == 10) {
            return digits.substring(0, 3) + "-" + digits.substring(3, 6) + "-" + digits.substring(6);
        }
        return trimmed;
    }
}
