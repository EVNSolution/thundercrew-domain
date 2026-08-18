package com.thundercrew.opsapi.settings.repository;

import com.thundercrew.opsapi.settings.domain.AppSetting;
import java.util.List;
import java.util.Optional;
import org.springframework.data.repository.Repository;

public interface AppSettingRepository extends Repository<AppSetting, String> {

    List<AppSetting> findAll();

    Optional<AppSetting> findById(String key);

    AppSetting save(AppSetting setting);
}
