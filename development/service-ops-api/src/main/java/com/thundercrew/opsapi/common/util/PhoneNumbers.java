package com.thundercrew.opsapi.common.util;

public final class PhoneNumbers {
    private PhoneNumbers() {}

    /**
     * 한국 전화번호를 대시 포맷으로 정규화한다. 숫자만 추출 후:
     *  - 11자리: XXX-XXXX-XXXX (휴대폰)
     *  - 10자리: XXX-XXX-XXXX
     *  - 그 외: 원본을 trim 해서 그대로 반환(알 수 없는 형식은 건드리지 않음).
     * null/blank 는 그대로 반환.
     *
     * 엑셀에서 휴대폰 번호가 숫자로 인식돼 선행 0이 사라진 경우(예: 01041775801 →
     * 1041775801)를 복구한다. 한국 전화번호 중 "10"으로 시작하는 10자리는 존재하지 않으므로
     * (지역번호·휴대폰 모두 0으로 시작) "10"으로 시작하는 10자리는 010 휴대폰의 0 누락으로 보고
     * 0을 복원한다.
     */
    public static String format(String raw) {
        if (raw == null) return null;
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) return trimmed;
        String digits = trimmed.replaceAll("[^0-9]", "");
        if (digits.length() == 10 && digits.startsWith("10")) {
            digits = "0" + digits;
        }
        if (digits.length() == 11) {
            return digits.substring(0, 3) + "-" + digits.substring(3, 7) + "-" + digits.substring(7);
        }
        if (digits.length() == 10) {
            return digits.substring(0, 3) + "-" + digits.substring(3, 6) + "-" + digits.substring(6);
        }
        return trimmed;
    }
}
