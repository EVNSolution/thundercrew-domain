package com.thundercrew.opsapi.maintenance.domain;

import com.thundercrew.opsapi.bike.domain.BikeEngineType;
import com.thundercrew.opsapi.bike.domain.BikeWheelType;

/**
 * 정비 품목이 적용되는 분류. (휠 × 동력) 교차곱이다.
 *
 * <p>260804 미팅으로 LPG 가 추가되어 4분류에서 <b>6분류</b>가 됐다.
 *
 * <p>차량에서 분류를 구하는 로직은 {@link #of(BikeWheelType, BikeEngineType)} 하나뿐이다.
 * 전에는 {@code MaintenanceReadService} 와 {@code MaintenanceAlarmEvaluator} 에 같은
 * 매핑이 복사돼 있었고 둘 다 {@code engine == ICE} 로 판정했다. 그 상태에서 LPG 를
 * 추가하면 LPG 차량이 조용히 ELECTRIC 분류로 떨어져 엔진오일 같은 품목이 목록에서
 * 사라진다. 오류가 아니라 누락으로 나타나므로 알아채기 어렵다. 그래서 한 곳으로 모았다.
 */
public enum MaintenanceCategory {
    TWO_WHEEL_ELECTRIC,
    TWO_WHEEL_ICE,
    TWO_WHEEL_LPG,
    FOUR_WHEEL_ELECTRIC,
    FOUR_WHEEL_ICE,
    FOUR_WHEEL_LPG;

    /**
     * 차량의 휠·동력으로 정비 분류를 정한다.
     *
     * <p>동력을 {@code switch} 로 받는다. 새 동력이 추가되면 컴파일이 실패해서
     * 여기를 고치도록 강제된다 — 조용히 기본값으로 떨어지지 않는다.
     */
    public static MaintenanceCategory of(BikeWheelType wheel, BikeEngineType engine) {
        boolean four = wheel == BikeWheelType.FOUR_WHEEL;
        return switch (engine) {
            case ELECTRIC -> four ? FOUR_WHEEL_ELECTRIC : TWO_WHEEL_ELECTRIC;
            case ICE -> four ? FOUR_WHEEL_ICE : TWO_WHEEL_ICE;
            case LPG -> four ? FOUR_WHEEL_LPG : TWO_WHEEL_LPG;
        };
    }
}
