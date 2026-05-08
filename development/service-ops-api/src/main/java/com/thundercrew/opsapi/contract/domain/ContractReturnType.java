package com.thundercrew.opsapi.contract.domain;

/**
 * 계약 종료 시 차량 처분 방식.
 * <ul>
 *   <li>{@link #TAKEOVER} — 인수형. 라이더가 차량을 인수.</li>
 *   <li>{@link #RETURN} — 반납형. 라이더가 차량을 반납.</li>
 * </ul>
 * SUBSCRIPTION/RENTAL 카테고리에서는 필수, CUSTOM 에서는 선택.
 */
public enum ContractReturnType {
    TAKEOVER,
    RETURN
}
