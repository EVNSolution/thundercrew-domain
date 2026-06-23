package com.thundercrew.opsapi.common.bulk;

/** 관리구분(삭제 표시) 열 해석 헬퍼. */
public final class BulkActionColumn {
    private BulkActionColumn() {}

    public static final String DELETE_TOKEN = "삭제";

    /** 빈 값/미입력 = upsert(false), "삭제" = 삭제(true). */
    public static boolean isDelete(String raw) {
        return raw != null && DELETE_TOKEN.equals(raw.trim());
    }

    /** 빈 값도 아니고 "삭제"도 아닌 잘못된 값인지. */
    public static boolean isInvalid(String raw) {
        if (raw == null) return false;
        String t = raw.trim();
        return !t.isEmpty() && !DELETE_TOKEN.equals(t);
    }
}
