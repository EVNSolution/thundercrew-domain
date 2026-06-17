package com.thundercrew.opsapi.maintenance.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.util.HashSet;
import java.util.Set;

/**
 * 정비 품목 카탈로그 row. "엔진오일", "브레이크 패드(앞)" 같은 한 줄에 해당한다.
 *
 * 적용 차종은 단일 다중값 분류(MaintenanceCategory) 로 표현.
 * 한 품목이 여러 카테고리에 속할 수 있다 (예: 브레이크 패드 = 전 4분류).
 * 차량 단위 조회 시 해당 차량의 1개 카테고리로 join 필터.
 */
@Entity
@Table(name = "maintenance_items")
public class MaintenanceItem extends DisplaySequencedEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "maintenance_item_categories",
            joinColumns = @JoinColumn(name = "maintenance_item_id"))
    @Column(name = "category")
    @Enumerated(EnumType.STRING)
    private Set<MaintenanceCategory> categories = new HashSet<>();

    @Column(name = "cycle_km")
    private Integer cycleKm;

    @Column(name = "cycle_months")
    private Integer cycleMonths;

    @Column
    private String memo;

    @Column(name = "alert_threshold_percent")
    private Integer alertThresholdPercent;

    public static MaintenanceItem create(
            String name,
            Set<MaintenanceCategory> categories,
            Integer cycleKm,
            Integer cycleMonths,
            String memo,
            Integer alertThresholdPercent
    ) {
        MaintenanceItem item = new MaintenanceItem();
        item.name = name;
        item.categories = new HashSet<>(categories);
        item.cycleKm = cycleKm;
        item.cycleMonths = cycleMonths;
        item.memo = memo;
        item.alertThresholdPercent = alertThresholdPercent;
        return item;
    }

    public void updateCatalog(
            String name,
            Set<MaintenanceCategory> categories,
            Integer cycleKm,
            Integer cycleMonths,
            String memo,
            Integer alertThresholdPercent
    ) {
        if (name != null) {
            this.name = name;
        }
        if (categories != null && !categories.isEmpty()) {
            this.categories = new HashSet<>(categories);
        }
        this.cycleKm = cycleKm;
        this.cycleMonths = cycleMonths;
        if (memo != null) {
            this.memo = memo;
        }
        this.alertThresholdPercent = alertThresholdPercent;
    }

    public String getName() {
        return name;
    }

    public Set<MaintenanceCategory> getCategories() {
        return categories;
    }

    public Integer getCycleKm() {
        return cycleKm;
    }

    public Integer getCycleMonths() {
        return cycleMonths;
    }

    public String getMemo() {
        return memo;
    }

    public Integer getAlertThresholdPercent() {
        return alertThresholdPercent;
    }

    protected MaintenanceItem() {
    }
}
