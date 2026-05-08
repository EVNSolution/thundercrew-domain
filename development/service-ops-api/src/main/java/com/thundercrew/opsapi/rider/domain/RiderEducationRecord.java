package com.thundercrew.opsapi.rider.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * 라이더 교육 이력 1건. 한 라이더는 여러 교육 record 를 가질 수 있고, 정부
 * 점검에 대비해 수료증 번호 + 발급 기관 + 만료일 + 증빙 URL 을 함께 기록한다.
 * 라이더-도메인 안의 종속 테이블이지만 cross-domain FK 정책에 따라 외래 키는
 * 두지 않고 {@code rider_id} uuid 만 가진다.
 */
@Entity
@Table(name = "rider_education_records")
public class RiderEducationRecord extends DisplaySequencedEntity {

    @Column(name = "rider_id", nullable = false)
    private UUID riderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "education_type", nullable = false, length = 20)
    private RiderEducationType educationType;

    @Column(name = "course_name", length = 200)
    private String courseName;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "certificate_no", length = 100)
    private String certificateNo;

    @Column(name = "issuing_authority", length = 100)
    private String issuingAuthority;

    @Column(name = "evidence_url")
    private String evidenceUrl;

    @Column(name = "memo")
    private String memo;

    public static RiderEducationRecord create(
            UUID riderId,
            RiderEducationType educationType,
            String courseName,
            Instant completedAt,
            Instant expiresAt,
            String certificateNo,
            String issuingAuthority,
            String evidenceUrl,
            String memo
    ) {
        RiderEducationRecord record = new RiderEducationRecord();
        record.riderId = riderId;
        record.educationType = educationType;
        record.courseName = courseName;
        record.completedAt = completedAt;
        record.expiresAt = expiresAt;
        record.certificateNo = certificateNo;
        record.issuingAuthority = issuingAuthority;
        record.evidenceUrl = evidenceUrl;
        record.memo = memo;
        return record;
    }

    public void updateOperatorManagedFields(
            RiderEducationType educationType,
            String courseName,
            boolean completedAtProvided,
            Instant completedAt,
            boolean expiresAtProvided,
            Instant expiresAt,
            boolean certificateNoProvided,
            String certificateNo,
            String issuingAuthority,
            String evidenceUrl,
            String memo
    ) {
        if (educationType != null) {
            this.educationType = educationType;
        }
        if (courseName != null) {
            this.courseName = courseName;
        }
        if (completedAtProvided && completedAt != null) {
            this.completedAt = completedAt;
        }
        if (expiresAtProvided) {
            this.expiresAt = expiresAt;
        }
        if (certificateNoProvided) {
            this.certificateNo = certificateNo;
        }
        if (issuingAuthority != null) {
            this.issuingAuthority = issuingAuthority;
        }
        if (evidenceUrl != null) {
            this.evidenceUrl = evidenceUrl;
        }
        if (memo != null) {
            this.memo = memo;
        }
    }

    public void markDeletedNow(UUID actorId, Instant deletedAt) {
        markDeleted(actorId, deletedAt);
    }

    public UUID getRiderId() {
        return riderId;
    }

    public RiderEducationType getEducationType() {
        return educationType;
    }

    public String getCourseName() {
        return courseName;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public String getCertificateNo() {
        return certificateNo;
    }

    public String getIssuingAuthority() {
        return issuingAuthority;
    }

    public String getEvidenceUrl() {
        return evidenceUrl;
    }

    public String getMemo() {
        return memo;
    }

    protected RiderEducationRecord() {
    }
}
