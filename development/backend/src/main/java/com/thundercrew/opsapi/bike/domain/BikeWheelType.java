package com.thundercrew.opsapi.bike.domain;

/**
 * 차량의 바퀴 수 분류. 이륜·사륜 구분을 나타내며 정비 정책, 필터,
 * KPI 분류의 기준 축이 되는 차량 단위의 단순 분류.
 */
public enum BikeWheelType {
    /** 2륜 차량. */
    TWO_WHEEL,
    /** 4륜 차량. */
    FOUR_WHEEL
}
