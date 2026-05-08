package com.thundercrew.opsapi.insurance.domain;

/**
 * 보장 유형. 운영자가 보험을 분류·검색하는 기준이며, 정부/감독 보고서에서도
 * 이 enum 값을 그대로 보여줄 수 있도록 명시적 enum 으로 둔다.
 */
public enum InsuranceCoverageType {
    /** 유상운송종합보험 — 메인 12개월. */
    GENERAL_PAID_TRANSPORT,
    /** 유상운송책임보험 — 메인 12개월. */
    LIABILITY_PAID_TRANSPORT,
    /** 시간제보험 — 시간 단위 부가. */
    HOURLY,
    /** 원데이보험 — 하루 단위 부가. */
    ONE_DAY,
    /** 분류되지 않은 기타. */
    OTHER
}
