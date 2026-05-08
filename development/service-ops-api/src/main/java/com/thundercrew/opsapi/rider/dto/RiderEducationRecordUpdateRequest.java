package com.thundercrew.opsapi.rider.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.thundercrew.opsapi.rider.domain.RiderEducationType;
import jakarta.validation.constraints.Size;
import java.time.Instant;

@JsonIgnoreProperties(ignoreUnknown = true)
public class RiderEducationRecordUpdateRequest {

    private RiderEducationType educationType;

    @Size(max = 200)
    private String courseName;

    private Instant completedAt;
    private boolean completedAtProvided;

    private Instant expiresAt;
    private boolean expiresAtProvided;

    @Size(max = 100)
    private String certificateNo;
    private boolean certificateNoProvided;

    @Size(max = 100)
    private String issuingAuthority;

    private String evidenceUrl;

    private String memo;

    public RiderEducationType educationType() {
        return educationType;
    }

    public void setEducationType(RiderEducationType educationType) {
        this.educationType = educationType;
    }

    public String courseName() {
        return courseName;
    }

    public void setCourseName(String courseName) {
        this.courseName = courseName;
    }

    public Instant completedAt() {
        return completedAt;
    }

    public boolean completedAtProvided() {
        return completedAtProvided;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
        this.completedAtProvided = true;
    }

    public Instant expiresAt() {
        return expiresAt;
    }

    public boolean expiresAtProvided() {
        return expiresAtProvided;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
        this.expiresAtProvided = true;
    }

    public String certificateNo() {
        return certificateNo;
    }

    public boolean certificateNoProvided() {
        return certificateNoProvided;
    }

    public void setCertificateNo(String certificateNo) {
        this.certificateNo = certificateNo;
        this.certificateNoProvided = true;
    }

    public String issuingAuthority() {
        return issuingAuthority;
    }

    public void setIssuingAuthority(String issuingAuthority) {
        this.issuingAuthority = issuingAuthority;
    }

    public String evidenceUrl() {
        return evidenceUrl;
    }

    public void setEvidenceUrl(String evidenceUrl) {
        this.evidenceUrl = evidenceUrl;
    }

    public String memo() {
        return memo;
    }

    public void setMemo(String memo) {
        this.memo = memo;
    }
}
