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
    ICE,
    /**
     * LPG 차량. 260804 미팅으로 추가됐다.
     *
     * 정비 관점에서는 ICE 와 같은 계열이다 — 연소기관이라 엔진오일·점화 계통을
     * 공유한다. 다만 봄베 검사처럼 LPG 에만 있는 품목이 있어서 분류를 따로 둔다
     * ({@code MaintenanceCategory}).
     */
    LPG
}
