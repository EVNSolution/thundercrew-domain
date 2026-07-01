package com.thundercrew.opsapi.dispatch.controller;

import com.thundercrew.opsapi.dispatch.dto.DispatchBulkApplyRequest;
import com.thundercrew.opsapi.dispatch.dto.DispatchRoundResponse;
import com.thundercrew.opsapi.dispatch.service.DispatchRoundService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dispatch-batches")
public class DispatchBatchCommandController {

    private final DispatchRoundService dispatchRoundService;

    public DispatchBatchCommandController(DispatchRoundService dispatchRoundService) {
        this.dispatchRoundService = dispatchRoundService;
    }

    /** 새 라운드 생성(프론트 지오코딩 완료 행, JSON). */
    @PostMapping("/round")
    DispatchRoundResponse createRound(@Valid @RequestBody DispatchBulkApplyRequest request) {
        return dispatchRoundService.createRound(request);
    }

    @PostMapping("/{id}/start-delivery")
    DispatchRoundResponse startDelivery(@PathVariable UUID id) {
        return dispatchRoundService.startDelivery(id);
    }
}
