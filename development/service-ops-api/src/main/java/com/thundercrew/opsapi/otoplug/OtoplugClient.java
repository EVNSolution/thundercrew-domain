package com.thundercrew.opsapi.otoplug;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Thin HTTP client for the OTOPLUG NT (notification) API. Handles the two-step
 * authentication flow, caches the bearer token, and registers / ignores
 * observers. See {@code scripts/otoplug/OTOPLUG_NT_API.md} for the wire shapes.
 */
@Component
public class OtoplugClient {

    private static final Duration TOKEN_TTL = Duration.ofMinutes(60);
    private static final Duration TOKEN_REFRESH_MARGIN = Duration.ofMinutes(5);
    private static final String OBSERVER_TYPE = "otoplug-api@notification";

    private final OtoplugProperties properties;
    private final RestClient restClient;

    private String cachedToken;
    private Instant tokenExpiresAt = Instant.MIN;

    public OtoplugClient(OtoplugProperties properties) {
        this.properties = properties;
        this.restClient = RestClient.builder()
                .baseUrl(properties.serverUrl())
                .build();
    }

    /**
     * Returns a bearer token, reusing the cached value until it is close to
     * expiry. Performs the OTOPLUG two-step auth handshake when a refresh is
     * needed.
     */
    public synchronized String authenticate() {
        requireCredentials();
        Instant now = Instant.now();
        if (cachedToken != null && now.isBefore(tokenExpiresAt.minus(TOKEN_REFRESH_MARGIN))) {
            return cachedToken;
        }

        String authorizeCode = requestAuthorizeCode();
        String token = requestToken(authorizeCode);
        this.cachedToken = token;
        this.tokenExpiresAt = now.plus(TOKEN_TTL);
        return token;
    }

    public void registerObserver(String api, String observerId, String callbackUrl, String channelToken) {
        String token = authenticate();
        Map<String, Object> body = new HashMap<>();
        body.put("id", observerId);
        body.put("type", OBSERVER_TYPE);
        body.put("address", callbackUrl);
        body.put("token", channelToken);
        body.put("expiration", "-1");
        body.put("dataOutputType", "simple");

        Map<?, ?> response = post("/ccgf/v1/" + api + "/" + properties.clientId() + "/observer", token, body,
                "observer 등록", api);
        int result = readResult(response);
        if (result != 0) {
            throw new IllegalStateException(
                    "OTOPLUG observer 등록 실패 (api=" + api + ", result=" + result + ")");
        }
    }

    public void ignoreObserver(String api, String observerId, String channelToken) {
        String token = authenticate();
        // OTOPLUG rejects ignore requests with extra fields (result 8000016);
        // send exactly id/type/token.
        Map<String, Object> body = new HashMap<>();
        body.put("id", observerId);
        body.put("type", OBSERVER_TYPE);
        body.put("token", channelToken);

        Map<?, ?> response = post("/ccgf/v1/" + api + "/" + properties.clientId() + "/ignore", token, body,
                "observer 해제", api);
        int result = readResult(response);
        if (result != 0) {
            throw new IllegalStateException(
                    "OTOPLUG observer 해제 실패 (api=" + api + ", result=" + result + ")");
        }
    }

    private String requestAuthorizeCode() {
        try {
            Map<?, ?> response = restClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/ccgf/v1/common.auth/")
                            .queryParam("clientID", properties.clientId())
                            .queryParam("securedCode", properties.securedCode())
                            .queryParam("sessionID", UUID.randomUUID().toString())
                            .build())
                    .retrieve()
                    .body(Map.class);
            String authorizeCode = response == null ? null : asString(response.get("authorizeCode"));
            if (!StringUtils.hasText(authorizeCode)) {
                throw new IllegalStateException("OTOPLUG 인증 실패: authorizeCode가 응답에 없습니다.");
            }
            return authorizeCode;
        } catch (RestClientException exception) {
            throw new IllegalStateException("OTOPLUG 인증 요청(common.auth) 실패: " + exception.getMessage(), exception);
        }
    }

    private String requestToken(String authorizeCode) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("clientID", properties.clientId());
            body.put("authorizeCode", authorizeCode);
            body.put("redirectURI", null);

            Map<?, ?> response = restClient.post()
                    .uri("/ccgf/v1/common.auth.token")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(Map.class);
            String token = response == null ? null : asString(response.get("token"));
            if (!StringUtils.hasText(token)) {
                throw new IllegalStateException("OTOPLUG 인증 실패: token이 응답에 없습니다.");
            }
            return token;
        } catch (RestClientException exception) {
            throw new IllegalStateException(
                    "OTOPLUG 토큰 요청(common.auth.token) 실패: " + exception.getMessage(), exception);
        }
    }

    private Map<?, ?> post(String uri, String token, Map<String, Object> body, String action, String api) {
        try {
            return restClient.post()
                    .uri(uri)
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.parseMediaType("application/json;charset=utf-8"))
                    .body(body)
                    .retrieve()
                    .body(Map.class);
        } catch (RestClientException exception) {
            throw new IllegalStateException(
                    "OTOPLUG " + action + " 요청 실패 (api=" + api + "): " + exception.getMessage(), exception);
        }
    }

    private void requireCredentials() {
        if (!StringUtils.hasText(properties.clientId()) || !StringUtils.hasText(properties.securedCode())) {
            throw new IllegalStateException(
                    "OTOPLUG 미설정: 환경변수(OTOPLUG_CLIENT_ID/SECURED_CODE)를 설정하세요.");
        }
    }

    private static int readResult(Map<?, ?> response) {
        if (response == null) {
            throw new IllegalStateException("OTOPLUG 응답이 비어 있습니다.");
        }
        Object result = response.get("result");
        if (result instanceof Number number) {
            return number.intValue();
        }
        if (result instanceof String string && StringUtils.hasText(string)) {
            try {
                return Integer.parseInt(string.trim());
            } catch (NumberFormatException ignored) {
                // fall through to error below
            }
        }
        throw new IllegalStateException("OTOPLUG 응답에서 result 값을 해석할 수 없습니다: " + result);
    }

    private static String asString(Object value) {
        return value == null ? null : value.toString();
    }
}
