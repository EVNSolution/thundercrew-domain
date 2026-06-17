package com.thundercrew.opsapi.audit.service;

import com.thundercrew.opsapi.audit.domain.AuditLog;
import com.thundercrew.opsapi.audit.dto.AuditLogCreateRequest;
import com.thundercrew.opsapi.audit.dto.AuditLogReadResponse;
import com.thundercrew.opsapi.audit.repository.AuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AuditLogCommandService {

    private final AuditLogRepository auditLogRepository;

    public AuditLogCommandService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public AuditLogReadResponse record(AuditLogCreateRequest req) {
        AuditLog auditLog = AuditLog.create(
                req.entityType(),
                req.entityId(),
                req.field(),
                req.oldValue(),
                req.newValue(),
                null,
                java.time.Instant.now()
        );
        AuditLog saved = auditLogRepository.save(auditLog);
        return AuditLogReadResponse.from(saved);
    }
}
