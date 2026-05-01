package com.thundercrew.opsapi.equipment.domain;

import java.time.LocalDate;

public enum BikeEquipmentManagementStatus {
    NORMAL,
    DUE_SOON,
    OVERDUE;

    public static BikeEquipmentManagementStatus from(LocalDate managementDueDate, LocalDate today) {
        if (managementDueDate.isBefore(today)) {
            return OVERDUE;
        }
        if (!managementDueDate.isAfter(today.plusDays(7))) {
            return DUE_SOON;
        }
        return NORMAL;
    }
}
