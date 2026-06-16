package com.thundercrew.opsapi.audit.controller;

import com.thundercrew.opsapi.audit.dto.AuditLogCreateRequest;
import com.thundercrew.opsapi.audit.dto.AuditLogReadResponse;
import com.thundercrew.opsapi.audit.service.AuditLogCommandService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/audit-logs")
public class AuditLogCommandController {

    private final AuditLogCommandService auditLogCommandService;

    public AuditLogCommandController(AuditLogCommandService auditLogCommandService) {
        this.auditLogCommandService = auditLogCommandService;
    }

    @PostMapping
    ResponseEntity<AuditLogReadResponse> record(
            @Valid @RequestBody AuditLogCreateRequest req) {
        AuditLogReadResponse response = auditLogCommandService.record(req);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
