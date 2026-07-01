package com.thundercrew.opsapi.maintenance.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * 차량별 정비 이벤트 한 건. 운영자가 차량 상세에서 "[엔진오일] 교환 완료" 를
 * 누를 때마다 row 가 추가된다.
 *
 * "다음 교환 예정 / 임박 / 지연" 은 서비스 코드가 이 record + 해당 item.cycle_*
 * 를 합쳐 derive — DB 컬럼으로는 안 두어 cycle 이 사후에 바뀌어도 자동 반영.
 *
 * `servicedAtOdometerKm` 는 운영자가 교환 시점에 알고 있다면 입력. odometer
 * 텔레메트리가 없는 현 상태에서 km 기준 품목의 정확한 카운팅을 위해 선택적
 * 입력 채널 제공.
 */
@Entity
@Table(name = "vehicle_maintenance_records")
public class VehicleMaintenanceRecord extends DisplaySequencedEntity {

    @Column(name = "bike_id", nullable = false)
    private UUID bikeId;

    @Column(name = "item_id", nullable = false)
    private UUID itemId;

    @Column(name = "serviced_at", nullable = false)
    private Instant servicedAt;

    @Column(name = "serviced_at_odometer_km")
    private Integer servicedAtOdometerKm;

    @Column
    private String memo;

    public static VehicleMaintenanceRecord create(
            UUID bikeId,
            UUID itemId,
            Instant servicedAt,
            Integer servicedAtOdometerKm,
            String memo
    ) {
        VehicleMaintenanceRecord record = new VehicleMaintenanceRecord();
        record.bikeId = bikeId;
        record.itemId = itemId;
        record.servicedAt = servicedAt;
        record.servicedAtOdometerKm = servicedAtOdometerKm;
        record.memo = memo;
        return record;
    }

    public UUID getBikeId() {
        return bikeId;
    }

    public UUID getItemId() {
        return itemId;
    }

    public Instant getServicedAt() {
        return servicedAt;
    }

    public Integer getServicedAtOdometerKm() {
        return servicedAtOdometerKm;
    }

    public String getMemo() {
        return memo;
    }

    protected VehicleMaintenanceRecord() {
    }
}
