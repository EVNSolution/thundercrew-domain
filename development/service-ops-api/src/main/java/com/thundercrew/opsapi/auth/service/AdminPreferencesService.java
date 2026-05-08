package com.thundercrew.opsapi.auth.service;

import com.thundercrew.opsapi.auth.dto.AdminPreferencesResponse;
import com.thundercrew.opsapi.auth.repository.AdminUserAccount;
import com.thundercrew.opsapi.auth.repository.AdminUserAccountRepository;
import com.thundercrew.opsapi.common.api.ResourceNotFoundException;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads and updates per-admin runtime preferences. Currently surfaces the
 * NCP Maps SDK toggle only, but the service stays in the auth domain because
 * the data lives on the admin account itself.
 *
 * <p>Both methods identify the operator via the JWT subject claim — the
 * controller never accepts a path-param admin id, so one operator cannot
 * read or mutate another operator's preferences.</p>
 */
@Service
public class AdminPreferencesService {

    private final AdminUserAccountRepository accountRepository;

    public AdminPreferencesService(AdminUserAccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    @Transactional(readOnly = true)
    public AdminPreferencesResponse getMine(UUID adminId) {
        AdminUserAccount account = accountRepository.findEnabledActiveById(adminId)
                .orElseThrow(() -> new ResourceNotFoundException("AdminUser", adminId));
        return new AdminPreferencesResponse(account.id(), account.ncpMapEnabled());
    }

    @Transactional
    public AdminPreferencesResponse updateMine(UUID adminId, boolean ncpMapEnabled) {
        int updated = accountRepository.updateNcpMapEnabled(adminId, ncpMapEnabled);
        if (updated == 0) {
            throw new ResourceNotFoundException("AdminUser", adminId);
        }
        return new AdminPreferencesResponse(adminId, ncpMapEnabled);
    }
}
