package com.thundercrew.opsapi.dispatch.controller;

import com.thundercrew.opsapi.common.bulk.BulkApplyResponse;
import com.thundercrew.opsapi.dispatch.dto.DispatchBulkApplyRequest;
import com.thundercrew.opsapi.dispatch.dto.DispatchBulkPreviewResponse;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderCreateRequest;
import com.thundercrew.opsapi.dispatch.dto.DeliveryCallAcceptRequest;
import com.thundercrew.opsapi.dispatch.dto.DeliveryCallCreateRequest;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.service.DeliveryCallService;
import com.thundercrew.opsapi.dispatch.service.DispatchOrderBulkService;
import com.thundercrew.opsapi.dispatch.service.DispatchOrderCommandService;
import jakarta.validation.Valid;
import java.io.IOException;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/dispatch-orders")
public class DispatchOrderCommandController {

    private final DispatchOrderCommandService dispatchOrderCommandService;
    private final DispatchOrderBulkService dispatchOrderBulkService;
    private final DeliveryCallService deliveryCallService;

    public DispatchOrderCommandController(DispatchOrderCommandService dispatchOrderCommandService,
                                          DispatchOrderBulkService dispatchOrderBulkService,
                                          DeliveryCallService deliveryCallService) {
        this.dispatchOrderCommandService = dispatchOrderCommandService;
        this.dispatchOrderBulkService = dispatchOrderBulkService;
        this.deliveryCallService = deliveryCallService;
    }

    @PostMapping
    ResponseEntity<DispatchOrderReadResponse> create(@Valid @RequestBody DispatchOrderCreateRequest request) {
        DispatchOrderReadResponse response = dispatchOrderCommandService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/dispatch-orders/" + response.id()))
                .body(response);
    }

    @PostMapping("/{id}/complete")
    DispatchOrderReadResponse complete(@PathVariable UUID id) {
        return dispatchOrderCommandService.complete(id);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> cancel(@PathVariable UUID id) {
        dispatchOrderCommandService.cancel(id);
        return ResponseEntity.noContent().build();
    }

    /** Parse + validate an uploaded Excel; returns rows the frontend will geocode then apply. */
    @PostMapping("/bulk-preview")
    DispatchBulkPreviewResponse bulkPreview(@RequestPart("file") MultipartFile file) throws IOException {
        return dispatchOrderBulkService.preview(file.getInputStream());
    }

    /** Persist frontend-geocoded rows (JSON, not Excel). */
    @PostMapping("/bulk-apply")
    BulkApplyResponse bulkApply(@Valid @RequestBody DispatchBulkApplyRequest request) {
        return dispatchOrderBulkService.apply(request);
    }

    @PostMapping("/calls/system")
    DispatchOrderReadResponse systemCall(@Valid @RequestBody DeliveryCallCreateRequest request) {
        return deliveryCallService.systemDispatch(request.customerName(), request.customerPhone(),
                request.address(), request.latitude(), request.longitude());
    }

    @PostMapping("/calls/offer")
    DispatchOrderReadResponse offerCall(@Valid @RequestBody DeliveryCallCreateRequest request) {
        return deliveryCallService.offerCall(request.customerName(), request.customerPhone(),
                request.address(), request.latitude(), request.longitude());
    }

    @PostMapping("/calls/{id}/accept")
    DispatchOrderReadResponse acceptCall(@PathVariable UUID id,
                                         @Valid @RequestBody DeliveryCallAcceptRequest request) {
        return deliveryCallService.acceptCall(id, request.bikeId());
    }

    @GetMapping("/export")
    ResponseEntity<byte[]> export() throws IOException {
        byte[] bytes = dispatchOrderBulkService.export();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"dispatch-orders.xlsx\"")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(bytes);
    }
}
