package com.thundercrew.opsapi.otoplug;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration for the OTOPLUG NT observer integration. All values are sourced
 * from environment variables (see {@code application.properties}); credentials
 * intentionally default to blank so missing configuration fails loudly.
 */
@ConfigurationProperties(prefix = "thundercrew.otoplug")
public record OtoplugProperties(
        String serverUrl,
        String clientId,
        String securedCode,
        String channelToken,
        String callbackBaseUrl
) {
}
