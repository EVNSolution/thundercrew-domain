package com.thundercrew.opsapi;

import static org.assertj.core.api.Assertions.assertThatCode;

import java.util.List;

import org.junit.jupiter.api.Test;

class ScaffoldPackageSkeletonTests {

    @Test
    void boundedContextMarkerClassesExist() {
        List<String> markerClasses = List.of(
                "com.thundercrew.opsapi.auth.AuthPackage",
                "com.thundercrew.opsapi.rider.RiderPackage",
                "com.thundercrew.opsapi.bike.BikePackage",
                "com.thundercrew.opsapi.contract.ContractPackage",
                "com.thundercrew.opsapi.insurance.InsurancePackage",
                "com.thundercrew.opsapi.equipment.EquipmentPackage",
                "com.thundercrew.opsapi.device.DevicePackage",
                "com.thundercrew.opsapi.telemetry.TelemetryPackage",
                "com.thundercrew.opsapi.dashboard.DashboardPackage",
                "com.thundercrew.opsapi.integrity.IntegrityPackage",
                "com.thundercrew.opsapi.common.CommonPackage");

        markerClasses.forEach(className -> assertThatCode(() -> Class.forName(className))
                .as("%s should exist to make the scaffold boundary explicit", className)
                .doesNotThrowAnyException());
    }

    @Test
    void commonScaffoldClassesExist() {
        List<String> commonClasses = List.of(
                "com.thundercrew.opsapi.common.api.ApiErrorResponse",
                "com.thundercrew.opsapi.common.api.ErrorCode",
                "com.thundercrew.opsapi.common.api.GlobalExceptionHandler",
                "com.thundercrew.opsapi.common.domain.AuditableEntity",
                "com.thundercrew.opsapi.common.domain.SoftDeletableEntity",
                "com.thundercrew.opsapi.common.time.ApplicationClock");

        commonClasses.forEach(className -> assertThatCode(() -> Class.forName(className))
                .as("%s should exist as common scaffold baseline", className)
                .doesNotThrowAnyException());
    }
}
