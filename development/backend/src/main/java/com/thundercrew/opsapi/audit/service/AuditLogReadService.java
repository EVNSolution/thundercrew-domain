package com.thundercrew.opsapi.audit.service;

import com.thundercrew.opsapi.audit.dto.AuditLogReadResponse;
import com.thundercrew.opsapi.audit.repository.AuditLogRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AuditLogReadService {

    private final AuditLogRepository auditLogRepository;

    public AuditLogReadService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public List<AuditLogReadResponse> listRecent() {
        return auditLogRepository.findTop100ByDeletedAtIsNullOrderByOccurredAtDesc().stream()
                .map(AuditLogReadResponse::from)
                .toList();
    }

    public List<AuditLogReadResponse> listByEntity(UUID entityId) {
        return auditLogRepository.findByEntityIdAndDeletedAtIsNullOrderByOccurredAtDesc(entityId).stream()
                .map(AuditLogReadResponse::from)
                .toList();
    }
}
