package com.thundercrew.opsapi.bike.domain;

/**
 * 차량의 서비스 유형. 배송(오토바이)과 클리닝(자동차)을 운영자 필터·알림 분기의
 * 기준 축으로 구분한다. engineType(동력 종류)과 직교하는 독립 분류.
 */
public enum BikeServiceType {
    /** 배송 서비스 (오토바이). 기존 차량의 기본값. */
    DELIVERY,
    /** 클리닝 서비스 (자동차). 세스코라이프케어 등. */
    CLEANING,
    /** 기타 서비스. */
    OTHER
}
