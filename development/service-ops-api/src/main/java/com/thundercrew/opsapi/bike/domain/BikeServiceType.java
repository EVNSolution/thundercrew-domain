package com.thundercrew.opsapi.bike.domain;

/**
 * 차량 운영 방식. 배차가 동작하는 방식으로 차량을 분류한다(필터·알림·시뮬 분기 축).
 */
public enum BikeServiceType {
    /** 콜 배차 — 단건 콜, 라이더 수락/시스템 자동 배차. */
    CALL,
    /** 단일 배차 — 목적지 1개 단순 배차. */
    SINGLE,
    /** 순차 배차 — 목적지 + 순서 큐. */
    SEQUENTIAL,
    /** 왕복 배차 — 일괄 수거 → 배송 2단계. */
    ROUND,
    /** 기타. */
    OTHER;

    /** 시동 알림·청소형 시뮬 대상(순차·왕복). */
    public boolean isCleaningFamily() {
        return this == SEQUENTIAL || this == ROUND;
    }

    /** 배송형 시뮬·시스템 배차 후보(콜·단일·기타). */
    public boolean isDeliveryFamily() {
        return !isCleaningFamily();
    }
}
