package com.thundercrew.opsapi;

import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
import java.util.Map;
import java.util.Set;

import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noFields;

@AnalyzeClasses(packages = "com.thundercrew.opsapi", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureBoundaryTests {

    @ArchTest
    static final ArchRule common_must_not_depend_on_bounded_contexts = classes()
            .that().resideInAPackage("..common..")
            .should().onlyDependOnClassesThat().resideOutsideOfPackages(
                    "..auth..",
                    "..rider..",
                    "..bike..",
                    "..contract..",
                    "..insurance..",
                    "..equipment..",
                    "..device..",
                    "..devicesync..",
                    "..telemetry..",
                    "..station..",
                    "..dashboard..",
                    "..vendor..");

    @ArchTest
    static final ArchRule issue_70_auth_commands_are_the_only_auth_write_route_exceptions = methods()
            .that().areDeclaredInClassesThat().resideInAPackage("..controller..")
            .should(onlyAllowedAuthCommandsMayUseWriteRouteMappings());

    @ArchTest
    static final ArchRule issue_70_auth_commands_are_the_only_auth_request_body_exceptions = methods()
            .that().areDeclaredInClassesThat().resideInAPackage("..controller..")
            .should(onlyAllowedAuthCommandsMayHaveRequestBodyParameters());

    @ArchTest
    static final ArchRule issue_68_dashboard_package_remains_read_only = methods()
            .that().areDeclaredInClassesThat().resideInAPackage("..dashboard..")
            .should(notUseWriteRouteMappings());

    @ArchTest
    static final ArchRule persistence_baseline_must_not_use_jpa_relationship_annotations = noFields()
            .should().beAnnotatedWith(ManyToOne.class)
            .orShould().beAnnotatedWith(OneToMany.class)
            .orShould().beAnnotatedWith(OneToOne.class)
            .orShould().beAnnotatedWith(ManyToMany.class);


    private static ArchCondition<JavaMethod> notUseWriteRouteMappings() {
        return new ArchCondition<>("not use write route mappings") {
            @Override
            public void check(JavaMethod method, ConditionEvents events) {
                boolean hasWriteRouteMapping = method.isAnnotatedWith(PostMapping.class)
                        || method.isAnnotatedWith(PutMapping.class)
                        || method.isAnnotatedWith(PatchMapping.class)
                        || method.isAnnotatedWith(DeleteMapping.class);
                if (hasWriteRouteMapping) {
                    events.add(SimpleConditionEvent.violated(
                            method,
                            method.getFullName() + " must stay read-only for the dashboard map aggregate scope"
                    ));
                }
            }
        };
    }

    /**
     * write 엔드포인트를 둘 수 있는 컨트롤러와 메서드.
     *
     * <p>키는 컨트롤러 FQN(패키지 접두사 제외), 값은 허용 메서드 이름.
     * **값이 빈 집합이면 그 컨트롤러의 모든 메서드를 허용한다.**
     *
     * <p>전에는 컨트롤러마다 {@code isXxxCommand(JavaMethod)} 술어를 만들고 25항 {@code ||}
     * 사슬로 엮었다. 200줄 남짓이 그 보일러플레이트였고, 엔드포인트를 추가할 때 그 사슬을
     * 고쳐야 한다는 것을 아무도 알려주지 않았다. 그래서 allowlist 가 낡아 20건이 위반으로
     * 잡혀 있었다 — 규칙을 어긴 코드가 아니라 등록이 빠진 코드였다.
     *
     * <p>규칙의 의도는 유지한다. write 엔드포인트를 새로 만들면 여기에 한 줄을 추가하는
     * **의도적 행위**가 필요하다. 다만 그 한 줄이 값싸야 한다.
     *
     * <p>두 규칙(write 라우트, {@code @RequestBody})이 이 목록을 함께 쓴다. 전에는
     * {@code @RequestBody} 사슬에만 {@code OtoplugObserverController} 가 빠져 있었는데, 그
     * 컨트롤러에 {@code @RequestBody} 파라미터가 없어서 드러나지 않은 비대칭이었다.
     * 설계로 보이지 않아 통합했다.
     */
    private static final Map<String, Set<String>> WRITE_ALLOWLIST = Map.ofEntries(
            Map.entry("auth.controller.AuthController",
                    Set.of("login", "refresh", "logout", "changePassword")),
            Map.entry("rider.controller.RiderCommandController",
                    Set.of("create", "update", "linkAppAccount", "unlinkAppAccount", "delete")),
            Map.entry("rider.controller.RiderEducationRecordCommandController",
                    Set.of("create", "update", "delete")),
            Map.entry("rider.controller.RiderBulkController",
                    Set.of("bulkPreview", "bulkApply")),
            Map.entry("rider.controller.RiderSelfCommandController", Set.of()),
            Map.entry("bike.controller.BikeCommandController",
                    Set.of("create", "update", "changeOperationStatus", "setIgnitionBlocked", "delete")),
            Map.entry("bike.controller.BikeBulkController",
                    Set.of("bulkPreview", "bulkApply")),
            Map.entry("bike.controller.BikeNextCustomerController",
                    Set.of("put", "promote", "delete")),
            Map.entry("contract.controller.ContractTemplateCommandController",
                    Set.of("create", "update", "delete")),
            Map.entry("contract.controller.RiderBikeContractCommandController",
                    Set.of("create", "update", "terminate")),
            Map.entry("contract.controller.ContractBulkController",
                    Set.of("bulkPreview", "bulkApply")),
            Map.entry("device.controller.DeviceCommandController",
                    Set.of("create", "update", "delete")),
            Map.entry("device.controller.BikeDeviceInstallationCommandController",
                    Set.of("create", "remove")),
            Map.entry("equipment.controller.EquipmentTypeCommandController",
                    Set.of("create", "update", "delete")),
            Map.entry("equipment.controller.BikeEquipmentCommandController",
                    Set.of("create", "update", "remove")),
            Map.entry("insurance.controller.InsuranceItemCommandController",
                    Set.of("create", "update", "delete")),
            Map.entry("insurance.controller.RiderInsuranceCommandController",
                    Set.of("create", "update", "delete")),
            Map.entry("station.controller.StationCommandController",
                    Set.of("create", "update", "updateBatteryCounts", "delete")),
            Map.entry("maintenance.controller.MaintenanceCommandController",
                    Set.of("createItem", "updateItem", "deleteItem", "createRecord", "deleteRecord")),
            Map.entry("telemetry.controller.TelemetryIngestionController", Set.of("ingest")),
            Map.entry("devicesync.controller.DeviceApiSyncController",
                    Set.of("createRun", "recordResult", "completeRun")),
            Map.entry("otoplug.controller.OtoplugObserverController", Set.of("register", "ignore")),
            Map.entry("tip.controller.TipCommandController", Set.of()),
            Map.entry("dispatch.controller.DispatchOrderCommandController", Set.of()),
            Map.entry("dispatch.controller.DispatchBatchCommandController", Set.of()),
            Map.entry("notification.controller.ReignitionNotificationCommandController", Set.of()),
            Map.entry("notification.controller.NotificationCommandController", Set.of()),
            Map.entry("audit.controller.AuditLogCommandController", Set.of()),
            Map.entry("riderauth.controller.RiderAuthController", Set.of()),
            Map.entry("riderauth.controller.RiderCredentialAdminController", Set.of()));

    private static final String PACKAGE_PREFIX = "com.thundercrew.opsapi.";
    private static final String QUOTE_CHAR = String.valueOf((char) 34);

    private static boolean isAllowedWriteEndpoint(JavaMethod method) {
        String owner = method.getOwner().getName();
        if (!owner.startsWith(PACKAGE_PREFIX)) {
            return false;
        }
        Set<String> allowedMethods = WRITE_ALLOWLIST.get(owner.substring(PACKAGE_PREFIX.length()));
        if (allowedMethods == null) {
            return false;
        }
        return allowedMethods.isEmpty() || allowedMethods.contains(method.getName());
    }

    /** 위반 메시지가 무엇을 해야 하는지 알려준다. 목록만 가리키면 다시 낡는다. */
    private static String registrationHint(JavaMethod method) {
        String shortOwner = method.getOwner().getName().replace(PACKAGE_PREFIX, "");
        return method.getFullName()
                + " 가 허용 목록에 없습니다. 의도한 write 엔드포인트라면 ArchitectureBoundaryTests"
                + " 의 WRITE_ALLOWLIST 에 " + QUOTE_CHAR + shortOwner + QUOTE_CHAR + " -> "
                + QUOTE_CHAR + method.getName() + QUOTE_CHAR + " 를 추가하세요."
                + " 의도한 것이 아니라면 읽기 컨트롤러에서 write 매핑을 빼세요.";
    }

    private static boolean hasWriteRouteMapping(JavaMethod method) {
        return method.isAnnotatedWith(PostMapping.class)
                || method.isAnnotatedWith(PutMapping.class)
                || method.isAnnotatedWith(PatchMapping.class)
                || method.isAnnotatedWith(DeleteMapping.class);
    }

    private static ArchCondition<JavaMethod> onlyAllowedAuthCommandsMayUseWriteRouteMappings() {
        return new ArchCondition<>("use write route mappings only on allowed command controllers") {
            @Override
            public void check(JavaMethod method, ConditionEvents events) {
                if (!hasWriteRouteMapping(method) || isAllowedWriteEndpoint(method)) {
                    return;
                }
                events.add(SimpleConditionEvent.violated(method, registrationHint(method)));
            }
        };
    }

    private static ArchCondition<JavaMethod> onlyAllowedAuthCommandsMayHaveRequestBodyParameters() {
        return new ArchCondition<>("have @RequestBody parameters only on allowed command controllers") {
            @Override
            public void check(JavaMethod method, ConditionEvents events) {
                boolean hasRequestBodyParameter = method.getParameters().stream()
                        .anyMatch(parameter -> parameter.isAnnotatedWith(RequestBody.class));
                if (!hasRequestBodyParameter || isAllowedWriteEndpoint(method)) {
                    return;
                }
                events.add(SimpleConditionEvent.violated(method, registrationHint(method)));
            }
        };
    }

}
