package com.thundercrew.opsapi.rider.dto;

import com.thundercrew.opsapi.maintenance.dto.MaintenanceItemReadResponse;
import com.thundercrew.opsapi.maintenance.dto.VehicleMaintenanceRecordReadResponse;
import java.util.List;

public record RiderMaintenanceResponse(
        List<MaintenanceItemReadResponse> items,
        List<VehicleMaintenanceRecordReadResponse> records
) {}
