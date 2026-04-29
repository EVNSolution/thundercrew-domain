package com.thundercrew.opsapi.auth.service;

import com.thundercrew.opsapi.auth.dto.AdminIdentityResponse;
import com.thundercrew.opsapi.auth.dto.AdminLoginRequest;
import com.thundercrew.opsapi.auth.dto.AdminLoginResponse;
import com.thundercrew.opsapi.auth.repository.AdminUserAccount;
import com.thundercrew.opsapi.auth.repository.AdminUserAccountRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminAuthService {

    private final AdminUserAccountRepository adminUserAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;

    public AdminAuthService(
            AdminUserAccountRepository adminUserAccountRepository,
            PasswordEncoder passwordEncoder,
            JwtTokenService jwtTokenService
    ) {
        this.adminUserAccountRepository = adminUserAccountRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
    }

    @Transactional(readOnly = true)
    public AdminLoginResponse login(AdminLoginRequest request) {
        AdminUserAccount account = adminUserAccountRepository.findEnabledActiveByLoginId(request.loginId())
                .filter(candidate -> passwordEncoder.matches(request.password(), candidate.passwordHash()))
                .orElseThrow(AdminAuthenticationException::new);

        AdminIdentityResponse admin = AdminIdentityResponse.from(account);
        JwtTokenService.IssuedToken token = jwtTokenService.issueAccessToken(account);
        return AdminLoginResponse.bearer(token.value(), token.expiresAt(), admin);
    }
}
