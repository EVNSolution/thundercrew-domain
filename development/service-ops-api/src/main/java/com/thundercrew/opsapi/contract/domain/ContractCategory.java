package com.thundercrew.opsapi.contract.domain;

/**
 * Business classification for a {@link ContractTemplate}. The legacy
 * {@code 무제한 계약} system template stays under {@link #CUSTOM} so that
 * pre-existing rows survive the migration without losing their semantics.
 */
public enum ContractCategory {
    /** 12개월 구독 (월 단위 12개월 고정). */
    SUBSCRIPTION,
    /** 일/주/월/분기/반기 단위 단기 렌탈. */
    RENTAL,
    /** 기존 운영자 정의 / 시스템 템플릿. */
    CUSTOM
}
