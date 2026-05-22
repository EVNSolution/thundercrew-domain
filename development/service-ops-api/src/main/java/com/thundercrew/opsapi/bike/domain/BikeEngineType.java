package com.thundercrew.opsapi.bike.domain;

/**
 * 차량의 동력 종류. 정비 스케줄 catalog 매칭, 필터, KPI 분류의 기준 축이 되는
 * 차량 단위의 단순 분류. 모델명(`Bike.modelName`)은 자유 텍스트 메모로 유지하고
 * 이 enum 이 도메인 분기의 1차 키 역할.
 */
public enum BikeEngineType {
    /** 전기 이륜차. */
    ELECTRIC,
    /** 내연기관 이륜차. */
    ICE
}
