package com.thundercrew.opsapi.dispatch.controller;

import com.thundercrew.opsapi.dispatch.dto.DispatchRoundResponse;
import com.thundercrew.opsapi.dispatch.service.DispatchRoundService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dispatch-batches")
public class DispatchBatchReadController {

    private final DispatchRoundService dispatchRoundService;

    public DispatchBatchReadController(DispatchRoundService dispatchRoundService) {
        this.dispatchRoundService = dispatchRoundService;
    }

    /** 현재 활성 유모차 라운드 + 진척. 없으면 204. */
    @GetMapping("/active")
    ResponseEntity<DispatchRoundResponse> active() {
        return dispatchRoundService.activeRound()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
