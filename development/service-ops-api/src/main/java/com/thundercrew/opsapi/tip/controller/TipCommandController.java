package com.thundercrew.opsapi.tip.controller;

import com.thundercrew.opsapi.tip.dto.TipCreateRequest;
import com.thundercrew.opsapi.tip.dto.TipReadResponse;
import com.thundercrew.opsapi.tip.dto.TipSubmissionCreateRequest;
import com.thundercrew.opsapi.tip.dto.TipUpdateRequest;
import com.thundercrew.opsapi.tip.service.TipCommandService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tips")
public class TipCommandController {

    private final TipCommandService tipCommandService;

    public TipCommandController(TipCommandService tipCommandService) {
        this.tipCommandService = tipCommandService;
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

    @PostMapping("/submissions")
    ResponseEntity<TipReadResponse> submit(@Valid @RequestBody TipSubmissionCreateRequest request) {
        TipReadResponse response = tipCommandService.submit(request);
        return ResponseEntity.created(URI.create("/api/v1/tips/" + response.id()))
                .body(response);
    }

    @PostMapping("/{id}/publish")
    TipReadResponse publish(@PathVariable UUID id) {
        return tipCommandService.publish(id);
    }
}
