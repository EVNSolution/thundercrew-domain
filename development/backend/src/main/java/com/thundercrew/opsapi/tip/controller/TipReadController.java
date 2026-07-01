package com.thundercrew.opsapi.tip.controller;

import com.thundercrew.opsapi.common.api.PageResponse;
import com.thundercrew.opsapi.tip.dto.TipReadResponse;
import com.thundercrew.opsapi.tip.service.TipReadService;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tips")
public class TipReadController {

    private final TipReadService tipReadService;

    public TipReadController(TipReadService tipReadService) {
        this.tipReadService = tipReadService;
    }

    @GetMapping
    PageResponse<TipReadResponse> listTips(@PageableDefault(size = 20, sort = "idx", direction = Sort.Direction.ASC) Pageable pageable) {
        return tipReadService.listTips(pageable);
    }

    @GetMapping("/{id}")
    TipReadResponse getTip(@PathVariable UUID id) {
        return tipReadService.getTip(id);
    }
}
