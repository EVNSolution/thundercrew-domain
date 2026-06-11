package com.thundercrew.opsapi.tip.controller;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.tip.dto.TipCreateRequest;
import com.thundercrew.opsapi.tip.dto.TipReadResponse;
import com.thundercrew.opsapi.tip.dto.TipUpdateRequest;
import com.thundercrew.opsapi.tip.service.TipCommandService;
import com.thundercrew.opsapi.tip.service.TipReadService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tips")
public class TipController {

    private final TipReadService tipReadService;
    private final TipCommandService tipCommandService;

    public TipController(TipReadService tipReadService, TipCommandService tipCommandService) {
        this.tipReadService = tipReadService;
        this.tipCommandService = tipCommandService;
    }

    @GetMapping
    PageResponse<TipReadResponse> listTips(@PageableDefault(size = 20, sort = "idx", direction = Sort.Direction.ASC) Pageable pageable) {
        return tipReadService.listTips(pageable);
    }

    @GetMapping("/{id}")
    TipReadResponse getTip(@PathVariable UUID id) {
        return tipReadService.getTip(id);
    }

    @PostMapping
    ResponseEntity<TipReadResponse> create(@Valid @RequestBody TipCreateRequest request) {
        TipReadResponse response = tipCommandService.createTip(request);
        return ResponseEntity.created(URI.create("/api/v1/tips/" + response.id()))
                .body(response);
    }

    @PutMapping("/{id}")
    TipReadResponse update(@PathVariable UUID id, @Valid @RequestBody TipUpdateRequest request) {
        return tipCommandService.updateTip(id, request);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        tipCommandService.deleteTip(id);
        return ResponseEntity.noContent().build();
    }
}
