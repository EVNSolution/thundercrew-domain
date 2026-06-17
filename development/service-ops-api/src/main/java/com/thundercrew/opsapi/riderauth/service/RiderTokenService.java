package com.thundercrew.opsapi.riderauth.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/**
 * 라이더용 무상태(stateless) JWT 발급. admin 토큰과 동일한 시크릿/issuer/HS256 으로
 * 서명하되 role=RIDER, subject=riderId, riderId 클레임을 싣는다. access/refresh 를
 * tokenType 클레임으로 구분한다 — refresh 토큰은 SecurityConfig 의 권한 변환기에서
 * ROLE_RIDER 를 받지 못해 리소스 접근에 쓸 수 없다.
 */
@Service
public class RiderTokenService {

    public static final String ROLE_RIDER = "RIDER";
    public static final String TOKEN_TYPE_ACCESS = "access";
    public static final String TOKEN_TYPE_REFRESH = "refresh";

    private final JwtEncoder jwtEncoder;
    private final Clock clock;
    private final String issuer;
    private final Duration accessTokenTtl;
    private final Duration refreshTokenTtl;

    public RiderTokenService(
            JwtEncoder jwtEncoder,
            Clock clock,
            @Value("${thundercrew.auth.jwt.issuer:thundercrew-domain}") String issuer,
            @Value("${thundercrew.auth.rider.access-token-ttl:PT30M}") Duration accessTokenTtl,
            @Value("${thundercrew.auth.rider.refresh-token-ttl:P14D}") Duration refreshTokenTtl
    ) {
        this.jwtEncoder = jwtEncoder;
        this.clock = clock;
        this.issuer = issuer;
        this.accessTokenTtl = accessTokenTtl;
        this.refreshTokenTtl = refreshTokenTtl;
    }

    public IssuedToken issueAccessToken(UUID riderId) {
        return issue(riderId, TOKEN_TYPE_ACCESS, accessTokenTtl);
    }

    public IssuedToken issueRefreshToken(UUID riderId) {
        return issue(riderId, TOKEN_TYPE_REFRESH, refreshTokenTtl);
    }

    private IssuedToken issue(UUID riderId, String tokenType, Duration ttl) {
        Instant issuedAt = Instant.now(clock);
        Instant expiresAt = issuedAt.plus(ttl);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(issuer)
                .subject(riderId.toString())
                .id(UUID.randomUUID().toString())
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .claim("riderId", riderId.toString())
                .claim("role", ROLE_RIDER)
                .claim("tokenType", tokenType)
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
        return new IssuedToken(token, expiresAt);
    }

    public record IssuedToken(String value, Instant expiresAt) {
    }
}
