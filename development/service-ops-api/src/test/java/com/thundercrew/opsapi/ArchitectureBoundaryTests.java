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
import org.springframework.web.bind.annotation.RestController;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
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
    static final ArchRule issue_52_auth_login_is_the_only_write_route_exception = methods()
            .that().areDeclaredInClassesThat().resideInAPackage("..controller..")
            .should(onlyAuthLoginMayUseWriteRouteMappings());

    @ArchTest
    static final ArchRule issue_52_auth_login_is_the_only_request_body_exception = methods()
            .that().areDeclaredInClassesThat().resideInAPackage("..controller..")
            .should(onlyAuthLoginMayHaveRequestBodyParameters());

    @ArchTest
    static final ArchRule issue_14_must_not_add_telemetry_or_dashboard_controllers = noClasses()
            .that().resideInAnyPackage("..telemetry..", "..dashboard..")
            .should().beAnnotatedWith(RestController.class);

    @ArchTest
    static final ArchRule persistence_baseline_must_not_use_jpa_relationship_annotations = noFields()
            .should().beAnnotatedWith(ManyToOne.class)
            .orShould().beAnnotatedWith(OneToMany.class)
            .orShould().beAnnotatedWith(OneToOne.class)
            .orShould().beAnnotatedWith(ManyToMany.class);

    private static ArchCondition<JavaMethod> onlyAuthLoginMayUseWriteRouteMappings() {
        return new ArchCondition<>("use write route mappings only on AuthController.login") {
            @Override
            public void check(JavaMethod method, ConditionEvents events) {
                boolean hasWriteRouteMapping = method.isAnnotatedWith(PostMapping.class)
                        || method.isAnnotatedWith(PutMapping.class)
                        || method.isAnnotatedWith(PatchMapping.class)
                        || method.isAnnotatedWith(DeleteMapping.class);
                if (!hasWriteRouteMapping
                        || isAuthLogin(method)
                        || isRiderCommand(method)
                        || isBikeCommand(method)
                        || isContractTemplateCommand(method)
                        || isRiderBikeContractCommand(method)
                        || isDeviceCommand(method)
                        || isBikeDeviceInstallationCommand(method)
                        || isEquipmentTypeCommand(method)
                        || isBikeEquipmentCommand(method)
                        || isInsuranceItemCommand(method)
                        || isRiderInsuranceCommand(method)) {
                    return;
                }

                events.add(SimpleConditionEvent.violated(
                        method,
                        method.getFullName() + " must not declare write route mappings outside auth login"
                ));
            }
        };
    }

    private static ArchCondition<JavaMethod> onlyAuthLoginMayHaveRequestBodyParameters() {
        return new ArchCondition<>("have @RequestBody parameters only on AuthController.login") {
            @Override
            public void check(JavaMethod method, ConditionEvents events) {
                boolean hasRequestBodyParameter = method.getParameters().stream()
                        .anyMatch(parameter -> parameter.isAnnotatedWith(RequestBody.class));
                if (!hasRequestBodyParameter) {
                    return;
                }

                if (!isAuthLogin(method)
                        && !isRiderCommand(method)
                        && !isBikeCommand(method)
                        && !isContractTemplateCommand(method)
                        && !isRiderBikeContractCommand(method)
                        && !isDeviceCommand(method)
                        && !isBikeDeviceInstallationCommand(method)
                        && !isEquipmentTypeCommand(method)
                        && !isBikeEquipmentCommand(method)
                        && !isInsuranceItemCommand(method)
                        && !isRiderInsuranceCommand(method)) {
                    events.add(SimpleConditionEvent.violated(
                            method,
                            method.getFullName() + " must not declare @RequestBody parameters outside auth login"
                    ));
                }
            }
        };
    }

    private static boolean isAuthLogin(JavaMethod method) {
        return method.getOwner().getName().equals("com.thundercrew.opsapi.auth.controller.AuthController")
                && method.getName().equals("login");
    }

    private static boolean isRiderCommand(JavaMethod method) {
        return method.getOwner().getName().equals("com.thundercrew.opsapi.rider.controller.RiderCommandController")
                && (method.getName().equals("create")
                || method.getName().equals("update")
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
                && method.getName().equals("create");
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

}
