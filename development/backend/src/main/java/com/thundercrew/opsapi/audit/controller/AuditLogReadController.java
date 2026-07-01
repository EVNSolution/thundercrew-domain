package com.thundercrew.opsapi.audit.controller;

import com.thundercrew.opsapi.audit.dto.AuditLogReadResponse;
import com.thundercrew.opsapi.audit.service.AuditLogReadService;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/audit-logs")
public class AuditLogReadController {

    private final AuditLogReadService auditLogReadService;

    public AuditLogReadController(AuditLogReadService auditLogReadService) {
        this.auditLogReadService = auditLogReadService;
    }

    @GetMapping
    List<AuditLogReadResponse> list(@RequestParam(required = false) UUID entityId) {
        if (entityId != null) {
            return auditLogReadService.listByEntity(entityId);
        }
        return auditLogReadService.listRecent();
    }
}
