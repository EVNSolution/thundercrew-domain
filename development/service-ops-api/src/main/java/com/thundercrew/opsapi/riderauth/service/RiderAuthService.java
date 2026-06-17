package com.thundercrew.opsapi.riderauth.service;

import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import com.thundercrew.opsapi.rider.domain.Rider;
import com.thundercrew.opsapi.rider.repository.RiderRepository;
import com.thundercrew.opsapi.riderauth.domain.RiderCredential;
import com.thundercrew.opsapi.riderauth.dto.RiderIdentityResponse;
import com.thundercrew.opsapi.riderauth.dto.RiderLoginRequest;
import com.thundercrew.opsapi.riderauth.dto.RiderLoginResponse;
import com.thundercrew.opsapi.riderauth.dto.RiderRefreshRequest;
import com.thundercrew.opsapi.riderauth.repository.RiderCredentialRepository;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RiderAuthService {

    private final RiderRepository riderRepository;
    private final RiderCredentialRepository riderCredentialRepository;
    private final PasswordEncoder passwordEncoder;
    private final RiderTokenService riderTokenService;
    private final JwtDecoder jwtDecoder;

    public RiderAuthService(
            RiderRepository riderRepository,
            RiderCredentialRepository riderCredentialRepository,
            PasswordEncoder passwordEncoder,
            RiderTokenService riderTokenService,
            JwtDecoder jwtDecoder
    ) {
        this.riderRepository = riderRepository;
        this.riderCredentialRepository = riderCredentialRepository;
        this.passwordEncoder = passwordEncoder;
        this.riderTokenService = riderTokenService;
        this.jwtDecoder = jwtDecoder;
    }

    @Transactional(readOnly = true)
    public RiderLoginResponse login(RiderLoginRequest request) {
        Rider rider = riderRepository.findByPhoneNumberAndDeletedAtIsNull(request.phoneNumber())
                .orElseThrow(RiderAuthenticationException::new);
        riderCredentialRepository.findByRiderId(rider.getId())
                .filter(credential -> passwordEncoder.matches(request.password(), credential.getPasswordHash()))
                .orElseThrow(RiderAuthenticationException::new);
        return issueTokens(rider);
    }

    @Transactional(readOnly = true)
    public RiderLoginResponse refresh(RiderRefreshRequest request) {
        Jwt jwt;
        try {
            jwt = jwtDecoder.decode(request.refreshToken());
        } catch (JwtException exception) {
            throw new RiderAuthenticationException();
        }
        if (!RiderTokenService.ROLE_RIDER.equals(jwt.getClaimAsString("role"))
                || !RiderTokenService.TOKEN_TYPE_REFRESH.equals(jwt.getClaimAsString("tokenType"))) {
            throw new RiderAuthenticationException();
        }
        UUID riderId = parseRiderId(jwt.getClaimAsString("riderId"));
        Rider rider = riderRepository.findByIdAndDeletedAtIsNull(riderId)
                .orElseThrow(RiderAuthenticationException::new);
        return issueTokens(rider);
    }

    @Transactional
    public void setPassword(UUID riderId, String rawPassword) {
        if (riderRepository.findByIdAndDeletedAtIsNull(riderId).isEmpty()) {
            throw new ResourceNotFoundException("Rider", riderId);
        }
        String passwordHash = passwordEncoder.encode(rawPassword);
        RiderCredential credential = riderCredentialRepository.findByRiderId(riderId).orElse(null);
        if (credential == null) {
            credential = RiderCredential.create(riderId, passwordHash);
        } else {
            credential.updatePasswordHash(passwordHash);
        }
        riderCredentialRepository.save(credential);
    }

    private RiderLoginResponse issueTokens(Rider rider) {
        RiderTokenService.IssuedToken accessToken = riderTokenService.issueAccessToken(rider.getId());
        RiderTokenService.IssuedToken refreshToken = riderTokenService.issueRefreshToken(rider.getId());
        return RiderLoginResponse.bearer(
                accessToken.value(),
                accessToken.expiresAt(),
                refreshToken.value(),
                refreshToken.expiresAt(),
                RiderIdentityResponse.from(rider)
        );
    }

    private UUID parseRiderId(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new RiderAuthenticationException();
        }
    }
}
