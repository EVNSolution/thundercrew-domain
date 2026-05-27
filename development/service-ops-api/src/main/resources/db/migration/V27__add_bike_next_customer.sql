create table bike_next_customer (
    bike_id        uuid             primary key references bikes(id),
    customer_name  varchar(100)     not null,
    customer_phone varchar(20)      not null,
    address        varchar(500)     not null,
    latitude       double precision not null,
    longitude      double precision not null,
    updated_at     timestamptz      not null
);
