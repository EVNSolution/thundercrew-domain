package com.thundercrew.opsapi.bike.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "bike_next_customer")
public class BikeNextCustomer {

    @Id
    @Column(name = "bike_id", nullable = false, updatable = false)
    private UUID bikeId;

    /** 다음 고객 이름. promote() 후 null. */
    @Column(name = "customer_name", length = 100)
    private String customerName;

    @Column(name = "customer_phone", length = 20)
    private String customerPhone;

    @Column(length = 500)
    private String address;

    /** Double (nullable) — promote() 후 null 허용. */
    @Column
    private Double latitude;

    @Column
    private Double longitude;

    /** 현재 고객 이름 (promote 시 next → current 복사). */
    @Column(name = "current_customer_name", length = 100)
    private String currentCustomerName;

    @Column(name = "current_customer_phone", length = 20)
    private String currentCustomerPhone;

    @Column(name = "current_customer_address", length = 500)
    private String currentCustomerAddress;

    @Column(name = "current_customer_lat")
    private Double currentCustomerLat;

    @Column(name = "current_customer_lng")
    private Double currentCustomerLng;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected BikeNextCustomer() {}

    public static BikeNextCustomer create(UUID bikeId, String customerName, String customerPhone,
                                           String address, double latitude, double longitude) {
        BikeNextCustomer e = new BikeNextCustomer();
        e.bikeId = bikeId;
        e.customerName = customerName;
        e.customerPhone = customerPhone;
        e.address = address;
        e.latitude = latitude;
        e.longitude = longitude;
        e.updatedAt = Instant.now();
        return e;
    }

    public void update(String customerName, String customerPhone,
                       String address, double latitude, double longitude) {
        this.customerName = customerName;
        this.customerPhone = customerPhone;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
        this.updatedAt = Instant.now();
    }

    /**
     * 다음 고객 → 현재 고객으로 승격.
     * next 필드를 null 로 초기화해 이후 PUT 이 들어올 때까지 다음 고객 없음 상태를 유지.
     * customerName 이 null 인 상태(이미 promote 완료)에서 재호출하면 no-op — 멱등성 보장.
     */
    public void promote() {
        if (this.customerName == null) return;
        this.currentCustomerName    = this.customerName;
        this.currentCustomerPhone   = this.customerPhone;
        this.currentCustomerAddress = this.address;
        this.currentCustomerLat     = this.latitude;
        this.currentCustomerLng     = this.longitude;
        this.customerName    = null;
        this.customerPhone   = null;
        this.address         = null;
        this.latitude        = null;
        this.longitude       = null;
        this.updatedAt       = Instant.now();
    }

    public UUID   getBikeId()                { return bikeId; }
    public String getCustomerName()          { return customerName; }
    public String getCustomerPhone()         { return customerPhone; }
    public String getAddress()               { return address; }
    public Double getLatitude()              { return latitude; }
    public Double getLongitude()             { return longitude; }
    public String getCurrentCustomerName()   { return currentCustomerName; }
    public String getCurrentCustomerPhone()  { return currentCustomerPhone; }
    public String getCurrentCustomerAddress(){ return currentCustomerAddress; }
    public Double getCurrentCustomerLat()    { return currentCustomerLat; }
    public Double getCurrentCustomerLng()    { return currentCustomerLng; }
    public Instant getUpdatedAt()            { return updatedAt; }
}
