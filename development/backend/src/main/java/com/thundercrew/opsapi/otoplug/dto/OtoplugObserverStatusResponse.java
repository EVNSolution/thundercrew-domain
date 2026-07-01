package com.thundercrew.opsapi.otoplug.dto;

import java.util.List;

public record OtoplugObserverStatusResponse(boolean active, List<String> registeredApis) {
}
