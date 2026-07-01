package com.thundercrew.opsapi.rider.controller;

import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.service.DeliveryCallService;
import com.thundercrew.opsapi.dispatch.service.DispatchOrderReadService;
import com.thundercrew.opsapi.maintenance.dto.MaintenanceItemReadResponse;
import com.thundercrew.opsapi.maintenance.dto.VehicleMaintenanceRecordReadResponse;
import com.thundercrew.opsapi.maintenance.service.MaintenanceReadService;
import com.thundercrew.opsapi.notification.dto.NotificationReadResponse;
import com.thundercrew.opsapi.notification.service.NotificationReadService;
import com.thundercrew.opsapi.rider.dto.RiderMaintenanceResponse;
import com.thundercrew.opsapi.rider.dto.RiderMeResponse;
import com.thundercrew.opsapi.rider.dto.RiderVehicleResponse;
import com.thundercrew.opsapi.rider.service.RiderSelfReadService;
import com.thundercrew.opsapi.rider.service.RiderVehicleReadService;
import com.thundercrew.opsapi.station.dto.BatteryStationReadResponse;
import com.thundercrew.opsapi.station.service.StationReadService;
import com.thundercrew.opsapi.tip.dto.TipReadResponse;
import com.thundercrew.opsapi.tip.service.TipReadService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rider")
public class RiderSelfReadController {

    private final RiderSelfReadService riderSelfReadService;
    private final DispatchOrderReadService dispatchOrderReadService;
    private final RiderVehicleReadService riderVehicleReadService;
    private final DeliveryCallService deliveryCallService;
    private final TipReadService tipReadService;
    private final StationReadService stationReadService;
    private final MaintenanceReadService maintenanceReadService;
    private final NotificationReadService notificationReadService;

    public RiderSelfReadController(
            RiderSelfReadService riderSelfReadService,
            DispatchOrderReadService dispatchOrderReadService,
            RiderVehicleReadService riderVehicleReadService,
            DeliveryCallService deliveryCallService,
            TipReadService tipReadService,
            StationReadService stationReadService,
            MaintenanceReadService maintenanceReadService,
            NotificationReadService notificationReadService
    ) {
        this.riderSelfReadService = riderSelfReadService;
        this.dispatchOrderReadService = dispatchOrderReadService;
        this.riderVehicleReadService = riderVehicleReadService;
        this.deliveryCallService = deliveryCallService;
        this.tipReadService = tipReadService;
        this.stationReadService = stationReadService;
        this.maintenanceReadService = maintenanceReadService;
        this.notificationReadService = notificationReadService;
    }

    @GetMapping("/me")
    RiderMeResponse me(@AuthenticationPrincipal Jwt jwt) {
        UUID riderId = UUID.fromString(jwt.getClaimAsString("riderId"));
        return riderSelfReadService.getMe(riderId);
    }

    @GetMapping("/me/dispatch-orders")
    List<DispatchOrderReadResponse> myDispatchOrders(@AuthenticationPrincipal Jwt jwt) {
        UUID riderId = UUID.fromString(jwt.getClaimAsString("riderId"));
        UUID bikeId = riderVehicleReadService.activeBikeIdOrNull(riderId);
        if (bikeId == null) {
            return List.of();
        }
        return dispatchOrderReadService.listAssignedByBike(bikeId);
    }

    @GetMapping("/me/dispatch-orders/completed")
    List<DispatchOrderReadResponse> myCompletedDispatchOrders(@AuthenticationPrincipal Jwt jwt) {
        UUID bikeId = riderVehicleReadService.activeBikeIdOrNull(riderId(jwt));
        return bikeId == null ? List.of() : dispatchOrderReadService.listCompletedByBike(bikeId);
    }

    @GetMapping("/me/offered-calls")
    List<DispatchOrderReadResponse> myOfferedCalls(@AuthenticationPrincipal Jwt jwt) {
        UUID bikeId = riderVehicleReadService.activeBikeIdOrNull(riderId(jwt));
        if (bikeId == null) return List.of();
        if (!riderVehicleReadService.isCallBike(bikeId)) return List.of();
        return deliveryCallService.listOffered();
    }

    @GetMapping("/me/tips")
    List<TipReadResponse> myTips() {
        return tipReadService.listPublished();
    }

    @GetMapping("/me/stations")
    List<BatteryStationReadResponse> myStations() {
        return stationReadService.listActive();
    }

    @GetMapping("/me/maintenance")
    RiderMaintenanceResponse myMaintenance(@AuthenticationPrincipal Jwt jwt) {
        UUID bikeId = riderVehicleReadService.activeBikeIdOrNull(riderId(jwt));
        if (bikeId == null) return new RiderMaintenanceResponse(List.of(), List.of());
        return new RiderMaintenanceResponse(
                maintenanceReadService.listItemsForBike(bikeId),
                maintenanceReadService.listRecordsForBike(bikeId));
    }

    @GetMapping("/me/notifications")
    List<NotificationReadResponse> myNotifications(@AuthenticationPrincipal Jwt jwt) {
        UUID rid = riderId(jwt);
        UUID bikeId = riderVehicleReadService.activeBikeIdOrNull(rid);
        return notificationReadService.listForRiderOrBike(rid, bikeId);
    }

    @GetMapping("/me/vehicle")
    RiderVehicleResponse myVehicle(@AuthenticationPrincipal Jwt jwt) {
        UUID riderId = UUID.fromString(jwt.getClaimAsString("riderId"));
        return riderVehicleReadService.getMyVehicle(riderId);
    }

    private static UUID riderId(Jwt jwt) {
        return UUID.fromString(jwt.getClaimAsString("riderId"));
    }
}
