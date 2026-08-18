package com.thundercrew.opsapi.common.api;

/**
 * 요청 형식은 맞지만 도메인 규칙상 조합이 성립하지 않는 경우 — 400 VALIDATION_FAILED.
 * 예: 클린차량에 라이더 매칭, 배송 계약에 직영/협력 지정.
 *
 * {@code @Valid} 가 잡는 필드 단위 오류와 달리 **필드 간·엔티티 간** 규칙 위반이다.
 * 409(InvalidStateTransition)와도 다르다 — 상태 전이가 아니라 입력 조합의 문제다.
 */
public class ValidationFailedException extends RuntimeException {

    public ValidationFailedException(String message) {
        super(message);
    }
}
