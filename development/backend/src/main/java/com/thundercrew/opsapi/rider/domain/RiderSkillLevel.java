package com.thundercrew.opsapi.rider.domain;

/**
 * 숙련도. 260804 미팅 요구사항 — "초보/고수 등 기입".
 *
 * <p>배차 우선순위나 교육 대상 선정의 근거로 쓸 수 있는 운영자 판단값이다.
 * 자동으로 계산하지 않는다 — 실적에서 뽑으려면 무엇을 실적으로 볼지부터 정해야 하고,
 * 미팅은 "기입"이라고 했다.
 *
 * <p>값이 없는 상태(null)를 허용한다. 판단하지 않은 것과 초보인 것은 다르다.
 */
public enum RiderSkillLevel {
    /** 초보. */
    BEGINNER,
    /** 고수. */
    EXPERT
}
