package com.thundercrew.opsapi.maintenance.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;

/**
 * 정비 품목 카탈로그 row. "엔진오일", "브레이크 패드(앞)" 같은 한 줄에 해당한다.
 *
 * 그룹(예: 구동계3종) 표현은 `parentItemId` 셀프-FK 로. 부모 자체는 cycle 이
 * 없고, 자식들이 각각 cycle 을 보유한다. UI 는 부모를 카드 헤더로 묶고 자식
 * 세 개를 그 안에 펼친다.
 *
 * 단위 혼재: km / 개월 / 자유 텍스트 셋이 동시 보유 가능. UI 우선순위는
 * 자유 텍스트(cycle_label) → km → 개월 순으로 표시.
 */
@Entity
@Table(name = "maintenance_items")
public class MaintenanceItem extends DisplaySequencedEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "applies_to", nullable = false, length = 20)
    private MaintenanceAppliesTo appliesTo;

    @Column(name = "parent_item_id")
    private UUID parentItemId;

    @Column(name = "cycle_km")
    private Integer cycleKm;

    @Column(name = "cycle_months")
    private Integer cycleMonths;

    @Column(name = "cycle_label", length = 50)
    private String cycleLabel;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(nullable = false)
    private boolean enabled;

    @Column
    private String memo;

    public static MaintenanceItem create(
            String name,
            MaintenanceAppliesTo appliesTo,
            UUID parentItemId,
            Integer cycleKm,
            Integer cycleMonths,
            String cycleLabel,
            int displayOrder,
            String memo
    ) {
        MaintenanceItem item = new MaintenanceItem();
        item.name = name;
        item.appliesTo = appliesTo;
        item.parentItemId = parentItemId;
        item.cycleKm = cycleKm;
        item.cycleMonths = cycleMonths;
        item.cycleLabel = cycleLabel;
        item.displayOrder = displayOrder;
        item.enabled = true;
        item.memo = memo;
        return item;
    }

    public void updateCatalog(
            String name,
            MaintenanceAppliesTo appliesTo,
            UUID parentItemId,
            Integer cycleKm,
            Integer cycleMonths,
            String cycleLabel,
            Integer displayOrder,
            Boolean enabled,
            String memo
    ) {
        if (name != null) {
            this.name = name;
        }
        if (appliesTo != null) {
            this.appliesTo = appliesTo;
        }
        // parentItemId / cycle 들은 명시적으로 null 로 보내는 케이스(그룹 분리,
        // cycle 변경 등) 가 있으므로 null 도 그대로 수용. 호출 측이 partial
        // update 를 원하면 wrapper(Optional) 패턴이 필요하나 운영자 편집 화면이
        // 항상 전체 필드를 보내는 가정 하에 단순화.
        this.parentItemId = parentItemId;
        this.cycleKm = cycleKm;
        this.cycleMonths = cycleMonths;
        this.cycleLabel = cycleLabel;
        if (displayOrder != null) {
            this.displayOrder = displayOrder;
        }
        if (enabled != null) {
            this.enabled = enabled;
        }
        if (memo != null) {
            this.memo = memo;
        }
    }

    public String getName() {
        return name;
    }

    public MaintenanceAppliesTo getAppliesTo() {
        return appliesTo;
    }

    public UUID getParentItemId() {
        return parentItemId;
    }

    public Integer getCycleKm() {
        return cycleKm;
    }

    public Integer getCycleMonths() {
        return cycleMonths;
    }

    public String getCycleLabel() {
        return cycleLabel;
    }

    public int getDisplayOrder() {
        return displayOrder;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public String getMemo() {
        return memo;
    }

    protected MaintenanceItem() {
    }
}
