package com.thundercrew.opsapi.insurance.domain;

/**
 * 보험 기본 기간 단위. 시간제 보험을 표현하기 위해 {@link #HOUR} 부터 시작한다는
 * 점이 {@code ContractDurationUnit} 과 다르다 (계약은 일 단위가 최소).
 */
public enum InsuranceDurationUnit {
    HOUR,
    DAY,
    WEEK,
    MONTH,
    QUARTER,
    HALF_YEAR,
    YEAR
}
