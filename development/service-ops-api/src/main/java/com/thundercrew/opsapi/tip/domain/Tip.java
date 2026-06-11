package com.thundercrew.opsapi.tip.domain;

import com.thundercrew.opsapi.common.domain.DisplaySequencedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "tips")
public class Tip extends DisplaySequencedEntity {

    @Column(nullable = false, columnDefinition = "text")
    private String address;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    public static Tip create(String address, String content, double latitude, double longitude) {
        Tip tip = new Tip();
        tip.address = address;
        tip.content = content;
        tip.latitude = latitude;
        tip.longitude = longitude;
        return tip;
    }

    public void update(String address, String content, double latitude, double longitude) {
        this.address = address;
        this.content = content;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public String getAddress() {
        return address;
    }

    public String getContent() {
        return content;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    protected Tip() {
    }
}
