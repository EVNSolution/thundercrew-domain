package com.thundercrew.opsapi.dispatch.domain;

/**
 * 완료가 어떻게 기록됐는가 (V56). COMPLETED 이전에는 null.
 * 오판 정정(완료 되돌리기)·감사에서 자동/수동을 구분해야 한다.
 */
public enum CompletedSource {
    /** 텔레메트리 기반 자동 추정 — 목적지 반경 진입·정지 유지·이탈. */
    AUTO,
    /** 운영자 수동 완료 (사진 완료 포함). */
    MANUAL
}
