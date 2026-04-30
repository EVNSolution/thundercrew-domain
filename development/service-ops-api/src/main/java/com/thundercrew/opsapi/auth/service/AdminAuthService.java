package com.thundercrew.opsapi.auth.service;

import com.thundercrew.opsapi.auth.dto.AdminIdentityResponse;
import com.thundercrew.opsapi.auth.dto.AdminLoginRequest;
import com.thundercrew.opsapi.auth.dto.AdminLoginResponse;
import com.thundercrew.opsapi.auth.dto.AdminRefreshRequest;
import com.thundercrew.opsapi.auth.repository.AdminAuthSession;
import com.thundercrew.opsapi.auth.repository.AdminAuthSessionRepository;
import com.thundercrew.opsapi.auth.repository.AdminUserAccount;
import com.thundercrew.opsapi.auth.repository.AdminUserAccountRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAuthService {

    private final AdminUserAccountRepository adminUserAccountRepository;
    private final AdminAuthSessionRepository adminAuthSessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final RefreshTokenService refreshTokenService;
    private final Clock clock;
    private final Duration refreshTokenTtl;

    public AdminAuthService(
            AdminUserAccountRepository adminUserAccountRepository,
            AdminAuthSessionRepository adminAuthSessionRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService,
            RefreshTokenService refreshTokenService,
            Clock clock,
            @Value("${thundercrew.auth.refresh-token-ttl:P14D}") Duration refreshTokenTtl
    ) {
        this.adminUserAccountRepository = adminUserAccountRepository;
        this.adminAuthSessionRepository = adminAuthSessionRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.refreshTokenService = refreshTokenService;
        this.clock = clock;
        this.refreshTokenTtl = refreshTokenTtl;
    }

    @Transactional
    public AdminLoginResponse login(AdminLoginRequest request) {
        AdminUserAccount account = adminUserAccountRepository.findEnabledActiveByLoginId(request.loginId())
                .filter(candidate -> passwordEncoder.matches(request.password(), candidate.passwordHash()))
                .orElseThrow(AdminAuthenticationException::new);

        return issueTokenPair(account);
    }

    @Transactional
    public AdminLoginResponse refresh(AdminRefreshRequest request) {
        Instant now = Instant.now(clock);
        AdminAuthSession currentSession = adminAuthSessionRepository
                .findActiveByRefreshTokenHash(refreshTokenService.hash(request.refreshToken()), now)
                .orElseThrow(AdminAuthenticationException::new);
        adminAuthSessionRepository.markLastUsed(currentSession.id(), now);

        AdminUserAccount account = adminUserAccountRepository.findEnabledActiveById(currentSession.adminUserId())
                .orElseThrow(() -> {
                    adminAuthSessionRepository.revoke(currentSession.id(), now, "ADMIN_DISABLED_OR_DELETED", null);
                    return new AdminAuthenticationException();
                });

        IssuedAuthPair nextPair = issueTokenPairInternal(account, now);
        adminAuthSessionRepository.revoke(currentSession.id(), now, "ROTATED", nextPair.sessionId());
        return nextPair.response();
    }

    @Transactional
    public void logout(String accessTokenJti) {
        adminAuthSessionRepository.revokeByAccessTokenJti(accessTokenJti, Instant.now(clock), "LOGOUT");
    }

    private AdminLoginResponse issueTokenPair(AdminUserAccount account) {
        return issueTokenPairInternal(account, Instant.now(clock)).response();
    }

    private IssuedAuthPair issueTokenPairInternal(AdminUserAccount account, Instant issuedAt) {
        UUID sessionId = UUID.randomUUID();
        String accessTokenJti = UUID.randomUUID().toString();
        String refreshToken = refreshTokenService.generate();
        Instant refreshExpiresAt = issuedAt.plus(refreshTokenTtl);

        JwtTokenService.IssuedToken accessToken = jwtTokenService.issueAccessToken(account, sessionId, accessTokenJti);
        adminAuthSessionRepository.save(new AdminAuthSession(
                sessionId,
                account.id(),
                accessTokenJti,
                accessToken.expiresAt(),
                refreshTokenService.hash(refreshToken),
                refreshExpiresAt,
                issuedAt,
                null,
                null,
                null,
                null
        ));

        AdminLoginResponse response = AdminLoginResponse.bearer(
                accessToken.value(),
                accessToken.expiresAt(),
                refreshToken,
                refreshExpiresAt,
                AdminIdentityResponse.from(account)
        );
        return new IssuedAuthPair(sessionId, response);
    }

    private record IssuedAuthPair(UUID sessionId, AdminLoginResponse response) {
    }
}
