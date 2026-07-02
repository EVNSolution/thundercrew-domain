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
                req.entityType(), req.entityId(), req.field(),
                req.oldValue(), req.newValue(), currentActor(), java.time.Instant.now());
        return AuditLogReadResponse.from(auditLogRepository.save(auditLog));
    }

    /** 서버사이드 감사 기록(command 서비스용). actor는 인증 컨텍스트에서 자동. */
    public void log(String entityType, java.util.UUID entityId, String field, String oldValue, String newValue) {
        auditLogRepository.save(AuditLog.create(
                entityType, entityId, field, oldValue, newValue, currentActor(), java.time.Instant.now()));
    }

    /**
     * 현재 인증 관리자 식별자. 사람이 읽는 loginId(JWT loginId 클레임)를 우선 사용하고,
     * 없으면 JWT subject(=admin UUID)로 폴백. 미인증/익명이면 null.
     */
    private String currentActor() {
        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) {
            return null;
        }
        if (auth.getPrincipal() instanceof org.springframework.security.oauth2.jwt.Jwt jwt) {
            String loginId = jwt.getClaimAsString("loginId");
            if (loginId != null && !loginId.isBlank()) {
                return loginId;
            }
        }
        return auth.getName();
    }
}
