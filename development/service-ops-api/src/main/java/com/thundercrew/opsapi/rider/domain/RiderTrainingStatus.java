package com.thundercrew.opsapi.rider.domain;

/**
 * 라이더의 교육 이수 상태. DB 컬럼({@code training_status})은 nullable 이며,
 * null 은 상태 미설정을 의미하고 대량 임포트 시 {@link #INCOMPLETE} 로 처리된다.
 */
public enum RiderTrainingStatus {
    /** 온라인 교육 이수 완료. */
    ONLINE,
    /** 오프라인 교육 이수 완료. */
    OFFLINE,
    /** 교육 미이수. */
    INCOMPLETE
}
