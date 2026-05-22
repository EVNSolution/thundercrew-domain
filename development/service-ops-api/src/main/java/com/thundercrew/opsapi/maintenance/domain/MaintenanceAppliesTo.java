package com.thundercrew.opsapi.maintenance.domain;

/**
 * 정비 품목이 어떤 차종에 적용되는지. `BikeEngineType` 과 평행하지만 "둘 다"
 * 를 표현해야 해서 별도 enum.
 *
 * 차량별 카탈로그 조회 시: ELECTRIC 차량은 `ELECTRIC` + `BOTH` 를 합쳐서,
 * ICE 차량은 `ICE` + `BOTH` 를 합쳐서 노출한다.
 */
public enum MaintenanceAppliesTo {
    ELECTRIC,
    ICE,
    BOTH
}
