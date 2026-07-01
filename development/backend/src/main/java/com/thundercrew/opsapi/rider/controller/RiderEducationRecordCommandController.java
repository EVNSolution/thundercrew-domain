package com.thundercrew.opsapi.rider.controller;

import com.thundercrew.opsapi.rider.dto.RiderEducationRecordCreateRequest;
import com.thundercrew.opsapi.rider.dto.RiderEducationRecordReadResponse;
import com.thundercrew.opsapi.rider.dto.RiderEducationRecordUpdateRequest;
import com.thundercrew.opsapi.rider.service.RiderEducationRecordCommandService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/rider-education-records")
public class RiderEducationRecordCommandController {

    private final RiderEducationRecordCommandService commandService;

    public RiderEducationRecordCommandController(RiderEducationRecordCommandService commandService) {
        this.commandService = commandService;
    }

    @PostMapping
    ResponseEntity<RiderEducationRecordReadResponse> create(
            @Valid @RequestBody RiderEducationRecordCreateRequest request
    ) {
        RiderEducationRecordReadResponse response = commandService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/rider-education-records/" + response.id()))
                .body(response);
    }

    @PatchMapping("/{id}")
    RiderEducationRecordReadResponse update(
            @PathVariable UUID id,
            @Valid @RequestBody RiderEducationRecordUpdateRequest request
    ) {
        return commandService.update(id, request);
    }

    @DeleteMapping("/{id}")
    ResponseEntity<Void> delete(@PathVariable UUID id) {
        commandService.softDelete(id);
        return ResponseEntity.noContent().build();
    }
}
