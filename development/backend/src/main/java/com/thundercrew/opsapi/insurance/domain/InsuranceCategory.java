package com.thundercrew.opsapi.insurance.domain;

/**
 * 보험 분류.
 * <ul>
 *   <li>{@link #PRIMARY} — 메인 보험 (유상운송종합/책임 등 12개월 단위).</li>
 *   <li>{@link #ADDON} — 부가 보험 (시간제/원데이 등 짧은 기간, 다중 발급 가능).</li>
 * </ul>
 */
public enum InsuranceCategory {
    PRIMARY,
    ADDON
}
