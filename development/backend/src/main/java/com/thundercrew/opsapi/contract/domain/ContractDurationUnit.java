package com.thundercrew.opsapi.contract.domain;

/**
 * 계약 기간 단위. {@link ContractTemplate#getDurationValue()} 와 함께 쓰인다.
 *
 * <p>{@link #toMinutes(int)} 는 {@code duration_minutes} 호환 컬럼을 채우기 위한
 * derived 값. 분기는 90일, 반기는 180일, 년은 365일 기준 단순 환산이며 운영
 * 캘린더 기반의 정확한 만료 시점은 {@code RiderBikeContract.endAt} 단계에서
 * 계산한다 (계약 시점에 따른 윤년/월별 일수 보정).</p>
 */
public enum ContractDurationUnit {
    DAY(1440),
    WEEK(7 * 1440),
    MONTH(30 * 1440),
    QUARTER(90 * 1440),
    HALF_YEAR(180 * 1440),
    YEAR(365 * 1440);

    private final int minutesPerUnit;

    ContractDurationUnit(int minutesPerUnit) {
        this.minutesPerUnit = minutesPerUnit;
    }

    /**
     * 호환용 {@code duration_minutes} 값을 산출한다. value 가 {@code <= 0} 이면
     * {@code null} 을 반환해 호환 컬럼이 비어 있도록 둔다.
     */
    public Integer toMinutes(int value) {
        if (value <= 0) {
            return null;
        }
        return Math.toIntExact((long) minutesPerUnit * value);
    }
}
