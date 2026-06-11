package com.thundercrew.opsapi.dispatch.controller;

import com.thundercrew.opsapi.dispatch.dto.DispatchOrderCreateRequest;
import com.thundercrew.opsapi.dispatch.dto.DispatchOrderReadResponse;
import com.thundercrew.opsapi.dispatch.service.DispatchOrderCommandService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dispatch-orders")
public class DispatchOrderCommandController {

    private final DispatchOrderCommandService dispatchOrderCommandService;

    public DispatchOrderCommandController(DispatchOrderCommandService dispatchOrderCommandService) {
        this.dispatchOrderCommandService = dispatchOrderCommandService;
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
}
