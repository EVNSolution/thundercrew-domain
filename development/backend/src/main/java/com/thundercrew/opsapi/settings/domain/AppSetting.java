package com.thundercrew.opsapi.settings.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * 운영 설정 key-value (V65). 행이 없는 키는 코드 기본값(@Value)으로 폴백한다.
 * 대상은 §6 운영 기준값 — 클리닝 기본 소요·임박 리드·완료 추정 반경/정지시간.
 */
@Entity
@Table(name = "app_settings")
public class AppSetting {

    @Id
    @Column(name = "setting_key")
    private String key;

    @Column(name = "setting_value", nullable = false)
    private String value;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by")
    private UUID updatedBy;

    public static AppSetting of(String key, String value, Instant now, UUID updatedBy) {
        AppSetting setting = new AppSetting();
        setting.key = key;
        setting.value = value;
        setting.updatedAt = now;
        setting.updatedBy = updatedBy;
        return setting;
    }

    public void update(String value, Instant now, UUID updatedBy) {
        this.value = value;
        this.updatedAt = now;
        this.updatedBy = updatedBy;
    }

    public String getKey() {
        return key;
    }

    public String getValue() {
        return value;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    protected AppSetting() {
    }
}
