package com.thundercrew.opsapi.otoplug.controller;

import com.thundercrew.opsapi.otoplug.dto.OtoplugObserverStatusResponse;
import com.thundercrew.opsapi.otoplug.service.OtoplugObserverService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/otoplug/observers")
public class OtoplugObserverController {

    private final OtoplugObserverService service;

    public OtoplugObserverController(OtoplugObserverService service) {
        this.service = service;
    }

    @PostMapping("/register")
    OtoplugObserverStatusResponse register() {
        return service.register();
    }

    @PostMapping("/ignore")
    OtoplugObserverStatusResponse ignore() {
        return service.ignore();
    }

    @GetMapping
    OtoplugObserverStatusResponse status() {
        return service.status();
    }
}
