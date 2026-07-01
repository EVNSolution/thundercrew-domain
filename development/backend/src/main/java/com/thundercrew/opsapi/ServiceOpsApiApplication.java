package com.thundercrew.opsapi;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ServiceOpsApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(ServiceOpsApiApplication.class, args);
	}

}
