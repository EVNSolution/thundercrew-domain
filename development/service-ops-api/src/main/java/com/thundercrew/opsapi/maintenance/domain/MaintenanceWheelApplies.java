package com.thundercrew.opsapi.maintenance.domain;

/** 정비 항목의 휠타입 적용 축. 엔진 축(MaintenanceAppliesTo)과 직교. */
public enum MaintenanceWheelApplies {
    TWO_WHEEL,   // 2륜 전용
    FOUR_WHEEL,  // 4륜 전용
    BOTH         // 공통(양쪽)
}
