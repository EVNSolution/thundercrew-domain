package com.thundercrew.opsapi.devicesync.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import java.util.Iterator;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
class DeviceApiSyncSummaryRedactor {

    private static final String REDACTED_VALUE = "[REDACTED]";
    private static final Pattern AUTHORIZATION_TEXT_PATTERN = Pattern.compile(
            "(?i)(authorization\\s*[:=]\\s*)([^,;\\]}]+)"
    );
    private static final Pattern BEARER_TOKEN_PATTERN = Pattern.compile("(?i)bearer\\s+[^\\s,;]+");
    private static final Pattern QUOTED_SENSITIVE_VALUE_PATTERN = Pattern.compile(
            "(?i)(\"(?:authorization|api[-_]?key|apikey|access[-_]?token|refresh[-_]?token|password|secret|token|cookie|set[-_]?cookie|session[-_]?(?:id|token)?|session)\"\\s*:\\s*\")([^\"]*)(\")"
    );
    private static final Pattern SENSITIVE_ASSIGNMENT_PATTERN = Pattern.compile(
            "(?i)((?:api[-_]?key|apikey|access[-_]?token|refresh[-_]?token|password|secret|token|cookie|set[-_]?cookie|session[-_]?(?:id|token)?|session)(?:\\s*[:=]\\s*))([^\\s,;\\]}]+)"
    );

    private final ObjectMapper objectMapper;

    DeviceApiSyncSummaryRedactor(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    String toRedactedJson(JsonNode summary) {
        if (summary == null || summary.isNull()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(redact(summary));
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Device API sync summary cannot be serialized.", exception);
        }
    }

    JsonNode toResponseNode(String summary) {
        if (summary == null) {
            return null;
        }
        try {
            return objectMapper.readTree(summary);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Persisted device API sync summary is not valid JSON.", exception);
        }
    }

    String redactText(String value) {
        if (value == null) {
            return null;
        }
        String redacted = AUTHORIZATION_TEXT_PATTERN.matcher(value).replaceAll("$1" + REDACTED_VALUE);
        redacted = BEARER_TOKEN_PATTERN.matcher(redacted).replaceAll("Bearer " + REDACTED_VALUE);
        redacted = QUOTED_SENSITIVE_VALUE_PATTERN.matcher(redacted).replaceAll("$1" + REDACTED_VALUE + "$3");
        return SENSITIVE_ASSIGNMENT_PATTERN.matcher(redacted).replaceAll("$1" + REDACTED_VALUE);
    }

    private JsonNode redact(JsonNode source) {
        if (source.isObject()) {
            ObjectNode target = objectMapper.createObjectNode();
            Iterator<String> fieldNames = source.fieldNames();
            while (fieldNames.hasNext()) {
                String fieldName = fieldNames.next();
                if (!isSensitiveKey(fieldName)) {
                    target.set(fieldName, redact(source.get(fieldName)));
                }
            }
            return target;
        }
        if (source.isArray()) {
            ArrayNode target = objectMapper.createArrayNode();
            source.forEach(value -> target.add(redact(value)));
            return target;
        }
        if (source.isTextual()) {
            return TextNode.valueOf(redactText(source.asText()));
        }
        return source;
    }

    private boolean isSensitiveKey(String key) {
        String normalized = key.toLowerCase(Locale.ROOT).replace("_", "").replace("-", "");
        return normalized.contains("authorization")
                || normalized.contains("password")
                || normalized.contains("secret")
                || normalized.contains("apikey")
                || normalized.contains("accesstoken")
                || normalized.contains("refreshtoken")
                || normalized.contains("cookie")
                || normalized.contains("session")
                || normalized.equals("token")
                || normalized.endsWith("token");
    }

}
