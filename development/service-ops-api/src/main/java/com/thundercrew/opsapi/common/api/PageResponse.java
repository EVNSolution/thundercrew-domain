package com.thundercrew.opsapi.common.api;

import java.util.List;
import org.springframework.data.domain.Page;

public record PageResponse<T>(
        List<T> items,
        PageMetadata page
) {
    public static <T> PageResponse<T> of(Page<T> page) {
        return new PageResponse<>(
                page.getContent(),
                new PageMetadata(
                        page.getNumber(),
                        page.getSize(),
                        page.getTotalElements(),
                        page.getTotalPages(),
                        page.hasNext(),
                        page.hasPrevious()
                )
        );
    }

    public record PageMetadata(
            int number,
            int size,
            long totalItems,
            int totalPages,
            boolean hasNext,
            boolean hasPrevious
    ) {
    }
}
