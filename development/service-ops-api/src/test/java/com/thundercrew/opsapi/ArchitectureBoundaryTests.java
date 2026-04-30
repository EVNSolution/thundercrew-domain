package com.thundercrew.opsapi;

import com.tngtech.archunit.core.domain.JavaMethod;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchCondition;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.lang.ConditionEvents;
import com.tngtech.archunit.lang.SimpleConditionEvent;
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
                    "..telemetry..",
                    "..station..",
                    "..dashboard..");

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

    private static ArchCondition<JavaMethod> onlyAllowedAuthCommandsMayUseWriteRouteMappings() {
        return new ArchCondition<>("use write route mappings only on allowed command controllers") {
            @Override
            public void check(JavaMethod method, ConditionEvents events) {
                boolean hasWriteRouteMapping = method.isAnnotatedWith(PostMapping.class)
                        || method.isAnnotatedWith(PutMapping.class)
                        || method.isAnnotatedWith(PatchMapping.class)
                        || method.isAnnotatedWith(DeleteMapping.class);
                if (!hasWriteRouteMapping
                        || isAllowedAuthCommand(method)
                        || isRiderCommand(method)
                        || isBikeCommand(method)
                        || isContractTemplateCommand(method)
                        || isRiderBikeContractCommand(method)
                        || isDeviceCommand(method)
                        || isBikeDeviceInstallationCommand(method)
                        || isEquipmentTypeCommand(method)
                        || isBikeEquipmentCommand(method)
                        || isInsuranceItemCommand(method)
                        || isRiderInsuranceCommand(method)
                        || isStationCommand(method)
                        || isTelemetryIngestionCommand(method)) {
                    return;
                }

                events.add(SimpleConditionEvent.violated(
                        method,
                        method.getFullName() + " must not declare write route mappings outside allowed command controllers"
                ));
            }
        };
    }

    private static ArchCondition<JavaMethod> onlyAllowedAuthCommandsMayHaveRequestBodyParameters() {
        return new ArchCondition<>("have @RequestBody parameters only on allowed command controllers") {
            @Override
            public void check(JavaMethod method, ConditionEvents events) {
                boolean hasRequestBodyParameter = method.getParameters().stream()
                        .anyMatch(parameter -> parameter.isAnnotatedWith(RequestBody.class));
                if (!hasRequestBodyParameter) {
                    return;
                }

                if (!isAllowedAuthCommand(method)
                        && !isRiderCommand(method)
                        && !isBikeCommand(method)
                        && !isContractTemplateCommand(method)
                        && !isRiderBikeContractCommand(method)
                        && !isDeviceCommand(method)
                        && !isBikeDeviceInstallationCommand(method)
                        && !isEquipmentTypeCommand(method)
                        && !isBikeEquipmentCommand(method)
                        && !isInsuranceItemCommand(method)
                        && !isRiderInsuranceCommand(method)
                        && !isStationCommand(method)
                        && !isTelemetryIngestionCommand(method)) {
                    events.add(SimpleConditionEvent.violated(
                            method,
                            method.getFullName() + " must not declare @RequestBody parameters outside allowed command controllers"
                    ));
                }
            }
        };
    }

    private static boolean isAllowedAuthCommand(JavaMethod method) {
        return method.getOwner().getName().equals("com.thundercrew.opsapi.auth.controller.AuthController")
                && (method.getName().equals("login")
                || method.getName().equals("refresh")
                || method.getName().equals("logout"));
    }

    private static boolean isRiderCommand(JavaMethod method) {
        return method.getOwner().getName().equals("com.thundercrew.opsapi.rider.controller.RiderCommandController")
                && (method.getName().equals("create")
                || method.getName().equals("update")
                || method.getName().equals("linkAppAccount")
                || method.getName().equals("unlinkAppAccount")
                || method.getName().equals("delete"));
    }

    private static boolean isBikeCommand(JavaMethod method) {
        return method.getOwner().getName().equals("com.thundercrew.opsapi.bike.controller.BikeCommandController")
                && (method.getName().equals("create")
                || method.getName().equals("update")
                || method.getName().equals("changeOperationStatus")
                || method.getName().equals("delete"));
    }

    private static boolean isContractTemplateCommand(JavaMethod method) {
        return method.getOwner().getName().equals("com.thundercrew.opsapi.contract.controller.ContractTemplateCommandController")
                && (method.getName().equals("create")
                || method.getName().equals("update")
                || method.getName().equals("delete"));
    }

    private static boolean isRiderBikeContractCommand(JavaMethod method) {
        return method.getOwner().getName().equals("com.thundercrew.opsapi.contract.controller.RiderBikeContractCommandController")
                && (method.getName().equals("create")
                || method.getName().equals("update")
                || method.getName().equals("terminate"));
    }

    private static boolean isDeviceCommand(JavaMethod method) {
        return method.getOwner().getName().equals("com.thundercrew.opsapi.device.controller.DeviceCommandController")
                && (method.getName().equals("create")
                || method.getName().equals("update")
                || method.getName().equals("delete"));
    }

    private static boolean isBikeDeviceInstallationCommand(JavaMethod method) {
        return method.getOwner().getName().equals("com.thundercrew.opsapi.device.controller.BikeDeviceInstallationCommandController")
                && (method.getName().equals("create")
                || method.getName().equals("remove"));
    }

    private static boolean isEquipmentTypeCommand(JavaMethod method) {
        return method.getOwner().getName().equals("com.thundercrew.opsapi.equipment.controller.EquipmentTypeCommandController")
                && (method.getName().equals("create")
                || method.getName().equals("update")
                || method.getName().equals("delete"));
    }

    private static boolean isBikeEquipmentCommand(JavaMethod method) {
        return method.getOwner().getName().equals("com.thundercrew.opsapi.equipment.controller.BikeEquipmentCommandController")
                && (method.getName().equals("create")
                || method.getName().equals("update")
                || method.getName().equals("remove"));
    }

    private static boolean isInsuranceItemCommand(JavaMethod method) {
        return method.getOwner().getName().equals("com.thundercrew.opsapi.insurance.controller.InsuranceItemCommandController")
                && (method.getName().equals("create")
                || method.getName().equals("update")
                || method.getName().equals("delete"));
    }

    private static boolean isRiderInsuranceCommand(JavaMethod method) {
        return method.getOwner().getName().equals("com.thundercrew.opsapi.insurance.controller.RiderInsuranceCommandController")
                && (method.getName().equals("create")
                || method.getName().equals("update")
                || method.getName().equals("delete"));
    }

    private static boolean isStationCommand(JavaMethod method) {
        return method.getOwner().getName().equals("com.thundercrew.opsapi.station.controller.StationCommandController")
                && (method.getName().equals("create")
                || method.getName().equals("update")
                || method.getName().equals("updateBatteryCounts")
                || method.getName().equals("delete"));
    }

    private static boolean isTelemetryIngestionCommand(JavaMethod method) {
        return method.getOwner().getName().equals("com.thundercrew.opsapi.telemetry.controller.TelemetryIngestionController")
                && method.getName().equals("ingest");
    }

}
