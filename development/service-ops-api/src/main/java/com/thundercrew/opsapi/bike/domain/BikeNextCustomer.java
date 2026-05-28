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

    @Column(name = "customer_name", nullable = false, length = 100)
    private String customerName;

    @Column(name = "customer_phone", nullable = false, length = 20)
    private String customerPhone;

    @Column(nullable = false, length = 500)
    private String address;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

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

    public UUID getBikeId()          { return bikeId; }
    public String getCustomerName()  { return customerName; }
    public String getCustomerPhone() { return customerPhone; }
    public String getAddress()       { return address; }
    public double getLatitude()      { return latitude; }
    public double getLongitude()     { return longitude; }
    public Instant getUpdatedAt()    { return updatedAt; }
}
