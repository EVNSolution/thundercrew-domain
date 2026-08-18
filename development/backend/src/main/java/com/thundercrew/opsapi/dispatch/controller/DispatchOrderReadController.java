package com.thundercrew.opsapi.dispatch.controller;

import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.service.DeliveryCallService;
import com.thundercrew.opsapi.dispatch.service.DispatchOrderReadService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dispatch-orders")
public class DispatchOrderReadController {

    private final DispatchOrderReadService dispatchOrderReadService;
    private final DeliveryCallService deliveryCallService;

    public DispatchOrderReadController(DispatchOrderReadService dispatchOrderReadService,
                                       DeliveryCallService deliveryCallService) {
        this.dispatchOrderReadService = dispatchOrderReadService;
        this.deliveryCallService = deliveryCallService;
    }

    @GetMapping
    List<DispatchOrderReadResponse> listByBike(@RequestParam UUID bikeId) {
        return dispatchOrderReadService.listByBike(bikeId);
    }

    /** 배송 상태 탭 / 모니터: 활성(ASSIGNED) 배차. includeCompleted=true 면 당일 완료도 포함. */
    @GetMapping("/active")
    List<DispatchOrderReadResponse> activeOrders(
            @RequestParam(name = "includeCompleted", defaultValue = "false") boolean includeCompleted) {
        return includeCompleted
                ? dispatchOrderReadService.listActiveWithTodayCompleted()
                : dispatchOrderReadService.listActiveAssigned();
    }

    /** 클리닝 일정표 — 예정 시각 범위 [from, to) 의 시간 배차 전건. */
    @GetMapping("/schedule")
    List<DispatchOrderReadResponse> schedule(
            @RequestParam java.time.Instant from,
            @RequestParam java.time.Instant to) {
        return dispatchOrderReadService.listSchedule(from, to);
    }

    @GetMapping("/calls/offered")
    List<DispatchOrderReadResponse> offeredCalls() {
        return deliveryCallService.listOffered();
    }

    @GetMapping("/completed")
    List<DispatchOrderReadResponse> completedByBike(@RequestParam UUID bikeId) {
        return dispatchOrderReadService.listCompletedByBike(bikeId);
    }

    @GetMapping("/{id}/completion-photo")
    ResponseEntity<byte[]> completionPhoto(@PathVariable UUID id) {
        var order = dispatchOrderReadService.findOrderForPhoto(id);
        byte[] photo = order.getCompletionPhoto();
        if (photo == null || photo.length == 0) {
            return ResponseEntity.notFound().build();
        }
        String contentType = order.getCompletionPhotoContentType();
        if (contentType == null || contentType.isBlank()) {
            contentType = "image/jpeg";
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .body(photo);
    }
}
